/**
 * Travel contract: personnel should be linked to the event when scheduling data exists.
 * If the event has truck assignments with drivers, only those drivers may have travel rows.
 * If there are no assignments (or none with drivers), any tenant personnel is allowed.
 */
export async function isPersonnelEligibleForEventTravel(client, tenantId, eventId, personnelId) {
    const r = await client.query(`SELECT CASE
       WHEN EXISTS (
         SELECT 1 FROM crew_assignments
         WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL
           AND personnel_id = $3 AND status <> 'cancelled'
       ) THEN TRUE
       WHEN NOT EXISTS (
         SELECT 1 FROM truck_assignments
         WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL
       ) THEN TRUE
       WHEN EXISTS (
         SELECT 1 FROM truck_assignments
         WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL AND driver_id IS NOT NULL
       ) THEN EXISTS (
         SELECT 1 FROM truck_assignments
         WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL AND driver_id = $3
       )
       ELSE TRUE
     END AS ok`, [tenantId, eventId, personnelId]);
    return r.rows[0]?.ok ?? true;
}
