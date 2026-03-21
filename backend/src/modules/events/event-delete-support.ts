import type { Pool, PoolClient } from "pg";

/** Counts of non-deleted rows tied to an event (used for DELETE 409 + UI). */
export type EventDeleteBlockers = {
  crew_assignments: number;
  truck_assignments: number;
  truck_routes: number;
  travel_records: number;
  financial_records: number;
  invoices_committed: number;
  documents: number;
  rider_items: number;
  email_drafts: number;
  time_entries_linked: number;
  tasks_linked: number;
};

export function totalBlockers(b: EventDeleteBlockers): number {
  return (
    b.crew_assignments +
    b.truck_assignments +
    b.truck_routes +
    b.travel_records +
    b.financial_records +
    b.invoices_committed +
    b.documents +
    b.rider_items +
    b.email_drafts +
    b.time_entries_linked +
    b.tasks_linked
  );
}

/**
 * Loads counts of related operational data. Invoices "committed" = not draft/void.
 */
export async function summarizeEventDeleteBlockers(
  db: Pool | PoolClient,
  tenantId: string,
  eventId: string,
): Promise<EventDeleteBlockers> {
  const { rows } = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM crew_assignments
         WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL) AS crew_assignments,
       (SELECT COUNT(*)::int FROM truck_assignments
         WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL) AS truck_assignments,
       (SELECT COUNT(*)::int FROM truck_routes
         WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL) AS truck_routes,
       (SELECT COUNT(*)::int FROM travel_records
         WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL) AS travel_records,
       (SELECT COUNT(*)::int FROM financial_records
         WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL) AS financial_records,
       (SELECT COUNT(*)::int FROM invoices
         WHERE tenant_id = $1 AND event_id = $2 AND status NOT IN ('draft', 'void')) AS invoices_committed,
       (SELECT COUNT(*)::int FROM documents
         WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL) AS documents,
       (SELECT COUNT(*)::int FROM rider_items
         WHERE tenant_id = $1 AND event_id = $2) AS rider_items,
       (SELECT COUNT(*)::int FROM email_drafts
         WHERE tenant_id = $1 AND event_id = $2) AS email_drafts,
       (SELECT COUNT(*)::int FROM time_entries
         WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL) AS time_entries_linked,
       (SELECT COUNT(*)::int FROM tasks
         WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL) AS tasks_linked`,
    [tenantId, eventId],
  );
  const r = rows[0] as Record<keyof EventDeleteBlockers, number>;
  return {
    crew_assignments: r.crew_assignments ?? 0,
    truck_assignments: r.truck_assignments ?? 0,
    truck_routes: r.truck_routes ?? 0,
    travel_records: r.travel_records ?? 0,
    financial_records: r.financial_records ?? 0,
    invoices_committed: r.invoices_committed ?? 0,
    documents: r.documents ?? 0,
    rider_items: r.rider_items ?? 0,
    email_drafts: r.email_drafts ?? 0,
    time_entries_linked: r.time_entries_linked ?? 0,
    tasks_linked: r.tasks_linked ?? 0,
  };
}

/**
 * Removes or soft-deletes dependent rows so the event can be soft-deleted. Runs in one transaction.
 */
export async function purgeEventRelatedData(
  db: Pool,
  tenantId: string,
  eventId: string,
): Promise<void> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM invoices WHERE tenant_id = $1 AND event_id = $2`, [
      tenantId,
      eventId,
    ]);
    await client.query(
      `UPDATE financial_records SET deleted_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL`,
      [tenantId, eventId],
    );
    await client.query(
      `UPDATE crew_assignments SET deleted_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL`,
      [tenantId, eventId],
    );
    await client.query(
      `UPDATE truck_assignments SET deleted_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL`,
      [tenantId, eventId],
    );
    await client.query(
      `UPDATE truck_routes SET deleted_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL`,
      [tenantId, eventId],
    );
    await client.query(
      `UPDATE travel_records SET deleted_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL`,
      [tenantId, eventId],
    );
    await client.query(
      `UPDATE time_entries SET event_id = NULL, updated_at = NOW()
       WHERE tenant_id = $1 AND event_id = $2`,
      [tenantId, eventId],
    );
    await client.query(
      `UPDATE tasks SET event_id = NULL, updated_at = NOW()
       WHERE tenant_id = $1 AND event_id = $2`,
      [tenantId, eventId],
    );
    await client.query(`DELETE FROM rider_items WHERE tenant_id = $1 AND event_id = $2`, [
      tenantId,
      eventId,
    ]);
    await client.query(`DELETE FROM email_drafts WHERE tenant_id = $1 AND event_id = $2`, [
      tenantId,
      eventId,
    ]);
    await client.query(
      `UPDATE documents SET deleted_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL`,
      [tenantId, eventId],
    );
    await client.query(
      `UPDATE scheduling_conflicts
       SET status = 'resolved', resolved_at = COALESCE(resolved_at, NOW())
       WHERE tenant_id = $1 AND status = 'active'
         AND (event_id_1 = $2 OR event_id_2 = $2)`,
      [tenantId, eventId],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
