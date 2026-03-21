import { z } from "zod";
const brandingSchema = z
    .object({
    company_name: z.string().nullable().optional(),
    logo_url: z.string().nullable().optional(),
    primary_color: z.string().optional(),
})
    .strict();
const passwordPolicySchema = z
    .object({
    min_length: z.number().int().min(1).max(128).optional(),
    require_uppercase: z.boolean().optional(),
    require_number: z.boolean().optional(),
    require_special: z.boolean().optional(),
})
    .strict();
const partialSettingsSchema = z
    .object({
    default_timezone: z.string().optional(),
    default_currency: z.string().min(3).max(3).optional(),
    date_format: z.string().optional(),
    time_format: z.enum(["12h", "24h"]).optional(),
    branding: brandingSchema.optional(),
    password_policy: passwordPolicySchema.optional(),
    features: z.record(z.unknown()).optional(),
})
    .strict();
export function parsePartialTenantSettings(raw) {
    const parsed = partialSettingsSchema.safeParse(raw);
    if (!parsed.success) {
        throw new Error(parsed.error.message);
    }
    return parsed.data;
}
function deepMerge(a, b) {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) {
        if (v !== undefined && v !== null && typeof v === "object" && !Array.isArray(v) && typeof a[k] === "object" && a[k] !== null && !Array.isArray(a[k])) {
            out[k] = deepMerge(a[k], v);
        }
        else {
            out[k] = v;
        }
    }
    return out;
}
const DEFAULT_BRANDING = {
    company_name: null,
    logo_url: null,
    primary_color: "#1a73e8",
};
const DEFAULT_PASSWORD = {
    min_length: 8,
    require_uppercase: true,
    require_number: true,
    require_special: false,
};
export function resolveTenantSettings(stored, tenantName) {
    const brandingIn = stored.branding ?? {};
    const pwIn = stored.password_policy ?? {};
    const branding = {
        company_name: brandingIn.company_name !== undefined && brandingIn.company_name !== null
            ? String(brandingIn.company_name)
            : null,
        logo_url: brandingIn.logo_url !== undefined && brandingIn.logo_url !== null ? String(brandingIn.logo_url) : null,
        primary_color: brandingIn.primary_color !== undefined ? String(brandingIn.primary_color) : DEFAULT_BRANDING.primary_color,
    };
    const password_policy = {
        min_length: typeof pwIn.min_length === "number" ? pwIn.min_length : DEFAULT_PASSWORD.min_length,
        require_uppercase: typeof pwIn.require_uppercase === "boolean" ? pwIn.require_uppercase : DEFAULT_PASSWORD.require_uppercase,
        require_number: typeof pwIn.require_number === "boolean" ? pwIn.require_number : DEFAULT_PASSWORD.require_number,
        require_special: typeof pwIn.require_special === "boolean" ? pwIn.require_special : DEFAULT_PASSWORD.require_special,
    };
    const features = stored.features && typeof stored.features === "object" && stored.features !== null && !Array.isArray(stored.features)
        ? stored.features
        : {};
    return {
        default_timezone: typeof stored.default_timezone === "string" ? stored.default_timezone : "America/New_York",
        default_currency: typeof stored.default_currency === "string" ? stored.default_currency : "USD",
        date_format: typeof stored.date_format === "string" ? stored.date_format : "MM/DD/YYYY",
        time_format: stored.time_format === "24h" ? "24h" : "12h",
        branding: {
            ...branding,
            company_name: branding.company_name ?? tenantName,
        },
        password_policy,
        features,
    };
}
export function mergeSettingsJson(existing, partial) {
    return deepMerge(existing, partial);
}
