import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Banknote,
  CarFront,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Download,
  Eye,
  LayoutDashboard,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Route,
  Search,
  Tags,
  UsersRound,
  Wallet
} from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Feedback, Modal, RideDetails } from "../components/LiveUI";
import { StatusBadge } from "../components/StatusBadge";
import { apiRequest, downloadFile, mutate } from "../services/api";
import { useLive, useResource } from "../services/live";
import { canAccessAdminSection, canPerformAdminAction, type AdminSection } from "../services/rbac";
import {
  date,
  labels,
  money,
  type Driver,
  type Page,
  type Pricing,
  type Promotion,
  type ReconciliationItem,
  type ReconciliationRun,
  type RefundRequest,
  type Ride,
  type User,
  type VehicleType,
  type Withdrawal
} from "../types";

const menus = [
  { id: "overview", name: "Tổng quan", icon: LayoutDashboard },
  { id: "rides", name: "Chuyến đi", icon: Route },
  { id: "drivers", name: "Tài xế", icon: CarFront },
  { id: "pricing", name: "Bảng giá", icon: Wallet },
  { id: "surcharges", name: "Phụ phí", icon: CloudRain },
  { id: "promotions", name: "Khuyến mãi", icon: Tags },
  { id: "users", name: "Tài khoản", icon: UsersRound },
  { id: "payments", name: "Thanh toán", icon: Wallet },
  { id: "withdrawals", name: "Rút tiền", icon: Banknote },
  { id: "refunds", name: "Hoàn tiền", icon: RotateCcw },
  { id: "reconciliation", name: "Đối soát", icon: RefreshCw },
  { id: "reports", name: "Báo cáo CSV", icon: Download }
] as const;
const noRoles: readonly string[] = [];

