require("dotenv/config");

const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { io } = require("socket.io-client");

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:4000";
const prisma = new PrismaClient();
const createdUserIds = [];
const createdRideIds = [];
const sockets = [];
const webhookTransactionIds = [];

async function request(path, { token, method = "GET", body } = {}) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const detail = payload?.error ? `${payload.error.code}: ${payload.error.message}` : `HTTP ${response.status}`;
    throw new Error(`${method} ${path} failed - ${detail}`);
  }
  return payload.data;
}

function waitForEvent(socket, event, predicate = () => true, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for Socket.IO event ${event}`));
    }, timeoutMs);
    const handler = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

function connectSocket(accessToken) {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      auth: { token: accessToken },
      forceNew: true,
      transports: ["websocket", "polling"]
    });
    sockets.push(socket);
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error("Socket.IO connection timed out"));
    }, 6000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function joinRide(socket, rideId) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("join:ride acknowledgement timed out")), 4000);
    socket.emit("join:ride", rideId, (result) => {
      clearTimeout(timer);
      result?.success ? resolve() : reject(new Error("join:ride was denied"));
    });
  });
}

async function cleanup() {
  sockets.forEach((socket) => socket.disconnect());
  if (webhookTransactionIds.length) {
    await prisma.paymentWebhookEvent.deleteMany({ where: { providerTransactionId: { in: webhookTransactionIds } } });
  }
  if (createdRideIds.length) {
    const rides = { in: createdRideIds };
    await prisma.walletTransaction.deleteMany({ where: { rideId: rides } });
    await prisma.payment.deleteMany({ where: { rideId: rides } });
    await prisma.rating.deleteMany({ where: { rideId: rides } });
    await prisma.promotionUsage.deleteMany({ where: { rideId: rides } });
    await prisma.rideRejection.deleteMany({ where: { rideId: rides } });
    await prisma.rideStatusLog.deleteMany({ where: { rideId: rides } });
    await prisma.ride.deleteMany({ where: { id: rides } });
  }
  if (createdUserIds.length) {
    const wallets = await prisma.customerWallet.findMany({ where: { userId: { in: createdUserIds } }, select: { id: true } });
    if (wallets.length) await prisma.customerWalletTransaction.deleteMany({ where: { walletId: { in: wallets.map((wallet) => wallet.id) } } });
    await prisma.walletTopUp.deleteMany({ where: { customerId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
}

async function main() {
  const suffix = String(Date.now() % 100000000).padStart(8, "0");
  const password = "E2e@123456";
  const driverPhone = `08${suffix}`;
  const customerPhone = `09${suffix}`;

  console.log("1/11 Checking API and MySQL readiness");
  const ready = await request("/ready");
  assert.equal(ready.database, "ready");
  const vehicleTypes = await request("/api/vehicle-types");
  const vehicleType = vehicleTypes.find((item) => item.code === "CAR4") || vehicleTypes[0];
  assert.ok(vehicleType?.id);

  console.log("2/11 Registering real customer and driver accounts");
  const adminAuth = await request("/api/auth/login", {
    method: "POST",
    body: {
      phone: process.env.DEFAULT_ADMIN_PHONE || "0900000000",
      password: process.env.DEFAULT_ADMIN_PASSWORD || "Admin@123456"
    }
  });
  let driverAuth = await request("/api/auth/register", {
    method: "POST",
    body: { phone: driverPhone, fullName: "E2E Driver", password }
  });
  createdUserIds.push(driverAuth.user.id);
  const customerAuth = await request("/api/auth/register", {
    method: "POST",
    body: { phone: customerPhone, fullName: "E2E Customer", password }
  });
  createdUserIds.push(customerAuth.user.id);

  console.log("3/11 Registering and approving the driver profile");
  const driver = await request("/api/drivers/register", {
    token: driverAuth.tokens.accessToken,
    method: "POST",
    body: {
      licenseNumber: `GPLX${suffix}`,
      identityNumber: `CCCD${suffix}`,
      vehicle: {
        vehicleTypeId: vehicleType.id,
        plateNumber: `E2E-${suffix}`,
        brand: "Test",
        model: "Integration",
        color: "Green"
      }
    }
  });
  await request(`/api/admin/drivers/${driver.id}/approve`, {
    token: adminAuth.tokens.accessToken,
    method: "POST",
    body: {}
  });
  driverAuth = await request("/api/auth/refresh-token", {
    method: "POST",
    body: { refreshToken: driverAuth.tokens.refreshToken }
  });
  assert.ok(driverAuth.user.roles.includes("DRIVER"));
  await request("/api/drivers/me/location", {
    token: driverAuth.tokens.accessToken,
    method: "POST",
    body: { lat: 10.775, lng: 106.701, heading: 90, speed: 0 }
  });
  await request("/api/drivers/me/online", {
    token: driverAuth.tokens.accessToken,
    method: "POST",
    body: {}
  });

  console.log("4/11 Connecting customer and driver through Socket.IO");
  const customerSocket = await connectSocket(customerAuth.tokens.accessToken);
  const driverSocket = await connectSocket(driverAuth.tokens.accessToken);
  const incomingRide = waitForEvent(driverSocket, "ride.request.created");

  console.log("5/11 Estimating and creating a ride in MySQL");
  const trip = {
    pickup: { address: "Ben Thanh Market, District 1", lat: 10.7723, lng: 106.6981 },
    stops: [{ address: "Saigon Central Post Office, District 1", lat: 10.7798, lng: 106.6999, dwellMinutes: 5 }],
    dropoff: { address: "Landmark 81, Binh Thanh", lat: 10.795, lng: 106.7218 },
    vehicleTypeId: vehicleType.id
  };
  const estimate = await request("/api/rides/estimate", {
    token: customerAuth.tokens.accessToken,
    method: "POST",
    body: trip
  });
  assert.ok(estimate.finalFare > 0);
  assert.ok(estimate.routeGeometry.coordinates.length > 2);
  assert.equal(estimate.legs.length, 2);
  const ride = await request("/api/rides", {
    token: customerAuth.tokens.accessToken,
    method: "POST",
    body: { ...trip, paymentMethod: "CASH" }
  });
  createdRideIds.push(ride.id);
  assert.equal(ride.status, "SEARCHING_DRIVER");
  assert.equal(ride.stops.length, 1);
  const incomingPayload = await incomingRide;
  assert.equal(incomingPayload.rideId, ride.id);
  await joinRide(customerSocket, ride.id);

  console.log("6/11 Accepting the ride and streaming driver location");
  const acceptedEvent = waitForEvent(customerSocket, "ride.accepted", (payload) => payload.rideId === ride.id);
  const requests = await request("/api/drivers/me/ride-requests", { token: driverAuth.tokens.accessToken });
  assert.ok(requests.some((item) => item.id === ride.id));
  await request(`/api/drivers/rides/${ride.id}/accept`, {
    token: driverAuth.tokens.accessToken,
    method: "POST",
    body: {}
  });
  await acceptedEvent;
  const locationEvent = waitForEvent(customerSocket, "driver.location.updated", (payload) => payload.rideId === ride.id);
  await request("/api/drivers/me/location", {
    token: driverAuth.tokens.accessToken,
    method: "POST",
    body: { lat: 10.775, lng: 106.701, heading: 90, speed: 18 }
  });
  await locationEvent;

  console.log("7/11 Completing the ride state machine and cash payment");
  for (const action of ["arrived", "start", "complete"]) {
    await request(`/api/drivers/rides/${ride.id}/${action}`, {
      token: driverAuth.tokens.accessToken,
      method: "POST",
      body: {}
    });
  }
  const customerCurrent = await request("/api/rides/current?as=customer", { token: customerAuth.tokens.accessToken });
  assert.equal(customerCurrent, null);
  const customerHistory = await request("/api/rides?as=customer", { token: customerAuth.tokens.accessToken });
  const completed = customerHistory.find((item) => item.id === ride.id);
  assert.equal(completed?.status, "COMPLETED");
  assert.equal(completed?.payment?.status, "PAID");
  await request(`/api/rides/${ride.id}/rating`, {
    token: customerAuth.tokens.accessToken,
    method: "POST",
    body: { score: 5, comment: "Verified live flow" }
  });
  const scheduled = await request("/api/rides", {
    token: customerAuth.tokens.accessToken,
    method: "POST",
    body: { ...trip, stops: [], scheduledAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(), paymentMethod: "CASH" }
  });
  createdRideIds.push(scheduled.id);
  assert.equal(scheduled.status, "SCHEDULED");
  await request(`/api/rides/${scheduled.id}/cancel`, {
    token: customerAuth.tokens.accessToken,
    method: "POST",
    body: { reason: "Live flow scheduled booking cleanup" }
  });

  console.log("8/11 Verifying role-scoped screens and admin reporting");
  const driverCustomerHistory = await request("/api/rides?as=customer", { token: driverAuth.tokens.accessToken });
  const driverRideHistory = await request("/api/rides?as=driver", { token: driverAuth.tokens.accessToken });
  assert.ok(Array.isArray(driverCustomerHistory));
  assert.ok(driverRideHistory.some((item) => item.id === ride.id));
  const payments = await request("/api/admin/payments?page=1&limit=100", { token: adminAuth.tokens.accessToken });
  assert.ok(payments.items.some((item) => item.rideId === ride.id && item.status === "PAID"));
  const dashboard = await request("/api/admin/dashboard", { token: adminAuth.tokens.accessToken });
  assert.ok(dashboard.completedRides >= 1);
  assert.ok(dashboard.revenue >= Number(completed.finalFare));

  console.log("9/11 Verifying VietQR IPN, idempotency and wallet refunds");
  const topUp = await request("/api/customers/me/wallet/top-ups", {
    token: customerAuth.tokens.accessToken,
    method: "POST",
    body: { amount: 1_000_000 }
  });
  assert.ok(topUp.vietQr.qrUrl.includes("img.vietqr.io"));
  const paidAt = new Date().toISOString();
  const transactionId = `E2E-TOPUP-${suffix}`;
  webhookTransactionIds.push(transactionId);
  const signaturePayload = `${transactionId}|${topUp.paymentReference}|1000000|${paidAt}`;
  const signature = createHmac("sha256", process.env.VIETQR_WEBHOOK_SECRET || "dev-vietqr-secret-change-me").update(signaturePayload).digest("hex");
  const ipnBody = { transactionId, reference: topUp.paymentReference, amount: 1_000_000, paidAt, signature };
  const ipn = await request("/api/payments/vietqr/ipn", { method: "POST", body: ipnBody });
  assert.equal(ipn.kind, "TOP_UP");
  const duplicateIpn = await request("/api/payments/vietqr/ipn", { method: "POST", body: ipnBody });
  assert.equal(duplicateIpn.duplicate, true);
  const walletBefore = await request("/api/customers/me/wallet", { token: customerAuth.tokens.accessToken });
  assert.equal(walletBefore.balance, 1_000_000);
  const walletRide = await request("/api/rides", {
    token: customerAuth.tokens.accessToken,
    method: "POST",
    body: { ...trip, stops: [], scheduledAt: new Date(Date.now() + 3 * 60 * 60_000).toISOString(), paymentMethod: "WALLET" }
  });
  createdRideIds.push(walletRide.id);
  assert.equal(walletRide.payment.status, "PAID");
  const walletAfterCharge = await request("/api/customers/me/wallet", { token: customerAuth.tokens.accessToken });
  assert.equal(walletAfterCharge.balance, 1_000_000 - Number(walletRide.payment.amount));
  await request(`/api/rides/${walletRide.id}/cancel`, {
    token: customerAuth.tokens.accessToken,
    method: "POST",
    body: { reason: "Verify automatic wallet refund" }
  });
  const walletAfterRefund = await request("/api/customers/me/wallet", { token: customerAuth.tokens.accessToken });
  assert.equal(walletAfterRefund.balance, 1_000_000);

  console.log("10/11 Verifying withdrawal reserve and admin approval");
  await prisma.driverWallet.update({ where: { driverId: driver.id }, data: { balance: 100_000, pendingBalance: 0 } });
  const withdrawal = await request("/api/drivers/me/withdrawals", {
    token: driverAuth.tokens.accessToken,
    method: "POST",
    body: { amount: 50_000, bankCode: "VCB", accountNumber: "0123456789", accountName: "E2E DRIVER" }
  });
  assert.equal(withdrawal.status, "PENDING");
  let driverWallet = await request("/api/drivers/me/wallet", { token: driverAuth.tokens.accessToken });
  assert.equal(driverWallet.balance, 100_000);
  assert.equal(driverWallet.pendingBalance, 50_000);
  await request(`/api/admin/withdrawals/${withdrawal.id}/approve`, {
    token: adminAuth.tokens.accessToken,
    method: "POST",
    body: {}
  });
  driverWallet = await request("/api/drivers/me/wallet", { token: driverAuth.tokens.accessToken });
  assert.equal(driverWallet.balance, 50_000);
  assert.equal(driverWallet.pendingBalance, 0);

  console.log("11/11 Revoking the customer session and Socket.IO connection");
  const disconnected = waitForEvent(customerSocket, "disconnect", () => true);
  await request("/api/auth/logout", {
    token: customerAuth.tokens.accessToken,
    method: "POST",
    body: {}
  });
  await disconnected;
  await request("/api/auth/logout", {
    token: driverAuth.tokens.accessToken,
    method: "POST",
    body: {}
  });
  await request("/api/auth/logout", {
    token: adminAuth.tokens.accessToken,
    method: "POST",
    body: {}
  });

  console.log("LIVE FLOW VERIFIED: rides, VietQR IPN, wallets, withdrawals, RBAC and Socket.IO all passed.");
}

main()
  .catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
  })
  .finally(cleanup);
