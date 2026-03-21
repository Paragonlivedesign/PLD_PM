import { getAssignmentsByEvent } from "../scheduling/index.js";
import { getTravelByEvent } from "../travel/service.js";
import { getEventBudgetInternal } from "../financial/index.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * HTML fragments for template merge keys — populated from Scheduling, Travel, and Financial facades (no direct cross-module table access).
 */
export async function buildHtmlMergeSectionsForEvent(
  tenantId: string,
  eventId: string,
): Promise<{ schedule_section: string; travel_section: string; financial_section: string }> {
  const [asg, travelRows, budgetWrap] = await Promise.all([
    getAssignmentsByEvent(eventId, tenantId, { type: "all", includeCancelled: false }).catch(() => ({
      crew: [],
      truck: [],
    })),
    getTravelByEvent(eventId, tenantId, { include_cancelled: false }).catch(() => []),
    getEventBudgetInternal(tenantId, eventId).catch(() => null),
  ]);

  const crewRows = asg.crew
    .slice(0, 50)
    .map(
      (a) =>
        `<tr><td>${esc(a.personnel_name ?? "—")}</td><td>${esc(String(a.role ?? "—"))}</td><td>${esc(String(a.start_date ?? "—"))}</td><td>${esc(String(a.end_date ?? "—"))}</td><td>${esc(String(a.status ?? "—"))}</td></tr>`,
    )
    .join("");
  const truckRows = asg.truck
    .slice(0, 30)
    .map(
      (t) =>
        `<tr><td>${esc(t.truck_name || "—")}</td><td>${esc(String(t.start_date ?? "—"))}</td><td>${esc(String(t.end_date ?? "—"))}</td><td>${esc(String(t.status ?? "—"))}</td></tr>`,
    )
    .join("");

  const schedule_section =
    !crewRows && !truckRows
      ? "<p><em>No crew or truck assignments for this event.</em></p>"
      : `<h4>Crew</h4><table border="1" cellpadding="6"><thead><tr><th>Name</th><th>Role</th><th>Start</th><th>End</th><th>Status</th></tr></thead><tbody>${crewRows || "<tr><td colspan=5>—</td></tr>"}</tbody></table>` +
        (truckRows
          ? `<h4>Trucks</h4><table border="1" cellpadding="6"><thead><tr><th>Truck</th><th>Start</th><th>End</th><th>Status</th></tr></thead><tbody>${truckRows}</tbody></table>`
          : "");

  const travel_slice = travelRows.slice(0, 40);
  const travel_section =
    travel_slice.length === 0
      ? "<p><em>No travel records for this event.</em></p>"
      : `<table border="1" cellpadding="6"><thead><tr><th>Personnel</th><th>Direction</th><th>Departure</th><th>Status</th></tr></thead><tbody>${travel_slice
          .map(
            (r) =>
              `<tr><td>${esc(String(r.personnel_name ?? "—"))}</td><td>${esc(String(r.direction ?? "—"))}</td><td>${esc(String(r.departure_datetime ?? "—"))}</td><td>${esc(String(r.status ?? "—"))}</td></tr>`,
          )
          .join("")}</tbody></table>`;

  let financial_section = "<p><em>Budget data unavailable.</em></p>";
  if (budgetWrap?.data) {
    const d = budgetWrap.data as {
      currency?: string;
      total_revenue?: number;
      total_costs?: number;
      net_profit?: number;
    };
    financial_section = `<ul><li><strong>Revenue:</strong> ${esc(String(d.currency ?? "USD"))} ${esc(String(d.total_revenue ?? 0))}</li><li><strong>Costs:</strong> ${esc(String(d.total_costs ?? 0))}</li><li><strong>Net:</strong> ${esc(String(d.net_profit ?? 0))}</li></ul>`;
  }

  return { schedule_section, travel_section, financial_section };
}
