import { domainBus } from "../../domain/bus.js";
import type {
  FieldDefinitionCreatedPayload,
  FieldDefinitionDeletedPayload,
  FieldDefinitionUpdatedPayload,
} from "./types.js";

export const FIELD_DEFINITION_CREATED = "fieldDefinition.created" as const;
export const FIELD_DEFINITION_UPDATED = "fieldDefinition.updated" as const;
export const FIELD_DEFINITION_DELETED = "fieldDefinition.deleted" as const;

export function publishFieldDefinitionCreated(p: FieldDefinitionCreatedPayload): void {
  domainBus.emit(FIELD_DEFINITION_CREATED, p);
}

export function publishFieldDefinitionUpdated(p: FieldDefinitionUpdatedPayload): void {
  domainBus.emit(FIELD_DEFINITION_UPDATED, p);
}

export function publishFieldDefinitionDeleted(p: FieldDefinitionDeletedPayload): void {
  domainBus.emit(FIELD_DEFINITION_DELETED, p);
}
