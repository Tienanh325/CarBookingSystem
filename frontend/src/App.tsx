import { lazy, Suspense } from "react";
import { CarTaxiFront, LayoutDashboard, MapPinned, LogOut, Wifi, WifiOff } from "lucide-react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Brand } from "./components/Brand";
import { Login } from "./pages/Login";
import { useLive } from "./services/live";
import { mutate, saveSession } from "./services/api";
import { canAccessOperationsPortal } from "./services/rbac";
import { NotificationCenter } from "./components/NotificationCenter";
import { SafetyCenter } from "./components/SafetyCenter";
import { SharedRidePage } from "./pages/SharedRidePage";
const CustomerPortal = lazy(() =>
  import("./pages/CustomerPortal").then((m) => ({ default: m.CustomerPortal }))
);
const DriverPortal = lazy(() => import("./pages/DriverPortal").then((m) => ({ default: m.DriverPortal })));
const AdminPortal = lazy(() => import("./pages/AdminPortal").then((m) => ({ default: m.AdminPortal })));
export default function App() {
  const { auth, connected } = useLive();
  const location = useLocation();
  if (location.pathname.startsWith("/share/")) return <SharedRidePage />;
  if (!auth) return <Login />;
  const roles = auth.user.roles;
  const canUseOperationsPortal = canAccessOperationsPortal(roles, auth.user.permissions);
  const portals = [
    ...(roles.includes("CUSTOMER") ? [{ path: "/customer", label: "Đặt xe", icon: MapPinned }] : []),
    ...(roles.includes("DRIVER") ? [{ path: "/driver", label: "Tài xế", icon: CarTaxiFront }] : []),
    ...(canUseOperationsPortal ? [{ path: "/admin", label: "Điều hành", icon: LayoutDashboard }] : [])
  ];
  const home = portals[0]?.path;
  if (!home)
    return (
      <main className="auth-page">
        <p>Tài khoản chưa có quyền sử dụng cổng này.</p>
        <button onClick={() => saveSession(null)}>Đăng xuất</button>
      </main>
    );
  async function logout() {
    try {
      await mutate("/auth/logout");
      saveSession(null);
    } catch (e) {
      window.alert((e as Error).message);
    }
  }
  const navigation = portals.map((p) => (
    <NavLink key={p.path} to={p.path}>
      <p.icon size={18} />
      <span>{p.label}</span>
    </NavLink>
  ));
  return (
    <div className={`app-shell ${location.pathname.startsWith("/admin") ? "admin-shell" : ""}`}>
      <header className="global-header">
        <NavLink to={home} className="brand-link">
          <Brand />
        </NavLink>
        <nav className="portal-switcher" aria-label="Điều hướng">
          {navigation}
        </nav>
        <div className="global-actions">
          <NotificationCenter />
          <SafetyCenter />
          <span
            className={`connection-state ${connected ? "connected" : "reconnecting"}`}
            title={connected ? "Cập nhật trực tiếp" : "Đang kết nối lại"}
          >
            {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span>{connected ? "Trực tuyến" : "Kết nối lại"}</span>
          </span>
          <button
            className="icon-button"
            onClick={logout}
            title={"Đăng xuất " + auth.user.fullName}
            aria-label="Đăng xuất"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <div className="portal-content">
        <Suspense fallback={<p role="status">Đang tải...</p>}>
          <Routes>
            {roles.includes("CUSTOMER") && <Route path="/customer" element={<CustomerPortal />} />}
            {roles.includes("DRIVER") && <Route path="/driver" element={<DriverPortal />} />}
            {canUseOperationsPortal && <Route path="/admin" element={<AdminPortal />} />}
            <Route path="*" element={<Navigate to={home} replace />} />
          </Routes>
        </Suspense>
      </div>
      <nav className="mobile-portal-nav" aria-label="Điều hướng chính">
        {navigation}
      </nav>
    </div>
  );
}
