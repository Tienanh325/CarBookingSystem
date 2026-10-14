import "dotenv/config";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/config/prisma";
import { signVietQrWebhook } from "../../src/modules/payments/payment.service";
import type { RoleName } from "../../src/utils/roles";

const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());
const integrationDescribe = databaseConfigured ? describe.sequential : describe.skip;
const app = createApp();
const runId = `it-${randomUUID()}`;
const password = "Integration@123";

type Actor = {
  id: string;
  phone: string;
  role: RoleName;
  token: string;
};

const actors = {} as Record<RoleName, Actor>;
let secondCustomer: Actor;
let vehicleTypeId = "";
let driverProfileId = "";
let stateRideId = "";
let refundRideId = "";
let otherCustomerRideId = "";
let driverOwnedRideId = "";

const tracked = {
  userIds: [] as string[],
  rideIds: [] as string[],
  topUpIds: [] as string[],
  webhookEventIds: [] as string[],
  providerTransactionIds: [] as string[]
};

function auth(actor: Actor) {
  return { Authorization: `Bearer ${actor.token}` };
}

function phoneFor(index: number) {
  const timestamp = Date.now().toString().slice(-8);
  return `08${timestamp}${String(index).padStart(2, "0")}`;
}

async function createUser(role: RoleName, index: number, passwordHash: string, customer = false) {
  const roleRow = await prisma.role.upsert({
    where: { name: role },
    create: { name: role, label: `Integration ${role}` },
    update: {}
  });
  const user = await prisma.user.create({
    data: {
      phone: phoneFor(index),
      fullName: `${runId} ${role} ${index}`,
      passwordHash,
      roles: { create: { roleId: roleRow.id } },
      ...(customer ? { customerProfile: { create: {} } } : {})
    }
  });
  tracked.userIds.push(user.id);
  return { id: user.id, phone: user.phone, role, token: "" } satisfies Actor;
}

async function login(actor: Actor) {
  const response = await request(app).post("/api/auth/login").send({
    phone: actor.phone,
    password
  });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  actor.token = response.body.data.tokens.accessToken as string;
}

async function createRideFixture(input: {
  customerId: string;
  status: "SEARCHING_DRIVER" | "COMPLETED";
  driverId?: string;
  paymentMethod?: "CASH" | "VIETQR";
  finalFare?: number;
}) {
  const ride = await prisma.ride.create({
    data: {
      customerId: input.customerId,
      driverId: input.driverId,
      vehicleTypeId,
      pickupAddress: `${runId} pickup`,
      pickupLat: 10.7769,
      pickupLng: 106.7009,
      dropoffAddress: `${runId} dropoff`,
      dropoffLat: 10.7869,
      dropoffLng: 106.7109,
      estimatedDistanceKm: 5,
      estimatedDurationMin: 10,
      estimatedFare: input.finalFare ?? 15_000,
      finalFare: input.finalFare,
      paymentMethod: input.paymentMethod ?? "CASH",
      status: input.status,
      commissionRate: 0.2,
      pricingSnapshot: {
        baseFare: 10_000,
        perKmFare: 1_000,
        perMinuteFare: 0,
        minimumFare: 10_000,
        peakMultiplier: 1,
        waitingFeePerMinute: 0,
        waitingGraceMinutes: 5
      },
      ...(input.status === "COMPLETED"
        ? {
            acceptedAt: new Date(Date.now() - 20 * 60_000),
            arrivedAt: new Date(Date.now() - 15 * 60_000),
            startedAt: new Date(Date.now() - 10 * 60_000),
            completedAt: new Date(Date.now() - 5 * 60_000)
          }
        : { matchingStartedAt: new Date() })
    }
  });
  tracked.rideIds.push(ride.id);
  return ride;
}

