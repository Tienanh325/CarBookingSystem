import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";
import { writeFinancialAudit } from "../wallets/finance-audit";

export function reportWindow(period: "day" | "month", date: string) {
  const key = period === "day" ? date : date.slice(0, 7);
  const match = key.match(period === "day" ? /^(\d{4})-(\d{2})-(\d{2})$/ : /^(\d{4})-(\d{2})$/);
  if (!match) throw new ApiError(422, "REPORT_DATE_INVALID", "Ngay bao cao khong hop le");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = period === "day" ? Number(match[3]) : 1;
  if (month < 1 || month > 12) {
    throw new ApiError(422, "REPORT_DATE_INVALID", "Ngay bao cao khong hop le");
  }
  const start = new Date(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+07:00`
  );
  if (Number.isNaN(start.getTime())) {
    throw new ApiError(422, "REPORT_DATE_INVALID", "Ngay bao cao khong hop le");
  }
  const normalizedKey = new Date(start.getTime() + 7 * 60 * 60_000).toISOString().slice(0, 10);
  if (period === "day" && normalizedKey !== key) {
    throw new ApiError(422, "REPORT_DATE_INVALID", "Ngay bao cao khong hop le");
  }
  const end =
    period === "day"
      ? new Date(start.getTime() + 24 * 60 * 60_000)
      : new Date(
          `${year + (month === 12 ? 1 : 0)}-${String((month % 12) + 1).padStart(2, "0")}-01T00:00:00+07:00`
        );
  return { key, start, end };
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function financeCsvReport(actorId: string, query: { period: "day" | "month"; date: string }) {
  const { key, start, end } = reportWindow(query.period, query.date);
  const paidStatuses = ["PAID", "PARTIALLY_PAID", "REFUND_PENDING", "REFUNDED"] as const;
  const [revenue, commission, cash, topUps, refunds, withdrawals] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: { in: [...paidStatuses] }, paidAt: { gte: start, lt: end } },
      _sum: { capturedAmount: true },
      _count: true
    }),
    prisma.walletTransaction.aggregate({
      where: { type: "COMMISSION", status: "COMPLETED", createdAt: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: true
    }),
    prisma.payment.aggregate({
      where: { method: "CASH", status: { in: [...paidStatuses] }, paidAt: { gte: start, lt: end } },
      _sum: { capturedAmount: true },
      _count: true
    }),
    prisma.customerWalletTransaction.aggregate({
      where: { type: "TOP_UP", status: "COMPLETED", createdAt: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: true
    }),
    prisma.customerWalletTransaction.aggregate({
      where: { type: "REFUND", status: "COMPLETED", createdAt: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: true
    }),
    prisma.withdrawalRequest.aggregate({
      where: { status: "APPROVED", reviewedAt: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: true
    })
  ]);
  const rows = [
    ["TOTAL_REVENUE", Number(revenue._sum.capturedAmount ?? 0), revenue._count],
    ["PLATFORM_COMMISSION", Math.abs(Number(commission._sum.amount ?? 0)), commission._count],
    ["CASH_COLLECTION", Number(cash._sum.capturedAmount ?? 0), cash._count],
    ["WALLET_TOP_UP", Number(topUps._sum.amount ?? 0), topUps._count],
    ["REFUND", Number(refunds._sum.amount ?? 0), refunds._count],
    ["WITHDRAWAL", Number(withdrawals._sum.amount ?? 0), withdrawals._count]
  ] as const;
  await prisma.$transaction(async (tx) => {
    await writeFinancialAudit(tx, {
      actorId,
      action: "FINANCE_REPORT_EXPORTED",
      entityType: "FINANCE_REPORT",
      entityId: `${query.period}:${key}`,
      metadata: { period: query.period, start: start.toISOString(), end: end.toISOString() }
    });
  });
  const header = ["period", "start", "end", "metric", "amount", "count", "currency"];
  const lines = [
    header,
    ...rows.map(([metric, amount, count]) => [
      query.period,
      start.toISOString(),
      end.toISOString(),
      metric,
      amount,
      count,
      "VND"
    ])
  ];
  return {
    filename: `goride-finance-${query.period}-${key}.csv`,
    csv: `\uFEFF${lines.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`
  };
}
