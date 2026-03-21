import { z } from "zod";
const travelTypeZ = z.enum([
    "flight",
    "train",
    "bus",
    "car_rental",
    "rideshare",
    "personal_vehicle",
    "other",
]);
const directionZ = z.enum(["outbound", "return", "inter_venue"]);
const statusZ = z.enum(["planned", "booked", "confirmed", "cancelled"]);
const accommodationZ = z.object({
    hotel_name: z.string().min(1),
    address: z.string().nullable().optional(),
    check_in_date: z.string().min(1),
    check_out_date: z.string().min(1),
    room_type: z.string().nullable().optional(),
    confirmation_number: z.string().nullable().optional(),
    nightly_rate: z.union([z.number(), z.string()]).nullable().optional(),
    total_cost: z.union([z.number(), z.string()]).nullable().optional(),
    sharing_with: z.string().uuid().nullable().optional(),
    notes: z.string().nullable().optional(),
});
export const createTravelRecordSchema = z.object({
    event_id: z.string().uuid(),
    personnel_id: z.string().uuid(),
    travel_type: travelTypeZ,
    direction: directionZ,
    departure_location: z.string().min(1),
    arrival_location: z.string().min(1),
    departure_datetime: z.string().min(1),
    arrival_datetime: z.string().min(1),
    carrier: z.string().nullable().optional(),
    booking_reference: z.string().nullable().optional(),
    seat_preference: z.string().nullable().optional(),
    cost: z.union([z.number(), z.string()]).nullable().optional(),
    currency: z.string().length(3).nullable().optional(),
    status: statusZ.optional(),
    notes: z.string().nullable().optional(),
    accommodation: accommodationZ.nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});
export const updateTravelRecordSchema = z
    .object({
    travel_type: travelTypeZ.optional(),
    direction: directionZ.optional(),
    departure_location: z.string().min(1).optional(),
    arrival_location: z.string().min(1).optional(),
    departure_datetime: z.string().min(1).optional(),
    arrival_datetime: z.string().min(1).optional(),
    carrier: z.string().nullable().optional(),
    booking_reference: z.string().nullable().optional(),
    seat_preference: z.string().nullable().optional(),
    cost: z.union([z.number(), z.string()]).nullable().optional(),
    currency: z.string().length(3).nullable().optional(),
    status: statusZ.optional(),
    notes: z.string().nullable().optional(),
    accommodation: accommodationZ.nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
})
    .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });
export const listTravelQuerySchema = z.object({
    event_id: z.string().uuid().optional(),
    personnel_id: z.string().uuid().optional(),
    travel_type: z.string().optional(),
    direction: z.string().optional(),
    status: z.string().optional(),
    date_range_start: z.string().optional(),
    date_range_end: z.string().optional(),
    has_accommodation: z.enum(["true", "false", "1", "0"]).optional(),
    search: z.string().optional(),
    sort_by: z.enum(["departure_datetime", "personnel_name", "created_at"]).optional(),
    sort_order: z.enum(["asc", "desc"]).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});
export const eventTravelQuerySchema = z.object({
    direction: directionZ.optional(),
    status: z.string().optional(),
    sort_by: z.enum(["departure_datetime", "personnel_name"]).optional(),
});
export const personnelTravelQuerySchema = z.object({
    date_range_start: z.string().optional(),
    date_range_end: z.string().optional(),
    event_id: z.string().uuid().optional(),
    status: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});
export const roomingQuerySchema = z.object({
    date: z.string().optional(),
    hotel_name: z.string().optional(),
});
