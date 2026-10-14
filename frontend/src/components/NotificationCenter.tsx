import { Bell, BellRing, CheckCheck } from "lucide-react";
import { useState } from "react";
import { apiRequest, mutate } from "../services/api";
import { useResource } from "../services/live";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  data?: { url?: string } | null;
};

type NotificationPage = {
  items: NotificationItem[];
  total: number;
  unread: number;
};

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function NotificationCenter() {
  const resource = useResource<NotificationPage>("/notifications?limit=10");
  const [open, setOpen] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function markRead(item: NotificationItem) {
    if (!item.readAt) await mutate(`/notifications/${item.id}/read`, {}, "PATCH");
    if (item.data?.url) window.location.assign(item.data.url);
    await resource.reload();
  }

  async function enablePush() {
    setPushBusy(true);
    setMessage("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Trình duyệt này không hỗ trợ push notification");
      }
      const config = await apiRequest<{ enabled: boolean; publicKey: string | null }>(
        "/notifications/push/config"
      );
      if (!config.enabled || !config.publicKey) throw new Error("Máy chủ chưa cấu hình push notification");
      const permission = await window.Notification.requestPermission();
      if (permission !== "granted") throw new Error("Bạn chưa cho phép trình duyệt gửi thông báo");
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(config.publicKey)
        }));
      await mutate("/notifications/push/subscriptions", subscription.toJSON());
      setMessage("Đã bật push notification trên thiết bị này");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <div className="notification-center">
      <button
        className="icon-button notification-trigger"
        type="button"
        aria-label={`Thông báo${resource.data?.unread ? `, ${resource.data.unread} chưa đọc` : ""}`}
        title="Thông báo"
        onClick={() => setOpen((value) => !value)}
      >
        {resource.data?.unread ? <BellRing size={18} /> : <Bell size={18} />}
        {!!resource.data?.unread && <span>{Math.min(resource.data.unread, 99)}</span>}
      </button>
      {open && (
        <section className="notification-panel" aria-label="Danh sách thông báo">
          <header>
            <div>
              <strong>Thông báo</strong>
              <small>{resource.data?.unread ?? 0} chưa đọc</small>
            </div>
            <button
              className="text-button"
              type="button"
              disabled={!resource.data?.unread}
              onClick={async () => {
                await mutate("/notifications/read-all");
                await resource.reload();
              }}
            >
              <CheckCheck size={16} /> Đọc tất cả
            </button>
          </header>
          <div className="notification-list">
            {resource.data?.items.map((item) => (
              <button
                type="button"
                className={item.readAt ? "notification-item" : "notification-item unread"}
                key={item.id}
                onClick={() => void markRead(item)}
              >
                <strong>{item.title}</strong>
                <span>{item.body}</span>
                <small>{new Date(item.createdAt).toLocaleString("vi-VN")}</small>
              </button>
            ))}
            {!resource.loading && !resource.data?.items.length && <p>Chưa có thông báo.</p>}
          </div>
          <footer>
            <button className="text-button" type="button" disabled={pushBusy} onClick={enablePush}>
              {pushBusy ? "Đang bật..." : "Bật push notification"}
            </button>
            {message && <small>{message}</small>}
          </footer>
        </section>
      )}
    </div>
  );
}
