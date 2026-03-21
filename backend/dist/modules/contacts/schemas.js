import { z } from "zod";
const uuid = z.string().uuid();
export const createContactBodySchema = z.object({
    name: z.string().min(1).max(255),
    email: z.string().email().max(255).optional().nullable(),
    phone: z.string().max(64).optional().nullable(),
    title: z.string().max(255).optional().nullable(),
    personnel_id: uuid.optional().nullable(),
    is_primary: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
});
export const updateContactBodySchema = z.object({
    name: z.string().min(1).max(255).optional(),
    email: z.string().email().max(255).optional().nullable(),
    phone: z.string().max(64).optional().nullable(),
    title: z.string().max(255).optional().nullable(),
    personnel_id: uuid.optional().nullable(),
    is_primary: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
});
