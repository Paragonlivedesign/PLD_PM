import { domainBus } from "../../domain/bus.js";
import { resyncCrewConflictsForEventAfterDateChange } from "./crew-assignments.service.js";
/** CP2 2.H.5 / 2.E.6 — re-evaluate crew overlaps when event dates change. */
export function registerEventDatesBusListeners(_pool) {
    void _pool;
    domainBus.on("event.datesChanged", (payload) => {
        const p = payload;
        if (!p?.tenant_id || !p?.event_id)
            return;
        void resyncCrewConflictsForEventAfterDateChange(p.tenant_id, p.event_id).catch((err) => {
            console.error("[scheduling] event.datesChanged resync failed", err);
        });
    });
}
