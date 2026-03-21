import { publishEvent } from "../../core/events.js";

export function emitTenantConfigUpdated(payload: Record<string, unknown>): void {
  publishEvent({ name: "tenant.configUpdated", payload });
}

export function emitDepartmentCreated(payload: Record<string, unknown>): void {
  publishEvent({ name: "department.created", payload });
}

export function emitDepartmentUpdated(payload: Record<string, unknown>): void {
  publishEvent({ name: "department.updated", payload });
}

export function emitDepartmentDeleted(payload: Record<string, unknown>): void {
  publishEvent({ name: "department.deleted", payload });
}

export function emitDepartmentReordered(payload: Record<string, unknown>): void {
  publishEvent({ name: "department.reordered", payload });
}
