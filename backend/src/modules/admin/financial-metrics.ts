import { Prisma } from "@prisma/client";

export type MoneyValue = Prisma.Decimal | number | string | null | undefined;

export type FinancialTotals = {
  grossRevenue: number;
  refundedRevenue: number;
  netRevenue: number;
};

function nonNegativeMoney(value: MoneyValue, field: "capturedAmount" | "refundedAmount") {
  const amount = new Prisma.Decimal(value ?? 0);
  if (!amount.isFinite() || amount.isNegative()) {
    throw new RangeError(`${field} must be a finite non-negative amount`);
  }
  return amount;
}

/**
 * Financial reporting contract: gross is captured money, refunds are completed
 * refunds, and net is their difference. A reporting period can legitimately
 * have a negative net when refunds for older payments exceed new captures.
 */
export function financialTotals(capturedAmount: MoneyValue, refundedAmount: MoneyValue): FinancialTotals {
  const gross = nonNegativeMoney(capturedAmount, "capturedAmount");
  const refunds = nonNegativeMoney(refundedAmount, "refundedAmount");

  return {
    grossRevenue: gross.toNumber(),
    refundedRevenue: refunds.toNumber(),
    netRevenue: gross.minus(refunds).toNumber()
  };
}

export function aggregateFinancialTotals(
  entries: Iterable<{ capturedAmount?: MoneyValue; refundedAmount?: MoneyValue }>
): FinancialTotals {
  let gross = new Prisma.Decimal(0);
  let refunds = new Prisma.Decimal(0);

  for (const entry of entries) {
    gross = gross.plus(nonNegativeMoney(entry.capturedAmount, "capturedAmount"));
    refunds = refunds.plus(nonNegativeMoney(entry.refundedAmount, "refundedAmount"));
  }

  return financialTotals(gross, refunds);
}
