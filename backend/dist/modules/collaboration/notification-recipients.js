function dedupeUsers(ids, exclude) {
    const set = new Set();
    for (const id of ids) {
        if (!id || id === exclude)
            continue;
        set.add(id);
    }
    return [...set];
}
export async function getEventCreatedBy(pool, tenantId, eventId) {
    const { rows } = await pool.query(`SELECT created_by FROM events WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [eventId, tenantId]);
    return rows[0]?.created_by ?? null;
}
export async function getPersonnelUserId(pool, tenantId, personnelId) {
    const { rows } = await pool.query(`SELECT user_id FROM personnel WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [personnelId, tenantId]);
    return rows[0]?.user_id ?? null;
}
/** Crew assignment: assignee (linked user) + event owner; exclude actor. */
export async function recipientsForCrewAssignment(pool, tenantId, eventId, personnelId, actorUserId) {
    const assignee = await getPersonnelUserId(pool, tenantId, personnelId);
    const owner = await getEventCreatedBy(pool, tenantId, eventId);
    return dedupeUsers([assignee, owner], actorUserId);
}
/** Truck assignment: event owner only (exclude actor). */
export async function recipientsForTruckAssignment(pool, tenantId, eventId, actorUserId) {
    const owner = await getEventCreatedBy(pool, tenantId, eventId);
    return dedupeUsers([owner], actorUserId);
}
/** Truck route delay / ETA alerts: event owner (same as truck assignment). */
export async function recipientsForRouteEta(pool, tenantId, eventId, actorUserId) {
    return recipientsForTruckAssignment(pool, tenantId, eventId, actorUserId);
}
/** Phase change: event owner, not the user who changed phase. */
export async function recipientsForPhaseTransition(pool, tenantId, eventId, changedBy) {
    const owner = await getEventCreatedBy(pool, tenantId, eventId);
    return dedupeUsers([owner], changedBy);
}
/** Conflict: personnel user + event owners for involved crew assignments. */
export async function recipientsForSchedulingConflict(pool, tenantId, personnelId, assignmentIds) {
    const personnelUser = await getPersonnelUserId(pool, tenantId, personnelId);
    const eventIds = new Set();
    if (assignmentIds.length > 0) {
        const { rows } = await pool.query(`SELECT DISTINCT event_id FROM crew_assignments
       WHERE tenant_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL`, [tenantId, assignmentIds]);
        for (const r of rows)
            eventIds.add(r.event_id);
    }
    const owners = [personnelUser];
    for (const eid of eventIds) {
        owners.push(await getEventCreatedBy(pool, tenantId, eid));
    }
    return dedupeUsers(owners, null);
}
/** Travel created/updated: traveler user + event owner; exclude actor. */
export async function recipientsForTravelUpdate(pool, tenantId, eventId, personnelId, actorUserId) {
    const traveler = await getPersonnelUserId(pool, tenantId, personnelId);
    const owner = await getEventCreatedBy(pool, tenantId, eventId);
    return dedupeUsers([traveler, owner], actorUserId);
}
/** Generated document: event owner, not generator. */
export async function recipientsForDocumentGenerated(pool, tenantId, eventId, generatedBy) {
    const owner = await getEventCreatedBy(pool, tenantId, eventId);
    return dedupeUsers([owner], generatedBy);
}
/** Budget change: notify event owner (no actor in payload). */
export async function recipientsForBudgetAlert(pool, tenantId, eventId) {
    const owner = await getEventCreatedBy(pool, tenantId, eventId);
    return dedupeUsers([owner], null);
}
