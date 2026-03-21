import { find } from "geo-tz";
function timezoneFromCoords(lat, lng) {
    try {
        const zones = find(lat, lng);
        return zones[0] ?? null;
    }
    catch {
        return null;
    }
}
/** Extract lat,lng from common maps URL patterns (no API). */
export function parseCoordsFromMapsUrl(urlRaw) {
    const u = urlRaw.trim();
    if (!u || u.length > 8000)
        return null;
    // @lat,lng,zoom or @lat,lng
    const atMatch = u.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:,|$|[z\s])/);
    if (atMatch) {
        const lat = Number(atMatch[1]);
        const lng = Number(atMatch[2]);
        if (!Number.isNaN(lat) && !Number.isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
            return { lat, lng };
        }
    }
    let parsed;
    try {
        parsed = new URL(u);
    }
    catch {
        return null;
    }
    const q = parsed.searchParams.get("q");
    if (q) {
        const dec = decodeURIComponent(q).trim();
        const comma = dec.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
        if (comma) {
            const lat = Number(comma[1]);
            const lng = Number(comma[2]);
            if (!Number.isNaN(lat) && !Number.isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                return { lat, lng };
            }
        }
    }
    const ll = parsed.searchParams.get("ll");
    if (ll) {
        const parts = ll.split(",");
        if (parts.length >= 2) {
            const lat = Number(parts[0]);
            const lng = Number(parts[1]);
            if (!Number.isNaN(lat) && !Number.isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                return { lat, lng };
            }
        }
    }
    return null;
}
/** Best-effort Google place_id from URL (ChIJ… prefix). */
function extractPlaceId(url) {
    const m = url.match(/[?&]place_id=(ChIJ[^&]+)/);
    if (m)
        return decodeURIComponent(m[1]);
    const m2 = url.match(/place_id[=:](ChIJ[a-zA-Z0-9_-]+)/);
    if (m2)
        return m2[1];
    const m3 = url.match(/\/place\/[^/]+\/(ChIJ[a-zA-Z0-9_-]+)/);
    if (m3)
        return m3[1];
    return null;
}
async function googleGeocode(params) {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key)
        return null;
    const base = "https://maps.googleapis.com/maps/api/geocode/json";
    const u = new URL(base);
    u.searchParams.set("key", key);
    if (params.placeId) {
        u.searchParams.set("place_id", params.placeId);
    }
    else if (params.latlng) {
        u.searchParams.set("latlng", params.latlng);
    }
    else if (params.address) {
        u.searchParams.set("address", params.address);
    }
    else {
        return null;
    }
    const res = await fetch(u.toString());
    const j = (await res.json());
    if (j.status !== "OK" || !j.results?.[0])
        return null;
    const r = j.results[0];
    return {
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
        formatted_address: r.formatted_address,
    };
}
export async function resolveMapsLink(urlRaw) {
    const url = urlRaw.trim();
    if (!url) {
        return {
            latitude: null,
            longitude: null,
            timezone: null,
            formatted_address: null,
            partial: true,
            source: "none",
        };
    }
    const key = process.env.GOOGLE_MAPS_API_KEY;
    const regexCoords = parseCoordsFromMapsUrl(url);
    let parsed = null;
    try {
        parsed = new URL(url);
    }
    catch {
        parsed = null;
    }
    if (key) {
        const pid = extractPlaceId(url);
        if (pid) {
            const g = await googleGeocode({ placeId: pid });
            if (g) {
                const tz = timezoneFromCoords(g.lat, g.lng);
                return {
                    latitude: g.lat,
                    longitude: g.lng,
                    timezone: tz,
                    formatted_address: g.formatted_address,
                    partial: false,
                    source: "google",
                };
            }
        }
        if (regexCoords) {
            const g = await googleGeocode({ latlng: `${regexCoords.lat},${regexCoords.lng}` });
            if (g) {
                const tz = timezoneFromCoords(g.lat, g.lng);
                return {
                    latitude: g.lat,
                    longitude: g.lng,
                    timezone: tz,
                    formatted_address: g.formatted_address,
                    partial: false,
                    source: "google",
                };
            }
        }
        const q = parsed?.searchParams.get("q");
        if (q) {
            const dec = decodeURIComponent(q).trim();
            const isCoordPair = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(dec);
            if (!isCoordPair) {
                const g = await googleGeocode({ address: dec });
                if (g) {
                    const tz = timezoneFromCoords(g.lat, g.lng);
                    return {
                        latitude: g.lat,
                        longitude: g.lng,
                        timezone: tz,
                        formatted_address: g.formatted_address,
                        partial: false,
                        source: "google",
                    };
                }
            }
        }
    }
    if (regexCoords) {
        const tz = timezoneFromCoords(regexCoords.lat, regexCoords.lng);
        return {
            latitude: regexCoords.lat,
            longitude: regexCoords.lng,
            timezone: tz,
            formatted_address: null,
            partial: !key,
            source: "regex",
        };
    }
    return {
        latitude: null,
        longitude: null,
        timezone: null,
        formatted_address: null,
        partial: true,
        source: "none",
    };
}
