import type { Pool } from "pg";

function dedupeUsers(ids: (string | null | undefined)[], exclude?: string | null): string[] {
  const set = new Set<string>();
  for (const id of ids) {
    if (!id || id === exclude) continue;
    set.add(id);
  }
  return [...set];
}

export async function getEventCreatedBy(
  pool: Pool,
  tenantId: string,
  eventId: string,
): Promise<string | null> {
  const { rows } = await pool.query<{ created_by: string | null }>(
    `SELECT created_by FROM events WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [eventId, tenantId],
  );
  return rows[0]?.created_by ?? null;
}

export async function getPersonnelUserId(
  pool: Pool,
  tenantId: string,
  personnelId: string,
): Promise<string | null> {
  const { rows } = await pool.query<{ user_id: string | null }>(
    `SELECT user_id FROM personnel WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [personnelId, tenantId],
  );
  return rows[0]?.user_id ?? null;
}

/** Crew assignment: assignee (linked user) + event owner; exclude actor. */
export async function recipientsForCrewAssignment(
  pool: Pool,
  tenantId: string,
  eventId: string,
  personnelId: string,
  actorUserId: string,
): Promise<string[]> {
  const assignee = await getPersonnelUserId(pool, tenantId, personnelId);
  const owner = await getEventCreatedBy(pool, tenantId, eventId);
  return dedupeUsers([assignee, owner], actorUserId);
}

/** Truck assignment: event owner only (exclude actor). */
export async function recipientsForTruckAssignment(
  pool: Pool,
  tenantId: string,
  eventId: string,
  actorUserId: string,
): Promise<string[]> {
  const owner = await getEventCreatedBy(pool, tenantId, eventId);
  return dedupeUsers([owner], actorUserId);
}

/** Truck route delay / ETA alerts: event owner (same as truck assignment). */
export async function recipientsForRouteEta(
  pool: Pool,
  tenantId: string,
  eventId: string,
  actorUserId: string,
): Promise<string[]> {
  return recipientsForTruckAssignment(pool, tenantId, eventId, actorUserId);
}

/** Phase change: event owner, not the user who changed phase. */
export async function recipientsForPhaseTransition(
  pool: Pool,
  tenantId: string,
  eventId: string,
  changedBy: string,
): Promise<string[]> {
  const owner = await getEventCreatedBy(pool, tenantId, eventId);
  return dedupeUsers([owner], changedBy);
}

/** Conflict: personnel user + event owners for involved crew assignments. */
export async function recipientsForSchedulingConflict(
  pool: Pool,
  tenantId: string,
  personnelId: string,
  assignmentIds: string[],
): Promise<string[]> {
  const personnelUser = await getPersonnelUserId(pool, tenantId, personnelId);
  const eventIds = new Set<string>();
  if (assignmentIds.length > 0) {
    const { rows } = await pool.query<{ event_id: string }>(
      `SELECT DISTINCT event_id FROM crew_assignments
       WHERE tenant_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL`,
      [tenantId, assignmentIds],
    );
    for (const r of rows) eventIds.add(r.event_id);
  }
  const owners: (string | null)[] = [personnelUser];
  for (const eid of eventIds) {
    owners.push(await getEventCreatedBy(pool, tenantId, eid));
  }
  return dedupeUsers(owners, null);
}

/** Travel created/updated: traveler user + event owner; exclude actor. */
export async function recipientsForTravelUpdate(
  pool: Pool,
  tenantId: string,
  eventId: string,
  personnelId: string,
  actorUserId: string,
): Promise<string[]> {
  const traveler = await getPersonnelUserId(pool, tenantId, personnelId);
  const owner = await getEventCreatedBy(pool, tenantId, eventId);
  return dedupeUsers([traveler, owner], actorUserId);
}

/** Generated document: event owner, not generator. */
export async function recipientsForDocumentGenerated(
  pool: Pool,
  tenantId: string,
  eventId: string,
  generatedBy: string,
): Promise<string[]> {
  const owner = await getEventCreatedBy(pool, tenantId, eventId);
  return dedupeUsers([owner], generatedBy);
}

/** Budget change: notify event owner (no actor in payload). */
export async function recipientsForBudgetAlert(
  pool: Pool,
  tenantId: string,
  eventId: string,
): Promise<string[]> {
  const owner = await getEventCreatedBy(pool, tenantId, eventId);
  return dedupeUsers([owner], null);
}
