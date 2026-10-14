import { createHash, createHmac, randomBytes } from "node:crypto";
import type { RoleName } from "../../utils/roles";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";
import { createNotification } from "../notifications/notification.service";
import { emitAdmin, emitToRide } from "../../realtime/socket";

const staffRoles: RoleName[] = ["ADMIN", "OPERATOR", "SUPPORT"];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

async function rideAccess(rideId: string, userId: string, roles: RoleName[], staff = false) {
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: {
      customer: { select: { id: true, fullName: true, phone: true } },
      driver: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
      vehicleType: true
    }
  });
  if (!ride) throw new ApiError(404, "RIDE_NOT_FOUND", "Khong tim thay chuyen di");
  const participant = ride.customerId === userId || ride.driver?.userId === userId;
  if (!participant && !(staff && roles.some((role) => staffRoles.includes(role)))) {
    throw new ApiError(403, "RIDE_ACCESS_DENIED", "Khong co quyen truy cap chuyen di");
  }
  return ride;
}

export function listEmergencyContacts(userId: string) {
  return prisma.emergencyContact.findMany({
    where: { userId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
  });
}

export async function createEmergencyContact(
  userId: string,
  input: { name: string; relationship?: string; phone: string; isPrimary: boolean }
) {
  return prisma.$transaction(async (tx) => {
    if (input.isPrimary)
      await tx.emergencyContact.updateMany({ where: { userId }, data: { isPrimary: false } });
    return tx.emergencyContact.create({ data: { userId, ...input } });
  });
}

export async function deleteEmergencyContact(userId: string, id: string) {
  const deleted = await prisma.emergencyContact.deleteMany({ where: { id, userId } });
  if (!deleted.count)
    throw new ApiError(404, "EMERGENCY_CONTACT_NOT_FOUND", "Khong tim thay lien he khan cap");
  return { deleted: true };
}

export async function createSos(
  userId: string,
  roles: RoleName[],
  input: { rideId?: string; lat?: number; lng?: number; message?: string }
) {
  if (input.rideId) await rideAccess(input.rideId, userId, roles);
  const alert = await prisma.sosAlert.create({ data: { userId, ...input } });
  const responders = await prisma.user.findMany({
    where: { status: "ACTIVE", roles: { some: { role: { name: { in: staffRoles } } } } },
    select: { id: true }
  });
  await Promise.all(
    responders.map((responder) =>
      createNotification({
        userId: responder.id,
        title: "Cảnh báo SOS mới",
        body: input.message || "Một người dùng vừa kích hoạt SOS.",
        data: { sosId: alert.id, rideId: input.rideId ?? null, url: "/admin" },
        push: true
      })
    )
  );
  emitAdmin();
  if (input.rideId) emitToRide(input.rideId, "safety.sos.created", alert);
  return alert;
}

export async function listSos(query: {
  status?: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  page: number;
  limit: number;
}) {
  const where = query.status ? { status: query.status } : {};
  const [items, total] = await Promise.all([
    prisma.sosAlert.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true } },
        ride: true,
        resolvedBy: { select: { id: true, fullName: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    }),
    prisma.sosAlert.count({ where })
  ]);
  return { items, total, page: query.page, limit: query.limit };
}

export async function updateSosStatus(id: string, status: "ACKNOWLEDGED" | "RESOLVED", actorId: string) {
  const current = await prisma.sosAlert.findUnique({ where: { id } });
  if (!current) throw new ApiError(404, "SOS_NOT_FOUND", "Khong tim thay canh bao SOS");
  if (current.status === "RESOLVED") throw new ApiError(409, "SOS_ALREADY_RESOLVED", "SOS da duoc xu ly");
  const alert = await prisma.sosAlert.update({
    where: { id },
    data: {
      status,
      resolvedById: actorId,
      resolvedAt: status === "RESOLVED" ? new Date() : null
    }
  });
  await createNotification({
    userId: alert.userId,
    title: status === "RESOLVED" ? "SOS đã được xử lý" : "SOS đã được tiếp nhận",
    body:
      status === "RESOLVED"
        ? "Đội hỗ trợ đã kết thúc xử lý cảnh báo."
        : "Đội hỗ trợ đang xử lý cảnh báo của bạn.",
    data: { sosId: id },
    push: true
  });
  emitAdmin();
  return alert;
}

