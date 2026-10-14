import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { aggregateFinancialTotals, financialTotals } from "../src/modules/admin/financial-metrics";

describe("financial reporting totals", () => {
  it("reports captured revenue as both gross and net when there are no refunds", () => {
    expect(financialTotals(new Prisma.Decimal("125000.50"), null)).toEqual({
      grossRevenue: 125000.5,
      refundedRevenue: 0,
      netRevenue: 125000.5
    });
  });

  it("separates partial and full refunds from gross revenue", () => {
    expect(financialTotals("100000", "25000")).toEqual({
      grossRevenue: 100000,
      refundedRevenue: 25000,
      netRevenue: 75000
    });
    expect(financialTotals("100000", "100000")).toEqual({
      grossRevenue: 100000,
      refundedRevenue: 100000,
      netRevenue: 0
    });
  });

  it("aggregates Decimal values before converting the result to numbers", () => {
    expect(
      aggregateFinancialTotals([
        { capturedAmount: new Prisma.Decimal("100.10"), refundedAmount: new Prisma.Decimal("0.10") },
        { capturedAmount: new Prisma.Decimal("200.20") },
        { refundedAmount: new Prisma.Decimal("50.05") }
      ])
    ).toEqual({
      grossRevenue: 300.3,
      refundedRevenue: 50.15,
      netRevenue: 250.15
    });
  });

  it("allows a negative period net when valid refunds exceed captures in that period", () => {
    expect(financialTotals(0, 50000)).toEqual({
      grossRevenue: 0,
      refundedRevenue: 50000,
      netRevenue: -50000
    });
  });

  it("rejects negative source amounts because captured and refunded amounts are non-negative", () => {
    expect(() => financialTotals(-1, 0)).toThrow("capturedAmount must be a finite non-negative amount");
    expect(() => financialTotals(0, -1)).toThrow("refundedAmount must be a finite non-negative amount");
  });
});
