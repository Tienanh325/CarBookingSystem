import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";
import { calculateFare } from "./pricing.utils";
import { validatePromotionForFare } from "../promotions/promotion.service";
import { getRoadRoute } from "../../integrations/routing.service";

function asNumber(value: unknown) {
  return Number(value);
}

export async function estimateRide(input: {
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  stops?: { address: string; lat: number; lng: number; dwellMinutes?: number }[];
  vehicleTypeId: string;
  promotionCode?: string;
  scheduledAt?: Date;
}, userId?: string, db: Prisma.TransactionClient = prisma as unknown as Prisma.TransactionClient) {
  const vehicleType = await db.vehicleType.findUnique({
    where: { id: input.vehicleTypeId }
  });

  if (!vehicleType || !vehicleType.isActive) {
    throw new ApiError(404, "VEHICLE_TYPE_NOT_FOUND", "Khong tim thay loai xe");
  }

  const now = new Date();
  const pricingRule = await db.pricingRule.findFirst({
    where: {
      vehicleTypeId: input.vehicleTypeId,
      isActive: true,
      activeFrom: { lte: now },
      OR: [{ activeTo: null }, { activeTo: { gte: now } }]
    },
    orderBy: { activeFrom: "desc" }
  });

  const stops = input.stops ?? [];
  const route = await getRoadRoute([input.pickup, ...stops, input.dropoff], input.scheduledAt);
  const distanceKm = Math.max(1, route.distanceKm);
  const dwellMinutes = stops.reduce((sum, stop) => sum + (stop.dwellMinutes ?? 5), 0);
  const durationMin = route.durationMin + dwellMinutes;

  const rule = pricingRule
    ? {
        baseFare: asNumber(pricingRule.baseFare),
        perKmFare: asNumber(pricingRule.perKmFare),
        perMinuteFare: asNumber(pricingRule.perMinuteFare),
        minimumFare: asNumber(pricingRule.minimumFare),
        peakMultiplier: asNumber(pricingRule.peakMultiplier)
      }
    : {
        baseFare: asNumber(vehicleType.baseFare),
        perKmFare: asNumber(vehicleType.perKmFare),
        perMinuteFare: asNumber(vehicleType.perMinuteFare),
        minimumFare: asNumber(vehicleType.baseFare),
        peakMultiplier: 1
      };

  const stopFee = Math.round(stops.reduce(
    (sum, stop) => sum + (stop.dwellMinutes ?? 5) * Number(pricingRule?.waitingFeePerMinute ?? 0),
    0
  ));
  const estimatedFare = calculateFare(rule, distanceKm, route.durationMin) + stopFee;
  let discount = 0;
  let promotionId: string | undefined;
  let finalFare = estimatedFare;

  if (input.promotionCode) {
    const promotion = await validatePromotionForFare(input.promotionCode, estimatedFare, userId, db);
    discount = promotion.discount;
    promotionId = promotion.promotion.id;
    finalFare = promotion.finalFare;
  }

  return {
    vehicleType,
    distanceKm: Number(distanceKm.toFixed(2)),
    durationMin,
    estimatedFare,
    discount,
    finalFare,
    promotionId,
    stopFee,
    routeGeometry: route.geometry,
    routeProvider: route.provider,
    trafficAware: route.trafficAware,
    legs: route.legs
  };
}

export async function listPricingRules() {
  return prisma.pricingRule.findMany({
    include: { vehicleType: true },
    orderBy: { createdAt: "desc" }
  });
}

export async function createPricingRule(input: {
  vehicleTypeId: string;
  baseFare: number;
  perKmFare: number;
  perMinuteFare: number;
  minimumFare: number;
  waitingFeePerMinute?: number;
  peakMultiplier?: number;
  activeFrom?: Date;
  activeTo?: Date | null;
  isActive?: boolean;
}) {
  return prisma.pricingRule.create({
    data: {
      ...input,
      waitingFeePerMinute: input.waitingFeePerMinute ?? 0,
      peakMultiplier: input.peakMultiplier ?? 1,
      activeFrom: input.activeFrom ?? new Date(),
      isActive: input.isActive ?? true
    }
  });
}

export async function updatePricingRule(id: string, input: Parameters<typeof createPricingRule>[0]) {
  return prisma.pricingRule.update({
    where: { id },
    data: input
  });
}
