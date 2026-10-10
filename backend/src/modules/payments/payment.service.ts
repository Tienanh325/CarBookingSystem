import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { emitToUser, notifyRide } from "../../realtime/socket";
import { ApiError } from "../../utils/api-error";

export type VietQrWebhookInput = {
  transactionId: string;
  reference: string;
  amount: number;
  paidAt: string;
  signature: string;
};

export function createPaymentReference(prefix: "RIDE" | "TOPUP") {
  return `${prefix}${randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;
}

export function createVietQrDetails(reference: string, amount: number, expiresAt: Date) {
  const image = `${env.vietQrBankBin}-${env.vietQrAccountNumber}-${env.vietQrTemplate}.png`;
  const query = new URLSearchParams({
    amount: String(Math.round(amount)),
    addInfo: reference,
    accountName: env.vietQrAccountName
  });
  return {
    provider: "VIETQR",
    reference,
    amount: Math.round(amount),
    bankBin: env.vietQrBankBin,
    accountNumber: env.vietQrAccountNumber,
    accountName: env.vietQrAccountName,
    qrUrl: `https://img.vietqr.io/image/${encodeURIComponent(image)}?${query.toString()}`,
    expiresAt
  };
}

export function signVietQrWebhook(input: Omit<VietQrWebhookInput, "signature">) {
  const payload = `${input.transactionId}|${input.reference}|${input.amount}|${input.paidAt}`;
  return createHmac("sha256", env.vietQrWebhookSecret).update(payload).digest("hex");
}

function verifySignature(input: VietQrWebhookInput) {
  const expected = Buffer.from(signVietQrWebhook(input), "hex");
  const received = Buffer.from(input.signature, "hex");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new ApiError(401, "IPN_SIGNATURE_INVALID", "Chu ky webhook khong hop le");
  }
}

export async function getRidePayment(userId: string, rideId: string) {
  const payment = await prisma.payment.findFirst({
    where: { rideId, ride: { customerId: userId } },
    include: { ride: { select: { id: true, status: true, paymentMethod: true } } }
  });
  if (!payment) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Khong tim thay giao dich");
  return {
    ...payment,
    vietQr: payment.method === "VIETQR" && payment.paymentReference && payment.expiresAt
      ? createVietQrDetails(payment.paymentReference, Number(payment.amount), payment.expiresAt)
      : null
  };
}

export async function processVietQrWebhook(input: VietQrWebhookInput) {
  verifySignature(input);
  let rideId: string | undefined;
  let customerId: string | undefined;

  let result: { duplicate: boolean; reference: string; kind?: "RIDE" | "TOP_UP"; rideId?: string };
  try {
    result = await prisma.$transaction(async (tx) => {
    const duplicate = await tx.paymentWebhookEvent.findUnique({
      where: { providerTransactionId: input.transactionId }
    });
    if (duplicate) return { duplicate: true, reference: duplicate.paymentReference };

    const payment = await tx.payment.findUnique({ where: { paymentReference: input.reference } });
    const topUp = payment
      ? null
      : await tx.walletTopUp.findUnique({ where: { paymentReference: input.reference } });
    if (!payment && !topUp) throw new ApiError(404, "IPN_REFERENCE_NOT_FOUND", "Khong tim thay ma thanh toan");

    const expectedAmount = Number(payment?.amount ?? topUp!.amount);
    if (expectedAmount !== input.amount) {
      throw new ApiError(422, "IPN_AMOUNT_MISMATCH", "So tien thanh toan khong khop", {
        expectedAmount,
        receivedAmount: input.amount
      });
    }

    await tx.paymentWebhookEvent.create({
      data: {
        provider: "VIETQR",
        providerTransactionId: input.transactionId,
        paymentReference: input.reference,
        amount: input.amount,
        payload: input as unknown as Prisma.InputJsonValue
      }
    });

    if (payment) {
      rideId = payment.rideId;
      if (payment.status === "PAID") return { duplicate: true, reference: input.reference };
      if (payment.status !== "PENDING") throw new ApiError(409, "PAYMENT_NOT_PENDING", "Giao dich khong con cho thanh toan");
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "PAID", providerTransactionId: input.transactionId, paidAt: new Date(input.paidAt) }
      });
      return { duplicate: false, kind: "RIDE" as const, reference: input.reference, rideId: payment.rideId };
    }

    if (topUp!.status === "PAID") return { duplicate: true, reference: input.reference };
    if (topUp!.status !== "PENDING") throw new ApiError(409, "TOP_UP_NOT_PENDING", "Lenh nap tien khong con hieu luc");
    const wallet = await tx.customerWallet.upsert({
      where: { userId: topUp!.customerId },
      create: { userId: topUp!.customerId, balance: input.amount },
      update: { balance: { increment: input.amount } }
    });
    customerId = topUp!.customerId;
    await tx.walletTopUp.update({
      where: { id: topUp!.id },
      data: { status: "PAID", providerTransactionId: input.transactionId, paidAt: new Date(input.paidAt) }
    });
    await tx.customerWalletTransaction.create({
      data: {
        walletId: wallet.id,
        topUpId: topUp!.id,
        amount: input.amount,
        type: "TOP_UP",
        description: `VietQR top-up ${input.reference}`
      }
    });
    return { duplicate: false, kind: "TOP_UP" as const, reference: input.reference };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  } catch (error) {
    // Two identical callbacks can pass the initial lookup concurrently. The unique
    // provider transaction ID turns the loser into a successful idempotent replay.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.paymentWebhookEvent.findUnique({
        where: { providerTransactionId: input.transactionId }
      });
      if (existing) return { duplicate: true, reference: existing.paymentReference };
    }
    throw error;
  }

  if (rideId) await notifyRide(rideId, "payment.updated");
  if (customerId) emitToUser(customerId, "wallet.updated", { reference: input.reference });
  return result;
}
