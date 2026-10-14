import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { count: vi.fn() },
    driverProfile: { count: vi.fn() },
    ride: { count: vi.fn(), groupBy: vi.fn() },
    payment: { aggregate: vi.fn(), findMany: vi.fn() },
    customerWalletTransaction: { findMany: vi.fn() }
  }
}));

vi.mock("../src/config/prisma", () => ({ prisma: prismaMock }));
vi.mock("../src/realtime/socket", () => ({ notifyRide: vi.fn() }));
vi.mock("../src/modules/wallets/wallet.service", () => ({
  refundCustomerWalletRide: vi.fn()
}));

import { dashboard } from "../src/modules/admin/admin.service";

describe("admin dashboard financial contract", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T10:00:00.000Z"));
    vi.clearAllMocks();

    prismaMock.user.count.mockResolvedValue(10);
    prismaMock.driverProfile.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
    prismaMock.ride.count.mockResolvedValueOnce(3).mockResolvedValueOnce(7).mockResolvedValueOnce(1);
    prismaMock.payment.aggregate.mockResolvedValue({
      _sum: { capturedAmount: "300000", refundedAmount: "50000" },
      _count: 2
    });
    prismaMock.payment.findMany.mockResolvedValue([
      { capturedAmount: "200000", paidAt: new Date("2026-10-14T08:00:00.000Z") },
      { capturedAmount: "100000", paidAt: new Date("2026-10-14T12:00:00.000Z") }
    ]);
    prismaMock.customerWalletTransaction.findMany.mockResolvedValue([
      { amount: "50000", createdAt: new Date("2026-10-14T13:00:00.000Z") }
    ]);
    prismaMock.ride.groupBy.mockResolvedValue([{ status: "COMPLETED", _count: 7 }]);
  });

  afterEach(() => vi.useRealTimers());

  it("returns explicit gross, refunded and net totals for all-time and daily data", async () => {
    const result = await dashboard();

    expect(prismaMock.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        _sum: { capturedAmount: true, refundedAmount: true }
      })
    );
    expect(result).toMatchObject({
      grossRevenue: 300000,
      refundedRevenue: 50000,
      netRevenue: 250000,
      paidTransactions: 2
    });
    expect(result).not.toHaveProperty("revenue");
    expect(result).not.toHaveProperty("dailyRevenue");
    expect(result.dailyFinancials).toHaveLength(7);
    expect(result.dailyFinancials).toContainEqual({
      day: "2026-10-14",
      grossRevenue: 300000,
      refundedRevenue: 50000,
      netRevenue: 250000
    });
  });
});
