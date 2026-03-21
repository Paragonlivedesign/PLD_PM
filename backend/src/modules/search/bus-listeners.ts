import type { Pool } from "pg";
import { domainBus } from "../../domain/bus.js";
import { ENTITY_CUSTOM_FIELDS_UPDATED } from "../../domain/entity-events.js";
import {
  syncDocumentSearchRow,
  syncEventSearchRow,
  syncPersonnelSearchRow,
  syncTruckSearchRow,
} from "./sync-entity.js";
import { removeFromIndex } from "./service.js";

function fire(pool: Pool, fn: () => Promise<void>): void {
  void fn().catch(() => undefined);
}

/** Incremental `search_index` updates (Postgres FTS). Full rebuild: `syncSearchIndexForTenant`. */
export function registerSearchIndexBusListeners(pool: Pool): void {
  domainBus.on("event.created", (p: unknown) => {
    const x = p as { tenant_id?: string; event_id?: string };
    if (x.tenant_id && x.event_id) {
      fire(pool, () => syncEventSearchRow(pool, x.tenant_id!, x.event_id!));
    }
  });
  domainBus.on("event.updated", (p: unknown) => {
    const x = p as { tenant_id?: string; event_id?: string };
    if (x.tenant_id && x.event_id) {
      fire(pool, () => syncEventSearchRow(pool, x.tenant_id!, x.event_id!));
    }
  });
  domainBus.on("event.phaseChanged", (p: unknown) => {
    const x = p as { tenant_id?: string; event_id?: string };
    if (x.tenant_id && x.event_id) {
      fire(pool, () => syncEventSearchRow(pool, x.tenant_id!, x.event_id!));
    }
  });
  domainBus.on("event.deleted", (p: unknown) => {
    const x = p as { tenant_id?: string; event_id?: string };
    if (x.tenant_id && x.event_id) {
      fire(pool, async () => {
        await removeFromIndex(pool, "events", x.event_id!, x.tenant_id!);
      });
    }
  });

  domainBus.on("truck.created", (p: unknown) => {
    const x = p as { tenant_id?: string; truck_id?: string };
    if (x.tenant_id && x.truck_id) {
      fire(pool, () => syncTruckSearchRow(pool, x.tenant_id!, x.truck_id!));
    }
  });
  domainBus.on("truck.updated", (p: unknown) => {
    const x = p as { tenant_id?: string; truck_id?: string };
    if (x.tenant_id && x.truck_id) {
      fire(pool, () => syncTruckSearchRow(pool, x.tenant_id!, x.truck_id!));
    }
  });
  domainBus.on("truck.status_changed", (p: unknown) => {
    const x = p as { tenant_id?: string; truck_id?: string };
    if (x.tenant_id && x.truck_id) {
      fire(pool, () => syncTruckSearchRow(pool, x.tenant_id!, x.truck_id!));
    }
  });

  domainBus.on("document.uploaded", (p: unknown) => {
    const x = p as { tenant_id?: string; document_id?: string };
    if (x.tenant_id && x.document_id) {
      fire(pool, () => syncDocumentSearchRow(pool, x.tenant_id!, x.document_id!));
    }
  });
  domainBus.on("document.generated", (p: unknown) => {
    const x = p as { tenant_id?: string; document_id?: string };
    if (x.tenant_id && x.document_id) {
      fire(pool, () => syncDocumentSearchRow(pool, x.tenant_id!, x.document_id!));
    }
  });

  domainBus.on(ENTITY_CUSTOM_FIELDS_UPDATED, (p: unknown) => {
    const x = p as { tenantId?: string; entityType?: string; entityId?: string };
    if (!x.tenantId || !x.entityType || !x.entityId) return;
    if (x.entityType === "event") {
      fire(pool, () => syncEventSearchRow(pool, x.tenantId!, x.entityId!));
    } else if (x.entityType === "personnel") {
      fire(pool, () => syncPersonnelSearchRow(pool, x.tenantId!, x.entityId!));
    }
  });
}
