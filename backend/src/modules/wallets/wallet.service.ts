import {
  Prisma,
  type Payment,
  type PaymentMethod,
  type PaymentStatus,
  type RefundStatus
} from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";
import { createPaymentReference, createVietQrDetails } from "../payments/payment.service";
import { writeFinancialAudit } from "./finance-audit";

type Db = Prisma.TransactionClient;

function capturedAmount(payment: Payment) {
  const captured = Number(payment.capturedAmount);
  return captured > 0 ? captured : payment.status === "PAID" ? Number(payment.amount) : 0;
}

function paymentStatusAfterRefund(
  payment: Payment,
  refundedAmount: number,
  hasPending: boolean
): PaymentStatus {
  if (refundedAmount >= capturedAmount(payment)) return "REFUNDED";
  if (hasPending) return "REFUND_PENDING";
  return capturedAmount(payment) < Number(payment.amount) ? "PARTIALLY_PAID" : "PAID";
}

async function customerLedger(
  tx: Db,
  input: {
    walletId: string;
    rideId?: string;
    topUpId?: string;
    amount: number;
    availableDelta?: number;
    heldDelta?: number;
    pendingSettlementDelta?: number;
    platformReceivableDelta?: number;
    type:
      | "TOP_UP"
      | "HOLD"
      | "CAPTURE"
      | "RELEASE"
      | "RIDE_PAYMENT"
      | "SETTLEMENT"
      | "RECEIVABLE"
      | "REFUND"
      | "ADJUSTMENT";
    description: string;
  }
) {
  return tx.customerWalletTransaction.create({
    data: {
      walletId: input.walletId,
      rideId: input.rideId,
      topUpId: input.topUpId,
      amount: input.amount,
      availableDelta: input.availableDelta ?? 0,
      heldDelta: input.heldDelta ?? 0,
      pendingSettlementDelta: input.pendingSettlementDelta ?? 0,
      platformReceivableDelta: input.platformReceivableDelta ?? 0,
      type: input.type,
      description: input.description
    }
  });
}

async function driverLedger(
  tx: Db,
  input: {
    walletId: string;
    rideId?: string;
    amount: number;
    availableDelta?: number;
    heldDelta?: number;
    pendingSettlementDelta?: number;
    platformReceivableDelta?: number;
    type:
      | "RIDE_EARNING"
      | "COMMISSION"
      | "CASH_COLLECTION"
      | "HOLD"
      | "CAPTURE"
      | "RELEASE"
      | "SETTLEMENT"
      | "RECEIVABLE"
      | "WITHDRAWAL"
      | "REFUND"
      | "ADJUSTMENT";
    description: string;
  }
) {
  return tx.walletTransaction.create({
    data: {
      walletId: input.walletId,
      rideId: input.rideId,
      amount: input.amount,
      availableDelta: input.availableDelta ?? 0,
      heldDelta: input.heldDelta ?? 0,
      pendingSettlementDelta: input.pendingSettlementDelta ?? 0,
      platformReceivableDelta: input.platformReceivableDelta ?? 0,
      type: input.type,
      description: input.description
    }
  });
}

