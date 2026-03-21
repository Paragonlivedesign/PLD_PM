import { publishEvent } from "../../core/events.js";

export function emitPersonnelCreated(payload: Record<string, unknown>): void {
  publishEvent({ name: "personnel.created", payload });
}

export function emitPersonnelUpdated(payload: Record<string, unknown>): void {
  publishEvent({ name: "personnel.updated", payload });
}

export function emitPersonnelDeactivated(payload: Record<string, unknown>): void {
  publishEvent({ name: "personnel.deactivated", payload });
}

export function emitPersonnelRateChanged(payload: Record<string, unknown>): void {
  publishEvent({ name: "personnel.rate_changed", payload });
}

export function emitPersonnelInvited(payload: Record<string, unknown>): void {
  publishEvent({ name: "personnel.invited", payload });
}

export function emitPersonnelLinkedToUser(payload: Record<string, unknown>): void {
  publishEvent({ name: "personnel.linkedToUser", payload });
}

export function emitPersonnelRoleChanged(payload: Record<string, unknown>): void {
  publishEvent({ name: "personnel.role_changed", payload });
}

export function emitBulkImportCompleted(payload: Record<string, unknown>): void {
  publishEvent({ name: "personnel.bulkImportCompleted", payload });
}
