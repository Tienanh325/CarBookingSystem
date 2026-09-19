import { describe, expect, it } from "vitest";
import { calculateFare } from "../src/modules/pricing/pricing.utils";

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
