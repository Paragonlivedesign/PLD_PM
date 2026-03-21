import type { Pool } from "pg";
import { domainBus } from "../../domain/bus.js";
import {
  recipientsForBudgetAlert,
  recipientsForCrewAssignment,
  recipientsForDocumentGenerated,
  recipientsForPhaseTransition,
  recipientsForSchedulingConflict,
  recipientsForTravelUpdate,
  recipientsForTruckAssignment,
  recipientsForRouteEta,
} from "./notification-recipients.js";
import { sendNotification } from "./notifications.service.js";

function fire(pool: Pool, fn: () => Promise<void>): void {
  void fn().catch((e) => console.warn("[notifications] bus handler error", e));
}

async function notifyUsers(
  pool: Pool,
  tenantId: string,
  userIds: string[],
  notificationType: string,
  title: string,
  body: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const seen = new Set<string>();
  for (const uid of userIds) {
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    await sendNotification(pool, {
      tenantId,
      userId: uid,
      notificationType,
      title,
      body,
      payload,
    });
  }
}

export function registerNotificationBusListeners(pool: Pool): void {
  domainBus.on("event.phaseChanged", (p: unknown) => {
    const x = p as {
      tenant_id?: string;
      event_id?: string;
      previous_phase?: string;
      new_phase?: string;
      changed_by?: string;
    };
    if (!x.tenant_id || !x.event_id || !x.changed_by) return;
    fire(pool, async () => {
      const recipients = await recipientsForPhaseTransition(
        pool,
        x.tenant_id!,
        x.event_id!,
        x.changed_by!,
      );
      if (recipients.length === 0) return;
      await notifyUsers(
        pool,
        x.tenant_id!,
        recipients,
        "phase_transition",
        "Event phase updated",
        `Phase changed from ${x.previous_phase ?? "?"} to ${x.new_phase ?? "?"}.`,
        {
          event_id: x.event_id,
          previous_phase: x.previous_phase,
          new_phase: x.new_phase,
        },
      );
    });
  });

  domainBus.on("assignment.created", (p: unknown) => {
    const x = p as {
      tenant_id?: string;
      event_id?: string;
      assignment_type?: string;
      resource_id?: string;
      created_by?: string;
      assignment_id?: string;
    };
    if (!x.tenant_id || !x.event_id || !x.created_by) return;
    if (x.assignment_type === "crew" && x.resource_id) {
      fire(pool, async () => {
        const recipients = await recipientsForCrewAssignment(
          pool,
          x.tenant_id!,
          x.event_id!,
          x.resource_id!,
          x.created_by!,
        );
        if (recipients.length === 0) return;
        await notifyUsers(
          pool,
          x.tenant_id!,
          recipients,
          "crew_assignment",
          "Crew assignment",
          "You were assigned to an event (or an assignment was added).",
          {
            event_id: x.event_id,
            assignment_id: x.assignment_id,
            assignment_type: "crew",
            personnel_id: x.resource_id,
          },
        );
      });
      return;
    }
    if (x.assignment_type === "truck") {
      fire(pool, async () => {
        const recipients = await recipientsForTruckAssignment(
          pool,
          x.tenant_id!,
          x.event_id!,
          x.created_by!,
        );
        if (recipients.length === 0) return;
        await notifyUsers(
          pool,
          x.tenant_id!,
          recipients,
          "crew_assignment",
          "Truck assignment",
          "A truck was assigned to an event.",
          {
            event_id: x.event_id,
            assignment_id: x.assignment_id,
            assignment_type: "truck",
            truck_id: x.resource_id,
          },
        );
      });
    }
  });

  domainBus.on("conflict.detected", (p: unknown) => {
    const x = p as {
      tenant_id?: string;
      resource_id?: string;
      resource_type?: string;
      assignment_ids?: string[];
    };
    if (typeof x.tenant_id !== "string") return;
    if (x.resource_type !== "personnel" || !x.resource_id) return;
    const ids = Array.isArray(x.assignment_ids) ? x.assignment_ids : [];
    fire(pool, async () => {
      const recipients = await recipientsForSchedulingConflict(
        pool,
        x.tenant_id!,
        x.resource_id!,
        ids,
      );
      if (recipients.length === 0) return;
      await notifyUsers(
        pool,
        x.tenant_id!,
        recipients,
        "scheduling_conflict",
        "Scheduling conflict detected",
        "A scheduling conflict was detected for personnel or assignments.",
        {
          conflict_id: (p as { conflict_id?: string }).conflict_id,
          resource_id: x.resource_id,
          assignment_ids: ids,
        },
      );
    });
  });

  domainBus.on("document.generated", (p: unknown) => {
    const x = p as {
      tenant_id?: string;
      event_id?: string;
      name?: string;
      generated_by?: string;
      document_id?: string;
    };
    if (!x.tenant_id || !x.event_id || !x.generated_by) return;
    fire(pool, async () => {
      const recipients = await recipientsForDocumentGenerated(
        pool,
        x.tenant_id!,
        x.event_id!,
        x.generated_by!,
      );
      if (recipients.length === 0) return;
      await notifyUsers(
        pool,
        x.tenant_id!,
        recipients,
        "document_generated",
        "Document generated",
        x.name ? `Document "${x.name}" was generated.` : "A document was generated.",
        { event_id: x.event_id, document_id: x.document_id },
      );
    });
  });

  domainBus.on("travel.created", (p: unknown) => {
    const x = p as {
      tenant_id?: string;
      event_id?: string;
      personnel_id?: string;
      created_by?: string;
      travel_id?: string;
    };
    if (!x.tenant_id || !x.event_id || !x.personnel_id || !x.created_by) return;
    fire(pool, async () => {
      const recipients = await recipientsForTravelUpdate(
        pool,
        x.tenant_id!,
        x.event_id!,
        x.personnel_id!,
        x.created_by!,
      );
      if (recipients.length === 0) return;
      await notifyUsers(
        pool,
        x.tenant_id!,
        recipients,
        "travel_update",
        "Travel record added",
        "A travel record was created for an event.",
        { event_id: x.event_id, travel_id: x.travel_id },
      );
    });
  });

  domainBus.on("travel.updated", (p: unknown) => {
    const x = p as {
      tenant_id?: string;
      event_id?: string;
      personnel_id?: string;
      updated_by?: string;
      travel_id?: string;
    };
    if (!x.tenant_id || !x.event_id || !x.personnel_id || !x.updated_by) return;
    fire(pool, async () => {
      const recipients = await recipientsForTravelUpdate(
        pool,
        x.tenant_id!,
        x.event_id!,
        x.personnel_id!,
        x.updated_by!,
      );
      if (recipients.length === 0) return;
      await notifyUsers(
        pool,
        x.tenant_id!,
        recipients,
        "travel_update",
        "Travel record updated",
        "A travel record was updated.",
        { event_id: x.event_id, travel_id: x.travel_id },
      );
    });
  });

  domainBus.on("route.delay_threshold_exceeded", (p: unknown) => {
    const x = p as {
      tenant_id?: string;
      event_id?: string;
      route_id?: string;
      truck_id?: string;
      delay_minutes?: number;
      threshold_minutes?: number;
      estimated_arrival?: string;
    };
    if (!x.tenant_id || !x.event_id || !x.route_id) return;
    fire(pool, async () => {
      const recipients = await recipientsForRouteEta(
        pool,
        x.tenant_id!,
        x.event_id!,
        "",
      );
      if (recipients.length === 0) return;
      await notifyUsers(
        pool,
        x.tenant_id!,
        recipients,
        "route_eta",
        "Truck route delayed",
        `Route ETA slipped by ${x.delay_minutes ?? "?"} min (threshold ${x.threshold_minutes ?? "?"} min).`,
        {
          event_id: x.event_id,
          route_id: x.route_id,
          truck_id: x.truck_id,
          delay_minutes: x.delay_minutes,
          threshold_minutes: x.threshold_minutes,
          estimated_arrival: x.estimated_arrival,
        },
      );
    });
  });

  domainBus.on("budget.updated", (p: unknown) => {
    const x = p as {
      tenant_id?: string;
      event_id?: string;
      previous_total_costs?: number;
      new_total_costs?: number;
    };
    if (!x.tenant_id || !x.event_id) return;
    const prev = Number(x.previous_total_costs ?? 0);
    const next = Number(x.new_total_costs ?? 0);
    if (next <= prev) return;
    fire(pool, async () => {
      const recipients = await recipientsForBudgetAlert(pool, x.tenant_id!, x.event_id!);
      if (recipients.length === 0) return;
      await notifyUsers(
        pool,
        x.tenant_id!,
        recipients,
        "budget_alert",
        "Budget updated",
        `Event costs changed (total costs now ${next}).`,
        { event_id: x.event_id, previous_total_costs: prev, new_total_costs: next },
      );
    });
  });
}
