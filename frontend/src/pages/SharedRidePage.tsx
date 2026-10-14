import { CarTaxiFront, MapPin, ShieldCheck } from "lucide-react";
import { useParams } from "react-router-dom";
import { Brand } from "../components/Brand";
import { Feedback } from "../components/LiveUI";
import { useResource } from "../services/live";

type SharedRide = {
  rideId: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  vehicleType: string;
  driver: { fullName: string; plateNumber: string | null } | null;
  latestLocation: { lat: string; lng: string; recordedAt: string } | null;
  updatedAt: string;
  expiresAt: string;
};

export function SharedRidePage() {
  const { token } = useParams();
  const resource = useResource<SharedRide>(token ? `/safety/share/${encodeURIComponent(token)}` : null);
  const ride = resource.data;
  return (
    <main className="shared-ride-page">
      <Brand />
      <section className="shared-ride-card">
        <ShieldCheck size={34} />
        <h1>Theo dõi chuyến đi an toàn</h1>
        <Feedback error={resource.error} loading={resource.loading} />
        {ride && (
          <>
            <strong>{ride.status}</strong>
            <p>
              <MapPin size={17} /> {ride.pickupAddress}
            </p>
            <p>
              <MapPin size={17} /> {ride.dropoffAddress}
            </p>
            <p>
              <CarTaxiFront size={17} /> {ride.vehicleType} · {ride.driver?.fullName ?? "Đang tìm tài xế"}{" "}
              {ride.driver?.plateNumber ? `· ${ride.driver.plateNumber}` : ""}
            </p>
            {ride.latestLocation && (
              <a
                href={`https://www.google.com/maps?q=${ride.latestLocation.lat},${ride.latestLocation.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                Xem vị trí gần nhất trên bản đồ
              </a>
            )}
            <small>Cập nhật {new Date(ride.updatedAt).toLocaleString("vi-VN")}</small>
          </>
        )}
      </section>
    </main>
  );
}