function vietnamToday() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function Badge({ status }: { status: string }) {
  return (
    <StatusBadge
      tone={
        ["COMPLETED", "APPROVED", "PAID", "ACTIVE"].includes(status)
          ? "success"
          : status.includes("CANCEL") || ["REJECTED", "LOCKED"].includes(status)
            ? "danger"
            : "info"
      }
    >
      {labels[status] ?? status}
    </StatusBadge>
  );
}
function IconAction({
  label,
  onClick,
  children
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button className="icon-button subtle" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}
function Pager({ page, total, change }: { page: number; total: number; change: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / 10));
  return (
    <div className="table-pagination">
      <span>
        {total} bản ghi · Trang {page}/{pages}
      </span>
      <div>
        <button
          className="icon-button"
          title="Trang trước"
          aria-label="Trang trước"
          disabled={page <= 1}
          onClick={() => change(page - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          className="icon-button"
          title="Trang sau"
          aria-label="Trang sau"
          disabled={page >= pages}
          onClick={() => change(page + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
export function AdminPortal() {
  const { auth } = useLive();
  const roles = auth?.user.roles ?? noRoles;
  const allowedMenus = useMemo(() => menus.filter((menu) => canAccessAdminSection(roles, menu.id)), [roles]);
  const [section, setSection] = useState<AdminSection>(() => allowedMenus[0]?.id ?? "rides");
  const activeSection = allowedMenus.some((menu) => menu.id === section)
    ? section
    : (allowedMenus[0]?.id ?? "rides");
  const canCancelRides = canPerformAdminAction(roles, "cancelRide");
  const canManageDrivers = canPerformAdminAction(roles, "manageDrivers");
  const canManageUsers = canPerformAdminAction(roles, "manageUsers");
  const canManageSurchargeRules = canPerformAdminAction(roles, "manageSurchargeRules");

  useEffect(() => {
    if (section !== activeSection) {
      setSection(activeSection);
    }
  }, [activeSection, section]);

  if (!allowedMenus.length) {
    return <p className="empty-copy">Tài khoản không có quyền sử dụng cổng vận hành.</p>;
  }
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-label">Vận hành</div>
        <nav aria-label="Điều hướng quản trị">
          {allowedMenus.map((m) => (
            <button
              key={m.id}
              className={m.id === activeSection ? "active" : ""}
              onClick={() => setSection(m.id)}
            >
              <m.icon size={18} />
              <span>{m.name}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main className="admin-main">
        <header className="admin-content-header">
          <h1>{allowedMenus.find((m) => m.id === activeSection)?.name}</h1>
          <span>{new Date().toLocaleDateString("vi-VN")}</span>
        </header>
        <div className="admin-content">
          {activeSection === "overview" ? (
            <Overview openRides={() => setSection("rides")} />
          ) : activeSection === "pricing" ? (
            <PricingView />
          ) : activeSection === "surcharges" ? (
            <SurchargeView canManageRules={canManageSurchargeRules} />
          ) : activeSection === "promotions" ? (
            <PromotionsView />
          ) : activeSection === "withdrawals" ? (
            <WithdrawalView />
          ) : activeSection === "refunds" ? (
            <RefundView />
          ) : activeSection === "reconciliation" ? (
            <ReconciliationView />
          ) : activeSection === "reports" ? (
            <FinanceReportView />
          ) : (
            <RecordsView
              key={activeSection}
              section={activeSection}
              canCancelRides={canCancelRides}
              canManageDrivers={canManageDrivers}
              canManageUsers={canManageUsers}
            />
          )}
        </div>
      </main>
    </div>
  );
}
function Overview({ openRides }: { openRides: () => void }) {
  const resource = useResource<{
    grossRevenue: number;
    refundedRevenue: number;
    netRevenue: number;
    completedRides: number;
    activeRides: number;
    onlineDrivers: number;
    dailyFinancials: {
      day: string;
      grossRevenue: number;
      refundedRevenue: number;
      netRevenue: number;
    }[];
    statusCounts: { status: string; count: number }[];
  }>("/admin/dashboard");
  const d = resource.data;
  return (
    <>
      <Feedback error={resource.error} loading={resource.loading && !d} />
      <button className="text-button" onClick={() => void resource.reload()}>
        <RefreshCw size={16} />
        Làm mới
      </button>
      {d && (
        <>
          <section className="metric-grid">
            {[
              ["Doanh thu gộp", money(d.grossRevenue)],
              ["Đã hoàn tiền", money(d.refundedRevenue)],
              ["Doanh thu thuần", money(d.netRevenue)],
              ["Chuyến hoàn thành", d.completedRides],
              ["Chuyến hoạt động", d.activeRides],
              ["Tài xế online", d.onlineDrivers]
            ].map(([k, v]) => (
              <article className="metric-card" key={String(k)}>
                <span>{k}</span>
                <strong>{v}</strong>
              </article>
            ))}
          </section>
          <section className="admin-dashboard-grid">
            <div className="data-panel">
              <div className="data-panel-heading">
                <h2>Tài chính 7 ngày (UTC)</h2>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={d.dailyFinancials}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tickFormatter={(s) => s.slice(5)} />
                    <YAxis width={65} />
                    <Tooltip formatter={(value) => money(Number(value))} />
                    <Legend />
                    <Line name="Doanh thu gộp" dataKey="grossRevenue" stroke="#087a55" strokeWidth={2} />
                    <Line name="Hoàn tiền" dataKey="refundedRevenue" stroke="#c2410c" strokeWidth={2} />
                    <Line name="Doanh thu thuần" dataKey="netRevenue" stroke="#1d4ed8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="data-panel">
              <div className="data-panel-heading">
                <h2>Trạng thái chuyến</h2>
              </div>
              <div className="operation-stat-list">
                {d.statusCounts.map((s) => (
                  <div key={s.status}>
                    <span className="operation-dot riding" />
                    <div>
                      <span>{labels[s.status] ?? s.status}</span>
                      <strong>{s.count}</strong>
                    </div>
                  </div>
                ))}
                {!d.statusCounts.length && <p className="empty-copy">Chưa có chuyến đi.</p>}
              </div>
              <button className="text-button" onClick={openRides}>
                Xem chuyến đi <ChevronRight size={17} />
              </button>
            </div>
          </section>
        </>
      )}
    </>
  );
}
type Payment = {
  id: string;
  amount: string;
  status: string;
  method: string;
  createdAt: string;
  customer: User;
  ride: Ride;
};
function RecordsView({
  section,
  canCancelRides,
  canManageDrivers,
  canManageUsers
}: {
  section: "rides" | "drivers" | "users" | "payments";
  canCancelRides: boolean;
  canManageDrivers: boolean;
  canManageUsers: boolean;
}) {
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Ride | Driver | (User & { status: string }) | null>(null);
  const resource = useResource<Page<Ride | Driver | (User & { status: string }) | Payment>>(
    "/admin/" +
      section +
      "?" +
      new URLSearchParams({ search: query, status, page: String(page), limit: "10" })
  );
  const options =
    section === "rides"
      ? [
          "SEARCHING_DRIVER",
          "ACCEPTED",
          "ARRIVED",
          "IN_PROGRESS",
          "COMPLETED",
          "CANCELLED_BY_CUSTOMER",
          "CANCELLED_BY_DRIVER",
          "CANCELLED_BY_SYSTEM"
        ]
      : section === "drivers"
        ? ["PENDING", "APPROVED", "REJECTED"]
        : section === "users"
          ? ["ACTIVE", "LOCKED"]
          : ["PENDING", "PAID", "FAILED", "REFUNDED"];
  async function show(id: string) {
    setError("");
    try {
      setSelected(await apiRequest<Ride | Driver>("/admin/" + section + "/" + id));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function action(path: string, body: unknown = {}, method = "POST") {
    setBusy(true);
    setError("");
    try {
      await mutate(path, body, method);
      setSelected(null);
      await resource.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const ride = section === "rides" ? (selected as Ride | null) : null,
    driver = section === "drivers" ? (selected as Driver | null) : null;
  return (
    <section className="records-section">
      <div className="filter-bar">
        {section !== "payments" && (
          <form
            className="search-control"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setQuery(search);
            }}
          >
            <input
              aria-label="Tìm kiếm"
              placeholder="Mã, tên hoặc số điện thoại"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="icon-button subtle" title="Tìm kiếm" aria-label="Tìm kiếm">
              <Search size={18} />
            </button>
          </form>
        )}
        <select
          className="select-control"
          aria-label="Trạng thái"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả trạng thái</option>
          {options.map((s) => (
            <option key={s} value={s}>
              {labels[s] ?? s}
            </option>
          ))}
        </select>
        <IconAction label="Làm mới" onClick={() => void resource.reload()}>
          <RefreshCw size={18} />
        </IconAction>
      </div>
      <Feedback error={error || resource.error} loading={resource.loading} />
      <div className="table-scroll">
        <table className="data-table live-records">
          <thead>
            <tr>
              <th>
                {section === "rides"
                  ? "Chuyến đi"
                  : section === "drivers"
                    ? "Tài xế"
                    : section === "users"
                      ? "Tài khoản"
                      : "Thanh toán"}
              </th>
              <th>Thông tin</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {resource.data?.items.map((item) => {
              if (section === "rides") {
                const r = item as Ride;
                return (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.customer.fullName}</strong>
                      <small className="record-id">{r.id}</small>
                    </td>
                    <td>
                      <div className="stacked-cell">
                        <span>{r.pickupAddress}</span>
                        <strong>{r.dropoffAddress}</strong>
                        <span>{money(r.finalFare ?? r.estimatedFare)}</span>
                      </div>
                    </td>
                    <td>
                      <Badge status={r.status} />
                    </td>
                    <td>
                      <IconAction label="Xem chuyến" onClick={() => void show(r.id)}>
                        <Eye size={18} />
                      </IconAction>
                    </td>
                  </tr>
                );
              }
              if (section === "drivers") {
                const d = item as Driver;
                return (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.user.fullName}</strong>
                      <small className="record-id">{d.user.phone}</small>
                    </td>
                    <td>
                      <div className="stacked-cell">
                        <strong>{d.vehicles.map((v) => v.plateNumber).join(", ")}</strong>
                        <span>
                          {d.totalRides} chuyến · {labels[d.onlineStatus]}
                        </span>
                      </div>
                    </td>
                    <td>
                      <Badge status={d.verificationStatus} />
                    </td>
                    <td>
                      <IconAction label="Xem hồ sơ" onClick={() => void show(d.id)}>
                        <Eye size={18} />
                      </IconAction>
                    </td>
                  </tr>
                );
              }
              if (section === "users") {
                const u = item as User & { status: string };
                return (
                  <tr key={u.id}>
                    <td>{u.fullName}</td>
                    <td>{u.phone}</td>
                    <td>
                      <Badge status={u.status} />
                    </td>
                    <td>
                      {canManageUsers ? (
                        <IconAction label="Sửa trạng thái" onClick={() => setSelected(u)}>
                          <Pencil size={18} />
                        </IconAction>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              }
              const p = item as Payment;
              return (
                <tr key={p.id}>
                  <td>
                    {p.customer.fullName}
                    <small className="record-id">{p.id}</small>
                  </td>
                  <td>
                    {money(p.amount)} · {p.method}
                    <small className="record-id">{date(p.createdAt)}</small>
                  </td>
                  <td>
                    <Badge status={p.status} />
                  </td>
                  <td>{p.ride.id.slice(0, 8)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {resource.data?.items.length === 0 && <p className="empty-copy">Không có dữ liệu phù hợp.</p>}
      <Pager page={page} total={resource.data?.total ?? 0} change={setPage} />
      {selected && (
        <Modal
          title={ride ? "Chi tiết chuyến" : driver ? "Hồ sơ tài xế" : "Trạng thái tài khoản"}
          close={() => setSelected(null)}
        >
          <Feedback error={error} />
          {ride && (
            <>
              <RideDetails ride={ride} />
              {canCancelRides &&
                ["SCHEDULED", "SEARCHING_DRIVER", "ACCEPTED", "DRIVER_ARRIVING", "ARRIVED"].includes(
                  ride.status
                ) && (
                  <form
                    className="live-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action("/admin/rides/" + ride.id + "/cancel", {
                        reason: new FormData(e.currentTarget).get("reason")
                      });
                    }}
                  >
                    <label>
                      Lý do hủy
                      <input name="reason" required minLength={3} maxLength={191} />
                    </label>
                    <button className="secondary-button danger-text" disabled={busy}>
                      Xác nhận hủy chuyến
                    </button>
                  </form>
                )}
            </>
          )}
          {driver && (
            <>
              <p>
                <strong>{driver.user.fullName}</strong> · {driver.user.phone}
              </p>
              <p>
                {driver.vehicles
                  .map((v) => v.plateNumber + " · " + (v.model ?? v.vehicleType.name))
                  .join(", ")}
              </p>
              <Badge status={driver.verificationStatus} />
              {canManageDrivers && (
                <>
                  <div className="live-actions">
                    {driver.verificationStatus !== "APPROVED" && (
                      <button
                        className="primary-button"
                        disabled={busy}
                        onClick={() => void action("/admin/drivers/" + driver.id + "/approve")}
                      >
                        <Check size={18} />
                        Duyệt hồ sơ
                      </button>
                    )}
                  </div>
                  <form
                    className="live-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action("/admin/drivers/" + driver.id + "/reject", {
                        reason: new FormData(e.currentTarget).get("reason")
                      });
                    }}
                  >
                    <label>
                      Lý do từ chối
                      <input name="reason" required minLength={3} maxLength={191} />
                    </label>
                    <button
                      className="secondary-button danger-text"
                      disabled={busy || driver.onlineStatus === "BUSY"}
                    >
                      Từ chối hồ sơ
                    </button>
                  </form>
                </>
              )}
            </>
          )}
          {section === "users" && canManageUsers && (
            <form
              className="live-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action(
                  "/admin/users/" + selected.id + "/status",
                  { status: new FormData(e.currentTarget).get("status") },
                  "PATCH"
                );
              }}
            >
              <p>{(selected as User).fullName}</p>
              <label>
                Trạng thái
                <select name="status" defaultValue={(selected as User & { status: string }).status}>
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="LOCKED">Khóa tài khoản</option>
                </select>
              </label>
              <button className="primary-button" disabled={busy}>
                Lưu thay đổi
              </button>
            </form>
          )}
        </Modal>
      )}
    </section>
  );
}
function PricingView() {
  const resource = useResource<Pricing[]>("/admin/pricing-rules"),
    vehicles = useResource<VehicleType[]>("/vehicle-types");
  const [editing, setEditing] = useState<Pricing | "new" | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const item = editing && editing !== "new" ? editing : null;
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await mutate(
        item ? "/admin/pricing-rules/" + item.id : "/admin/pricing-rules",
        {
          vehicleTypeId: f.get("vehicleTypeId"),
          baseFare: Number(f.get("baseFare")),
          perKmFare: Number(f.get("perKmFare")),
          perMinuteFare: Number(f.get("perMinuteFare")),
          minimumFare: Number(f.get("minimumFare")),
          peakMultiplier: Number(f.get("peakMultiplier")),
          isActive: f.get("isActive") === "on"
        },
        item ? "PATCH" : "POST"
      );
      setEditing(null);
      await resource.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="data-panel-heading">
        <h2>Bảng giá</h2>
        <button className="primary-button" onClick={() => setEditing("new")}>
          <Plus size={18} />
          Thêm quy tắc
        </button>
      </div>
      <Feedback error={resource.error || vehicles.error} loading={resource.loading} />
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Loại xe</th>
              <th>Mở cửa</th>
              <th>Mỗi km</th>
              <th>Mỗi phút</th>
              <th>Tối thiểu</th>
              <th>Hệ số</th>
              <th>Áp dụng</th>
              <th>Sửa</th>
            </tr>
          </thead>
          <tbody>
            {resource.data?.map((p) => (
              <tr key={p.id}>
                <td>{p.vehicleType.name}</td>
                <td>{money(p.baseFare)}</td>
                <td>{money(p.perKmFare)}</td>
                <td>{money(p.perMinuteFare)}</td>
                <td>{money(p.minimumFare)}</td>
                <td>{p.peakMultiplier}</td>
                <td>{p.isActive ? "Có" : "Không"}</td>
                <td>
                  <IconAction label={"Sửa " + p.vehicleType.name} onClick={() => setEditing(p)}>
                    <Pencil size={18} />
                  </IconAction>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal title={item ? "Sửa bảng giá" : "Thêm bảng giá"} close={() => setEditing(null)}>
          <form className="live-form" onSubmit={save}>
            <label>
              Loại xe
              <select name="vehicleTypeId" defaultValue={item?.vehicleTypeId} required>
                {vehicles.data?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            {(
              [
                ["baseFare", "Giá mở cửa"],
                ["perKmFare", "Giá mỗi km"],
                ["perMinuteFare", "Giá mỗi phút"],
                ["minimumFare", "Giá tối thiểu"],
                ["peakMultiplier", "Hệ số cao điểm"]
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  name={key}
                  type="number"
                  step={key === "peakMultiplier" ? ".01" : "1"}
                  min={key === "peakMultiplier" ? 1 : 0}
                  required
                  defaultValue={item?.[key] ?? (key === "peakMultiplier" ? 1 : 0)}
                />
              </label>
            ))}
            <label className="check-label">
              <input name="isActive" type="checkbox" defaultChecked={item?.isActive ?? true} /> Đang áp dụng
            </label>
            <Feedback error={error} />
            <button className="primary-button" disabled={busy}>
              Lưu bảng giá
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
function WithdrawalView() {
  const [status, setStatus] = useState("PENDING"),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const resource = useResource<Page<Withdrawal>>(
    `/admin/withdrawals?${new URLSearchParams({ status, page: String(page), limit: "10" })}`
  );
  async function review(item: Withdrawal, approve: boolean) {
    const reason = approve ? undefined : window.prompt("Lý do từ chối yêu cầu rút tiền:");
    if (!approve && !reason) return;
    setBusy(true);
    setError("");
    try {
      await mutate(
        `/admin/withdrawals/${item.id}/${approve ? "approve" : "reject"}`,
        approve ? {} : { reason }
      );
      await resource.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="filter-bar">
        <select
          className="select-control"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Từ chối</option>
        </select>
        <IconAction label="Làm mới" onClick={() => void resource.reload()}>
          <RefreshCw size={18} />
        </IconAction>
      </div>
      <Feedback error={error || resource.error} loading={resource.loading} />
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tài xế</th>
              <th>Ngân hàng</th>
              <th>Số tiền</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {resource.data?.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.driver?.user.fullName}</strong>
                  <small className="record-id">{date(item.createdAt)}</small>
                </td>
                <td>
                  {item.bankCode} · {item.accountNumber}
                  <small className="record-id">{item.accountName}</small>
                </td>
                <td>{money(item.amount)}</td>
                <td>
                  <Badge status={item.status} />
                </td>
                <td>
                  {item.status === "PENDING" && (
                    <div className="dual-actions">
                      <button
                        className="primary-button"
                        disabled={busy}
                        onClick={() => void review(item, true)}
                      >
                        Duyệt
                      </button>
                      <button
                        className="secondary-button danger-text"
                        disabled={busy}
                        onClick={() => void review(item, false)}
                      >
                        Từ chối
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={resource.data?.total ?? 0} change={setPage} />
    </section>
  );
}

function RefundView() {
  const [status, setStatus] = useState("PENDING"),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const resource = useResource<Page<RefundRequest>>(
    `/admin/refunds?${new URLSearchParams({ status, page: String(page), limit: "10" })}`
  );
  async function review(item: RefundRequest, approve: boolean) {
    const reason = approve ? undefined : window.prompt("Lý do từ chối hoàn tiền:");
    if (!approve && !reason) return;
    setBusy(true);
    setError("");
    try {
      await mutate(`/admin/refunds/${item.id}/${approve ? "approve" : "reject"}`, approve ? {} : { reason });
      await resource.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="filter-bar">
        <select
          className="select-control"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Từ chối</option>
        </select>
        <IconAction label="Làm mới" onClick={() => void resource.reload()}>
          <RefreshCw size={18} />
        </IconAction>
      </div>
      <Feedback error={error || resource.error} loading={resource.loading} />
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Khách hàng</th>
              <th>Giao dịch</th>
              <th>Số tiền</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {resource.data?.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.payment.customer.fullName}</strong>
                  <small className="record-id">{item.payment.customer.phone}</small>
                </td>
                <td>
                  {item.reason}
                  <small className="record-id">
                    {item.payment.rideId.slice(0, 8)} · {date(item.createdAt)}
                  </small>
                </td>
                <td>{money(item.amount)}</td>
                <td>
                  <Badge status={item.status} />
                </td>
                <td>
                  {item.status === "PENDING" && (
                    <div className="dual-actions">
                      <button
                        className="primary-button"
                        disabled={busy}
                        onClick={() => void review(item, true)}
                      >
                        Duyệt
                      </button>
                      <button
                        className="secondary-button danger-text"
                        disabled={busy}
                        onClick={() => void review(item, false)}
                      >
                        Từ chối
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={resource.data?.total ?? 0} change={setPage} />
    </section>
  );
}

function ReconciliationView() {
  const [status, setStatus] = useState("REVIEW_REQUIRED"),
    [classification, setClassification] = useState(""),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const itemQuery = new URLSearchParams({ page: String(page), limit: "10" });
  if (status) itemQuery.set("status", status);
  if (classification) itemQuery.set("classification", classification);
  const items = useResource<Page<ReconciliationItem>>(`/admin/reconciliation/items?${itemQuery}`);
  const runs = useResource<Page<ReconciliationRun>>("/admin/reconciliation/runs?page=1&limit=5");
  async function runNow() {
    setBusy(true);
    setError("");
    try {
      await mutate("/admin/reconciliation/run");
      await Promise.all([items.reload(), runs.reload()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function resolve(item: ReconciliationItem, action: "ACCEPT" | "IGNORE") {
    const note = window.prompt(
      action === "ACCEPT" ? "Ghi chú chấp nhận giao dịch:" : "Lý do bỏ qua giao dịch:"
    );
    if (!note) return;
    setBusy(true);
    setError("");
    try {
      await mutate(`/admin/reconciliation/items/${item.id}/resolve`, { action, note });
      await items.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="filter-bar">
        <select
          value={classification}
          onChange={(event) => {
            setClassification(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Mọi phân loại</option>
          {["EXACT", "UNDERPAID", "OVERPAID", "REFERENCE_NOT_FOUND", "DUPLICATE", "EXPIRED"].map((item) => (
            <option value={item} key={item}>
              {labels[item]}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Mọi trạng thái</option>
          {["MATCHED", "REVIEW_REQUIRED", "RESOLVED", "IGNORED"].map((item) => (
            <option value={item} key={item}>
              {labels[item]}
            </option>
          ))}
        </select>
        <button className="primary-button" disabled={busy} onClick={() => void runNow()}>
          <RefreshCw size={17} /> Chạy đối soát
        </button>
      </div>
      <Feedback error={error || items.error || runs.error} loading={items.loading || runs.loading} />
      {runs.data?.items[0] && (
        <p className="empty-copy">
          Lần gần nhất: {date(runs.data.items[0].startedAt)} · {runs.data.items[0].fetchedCount} giao dịch ·{" "}
          {runs.data.items[0].exceptionCount} ngoại lệ
        </p>
      )}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Số tiền</th>
              <th>Phân loại</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.data?.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.paymentReference}</strong>
                  <small className="record-id">
                    {item.providerTransactionId} · {item.source}
                  </small>
                </td>
                <td>
                  {money(item.amount)}
                  {item.expectedAmount && (
                    <small className="record-id">Dự kiến {money(item.expectedAmount)}</small>
                  )}
                </td>
                <td>
                  <Badge status={item.classification} />
                </td>
                <td>
                  <Badge status={item.reconciliationStatus} />
                </td>
                <td>
                  {item.reconciliationStatus === "REVIEW_REQUIRED" && (
                    <div className="dual-actions">
                      {!["REFERENCE_NOT_FOUND", "DUPLICATE"].includes(item.classification) && (
                        <button
                          className="primary-button"
                          disabled={busy}
                          onClick={() => void resolve(item, "ACCEPT")}
                        >
                          Chấp nhận
                        </button>
                      )}
                      <button
                        className="secondary-button"
                        disabled={busy}
                        onClick={() => void resolve(item, "IGNORE")}
                      >
                        Bỏ qua
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={items.data?.total ?? 0} change={setPage} />
    </section>
  );
}

function FinanceReportView() {
  const [period, setPeriod] = useState<"day" | "month">("day"),
    [reportDate, setReportDate] = useState(vietnamToday),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function download(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const value = period === "month" ? reportDate.slice(0, 7) : reportDate;
      const file = await downloadFile(
        `/admin/reports/finance.csv?${new URLSearchParams({ period, date: value })}`
      );
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="records-section">
      <h2>Xuất báo cáo tài chính</h2>
      <p className="empty-copy">
        Báo cáo gồm doanh thu, hoa hồng, tiền mặt, nạp ví, hoàn tiền và rút tiền theo múi giờ Việt Nam.
      </p>
      <form className="live-form" onSubmit={download}>
        <label>
          Chu kỳ
          <select value={period} onChange={(event) => setPeriod(event.target.value as "day" | "month")}>
            <option value="day">Theo ngày</option>
            <option value="month">Theo tháng</option>
          </select>
        </label>
        <label>
          Ngày báo cáo
          <input
            type={period === "month" ? "month" : "date"}
            value={period === "month" ? reportDate.slice(0, 7) : reportDate}
            onChange={(event) =>
              setReportDate(period === "month" ? `${event.target.value}-01` : event.target.value)
            }
            required
          />
        </label>
        <Feedback error={error} />
        <button className="primary-button" disabled={busy}>
          <Download size={17} /> {busy ? "Đang tạo..." : "Tải CSV"}
        </button>
      </form>
    </section>
  );
}

type Surcharge = {
  id: string;
  name: string;
  type: string;
  multiplier: string;
  fixedAmount: string;
  startMinute?: number | null;
  endMinute?: number | null;
  daysOfWeek?: string | null;
  weatherConditions?: string | null;
  isActive: boolean;
  vehicleType?: VehicleType | null;
};
function SurchargeView({ canManageRules }: { canManageRules: boolean }) {
  const resource = useResource<Surcharge[]>("/admin/surcharges"),
    context = useResource<{ weatherCondition: string }>("/admin/surcharges/context/weather"),
    vehicles = useResource<VehicleType[]>("/vehicle-types");
  const [creating, setCreating] = useState(false),
    [kind, setKind] = useState("PEAK_HOUR"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const minutes = (value: FormDataEntryValue | null) => {
    if (!value) return undefined;
    const [hour, minute] = String(value).split(":").map(Number);
    return hour * 60 + minute;
  };
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await mutate("/admin/surcharges", {
        name: f.get("name"),
        type: kind,
        vehicleTypeId: f.get("vehicleTypeId") || null,
        multiplier: Number(f.get("multiplier")),
        fixedAmount: Number(f.get("fixedAmount")),
        ...(kind === "WEATHER"
          ? { weatherConditions: [f.get("weatherCondition")] }
          : {
              startMinute: minutes(f.get("startTime")),
              endMinute: minutes(f.get("endTime")),
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6]
            }),
        isActive: true
      });
      setCreating(false);
      await resource.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function weather(value: string) {
    setError("");
    try {
      await mutate("/admin/surcharges/context/weather", { weatherCondition: value }, "PATCH");
      await context.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function toggle(item: Surcharge) {
    setError("");
    try {
      await mutate("/admin/surcharges/" + item.id, { isActive: !item.isActive }, "PATCH");
      await resource.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section>
      <div className="data-panel-heading">
        <div>
          <h2>Phụ phí linh hoạt</h2>
          <label>
            Thời tiết hiện tại
            <select
              value={context.data?.weatherCondition ?? "NORMAL"}
              onChange={(e) => void weather(e.target.value)}
            >
              <option value="NORMAL">Bình thường</option>
              <option value="RAIN">Mưa</option>
              <option value="HEAVY_RAIN">Mưa lớn</option>
              <option value="FLOOD">Ngập</option>
            </select>
          </label>
        </div>
        {canManageRules && (
          <button className="primary-button" onClick={() => setCreating(true)}>
            <Plus size={18} />
            Thêm phụ phí
          </button>
        )}
      </div>
      <Feedback error={error || resource.error || context.error} loading={resource.loading} />
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Loại</th>
              <th>Phạm vi</th>
              <th>Hệ số</th>
              <th>Cố định</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {resource.data?.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.type}</td>
                <td>
                  {item.vehicleType?.name ?? "Tất cả"}
                  {item.weatherConditions ? ` · ${item.weatherConditions}` : ""}
                </td>
                <td>{item.multiplier}×</td>
                <td>{money(item.fixedAmount)}</td>
                <td>
                  {canManageRules ? (
                    <button className="text-button" onClick={() => void toggle(item)}>
                      {item.isActive ? "Đang bật" : "Đang tắt"}
                    </button>
                  ) : item.isActive ? (
                    "Đang bật"
                  ) : (
                    "Đang tắt"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {creating && canManageRules && (
        <Modal title="Thêm phụ phí" close={() => setCreating(false)}>
          <form className="live-form" onSubmit={create}>
            <label>
              Tên
              <input name="name" minLength={2} maxLength={100} required />
            </label>
            <label>
              Loại
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="PEAK_HOUR">Giờ cao điểm</option>
                <option value="LATE_NIGHT">Đêm khuya</option>
                <option value="WEATHER">Thời tiết</option>
                <option value="CUSTOM">Tùy chỉnh</option>
              </select>
            </label>
            <label>
              Loại xe
              <select name="vehicleTypeId">
                <option value="">Tất cả</option>
                {vehicles.data?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Hệ số
              <input name="multiplier" type="number" min={1} max={5} step=".05" defaultValue={1.2} required />
            </label>
            <label>
              Phí cố định
              <input name="fixedAmount" type="number" min={0} defaultValue={0} required />
            </label>
            {kind === "WEATHER" ? (
              <label>
                Điều kiện
                <select name="weatherCondition">
                  <option value="RAIN">Mưa</option>
                  <option value="HEAVY_RAIN">Mưa lớn</option>
                  <option value="FLOOD">Ngập</option>
                </select>
              </label>
            ) : (
              <>
                <label>
                  Bắt đầu
                  <input name="startTime" type="time" required />
                </label>
                <label>
                  Kết thúc
                  <input name="endTime" type="time" required />
                </label>
              </>
            )}
            <Feedback error={error} />
            <button className="primary-button" disabled={busy}>
              Lưu phụ phí
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}

function PromotionsView() {
  const resource = useResource<Promotion[]>("/admin/promotions");
  const [editing, setEditing] = useState<Promotion | "new" | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const item = editing && editing !== "new" ? editing : null;
  const localDate = (value: string) => {
    const d = new Date(value);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    setBusy(true);
    try {
      const start = new Date(String(f.get("startsAt"))),
        end = new Date(String(f.get("endsAt")));
      if (end <= start) throw new Error("Ngày hết hạn phải sau ngày bắt đầu.");
      await mutate(
        item ? "/admin/promotions/" + item.id : "/admin/promotions",
        {
          code: f.get("code"),
          name: f.get("name"),
          type: f.get("type"),
          value: Number(f.get("value")),
          usageLimit: Number(f.get("usageLimit")),
          maxDiscount: f.get("maxDiscount") ? Number(f.get("maxDiscount")) : null,
          minRideFare: Number(f.get("minRideFare")),
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          isActive: f.get("isActive") === "on"
        },
        item ? "PATCH" : "POST"
      );
      setEditing(null);
      await resource.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="data-panel-heading">
        <h2>Chương trình khuyến mãi</h2>
        <button className="primary-button" onClick={() => setEditing("new")}>
          <Plus size={18} />
          Tạo khuyến mãi
        </button>
      </div>
      <Feedback error={resource.error} loading={resource.loading} />
      <div className="promotion-grid">
        {resource.data?.map((p) => (
          <article key={p.id} className="promotion-card">
            <h3>{p.name}</h3>
            <strong>{p.type === "PERCENTAGE" ? p.value + "%" : money(p.value)}</strong>
            <p>
              <code>{p.code}</code>
            </p>
            <p>{date(p.endsAt)}</p>
            <p>{p.isActive ? "Đang bật" : "Đang tắt"}</p>
            <IconAction label={"Sửa " + p.code} onClick={() => setEditing(p)}>
              <Pencil size={18} />
            </IconAction>
          </article>
        ))}
      </div>
      {resource.data?.length === 0 && <p className="empty-copy">Chưa có khuyến mãi.</p>}
      {editing && (
        <Modal title={item ? "Sửa khuyến mãi" : "Tạo khuyến mãi"} close={() => setEditing(null)}>
          <form className="live-form" onSubmit={save}>
            <label>
              Mã khuyến mãi
              <input name="code" required minLength={2} maxLength={40} defaultValue={item?.code} />
            </label>
            <label>
              Tên chương trình
              <input name="name" required minLength={2} maxLength={120} defaultValue={item?.name} />
            </label>
            <label>
              Loại giảm giá
              <select name="type" defaultValue={item?.type ?? "PERCENTAGE"}>
                <option value="PERCENTAGE">Phần trăm</option>
                <option value="FIXED_AMOUNT">Số tiền</option>
              </select>
            </label>
            <label>
              Giá trị
              <input name="value" required type="number" min={0} defaultValue={item?.value ?? 10} />
            </label>
            <label>
              Giảm tối đa (đ)
              <input name="maxDiscount" type="number" min={0} defaultValue={item?.maxDiscount ?? ""} />
            </label>
            <label>
              Giá chuyến tối thiểu (đ)
              <input
                name="minRideFare"
                required
                type="number"
                min={0}
                defaultValue={item?.minRideFare ?? 0}
              />
            </label>
            <label>
              Giới hạn lượt dùng
              <input
                name="usageLimit"
                required
                type="number"
                min={1}
                defaultValue={item?.usageLimit ?? 100}
              />
            </label>
            <label>
              Bắt đầu
              <input
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={localDate(item?.startsAt ?? new Date().toISOString())}
              />
            </label>
            <label>
              Kết thúc
              <input
                name="endsAt"
                type="datetime-local"
                required
                defaultValue={item ? localDate(item.endsAt) : ""}
              />
            </label>
            <label className="check-label">
              <input name="isActive" type="checkbox" defaultChecked={item?.isActive ?? true} /> Kích hoạt
            </label>
            <Feedback error={error} />
            <button className="primary-button" disabled={busy}>
              Lưu khuyến mãi
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
