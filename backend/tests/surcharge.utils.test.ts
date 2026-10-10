import { describe, expect, it } from "vitest";
import { calculateSurcharges, type SurchargeRuleInput } from "../src/modules/pricing/pricing.utils";

function rule(overrides: Partial<SurchargeRuleInput>): SurchargeRuleInput {
  return {
    id: "rule-1",
    name: "Rule",
    type: "PEAK_HOUR",
    multiplier: 1.2,
    fixedAmount: 0,
    startMinute: null,
    endMinute: null,
    daysOfWeek: null,
    weatherConditions: null,
    ...overrides
  };
}

describe("calculateSurcharges", () => {
  it("applies weekday peak hour in Ho Chi Minh City time", () => {
    const result = calculateSurcharges(100_000, [rule({ startMinute: 420, endMinute: 540, daysOfWeek: "1,2,3,4,5" })], {
      at: new Date("2026-10-12T00:30:00.000Z"),
      weatherCondition: "NORMAL"
    });
    expect(result.amount).toBe(20_000);
    expect(result.applied).toHaveLength(1);
  });

  it("supports a late-night range crossing midnight", () => {
    const result = calculateSurcharges(100_000, [rule({ type: "LATE_NIGHT", startMinute: 1320, endMinute: 300, multiplier: 1.15 })], {
      at: new Date("2026-10-11T16:30:00.000Z"),
      weatherCondition: "NORMAL"
    });
    expect(result.amount).toBe(15_000);
  });

  it("only applies weather rules matching the current condition", () => {
    const weatherRule = rule({ type: "WEATHER", weatherConditions: "RAIN,HEAVY_RAIN", multiplier: 1.25 });
    expect(calculateSurcharges(80_000, [weatherRule], { at: new Date(), weatherCondition: "NORMAL" }).amount).toBe(0);
    expect(calculateSurcharges(80_000, [weatherRule], { at: new Date(), weatherCondition: "RAIN" }).amount).toBe(20_000);
  });
});
