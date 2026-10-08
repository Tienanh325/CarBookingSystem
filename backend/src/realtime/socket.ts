import type http from "http";
import { Server } from "socket.io";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { authenticate } from "../modules/auth/auth.service";

let io: Server | undefined;
export function registerSocketServer(server: http.Server) {
  io = new Server(server, { cors: { origin: env.appOrigins, credentials: true } });
  io.use(async (socket, next) => {
    try { socket.data.auth = await authenticate(String(socket.handshake.auth.token ?? "")); next(); }
    catch { next(new Error("AUTH_INVALID_TOKEN")); }
  });
  io.on("connection", socket => {
    const auth = socket.data.auth as Awaited<ReturnType<typeof authenticate>>;
    socket.join("user:" + auth.userId);
    socket.join("session:" + auth.sessionId);
    if (auth.roles.includes("ADMIN")) socket.join("admins");
    // Recheck revocation/role changes periodically and expire the socket with its access token.
    const timer = setInterval(async () => {
      try { await authenticate(String(socket.handshake.auth.token)); }
      catch { socket.disconnect(true); }
    }, 15000);
    const expiry = setTimeout(() => socket.disconnect(true), Math.max(0, auth.expiresAt - Date.now()));
    socket.on("disconnect", () => { clearInterval(timer); clearTimeout(expiry); });
    socket.on("join:ride", async (id: unknown, ack?: (result: { success: boolean }) => void) => {
      try {
        const current = await authenticate(String(socket.handshake.auth.token));
        if (typeof id !== "string") throw new Error();
        const ride = await prisma.ride.findUnique({ where: { id }, include: { driver: true } });
        if (!ride || !(current.roles.includes("ADMIN") || ride.customerId === current.userId || ride.driver?.userId === current.userId)) throw new Error();
        await socket.join("ride:" + id);
        if (typeof ack === "function") ack({ success: true });
      } catch { if (typeof ack === "function") ack({ success: false }); }
    });
    socket.on("leave:ride", (id: string) => { if (typeof id === "string") socket.leave("ride:" + id); });
  });
  return io;
}
export function emitToUser(id: string, event: string, payload: unknown) { io?.to("user:" + id).emit(event, payload); }
export function emitToRide(id: string, event: string, payload: unknown) { io?.to("ride:" + id).emit(event, payload); }
export function emitAdmin() { io?.to("admins").emit("data.changed"); }
export async function notifyRide(id: string, event = "ride.status.changed") {
  const ride = await prisma.ride.findUnique({ where: { id }, include: { driver: true } });
  if (!ride) return;
  const payload = { rideId: id, status: ride.status };
  emitToUser(ride.customerId, event, payload);
  if (ride.driver) emitToUser(ride.driver.userId, event, payload);
  emitToRide(id, event, payload);
  // Only the driver holding the current persisted offer receives the request.
  const offers = await prisma.driverOffer.findMany({ where: { rideId: id, status: "PENDING" }, include: { driver: { select: { userId: true } } } });
  offers.forEach(offer => emitToUser(offer.driver.userId, "ride.requests.changed", { rideId: id }));
  emitAdmin();
}
export function revokeSockets(sessionId: string) { io?.in("session:" + sessionId).disconnectSockets(true); }
