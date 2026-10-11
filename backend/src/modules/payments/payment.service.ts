import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma, type ReconciliationClassification, type ReconciliationSource } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { emitToUser, notifyRide } from "../../realtime/socket";
import { ApiError } from "../../utils/api-error";
import { writeFinancialAudit } from "../wallets/finance-audit";

export type ProviderTransactionInput = {
  transactionId: string;
  reference: string;
  amount: number;
  paidAt: string;
};

export type VietQrWebhookInput = ProviderTransactionInput & { signature: string };

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

export function classifyProviderTransaction(input: {
  amount: number;
  paidAt: Date;
  expectedAmount?: number;
  expiresAt?: Date | null;
  referenceFound: boolean;
  alreadySettled?: boolean;
}): ReconciliationClassification {
  if (!input.referenceFound) return "REFERENCE_NOT_FOUND";
  if (input.alreadySettled) return "DUPLICATE";
  if (input.expiresAt && input.paidAt > input.expiresAt) return "EXPIRED";
  if (input.amount < input.expectedAmount!) return "UNDERPAID";
  if (input.amount > input.expectedAmount!) return "OVERPAID";
  return "EXACT";
}

export async function getRidePayment(userId: string, rideId: string) {
  const payment = await prisma.payment.findFirst({
    where: { rideId, ride: { customerId: userId } },
    include: {
      ride: { select: { id: true, status: true, paymentMethod: true } },
      refundRequests: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!payment) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Khong tim thay giao dich");
  return {
    ...payment,
    vietQr:
      payment.method === "VIETQR" && payment.paymentReference && payment.expiresAt
        ? createVietQrDetails(payment.paymentReference, Number(payment.amount), payment.expiresAt)
        : null
  };
}

async function recordDuplicate(transactionId: string, payload: ProviderTransactionInput) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.paymentWebhookEvent.update({
      where: { providerTransactionId: transactionId },
      data: {
        duplicateCount: { increment: 1 },
        classification: "DUPLICATE",
        reconciliationStatus: "REVIEW_REQUIRED",
        lastReceivedAt: new Date(),
        payload: payload as unknown as Prisma.InputJsonValue
      }
    });
    await writeFinancialAudit(tx, {
      action: "PROVIDER_TRANSACTION_DUPLICATE",
      entityType: "PAYMENT_WEBHOOK_EVENT",
      entityId: event.id,
      metadata: { transactionId, reference: event.paymentReference, duplicateCount: event.duplicateCount }
    });
    return {
      duplicate: true,
      classification: "DUPLICATE" as const,
      reconciliationStatus: "REVIEW_REQUIRED" as const,
      reference: event.paymentReference
    };
  });
}

