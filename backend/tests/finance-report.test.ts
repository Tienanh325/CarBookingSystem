import { describe, expect, it } from "vitest";
import { reportWindow, revenueCsvRows } from "../src/modules/admin/finance-report.service";

describe("finance report window", () => {
  it("uses exact Asia/Saigon day boundaries", () => {
    const window = reportWindow("day", "2026-10-11");

    expect(window.key).toBe("2026-10-11");
    expect(window.start.toISOString()).toBe("2026-10-10T17:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-10-11T17:00:00.000Z");
  });

  it("advances a calendar month in Asia/Saigon instead of a UTC month", () => {
    const march = reportWindow("month", "2026-03");
    const december = reportWindow("month", "2026-12");

    expect(march.start.toISOString()).toBe("2026-02-28T17:00:00.000Z");
    expect(march.end.toISOString()).toBe("2026-03-31T17:00:00.000Z");
    expect(december.end.toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });

  it("rejects impossible or incorrectly shaped dates", () => {
    expect(() => reportWindow("day", "2026-02-31")).toThrow("Ngay bao cao khong hop le");
    expect(() => reportWindow("day", "2026-10")).toThrow("Ngay bao cao khong hop le");
    expect(() => reportWindow("month", "2026-13")).toThrow("Ngay bao cao khong hop le");
  });
});

describe("finance report revenue rows", () => {
  it("uses explicit gross, refund and net metrics without a legacy total alias", () => {
    expect(
      revenueCsvRows({
        capturedAmount: "250000",
        capturedCount: 4,
        refundedAmount: "50000",
        refundedCount: 1
      })
    ).toEqual([
      ["GROSS_REVENUE", 250000, 4],
      ["REFUNDED_REVENUE", 50000, 1],
      ["NET_REVENUE", 200000, 4]
    ]);
  });

  it("reports zero and negative net periods without hiding refund activity", () => {
    expect(
      revenueCsvRows({ capturedAmount: 0, capturedCount: 0, refundedAmount: 100000, refundedCount: 2 })
    ).toEqual([
      ["GROSS_REVENUE", 0, 0],
      ["REFUNDED_REVENUE", 100000, 2],
      ["NET_REVENUE", -100000, 0]
    ]);
  });
});
