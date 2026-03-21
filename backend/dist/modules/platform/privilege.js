/**
 * Platform operators (cross-tenant). Email allowlist from env — not stored in DB.
 * Set PLD_PLATFORM_ADMIN_EMAILS=comma@separated,emails
 */
export function isPlatformAdminEmail(email) {
    const raw = process.env.PLD_PLATFORM_ADMIN_EMAILS?.trim();
    if (!raw || !email)
        return false;
    const allow = new Set(raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean));
    return allow.has(email.trim().toLowerCase());
}
