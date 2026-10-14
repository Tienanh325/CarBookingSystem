import {
  LifeBuoy,
  MessageCircle,
  PhoneCall,
  Send,
  Share2,
  ShieldAlert,
  Trash2,
  UserRoundPlus,
  X
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { apiRequest, mutate } from "../services/api";
import { useLive, useResource } from "../services/live";
import type { Ride } from "../types";

type Contact = { id: string; name: string; relationship?: string; phone: string; isPrimary: boolean };
type Ticket = { id: string; ticketNo: string; subject: string; status: string; priority: string };
type Message = { id: string; body: string; createdAt: string; sender: { id: string; fullName: string } };

export function SafetyCenter() {
  const { auth, version } = useLive();
  const roles = auth?.user.roles ?? [];
  const scope = roles.includes("CUSTOMER") ? "customer" : roles.includes("DRIVER") ? "driver" : null;
  const current = useResource<Ride>(scope ? `/rides/current?as=${scope}` : null);
  const contacts = useResource<Contact[]>(scope ? "/safety/emergency-contacts" : null);
  const tickets = useResource<{ items: Ticket[] }>(scope ? "/support/tickets?limit=10" : null);
  const messages = useResource<Message[]>(
    current.data?.id ? `/safety/rides/${current.data.id}/messages` : null
  );
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  if (!scope) return null;

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setFeedback("");
    try {
      await action();
      if (success) setFeedback(success);
      await Promise.all([contacts.reload(), tickets.reload(), messages.reload()]);
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sos() {
    const position = await new Promise<GeolocationPosition | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 8000 });
    });
    await run(
      () =>
        mutate("/safety/sos", {
          rideId: current.data?.id,
          lat: position?.coords.latitude,
          lng: position?.coords.longitude,
          message: "Yêu cầu hỗ trợ khẩn cấp từ ứng dụng"
        }),
      "Đã gửi SOS đến đội vận hành."
    );
  }

  async function shareRide() {
    if (!current.data) return;
    setBusy(true);
    try {
      const result = await mutate<{ token: string }>(`/safety/rides/${current.data.id}/share`, {
        expiresInHours: 8
      });
      const url = `${window.location.origin}/share/${result.token}`;
      await navigator.clipboard.writeText(url);
      setFeedback("Đã sao chép link theo dõi chuyến (hiệu lực 8 giờ). ");
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function showMaskedContact() {
    if (!current.data) return;
    await run(async () => {
      const contact = await apiRequest<{ displayName: string; maskedNumber: string }>(
        `/safety/rides/${current.data!.id}/contact`
      );
      setFeedback(`${contact.displayName}: ${contact.maskedNumber} (số trung gian, không lộ số thật)`);
    }, "");
  }

  function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    void run(
      () => mutate("/safety/emergency-contacts", { ...values, isPrimary: Boolean(values.isPrimary) }),
      "Đã thêm liên hệ khẩn cấp."
    ).then(() => form.reset());
  }

  function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    void run(
      () =>
        mutate("/support/tickets", { ...values, rideId: current.data?.id || undefined, priority: "HIGH" }),
      "Đã tạo ticket hỗ trợ."
    ).then(() => form.reset());
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current.data) return;
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "");
    void run(() => mutate(`/safety/rides/${current.data!.id}/messages`, { body }), "").then(() =>
      form.reset()
    );
  }

  return (
    <div className="safety-center" data-version={version}>
      <button
        className="icon-button safety-trigger"
        type="button"
        onClick={() => setOpen(true)}
        title="An toàn và hỗ trợ"
      >
        <ShieldAlert size={19} />
      </button>
      {open && (
        <div className="safety-backdrop" role="dialog" aria-modal="true" aria-label="An toàn và hỗ trợ">
          <section className="safety-panel">
            <header>
              <div>
                <ShieldAlert size={22} />
                <strong>An toàn & hỗ trợ</strong>
              </div>
              <button className="icon-button" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <div className="safety-actions">
              <button className="danger-button" disabled={busy} onClick={() => void sos()}>
                <ShieldAlert size={18} /> Gửi SOS
              </button>
              <button disabled={!current.data || busy} onClick={() => void shareRide()}>
                <Share2 size={18} /> Chia sẻ chuyến
              </button>
              <button disabled={!current.data || busy} onClick={() => void showMaskedContact()}>
                <PhoneCall size={18} /> Liên hệ đã che số
              </button>
            </div>
            {feedback && <p className="safety-feedback">{feedback}</p>}
            <details open>
              <summary>
                <UserRoundPlus size={17} /> Liên hệ khẩn cấp
              </summary>
              <div className="compact-list">
                {contacts.data?.map((contact) => (
                  <div key={contact.id}>
                    <span>
                      <strong>{contact.name}</strong>
                      <small>
                        {contact.relationship} · {contact.phone}
                      </small>
                    </span>
                    <button
                      className="icon-button"
                      onClick={() =>
                        void run(
                          () => mutate(`/safety/emergency-contacts/${contact.id}`, {}, "DELETE"),
                          "Đã xóa liên hệ."
                        )
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <form className="compact-form" onSubmit={addContact}>
                <input name="name" placeholder="Tên liên hệ" required minLength={2} />
                <input name="relationship" placeholder="Quan hệ" />
                <input name="phone" placeholder="Số điện thoại" required minLength={9} />
                <label>
                  <input name="isPrimary" type="checkbox" /> Liên hệ chính
                </label>
                <button disabled={busy}>Thêm</button>
              </form>
            </details>
            {current.data && (
              <details open>
                <summary>
                  <MessageCircle size={17} /> Chat chuyến hiện tại
                </summary>
                <div className="chat-list">
                  {messages.data?.map((message) => (
                    <div key={message.id}>
                      <strong>{message.sender.fullName}</strong>
                      <span>{message.body}</span>
                    </div>
                  ))}
                </div>
                <form className="chat-compose" onSubmit={sendMessage}>
                  <input name="body" placeholder="Nhắn cho người cùng chuyến" required maxLength={1000} />
                  <button disabled={busy}>
                    <Send size={17} />
                  </button>
                </form>
              </details>
            )}
            <details>
              <summary>
                <LifeBuoy size={17} /> Ticket hỗ trợ
              </summary>
              <div className="compact-list">
                {tickets.data?.items.map((ticket) => (
                  <div key={ticket.id}>
                    <span>
                      <strong>
                        {ticket.ticketNo} · {ticket.subject}
                      </strong>
                      <small>
                        {ticket.status} · {ticket.priority}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
              <form className="compact-form" onSubmit={createTicket}>
                <input name="subject" placeholder="Chủ đề" required minLength={3} />
                <textarea name="description" placeholder="Mô tả vấn đề" required minLength={5} />
                <button disabled={busy}>Gửi ticket</button>
              </form>
            </details>
          </section>
        </div>
      )}
    </div>
  );
}