export async function getCustomerWallet(userId: string) {
  const wallet = await prisma.customerWallet.upsert({
    where: { userId },
    create: { userId },
    update: {}
  });
  const [transactions, pendingTopUps] = await Promise.all([
    prisma.customerWalletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.walletTopUp.findMany({
      where: { customerId: userId, status: "PENDING", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" }
    })
  ]);
  const availableBalance = Number(wallet.availableBalance);
  return {
    ...wallet,
    balance: availableBalance,
    availableBalance,
    heldBalance: Number(wallet.heldBalance),
    pendingSettlement: Number(wallet.pendingSettlement),
    platformReceivable: Number(wallet.platformReceivable),
    transactions,
    pendingTopUps
  };
}

export async function createTopUp(userId: string, amount: number) {
  const reference = createPaymentReference("TOPUP");
  const expiresAt = new Date(Date.now() + env.vietQrPaymentTtlMinutes * 60_000);
  const topUp = await prisma.$transaction(async (tx) => {
    const created = await tx.walletTopUp.create({
      data: { customerId: userId, amount, paymentReference: reference, expiresAt }
    });
    await writeFinancialAudit(tx, {
      actorId: userId,
      action: "WALLET_TOP_UP_CREATED",
      entityType: "WALLET_TOP_UP",
      entityId: created.id,
      metadata: { amount, reference, expiresAt: expiresAt.toISOString() }
    });
    return created;
  });
  return { ...topUp, vietQr: createVietQrDetails(reference, amount, expiresAt) };
}

export async function holdCustomerWallet(tx: Db, input: { userId: string; rideId: string; amount: number }) {
  const wallet = await tx.customerWallet.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId },
    update: {}
  });
  const held = await tx.customerWallet.updateMany({
    where: { id: wallet.id, availableBalance: { gte: input.amount } },
    data: {
      availableBalance: { decrement: input.amount },
      heldBalance: { increment: input.amount }
    }
  });
  if (!held.count) {
    throw new ApiError(422, "WALLET_INSUFFICIENT_BALANCE", "So du vi khong du de giu tien chuyen");
  }
  await customerLedger(tx, {
    walletId: wallet.id,
    rideId: input.rideId,
    amount: 0,
    availableDelta: -input.amount,
    heldDelta: input.amount,
    type: "HOLD",
    description: `Hold fare for ride ${input.rideId}`
  });
  await writeFinancialAudit(tx, {
    actorId: input.userId,
    action: "WALLET_FUNDS_HELD",
    entityType: "RIDE",
    entityId: input.rideId,
    metadata: { amount: input.amount, walletId: wallet.id }
  });
}

async function createRefundRequestTx(
  tx: Db,
  input: { payment: Payment; amount: number; reason: string; requestedById: string }
) {
  if (input.amount <= 0) throw new ApiError(422, "REFUND_AMOUNT_INVALID", "So tien hoan phai lon hon 0");
  const reserved = await tx.refundRequest.aggregate({
    where: { paymentId: input.payment.id, status: { in: ["PENDING", "APPROVED"] } },
    _sum: { amount: true }
  });
  const refundable = capturedAmount(input.payment) - Number(reserved._sum.amount ?? 0);
  if (input.amount > refundable) {
    throw new ApiError(422, "REFUND_AMOUNT_EXCEEDED", "So tien hoan vuot qua so tien da thu", {
      refundable,
      requested: input.amount
    });
  }
  const request = await tx.refundRequest.create({
    data: {
      paymentId: input.payment.id,
      rideId: input.payment.rideId,
      customerId: input.payment.customerId,
      amount: input.amount,
      reason: input.reason,
      requestedById: input.requestedById
    }
  });
  const wallet = await tx.customerWallet.upsert({
    where: { userId: input.payment.customerId },
    create: { userId: input.payment.customerId, pendingSettlement: input.amount },
    update: { pendingSettlement: { increment: input.amount } }
  });
  await customerLedger(tx, {
    walletId: wallet.id,
    rideId: input.payment.rideId,
    amount: input.amount,
    pendingSettlementDelta: input.amount,
    type: "SETTLEMENT",
    description: `Pending refund request ${request.id}`
  });
  await tx.payment.update({ where: { id: input.payment.id }, data: { status: "REFUND_PENDING" } });
  await writeFinancialAudit(tx, {
    actorId: input.requestedById,
    action: "REFUND_REQUESTED",
    entityType: "REFUND_REQUEST",
    entityId: request.id,
    metadata: { paymentId: input.payment.id, rideId: input.payment.rideId, amount: input.amount }
  });
  return request;
}

