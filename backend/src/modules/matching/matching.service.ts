import { Prisma } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { emitAdmin, emitToUser, notifyRide } from "../../realtime/socket";
import { haversineDistanceKm } from "../../utils/geo";
import { refundCustomerWalletRide } from "../wallets/wallet.service";

const RADII_KM = [1, 3, 5] as const;
let processing = false;

export function matchingRadiusForWait(waitedSeconds: number) {
  return waitedSeconds < 30 ? RADII_KM[0] : waitedSeconds < 60 ? RADII_KM[1] : RADII_KM[2];
}

export function driverLocationCutoff(now = new Date(), maxAgeSeconds = env.driverLocationMaxAgeSeconds) {
  return new Date(now.getTime() - maxAgeSeconds * 1_000);
}

export function matchingCandidateWhere(
  vehicleTypeId: string,
  rideId: string,
  now = new Date(),
  maxLocationAgeSeconds = env.driverLocationMaxAgeSeconds
): Prisma.DriverProfileWhereInput {
  return {
    verificationStatus: "APPROVED",
    onlineStatus: "ONLINE",
    location: {
      is: {
        updatedAt: { gte: driverLocationCutoff(now, maxLocationAgeSeconds) }
      }
    },
    vehicles: {
      some: { vehicleTypeId, isActive: true, registrationStatus: "APPROVED" }
    },
    offers: { none: { rideId } }
  };
}

export async function activateScheduledRides() {
  const threshold = new Date(Date.now() + env.matchingLeadMinutes * 60_000);
  const scheduled = await prisma.ride.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: threshold } },
    select: { id: true, customerId: true }
  });
  for (const ride of scheduled) {
    const activated = await prisma.$transaction(async (tx) => {
      const changed = await tx.ride.updateMany({
        where: { id: ride.id, status: "SCHEDULED" },
        data: { status: "SEARCHING_DRIVER", matchingStartedAt: new Date() }
      });
      if (!changed.count) return false;
      await tx.rideStatusLog.create({
        data: {
          rideId: ride.id,
          fromStatus: "SCHEDULED",
          toStatus: "SEARCHING_DRIVER",
          note: `Bat dau dieu phoi truoc ${env.matchingLeadMinutes} phut`
        }
      });
      return true;
    });
    if (activated) {
      emitToUser(ride.customerId, "ride.matching.started", { rideId: ride.id });
      await dispatchRide(ride.id);
    }
  }
}

async function expirePendingOffers(rideId: string) {
  const expired = await prisma.driverOffer.findMany({
    where: { rideId, status: "PENDING", expiresAt: { lte: new Date() } },
    include: { driver: { select: { userId: true } } }
  });
  if (!expired.length) return;
  await prisma.driverOffer.updateMany({
    where: { id: { in: expired.map((offer) => offer.id) }, status: "PENDING" },
    data: { status: "EXPIRED", respondedAt: new Date() }
  });
  expired.forEach((offer) => emitToUser(offer.driver.userId, "ride.offer.expired", { rideId }));
}

export async function dispatchRide(rideId: string) {
  await expirePendingOffers(rideId);
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: { offers: true }
  });
  if (!ride || ride.status !== "SEARCHING_DRIVER" || ride.driverId) return;
  if (ride.offers.some((offer) => offer.status === "PENDING" && offer.expiresAt > new Date())) return;

  const candidates = await prisma.driverProfile.findMany({
    where: matchingCandidateWhere(ride.vehicleTypeId, rideId),
    include: { location: true, user: { select: { id: true } } }
  });

  const ranked = candidates
    .flatMap((driver) => {
      if (!driver.location) return [];
      const distanceKm = haversineDistanceKm(
        { lat: Number(ride.pickupLat), lng: Number(ride.pickupLng) },
        { lat: Number(driver.location.lat), lng: Number(driver.location.lng) }
      );
      return [{ driver, distanceKm }];
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const startedAt = ride.matchingStartedAt ?? ride.requestedAt;
  const waitedSeconds = (Date.now() - startedAt.getTime()) / 1000;
  const radiusKm = matchingRadiusForWait(waitedSeconds);
  const selected = ranked.find((candidate) => candidate.distanceKm <= radiusKm);
  if (!selected) {
    if (waitedSeconds >= env.matchingMaxWaitSeconds) {
      const changed = await prisma.$transaction(async (tx) => {
        const result = await tx.ride.updateMany({
          where: { id: rideId, status: "SEARCHING_DRIVER", driverId: null },
          data: { status: "NO_DRIVER_FOUND" }
        });
        if (!result.count) return false;
        await tx.rideStatusLog.create({
          data: {
            rideId,
            fromStatus: "SEARCHING_DRIVER",
            toStatus: "NO_DRIVER_FOUND",
            note: "Khong co tai xe trong ban kinh 5 km"
          }
        });
        await tx.promotionUsage.deleteMany({ where: { rideId } });
        await refundCustomerWalletRide(tx, rideId);
        return true;
      });
      if (changed) {
        await notifyRide(rideId, "ride.no-driver");
      }
    }
    return;
  }

  try {
    const offer = await prisma.driverOffer.create({
      data: {
        rideId,
        driverId: selected.driver.id,
        radiusKm,
        pickupDistanceKm: Number(selected.distanceKm.toFixed(2)),
        expiresAt: new Date(Date.now() + env.matchingOfferSeconds * 1_000)
      }
    });
    emitToUser(selected.driver.userId, "ride.request.created", {
      rideId,
      expiresAt: offer.expiresAt,
      pickupDistanceKm: Number(offer.pickupDistanceKm),
      radiusKm
    });
    emitToUser(ride.customerId, "ride.matching.updated", { rideId, radiusKm });
    emitAdmin();
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
  }
}

async function tick() {
  if (processing) return;
  processing = true;
  try {
    await activateScheduledRides();
    const rides = await prisma.ride.findMany({
      where: { status: "SEARCHING_DRIVER", driverId: null },
      select: { id: true },
      take: 50
    });
    for (const ride of rides) await dispatchRide(ride.id);
  } catch (error) {
    console.error("Ride matching worker failed", error);
  } finally {
    processing = false;
  }
}

export function startMatchingWorker() {
  void tick();
  const timer = setInterval(() => void tick(), 3_000);
  timer.unref();
  return () => clearInterval(timer);
}
