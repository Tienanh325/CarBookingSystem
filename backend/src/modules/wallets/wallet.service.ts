import { Prisma, type PaymentMethod } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";
import { createPaymentReference, createVietQrDetails } from "../payments/payment.service";

type Db = Prisma.TransactionClient;

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
  return { ...wallet, balance: Number(wallet.balance), transactions, pendingTopUps };
}

export async function createTopUp(userId: string, amount: number) {
  const reference = createPaymentReference("TOPUP");
  const expiresAt = new Date(Date.now() + env.vietQrPaymentTtlMinutes * 60_000);
  const topUp = await prisma.walletTopUp.create({
    data: { customerId: userId, amount, paymentReference: reference, expiresAt }
  });
  return { ...topUp, vietQr: createVietQrDetails(reference, amount, expiresAt) };
}

export async function chargeCustomerWallet(
  tx: Db,
  input: { userId: string; rideId: string; amount: number }
) {
  const wallet = await tx.customerWallet.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId },
    update: {}
  });
  const charged = await tx.customerWallet.updateMany({
    where: { id: wallet.id, balance: { gte: input.amount } },
    data: { balance: { decrement: input.amount } }
  });
  if (!charged.count) {
    throw new ApiError(422, "WALLET_INSUFFICIENT_BALANCE", "So du vi khong du de thanh toan chuyen");
  }
  await tx.customerWalletTransaction.create({
    data: {
      walletId: wallet.id,
      rideId: input.rideId,
      amount: -input.amount,
      type: "RIDE_PAYMENT",
      description: `Ride payment ${input.rideId}`
    }
  });
}

export async function refundCustomerWalletRide(tx: Db, rideId: string) {
  return settleCancelledRidePayment(tx, rideId, 0);
}

export async function settleCancelledRidePayment(tx: Db, rideId: string, cancellationFee: number) {
  const ride = await tx.ride.findUniqueOrThrow({ where: { id: rideId } });
  const payment = await tx.payment.findUnique({ where: { rideId } });
  if (!payment) {
    if (cancellationFee > 0) {
      await tx.payment.create({
        data: {
          rideId,
          customerId: ride.customerId,
          amount: cancellationFee,
          method: ride.paymentMethod,
          status: "PENDING"
        }
      });
    }
    return { collected: false, refundedAmount: 0 };
  }
  if (!["WALLET", "VIETQR"].includes(payment.method)) return { collected: false, refundedAmount: 0 };
  if (payment.status === "PENDING") {
    await tx.payment.update({
      where: { id: payment.id },
      data: cancellationFee > 0 ? { amount: cancellationFee } : { status: "FAILED" }
    });
    return { collected: false, refundedAmount: 0 };
  }
  if (payment.status !== "PAID") return { collected: false, refundedAmount: 0 };
  const refundedAmount = Math.max(0, Number(payment.amount) - cancellationFee);
  const wallet = await tx.customerWallet.upsert({
    where: { userId: payment.customerId },
    create: { userId: payment.customerId, balance: refundedAmount },
    update: { balance: { increment: refundedAmount } }
  });
  if (refundedAmount > 0) {
    await tx.customerWalletTransaction.create({
      data: {
        walletId: wallet.id,
        rideId,
        amount: refundedAmount,
        type: "REFUND",
        description: `Cancelled ${payment.method} ride refund ${rideId}`
      }
    });
  }
  await tx.payment.update({
    where: { id: payment.id },
    data: {
      amount: cancellationFee,
      refundedAmount: { increment: refundedAmount },
      status: cancellationFee > 0 ? "PAID" : "REFUNDED"
    }
  });
  return { collected: cancellationFee > 0, refundedAmount };
}

export async function reconcileCompletedRidePayment(
  tx: Db,
  input: { rideId: string; customerId: string; method: PaymentMethod; finalAmount: number }
) {
  const payment = await tx.payment.findUnique({ where: { rideId: input.rideId } });
  if (input.method === "CASH") {
    if (payment) return payment;
    return tx.payment.create({
      data: {
        rideId: input.rideId,
        customerId: input.customerId,
        amount: input.finalAmount,
        method: "CASH",
        status: "PAID",
        paidAt: new Date()
      }
    });
  }
  if (!payment || payment.status !== "PAID") {
    throw new ApiError(409, "PAYMENT_REQUIRED", "Chuyen chua duoc thanh toan");
  }
  const delta = input.finalAmount - Number(payment.amount);
  if (delta !== 0) {
    const wallet = await tx.customerWallet.upsert({
      where: { userId: input.customerId },
      create: { userId: input.customerId, balance: -delta },
      update: { balance: delta > 0 ? { decrement: delta } : { increment: Math.abs(delta) } }
    });
    await tx.customerWalletTransaction.create({
      data: {
        walletId: wallet.id,
        rideId: input.rideId,
        amount: -delta,
        type: delta > 0 ? "RIDE_PAYMENT" : "REFUND",
        description: `Final fare adjustment ${input.rideId}`
      }
    });
  }
  return tx.payment.update({
    where: { id: payment.id },
    data: {
      amount: input.finalAmount,
      refundedAmount: delta < 0 ? { increment: Math.abs(delta) } : undefined
    }
  });
}