async function cleanupFixtures() {
  if (!tracked.userIds.length && !vehicleTypeId) return;

  const [customerWallets, driverWallets] = await Promise.all([
    prisma.customerWallet.findMany({ where: { userId: { in: tracked.userIds } }, select: { id: true } }),
    driverProfileId
      ? prisma.driverWallet.findMany({ where: { driverId: driverProfileId }, select: { id: true } })
      : Promise.resolve([])
  ]);
  const customerWalletIds = customerWallets.map((wallet) => wallet.id);
  const driverWalletIds = driverWallets.map((wallet) => wallet.id);
  const auditEntityIds = [
    ...tracked.rideIds,
    ...tracked.topUpIds,
    ...tracked.webhookEventIds,
    ...customerWalletIds,
    ...driverWalletIds
  ];

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: tracked.userIds } },
          ...(auditEntityIds.length ? [{ entityId: { in: auditEntityIds } }] : [])
        ]
      }
    });
    await tx.paymentWebhookEvent.deleteMany({
      where: {
        OR: [
          { providerTransactionId: { in: tracked.providerTransactionIds } },
          ...(tracked.webhookEventIds.length ? [{ id: { in: tracked.webhookEventIds } }] : [])
        ]
      }
    });
    await tx.refundRequest.deleteMany({ where: { rideId: { in: tracked.rideIds } } });
    await tx.withdrawalRequest.deleteMany({ where: { driverId: driverProfileId || "missing" } });
    await tx.customerWalletTransaction.deleteMany({
      where: {
        OR: [
          { walletId: { in: customerWalletIds } },
          { rideId: { in: tracked.rideIds } },
          { topUpId: { in: tracked.topUpIds } }
        ]
      }
    });
    await tx.walletTransaction.deleteMany({
      where: { OR: [{ walletId: { in: driverWalletIds } }, { rideId: { in: tracked.rideIds } }] }
    });
    await tx.walletTopUp.deleteMany({ where: { id: { in: tracked.topUpIds } } });
    await tx.payment.deleteMany({ where: { rideId: { in: tracked.rideIds } } });
    await tx.invoice.deleteMany({ where: { rideId: { in: tracked.rideIds } } });
    await tx.driverOffer.deleteMany({ where: { rideId: { in: tracked.rideIds } } });
    await tx.rideRejection.deleteMany({ where: { rideId: { in: tracked.rideIds } } });
    await tx.rideLocationPoint.deleteMany({ where: { rideId: { in: tracked.rideIds } } });
    await tx.rideStatusLog.deleteMany({ where: { rideId: { in: tracked.rideIds } } });
    await tx.ride.deleteMany({ where: { id: { in: tracked.rideIds } } });
    await tx.customerWallet.deleteMany({ where: { id: { in: customerWalletIds } } });
    await tx.driverWallet.deleteMany({ where: { id: { in: driverWalletIds } } });
    if (driverProfileId) await tx.driverProfile.deleteMany({ where: { id: driverProfileId } });
    await tx.authSession.deleteMany({ where: { userId: { in: tracked.userIds } } });
    await tx.user.deleteMany({ where: { id: { in: tracked.userIds } } });
    if (vehicleTypeId) {
      await tx.pricingRule.deleteMany({ where: { vehicleTypeId } });
      await tx.surchargeRule.deleteMany({ where: { vehicleTypeId } });
      await tx.vehicleType.deleteMany({ where: { id: vehicleTypeId } });
    }
  });
}

