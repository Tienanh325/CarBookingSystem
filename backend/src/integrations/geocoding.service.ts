import { env } from "../config/env";

export type GeocodingResult = { id: string; address: string; lat: number; lng: number };

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
};

const cache = new Map<string, { expires: number; value: GeocodingResult[] }>();
let lastRequest = 0;
let requestQueue = Promise.resolve();

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatAddress(properties: Record<string, unknown>) {
  const parts = [
    properties.name,
    [properties.housenumber, properties.street].filter(Boolean).join(" "),
    properties.district,
    properties.city,
    properties.state,
    properties.country
  ].filter(Boolean).map(String);
  return [...new Set(parts)].join(", ");
}

function parseFeatures(payload: { features?: PhotonFeature[] }): GeocodingResult[] {
  return (payload.features ?? []).flatMap((feature, index) => {
    const [lng, lat] = feature.geometry?.coordinates ?? [];
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    const properties = feature.properties ?? {};
    const address = formatAddress(properties);
    if (!address) return [];
    return [{
      id: String(properties.osm_id ?? `${lat}-${lng}-${index}`),
      address,
      lat,
      lng
    }];
  });
}

async function throttledFetch(url: URL) {
  const task = requestQueue.then(async () => {
    const delay = Math.max(0, 1_000 - (Date.now() - lastRequest));
    if (delay) await wait(delay);
    lastRequest = Date.now();
    const response = await fetch(url, {
      headers: { "User-Agent": `${env.appName}/1.0`, "Accept-Language": "vi,en" },
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) throw new Error(`Geocoding provider failed (${response.status})`);
    return response.json() as Promise<{ features?: PhotonFeature[] }>;
  });
  requestQueue = task.then(() => undefined, () => undefined);
  return task;
}

export async function searchAddress(query: string, near?: { lat: number; lng: number }) {
  const key = `${query.trim().toLocaleLowerCase("vi")}|${near?.lat ?? ""}|${near?.lng ?? ""}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const url = new URL("/api", env.geocodingBaseUrl);
  url.searchParams.set("q", query.trim());
  url.searchParams.set("limit", "6");
  url.searchParams.set("countrycode", "VN");
  if (near) {
    url.searchParams.set("lat", String(near.lat));
    url.searchParams.set("lon", String(near.lng));
  }
  const value = parseFeatures(await throttledFetch(url));
  cache.set(key, { expires: Date.now() + 10 * 60_000, value });
  return value;
}

export async function reverseAddress(lat: number, lng: number) {
  const url = new URL("/reverse", env.geocodingBaseUrl);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("limit", "1");
  return parseFeatures(await throttledFetch(url))[0] ?? { id: `${lat}-${lng}`, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, lat, lng };
}
