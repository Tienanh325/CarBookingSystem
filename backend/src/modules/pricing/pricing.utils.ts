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
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "0";
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    minuteOfDay: Number(value("hour")) * 60 + Number(value("minute")),
    dayOfWeek: weekdays[value("weekday")] ?? 0
  };
}

function isTimeMatch(rule: SurchargeRuleInput, minuteOfDay: number) {
  if (rule.startMinute === null || rule.endMinute === null) return true;
  if (rule.startMinute === rule.endMinute) return true;
  if (rule.startMinute < rule.endMinute) return minuteOfDay >= rule.startMinute && minuteOfDay < rule.endMinute;
  return minuteOfDay >= rule.startMinute || minuteOfDay < rule.endMinute;
}

export function calculateSurcharges(
  baseFare: number,
  rules: SurchargeRuleInput[],
  context: { at: Date; weatherCondition: string }
) {
  const { minuteOfDay, dayOfWeek } = localTimeParts(context.at);
  const applied = rules.filter((rule) => {
    const days = rule.daysOfWeek?.split(",").filter(Boolean).map(Number);
    if (days?.length && !days.includes(dayOfWeek)) return false;
    if (!isTimeMatch(rule, minuteOfDay)) return false;
    if (rule.type === "WEATHER") {
      const conditions = rule.weatherConditions?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
      if (!conditions.includes(context.weatherCondition)) return false;
    }
    return true;
  }).map((rule) => ({
    ruleId: rule.id,
    name: rule.name,
    type: rule.type,
    multiplier: rule.multiplier,
    fixedAmount: rule.fixedAmount,
    amount: Math.max(0, Math.round(baseFare * (rule.multiplier - 1) + rule.fixedAmount))
  })).filter((item) => item.amount > 0);

  return {
    amount: applied.reduce((sum, item) => sum + item.amount, 0),
    applied
  };
}
