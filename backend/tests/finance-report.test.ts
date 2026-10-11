import { describe, expect, it } from "vitest";
import { reportWindow } from "../src/modules/admin/finance-report.service";

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
