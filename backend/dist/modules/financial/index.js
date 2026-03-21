import { onEvent } from "../../core/events.js";
import { domainBus } from "../../domain/bus.js";
import { pool } from "../../db/pool.js";
import { selectDistinctEventIdsForPersonnelCrew } from "../scheduling/crew-assignments.repository.js";
import { recalculateEventCostsInternal } from "./financial.service.js";
export { financialsRouter, invoicesRouter, reportsRouter, } from "./financial.routes.js";
export { eventFinancialRouter } from "./event-financial.routes.js";
export { getEventBudgetInternal, getEventCostsInternal, recalculateEventCostsInternal, } from "./financial.service.js";
/**
 * Subscribes Financial to domain signals. Does **not** read Scheduling/Travel tables —
 * `recalculateEventCostsApi` uses Scheduling + Travel public facades (`getAssignmentDays`, `getTravelCosts`).
 */
export function registerFinancialBusListeners(_db = pool) {
    void _db;
    const onEventRecalc = (payload, source) => {
        const p = payload;
        if (p.tenant_id && p.event_id) {
            void recalculateEventCostsInternal(p.tenant_id, p.event_id, { triggered_by: source }).catch(() => undefined);
        }
    };
    for (const ev of [
        "assignment.created",
        "assignment.updated",
        "assignment.deleted",
    ]) {
        domainBus.on(ev, (payload) => {
            onEventRecalc(payload, `scheduling.${ev}`);
        });
    }
    for (const ev of ["travel.created", "travel.updated", "travel.deleted"]) {
        domainBus.on(ev, (payload) => {
            onEventRecalc(payload, `travel.${ev}`);
        });
    }
    domainBus.on("truck.assigned", (payload) => {
        onEventRecalc(payload, "scheduling.truck.assigned");
    });
    domainBus.on("truck.unassigned", (payload) => {
        onEventRecalc(payload, "scheduling.truck.unassigned");
    });
    domainBus.on("truck.assignment_updated", (payload) => {
        onEventRecalc(payload, "scheduling.truck.assignment_updated");
    });
    onEvent("personnel.rate_changed", (payload) => {
        const tenant_id = payload.tenant_id;
        const personnel_id = payload.personnel_id;
        if (!tenant_id || !personnel_id)
            return;
        void (async () => {
            const eventIds = await selectDistinctEventIdsForPersonnelCrew(pool, tenant_id, personnel_id);
            for (const event_id of eventIds) {
                await recalculateEventCostsInternal(tenant_id, event_id, {
                    triggered_by: "personnel.rate_changed",
                }).catch(() => undefined);
            }
        })();
    });
}
