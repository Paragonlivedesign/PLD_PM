import { domainBus } from "../../domain/bus.js";
export const FIELD_DEFINITION_CREATED = "fieldDefinition.created";
export const FIELD_DEFINITION_UPDATED = "fieldDefinition.updated";
export const FIELD_DEFINITION_DELETED = "fieldDefinition.deleted";
export function publishFieldDefinitionCreated(p) {
    domainBus.emit(FIELD_DEFINITION_CREATED, p);
}
export function publishFieldDefinitionUpdated(p) {
    domainBus.emit(FIELD_DEFINITION_UPDATED, p);
}
export function publishFieldDefinitionDeleted(p) {
    domainBus.emit(FIELD_DEFINITION_DELETED, p);
}
