import { Prisma, type ReconciliationClassification, type ReconciliationStatus } from "@prisma/client";
import { env } from "../../config/env";
import { withDistributedLock } from "../../config/redis";
import { prisma } from "../../config/prisma";
import { emitToUser, notifyRide } from "../../realtime/socket";
import { ApiError } from "../../utils/api-error";
import { writeFinancialAudit } from "../wallets/finance-audit";
import { settleDriverPendingBalances } from "../wallets/wallet.service";
import { ingestProviderTransaction, type ProviderTransactionInput } from "./payment.service";

type ProviderResponse = ProviderTransactionInput[] | { transactions: ProviderTransactionInput[] };

async function fetchProviderTransactions(from: Date, to: Date) {
  if (!env.vietQrReconciliationUrl) return [];
  const url = new URL(env.vietQrReconciliationUrl);
  url.searchParams.set("from", from.toISOString());
  url.searchParams.set("to", to.toISOString());
  const response = await fetch(url, {
    headers: env.vietQrReconciliationToken
      ? { Authorization: `Bearer ${env.vietQrReconciliationToken}` }
      : undefined,
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Provider reconciliation returned HTTP ${response.status}`);
  const payload = (await response.json()) as ProviderResponse;
  const transactions = Array.isArray(payload) ? payload : payload.transactions;
  if (!Array.isArray(transactions)) throw new Error("Provider reconciliation payload is invalid");
  return transactions;
}

async function expirePendingPayments(now: Date) {
  const [payments, topUps] = await prisma.$transaction([
    prisma.payment.updateMany({
      where: { status: "PENDING", expiresAt: { lt: now } },
      data: { status: "FAILED" }
    }),
    prisma.walletTopUp.updateMany({
      where: { status: "PENDING", expiresAt: { lt: now } },
      data: { status: "FAILED" }
    })
  ]);
  return { payments: payments.count, topUps: topUps.count };
}

export async function runReconciliation(actorId?: string) {
  const windowTo = new Date();
  const windowFrom = new Date(windowTo.getTime() - env.reconciliationLookbackHours * 60 * 60_000);
  const run = await prisma.reconciliationRun.create({
    data: { provider: "VIETQR", windowFrom, windowTo }
  });
  try {
    const transactions = await fetchProviderTransactions(windowFrom, windowTo);
    const results = [];
    for (const transaction of transactions) {
      results.push(await ingestProviderTransaction(transaction, "PROVIDER_POLL"));
    }
    const expired = await expirePendingPayments(windowTo);
    const driverSettlement = await settleDriverPendingBalances();
    const exactCount = results.filter((item) => item.classification === "EXACT").length;
    const duplicateCount = results.filter((item) => item.classification === "DUPLICATE").length;
    const exceptionCount = results.length - exactCount;
    const completed = await prisma.$transaction(async (tx) => {
      const updated = await tx.reconciliationRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          fetchedCount: transactions.length,
          exactCount,
          exceptionCount,
          duplicateCount,
          finishedAt: new Date()
        }
      });
      await writeFinancialAudit(tx, {
        actorId,
        action: "PROVIDER_RECONCILIATION_COMPLETED",
        entityType: "RECONCILIATION_RUN",
        entityId: run.id,
        metadata: {
          fetchedCount: transactions.length,
          exactCount,
          exceptionCount,
          duplicateCount,
          expired,
          driverSettlement,
          providerConfigured: Boolean(env.vietQrReconciliationUrl)
        }
      });
      return updated;
    });
    return { ...completed, expired, driverSettlement };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 191) : "Unknown reconciliation error";
    await prisma.$transaction(async (tx) => {
      await tx.reconciliationRun.update({
        where: { id: run.id },
        data: { status: "FAILED", errorMessage: message, finishedAt: new Date() }
      });
      await writeFinancialAudit(tx, {
        actorId,
        action: "PROVIDER_RECONCILIATION_FAILED",
        entityType: "RECONCILIATION_RUN",
        entityId: run.id,
        metadata: { error: message }
      });
    });
    throw error;
  }
}

export function startReconciliationWorker() {
  let running = false;
  const execute = async () => {
    if (running) return;
    running = true;
    try {
      await withDistributedLock(
        "payment-reconciliation",
        Math.max(60_000, env.reconciliationIntervalMinutes * 60_000 - 1_000),
        runReconciliation
      );
    } catch (error) {
      console.error("Provider reconciliation failed", error);
    } finally {
      running = false;
    }
  };
  void execute();
  const timer = setInterval(() => void execute(), env.reconciliationIntervalMinutes * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}

export async function listReconciliationRuns(query: { page: number; limit: number }) {
  const [items, total] = await Promise.all([
    prisma.reconciliationRun.findMany({
      orderBy: { startedAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    }),
    prisma.reconciliationRun.count()
  ]);
  return { items, total, page: query.page, limit: query.limit };
}

export async function listReconciliationItems(query: {
  classification?: ReconciliationClassification;
  status?: ReconciliationStatus;
  page: number;
  limit: number;
}) {
  const where = {
    ...(query.classification ? { classification: query.classification } : {}),
    ...(query.status ? { reconciliationStatus: query.status } : {})
  };
  const [items, total] = await Promise.all([
    prisma.paymentWebhookEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    }),
    prisma.paymentWebhookEvent.count({ where })
  ]);
  return { items, total, page: query.page, limit: query.limit };
}

export async function resolveReconciliationItem(
  id: string,
  actorId: string,
  input: { action: "ACCEPT" | "IGNORE"; note: string }
) {
  let rideId: string | undefined;
  let customerId: string | undefined;
  const resolved = await prisma.$transaction(
    async (tx) => {
      const event = await tx.paymentWebhookEvent.findUnique({ where: { id } });
      if (!event)
        throw new ApiError(404, "RECONCILIATION_ITEM_NOT_FOUND", "Khong tim thay giao dich doi soat");
      if (event.reconciliationStatus !== "REVIEW_REQUIRED") {
        throw new ApiError(409, "RECONCILIATION_ITEM_RESOLVED", "Giao dich da duoc xu ly");
      }
      if (input.action === "ACCEPT") {
        if (
          !event.targetId ||
          event.classification === "REFERENCE_NOT_FOUND" ||
          event.classification === "DUPLICATE"
        ) {
          throw new ApiError(422, "RECONCILIATION_CANNOT_ACCEPT", "Giao dich nay chi co the bo qua");
        }
        const amount = Number(event.amount);
        if (event.targetType === "PAYMENT") {
          const payment = await tx.payment.findUniqueOrThrow({ where: { id: event.targetId } });
          rideId = payment.rideId;
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: amount < Number(payment.amount) ? "PARTIALLY_PAID" : "PAID",
              capturedAmount: amount,
              providerTransactionId: event.providerTransactionId,
              paidAt: event.paidAt ?? new Date()
            }
          });
        } else if (event.targetType === "WALLET_TOP_UP") {
          const topUp = await tx.walletTopUp.findUniqueOrThrow({ where: { id: event.targetId } });
          if (topUp.status === "PAID") {
            throw new ApiError(409, "TOP_UP_ALREADY_PAID", "Lenh nap tien da duoc ghi nhan");
          }
          await tx.walletTopUp.update({
            where: { id: topUp.id },
            data: {
              status: "PAID",
              providerTransactionId: event.providerTransactionId,
              paidAt: event.paidAt ?? new Date()
            }
          });
          const wallet = await tx.customerWallet.upsert({
            where: { userId: topUp.customerId },
            create: { userId: topUp.customerId },
            update: { updatedAt: new Date() }
          });
          const receivablePaid = Math.min(Number(wallet.platformReceivable), amount);
          const availableCredit = amount - receivablePaid;
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
              amount,
              availableDelta: availableCredit,
              platformReceivableDelta: -receivablePaid,
              type: "TOP_UP",
              description: `Admin accepted reconciliation ${event.id}`
            }
          });
        }
      }
      const updated = await tx.paymentWebhookEvent.update({
        where: { id },
        data: {
          reconciliationStatus: input.action === "ACCEPT" ? "RESOLVED" : "IGNORED",
          resolutionNote: input.note,
          reconciledAt: new Date()
        }
      });
      await writeFinancialAudit(tx, {
        actorId,
        action:
          input.action === "ACCEPT"
            ? "RECONCILIATION_EXCEPTION_ACCEPTED"
            : "RECONCILIATION_EXCEPTION_IGNORED",
        entityType: "PAYMENT_WEBHOOK_EVENT",
        entityId: id,
        metadata: { classification: event.classification, amount: Number(event.amount), note: input.note }
      });
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
  if (rideId) await notifyRide(rideId, "payment.updated");
  if (customerId) emitToUser(customerId, "wallet.updated", { reconciliationId: id });
  return resolved;
}
