import { env } from "../config/env";
import { haversineDistanceKm } from "../utils/geo";

export type RoutePoint = { lat: number; lng: number };
export type RouteGeometry = { type: "LineString"; coordinates: number[][] };

export type RoadRoute = {
  distanceKm: number;
  durationMin: number;
  geometry: RouteGeometry;
  legs: { distanceKm: number; durationMin: number }[];
  provider: "mapbox" | "osrm" | "fallback";
  trafficAware: boolean;
};

type DirectionsPayload = {
  code?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: RouteGeometry;
    legs?: Array<{ distance: number; duration: number }>;
  }>;
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function coordinates(points: RoutePoint[]) {
  return points.map((point) => `${point.lng},${point.lat}`).join(";");
}

function normalize(payload: DirectionsPayload, provider: "mapbox" | "osrm"): RoadRoute {
  const route = payload.routes?.[0];
  if (payload.code !== "Ok" || !route?.geometry?.coordinates?.length) {
    throw new Error("Routing provider did not return a route");
  }
  return {
    distanceKm: round(route.distance / 1000),
    durationMin: Math.max(1, Math.ceil(route.duration / 60)),
    geometry: route.geometry,
    legs: (route.legs ?? []).map((leg) => ({
      distanceKm: round(leg.distance / 1000),
      durationMin: Math.max(1, Math.ceil(leg.duration / 60))
    })),
    provider,
    trafficAware: provider === "mapbox"
  };
}

async function requestMapbox(points: RoutePoint[], departureAt?: Date) {
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates(points)}`);
  url.searchParams.set("access_token", env.mapboxAccessToken!);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "false");
  if (departureAt) url.searchParams.set("depart_at", departureAt.toISOString());
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Mapbox routing failed (${response.status})`);
  return normalize((await response.json()) as DirectionsPayload, "mapbox");
}

async function requestOsrm(points: RoutePoint[]) {
  const base = env.routingBaseUrl.replace(/\/$/, "");
  const url = new URL(`${base}/route/v1/driving/${coordinates(points)}`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "false");
  const response = await fetch(url, {
    headers: { "User-Agent": `${env.appName}/1.0` },
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) throw new Error(`OSRM routing failed (${response.status})`);
  return normalize((await response.json()) as DirectionsPayload, "osrm");
}

function fallbackRoute(points: RoutePoint[]): RoadRoute {
  const legs = points.slice(1).map((point, index) => {
    const distanceKm = Math.max(0.1, haversineDistanceKm(points[index], point) * 1.2);
    return { distanceKm: round(distanceKm), durationMin: Math.max(1, Math.ceil((distanceKm / 25) * 60)) };
  });
  return {
    distanceKm: round(legs.reduce((sum, leg) => sum + leg.distanceKm, 0)),
    durationMin: legs.reduce((sum, leg) => sum + leg.durationMin, 0),
    geometry: { type: "LineString", coordinates: points.map((point) => [point.lng, point.lat]) },
    legs,
    provider: "fallback",
    trafficAware: false
  };
}

export async function getRoadRoute(points: RoutePoint[], departureAt?: Date): Promise<RoadRoute> {
  if (points.length < 2 || points.length > 4) throw new Error("A route needs 2 to 4 points");
  try {
    return env.mapboxAccessToken ? await requestMapbox(points, departureAt) : await requestOsrm(points);
  } catch (error) {
    console.warn(
      "Routing provider unavailable; using resilient fallback",
      error instanceof Error ? error.message : error
    );
    return fallbackRoute(points);
  }
}
