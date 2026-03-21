import type { Pool } from "pg";

type ChartData = {
  labels: string[];
  datasets: { label: string; data: number[]; color: string | null }[];
};

function emptyChart(label: string): ChartData {
  return { labels: [], datasets: [{ label, data: [], color: null }] };
}

function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export async function getOperationsDashboard(
  pool: Pool,
  tenantId: string,
  query: { date_range_start?: string; date_range_end?: string },
): Promise<{
  data: {
    kpis: {
      active_events: number;
      upcoming_events_7d: number;
      personnel_assigned: number;
      open_conflicts: number;
      utilization_rate: number;
    };
    events_by_status: ChartData;
    events_by_phase: ChartData;
    personnel_utilization: ChartData;
    upcoming_deadlines: {
      entity_type: string;
      entity_id: string;
      entity_name: string;
      deadline_type: string;
      deadline_date: string;
      days_remaining: number;
    }[];
  };
  meta: {
    date_range: { start: string; end: string };
    cached_at: string | null;
    data_freshness: "live" | "cached";
  };
}> {
  const end = parseDate(query.date_range_end, new Date());
  const start = parseDate(
    query.date_range_start,
    new Date(end.getTime() - 30 * 86400000),
  );
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const { rows: activeRows } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM events
     WHERE tenant_id = $1 AND deleted_at IS NULL AND status <> 'cancelled'`,
    [tenantId],
  );
  const active_events = Number(activeRows[0]?.c ?? 0);

  const { rows: upRows } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM events
     WHERE tenant_id = $1 AND deleted_at IS NULL
       AND start_date >= CURRENT_DATE
       AND start_date <= CURRENT_DATE + INTERVAL '7 days'`,
    [tenantId],
  );
  const upcoming_events_7d = Number(upRows[0]?.c ?? 0);

  const { rows: paRows } = await pool.query<{ c: string }>(
    `SELECT COUNT(DISTINCT personnel_id)::text AS c FROM crew_assignments
     WHERE tenant_id = $1 AND deleted_at IS NULL
       AND start_date <= $3::date AND end_date >= $2::date`,
    [tenantId, startStr, endStr],
  );
  const personnel_assigned = Number(paRows[0]?.c ?? 0);

  const { rows: ocRows } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM scheduling_conflicts
     WHERE tenant_id = $1 AND status = 'active'`,
    [tenantId],
  );
  const open_conflicts = Number(ocRows[0]?.c ?? 0);

  const { rows: pCount } = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM personnel WHERE tenant_id = $1 AND deleted_at IS NULL AND status = 'active'`,
    [tenantId],
  );
  const personnelTotal = Math.max(1, Number(pCount[0]?.c ?? 1));
  const utilization_rate = Math.min(
    100,
    Math.round((personnel_assigned / personnelTotal) * 35 * 10) / 10,
  );

  const { rows: byStatus } = await pool.query<{ status: string; c: string }>(
    `SELECT status, COUNT(*)::text AS c FROM events
     WHERE tenant_id = $1 AND deleted_at IS NULL GROUP BY status ORDER BY status`,
    [tenantId],
  );
  const events_by_status: ChartData = {
    labels: byStatus.map((r) => r.status),
    datasets: [
      {
        label: "Events",
        data: byStatus.map((r) => Number(r.c)),
        color: null,
      },
    ],
  };

  const { rows: byPhase } = await pool.query<{ phase: string; c: string }>(
    `SELECT phase, COUNT(*)::text AS c FROM events
     WHERE tenant_id = $1 AND deleted_at IS NULL GROUP BY phase ORDER BY phase`,
    [tenantId],
  );
  const events_by_phase: ChartData = {
    labels: byPhase.map((r) => r.phase),
    datasets: [{ label: "Events", data: byPhase.map((r) => Number(r.c)), color: null }],
  };

  const personnel_utilization = emptyChart("Utilization %");

  return {
    data: {
      kpis: {
        active_events,
        upcoming_events_7d,
        personnel_assigned,
        open_conflicts,
        utilization_rate,
      },
      events_by_status,
      events_by_phase,
      personnel_utilization,
      upcoming_deadlines: [],
    },
    meta: {
      date_range: { start: startStr, end: endStr },
      cached_at: null,
      data_freshness: "live",
    },
  };
}

