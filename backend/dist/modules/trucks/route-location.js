import { getContactById } from "../contacts/repository.js";
import { getVenueById } from "../venues/repository.js";
export function parseRouteLocationRef(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const o = raw;
    const kind = o.kind;
    if (kind === "address" && typeof o.text === "string") {
        return { kind: "address", text: o.text };
    }
    if (kind === "coordinates") {
        const lat = Number(o.latitude);
        const lng = Number(o.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng))
            return null;
        return {
            kind: "coordinates",
            latitude: lat,
            longitude: lng,
            label: o.label != null ? String(o.label) : null,
        };
    }
    if (kind === "venue" && typeof o.venue_id === "string") {
        return { kind: "venue", venue_id: o.venue_id };
    }
    if (kind === "contact" && typeof o.contact_id === "string") {
        return {
            kind: "contact",
            contact_id: o.contact_id,
            use: o.use === "custom" ? "custom" : "primary",
            custom_address: o.custom_address != null ? String(o.custom_address) : null,
        };
    }
    return null;
}
export function refToJson(ref) {
    if (!ref)
        return {};
    if (ref.kind === "address")
        return { kind: "address", text: ref.text };
    if (ref.kind === "coordinates") {
        return {
            kind: "coordinates",
            latitude: ref.latitude,
            longitude: ref.longitude,
            label: ref.label ?? null,
        };
    }
    if (ref.kind === "venue")
        return { kind: "venue", venue_id: ref.venue_id };
    return {
        kind: "contact",
        contact_id: ref.contact_id,
        use: ref.use ?? "primary",
        custom_address: ref.custom_address ?? null,
    };
}
function contactAddressLabel(c, custom) {
    if (!c)
        return "Contact";
    if (custom && custom.trim())
        return `${c.name} — ${custom.trim()}`;
    const meta = c.metadata && typeof c.metadata === "object" ? c.metadata : {};
    const addr = typeof meta.address === "string"
        ? meta.address
        : typeof meta.street === "string"
            ? meta.street
            : "";
    if (addr)
        return `${c.name} — ${addr}`;
    return c.name;
}
export async function resolveRouteLocationLabel(client, tenantId, ref) {
    if (ref.kind === "address")
        return ref.text;
    if (ref.kind === "coordinates") {
        if (ref.label && ref.label.trim())
            return ref.label.trim();
        return `${ref.latitude.toFixed(5)}, ${ref.longitude.toFixed(5)}`;
    }
    if (ref.kind === "venue") {
        const v = await getVenueById(client, tenantId, ref.venue_id);
        if (!v)
            return "Venue";
        const parts = [v.name, v.address, v.city].filter(Boolean);
        return parts.join(", ") || v.name;
    }
    const c = await getContactById(client, tenantId, ref.contact_id);
    return contactAddressLabel(c, ref.use === "custom" ? ref.custom_address : null);
}
/** Best-effort coordinate for directions (venue lat/lng, coordinates, geocode not implemented). */
export async function resolveRouteLocationCoordinate(client, tenantId, ref) {
    if (ref.kind === "coordinates") {
        const label = await resolveRouteLocationLabel(client, tenantId, ref);
        return { lat: ref.latitude, lng: ref.longitude, label };
    }
    if (ref.kind === "venue") {
        const v = await getVenueById(client, tenantId, ref.venue_id);
        if (!v)
            return null;
        if (v.latitude != null && v.longitude != null) {
            return { lat: Number(v.latitude), lng: Number(v.longitude), label: v.name };
        }
        return null;
    }
    if (ref.kind === "address") {
        return null;
    }
    const c = await getContactById(client, tenantId, ref.contact_id);
    if (!c)
        return null;
    const meta = c.metadata && typeof c.metadata === "object" ? c.metadata : {};
    const lat = Number(meta.latitude);
    const lng = Number(meta.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng, label: c.name };
    }
    return null;
}
