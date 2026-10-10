import { describe, expect, it } from "vitest";
import {
  calculateFare,
  calculateFinalFare,
  calculateTrackedDistance
} from "../src/modules/pricing/pricing.utils";

describe("calculateFare", () => {
  it("uses distance, time and minimum fare", () => {
    const fare = calculateFare(
      {
        baseFare: 12000,
        perKmFare: 4500,
        perMinuteFare: 800,
        minimumFare: 15000
      },
      3,
      10
    );

    expect(fare).toBe(33500);
  });

  it("never returns less than minimum fare", () => {
    const fare = calculateFare(
      {
        baseFare: 5000,
        perKmFare: 1000,
        perMinuteFare: 100,
        minimumFare: 15000
      },
      1,
      1
    );

    expect(fare).toBe(15000);
  });
});

describe("calculateFinalFare", () => {
  it("uses actual metrics, waiting grace, surcharge snapshot and discount", () => {
    const fare = calculateFinalFare({
      pricing: {
        baseFare: 10_000,
        perKmFare: 5_000,
        perMinuteFare: 500,
        minimumFare: 10_000,
        peakMultiplier: 1,
        waitingFeePerMinute: 2_000,
        waitingGraceMinutes: 5
      },
      distanceKm: 10,
      durationMin: 30,
      waitingMinutes: 8,
      stopFee: 5_000,
      discountAmount: 10_000,
      surcharges: [{ ruleId: "peak", name: "Peak", type: "PEAK_HOUR", multiplier: 1.2, fixedAmount: 0 }]
    });
    expect(fare.meteredFare).toBe(75_000);
    expect(fare.waitingFee).toBe(6_000);
    expect(fare.surchargeAmount).toBe(17_200);
    expect(fare.total).toBe(93_200);
  });

  it("falls back to estimated distance when GPS points are insufficient", () => {
    expect(calculateTrackedDistance([{ lat: 10.7, lng: 106.7, recordedAt: new Date() }], 8.25)).toBe(8.25);
  });
});