export async function createRideShare(
  rideId: string,
  userId: string,
  roles: RoleName[],
  expiresInHours: number
) {
  await rideAccess(rideId, userId, roles);
  const token = randomBytes(32).toString("base64url");
  const link = await prisma.rideShareLink.create({
    data: {
      rideId,
      createdById: userId,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + expiresInHours * 60 * 60_000)
    }
  });
  return { id: link.id, token, expiresAt: link.expiresAt };
}

export async function getSharedRide(token: string) {
  const link = await prisma.rideShareLink.findUnique({
    where: { tokenHash: hash(token) },
    include: {
      ride: {
        include: {
          driver: {
            include: {
              user: { select: { fullName: true } },
              vehicles: { where: { isActive: true }, take: 1 }
            }
          },
          vehicleType: true,
          locationPoints: {
            orderBy: { recordedAt: "desc" },
            take: 1,
            select: { lat: true, lng: true, recordedAt: true }
          }
        }
      }
    }
  });
  if (!link || link.revokedAt || link.expiresAt <= new Date()) {
    throw new ApiError(404, "RIDE_SHARE_NOT_FOUND", "Lien ket chia se khong ton tai hoac da het han");
  }
  const ride = link.ride;
  return {
    rideId: ride.id,
    status: ride.status,
    pickupAddress: ride.pickupAddress,
    dropoffAddress: ride.dropoffAddress,
    vehicleType: ride.vehicleType.name,
    driver: ride.driver
      ? { fullName: ride.driver.user.fullName, plateNumber: ride.driver.vehicles[0]?.plateNumber ?? null }
      : null,
    latestLocation: ride.locationPoints[0] ?? null,
    updatedAt: ride.updatedAt,
    expiresAt: link.expiresAt
  };
}

export async function listRideMessages(rideId: string, userId: string, roles: RoleName[]) {
  await rideAccess(rideId, userId, roles, true);
  return prisma.rideMessage.findMany({
    where: { rideId },
    include: { sender: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "asc" },
    take: 200
  });
}

export async function sendRideMessage(rideId: string, userId: string, roles: RoleName[], body: string) {
  const ride = await rideAccess(rideId, userId, roles, true);
  const message = await prisma.rideMessage.create({
    data: { rideId, senderId: userId, body },
    include: { sender: { select: { id: true, fullName: true } } }
  });
  emitToRide(rideId, "ride.message.created", message);
  const recipients = [ride.customerId, ride.driver?.userId].filter((id): id is string =>
    Boolean(id && id !== userId)
  );
  await Promise.all(
    recipients.map((recipient) =>
      createNotification({
        userId: recipient,
        title: "Tin nhắn chuyến đi mới",
        body,
        data: { rideId, url: recipient === ride.customerId ? "/customer" : "/driver" },
        push: true
      })
    )
  );
  return message;
}

function maskedNumber(rideId: string, userId: string) {
  const digits = createHmac("sha256", env.phoneMaskingSecret)
    .update(`${rideId}:${userId}`)
    .digest("hex")
    .replace(/[^0-9]/g, "")
    .padEnd(7, "0")
    .slice(0, 7);
  return `1900${digits}`;
}

export async function rideContact(rideId: string, userId: string, roles: RoleName[]) {
  const ride = await rideAccess(rideId, userId, roles, true);
  if (ride.customerId === userId && ride.driver) {
    return { displayName: ride.driver.user.fullName, maskedNumber: maskedNumber(rideId, ride.driver.userId) };
  }
  if (ride.driver?.userId === userId) {
    return { displayName: ride.customer.fullName, maskedNumber: maskedNumber(rideId, ride.customerId) };
  }
  return {
    customer: { displayName: ride.customer.fullName, maskedNumber: maskedNumber(rideId, ride.customerId) },
    driver: ride.driver
      ? { displayName: ride.driver.user.fullName, maskedNumber: maskedNumber(rideId, ride.driver.userId) }
      : null
  };
}
