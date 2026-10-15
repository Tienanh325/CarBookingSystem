import { useState } from "react";
import { apiRequest, mutate } from "../services/api";
import { useResource } from "../services/live";
import { Feedback } from "./LiveUI";
import { StatusBadge } from "./StatusBadge";

type Page<T> = { items: T[]; total: number };
type DocumentItem = {
  id: string;
  type: string;
  originalName?: string;
  status: string;
  expiresAt?: string;
  driver: { user: { fullName: string } };
};
type VehicleItem = {
  id: string;
  plateNumber: string;
  registrationStatus: string;
  driver: { user: { fullName: string } };
  vehicleType: { name: string };
};

export function AssetReviewView({ kind, canReview }: { kind: "documents" | "vehicles"; canReview: boolean }) {
  const path = kind === "documents" ? "/admin/driver-documents?limit=100" : "/admin/vehicles?limit=100";
  const resource = useResource<Page<DocumentItem | VehicleItem>>(path);
  const [error, setError] = useState("");
  async function review(id: string, status: "APPROVED" | "REJECTED") {
    try {
      await mutate(
        kind === "documents" ? `/admin/driver-documents/${id}/review` : `/admin/vehicles/${id}/review`,
        {
          status,
          ...(status === "REJECTED" && kind === "documents" ? { reason: "Tài liệu không đạt yêu cầu" } : {})
        },
        "PATCH"
      );
      await resource.reload();
    } catch (caught) {
      setError((caught as Error).message);
    }
  }
  async function viewDocument(id: string) {
    const result = await apiRequest<{ url: string }>(`/admin/driver-documents/${id}/download-url`);
    window.open(result.url, "_blank", "noopener,noreferrer");
  }
  return (
    <section className="data-panel">
      <Feedback error={error || resource.error} loading={resource.loading} />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Tài xế</th>
              <th>{kind === "documents" ? "Tài liệu" : "Phương tiện"}</th>
              <th>Hết hạn / loại</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {resource.data?.items.map((raw) => {
              const doc = raw as DocumentItem;
              const vehicle = raw as VehicleItem;
              const status = kind === "documents" ? doc.status : vehicle.registrationStatus;
              return (
                <tr key={raw.id}>
                  <td>{raw.driver.user.fullName}</td>
                  <td>
                    {kind === "documents" ? `${doc.type} · ${doc.originalName ?? ""}` : vehicle.plateNumber}
                  </td>
                  <td>
                    {kind === "documents"
                      ? doc.expiresAt
                        ? new Date(doc.expiresAt).toLocaleDateString("vi-VN")
                        : "—"
                      : vehicle.vehicleType.name}
                  </td>
                  <td>
                    <StatusBadge>{status}</StatusBadge>
                  </td>
                  <td>
                    {kind === "documents" && (
                      <button className="text-button" onClick={() => void viewDocument(raw.id)}>
                        Xem
                      </button>
                    )}
                    {canReview && status === "PENDING" && (
                      <>
                        <button className="text-button" onClick={() => void review(raw.id, "APPROVED")}>
                          Duyệt
                        </button>
                        <button
                          className="text-button danger-text"
                          onClick={() => void review(raw.id, "REJECTED")}
                        >
                          Từ chối
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type AccessData = {
  permissions: { id: string; key: string; label: string }[];
  roles: { id: string; name: string; label: string; permissions: { permission: { id: string } }[] }[];
};
type AccessUser = {
  id: string;
  fullName: string;
  phone: string;
  roles: { role: { id: string; name: string } }[];
};
export function AccessView() {
  const resource = useResource<AccessData>("/admin/access");
  const users = useResource<Page<AccessUser>>("/admin/users?limit=100");
  const [error, setError] = useState("");
  async function toggle(roleId: string, permissionId: string, checked: boolean) {
    const role = resource.data?.roles.find((item) => item.id === roleId);
    if (!role) return;
    const current = role.permissions.map((item) => item.permission.id);
    const permissionIds = checked
      ? [...new Set([...current, permissionId])]
      : current.filter((id) => id !== permissionId);
    try {
      await mutate(`/admin/access/roles/${roleId}/permissions`, { permissionIds }, "PUT");
      await resource.reload();
    } catch (caught) {
      setError((caught as Error).message);
    }
  }
  async function toggleUserRole(userId: string, roleId: string, checked: boolean) {
    const user = users.data?.items.find((item) => item.id === userId);
    if (!user) return;
    const current = user.roles.map((item) => item.role.id);
    const roleIds = checked ? [...new Set([...current, roleId])] : current.filter((id) => id !== roleId);
    if (!roleIds.length) {
      setError("Mỗi tài khoản phải có ít nhất một vai trò");
      return;
    }
    try {
      await mutate(`/admin/users/${userId}/roles`, { roleIds }, "PUT");
      await users.reload();
    } catch (caught) {
      setError((caught as Error).message);
    }
  }
  return (
    <section className="data-panel access-management">
      <Feedback error={error || resource.error || users.error} loading={resource.loading || users.loading} />
      <h2>Quyền theo vai trò</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Permission</th>
              {resource.data?.roles.map((role) => (
                <th key={role.id}>{role.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resource.data?.permissions.map((permission) => (
              <tr key={permission.id}>
                <td>
                  <strong>{permission.label}</strong>
                  <small>{permission.key}</small>
                </td>
                {resource.data?.roles.map((role) => (
                  <td key={role.id}>
                    <input
                      type="checkbox"
                      checked={role.permissions.some((item) => item.permission.id === permission.id)}
                      onChange={(event) => void toggle(role.id, permission.id, event.target.checked)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Vai trò người dùng</h2>
      <p className="muted-copy">Thay đổi vai trò sẽ thu hồi toàn bộ phiên đăng nhập hiện tại của người dùng.</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Người dùng</th>
              {resource.data?.roles.map((role) => (
                <th key={role.id}>{role.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.data?.items.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.fullName}</strong>
                  <small>{user.phone}</small>
                </td>
                {resource.data?.roles.map((role) => {
                  const checked = user.roles.some((item) => item.role.id === role.id);
                  return (
                    <td key={role.id}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={checked && user.roles.length === 1}
                        onChange={(event) => void toggleUserRole(user.id, role.id, event.target.checked)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type AuditItem = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: unknown;
  createdAt: string;
  actor?: { fullName: string; phone: string } | null;
};
export function AuditView() {
  const resource = useResource<Page<AuditItem>>("/admin/audit-logs?limit=100");
  return (
    <section className="data-panel">
      <Feedback error={resource.error} loading={resource.loading} />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Actor</th>
              <th>Hành động</th>
              <th>Đối tượng</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {resource.data?.items.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.createdAt).toLocaleString("vi-VN")}</td>
                <td>
                  {item.actor?.fullName ?? "Hệ thống"}
                  <small>{item.actor?.phone}</small>
                </td>
                <td>{item.action}</td>
                <td>
                  {item.entityType} · {item.entityId ?? "—"}
                </td>
                <td>
                  <code>{JSON.stringify(item.metadata ?? {})}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
