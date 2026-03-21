import { publishEvent } from "../../core/events.js";
export function emitTenantConfigUpdated(payload) {
    publishEvent({ name: "tenant.configUpdated", payload });
}
export function emitDepartmentCreated(payload) {
    publishEvent({ name: "department.created", payload });
}
export function emitDepartmentUpdated(payload) {
    publishEvent({ name: "department.updated", payload });
}
export function emitDepartmentDeleted(payload) {
    publishEvent({ name: "department.deleted", payload });
}
export function emitDepartmentReordered(payload) {
    publishEvent({ name: "department.reordered", payload });
}
