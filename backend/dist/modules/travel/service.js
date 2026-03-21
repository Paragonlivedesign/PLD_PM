import { v7 as uuidv7 } from "uuid";
import { domainBus } from "../../domain/bus.js";
import { pool } from "../../db/pool.js";
import { getEventByIdInternal } from "../events/service.js";
import { getPersonnelById } from "../personnel/index.js";
import { isPersonnelEligibleForEventTravel } from "../scheduling/index.js";
import { decodeTravelCursor, encodeTravelCursor } from "./repository.js";
import * as repo from "./repository.js";
const DEFAULT_CURRENCY = "USD";
function csvToArr(s) {
    if (!s?.trim())
        return undefined;
    return s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
}
function numOrStrToDecimal(v) {
    if (v == null)
        return null;
    if (typeof v === "number" && Number.isFinite(v))
        return String(v);
    if (typeof v === "string" && v.trim())
        return v.trim();
    return null;
}
export async function createTravelRecordApi(input) {
    const ev = await getEventByIdInternal(input.body.event_id, input.tenantId);
    if (!ev) {
        return { ok: false, status: 404, code: "not_found", message: "Event not found" };
    }
    const person = await getPersonnelById(input.body.personnel_id, input.tenantId);
    if (!person) {
        return { ok: false, status: 404, code: "not_found", message: "Personnel not found" };
    }
    const eligible = await isPersonnelEligibleForEventTravel(pool, input.tenantId, String(input.body.event_id), String(input.body.personnel_id));
    if (!eligible) {
        return {
            ok: false,
            status: 400,
            code: "validation",
            message: "Personnel is not assigned to this event (scheduling)",
            field: "personnel_id",
        };
    }
    const dep = new Date(String(input.body.departure_datetime));
    const arr = new Date(String(input.body.arrival_datetime));
    if (dep > arr) {
        return {
            ok: false,
            status: 400,
            code: "validation",
            message: "departure_datetime must be before or equal to arrival_datetime",
            field: "departure_datetime",
        };
    }
    const currency = input.body.currency?.trim().toUpperCase() ?? DEFAULT_CURRENCY;
    const accommodation = input.body.accommodation;
    const id = uuidv7();
    const record = await repo.insertTravelRecord(pool, {
        id,
        tenantId: input.tenantId,
        eventId: String(input.body.event_id),
        personnelId: String(input.body.personnel_id),
        travelType: String(input.body.travel_type),
        direction: String(input.body.direction),
        departureLocation: String(input.body.departure_location),
        arrivalLocation: String(input.body.arrival_location),
        departureDatetime: String(input.body.departure_datetime),
        arrivalDatetime: String(input.body.arrival_datetime),
        carrier: input.body.carrier != null ? String(input.body.carrier) : null,
        bookingReference: input.body.booking_reference != null ? String(input.body.booking_reference) : null,
        seatPreference: input.body.seat_preference != null ? String(input.body.seat_preference) : null,
        cost: numOrStrToDecimal(input.body.cost),
        currency,
        status: input.body.status ?? "planned",
        notes: input.body.notes != null ? String(input.body.notes) : null,
        accommodation: accommodation ?? null,
        metadata: input.body.metadata ?? {},
    });
    if (!record) {
        return { ok: false, status: 500, code: "internal", message: "Failed to create travel record" };
    }
    domainBus.emit("travel.created", {
        travel_id: record.id,
        tenant_id: input.tenantId,
        event_id: record.event_id,
        personnel_id: record.personnel_id,
        travel_type: record.travel_type,
        direction: record.direction,
        departure_location: record.departure_location,
        arrival_location: record.arrival_location,
        departure_datetime: record.departure_datetime,
        cost: record.cost != null ? Number(record.cost) : null,
        has_accommodation: record.accommodation != null,
        accommodation_cost: record.accommodation?.total_cost != null ? Number(record.accommodation.total_cost) : null,
        created_by: input.userId,
        created_at: record.created_at,
    });
    if (record.accommodation) {
        domainBus.emit("rooming.updated", {
            tenant_id: input.tenantId,
            event_id: record.event_id,
            reason: "travel.created",
            travel_id: record.id,
        });
    }
    return { ok: true, record };
}
export async function listTravelRecordsApi(input) {
    const q = input.query;
    const sortBy = q.sort_by || "departure_datetime";
    const sortOrder = (q.sort_order || "asc");
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 25));
    const dec = decodeTravelCursor(q.cursor);
    const cursorVal = dec && dec.sortBy === sortBy ? dec.v : null;
    const cursorId = dec && dec.sortBy === sortBy ? dec.id : null;
    const hasAcc = q.has_accommodation;
    const p = {
        tenantId: input.tenantId,
        eventId: q.event_id,
        personnelId: q.personnel_id,
        travelTypes: csvToArr(q.travel_type),
        directions: csvToArr(q.direction),
        statuses: csvToArr(q.status),
        dateRangeStart: q.date_range_start,
        dateRangeEnd: q.date_range_end,
        hasAccommodation: hasAcc === "true" || hasAcc === "1" ? true : hasAcc === "false" || hasAcc === "0" ? false : undefined,
        search: q.search,
        sortBy: (["departure_datetime", "personnel_name", "created_at"].includes(sortBy)
            ? sortBy
            : "departure_datetime"),
        sortOrder,
        limit: limit + 1,
        cursorVal,
        cursorId,
    };
    const total = await repo.countTravelRecords(pool, p);
    const rows = await repo.listTravelRecords(pool, p);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeTravelCursor(last, p.sortBy) : null;
    return { rows: page, total, nextCursor };
}
export async function getTravelRecordApi(tenantId, id) {
    return repo.getTravelById(pool, tenantId, id);
}
export async function updateTravelRecordApi(input) {
    const existing = await repo.getTravelById(pool, input.tenantId, input.id);
    if (!existing) {
        return { ok: false, status: 404, code: "not_found", message: "Travel record not found" };
    }
    const b = input.body;
    const patch = {};
    if (b.travel_type != null)
        patch.travel_type = String(b.travel_type);
    if (b.direction != null)
        patch.direction = String(b.direction);
    if (b.departure_location != null)
        patch.departure_location = String(b.departure_location);
    if (b.arrival_location != null)
        patch.arrival_location = String(b.arrival_location);
    if (b.departure_datetime != null)
        patch.departure_datetime = String(b.departure_datetime);
    if (b.arrival_datetime != null)
        patch.arrival_datetime = String(b.arrival_datetime);
    if (b.carrier !== undefined)
        patch.carrier = b.carrier != null ? String(b.carrier) : null;
    if (b.booking_reference !== undefined) {
        patch.booking_reference = b.booking_reference != null ? String(b.booking_reference) : null;
    }
    if (b.seat_preference !== undefined) {
        patch.seat_preference = b.seat_preference != null ? String(b.seat_preference) : null;
    }
    if (b.cost !== undefined)
        patch.cost = numOrStrToDecimal(b.cost);
    if (b.currency != null)
        patch.currency = String(b.currency).trim().toUpperCase();
    if (b.status != null)
        patch.status = String(b.status);
    if (b.notes !== undefined)
        patch.notes = b.notes != null ? String(b.notes) : null;
    if (b.accommodation !== undefined) {
        patch.accommodation = b.accommodation ?? null;
    }
    if (b.metadata != null)
        patch.metadata = b.metadata;
    const dep = patch.departure_datetime
        ? new Date(patch.departure_datetime)
        : new Date(existing.departure_datetime);
    const arr = patch.arrival_datetime
        ? new Date(patch.arrival_datetime)
        : new Date(existing.arrival_datetime);
    if (dep > arr) {
        return {
            ok: false,
            status: 400,
            code: "validation",
            message: "departure_datetime must be before or equal to arrival_datetime",
            field: "departure_datetime",
        };
    }
    const prev = {};
    const newVals = {};
    for (const k of Object.keys(patch)) {
        prev[k] = existing[k];
        newVals[k] = patch[k];
    }
    const record = await repo.updateTravelRecordRow(pool, input.tenantId, input.id, patch);
    if (!record) {
        return { ok: false, status: 404, code: "not_found", message: "Travel record not found" };
    }
    const changed = Object.keys(patch);
    const costChanged = patch.cost !== undefined || patch.currency != null || patch.accommodation !== undefined;
    domainBus.emit("travel.updated", {
        travel_id: record.id,
        tenant_id: input.tenantId,
        event_id: record.event_id,
        personnel_id: record.personnel_id,
        changed_fields: changed,
        previous_values: prev,
        new_values: newVals,
        cost_changed: costChanged,
        updated_by: input.userId,
        updated_at: record.updated_at,
    });
    if (patch.accommodation !== undefined ||
        existing.accommodation != null ||
        record.accommodation != null) {
        domainBus.emit("rooming.updated", {
            tenant_id: input.tenantId,
            event_id: record.event_id,
            reason: "travel.updated",
            travel_id: record.id,
        });
    }
    return { ok: true, record };
}
export async function deleteTravelRecordApi(input) {
    const existing = await repo.getTravelById(pool, input.tenantId, input.id);
    if (!existing) {
        return { ok: false, status: 404, code: "not_found", message: "Travel record not found" };
    }
    const del = await repo.softDeleteTravel(pool, input.tenantId, input.id);
    if (!del) {
        return { ok: false, status: 404, code: "not_found", message: "Travel record not found" };
    }
    domainBus.emit("travel.deleted", {
        travel_id: existing.id,
        tenant_id: input.tenantId,
        event_id: existing.event_id,
        personnel_id: existing.personnel_id,
        travel_type: existing.travel_type,
        cost: existing.cost != null ? Number(existing.cost) : null,
        accommodation_cost: existing.accommodation?.total_cost != null ? Number(existing.accommodation.total_cost) : null,
        deleted_by: input.userId,
        deleted_at: del.deleted_at,
    });
    if (existing.accommodation) {
        domainBus.emit("rooming.updated", {
            tenant_id: input.tenantId,
            event_id: existing.event_id,
            reason: "travel.deleted",
            travel_id: existing.id,
        });
    }
    return { ok: true, deleted: del };
}
export async function getEventTravelManifestApi(input) {
    const ev = await getEventByIdInternal(input.eventId, input.tenantId);
    if (!ev) {
        return { ok: false, status: 404, code: "not_found", message: "Event not found" };
    }
    const direction = input.query.direction;
    const statuses = csvToArr(input.query.status);
    const sortBy = input.query.sort_by || "departure_datetime";
    const rows = await repo.listTravelForEvent(pool, input.tenantId, input.eventId, {
        direction,
        statuses,
        sortBy: sortBy === "personnel_name" ? "personnel_name" : "departure_datetime",
        sortOrder: "asc",
    });
    const byPid = new Map();
    let travelCost = 0;
    let accCost = 0;
    let currency = DEFAULT_CURRENCY;
    for (const r of rows) {
        currency = r.currency || currency;
        if (r.cost != null)
            travelCost += Number(r.cost);
        if (r.accommodation?.total_cost != null)
            accCost += Number(r.accommodation.total_cost);
        let g = byPid.get(r.personnel_id);
        if (!g) {
            g = { personnel_id: r.personnel_id, personnel_name: r.personnel_name, records: [] };
            byPid.set(r.personnel_id, g);
        }
        g.records.push(r);
    }
    return {
        ok: true,
        data: {
            event_id: ev.id,
            event_name: ev.name,
            personnel_travel: [...byPid.values()],
        },
        meta: {
            total_records: rows.length,
            total_personnel: byPid.size,
            total_travel_cost: String(travelCost),
            total_accommodation_cost: String(accCost),
            currency,
        },
    };
}
export async function getPersonnelTravelListApi(input) {
    const person = await getPersonnelById(input.personnelId, input.tenantId);
    if (!person) {
        return { ok: false, status: 404, code: "not_found", message: "Personnel not found" };
    }
    const q = input.query;
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 25));
    const dec = decodeTravelCursor(q.cursor);
    const cursorVal = dec?.sortBy === "departure_datetime" ? dec.v : null;
    const cursorId = dec?.sortBy === "departure_datetime" ? dec.id : null;
    const p = {
        tenantId: input.tenantId,
        personnelId: input.personnelId,
        dateRangeStart: q.date_range_start,
        dateRangeEnd: q.date_range_end,
        eventId: q.event_id,
        statuses: csvToArr(q.status),
        limit: limit + 1,
        cursorVal,
        cursorId,
        sortOrder: "desc",
    };
    const total = await repo.countTravelRecords(pool, {
        tenantId: p.tenantId,
        personnelId: p.personnelId,
        eventId: p.eventId,
        dateRangeStart: p.dateRangeStart,
        dateRangeEnd: p.dateRangeEnd,
        statuses: p.statuses,
    });
    const rows = await repo.listTravelForPersonnel(pool, input.tenantId, input.personnelId, p);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeTravelCursor(last, "departure_datetime") : null;
    let sum = 0;
    let currency = DEFAULT_CURRENCY;
    for (const r of page) {
        currency = r.currency || currency;
        if (r.cost != null)
            sum += Number(r.cost);
        if (r.accommodation?.total_cost != null)
            sum += Number(r.accommodation.total_cost);
    }
    return {
        ok: true,
        rows: page,
        total,
        nextCursor,
        total_cost: String(sum),
        currency,
    };
}
function buildRoomingFromRecords(rows, eventName, eventId, filterDate, filterHotel) {
    const hotelsMap = new Map();
    for (const tr of rows) {
        if (!tr.accommodation)
            continue;
        const a = tr.accommodation;
        if (filterHotel && !a.hotel_name.toLowerCase().includes(filterHotel.toLowerCase()))
            continue;
        if (filterDate) {
            const night = filterDate >= a.check_in_date && filterDate < a.check_out_date;
            if (!night)
                continue;
        }
        const hKey = `${a.hotel_name}|||${a.address ?? ""}`;
        let h = hotelsMap.get(hKey);
        if (!h) {
            h = { hotel_name: a.hotel_name, address: a.address, rooms: new Map() };
            hotelsMap.set(hKey, h);
        }
        const rKey = `${a.check_in_date}|${a.check_out_date}|${a.room_type ?? ""}|${a.confirmation_number ?? ""}|${a.nightly_rate ?? ""}`;
        let room = h.rooms.get(rKey);
        if (!room) {
            room = {
                room_type: a.room_type,
                confirmation_number: a.confirmation_number,
                check_in_date: a.check_in_date,
                check_out_date: a.check_out_date,
                nightly_rate: a.nightly_rate,
                guests: [],
            };
            h.rooms.set(rKey, room);
        }
        room.guests.push({
            personnel_id: tr.personnel_id,
            personnel_name: tr.personnel_name,
            travel_record_id: tr.id,
        });
    }
    const hotels = [];
    let totalGuests = 0;
    let totalRoomNightsAll = 0;
    let totalAccCost = 0;
    let currency = DEFAULT_CURRENCY;
    for (const h of hotelsMap.values()) {
        const rooms = [...h.rooms.values()];
        let hotelNights = 0;
        let hotelCost = 0;
        for (const rm of rooms) {
            const nights = Math.max(0, Math.round((new Date(`${rm.check_out_date}T00:00:00.000Z`).getTime() -
                new Date(`${rm.check_in_date}T00:00:00.000Z`).getTime()) /
                86400000));
            hotelNights += nights * Math.max(1, rm.guests.length);
            totalGuests += rm.guests.length;
            const seenTr = new Set();
            for (const g of rm.guests) {
                if (seenTr.has(g.travel_record_id))
                    continue;
                seenTr.add(g.travel_record_id);
                const tr = rows.find((r) => r.id === g.travel_record_id);
                if (tr?.accommodation?.total_cost != null)
                    hotelCost += Number(tr.accommodation.total_cost);
                if (tr)
                    currency = tr.currency || currency;
            }
        }
        totalRoomNightsAll += hotelNights;
        totalAccCost += hotelCost;
        hotels.push({
            hotel_name: h.hotel_name,
            address: h.address,
            rooms,
            total_rooms: rooms.length,
            total_room_nights: hotelNights,
            total_cost: hotelCost > 0 ? String(hotelCost) : null,
        });
    }
    return {
        data: {
            event_id: eventId,
            event_name: eventName,
            hotels,
        },
        meta: {
            total_hotels: hotels.length,
            total_rooms: hotels.reduce((s, h) => s + h.total_rooms, 0),
            total_guests: totalGuests,
            total_room_nights: totalRoomNightsAll,
            total_accommodation_cost: String(totalAccCost),
            currency,
        },
    };
}
export async function getRoomingForEventApi(input) {
    const ev = await getEventByIdInternal(input.eventId, input.tenantId);
    if (!ev) {
        return { ok: false, status: 404, code: "not_found", message: "Event not found" };
    }
    const rows = await repo.listTravelForEvent(pool, input.tenantId, input.eventId, {
        sortBy: "departure_datetime",
        sortOrder: "asc",
    });
    const withAcc = rows.filter((r) => r.accommodation != null);
    const filterDate = input.query.date;
    const filterHotel = input.query.hotel_name;
    const built = buildRoomingFromRecords(withAcc, ev.name, ev.id, filterDate?.slice(0, 10), filterHotel);
    return { ok: true, data: built.data, meta: built.meta };
}
/** Internal — contract */
export async function getTravelByEvent(event_id, tenant_id, options) {
    const statuses = options?.include_cancelled === false && !options?.status
        ? ["planned", "booked", "confirmed"]
        : options?.status;
    return repo.listTravelForEvent(pool, tenant_id, event_id, {
        direction: options?.direction,
        statuses,
        sortBy: "departure_datetime",
        sortOrder: "asc",
    });
}
export async function getTravelByPersonnel(personnel_id, tenant_id, options) {
    const statuses = options?.status ??
        (options?.include_cancelled === false ? ["planned", "booked", "confirmed"] : undefined);
    return repo.listTravelForPersonnel(pool, tenant_id, personnel_id, {
        dateRangeStart: options?.date_range_start,
        dateRangeEnd: options?.date_range_end,
        eventId: options?.event_id,
        statuses: statuses,
        limit: 50_000,
        cursorVal: null,
        cursorId: null,
        sortOrder: "desc",
    });
}
export async function getTravelCosts(event_id, tenant_id, options) {
    const rows = await getTravelByEvent(event_id, tenant_id, {
        include_cancelled: options?.include_cancelled,
        status: options?.status,
    });
    let currency = DEFAULT_CURRENCY;
    const byType = new Map();
    const byPerson = new Map();
    let travelSum = 0;
    let accSum = 0;
    for (const r of rows) {
        currency = r.currency || currency;
        const tc = r.cost != null ? Number(r.cost) : 0;
        const ac = r.accommodation?.total_cost != null ? Number(r.accommodation.total_cost) : 0;
        travelSum += tc;
        accSum += ac;
        const t = byType.get(r.travel_type) ?? { cost: 0, count: 0 };
        t.cost += tc;
        t.count += 1;
        byType.set(r.travel_type, t);
        const pe = byPerson.get(r.personnel_id) ?? { name: r.personnel_name, travel: 0, acc: 0 };
        pe.travel += tc;
        pe.acc += ac;
        byPerson.set(r.personnel_id, pe);
    }
    return {
        event_id,
        currency,
        travel_cost: String(travelSum),
        accommodation_cost: String(accSum),
        total_cost: String(travelSum + accSum),
        breakdown: {
            by_type: [...byType.entries()].map(([travel_type, v]) => ({
                travel_type,
                cost: String(v.cost),
                count: v.count,
            })),
            by_personnel: [...byPerson.entries()].map(([personnel_id, v]) => ({
                personnel_id,
                personnel_name: v.name,
                travel_cost: String(v.travel),
                accommodation_cost: String(v.acc),
                total: String(v.travel + v.acc),
            })),
        },
    };
}
export async function getRoomingList(event_id, tenant_id, options) {
    const ev = await getEventByIdInternal(event_id, tenant_id);
    if (!ev) {
        return { event_id, hotels: [], total_rooms: 0, total_guests: 0 };
    }
    const full = await getRoomingForEventApi({
        tenantId: tenant_id,
        eventId: event_id,
        query: { date: options?.date, hotel_name: options?.hotel_name },
    });
    if (!full.ok) {
        return { event_id, hotels: [], total_rooms: 0, total_guests: 0 };
    }
    const hotels = full.data.hotels.map((h) => ({
        hotel_name: h.hotel_name,
        rooms: h.rooms.map((rm) => ({
            room_type: rm.room_type,
            check_in_date: rm.check_in_date,
            check_out_date: rm.check_out_date,
            guests: rm.guests.map((g) => ({
                personnel_id: g.personnel_id,
                personnel_name: g.personnel_name,
            })),
        })),
        total_rooms: h.total_rooms,
    }));
    return {
        event_id,
        hotels,
        total_rooms: full.meta.total_rooms,
        total_guests: full.meta.total_guests,
    };
}
