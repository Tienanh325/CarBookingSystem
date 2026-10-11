import { describe, expect, it } from "vitest";
import { classifyProviderTransaction } from "../src/modules/payments/payment.service";

const base = {
  amount: 100_000,
  expectedAmount: 100_000,
  paidAt: new Date("2026-10-11T10:00:00.000Z"),
  expiresAt: new Date("2026-10-11T10:15:00.000Z"),
  referenceFound: true
};

describe("provider transaction classification", () => {
  it("classifies exact, underpaid and overpaid amounts", () => {
    expect(classifyProviderTransaction(base)).toBe("EXACT");
    expect(classifyProviderTransaction({ ...base, amount: 99_000 })).toBe("UNDERPAID");
    expect(classifyProviderTransaction({ ...base, amount: 101_000 })).toBe("OVERPAID");
  });

  it("classifies missing references, duplicates and expired transactions", () => {
    expect(classifyProviderTransaction({ ...base, referenceFound: false })).toBe("REFERENCE_NOT_FOUND");
    expect(classifyProviderTransaction({ ...base, alreadySettled: true })).toBe("DUPLICATE");
    expect(classifyProviderTransaction({ ...base, paidAt: new Date("2026-10-11T10:16:00.000Z") })).toBe(
      "EXPIRED"
    );
  });
});
