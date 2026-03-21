import { z } from "zod";

export const createVenueSchema = z.object({
  name: z.string().min(1).max(255),
  city: z.string().max(100).optional().nullable(),
  address: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  timezone: z.string().max(64).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateVenueSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  city: z.string().max(100).optional().nullable(),
  address: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  timezone: z.string().max(64).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
  updated_at: z.string().datetime().optional(),
});

export const listVenuesQuerySchema = z.object({
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const resolveMapsLinkSchema = z.object({
  url: z.string().min(1).max(8000),
});

export const bannerPreviewQuerySchema = z.object({
  variant: z.enum(["google_map", "google_streetview"]).optional().default("google_map"),
});
