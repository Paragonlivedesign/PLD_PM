import { z } from "zod";
export const createClientSchema = z.object({
    name: z.string().min(1).max(255),
    contact_name: z.string().max(255).optional().nullable(),
    contact_email: z.string().max(255).optional().nullable(),
    phone: z.string().max(64).optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
    metadata: z.record(z.unknown()).optional(),
});
export const updateClientSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    contact_name: z.string().max(255).optional().nullable(),
    contact_email: z.string().max(255).optional().nullable(),
    phone: z.string().max(64).optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
    metadata: z.record(z.unknown()).optional(),
    updated_at: z.string().datetime().optional(),
});
export const listClientsQuerySchema = z.object({
    search: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});
