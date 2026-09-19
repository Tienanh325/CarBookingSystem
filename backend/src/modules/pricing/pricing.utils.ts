export type FareRule = {
  baseFare: number;
  perKmFare: number;
  perMinuteFare: number;
  minimumFare: number;
  peakMultiplier?: number;
};

export function calculateFare(rule: FareRule, distanceKm: number, durationMin: number) {
  const rawFare =
    (rule.baseFare + rule.perKmFare * distanceKm + rule.perMinuteFare * durationMin) *
    (rule.peakMultiplier ?? 1);

  return Math.max(Math.round(rawFare), rule.minimumFare);
}