export async function requestRideRefund(
  userId: string,
  rideId: string,
  input: { amount: number; reason: string }
) {
  return prisma.$transaction(
    async (tx) => {
      const payment = await tx.payment.findFirst({ where: { rideId, customerId: userId } });
      if (!payment) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Khong tim thay giao dich");
      if (!["PAID", "PARTIALLY_PAID", "REFUND_PENDING"].includes(payment.status)) {
        throw new ApiError(409, "PAYMENT_NOT_REFUNDABLE", "Giao dich chua the hoan tien");
      }
      return createRefundRequestTx(tx, { payment, ...input, requestedById: userId });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function refundCustomerWalletRide(tx: Db, rideId: string, actorId?: string) {
  return settleCancelledRidePayment(tx, rideId, 0, actorId);
}

export async function settleCancelledRidePayment(
  tx: Db,
  rideId: string,
  cancellationFee: number,
  actorId?: string
) {
  const ride = await tx.ride.findUniqueOrThrow({ where: { id: rideId } });
  const payment = await tx.payment.findUnique({ where: { rideId } });
  if (!payment) {
    if (cancellationFee > 0) {
      const created = await tx.payment.create({
        data: {
          rideId,
          customerId: ride.customerId,
          amount: cancellationFee,
          method: ride.paymentMethod,
          status: "PENDING"
        }
      });
      await writeFinancialAudit(tx, {
        actorId: actorId ?? ride.customerId,
        action: "CANCELLATION_FEE_CREATED",
        entityType: "PAYMENT",
        entityId: created.id,
        metadata: { rideId, amount: cancellationFee }
      });
    }
    return { collected: false, refundRequestId: null, releasedAmount: 0 };
  }

  if (payment.method === "WALLET" && payment.status === "AUTHORIZED") {
    const authorized = Number(payment.authorizedAmount || payment.amount);
    const captured = Math.min(cancellationFee, authorized);
    const released = authorized - captured;
    const wallet = await tx.customerWallet.findUniqueOrThrow({ where: { userId: payment.customerId } });
    await tx.customerWallet.update({
      where: { id: wallet.id },
      data: {
        heldBalance: { decrement: authorized },
        availableBalance: { increment: released }
      }
    });
    if (captured > 0) {
      await customerLedger(tx, {
        walletId: wallet.id,
        rideId,
        amount: -captured,
        heldDelta: -captured,
        type: "CAPTURE",
        description: `Capture cancellation fee for ride ${rideId}`
      });
    }
    if (released > 0) {
      await customerLedger(tx, {
        walletId: wallet.id,
        rideId,
        amount: 0,
        availableDelta: released,
        heldDelta: -released,
        type: "RELEASE",
        description: `Release unused hold for cancelled ride ${rideId}`
      });
    }
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        amount: cancellationFee,
        capturedAmount: captured,
        status: captured > 0 ? "PAID" : "VOIDED",
        paidAt: captured > 0 ? new Date() : null
      }
    });
    await writeFinancialAudit(tx, {
      actorId: actorId ?? ride.customerId,
      action: "WALLET_HOLD_SETTLED_ON_CANCELLATION",
      entityType: "PAYMENT",
      entityId: payment.id,
      metadata: { rideId, captured, released }
    });
    return { collected: captured > 0, refundRequestId: null, releasedAmount: released };
  }

  if (payment.status === "PENDING") {
    await tx.payment.update({
      where: { id: payment.id },
      data: cancellationFee > 0 ? { amount: cancellationFee } : { status: "VOIDED" }
    });
    await writeFinancialAudit(tx, {
      actorId: actorId ?? ride.customerId,
      action: cancellationFee > 0 ? "CANCELLATION_PAYMENT_ADJUSTED" : "PAYMENT_VOIDED",
      entityType: "PAYMENT",
      entityId: payment.id,
      metadata: { rideId, cancellationFee }
    });
    return { collected: false, refundRequestId: null, releasedAmount: 0 };
  }

  const refundable = Math.max(0, capturedAmount(payment) - cancellationFee);
  const refund =
    refundable > 0
      ? await createRefundRequestTx(tx, {
          payment,
          amount: refundable,
          reason: `Refund after ride cancellation ${rideId}`,
          requestedById: actorId ?? ride.customerId
        })
      : null;
  return {
    collected: cancellationFee > 0 && capturedAmount(payment) >= cancellationFee,
    refundRequestId: refund?.id ?? null,
    releasedAmount: 0
  };
}

