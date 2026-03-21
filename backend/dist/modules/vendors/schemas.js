import { z } from "zod";
const uuid = z.string().uuid();
export const createVendorSchema = z.object({
    name: z.string().min(1).max(255),
    contact_name: z.string().max(255).optional().nullable(),
    contact_email: z.string().max(255).optional().nullable(),
    phone: z.string().max(64).optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
    metadata: z.record(z.unknown()).optional(),
    linked_client_id: uuid.optional().nullable(),
});
export const updateVendorSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    contact_name: z.string().max(255).optional().nullable(),
    contact_email: z.string().max(255).optional().nullable(),
    phone: z.string().max(64).optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
    metadata: z.record(z.unknown()).optional(),
    linked_client_id: uuid.optional().nullable(),
    updated_at: z.string().datetime().optional(),
});
export const listVendorsQuerySchema = z.object({
    search: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});
