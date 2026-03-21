import { publishEvent } from "../../core/events.js";
export function emitPersonnelCreated(payload) {
    publishEvent({ name: "personnel.created", payload });
}
export function emitPersonnelUpdated(payload) {
    publishEvent({ name: "personnel.updated", payload });
}
export function emitPersonnelDeactivated(payload) {
    publishEvent({ name: "personnel.deactivated", payload });
}
export function emitPersonnelRateChanged(payload) {
    publishEvent({ name: "personnel.rate_changed", payload });
}
export function emitPersonnelInvited(payload) {
    publishEvent({ name: "personnel.invited", payload });
}
export function emitPersonnelLinkedToUser(payload) {
    publishEvent({ name: "personnel.linkedToUser", payload });
}
export function emitPersonnelRoleChanged(payload) {
    publishEvent({ name: "personnel.role_changed", payload });
}
export function emitBulkImportCompleted(payload) {
    publishEvent({ name: "personnel.bulkImportCompleted", payload });
}