export async function reconcileCompletedRidePayment(
  tx: Db,
  input: {
    rideId: string;
    customerId: string;
    method: PaymentMethod;
    finalAmount: number;
    actorId?: string;
  }
) {
  const payment = await tx.payment.findUnique({ where: { rideId: input.rideId } });
  if (input.method === "CASH") {
    if (payment) return payment;
    const created = await tx.payment.create({
      data: {
        rideId: input.rideId,
        customerId: input.customerId,
        amount: input.finalAmount,
        capturedAmount: input.finalAmount,
        method: "CASH",
        status: "PAID",
        paidAt: new Date()
      }
    });
    await writeFinancialAudit(tx, {
      actorId: input.actorId,
      action: "CASH_PAYMENT_RECORDED",
      entityType: "PAYMENT",
      entityId: created.id,
      metadata: { rideId: input.rideId, amount: input.finalAmount }
    });
    return created;
  }
  if (!payment) throw new ApiError(409, "PAYMENT_REQUIRED", "Chuyen chua co giao dich thanh toan");

  if (input.method === "WALLET" && payment.status === "AUTHORIZED") {
    const wallet = await tx.customerWallet.findUniqueOrThrow({ where: { userId: input.customerId } });
    const locked = await tx.customerWallet.update({
      where: { id: wallet.id },
      data: { updatedAt: new Date() }
    });
    const authorized = Number(payment.authorizedAmount || payment.amount);
    const heldCapture = Math.min(authorized, input.finalAmount);
    const released = Math.max(0, authorized - heldCapture);
    const extra = Math.max(0, input.finalAmount - authorized);
    const availableCapture = Math.min(extra, Number(locked.availableBalance));
    const receivable = extra - availableCapture;

    await tx.customerWallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: { increment: released - availableCapture },
        heldBalance: { decrement: authorized },
        platformReceivable: { increment: receivable }
      }
    });
    if (heldCapture > 0) {
      await customerLedger(tx, {
        walletId: wallet.id,
        rideId: input.rideId,
        amount: -heldCapture,
        heldDelta: -heldCapture,
        type: "CAPTURE",
        description: `Capture held fare for ride ${input.rideId}`
      });
    }
    if (released > 0) {
      await customerLedger(tx, {
        walletId: wallet.id,
        rideId: input.rideId,
        amount: 0,
        availableDelta: released,
        heldDelta: -released,
        type: "RELEASE",
        description: `Release unused fare hold for ride ${input.rideId}`
      });
    }
    if (availableCapture > 0) {
      await customerLedger(tx, {
        walletId: wallet.id,
        rideId: input.rideId,
        amount: -availableCapture,
        availableDelta: -availableCapture,
        type: "CAPTURE",
        description: `Capture additional fare for ride ${input.rideId}`
      });
    }
    if (receivable > 0) {
      await customerLedger(tx, {
        walletId: wallet.id,
        rideId: input.rideId,
        amount: receivable,
        platformReceivableDelta: receivable,
        type: "RECEIVABLE",
        description: `Outstanding final fare for ride ${input.rideId}`
      });
    }
    const captured = heldCapture + availableCapture;
    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        amount: input.finalAmount,
        capturedAmount: captured,
        status: receivable > 0 ? "PARTIALLY_PAID" : "PAID",
        paidAt: new Date()
      }
    });
    await writeFinancialAudit(tx, {
      actorId: input.actorId,
      action: "WALLET_PAYMENT_CAPTURED",
      entityType: "PAYMENT",
      entityId: payment.id,
      metadata: { rideId: input.rideId, authorized, captured, released, receivable }
    });
    return updated;
  }

  if (!["PAID", "PARTIALLY_PAID", "REFUND_PENDING"].includes(payment.status)) {
    throw new ApiError(409, "PAYMENT_REQUIRED", "Chuyen chua duoc thanh toan");
  }
  const paid = capturedAmount(payment);
  const difference = input.finalAmount - paid;
  if (difference < 0) {
    await createRefundRequestTx(tx, {
      payment,
      amount: Math.abs(difference),
      reason: `Final fare lower than prepaid amount for ride ${input.rideId}`,
      requestedById: input.actorId ?? input.customerId
    });
  } else if (difference > 0) {
    const wallet = await tx.customerWallet.upsert({
      where: { userId: input.customerId },
      create: { userId: input.customerId, platformReceivable: difference },
      update: { platformReceivable: { increment: difference } }
    });
    await customerLedger(tx, {
      walletId: wallet.id,
      rideId: input.rideId,
      amount: difference,
      platformReceivableDelta: difference,
      type: "RECEIVABLE",
      description: `Outstanding prepaid fare for ride ${input.rideId}`
    });
    await tx.payment.update({
      where: { id: payment.id },
      data: { amount: input.finalAmount, status: "PARTIALLY_PAID" }
    });
  }
  await writeFinancialAudit(tx, {
    actorId: input.actorId,
    action: "PREPAID_PAYMENT_RECONCILED",
    entityType: "PAYMENT",
    entityId: payment.id,
    metadata: { rideId: input.rideId, paid, finalAmount: input.finalAmount, difference }
  });
  return tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
}