integrationDescribe("critical API and financial flows", () => {
  beforeAll(async () => {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      await prisma.role.count();
    } catch (cause) {
      throw new Error(
        "Integration DATABASE_URL is configured, but MySQL is unreachable or the Prisma migrations are missing. Start the test database and run `npm run prisma:deploy`.",
        { cause }
      );
    }

    const passwordHash = await bcrypt.hash(password, 4);
    const vehicleType = await prisma.vehicleType.create({
      data: {
        code: `IT${randomUUID().replaceAll("-", "").slice(0, 18).toUpperCase()}`,
        name: `${runId} vehicle`,
        capacity: 4,
        baseFare: 10_000,
        perKmFare: 1_000,
        perMinuteFare: 0
      }
    });
    vehicleTypeId = vehicleType.id;

    actors.CUSTOMER = await createUser("CUSTOMER", 1, passwordHash, true);
    secondCustomer = await createUser("CUSTOMER", 2, passwordHash, true);
    actors.ADMIN = await createUser("ADMIN", 3, passwordHash);
    actors.OPERATOR = await createUser("OPERATOR", 4, passwordHash);
    actors.SUPPORT = await createUser("SUPPORT", 5, passwordHash);
    actors.ACCOUNTANT = await createUser("ACCOUNTANT", 6, passwordHash);

    const driverRole = await prisma.role.upsert({
      where: { name: "DRIVER" },
      create: { name: "DRIVER", label: "Integration DRIVER" },
      update: {}
    });
    const driverUser = await prisma.user.create({
      data: {
        phone: phoneFor(7),
        fullName: `${runId} DRIVER`,
        passwordHash,
        roles: { create: { roleId: driverRole.id } },
        driverProfile: {
          create: {
            licenseNumber: `${runId}-license`,
            identityNumber: `${runId}-identity`,
            verificationStatus: "APPROVED",
            onlineStatus: "ONLINE",
            approvedAt: new Date(),
            vehicles: {
              create: {
                vehicleTypeId,
                plateNumber: `IT${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`,
                registrationStatus: "APPROVED",
                isActive: true
              }
            },
            location: { create: { lat: 10.7769, lng: 106.7009 } },
            wallet: {
              create: {
                availableBalance: 300_000,
                transactions: {
                  create: {
                    amount: 300_000,
                    availableDelta: 300_000,
                    type: "ADJUSTMENT",
                    description: `${runId} opening integration balance`
                  }
                }
              }
            }
          }
        }
      },
      include: { driverProfile: true }
    });
    tracked.userIds.push(driverUser.id);
    driverProfileId = driverUser.driverProfile!.id;
    actors.DRIVER = {
      id: driverUser.id,
      phone: driverUser.phone,
      role: "DRIVER",
      token: ""
    };

    const stateRide = await createRideFixture({
      customerId: actors.CUSTOMER.id,
      status: "SEARCHING_DRIVER"
    });
    stateRideId = stateRide.id;
    await prisma.driverOffer.create({
      data: {
        rideId: stateRideId,
        driverId: driverProfileId,
        radiusKm: 2,
        pickupDistanceKm: 0.5,
        expiresAt: new Date(Date.now() + 10 * 60_000)
      }
    });

    const refundRide = await createRideFixture({
      customerId: actors.CUSTOMER.id,
      status: "COMPLETED",
      paymentMethod: "VIETQR",
      finalFare: 120_000
    });
    refundRideId = refundRide.id;
    await prisma.payment.create({
      data: {
        rideId: refundRideId,
        customerId: actors.CUSTOMER.id,
        amount: 120_000,
        capturedAmount: 120_000,
        method: "VIETQR",
        provider: "INTEGRATION_FIXTURE",
        providerTransactionId: `${runId}-refund-payment`,
        status: "PAID",
        paidAt: new Date()
      }
    });

    const otherRide = await createRideFixture({
      customerId: secondCustomer.id,
      status: "COMPLETED",
      paymentMethod: "VIETQR",
      finalFare: 90_000
    });
    otherCustomerRideId = otherRide.id;
    await prisma.payment.create({
      data: {
        rideId: otherCustomerRideId,
        customerId: secondCustomer.id,
        amount: 90_000,
        capturedAmount: 90_000,
        method: "VIETQR",
        provider: "INTEGRATION_FIXTURE",
        providerTransactionId: `${runId}-other-payment`,
        status: "PAID",
        paidAt: new Date()
      }
    });

    const driverRide = await createRideFixture({
      customerId: secondCustomer.id,
      driverId: driverProfileId,
      status: "COMPLETED",
      finalFare: 80_000
    });
    driverOwnedRideId = driverRide.id;

    await Promise.all([
      login(actors.CUSTOMER),
      login(secondCustomer),
      login(actors.ADMIN),
      login(actors.OPERATOR),
      login(actors.SUPPORT),
      login(actors.ACCOUNTANT),
      login(actors.DRIVER)
    ]);
  });

  afterAll(async () => {
    if (databaseConfigured) {
      try {
        await cleanupFixtures();
      } finally {
        await prisma.$disconnect();
      }
    }
  });

  it("enforces the ADMIN, OPERATOR, SUPPORT, ACCOUNTANT, CUSTOMER and DRIVER boundaries", async () => {
    expect((await request(app).get("/api/admin/users").set(auth(actors.ADMIN))).status).toBe(200);
    expect((await request(app).get("/api/admin/payments").set(auth(actors.ADMIN))).status).toBe(200);
    expect(
      (await request(app).get(`/api/payments/rides/${refundRideId}`).set(auth(actors.ADMIN))).status
    ).toBe(200);

    expect((await request(app).get("/api/admin/dashboard").set(auth(actors.OPERATOR))).status).toBe(200);
    expect((await request(app).get("/api/admin/rides").set(auth(actors.OPERATOR))).status).toBe(200);
    expect((await request(app).get("/api/admin/users").set(auth(actors.OPERATOR))).status).toBe(403);
    expect((await request(app).get("/api/admin/refunds").set(auth(actors.OPERATOR))).status).toBe(403);

    expect((await request(app).get("/api/admin/users").set(auth(actors.SUPPORT))).status).toBe(200);
    expect((await request(app).get("/api/admin/rides").set(auth(actors.SUPPORT))).status).toBe(200);
    expect((await request(app).get("/api/admin/dashboard").set(auth(actors.SUPPORT))).status).toBe(403);
    expect((await request(app).get("/api/admin/payments").set(auth(actors.SUPPORT))).status).toBe(403);

    expect((await request(app).get("/api/admin/dashboard").set(auth(actors.ACCOUNTANT))).status).toBe(200);
    expect((await request(app).get("/api/admin/rides").set(auth(actors.ACCOUNTANT))).status).toBe(200);
    expect((await request(app).get("/api/admin/payments").set(auth(actors.ACCOUNTANT))).status).toBe(200);
    expect((await request(app).get("/api/admin/refunds").set(auth(actors.ACCOUNTANT))).status).toBe(200);
    expect((await request(app).get("/api/admin/users").set(auth(actors.ACCOUNTANT))).status).toBe(403);
    expect(
      (
        await request(app)
          .post(`/api/admin/rides/${stateRideId}/cancel`)
          .set(auth(actors.ACCOUNTANT))
          .send({ reason: "Accountant must not cancel rides" })
      ).status
    ).toBe(403);

    expect((await request(app).get(`/api/rides/${refundRideId}`).set(auth(actors.CUSTOMER))).status).toBe(
      200
    );
    expect(
      (await request(app).get(`/api/rides/${otherCustomerRideId}`).set(auth(actors.CUSTOMER))).status
    ).toBe(403);
    expect(
      (await request(app).get(`/api/payments/rides/${refundRideId}`).set(auth(actors.CUSTOMER))).status
    ).toBe(200);
    expect(
      (await request(app).get(`/api/payments/rides/${refundRideId}`).set(auth(secondCustomer))).status
    ).toBe(404);
    expect((await request(app).get("/api/admin/rides").set(auth(actors.CUSTOMER))).status).toBe(403);

    expect((await request(app).get(`/api/rides/${driverOwnedRideId}`).set(auth(actors.DRIVER))).status).toBe(
      200
    );
    expect((await request(app).get(`/api/rides/${refundRideId}`).set(auth(actors.DRIVER))).status).toBe(403);
    expect((await request(app).get("/api/drivers/me/wallet").set(auth(actors.DRIVER))).status).toBe(200);
    expect((await request(app).get("/api/customers/me/wallet").set(auth(actors.DRIVER))).status).toBe(403);
    expect((await request(app).get("/api/admin/rides").set(auth(actors.DRIVER))).status).toBe(403);
  });

  it("credits a customer top-up once when the same provider webhook is delivered twice", async () => {
    const before = await request(app).get("/api/customers/me/wallet").set(auth(actors.CUSTOMER));
    expect(before.status).toBe(200);
    const initialAvailable = Number(before.body.data.availableBalance);

    const topUp = await request(app)
      .post("/api/customers/me/wallet/top-ups")
      .set(auth(actors.CUSTOMER))
      .send({ amount: 200_000 });
    expect(topUp.status, JSON.stringify(topUp.body)).toBe(201);
    tracked.topUpIds.push(topUp.body.data.id as string);

    const transaction = {
      transactionId: `${runId}-topup`,
      reference: topUp.body.data.paymentReference as string,
      amount: 200_000,
      paidAt: new Date().toISOString()
    };
    tracked.providerTransactionIds.push(transaction.transactionId);
    const payload = { ...transaction, signature: signVietQrWebhook(transaction) };

    const firstWebhook = await request(app).post("/api/payments/vietqr/ipn").send(payload);
    expect(firstWebhook.status, JSON.stringify(firstWebhook.body)).toBe(200);
    expect(firstWebhook.body.data).toMatchObject({ classification: "EXACT", kind: "TOP_UP" });
    tracked.webhookEventIds.push(firstWebhook.body.data.eventId as string);

    const duplicateWebhook = await request(app).post("/api/payments/vietqr/ipn").send(payload);
    expect(duplicateWebhook.status, JSON.stringify(duplicateWebhook.body)).toBe(200);
    expect(duplicateWebhook.body.data).toMatchObject({ duplicate: true, classification: "DUPLICATE" });

    const after = await request(app).get("/api/customers/me/wallet").set(auth(actors.CUSTOMER));
    expect(Number(after.body.data.availableBalance)).toBe(initialAvailable + 200_000);
    expect(
      after.body.data.transactions.filter(
        (entry: { type: string; topUpId: string | null }) =>
          entry.type === "TOP_UP" && entry.topUpId === topUp.body.data.id
      )
    ).toHaveLength(1);
  });

  it("runs the ride state machine through completion and records driver wallet settlement", async () => {
    const accepted = await request(app)
      .post(`/api/drivers/rides/${stateRideId}/accept`)
      .set(auth(actors.DRIVER));
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
    expect(accepted.body.data.status).toBe("ACCEPTED");

    const customerView = await request(app).get(`/api/rides/${stateRideId}`).set(auth(actors.CUSTOMER));
    expect(customerView.status).toBe(200);
    const startPin = customerView.body.data.startPin as string;
    expect(startPin).toMatch(/^\d{4}$/);

    const tooEarly = await request(app)
      .post(`/api/drivers/rides/${stateRideId}/start`)
      .set(auth(actors.DRIVER))
      .send({ pin: startPin });
    expect(tooEarly.status).toBe(409);
    expect(tooEarly.body.error.code).toBe("RIDE_INVALID_STATUS");

    expect(
      (await request(app).post(`/api/drivers/rides/${stateRideId}/heading`).set(auth(actors.DRIVER))).body
        .data.status
    ).toBe("DRIVER_ARRIVING");
    expect(
      (await request(app).post(`/api/drivers/rides/${stateRideId}/heading`).set(auth(actors.DRIVER))).status
    ).toBe(409);
    expect(
      (await request(app).post(`/api/drivers/rides/${stateRideId}/arrived`).set(auth(actors.DRIVER))).body
        .data.status
    ).toBe("ARRIVED");

    const wrongPin = await request(app)
      .post(`/api/drivers/rides/${stateRideId}/start`)
      .set(auth(actors.DRIVER))
      .send({ pin: startPin === "0000" ? "0001" : "0000" });
    expect(wrongPin.status).toBe(422);
    expect(wrongPin.body.error.code).toBe("RIDE_START_PIN_INVALID");

    const started = await request(app)
      .post(`/api/drivers/rides/${stateRideId}/start`)
      .set(auth(actors.DRIVER))
      .send({ pin: startPin });
    expect(started.status, JSON.stringify(started.body)).toBe(200);
    expect(started.body.data.status).toBe("IN_PROGRESS");

    const completed = await request(app)
      .post(`/api/drivers/rides/${stateRideId}/complete`)
      .set(auth(actors.DRIVER));
    expect(completed.status, JSON.stringify(completed.body)).toBe(200);
    expect(completed.body.data.status).toBe("COMPLETED");
    expect(
      (await request(app).post(`/api/drivers/rides/${stateRideId}/complete`).set(auth(actors.DRIVER))).status
    ).toBe(409);

    const fare = Number(completed.body.data.finalFare);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { rideId: stateRideId } });
    expect(payment.status).toBe("PAID");
    expect(Number(payment.capturedAmount)).toBe(fare);

    const wallet = await prisma.driverWallet.findUniqueOrThrow({ where: { driverId: driverProfileId } });
    const commission = Math.round(fare * 0.2);
    expect(Number(wallet.platformReceivable)).toBe(commission);
    const rideLedger = await prisma.walletTransaction.findMany({ where: { rideId: stateRideId } });
    expect(rideLedger.map((entry) => entry.type)).toEqual(
      expect.arrayContaining(["RIDE_EARNING", "COMMISSION", "CASH_COLLECTION"])
    );
    expect(
      await prisma.rideStatusLog.findMany({ where: { rideId: stateRideId }, select: { toStatus: true } })
    ).toEqual(
      expect.arrayContaining([
        { toStatus: "ACCEPTED" },
        { toStatus: "DRIVER_ARRIVING" },
        { toStatus: "ARRIVED" },
        { toStatus: "IN_PROGRESS" },
        { toStatus: "COMPLETED" }
      ])
    );
  });

  it("approves and rejects refunds without double-crediting customer wallet buckets", async () => {
    const walletBefore = await prisma.customerWallet.findUnique({ where: { userId: actors.CUSTOMER.id } });
    const availableBefore = Number(walletBefore?.availableBalance ?? 0);

    const requested = await request(app)
      .post(`/api/payments/rides/${refundRideId}/refunds`)
      .set(auth(actors.CUSTOMER))
      .send({ amount: 20_000, reason: "Integration approved refund" });
    expect(requested.status, JSON.stringify(requested.body)).toBe(201);
    const approvedRefundId = requested.body.data.id as string;
    expect(
      Number(
        (await prisma.customerWallet.findUniqueOrThrow({ where: { userId: actors.CUSTOMER.id } }))
          .pendingSettlement
      )
    ).toBe(20_000);

    expect(
      (await request(app).post(`/api/admin/refunds/${approvedRefundId}/approve`).set(auth(actors.OPERATOR)))
        .status
    ).toBe(403);
    const approved = await request(app)
      .post(`/api/admin/refunds/${approvedRefundId}/approve`)
      .set(auth(actors.ACCOUNTANT));
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);

    const afterApproval = await prisma.customerWallet.findUniqueOrThrow({
      where: { userId: actors.CUSTOMER.id }
    });
    expect(Number(afterApproval.availableBalance)).toBe(availableBefore + 20_000);
    expect(Number(afterApproval.pendingSettlement)).toBe(0);
    const paymentAfterApproval = await prisma.payment.findUniqueOrThrow({ where: { rideId: refundRideId } });
    expect(Number(paymentAfterApproval.refundedAmount)).toBe(20_000);

    const duplicateApproval = await request(app)
      .post(`/api/admin/refunds/${approvedRefundId}/approve`)
      .set(auth(actors.ACCOUNTANT));
    expect(duplicateApproval.status).toBe(409);
    expect(duplicateApproval.body.error.code).toBe("REFUND_ALREADY_REVIEWED");

    const toReject = await request(app)
      .post(`/api/payments/rides/${refundRideId}/refunds`)
      .set(auth(actors.CUSTOMER))
      .send({ amount: 10_000, reason: "Integration rejected refund" });
    expect(toReject.status, JSON.stringify(toReject.body)).toBe(201);
    const rejectedRefundId = toReject.body.data.id as string;
    const rejected = await request(app)
      .post(`/api/admin/refunds/${rejectedRefundId}/reject`)
      .set(auth(actors.ADMIN))
      .send({ reason: "Integration rejection reason" });
    expect(rejected.status, JSON.stringify(rejected.body)).toBe(200);
    expect(rejected.body.data.status).toBe("REJECTED");
    expect(
      (
        await request(app)
          .post(`/api/admin/refunds/${rejectedRefundId}/reject`)
          .set(auth(actors.ADMIN))
          .send({ reason: "Must remain rejected" })
      ).status
    ).toBe(409);

    const wallet = await prisma.customerWallet.findUniqueOrThrow({ where: { userId: actors.CUSTOMER.id } });
    const ledger = await prisma.customerWalletTransaction.aggregate({
      where: { walletId: wallet.id },
      _sum: {
        availableDelta: true,
        heldDelta: true,
        pendingSettlementDelta: true,
        platformReceivableDelta: true
      }
    });
    expect(Number(wallet.availableBalance)).toBe(Number(ledger._sum.availableDelta ?? 0));
    expect(Number(wallet.heldBalance)).toBe(Number(ledger._sum.heldDelta ?? 0));
    expect(Number(wallet.pendingSettlement)).toBe(Number(ledger._sum.pendingSettlementDelta ?? 0));
    expect(Number(wallet.platformReceivable)).toBe(Number(ledger._sum.platformReceivableDelta ?? 0));
    expect(Number(wallet.pendingSettlement)).toBe(0);
    expect(Number(wallet.availableBalance)).toBe(availableBefore + 20_000);
    expect(
      Number((await prisma.payment.findUniqueOrThrow({ where: { rideId: refundRideId } })).refundedAmount)
    ).toBe(20_000);
  });

  it("approves and rejects withdrawals once and preserves driver wallet ledger invariants", async () => {
    const first = await request(app).post("/api/drivers/me/withdrawals").set(auth(actors.DRIVER)).send({
      amount: 100_000,
      bankCode: "VCB",
      accountNumber: "123456789",
      accountName: "Integration Driver"
    });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    const firstId = first.body.data.id as string;

    let wallet = await prisma.driverWallet.findUniqueOrThrow({ where: { driverId: driverProfileId } });
    expect(Number(wallet.availableBalance)).toBe(200_000);
    expect(Number(wallet.heldBalance)).toBe(100_000);
    expect(
      (await request(app).post(`/api/admin/withdrawals/${firstId}/approve`).set(auth(actors.SUPPORT))).status
    ).toBe(403);

    const approved = await request(app)
      .post(`/api/admin/withdrawals/${firstId}/approve`)
      .set(auth(actors.ACCOUNTANT));
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    expect(approved.body.data.status).toBe("APPROVED");
    const duplicateApproval = await request(app)
      .post(`/api/admin/withdrawals/${firstId}/approve`)
      .set(auth(actors.ACCOUNTANT));
    expect(duplicateApproval.status).toBe(409);
    expect(duplicateApproval.body.error.code).toBe("WITHDRAWAL_ALREADY_REVIEWED");

    const second = await request(app).post("/api/drivers/me/withdrawals").set(auth(actors.DRIVER)).send({
      amount: 50_000,
      bankCode: "ACB",
      accountNumber: "987654321",
      accountName: "Integration Driver"
    });
    expect(second.status, JSON.stringify(second.body)).toBe(201);
    const secondId = second.body.data.id as string;
    const rejected = await request(app)
      .post(`/api/admin/withdrawals/${secondId}/reject`)
      .set(auth(actors.ADMIN))
      .send({ reason: "Integration withdrawal rejection" });
    expect(rejected.status, JSON.stringify(rejected.body)).toBe(200);
    expect(rejected.body.data.status).toBe("REJECTED");
    expect(
      (
        await request(app)
          .post(`/api/admin/withdrawals/${secondId}/reject`)
          .set(auth(actors.ADMIN))
          .send({ reason: "Must remain rejected" })
      ).status
    ).toBe(409);

    wallet = await prisma.driverWallet.findUniqueOrThrow({ where: { driverId: driverProfileId } });
    const ledger = await prisma.walletTransaction.aggregate({
      where: { walletId: wallet.id },
      _sum: {
        availableDelta: true,
        heldDelta: true,
        pendingSettlementDelta: true,
        platformReceivableDelta: true
      }
    });
    expect(Number(wallet.availableBalance)).toBe(200_000);
    expect(Number(wallet.heldBalance)).toBe(0);
    expect(Number(wallet.availableBalance)).toBe(Number(ledger._sum.availableDelta ?? 0));
    expect(Number(wallet.heldBalance)).toBe(Number(ledger._sum.heldDelta ?? 0));
    expect(Number(wallet.pendingSettlement)).toBe(Number(ledger._sum.pendingSettlementDelta ?? 0));
    expect(Number(wallet.platformReceivable)).toBe(Number(ledger._sum.platformReceivableDelta ?? 0));
    expect(await prisma.walletTransaction.count({ where: { walletId: wallet.id, type: "WITHDRAWAL" } })).toBe(
      1
    );
  });
});
