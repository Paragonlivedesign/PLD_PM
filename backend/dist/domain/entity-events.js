import { domainBus } from "./bus.js";
/** Emitted by owning modules after persisting `custom_fields` JSONB so Custom Fields can refresh search index. */
export const ENTITY_CUSTOM_FIELDS_UPDATED = "pld.entity.custom_fields.updated";
export function emitEntityCustomFieldsUpdated(payload) {
    domainBus.emit(ENTITY_CUSTOM_FIELDS_UPDATED, payload);
}
