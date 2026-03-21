import { domainBus } from "../../domain/bus.js";

/** Register travel listeners (event dates; assignment hooks reserved for future reconcile). */
export function registerTravelDomainListeners(): void {
  domainBus.on("event.updated", (payload: unknown) => {
    const p = payload as {
      changed_fields?: string[];
      event_id?: string;
      tenant_id?: string;
    };
    const cf = p.changed_fields ?? [];
    if (cf.includes("start_date") || cf.includes("end_date")) {
      void p.event_id;
      void p.tenant_id;
      /* Reserved: reconcile travel rows when event dates change (future travel.service hook). */
    }
  });

  domainBus.on("assignment.created", () => {
    /* Reserved: optional travel row sync from scheduling (not yet implemented). */
  });
  domainBus.on("assignment.updated", () => {
    /* Reserved: optional travel row sync from scheduling (not yet implemented). */
  });
}
