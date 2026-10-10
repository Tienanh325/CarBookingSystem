import { describe, expect, it } from "vitest";
import { rideStartPin, verifyRideStartPin } from "../src/modules/rides/ride-pin";

describe("ride start PIN", () => {
  it("is stable, four digits and ride-specific", () => {
    const pin = rideStartPin("550e8400-e29b-41d4-a716-446655440000");
    expect(pin).toMatch(/^\d{4}$/);
    expect(rideStartPin("550e8400-e29b-41d4-a716-446655440000")).toBe(pin);
    expect(rideStartPin("550e8400-e29b-41d4-a716-446655440001")).not.toBe(pin);
  });

  it("rejects an incorrect PIN", () => {
    const rideId = "550e8400-e29b-41d4-a716-446655440000";
    expect(verifyRideStartPin(rideId, rideStartPin(rideId))).toBe(true);
    expect(verifyRideStartPin(rideId, "9999")).toBe(false);
  });
});
