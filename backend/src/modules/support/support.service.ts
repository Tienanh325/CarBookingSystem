import { randomBytes } from "node:crypto";
import type { RoleName } from "../../utils/roles";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/api-error";
import { createNotification } from "../notifications/notification.service";
import { emitAdmin, emitToUser } from "../../realtime/socket";

const staff = (roles: RoleName[]) => roles.some((role) => ["ADMIN", "SUPPORT"].includes(role));

async function driverIdFor(userId: string) {
  return (await prisma.driverProfile.findUnique({ where: { userId }, select: { id: true } }))?.id;
}

async function accessibleTicket(id: string, userId: string, roles: RoleName[]) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, fullName: true } },
      driver: { include: { user: { select: { id: true, fullName: true } } } },
      assignedTo: { select: { id: true, fullName: true } },
      messages: {
        include: { sender: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "asc" }
      }
    }
  });
  if (!ticket) throw new ApiError(404, "TICKET_NOT_FOUND", "Khong tim thay ticket");
  const owns = ticket.customerId === userId || ticket.driver?.userId === userId;
  if (!owns && !staff(roles)) throw new ApiError(403, "TICKET_ACCESS_DENIED", "Khong co quyen xem ticket");
  return ticket;
}

export async function createTicket(
  userId: string,
  roles: RoleName[],
  input: {
    rideId?: string;
    subject: string;
    description: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  }
) {
  const driverId = roles.includes("DRIVER") ? await driverIdFor(userId) : undefined;
  if (input.rideId) {
    const ride = await prisma.ride.findUnique({ where: { id: input.rideId }, include: { driver: true } });
    if (!ride || (ride.customerId !== userId && ride.driver?.userId !== userId)) {
      throw new ApiError(403, "RIDE_ACCESS_DENIED", "Khong co quyen tao ticket cho chuyen nay");
    }
  }
  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNo: `TK-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`,
      rideId: input.rideId,
      customerId: roles.includes("CUSTOMER") ? userId : undefined,
      driverId,
      subject: input.subject,
      description: input.description,
      priority: input.priority,
      messages: { create: { senderId: userId, body: input.description } }
    },
    include: { messages: true }
  });
  emitAdmin();
  return ticket;
}

export async function listOwnTickets(
  userId: string,
  roles: RoleName[],
  query: { page: number; limit: number }
) {
  const driverId = roles.includes("DRIVER") ? await driverIdFor(userId) : undefined;
  const where = { OR: [{ customerId: userId }, ...(driverId ? [{ driverId }] : [])] };
  const [items, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    }),
    prisma.supportTicket.count({ where })
  ]);
  return { items, total, page: query.page, limit: query.limit };
}

export const getTicket = accessibleTicket;

export async function addTicketMessage(id: string, userId: string, roles: RoleName[], body: string) {
  const ticket = await accessibleTicket(id, userId, roles);
  if (ticket.status === "CLOSED") throw new ApiError(409, "TICKET_CLOSED", "Ticket da dong");
  const message = await prisma.ticketMessage.create({
    data: { ticketId: id, senderId: userId, body },
    include: { sender: { select: { id: true, fullName: true } } }
  });
  const recipientIds = [ticket.customerId, ticket.driver?.userId, ticket.assignedToId].filter(
    (value): value is string => Boolean(value && value !== userId)
  );
  await Promise.all(
    [...new Set(recipientIds)].map((recipient) =>
      createNotification({
        userId: recipient,
        title: `Phản hồi ticket ${ticket.ticketNo}`,
        body,
        data: { ticketId: id },
        push: true
      })
    )
  );
  emitToUser(userId, "support.ticket.updated", { ticketId: id });
  emitAdmin();
  return message;
}

export async function listAllTickets(query: {
  status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  page: number;
  limit: number;
}) {
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {})
  };
  const [items, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: {
        customer: { select: { id: true, fullName: true } },
        driver: { include: { user: { select: { id: true, fullName: true } } } },
        assignedTo: { select: { id: true, fullName: true } }
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit
    }),
    prisma.supportTicket.count({ where })
  ]);
  return { items, total, page: query.page, limit: query.limit };
}

export async function updateTicket(
  id: string,
  actorId: string,
  input: {
    status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    assignedToId?: string | null;
    resolution?: string | null;
  }
) {
  const current = await prisma.supportTicket.findUnique({ where: { id }, include: { driver: true } });
  if (!current) throw new ApiError(404, "TICKET_NOT_FOUND", "Khong tim thay ticket");
  const ticket = await prisma.$transaction(async (tx) => {
    const updated = await tx.supportTicket.update({ where: { id }, data: input });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "SUPPORT_TICKET_UPDATED",
        entityType: "SUPPORT_TICKET",
        entityId: id,
        metadata: input
      }
    });
    return updated;
  });
  const ownerId = current.customerId ?? (current.driverId ? current.driver?.userId : null);
  if (ownerId) {
    await createNotification({
      userId: ownerId,
      title: `Ticket ${current.ticketNo} đã cập nhật`,
      body: input.status ? `Trạng thái mới: ${input.status}` : "Đội hỗ trợ vừa cập nhật ticket.",
      data: { ticketId: id },
      push: true
    });
  }
  emitAdmin();
  return ticket;
}
