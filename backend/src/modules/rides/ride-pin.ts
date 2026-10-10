import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env";

export function rideStartPin(rideId: string) {
  const digest = createHmac("sha256", env.rideStartPinSecret).update(rideId).digest();
  return String(digest.readUInt32BE(0) % 10_000).padStart(4, "0");
}

export function verifyRideStartPin(rideId: string, candidate: string) {
  const expected = Buffer.from(rideStartPin(rideId));
  const received = Buffer.from(candidate);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
