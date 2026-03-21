import { z } from "zod";

const uuid = z.string().uuid();

export const updateVendorSchema = z.object({
  linked_client_id: uuid.optional().nullable(),
});
