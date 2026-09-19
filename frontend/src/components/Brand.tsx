import { Navigation } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="GoRide">
      <span className="brand-mark" aria-hidden="true">
        <Navigation size={20} strokeWidth={2.5} />
      </span>
      {!compact && <span className="brand-name">GoRide</span>}
    </div>
  );
}
