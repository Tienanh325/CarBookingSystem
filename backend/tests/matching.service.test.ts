import { describe, expect, it } from "vitest";
import { matchingRadiusForWait } from "../src/modules/matching/matching.service";
import { estimateSchema } from "../src/modules/pricing/pricing.schemas";

describe("smart driver matching", () => {
  it("expands the search radius after 30 and 60 seconds", () => {
    expect(matchingRadiusForWait(0)).toBe(1);
    expect(matchingRadiusForWait(29.9)).toBe(1);
    expect(matchingRadiusForWait(30)).toBe(3);
    expect(matchingRadiusForWait(59.9)).toBe(3);
    expect(matchingRadiusForWait(60)).toBe(5);
  });

  it("accepts at most two intermediate stops", () => {
    const point = { address: "A valid address", lat: 10.77, lng: 106.7 };
    const base = { pickup: point, dropoff: point, vehicleTypeId: "ce5c8e37-451d-4f5a-949e-f92fa2eb26b4" };
    expect(estimateSchema.safeParse({ ...base, stops: [point, point] }).success).toBe(true);
    expect(estimateSchema.safeParse({ ...base, stops: [point, point, point] }).success).toBe(false);
  });
});