export async function createRidePayment(
  tx: Db,
  input: { userId: string; rideId: string; amount: number; method: PaymentMethod }
) {
  if (input.method === "WALLET") {
    await chargeCustomerWallet(tx, input);
    return tx.payment.create({
      data: {
        rideId: input.rideId,
        customerId: input.userId,
        amount: input.amount,
        method: "WALLET",
        provider: "GORIDE_WALLET",
        status: "PAID",
        paidAt: new Date()
      }
    });
  }
  if (input.method === "VIETQR") {
    const reference = createPaymentReference("RIDE");
    const expiresAt = new Date(Date.now() + env.vietQrPaymentTtlMinutes * 60_000);
    return tx.payment.create({
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
  }
) {
  const commission = Math.round(input.grossFare * input.commissionRate);
  const cashCollected = input.paymentMethod === "CASH" ? input.grossFare : 0;
  const balanceDelta = input.grossFare - commission - cashCollected;
  const wallet = await tx.driverWallet.upsert({
    where: { driverId: input.driverId },
    create: { driverId: input.driverId, balance: balanceDelta },
    update: { balance: { increment: balanceDelta } }
  });
  await tx.walletTransaction.createMany({
    data: [
      {
        walletId: wallet.id,
        rideId: input.rideId,
        amount: input.grossFare,
        type: "RIDE_EARNING",
        description: `Gross fare (${input.paymentMethod})`
      },
      {
        walletId: wallet.id,
        rideId: input.rideId,
        amount: -commission,
        type: "COMMISSION",
        description: `Platform commission ${(input.commissionRate * 100).toFixed(1)}%`
      },
      ...(cashCollected > 0
        ? [
            {
              walletId: wallet.id,
              rideId: input.rideId,
              amount: -cashCollected,
              type: "CASH_COLLECTION" as const,
              description: "Cash fare collected directly by driver"
            }
          ]
        : [])
    ]
  });
  return { grossFare: input.grossFare, commission, netEarning: input.grossFare - commission, balanceDelta };
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
  return {
    id: wallet.id,
    currency: wallet.currency,
    balance: Number(wallet.balance),
    pendingBalance: Number(wallet.pendingBalance),
    availableBalance: Number(wallet.balance) - Number(wallet.pendingBalance),
    completedRides: driver.totalRides,
    commissionRate: env.platformCommissionRate,
    summary: Object.fromEntries(aggregate.map((item) => [item.type, Number(item._sum.amount ?? 0)])),
    transactions,
    withdrawals
  };
}

export async function createWithdrawal(
  userId: string,
  input: {
    amount: number;
    bankCode: string;
    accountNumber: string;
    accountName: string;
  }
) {
  const driver = await getDriverByUserId(userId);
  return prisma.$transaction(
    async (tx) => {
      const wallet = await tx.driverWallet.upsert({
        where: { driverId: driver.id },
        create: { driverId: driver.id },
        update: {}
      });
      // A no-op write locks the wallet row so concurrent requests cannot over-reserve it.
      const current = await tx.driverWallet.update({
        where: { id: wallet.id },
        data: { updatedAt: new Date() }
      });
      if (Number(current.balance) - Number(current.pendingBalance) < input.amount) {
        throw new ApiError(422, "WITHDRAWAL_INSUFFICIENT_BALANCE", "So du kha dung khong du");
      }
      await tx.driverWallet.update({
        where: { id: wallet.id },
        data: { pendingBalance: { increment: input.amount } }
      });
      return tx.withdrawalRequest.create({ data: { driverId: driver.id, ...input } });
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
      if (request.status !== "PENDING")
        throw new ApiError(409, "WITHDRAWAL_ALREADY_REVIEWED", "Yeu cau da duoc xu ly");
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

      if (approve) {
        if (Number(wallet.balance) < amount || Number(wallet.pendingBalance) < amount) {
          throw new ApiError(409, "WITHDRAWAL_BALANCE_CHANGED", "So du vi khong con hop le");
        }
        await tx.driverWallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: amount }, pendingBalance: { decrement: amount } }
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: -amount,
            type: "WITHDRAWAL",
            description: `Withdrawal approved ${id}`
          }
        });
      } else {
        await tx.driverWallet.update({
          where: { id: wallet.id },
          data: { pendingBalance: { decrement: amount } }
        });
      }

      const reviewed = await tx.withdrawalRequest.findUniqueOrThrow({ where: { id } });
      await tx.auditLog.create({
        data: {
          actorId,
          action: approve ? "WITHDRAWAL_APPROVED" : "WITHDRAWAL_REJECTED",
          entityType: "WITHDRAWAL",
          entityId: id,
          metadata: approve ? { amount } : { amount, reason }
        }
      });
      return reviewed;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