export async function ingestProviderTransaction(
  input: ProviderTransactionInput,
  source: ReconciliationSource = "WEBHOOK"
) {
  const paidAt = new Date(input.paidAt);
  if (Number.isNaN(paidAt.getTime())) {
    throw new ApiError(422, "PROVIDER_PAID_AT_INVALID", "Thoi gian giao dich khong hop le");
  }
  const existing = await prisma.paymentWebhookEvent.findUnique({
    where: { providerTransactionId: input.transactionId }
  });
  if (existing) return recordDuplicate(input.transactionId, input);

  let rideId: string | undefined;
  let customerId: string | undefined;
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const payment = await tx.payment.findUnique({ where: { paymentReference: input.reference } });
        const topUp = payment
          ? null
          : await tx.walletTopUp.findUnique({ where: { paymentReference: input.reference } });
        const target = payment ?? topUp;
        const expectedAmount = target ? Number(target.amount) : undefined;
        const alreadySettled = Boolean(
          target && target.providerTransactionId && target.providerTransactionId !== input.transactionId
        );
        let classification = classifyProviderTransaction({
          amount: input.amount,
          paidAt,
          expectedAmount,
          expiresAt: target?.expiresAt,
          referenceFound: Boolean(target),
          alreadySettled
        });
        const event = await tx.paymentWebhookEvent.create({
          data: {
            provider: "VIETQR",
            providerTransactionId: input.transactionId,
            paymentReference: input.reference,
            amount: input.amount,
            expectedAmount,
            classification,
            reconciliationStatus: classification === "EXACT" ? "MATCHED" : "REVIEW_REQUIRED",
            source,
            targetType: payment ? "PAYMENT" : topUp ? "WALLET_TOP_UP" : null,
            targetId: target?.id,
            paidAt,
            expiresAt: target?.expiresAt,
            reconciledAt: classification === "EXACT" ? new Date() : null,
            payload: input as unknown as Prisma.InputJsonValue
          }
        });

        if (classification === "EXACT" && payment) {
          rideId = payment.rideId;
          const claimed = await tx.payment.updateMany({
            where: { id: payment.id, status: "PENDING", providerTransactionId: null },
            data: {
              status: "PAID",
              capturedAmount: input.amount,
              providerTransactionId: input.transactionId,
              paidAt
            }
          });
          if (!claimed.count) {
            classification = "DUPLICATE";
            await tx.paymentWebhookEvent.update({
              where: { id: event.id },
              data: { classification, reconciliationStatus: "REVIEW_REQUIRED", reconciledAt: null }
            });
          }
        } else if (classification === "EXACT" && topUp) {
          const claimed = await tx.walletTopUp.updateMany({
            where: { id: topUp.id, status: "PENDING", providerTransactionId: null },
            data: {
              status: "PAID",
              providerTransactionId: input.transactionId,
              paidAt
            }
          });
          if (!claimed.count) {
            classification = "DUPLICATE";
            await tx.paymentWebhookEvent.update({
              where: { id: event.id },
              data: { classification, reconciliationStatus: "REVIEW_REQUIRED", reconciledAt: null }
            });
          } else {
            const wallet = await tx.customerWallet.upsert({
              where: { userId: topUp.customerId },
              create: { userId: topUp.customerId },
              update: { updatedAt: new Date() }
            });
            const receivablePaid = Math.min(Number(wallet.platformReceivable), input.amount);
            const availableCredit = input.amount - receivablePaid;
            await tx.customerWallet.update({
              where: { id: wallet.id },
              data: {
                availableBalance: { increment: availableCredit },
                platformReceivable: { decrement: receivablePaid }
              }
            });
            customerId = topUp.customerId;
            await tx.customerWalletTransaction.create({
              data: {
                walletId: wallet.id,
                topUpId: topUp.id,
                amount: input.amount,
                availableDelta: availableCredit,
                platformReceivableDelta: -receivablePaid,
                type: "TOP_UP",
                description: `VietQR top-up ${input.reference}`
              }
            });
          }
        }

        await writeFinancialAudit(tx, {
          action:
            classification === "EXACT" ? "PROVIDER_TRANSACTION_MATCHED" : "PROVIDER_TRANSACTION_EXCEPTION",
          entityType: "PAYMENT_WEBHOOK_EVENT",
          entityId: event.id,
          metadata: {
            transactionId: input.transactionId,
            reference: input.reference,
            receivedAmount: input.amount,
            expectedAmount,
            classification,
            source
          }
        });
        return {
          duplicate: classification === "DUPLICATE",
          classification,
          reconciliationStatus:
            classification === "EXACT" ? ("MATCHED" as const) : ("REVIEW_REQUIRED" as const),
          reference: input.reference,
          kind: payment ? ("RIDE" as const) : topUp ? ("TOP_UP" as const) : undefined,
          rideId: payment?.rideId,
          eventId: event.id
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
    );
    if (rideId) await notifyRide(rideId, "payment.updated");
    if (customerId) emitToUser(customerId, "wallet.updated", { reference: input.reference });
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return recordDuplicate(input.transactionId, input);
    }
    throw error;
  }
}

export async function processVietQrWebhook(input: VietQrWebhookInput) {
  verifySignature(input);
  const { signature: _signature, ...transaction } = input;
  return ingestProviderTransaction(transaction, "WEBHOOK");
}