export async function createRidePayment(
  tx: Db,
  input: { userId: string; rideId: string; amount: number; method: PaymentMethod }
) {
  if (input.method === "WALLET") {
    await holdCustomerWallet(tx, input);
    const payment = await tx.payment.create({
      data: {
        rideId: input.rideId,
        customerId: input.userId,
        amount: input.amount,
        authorizedAmount: input.amount,
        method: "WALLET",
        provider: "GORIDE_WALLET",
        status: "AUTHORIZED"
      }
    });
    await writeFinancialAudit(tx, {
      actorId: input.userId,
      action: "WALLET_PAYMENT_AUTHORIZED",
      entityType: "PAYMENT",
      entityId: payment.id,
      metadata: { rideId: input.rideId, amount: input.amount }
    });
    return payment;
  }
  if (input.method === "VIETQR") {
    const reference = createPaymentReference("RIDE");
    const expiresAt = new Date(Date.now() + env.vietQrPaymentTtlMinutes * 60_000);
    const payment = await tx.payment.create({
      data: {
        rideId: input.rideId,
        customerId: input.userId,
        amount: input.amount,
        method: "VIETQR",
        provider: "VIETQR",
        paymentReference: reference,
        expiresAt
      }
    });
    await writeFinancialAudit(tx, {
      actorId: input.userId,
      action: "VIETQR_PAYMENT_CREATED",
      entityType: "PAYMENT",
      entityId: payment.id,
      metadata: { rideId: input.rideId, amount: input.amount, reference }
    });
    return payment;
  }
  return null;
}

export async function settleDriverRide(
  tx: Db,
  input: {
    rideId: string;
    driverId: string;
    grossFare: number;
    paymentMethod: PaymentMethod;
    commissionRate: number;
    actorId?: string;
  }
) {
  const commission = Math.round(input.grossFare * input.commissionRate);
  const netEarning = input.grossFare - commission;
  const isCash = input.paymentMethod === "CASH";
  const wallet = await tx.driverWallet.upsert({
    where: { driverId: input.driverId },
    create: {
      driverId: input.driverId,
      pendingSettlement: isCash ? 0 : netEarning,
      platformReceivable: isCash ? commission : 0
    },
    update: isCash
      ? { platformReceivable: { increment: commission } }
      : { pendingSettlement: { increment: netEarning } }
  });
  await driverLedger(tx, {
    walletId: wallet.id,
    rideId: input.rideId,
    amount: input.grossFare,
    pendingSettlementDelta: isCash ? 0 : input.grossFare,
    type: "RIDE_EARNING",
    description: `Gross fare (${input.paymentMethod})`
  });
  await driverLedger(tx, {
    walletId: wallet.id,
    rideId: input.rideId,
    amount: -commission,
    pendingSettlementDelta: isCash ? 0 : -commission,
    platformReceivableDelta: isCash ? commission : 0,
    type: "COMMISSION",
    description: `Platform commission ${(input.commissionRate * 100).toFixed(1)}%`
  });
  if (isCash) {
    await driverLedger(tx, {
      walletId: wallet.id,
      rideId: input.rideId,
      amount: input.grossFare,
      type: "CASH_COLLECTION",
      description: "Cash fare collected directly by driver"
    });
  }
  await writeFinancialAudit(tx, {
    actorId: input.actorId,
    action: "DRIVER_RIDE_SETTLEMENT_CREATED",
    entityType: "RIDE",
    entityId: input.rideId,
    metadata: {
      driverId: input.driverId,
      grossFare: input.grossFare,
      commission,
      netEarning,
      paymentMethod: input.paymentMethod,
      bucket: isCash ? "PLATFORM_RECEIVABLE" : "PENDING_SETTLEMENT"
    }
  });
  return { grossFare: input.grossFare, commission, netEarning, pendingSettlement: isCash ? 0 : netEarning };
}

