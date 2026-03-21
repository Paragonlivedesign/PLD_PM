import { domainBus } from "../../domain/bus.js";
import { ENTITY_CUSTOM_FIELDS_UPDATED } from "../../domain/entity-events.js";
import { syncDocumentSearchRow, syncEventSearchRow, syncPersonnelSearchRow, syncTruckSearchRow, } from "./sync-entity.js";
import { removeFromIndex } from "./service.js";
function fire(pool, fn) {
    void fn().catch(() => undefined);
}
/** Incremental `search_index` updates (Postgres FTS). Full rebuild: `syncSearchIndexForTenant`. */
export function registerSearchIndexBusListeners(pool) {
    domainBus.on("event.created", (p) => {
        const x = p;
        if (x.tenant_id && x.event_id) {
            fire(pool, () => syncEventSearchRow(pool, x.tenant_id, x.event_id));
        }
    });
    domainBus.on("event.updated", (p) => {
        const x = p;
        if (x.tenant_id && x.event_id) {
            fire(pool, () => syncEventSearchRow(pool, x.tenant_id, x.event_id));
        }
    });
    domainBus.on("event.phaseChanged", (p) => {
        const x = p;
        if (x.tenant_id && x.event_id) {
            fire(pool, () => syncEventSearchRow(pool, x.tenant_id, x.event_id));
        }
    });
    domainBus.on("event.deleted", (p) => {
        const x = p;
        if (x.tenant_id && x.event_id) {
            fire(pool, async () => {
                await removeFromIndex(pool, "events", x.event_id, x.tenant_id);
            });
        }
    });
    domainBus.on("truck.created", (p) => {
        const x = p;
        if (x.tenant_id && x.truck_id) {
            fire(pool, () => syncTruckSearchRow(pool, x.tenant_id, x.truck_id));
        }
    });
    domainBus.on("truck.updated", (p) => {
        const x = p;
        if (x.tenant_id && x.truck_id) {
            fire(pool, () => syncTruckSearchRow(pool, x.tenant_id, x.truck_id));
        }
    });
    domainBus.on("truck.status_changed", (p) => {
        const x = p;
        if (x.tenant_id && x.truck_id) {
            fire(pool, () => syncTruckSearchRow(pool, x.tenant_id, x.truck_id));
        }
    });
    domainBus.on("document.uploaded", (p) => {
        const x = p;
        if (x.tenant_id && x.document_id) {
            fire(pool, () => syncDocumentSearchRow(pool, x.tenant_id, x.document_id));
        }
    });
    domainBus.on("document.generated", (p) => {
        const x = p;
        if (x.tenant_id && x.document_id) {
            fire(pool, () => syncDocumentSearchRow(pool, x.tenant_id, x.document_id));
        }
    });
    domainBus.on(ENTITY_CUSTOM_FIELDS_UPDATED, (p) => {
        const x = p;
        if (!x.tenantId || !x.entityType || !x.entityId)
            return;
        if (x.entityType === "event") {
            fire(pool, () => syncEventSearchRow(pool, x.tenantId, x.entityId));
        }
        else if (x.entityType === "personnel") {
            fire(pool, () => syncPersonnelSearchRow(pool, x.tenantId, x.entityId));
        }
        else if (x.entityType === "truck") {
            fire(pool, () => syncTruckSearchRow(pool, x.tenantId, x.entityId));
        }
    });
}
