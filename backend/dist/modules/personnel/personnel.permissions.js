/** Strips fields based on X-Permissions (comma-separated). * grants all. */
export function projectPersonnel(row, permissions) {
    if (permissions.has("*"))
        return row;
    const out = { ...row };
    if (!permissions.has("personnel:view_rates")) {
        out.day_rate = null;
        out.per_diem = null;
    }
    if (!permissions.has("personnel:view_contact")) {
        out.phone = null;
        out.emergency_contact = null;
    }
    if (!permissions.has("personnel:view_custom")) {
        out.metadata = {};
        out.custom_fields = {};
    }
    return out;
}
