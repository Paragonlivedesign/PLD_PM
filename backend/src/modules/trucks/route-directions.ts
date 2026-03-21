import type { RouteGeometryResponse, RouteLegSummary } from "@pld/shared";

export type LatLng = { lat: number; lng: number };

/** Classic Google encoded polyline (precision 5). */
export function encodePolyline(points: LatLng[]): string {
  let lat = 0;
  let lng = 0;
  let out = "";
  for (const p of points) {
    const ilat = Math.round(p.lat * 1e5);
    const ilng = Math.round(p.lng * 1e5);
    const dlat = ilat - lat;
    const dlng = ilng - lng;
    lat = ilat;
    lng = ilng;
    out += encodeSigned(dlat) + encodeSigned(dlng);
  }
  return out;
}

function encodeSigned(n: number): string {
  let sgn = n << 1;
  if (n < 0) sgn = ~sgn;
  let chunk = "";
  while (sgn >= 0x20) {
    chunk += String.fromCharCode((0x20 | (sgn & 0x1f)) + 63);
    sgn >>= 5;
  }
  chunk += String.fromCharCode(sgn + 63);
  return chunk;
}

function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.7613;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function fallbackFromPoints(points: LatLng[]): {
  distanceMiles: number;
  durationSeconds: number;
  encodedPolyline: string;
  legs: RouteLegSummary[];
  trafficAware: boolean;
  provider: string;
} {
  let distanceMiles = 0;
  const legs: RouteLegSummary[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const d = haversineMiles(points[i], points[i + 1]);
    distanceMiles += d;
    const dur = Math.round((d / 45) * 3600);
    legs.push({
      distance_miles: d.toFixed(2),
      duration_seconds: dur,
      start_index: i,
      end_index: i + 1,
    });
  }
  const durationSeconds = legs.reduce((s, l) => s + l.duration_seconds, 0);
  return {
    distanceMiles,
    durationSeconds,
    encodedPolyline: encodePolyline(points.length ? points : [{ lat: 0, lng: 0 }]),
    legs,
    trafficAware: false,
    provider: "haversine",
  };
}

export async function computeRouteDirections(points: LatLng[]): Promise<{
  distanceMiles: number;
  durationSeconds: number;
  geometry: RouteGeometryResponse;
}> {
  if (points.length < 2) {
    const p = points.length === 1 ? points[0] : { lat: 0, lng: 0 };
    const fb = fallbackFromPoints([p, p]);
    return {
      distanceMiles: 0,
      durationSeconds: 0,
      geometry: {
        encoded_polyline: fb.encodedPolyline,
        provider: fb.provider,
        computed_at: new Date().toISOString(),
        legs: [],
        traffic_aware: false,
      },
    };
  }

  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_ROUTES_API_KEY;
  if (key) {
    try {
      const body: Record<string, unknown> = {
        origin: { location: { latLng: { latitude: points[0].lat, longitude: points[0].lng } } },
        destination: {
          location: {
            latLng: {
              latitude: points[points.length - 1].lat,
              longitude: points[points.length - 1].lng,
            },
          },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        polylineQuality: "OVERVIEW",
      };
      if (points.length > 2) {
        body.intermediates = points.slice(1, -1).map((p) => ({
          location: { latLng: { latitude: p.lat, longitude: p.lng } },
        }));
      }
      const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline",
        },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const j = (await r.json()) as {
          routes?: Array<{
            distanceMeters?: string;
            duration?: string;
            polyline?: { encodedPolyline?: string };
          }>;
        };
        const route = j.routes?.[0];
        if (route) {
          const meters = Number(route.distanceMeters ?? 0);
          const distanceMiles = meters / 1609.344;
          const durStr = String(route.duration ?? "0s");
          const secMatch = durStr.match(/^(\d+)s$/);
          const durationSeconds = secMatch ? Number(secMatch[1]) : 0;
          const encoded = route.polyline?.encodedPolyline ?? encodePolyline(points);
          const geometry: RouteGeometryResponse = {
            encoded_polyline: encoded,
            provider: "google_routes_v2",
            computed_at: new Date().toISOString(),
            legs: [],
            traffic_aware: true,
          };
          return { distanceMiles, durationSeconds, geometry };
        }
      }
    } catch {
      /* fall through */
    }
  }

  const fb = fallbackFromPoints(points);
  const geometry: RouteGeometryResponse = {
    encoded_polyline: fb.encodedPolyline,
    provider: fb.provider,
    computed_at: new Date().toISOString(),
    legs: fb.legs,
    traffic_aware: fb.trafficAware,
  };
  return {
    distanceMiles: fb.distanceMiles,
    durationSeconds: fb.durationSeconds,
    geometry,
  };
}
