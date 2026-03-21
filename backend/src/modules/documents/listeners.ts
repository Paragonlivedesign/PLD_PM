import type { Pool } from "pg";
import { domainBus } from "../../domain/bus.js";
import { ENTITY_CUSTOM_FIELDS_UPDATED } from "../../domain/entity-events.js";
import {
  FIELD_DEFINITION_CREATED,
  FIELD_DEFINITION_DELETED,
  FIELD_DEFINITION_UPDATED,
} from "../custom-fields/events.js";
import * as repo from "./repository.js";

export function registerDocumentStaleListeners(pool: Pool): void {
  const markEvent = (tenantId: string, eventId: string) => {
    void repo.markGeneratedStaleForEvent(pool, tenantId, eventId);
  };
  domainBus.on("event.updated", (p: unknown) => {
    const x = p as { tenant_id?: string; event_id?: string };
    if (x.tenant_id && x.event_id) markEvent(x.tenant_id, x.event_id);
  });
  domainBus.on("event.phaseChanged", (p: unknown) => {
    const x = p as { tenant_id?: string; event_id?: string };
    if (x.tenant_id && x.event_id) markEvent(x.tenant_id, x.event_id);
  });
  domainBus.on(ENTITY_CUSTOM_FIELDS_UPDATED, (p: unknown) => {
    const x = p as { tenantId?: string; entityType?: string; entityId?: string };
    if (x.tenantId && x.entityType === "event" && x.entityId) {
      markEvent(x.tenantId, x.entityId);
    }
  });
  const markTenant = (tenantId: string) => {
    void repo.markAllGeneratedStaleForTenant(pool, tenantId);
  };
  domainBus.on(FIELD_DEFINITION_CREATED, (p: unknown) => {
    const x = p as { tenant_id?: string };
    if (x.tenant_id) markTenant(x.tenant_id);
  });
  domainBus.on(FIELD_DEFINITION_UPDATED, (p: unknown) => {
    const x = p as { tenant_id?: string };
    if (x.tenant_id) markTenant(x.tenant_id);
  });
  domainBus.on(FIELD_DEFINITION_DELETED, (p: unknown) => {
    const x = p as { tenant_id?: string };
    if (x.tenant_id) markTenant(x.tenant_id);
  });
}
