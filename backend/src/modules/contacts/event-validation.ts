import type { Pool, PoolClient } from "pg";
import type { ContactParentType } from "@pld/shared";
import * as repo from "./repository.js";

/** Returns error message or null if valid. */
export async function validatePrimaryContactForEvent(
  db: Pool | PoolClient,
  tenantId: string,
  contactId: string,
  eventClientId: string,
  eventVenueId: string | null,
): Promise<string | null> {
  const c = await repo.getContactById(db, tenantId, contactId);
  if (!c) {
    return "primary_contact not found";
  }
  const pt = c.parent_type as ContactParentType;
  if (pt === "client_organization") {
    if (c.parent_id !== eventClientId) {
      return "primary_contact must belong to the event client";
    }
    return null;
  }
  if (pt === "venue") {
    if (!eventVenueId || c.parent_id !== eventVenueId) {
      return "primary_contact must belong to the event venue when using a venue contact";
    }
    return null;
  }
  if (pt === "vendor_organization") {
    return "primary_contact cannot be a vendor-only contact; use a client or venue contact";
  }
  return "invalid contact parent_type";
}
