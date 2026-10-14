import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL, apiRequest, refreshSession, saveSession, session } from "./api";
import type { AuthResult } from "../types";
const LiveContext = createContext<{
  auth: AuthResult | null;
  socket: Socket | null;
  connected: boolean;
  version: number;
}>({ auth: null, socket: null, connected: false, version: 0 });
export const useLive = () => useContext(LiveContext);
export function LiveProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState(session);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [version, setVersion] = useState(0);
  const accessToken = auth?.tokens.accessToken;
  useEffect(() => {
    const update = () => setAuth(session());
    window.addEventListener("session.changed", update);
    return () => window.removeEventListener("session.changed", update);
  }, []);
  useEffect(() => {
    if (!accessToken) {
      setSocket(null);
      setConnected(false);
      return;
    }
    const origin = API_URL.startsWith("http") ? new URL(API_URL).origin : window.location.origin;
    const client = io(origin, {
      auth: { token: accessToken },
      transports: ["websocket", "polling"]
    });
    setSocket(client);
    const changed = () => setVersion((n) => n + 1);
    client.on("connect", () => {
      setConnected(true);
      changed();
    });
    client.on("disconnect", (reason) => {
      setConnected(false);
      if (reason === "io server disconnect") void refreshSession().catch(() => saveSession(null));
    });
    client.on("connect_error", (error) => {
      setConnected(false);
      if (error.message === "AUTH_INVALID_TOKEN") void refreshSession().catch(() => saveSession(null));
    });
    [
      "data.changed",
      "ride.request.created",
      "ride.requests.changed",
      "ride.offer.expired",
      "ride.matching.started",
      "ride.matching.updated",
      "ride.scheduled",
      "ride.no-driver",
      "ride.accepted",
      "ride.status.changed",
      "ride.cancelled",
      "ride.driver-reassigned",
      "payment.updated",
      "wallet.updated",
      "notification.created"
    ].forEach((e) => client.on(e, changed));
    const timer = window.setInterval(changed, 30000);
    const renew = window.setInterval(() => void refreshSession().catch(() => {}), 10 * 60000);
    window.addEventListener("online", changed);
    return () => {
      client.disconnect();
      clearInterval(timer);
      clearInterval(renew);
      window.removeEventListener("online", changed);
    };
  }, [accessToken]);
  return <LiveContext.Provider value={{ auth, socket, connected, version }}>{children}</LiveContext.Provider>;
}
export function useResource<T>(path: string | null) {
  const { version } = useLive();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    if (!path) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const value = await apiRequest<T>(path);
      if (request === sequence.current) {
        setData(value);
        setError("");
      }
    } catch (e) {
      if (request === sequence.current) setError((e as Error).message);
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    setData(null);
  }, [path]);
  useEffect(() => {
    void reload();
    const sequenceRef = sequence;
    return () => {
      sequenceRef.current++;
    };
  }, [version, reload]);
  return { data, error, loading, reload, setData };
}
export function useRideRoom(id?: string) {
  const { socket } = useLive();
  useEffect(() => {
    if (!socket || !id) return;
    const join = () => socket.emit("join:ride", id);
    join();
    socket.on("connect", join);
    return () => {
      socket.emit("leave:ride", id);
      socket.off("connect", join);
    };
  }, [socket, id]);
}
