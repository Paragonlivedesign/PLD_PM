import { domainBus } from "../../domain/bus.js";
import { ENTITY_CUSTOM_FIELDS_UPDATED } from "../../domain/entity-events.js";
import { FIELD_DEFINITION_CREATED, FIELD_DEFINITION_DELETED, FIELD_DEFINITION_UPDATED, } from "../custom-fields/events.js";
import * as repo from "./repository.js";
export function registerDocumentStaleListeners(pool) {
    const markEvent = (tenantId, eventId) => {
        void repo.markGeneratedStaleForEvent(pool, tenantId, eventId);
    };
    domainBus.on("event.updated", (p) => {
        const x = p;
        if (x.tenant_id && x.event_id)
            markEvent(x.tenant_id, x.event_id);
    });
    domainBus.on("event.phaseChanged", (p) => {
        const x = p;
        if (x.tenant_id && x.event_id)
            markEvent(x.tenant_id, x.event_id);
    });
    domainBus.on(ENTITY_CUSTOM_FIELDS_UPDATED, (p) => {
        const x = p;
        if (x.tenantId && x.entityType === "event" && x.entityId) {
            markEvent(x.tenantId, x.entityId);
        }
    });
    const markTenant = (tenantId) => {
        void repo.markAllGeneratedStaleForTenant(pool, tenantId);
    };
    domainBus.on(FIELD_DEFINITION_CREATED, (p) => {
        const x = p;
        if (x.tenant_id)
            markTenant(x.tenant_id);
    });
    domainBus.on(FIELD_DEFINITION_UPDATED, (p) => {
        const x = p;
        if (x.tenant_id)
            markTenant(x.tenant_id);
    });
    domainBus.on(FIELD_DEFINITION_DELETED, (p) => {
        const x = p;
        if (x.tenant_id)
            markTenant(x.tenant_id);
    });
}
