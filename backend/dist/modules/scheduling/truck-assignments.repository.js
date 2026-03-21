import { inclusiveDays } from "../../utils/dates.js";
function iso(d) {
    return d.toISOString();
}
function isoDate(d) {
    if (typeof d === "string")
        return d.slice(0, 10);
    return d.toISOString().slice(0, 10);
}
export function mapTruckAssignmentRow(r) {
    const start_date = isoDate(r.start_date);
    const end_date = isoDate(r.end_date);
    return {
        id: r.id,
        event_id: r.event_id,
        event_name: r.event_name ?? "",
        truck_id: r.truck_id,
        truck_name: r.truck_name ?? "",
        purpose: r.purpose,
        start_date,
        end_date,
        driver_id: r.driver_id,
        driver_name: null,
        total_days: inclusiveDays(start_date, end_date),
        notes: r.notes,
        status: r.status,
        has_conflicts: r.has_conflicts,
        created_at: iso(r.created_at instanceof Date ? r.created_at : new Date(r.created_at)),
        updated_at: iso(r.updated_at instanceof Date ? r.updated_at : new Date(r.updated_at)),
    };
}
export async function findOverlappingTruckAssignments(client, tenantId, truckId, startDate, endDate, excludeId) {
    const r = await client.query(`SELECT ta.*, e.name AS event_name, tr.name AS truck_name
     FROM truck_assignments ta
     INNER JOIN events e ON e.id = ta.event_id AND e.tenant_id = ta.tenant_id AND e.deleted_at IS NULL
     INNER JOIN trucks tr ON tr.id = ta.truck_id AND tr.tenant_id = ta.tenant_id AND tr.deleted_at IS NULL
     WHERE ta.tenant_id = $1 AND ta.truck_id = $2 AND ta.deleted_at IS NULL
       AND ta.status <> 'cancelled'
       AND ta.start_date <= $4::date AND ta.end_date >= $3::date
       AND ($5::uuid IS NULL OR ta.id <> $5)`, [tenantId, truckId, startDate, endDate, excludeId ?? null]);
    return r.rows;
}
export async function findOverlappingDriverAssignments(client, tenantId, driverId, startDate, endDate, excludeId) {
    const r = await client.query(`SELECT ta.*, e.name AS event_name, tr.name AS truck_name
     FROM truck_assignments ta
     INNER JOIN events e ON e.id = ta.event_id AND e.tenant_id = ta.tenant_id AND e.deleted_at IS NULL
     INNER JOIN trucks tr ON tr.id = ta.truck_id AND tr.tenant_id = ta.tenant_id AND tr.deleted_at IS NULL
     WHERE ta.tenant_id = $1 AND ta.driver_id = $2 AND ta.deleted_at IS NULL
       AND ta.status <> 'cancelled'
       AND ta.start_date <= $4::date AND ta.end_date >= $3::date
       AND ($5::uuid IS NULL OR ta.id <> $5)`, [tenantId, driverId, startDate, endDate, excludeId ?? null]);
    return r.rows;
}
export async function insertTruckAssignment(client, p) {
    await client.query(`INSERT INTO truck_assignments (
      id, tenant_id, event_id, truck_id, purpose, start_date, end_date,
      driver_id, notes, status, has_conflicts
    ) VALUES ($1,$2,$3,$4,$5,$6::date,$7::date,$8,$9,$10,$11)`, [
        p.id,
        p.tenantId,
        p.eventId,
        p.truckId,
        p.purpose,
        p.startDate,
        p.endDate,
        p.driverId,
        p.notes,
        p.status,
        p.hasConflicts,
    ]);
    const full = await getTruckAssignmentById(client, p.tenantId, p.id);
    if (!full)
        throw new Error("insert truck_assignment failed");
    return full;
}
export async function getTruckAssignmentById(client, tenantId, id) {
    const r = await client.query(`SELECT ta.*, e.name AS event_name, tr.name AS truck_name
     FROM truck_assignments ta
     INNER JOIN events e ON e.id = ta.event_id AND e.tenant_id = ta.tenant_id AND e.deleted_at IS NULL
     INNER JOIN trucks tr ON tr.id = ta.truck_id AND tr.tenant_id = ta.tenant_id AND tr.deleted_at IS NULL
     WHERE ta.tenant_id = $1 AND ta.id = $2 AND ta.deleted_at IS NULL`, [tenantId, id]);
    return r.rows[0] ?? null;
}
export async function countTruckAssignments(client, p) {
    const { where, vals } = buildTaWhere(p);
    const r = await client.query(`SELECT count(*)::int AS c FROM truck_assignments ta ${where}`, vals);
    return r.rows[0]?.c ?? 0;
}
function buildTaWhere(p) {
    const vals = [p.tenantId];
    let i = 2;
    const parts = [`ta.tenant_id = $1`, `ta.deleted_at IS NULL`];
    if (p.eventId) {
        parts.push(`ta.event_id = $${i}`);
        vals.push(p.eventId);
        i++;
    }
    if (p.truckId) {
        parts.push(`ta.truck_id = $${i}`);
        vals.push(p.truckId);
        i++;
    }
    if (p.driverId) {
        parts.push(`ta.driver_id = $${i}`);
        vals.push(p.driverId);
        i++;
    }
    if (p.status?.length) {
        parts.push(`ta.status = ANY($${i}::text[])`);
        vals.push(p.status);
        i++;
    }
    if (p.dateRangeStart) {
        parts.push(`ta.end_date >= $${i}::date`);
        vals.push(p.dateRangeStart);
        i++;
    }
    if (p.dateRangeEnd) {
        parts.push(`ta.start_date <= $${i}::date`);
        vals.push(p.dateRangeEnd);
        i++;
    }
    return { where: `WHERE ${parts.join(" AND ")}`, vals };
}
export async function listTruckAssignments(client, p) {
    const { where, vals } = buildTaWhere(p);
    const cursorClause = p.cursorId != null ? ` AND ta.id < $${vals.length + 1}::uuid` : "";
    const v = [...vals];
    if (p.cursorId)
        v.push(p.cursorId);
    v.push(p.limit + 1);
    const limIdx = v.length;
    const r = await client.query(`SELECT ta.*, e.name AS event_name, tr.name AS truck_name
     FROM truck_assignments ta
     INNER JOIN events e ON e.id = ta.event_id AND e.tenant_id = ta.tenant_id AND e.deleted_at IS NULL
     INNER JOIN trucks tr ON tr.id = ta.truck_id AND tr.tenant_id = ta.tenant_id AND tr.deleted_at IS NULL
     ${where}${cursorClause}
     ORDER BY ta.id DESC
     LIMIT $${limIdx}`, v);
    return r.rows;
}
export async function updateTruckAssignment(client, tenantId, id, patch) {
    const cur = await client.query(`SELECT * FROM truck_assignments WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`, [tenantId, id]);
    const row = cur.rows[0];
    if (!row)
        return null;
    const purpose = patch.purpose !== undefined ? patch.purpose : row.purpose;
    const startDate = patch.startDate ?? isoDate(row.start_date);
    const endDate = patch.endDate ?? isoDate(row.end_date);
    const driverId = patch.driverId !== undefined ? patch.driverId : row.driver_id;
    const notes = patch.notes !== undefined ? patch.notes : row.notes;
    const status = patch.status ?? row.status;
    const hasConflicts = patch.hasConflicts !== undefined ? patch.hasConflicts : row.has_conflicts;
    await client.query(`UPDATE truck_assignments SET
      purpose = $3,
      start_date = $4::date,
      end_date = $5::date,
      driver_id = $6,
      notes = $7,
      status = $8,
      has_conflicts = $9,
      updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2`, [tenantId, id, purpose, startDate, endDate, driverId, notes, status, hasConflicts]);
    return getTruckAssignmentById(client, tenantId, id);
}
export async function softDeleteTruckAssignment(client, tenantId, id) {
    const r = await client.query(`UPDATE truck_assignments SET deleted_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING deleted_at`, [tenantId, id]);
    if (!r.rows[0])
        return null;
    return {
        id,
        deleted_at: iso(r.rows[0].deleted_at),
    };
}
export async function countActiveFutureAssignmentsForTruck(client, tenantId, truckId, fromDate) {
    const r = await client.query(`SELECT count(*)::int AS c FROM truck_assignments
     WHERE tenant_id = $1 AND truck_id = $2 AND deleted_at IS NULL
       AND status IN ('tentative', 'confirmed')
       AND end_date >= $3::date`, [tenantId, truckId, fromDate]);
    return r.rows[0]?.c ?? 0;
}
export async function getAssignmentsForTruckInRange(client, tenantId, truckId, startDate, endDate) {
    const r = await client.query(`SELECT ta.*, e.name AS event_name, tr.name AS truck_name
     FROM truck_assignments ta
     INNER JOIN events e ON e.id = ta.event_id AND e.tenant_id = ta.tenant_id AND e.deleted_at IS NULL
     INNER JOIN trucks tr ON tr.id = ta.truck_id AND tr.tenant_id = ta.tenant_id AND tr.deleted_at IS NULL
     WHERE ta.tenant_id = $1 AND ta.truck_id = $2 AND ta.deleted_at IS NULL
       AND ta.status <> 'cancelled'
       AND ta.start_date <= $4::date AND ta.end_date >= $3::date
     ORDER BY ta.start_date ASC`, [tenantId, truckId, startDate, endDate]);
    return r.rows;
}
export async function listTruckAssignmentsOverlappingRange(client, tenantId, rangeStart, rangeEnd, filters) {
    const vals = [tenantId, rangeStart, rangeEnd];
    let i = 4;
    const parts = [
        `ta.tenant_id = $1`,
        `ta.deleted_at IS NULL`,
        `ta.end_date >= $2::date`,
        `ta.start_date <= $3::date`,
    ];
    if (!filters?.includeCancelled) {
        parts.push(`ta.status <> 'cancelled'`);
    }
    if (filters?.truckId) {
        parts.push(`ta.truck_id = $${i}`);
        vals.push(filters.truckId);
        i++;
    }
    if (filters?.eventId) {
        parts.push(`ta.event_id = $${i}`);
        vals.push(filters.eventId);
        i++;
    }
    if (filters?.status?.length) {
        parts.push(`ta.status = ANY($${i}::text[])`);
        vals.push(filters.status);
        i++;
    }
    const r = await client.query(`SELECT ta.*, e.name AS event_name, tr.name AS truck_name
     FROM truck_assignments ta
     INNER JOIN events e ON e.id = ta.event_id AND e.tenant_id = ta.tenant_id AND e.deleted_at IS NULL
     INNER JOIN trucks tr ON tr.id = ta.truck_id AND tr.tenant_id = ta.tenant_id AND tr.deleted_at IS NULL
     WHERE ${parts.join(" AND ")}
     ORDER BY ta.start_date ASC`, vals);
    return r.rows;
}
export async function getTruckAssignmentsByEventId(client, tenantId, eventId, statusFilter, includeCancelled = false) {
    const vals = [tenantId, eventId];
    let extra = "";
    if (statusFilter?.length) {
        extra = ` AND ta.status = ANY($3::text[])`;
        vals.push(statusFilter);
    }
    else if (!includeCancelled) {
        extra = ` AND ta.status <> 'cancelled'`;
    }
    const r = await client.query(`SELECT ta.*, e.name AS event_name, tr.name AS truck_name,
            tr.daily_rate::text AS truck_daily_rate
     FROM truck_assignments ta
     INNER JOIN events e ON e.id = ta.event_id AND e.tenant_id = ta.tenant_id AND e.deleted_at IS NULL
     INNER JOIN trucks tr ON tr.id = ta.truck_id AND tr.tenant_id = ta.tenant_id AND tr.deleted_at IS NULL
     WHERE ta.tenant_id = $1 AND ta.event_id = $2 AND ta.deleted_at IS NULL${extra}
     ORDER BY ta.start_date ASC`, vals);
    return r.rows;
}
