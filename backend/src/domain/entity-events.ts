import { domainBus } from "./bus.js";

/** Emitted by owning modules after persisting `custom_fields` JSONB so Custom Fields can refresh search index. */
export const ENTITY_CUSTOM_FIELDS_UPDATED = "pld.entity.custom_fields.updated" as const;

export type EntityCustomFieldsUpdatedPayload = {
  tenantId: string;
  entityType: string;
  entityId: string;
};

export function emitEntityCustomFieldsUpdated(payload: EntityCustomFieldsUpdatedPayload): void {
  domainBus.emit(ENTITY_CUSTOM_FIELDS_UPDATED, payload);
}
