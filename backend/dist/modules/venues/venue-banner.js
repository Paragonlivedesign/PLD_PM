/**
 * Proxies Google Static Maps / Street View images (server holds API key).
 */
const SIZE = "1200x200";
async function fetchStaticMapPng(lat, lng, key) {
    const u = new URL("https://maps.googleapis.com/maps/api/staticmap");
    u.searchParams.set("center", `${lat},${lng}`);
    u.searchParams.set("zoom", "15");
    u.searchParams.set("size", SIZE);
    u.searchParams.set("maptype", "roadmap");
    u.searchParams.set("scale", "2");
    u.searchParams.set("key", key);
    const res = await fetch(u.toString());
    if (!res.ok)
        return null;
    return Buffer.from(await res.arrayBuffer());
}
async function streetViewMetadataOk(lat, lng, key) {
    const u = new URL("https://maps.googleapis.com/maps/api/streetview/metadata");
    u.searchParams.set("size", SIZE);
    u.searchParams.set("location", `${lat},${lng}`);
    u.searchParams.set("key", key);
    const res = await fetch(u.toString());
    if (!res.ok)
        return false;
    const j = (await res.json());
    return j.status === "OK";
}
async function fetchStreetViewPng(lat, lng, key) {
    const u = new URL("https://maps.googleapis.com/maps/api/streetview");
    u.searchParams.set("size", SIZE);
    u.searchParams.set("location", `${lat},${lng}`);
    u.searchParams.set("key", key);
    const res = await fetch(u.toString());
    if (!res.ok)
        return null;
    return Buffer.from(await res.arrayBuffer());
}
export async function fetchVenueBannerPng(params) {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key)
        return null;
    const { lat, lng, variant } = params;
    if (variant === "google_map") {
        return fetchStaticMapPng(lat, lng, key);
    }
    const metaOk = await streetViewMetadataOk(lat, lng, key);
    if (!metaOk) {
        return fetchStaticMapPng(lat, lng, key);
    }
    const png = await fetchStreetViewPng(lat, lng, key);
    return png ?? fetchStaticMapPng(lat, lng, key);
}
