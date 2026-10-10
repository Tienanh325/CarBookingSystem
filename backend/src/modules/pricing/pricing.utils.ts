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

export type SurchargeRuleInput = {
  id: string;
  name: string;
  type: "PEAK_HOUR" | "LATE_NIGHT" | "WEATHER" | "CUSTOM";
  multiplier: number;
  fixedAmount: number;
  startMinute: number | null;
  endMinute: number | null;
  daysOfWeek: string | null;
  weatherConditions: string | null;
};

function localTimeParts(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "0";
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    minuteOfDay: Number(value("hour")) * 60 + Number(value("minute")),
    dayOfWeek: weekdays[value("weekday")] ?? 0
  };
}

function isTimeMatch(rule: SurchargeRuleInput, minuteOfDay: number) {
  if (rule.startMinute === null || rule.endMinute === null) return true;
  if (rule.startMinute === rule.endMinute) return true;
  if (rule.startMinute < rule.endMinute)
    return minuteOfDay >= rule.startMinute && minuteOfDay < rule.endMinute;
  return minuteOfDay >= rule.startMinute || minuteOfDay < rule.endMinute;
}

export function calculateSurcharges(
  baseFare: number,
  rules: SurchargeRuleInput[],
  context: { at: Date; weatherCondition: string }
) {
  const { minuteOfDay, dayOfWeek } = localTimeParts(context.at);
  const applied = rules
    .filter((rule) => {
      const days = rule.daysOfWeek?.split(",").filter(Boolean).map(Number);
      if (days?.length && !days.includes(dayOfWeek)) return false;
      if (!isTimeMatch(rule, minuteOfDay)) return false;
      if (rule.type === "WEATHER") {
        const conditions =
          rule.weatherConditions
            ?.split(",")
            .map((item) => item.trim())
            .filter(Boolean) ?? [];
        if (!conditions.includes(context.weatherCondition)) return false;
      }
      return true;
    })
    .map((rule) => ({
      ruleId: rule.id,
      name: rule.name,
      type: rule.type,
      multiplier: rule.multiplier,
      fixedAmount: rule.fixedAmount,
      amount: Math.max(0, Math.round(baseFare * (rule.multiplier - 1) + rule.fixedAmount))
    }))
    .filter((item) => item.amount > 0);

  return {
    amount: applied.reduce((sum, item) => sum + item.amount, 0),
    applied
  };
}

export type PricingSnapshot = FareRule & {
  waitingFeePerMinute: number;
  waitingGraceMinutes: number;
};

export type AppliedSurcharge = {
  ruleId: string;
  name: string;
  type: string;
  multiplier: number;
  fixedAmount: number;
  amount?: number;
};

export function calculateFinalFare(input: {
  pricing: PricingSnapshot;
  distanceKm: number;
  durationMin: number;
  waitingMinutes: number;
  stopFee: number;
  discountAmount: number;
  surcharges: AppliedSurcharge[];
}) {
  const meteredFare = calculateFare(input.pricing, input.distanceKm, input.durationMin);
  const billableWaitingMinutes = Math.max(0, input.waitingMinutes - input.pricing.waitingGraceMinutes);
  const waitingFee = Math.round(billableWaitingMinutes * input.pricing.waitingFeePerMinute);
  const subtotal = meteredFare + input.stopFee + waitingFee;
  const surchargeBreakdown = input.surcharges
    .map((rule) => ({
      ...rule,
      amount: Math.max(0, Math.round(subtotal * (rule.multiplier - 1) + rule.fixedAmount))
    }))
    .filter((rule) => rule.amount > 0);
  const surchargeAmount = surchargeBreakdown.reduce((sum, rule) => sum + rule.amount, 0);
  const total = Math.max(0, subtotal + surchargeAmount - input.discountAmount);
  return {
    meteredFare,
    waitingFee,
    billableWaitingMinutes,
    subtotal,
    surchargeAmount,
    surchargeBreakdown,
    discountAmount: input.discountAmount,
    total: Math.round(total)
  };
}

export type TrackedPoint = { lat: number; lng: number; recordedAt: Date };

export function calculateTrackedDistance(points: TrackedPoint[], estimatedDistanceKm: number) {
  if (points.length < 2) return Number(estimatedDistanceKm.toFixed(2));
  const ordered = [...points].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  let distanceKm = 0;
  let acceptedSegments = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const seconds = (current.recordedAt.getTime() - previous.recordedAt.getTime()) / 1000;
    if (seconds <= 0) continue;
    const segment = haversineDistanceKm(previous, current);
    const speedKmh = segment / (seconds / 3600);
    if (segment > 5 || speedKmh > 160) continue;
    distanceKm += segment;
    acceptedSegments += 1;
  }
  if (!acceptedSegments || distanceKm < 0.1) return Number(estimatedDistanceKm.toFixed(2));
  // Limit extreme GPS drift while still allowing a meaningful detour.
  const lowerBound = estimatedDistanceKm * 0.7;
  const upperBound = estimatedDistanceKm * 2;
  return Number(Math.min(upperBound, Math.max(lowerBound, distanceKm)).toFixed(2));
}
import { haversineDistanceKm } from "../../utils/geo";
