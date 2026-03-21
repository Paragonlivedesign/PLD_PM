import { z } from "zod";
const uuid = z.string().uuid();
const eventStatusZ = z.enum([
    "draft",
    "bidding",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
]);
const eventPhaseZ = z.enum([
    "planning",
    "pre_production",
    "production",
    "post_production",
    "closed",
]);
export const createEventSchema = z
    .object({
    name: z.string().min(1).max(255),
    client_id: uuid,
    venue_id: uuid.optional().nullable(),
    primary_contact_id: uuid.optional().nullable(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    load_in_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .nullable(),
    load_out_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .nullable(),
    status: eventStatusZ.optional(),
    phase: eventPhaseZ.optional(),
    description: z.string().max(5000).optional().nullable(),
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
    custom_fields: z.record(z.unknown()).optional(),
})
    .superRefine((v, ctx) => {
    if (v.load_in_date && v.load_in_date > v.start_date) {
        ctx.addIssue({
            code: "custom",
            message: "load_in_date must be <= start_date",
            path: ["load_in_date"],
        });
    }
    if (v.load_out_date && v.load_out_date < v.end_date) {
        ctx.addIssue({
            code: "custom",
            message: "load_out_date must be >= end_date",
            path: ["load_out_date"],
        });
    }
});
export const updateEventSchema = z
    .object({
    name: z.string().min(1).max(255).optional(),
    client_id: uuid.optional(),
    venue_id: uuid.optional().nullable(),
    primary_contact_id: uuid.optional().nullable(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    load_in_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .nullable(),
    load_out_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .nullable(),
    status: eventStatusZ.optional(),
    phase: eventPhaseZ.optional(),
    description: z.string().max(5000).optional().nullable(),
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
    custom_fields: z.record(z.unknown()).optional(),
    updated_at: z.string().datetime().optional(),
})
    .superRefine((v, ctx) => {
    if (v.load_in_date && v.start_date && v.load_in_date > v.start_date) {
        ctx.addIssue({
            code: "custom",
            message: "load_in_date must be <= start_date",
            path: ["load_in_date"],
        });
    }
    if (v.load_out_date && v.end_date && v.load_out_date < v.end_date) {
        ctx.addIssue({
            code: "custom",
            message: "load_out_date must be >= end_date",
            path: ["load_out_date"],
        });
    }
});
export const cloneEventSchema = z.object({
    name: z.string().min(1).max(255),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    clone_options: z
        .object({
        include_venue: z.boolean().optional(),
        include_tags: z.boolean().optional(),
        include_metadata: z.boolean().optional(),
    })
        .optional(),
});
export const updatePhaseSchema = z.object({
    phase: eventPhaseZ,
    notes: z.string().max(2000).optional().nullable(),
});
export const listEventsQuerySchema = z.object({
    status: z.string().optional(),
    phase: z.string().optional(),
    client_id: z.string().uuid().optional(),
    venue_id: z.string().uuid().optional(),
    date_range_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_range_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    search: z.string().optional(),
    sort_by: z
        .enum(["name", "start_date", "end_date", "created_at", "updated_at"])
        .optional(),
    sort_order: z.enum(["asc", "desc"]).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});
