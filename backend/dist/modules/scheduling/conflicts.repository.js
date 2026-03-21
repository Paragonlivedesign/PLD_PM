function iso(d) {
    return d.toISOString();
}
function isoDate(d) {
    if (typeof d === "string")
        return d.slice(0, 10);
    return d.toISOString().slice(0, 10);
}
export function mapConflictRow(r) {
    const kind = (r.conflict_kind ?? "double_booking");
    return {
        id: r.id,
        resource_type: r.resource_type,
        resource_id: r.resource_id,
        resource_name: r.resource_name,
        severity: r.severity,
        status: r.status,
        assignments: Array.isArray(r.assignments) ? r.assignments : [],
        overlap_start: isoDate(r.overlap_start),
        overlap_end: isoDate(r.overlap_end),
        detected_at: iso(r.detected_at instanceof Date ? r.detected_at : new Date(r.detected_at)),
        resolved_at: r.resolved_at
            ? iso(r.resolved_at instanceof Date ? r.resolved_at : new Date(r.resolved_at))
            : null,
        conflict_kind: kind,
    };
}
export async function insertSchedulingConflict(client, p) {
    const assignmentsJson = JSON.stringify(p.assignments);
    const conflictKind = p.conflictKind ?? "double_booking";
    await client.query(`INSERT INTO scheduling_conflicts (
      id, tenant_id, resource_type, resource_id, resource_name, severity, status,
      overlap_start, overlap_end, assignments, event_id_1, event_id_2, conflict_kind
    ) VALUES ($1,$2,$3,$4,$5,$6,'active',$7::date,$8::date,$9::jsonb,$10,$11,$12)`, [
        p.id,
        p.tenantId,
        p.resourceType,
        p.resourceId,
        p.resourceName,
        p.severity,
        p.overlapStart,
        p.overlapEnd,
        assignmentsJson,
        p.eventId1,
        p.eventId2,
        conflictKind,
    ]);
    for (const a of p.assignments) {
        await client.query(`INSERT INTO scheduling_conflict_participants (conflict_id, assignment_type, assignment_id)
       VALUES ($1,$2,$3)`, [p.id, a.assignment_type, a.assignment_id]);
    }
    const full = await getConflictById(client, p.tenantId, p.id);
    if (!full)
        throw new Error("insertSchedulingConflict failed");
    return full;
}
export async function getConflictById(client, tenantId, id) {
    const r = await client.query(`SELECT * FROM scheduling_conflicts WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
    const row = r.rows[0];
    if (!row)
        return null;
    const assignments = typeof row.assignments === "string"
        ? JSON.parse(row.assignments)
        : row.assignments;
    return { ...row, assignments };
}
export async function countConflicts(client, p) {
    const { where, vals } = buildConflictWhere(p);
    const r = await client.query(`SELECT count(*)::int AS c FROM scheduling_conflicts c ${where}`, vals);
    return r.rows[0]?.c ?? 0;
}
function buildConflictWhere(p) {
    const vals = [p.tenantId];
    let i = 2;
    const parts = [`c.tenant_id = $1`];
    if (p.resourceType) {
        parts.push(`c.resource_type = $${i}`);
        vals.push(p.resourceType);
        i++;
    }
    if (p.resourceId) {
        parts.push(`c.resource_id = $${i}`);
        vals.push(p.resourceId);
        i++;
    }
    if (p.eventId) {
        parts.push(`(c.event_id_1 = $${i} OR c.event_id_2 = $${i})`);
        vals.push(p.eventId);
        i++;
    }
    if (p.status?.length) {
        parts.push(`c.status = ANY($${i}::text[])`);
        vals.push(p.status);
        i++;
    }
    else {
        parts.push(`c.status = 'active'`);
    }
    if (p.severity?.length) {
        parts.push(`c.severity = ANY($${i}::text[])`);
        vals.push(p.severity);
        i++;
    }
    if (p.dateRangeStart) {
        parts.push(`c.overlap_end >= $${i}::date`);
        vals.push(p.dateRangeStart);
        i++;
    }
    if (p.dateRangeEnd) {
        parts.push(`c.overlap_start <= $${i}::date`);
        vals.push(p.dateRangeEnd);
        i++;
    }
    return { where: `WHERE ${parts.join(" AND ")}`, vals };
}
export async function listConflicts(client, p) {
    const { where, vals } = buildConflictWhere(p);
    const cursorClause = p.cursorId != null ? ` AND c.id < $${vals.length + 1}::uuid` : "";
    const v = [...vals];
    if (p.cursorId)
        v.push(p.cursorId);
    v.push(p.limit + 1);
    const limIdx = v.length;
    const r = await client.query(`SELECT c.* FROM scheduling_conflicts c
     ${where}${cursorClause}
     ORDER BY c.id DESC
     LIMIT $${limIdx}`, v);
    return r.rows.map((row) => ({
        ...row,
        assignments: typeof row.assignments === "string"
            ? JSON.parse(row.assignments)
            : row.assignments,
    }));
}
export async function refreshCrewHasConflicts(client, tenantId, crewAssignmentId) {
    await client.query(`UPDATE crew_assignments SET has_conflicts = EXISTS (
       SELECT 1 FROM scheduling_conflict_participants p
       INNER JOIN scheduling_conflicts sc ON sc.id = p.conflict_id
       WHERE p.assignment_type = 'crew' AND p.assignment_id = $3
         AND sc.tenant_id = $1 AND sc.status = 'active'
     ), updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`, [tenantId, crewAssignmentId, crewAssignmentId]);
}
export async function refreshTruckHasConflicts(client, tenantId, truckAssignmentId) {
    await client.query(`UPDATE truck_assignments SET has_conflicts = EXISTS (
       SELECT 1 FROM scheduling_conflict_participants p
       INNER JOIN scheduling_conflicts sc ON sc.id = p.conflict_id
       WHERE p.assignment_type = 'truck' AND p.assignment_id = $3
         AND sc.tenant_id = $1 AND sc.status = 'active'
     ), updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`, [tenantId, truckAssignmentId, truckAssignmentId]);
}
export async function refreshHasConflictsForParticipants(client, tenantId, participants) {
    const seen = new Set();
    for (const { type, id } of participants) {
        const key = `${type}:${id}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        if (type === "crew")
            await refreshCrewHasConflicts(client, tenantId, id);
        else
            await refreshTruckHasConflicts(client, tenantId, id);
    }
}
/** Clear drive-time rows before rebuilding adjacent-pair detection (same personnel). */
export async function resolveActiveDriveConflictsForPersonnel(client, tenantId, personnelId) {
    await client.query(`UPDATE scheduling_conflicts c SET status = 'resolved', resolved_at = NOW()
     WHERE c.tenant_id = $1 AND c.status = 'active' AND c.resource_type = 'personnel'
       AND c.resource_id = $2::uuid AND c.conflict_kind = 'drive_time_infeasible'`, [tenantId, personnelId]);
    const crew = await client.query(`SELECT id FROM crew_assignments
     WHERE tenant_id = $1 AND personnel_id = $2::uuid AND deleted_at IS NULL`, [tenantId, personnelId]);
    await refreshHasConflictsForParticipants(client, tenantId, crew.rows.map((x) => ({ type: "crew", id: x.id })));
}
export async function resolveConflictsTouchingAssignment(client, tenantId, assignmentType, assignmentId) {
    const part = await client.query(`SELECT DISTINCT p.assignment_type, p.assignment_id
     FROM scheduling_conflict_participants p
     INNER JOIN scheduling_conflicts c ON c.id = p.conflict_id
     WHERE c.tenant_id = $1 AND c.status = 'active'
       AND c.id IN (
         SELECT p2.conflict_id FROM scheduling_conflict_participants p2
         WHERE p2.assignment_type = $2 AND p2.assignment_id = $3
       )`, [tenantId, assignmentType, assignmentId]);
    const r = await client.query(`UPDATE scheduling_conflicts c SET status = 'resolved', resolved_at = NOW()
     FROM scheduling_conflict_participants p
     WHERE c.id = p.conflict_id AND c.tenant_id = $1 AND c.status = 'active'
       AND p.assignment_type = $2 AND p.assignment_id = $3
     RETURNING c.id`, [tenantId, assignmentType, assignmentId]);
    const participants = part.rows.map((row) => ({
        type: row.assignment_type,
        id: row.assignment_id,
    }));
    await refreshHasConflictsForParticipants(client, tenantId, participants);
    return r.rows.map((x) => x.id);
}
export async function countActiveConflictsForTenant(client, tenantId) {
    const r = await client.query(`SELECT count(*)::int AS c FROM scheduling_conflicts WHERE tenant_id = $1 AND status = 'active'`, [tenantId]);
    return r.rows[0]?.c ?? 0;
}