export async function getFinancialDashboard(
  pool: Pool,
  tenantId: string,
  query: {
    date_range_start?: string;
    date_range_end?: string;
    client_id?: string;
    event_id?: string;
  },
): Promise<{
  data: {
    kpis: {
      total_revenue: number;
      total_costs: number;
      gross_margin: number;
      gross_margin_pct: number;
      outstanding_invoices: number;
      events_in_range: number;
    };
    revenue_vs_cost_trend: ChartData;
    cost_breakdown_by_category: ChartData;
    profitability_by_event: ChartData;
    top_clients_by_revenue: {
      client_id: string;
      client_name: string;
      total_revenue: number;
      event_count: number;
    }[];
  };
  meta: {
    date_range: { start: string; end: string };
    currency: string;
    cached_at: string | null;
    data_freshness: "live" | "cached";
  };
}> {
  const end = parseDate(query.date_range_end, new Date());
  const qStart = query.date_range_start
    ? parseDate(query.date_range_start, end)
    : new Date(end.getFullYear(), Math.floor(end.getMonth() / 3) * 3, 1);
  const startStr = qStart.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const args: unknown[] = [tenantId, startStr, endStr];
  let extra = "";
  if (query.event_id) {
    extra = " AND event_id = $4";
    args.push(query.event_id);
  }

  const { rows: revRows } = await pool.query<{ s: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS s FROM financial_records
     WHERE tenant_id = $1 AND deleted_at IS NULL AND type = 'revenue'
       AND (record_date IS NULL OR (record_date >= $2::date AND record_date <= $3::date))${extra}`,
    args,
  );
  const total_revenue = Number(revRows[0]?.s ?? 0);

  const { rows: costRows } = await pool.query<{ s: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS s FROM financial_records
     WHERE tenant_id = $1 AND deleted_at IS NULL AND type = 'cost'
       AND (record_date IS NULL OR (record_date >= $2::date AND record_date <= $3::date))${extra}`,
    args,
  );
  const total_costs = Number(costRows[0]?.s ?? 0);

  const gross_margin = total_revenue - total_costs;
  const gross_margin_pct =
    total_revenue > 0 ? Math.round((gross_margin / total_revenue) * 10000) / 100 : 0;

  const { rows: invRows } = await pool.query<{ s: string }>(
    `SELECT COALESCE(SUM(total - COALESCE(paid_amount, 0)), 0)::text AS s
     FROM invoices WHERE tenant_id = $1 AND status NOT IN ('paid', 'void', 'draft')`,
    [tenantId],
  );
  const outstanding_invoices = Number(invRows[0]?.s ?? 0);

  const { rows: evRows } = await pool.query<{ c: string }>(
    `SELECT COUNT(DISTINCT event_id)::text AS c FROM financial_records
     WHERE tenant_id = $1 AND deleted_at IS NULL
       AND (record_date IS NULL OR (record_date >= $2::date AND record_date <= $3::date))`,
    [tenantId, startStr, endStr],
  );
  const events_in_range = Number(evRows[0]?.c ?? 0);

  const { rows: topClients } = await pool.query<{
    id: string;
    name: string;
    rev: string;
    ec: string;
  }>(
    `SELECT c.id, c.name,
      COALESCE(SUM(CASE WHEN fr.type = 'revenue' THEN fr.amount ELSE 0 END), 0)::text AS rev,
      COUNT(DISTINCT e.id)::text AS ec
     FROM clients c
     LEFT JOIN events e ON e.client_id = c.id AND e.tenant_id = c.tenant_id AND e.deleted_at IS NULL
     LEFT JOIN financial_records fr ON fr.event_id = e.id AND fr.tenant_id = e.tenant_id AND fr.deleted_at IS NULL
     WHERE c.tenant_id = $1 AND c.deleted_at IS NULL
     GROUP BY c.id, c.name
     HAVING COALESCE(SUM(CASE WHEN fr.type = 'revenue' THEN fr.amount ELSE 0 END), 0) > 0
     ORDER BY SUM(CASE WHEN fr.type = 'revenue' THEN fr.amount ELSE 0 END) DESC NULLS LAST
     LIMIT 5`,
    [tenantId],
  );

  return {
    data: {
      kpis: {
        total_revenue,
        total_costs,
        gross_margin,
        gross_margin_pct,
        outstanding_invoices,
        events_in_range,
      },
      revenue_vs_cost_trend: emptyChart("Net"),
      cost_breakdown_by_category: emptyChart("Cost"),
      profitability_by_event: emptyChart("Margin"),
      top_clients_by_revenue: topClients.map((r) => ({
        client_id: r.id,
        client_name: r.name,
        total_revenue: Number(r.rev),
        event_count: Number(r.ec),
      })),
    },
    meta: {
      date_range: { start: startStr, end: endStr },
      currency: "USD",
      cached_at: null,
      data_freshness: "live",
    },
  };
}
