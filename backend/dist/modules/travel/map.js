function iso(d) {
    return d.toISOString();
}
function nightsBetween(checkIn, checkOut) {
    const a = new Date(`${checkIn}T00:00:00.000Z`);
    const b = new Date(`${checkOut}T00:00:00.000Z`);
    const n = Math.round((b.getTime() - a.getTime()) / 86400000);
    return Number.isFinite(n) && n > 0 ? n : 0;
}
function decStr(v) {
    if (v == null)
        return null;
    return typeof v === "number" ? String(v) : String(v);
}
function parseAccommodation(raw, shareFirst, shareLast) {
    if (raw == null || typeof raw !== "object")
        return null;
    const a = raw;
    if (!a.hotel_name || !a.check_in_date || !a.check_out_date)
        return null;
    const total_nights = nightsBetween(a.check_in_date, a.check_out_date);
    const sharingName = shareFirst != null && shareLast != null
        ? `${shareFirst} ${shareLast}`.trim()
        : null;
    return {
        hotel_name: a.hotel_name,
        address: a.address ?? null,
        check_in_date: a.check_in_date,
        check_out_date: a.check_out_date,
        room_type: a.room_type ?? null,
        confirmation_number: a.confirmation_number ?? null,
        nightly_rate: decStr(a.nightly_rate),
        total_nights,
        total_cost: decStr(a.total_cost),
        sharing_with: a.sharing_with ?? null,
        sharing_with_name: sharingName && sharingName.length ? sharingName : null,
        notes: a.notes ?? null,
    };
}
export function mapRowToResponse(row) {
    const fn = row.personnel_first ?? "";
    const ln = row.personnel_last ?? "";
    const personnel_name = `${fn} ${ln}`.trim() || "—";
    const acc = parseAccommodation(row.accommodation, row.share_first, row.share_last);
    return {
        id: row.id,
        event_id: row.event_id,
        event_name: row.event_name ?? "",
        personnel_id: row.personnel_id,
        personnel_name,
        travel_type: row.travel_type,
        direction: row.direction,
        departure_location: row.departure_location,
        arrival_location: row.arrival_location,
        departure_datetime: iso(row.departure_datetime instanceof Date
            ? row.departure_datetime
            : new Date(row.departure_datetime)),
        arrival_datetime: iso(row.arrival_datetime instanceof Date
            ? row.arrival_datetime
            : new Date(row.arrival_datetime)),
        carrier: row.carrier,
        booking_reference: row.booking_reference,
        seat_preference: row.seat_preference,
        cost: row.cost != null ? String(row.cost) : null,
        currency: row.currency,
        status: row.status,
        notes: row.notes,
        accommodation: acc,
        metadata: row.metadata && typeof row.metadata === "object"
            ? row.metadata
            : {},
        created_at: iso(row.created_at instanceof Date ? row.created_at : new Date(row.created_at)),
        updated_at: iso(row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at)),
    };
}
