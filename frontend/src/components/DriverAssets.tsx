import { FileUp, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { mutate } from "../services/api";
import { useResource } from "../services/live";
import type { VehicleType } from "../types";

type Vehicle = {
  id: string;
  plateNumber: string;
  brand?: string;
  model?: string;
  color?: string;
  registrationStatus: string;
  isActive: boolean;
  vehicleType: VehicleType;
};
type Document = {
  id: string;
  type: string;
  originalName?: string;
  status: string;
  expiresAt?: string;
  rejectionReason?: string;
};

export function DriverAssets() {
  const vehicles = useResource<Vehicle[]>("/drivers/me/vehicles");
  const documents = useResource<Document[]>("/drivers/me/documents");
  const types = useResource<VehicleType[]>("/vehicle-types");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function addVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    try {
      const values = Object.fromEntries(new FormData(form));
      await mutate("/drivers/me/vehicles", { ...values, isActive: false });
      form.reset();
      setMessage("Đã gửi phương tiện để duyệt.");
      await vehicles.reload();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file") as File;
    if (!file?.size) return;
    setBusy(true);
    try {
      const result = await mutate<{ uploadUrl: string }>("/drivers/me/documents/upload-url", {
        type: data.get("type"),
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        ...(data.get("expiresAt") ? { expiresAt: new Date(String(data.get("expiresAt"))).toISOString() } : {})
      });
      const response = await fetch(result.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });
      if (!response.ok) throw new Error("Upload object storage thất bại");
      form.reset();
      setMessage("Upload thành công, tài liệu đang chờ duyệt.");
      await documents.reload();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="driver-assets">
      <h2>Phương tiện & giấy tờ</h2>
      {message && <p className="safety-feedback">{message}</p>}
      <div className="asset-grid">
        <div>
          <h3>Phương tiện</h3>
          {vehicles.data?.map((item) => (
            <div className="history-row" key={item.id}>
              <strong>
                {item.plateNumber} · {item.vehicleType.name}
              </strong>
              <span>
                {item.registrationStatus}
                {item.isActive ? " · đang dùng" : ""}
              </span>
            </div>
          ))}
          <form className="compact-form" onSubmit={addVehicle}>
            <select name="vehicleTypeId" required>
              {types.data?.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            <input name="plateNumber" placeholder="Biển số" required minLength={5} />
            <input name="brand" placeholder="Hãng xe" />
            <input name="model" placeholder="Dòng xe" />
            <input name="color" placeholder="Màu" />
            <button disabled={busy}>
              <Plus size={16} /> Thêm xe
            </button>
          </form>
        </div>
        <div>
          <h3>Giấy tờ</h3>
          {documents.data?.map((item) => (
            <div className="history-row" key={item.id}>
              <strong>
                {item.type} · {item.originalName}
              </strong>
              <span>
                {item.status}
                {item.expiresAt ? ` · hết hạn ${new Date(item.expiresAt).toLocaleDateString("vi-VN")}` : ""}
              </span>
              {item.rejectionReason && <small>{item.rejectionReason}</small>}
            </div>
          ))}
          <form className="compact-form" onSubmit={upload}>
            <select name="type">
              <option value="DRIVER_LICENSE">Giấy phép lái xe</option>
              <option value="IDENTITY">CCCD</option>
              <option value="VEHICLE_REGISTRATION">Đăng ký xe</option>
              <option value="INSURANCE">Bảo hiểm</option>
            </select>
            <input name="file" type="file" accept="image/jpeg,image/png,application/pdf" required />
            <input name="expiresAt" type="date" />
            <button disabled={busy}>
              <FileUp size={16} /> Upload
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