export async function settleDriverPendingBalances() {
  const wallets = await prisma.driverWallet.findMany({ where: { pendingSettlement: { gt: 0 } } });
  let settled = 0;
  let amount = 0;
  for (const wallet of wallets) {
    const value = Number(wallet.pendingSettlement);
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.driverWallet.updateMany({
        where: { id: wallet.id, pendingSettlement: wallet.pendingSettlement },
        data: {
          pendingSettlement: { decrement: value },
          availableBalance: { increment: value }
        }
      });
      if (!claimed.count) return;
      await driverLedger(tx, {
        walletId: wallet.id,
        amount: value,
        availableDelta: value,
        pendingSettlementDelta: -value,
        type: "SETTLEMENT",
        description: "Periodic provider settlement"
      });
      await writeFinancialAudit(tx, {
        action: "DRIVER_PENDING_SETTLEMENT_RELEASED",
        entityType: "DRIVER_WALLET",
        entityId: wallet.id,
        metadata: { amount: value }
      });
      settled++;
      amount += value;
    });
  }
  return { settled, amount };
}

async function getDriverByUserId(userId: string) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId },
    select: { id: true, totalRides: true }
  });
  if (!driver) throw new ApiError(404, "DRIVER_PROFILE_NOT_FOUND", "Chua co ho so tai xe");
  return driver;
}

export async function getDriverWallet(userId: string) {
  const driver = await getDriverByUserId(userId);
  const wallet = await prisma.driverWallet.upsert({
    where: { driverId: driver.id },
    create: { driverId: driver.id },
    update: {}
  });
  const [transactions, withdrawals, aggregate] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
    prisma.withdrawalRequest.findMany({
      where: { driverId: driver.id },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    prisma.walletTransaction.groupBy({
      by: ["type"],
      where: { walletId: wallet.id, status: "COMPLETED" },
      _sum: { amount: true }
    })
  ]);
  const availableBalance = Number(wallet.availableBalance);
  const heldBalance = Number(wallet.heldBalance);
  return {
    id: wallet.id,
    currency: wallet.currency,
    balance: availableBalance,
    pendingBalance: heldBalance,
    availableBalance,
    heldBalance,
    pendingSettlement: Number(wallet.pendingSettlement),
    platformReceivable: Number(wallet.platformReceivable),
    completedRides: driver.totalRides,
    commissionRate: env.platformCommissionRate,
    summary: Object.fromEntries(aggregate.map((item) => [item.type, Number(item._sum.amount ?? 0)])),
    transactions,
    withdrawals
  };
}

