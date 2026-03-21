import type { PersonnelResponse } from "./personnel.types.js";

/** Strips fields based on X-Permissions (comma-separated). * grants all. */
export function projectPersonnel(
  row: PersonnelResponse,
  permissions: Set<string>,
): PersonnelResponse {
  if (permissions.has("*")) return row;
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
  }
  return out;
}
