import type http from "http";
import { Server } from "socket.io";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { authenticate } from "../modules/auth/auth.service";
import { createStoredNotification } from "../modules/notifications/notification.delivery";

let io: Server | undefined;
export function registerSocketServer(server: http.Server) {
  io = new Server(server, { cors: { origin: env.appOrigins, credentials: true } });
  io.use(async (socket, next) => {
    try {
      socket.data.auth = await authenticate(String(socket.handshake.auth.token ?? ""));
      next();
    } catch {
      next(new Error("AUTH_INVALID_TOKEN"));
    }
  });
  io.on("connection", (socket) => {
    const auth = socket.data.auth as Awaited<ReturnType<typeof authenticate>>;
    socket.join("user:" + auth.userId);
    socket.join("session:" + auth.sessionId);
    if (auth.roles.includes("ADMIN")) socket.join("admins");
    // Recheck revocation/role changes periodically and expire the socket with its access token.
    const timer = setInterval(async () => {
      try {
        await authenticate(String(socket.handshake.auth.token));
      } catch {
        socket.disconnect(true);
      }
    }, 15000);
    const expiry = setTimeout(() => socket.disconnect(true), Math.max(0, auth.expiresAt - Date.now()));
    socket.on("disconnect", () => {
      clearInterval(timer);
      clearTimeout(expiry);
    });
    socket.on("join:ride", async (id: unknown, ack?: (result: { success: boolean }) => void) => {
      try {
        const current = await authenticate(String(socket.handshake.auth.token));
        if (typeof id !== "string") throw new Error();
        const ride = await prisma.ride.findUnique({ where: { id }, include: { driver: true } });
        if (
          !ride ||
          !(
            current.roles.includes("ADMIN") ||
            ride.customerId === current.userId ||
            ride.driver?.userId === current.userId
          )
        )
          throw new Error();
        await socket.join("ride:" + id);
        if (typeof ack === "function") ack({ success: true });
      } catch {
        if (typeof ack === "function") ack({ success: false });
      }
    });
    socket.on("leave:ride", (id: string) => {
      if (typeof id === "string") socket.leave("ride:" + id);
    });
  });
  return io;
}
export function emitToUser(id: string, event: string, payload: unknown) {
  io?.to("user:" + id).emit(event, payload);
}
export function emitToRide(id: string, event: string, payload: unknown) {
  io?.to("ride:" + id).emit(event, payload);
}
export function emitAdmin() {
  io?.to("admins").emit("data.changed");
}
export async function notifyRide(id: string, event = "ride.status.changed") {
  const ride = await prisma.ride.findUnique({ where: { id }, include: { driver: true } });
  if (!ride) return;
  const payload = { rideId: id, status: ride.status };
  emitToUser(ride.customerId, event, payload);
  if (ride.driver) emitToUser(ride.driver.userId, event, payload);
  emitToRide(id, event, payload);
  const notificationCopy: Partial<Record<typeof ride.status, { title: string; body: string }>> = {
    SCHEDULED: { title: "Đã đặt lịch chuyến đi", body: "Chuyến đi của bạn đã được lên lịch." },
    ACCEPTED: { title: "Tài xế đã nhận chuyến", body: "Tài xế đang chuẩn bị đến điểm đón." },
    DRIVER_ARRIVING: { title: "Tài xế đang đến", body: "Vui lòng sẵn sàng tại điểm đón." },
    ARRIVED: { title: "Tài xế đã đến", body: "Tài xế đang chờ tại điểm đón." },
    IN_PROGRESS: { title: "Chuyến đi đã bắt đầu", body: "Chúc bạn có một chuyến đi an toàn." },
    COMPLETED: { title: "Chuyến đi hoàn thành", body: "Cảm ơn bạn đã sử dụng GoRide." },
    CANCELLED_BY_CUSTOMER: { title: "Chuyến đi đã hủy", body: "Chuyến đi đã được khách hàng hủy." },
    CANCELLED_BY_DRIVER: { title: "Chuyến đi đã hủy", body: "Chuyến đi đã được tài xế hủy." },
    CANCELLED_BY_SYSTEM: { title: "Chuyến đi đã hủy", body: "Chuyến đi đã được hệ thống hủy." },
    NO_DRIVER_FOUND: { title: "Chưa tìm thấy tài xế", body: "Hiện chưa có tài xế phù hợp cho chuyến đi." }
  };
  const copy = notificationCopy[ride.status];
  if (copy && event !== "ride.matching.updated") {
    const notifications = await Promise.all([
      createStoredNotification({
        userId: ride.customerId,
        ...copy,
        data: { rideId: id, url: "/customer" },
        push: true
      }),
      ...(ride.driver
        ? [
            createStoredNotification({
              userId: ride.driver.userId,
              ...copy,
              data: { rideId: id, url: "/driver" },
              push: true
            })
          ]
        : [])
    ]);
    notifications.forEach((notification) =>
      emitToUser(notification.userId, "notification.created", notification)
    );
  }
  // Only the driver holding the current persisted offer receives the request.
  const offers = await prisma.driverOffer.findMany({
    where: { rideId: id, status: "PENDING" },
    include: { driver: { select: { userId: true } } }
  });
  offers.forEach((offer) => emitToUser(offer.driver.userId, "ride.requests.changed", { rideId: id }));
  emitAdmin();
}
export function revokeSockets(sessionId: string) {
  io?.in("session:" + sessionId).disconnectSockets(true);
}