export async function createWithdrawal(
  userId: string,
  input: { amount: number; bankCode: string; accountNumber: string; accountName: string }
) {
  const driver = await getDriverByUserId(userId);
  return prisma.$transaction(
    async (tx) => {
      const wallet = await tx.driverWallet.upsert({
        where: { driverId: driver.id },
        create: { driverId: driver.id },
        update: {}
      });
      const reserved = await tx.driverWallet.updateMany({
        where: { id: wallet.id, availableBalance: { gte: input.amount } },
        data: {
          availableBalance: { decrement: input.amount },
          heldBalance: { increment: input.amount }
        }
      });
      if (!reserved.count) {
        throw new ApiError(422, "WITHDRAWAL_INSUFFICIENT_BALANCE", "So du kha dung khong du");
      }
      await driverLedger(tx, {
        walletId: wallet.id,
        amount: 0,
        availableDelta: -input.amount,
        heldDelta: input.amount,
        type: "HOLD",
        description: "Hold funds for withdrawal request"
      });
      const request = await tx.withdrawalRequest.create({ data: { driverId: driver.id, ...input } });
      await writeFinancialAudit(tx, {
        actorId: userId,
        action: "WITHDRAWAL_REQUESTED",
        entityType: "WITHDRAWAL",
        entityId: request.id,
        metadata: { amount: input.amount, driverId: driver.id }
      });
      return request;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function listWithdrawals(query: {
  status?: "PENDING" | "APPROVED" | "REJECTED";
  page: number;
  limit: number;
}) {
  const where = query.status ? { status: query.status } : {};
  const [items, total] = await Promise.all([
    prisma.withdrawalRequest.findMany({
      where,
      include: {
        driver: { include: { user: { select: { id: true, fullName: true, phone: true } }, wallet: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    }),
    prisma.withdrawalRequest.count({ where })
  ]);
  return { items, total, page: query.page, limit: query.limit };
}

export async function reviewWithdrawal(id: string, actorId: string, approve: boolean, reason?: string) {
  return prisma.$transaction(
    async (tx) => {
      const request = await tx.withdrawalRequest.findUnique({ where: { id } });
      if (!request) throw new ApiError(404, "WITHDRAWAL_NOT_FOUND", "Khong tim thay yeu cau rut tien");
      if (request.status !== "PENDING") {
        throw new ApiError(409, "WITHDRAWAL_ALREADY_REVIEWED", "Yeu cau da duoc xu ly");
      }
      const claimed = await tx.withdrawalRequest.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: approve ? "APPROVED" : "REJECTED",
          rejectionReason: approve ? null : reason,
          reviewedById: actorId,
          reviewedAt: new Date()
        }
      });
      if (!claimed.count) throw new ApiError(409, "WITHDRAWAL_ALREADY_REVIEWED", "Yeu cau da duoc xu ly");
      const wallet = await tx.driverWallet.findUniqueOrThrow({ where: { driverId: request.driverId } });
      const amount = Number(request.amount);
      if (Number(wallet.heldBalance) < amount) {
        throw new ApiError(409, "WITHDRAWAL_BALANCE_CHANGED", "So du dang giu khong con hop le");
      }
      if (approve) {
        await tx.driverWallet.update({
          where: { id: wallet.id },
          data: { heldBalance: { decrement: amount } }
        });
        await driverLedger(tx, {
          walletId: wallet.id,
          amount: -amount,
          heldDelta: -amount,
          type: "WITHDRAWAL",
          description: `Withdrawal approved ${id}`
        });
      } else {
        await tx.driverWallet.update({
          where: { id: wallet.id },
          data: {
            heldBalance: { decrement: amount },
            availableBalance: { increment: amount }
          }
        });
        await driverLedger(tx, {
          walletId: wallet.id,
          amount: 0,
          availableDelta: amount,
          heldDelta: -amount,
          type: "RELEASE",
          description: `Withdrawal hold released ${id}`
        });
      }
      const reviewed = await tx.withdrawalRequest.findUniqueOrThrow({ where: { id } });
      await writeFinancialAudit(tx, {
        actorId,
        action: approve ? "WITHDRAWAL_APPROVED" : "WITHDRAWAL_REJECTED",
        entityType: "WITHDRAWAL",
        entityId: id,
        metadata: approve ? { amount } : { amount, reason }
      });
      return reviewed;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function listRefunds(query: { status?: RefundStatus; page: number; limit: number }) {
  const where = query.status ? { status: query.status } : {};
  const [items, total] = await Promise.all([
    prisma.refundRequest.findMany({
      where,
      include: {
        payment: { include: { ride: true, customer: { select: { id: true, fullName: true, phone: true } } } }
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    }),
    prisma.refundRequest.count({ where })
  ]);
  return { items, total, page: query.page, limit: query.limit };
}

export async function reviewRefund(id: string, actorId: string, approve: boolean, reason?: string) {
  return prisma.$transaction(
    async (tx) => {
      const request = await tx.refundRequest.findUnique({
        where: { id },
        include: { payment: true }
      });
      if (!request) throw new ApiError(404, "REFUND_NOT_FOUND", "Khong tim thay yeu cau hoan tien");
      if (request.status !== "PENDING") {
        throw new ApiError(409, "REFUND_ALREADY_REVIEWED", "Yeu cau hoan tien da duoc xu ly");
      }
      const claimed = await tx.refundRequest.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: approve ? "APPROVED" : "REJECTED",
          reviewedById: actorId,
          reviewedAt: new Date(),
          rejectionReason: approve ? null : reason
        }
      });
      if (!claimed.count) throw new ApiError(409, "REFUND_ALREADY_REVIEWED", "Yeu cau da duoc xu ly");
      const amount = Number(request.amount);
      if (approve) {
        const wallet = await tx.customerWallet.upsert({
          where: { userId: request.customerId },
          create: { userId: request.customerId },
          update: {}
        });
        if (Number(wallet.pendingSettlement) < amount) {
          throw new ApiError(409, "REFUND_PENDING_BALANCE_CHANGED", "So du hoan tien dang cho khong hop le");
        }
        await tx.customerWallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: { increment: amount },
            pendingSettlement: { decrement: amount }
          }
        });
        await customerLedger(tx, {
          walletId: wallet.id,
          rideId: request.rideId,
          amount,
          availableDelta: amount,
          pendingSettlementDelta: -amount,
          type: "REFUND",
          description: `Approved refund ${id}`
        });
        const newRefunded = Number(request.payment.refundedAmount) + amount;
        const otherPending = await tx.refundRequest.count({
          where: { paymentId: request.paymentId, status: "PENDING", id: { not: id } }
        });
        await tx.payment.update({
          where: { id: request.paymentId },
          data: {
            refundedAmount: { increment: amount },
            status: paymentStatusAfterRefund(request.payment, newRefunded, otherPending > 0)
          }
        });
      } else {
        const wallet = await tx.customerWallet.findUniqueOrThrow({ where: { userId: request.customerId } });
        if (Number(wallet.pendingSettlement) < amount) {
          throw new ApiError(409, "REFUND_PENDING_BALANCE_CHANGED", "So du hoan tien dang cho khong hop le");
        }
        await tx.customerWallet.update({
          where: { id: wallet.id },
          data: { pendingSettlement: { decrement: amount } }
        });
        await customerLedger(tx, {
          walletId: wallet.id,
          rideId: request.rideId,
          amount: 0,
          pendingSettlementDelta: -amount,
          type: "RELEASE",
          description: `Rejected refund ${id}`
        });
        const otherPending = await tx.refundRequest.count({
          where: { paymentId: request.paymentId, status: "PENDING", id: { not: id } }
        });
        if (!otherPending) {
          await tx.payment.update({
            where: { id: request.paymentId },
            data: {
              status: paymentStatusAfterRefund(request.payment, Number(request.payment.refundedAmount), false)
            }
          });
        }
      }
      await writeFinancialAudit(tx, {
        actorId,
        action: approve ? "REFUND_APPROVED" : "REFUND_REJECTED",
        entityType: "REFUND_REQUEST",
        entityId: id,
        metadata: approve ? { amount, paymentId: request.paymentId } : { amount, reason }
      });
      return tx.refundRequest.findUniqueOrThrow({ where: { id }, include: { payment: true } });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
