import { domainBus } from "../../domain/bus.js";
/** Register travel listeners (event dates, future assignment.* from scheduling). */
export function registerTravelDomainListeners() {
    domainBus.on("event.updated", (payload) => {
        const p = payload;
        const cf = p.changed_fields ?? [];
        if (cf.includes("start_date") || cf.includes("end_date")) {
            console.log("[travel] event dates changed — reconcile travel if needed", {
                event_id: p.event_id,
                tenant_id: p.tenant_id,
            });
        }
    });
    domainBus.on("assignment.created", (payload) => {
        console.log("[travel] assignment.created (stub)", payload);
    });
    domainBus.on("assignment.updated", (payload) => {
        console.log("[travel] assignment.updated (stub)", payload);
    });
}
