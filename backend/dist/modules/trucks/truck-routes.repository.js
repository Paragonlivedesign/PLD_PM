function iso(d) {
    return d.toISOString();
}
function dec(v) {
    if (v == null)
        return null;
    return String(v);
}
function asObject(v) {
    if (v && typeof v === "object" && !Array.isArray(v))
        return v;
    return {};
}
function mapGeometry(v) {
    if (!v || typeof v !== "object")
        return null;
    const o = v;
    const provider = typeof o.provider === "string" ? o.provider : "unknown";
    const computed_at = typeof o.computed_at === "string" ? o.computed_at : new Date().toISOString();
    return {
        encoded_polyline: typeof o.encoded_polyline === "string" ? o.encoded_polyline : undefined,
        geojson: o.geojson && typeof o.geojson === "object"
            ? o.geojson
            : undefined,
        provider,
        computed_at,
        legs: Array.isArray(o.legs) ? o.legs : undefined,
        traffic_aware: o.traffic_aware === true,
    };
}
export function mapWaypoints(w) {
    if (!Array.isArray(w))
        return [];
    return w.map((x, i) => {
        const o = x;
        return {
            location: String(o.location ?? ""),
            location_ref: asObject(o.location_ref),
            purpose: o.purpose != null ? String(o.purpose) : null,
            estimated_arrival: o.estimated_arrival != null ? String(o.estimated_arrival) : null,
            estimated_departure: o.estimated_departure != null ? String(o.estimated_departure) : null,
            actual_arrival: o.actual_arrival != null ? String(o.actual_arrival) : null,
            actual_departure: o.actual_departure != null ? String(o.actual_departure) : null,
            order: typeof o.order === "number" ? o.order : i + 1,
        };
    });
}
export function mapTruckRouteRow(r, opts) {
    const meta = asObject(r.metadata);
    return {
        id: r.id,
        event_id: r.event_id,
        event_name: r.event_name ?? "",
        truck_id: r.truck_id,
        truck_name: r.truck_name ?? "",
        assignment_id: r.assignment_id,
        driver_id: r.driver_id,
        driver_name: null,
        origin: r.origin,
        destination: r.destination,
        origin_ref: asObject(r.origin_ref),
        destination_ref: asObject(r.destination_ref),
        waypoints: mapWaypoints(r.waypoints),
        departure_datetime: iso(r.departure_datetime instanceof Date
            ? r.departure_datetime
            : new Date(r.departure_datetime)),
        estimated_arrival: iso(r.estimated_arrival instanceof Date ? r.estimated_arrival : new Date(r.estimated_arrival)),
        actual_arrival: r.actual_arrival
            ? iso(r.actual_arrival instanceof Date
                ? r.actual_arrival
                : new Date(r.actual_arrival))
            : null,
        distance_miles: dec(r.distance_miles),
        actual_distance_miles: dec(r.actual_distance_miles),
        estimated_fuel_cost: dec(r.estimated_fuel_cost),
        actual_fuel_cost: dec(r.actual_fuel_cost),
        cargo_description: r.cargo_description,
        notes: r.notes,
        metadata: meta,
        route_geometry: mapGeometry(r.route_geometry),
        traffic_aware: r.traffic_aware === true,
        provider_computed_at: r.provider_computed_at
            ? iso(r.provider_computed_at instanceof Date
                ? r.provider_computed_at
                : new Date(r.provider_computed_at))
            : null,
        driver_share_url: opts?.driver_share_url ?? null,
        driver_share_expires_at: r.driver_share_expires_at
            ? iso(r.driver_share_expires_at instanceof Date
                ? r.driver_share_expires_at
                : new Date(r.driver_share_expires_at))
            : null,
        schedule_conflict_hint: opts?.schedule_conflict_hint ?? null,
        status: r.status,
        created_at: iso(r.created_at instanceof Date ? r.created_at : new Date(r.created_at)),
        updated_at: iso(r.updated_at instanceof Date ? r.updated_at : new Date(r.updated_at)),
    };
}
export async function listRoutesByEvent(client, tenantId, eventId) {
    const r = await client.query(`SELECT tr.*, e.name AS event_name, tk.name AS truck_name
     FROM truck_routes tr
     INNER JOIN events e ON e.id = tr.event_id AND e.tenant_id = tr.tenant_id AND e.deleted_at IS NULL
     INNER JOIN trucks tk ON tk.id = tr.truck_id AND tk.tenant_id = tr.tenant_id AND tk.deleted_at IS NULL
     WHERE tr.tenant_id = $1 AND tr.event_id = $2 AND tr.deleted_at IS NULL
     ORDER BY tr.departure_datetime ASC`, [tenantId, eventId]);
    return r.rows;
}
export async function countTruckRoutes(client, p) {
    const cond = ["tr.tenant_id = $1", "tr.deleted_at IS NULL"];
    const params = [p.tenantId];
    let n = 2;
    if (p.eventId) {
        cond.push(`tr.event_id = $${n++}`);
        params.push(p.eventId);
    }
    if (p.truckId) {
        cond.push(`tr.truck_id = $${n++}`);
        params.push(p.truckId);
    }
    if (p.dateRangeStart) {
        cond.push(`tr.departure_datetime::date >= $${n++}::date`);
        params.push(p.dateRangeStart.slice(0, 10));
    }
    if (p.dateRangeEnd) {
        cond.push(`tr.departure_datetime::date <= $${n++}::date`);
        params.push(p.dateRangeEnd.slice(0, 10));
    }
    const r = await client.query(`SELECT COUNT(*)::text AS c FROM truck_routes tr WHERE ${cond.join(" AND ")}`, params);
    return Number(r.rows[0]?.c ?? 0);
}
export async function listTruckRoutes(client, p) {
    const cond = ["tr.tenant_id = $1", "tr.deleted_at IS NULL"];
    const params = [p.tenantId];
    let n = 2;
    if (p.eventId) {
        cond.push(`tr.event_id = $${n++}`);
        params.push(p.eventId);
    }
    if (p.truckId) {
        cond.push(`tr.truck_id = $${n++}`);
        params.push(p.truckId);
    }
    if (p.dateRangeStart) {
        cond.push(`tr.departure_datetime::date >= $${n++}::date`);
        params.push(p.dateRangeStart.slice(0, 10));
    }
    if (p.dateRangeEnd) {
        cond.push(`tr.departure_datetime::date <= $${n++}::date`);
        params.push(p.dateRangeEnd.slice(0, 10));
    }
    params.push(p.limit + 1, p.offset);
    const r = await client.query(`SELECT tr.*, e.name AS event_name, tk.name AS truck_name
     FROM truck_routes tr
     INNER JOIN events e ON e.id = tr.event_id AND e.tenant_id = tr.tenant_id AND e.deleted_at IS NULL
     INNER JOIN trucks tk ON tk.id = tr.truck_id AND tk.tenant_id = tr.tenant_id AND tk.deleted_at IS NULL
     WHERE ${cond.join(" AND ")}
     ORDER BY tr.departure_datetime DESC
     LIMIT $${n++} OFFSET $${n++}`, params);
    return r.rows;
}
export async function listTruckRoutesOverlappingDateRange(client, tenantId, rangeStart, rangeEnd) {
    const r = await client.query(`SELECT tr.*, e.name AS event_name, e.start_date::text AS event_start_date, tk.name AS truck_name
     FROM truck_routes tr
     INNER JOIN events e ON e.id = tr.event_id AND e.tenant_id = tr.tenant_id AND e.deleted_at IS NULL
     INNER JOIN trucks tk ON tk.id = tr.truck_id AND tk.tenant_id = tr.tenant_id AND tk.deleted_at IS NULL
     WHERE tr.tenant_id = $1 AND tr.deleted_at IS NULL
       AND tr.departure_datetime::date <= $3::date
       AND tr.estimated_arrival::date >= $2::date
     ORDER BY tr.departure_datetime ASC`, [tenantId, rangeStart.slice(0, 10), rangeEnd.slice(0, 10)]);
    return r.rows;
}
export async function insertTruckRoute(client, p) {
    await client.query(`INSERT INTO truck_routes (
      id, tenant_id, event_id, truck_id, assignment_id, driver_id,
      origin, destination, origin_ref, destination_ref, waypoints,
      departure_datetime, estimated_arrival,
      distance_miles, estimated_fuel_cost, cargo_description, notes, metadata, status
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::timestamptz,$13::timestamptz,
      $14,$15,$16,$17,$18::jsonb,$19
    )`, [
        p.id,
        p.tenantId,
        p.eventId,
        p.truckId,
        p.assignmentId,
        p.driverId,
        p.origin,
        p.destination,
        JSON.stringify(p.originRef ?? {}),
        JSON.stringify(p.destinationRef ?? {}),
        JSON.stringify(p.waypoints ?? []),
        p.departureDatetime,
        p.estimatedArrival,
        p.distanceMiles,
        p.estimatedFuelCost,
        p.cargoDescription,
        p.notes,
        JSON.stringify(p.metadata ?? {}),
        p.status,
    ]);
    const row = await getTruckRouteById(client, p.tenantId, p.id);
    if (!row)
        throw new Error("insert truck_route failed");
    return row;
}
export async function getTruckRouteById(client, tenantId, id) {
    const r = await client.query(`SELECT tr.*, e.name AS event_name, tk.name AS truck_name
     FROM truck_routes tr
     INNER JOIN events e ON e.id = tr.event_id AND e.tenant_id = tr.tenant_id AND e.deleted_at IS NULL
     INNER JOIN trucks tk ON tk.id = tr.truck_id AND tk.tenant_id = tr.tenant_id AND tk.deleted_at IS NULL
     WHERE tr.tenant_id = $1 AND tr.id = $2 AND tr.deleted_at IS NULL`, [tenantId, id]);
    return r.rows[0] ?? null;
}
export async function getTruckRouteByShareToken(client, token) {
    const r = await client.query(`SELECT tr.*, e.name AS event_name, tk.name AS truck_name
     FROM truck_routes tr
     INNER JOIN events e ON e.id = tr.event_id AND e.tenant_id = tr.tenant_id AND e.deleted_at IS NULL
     INNER JOIN trucks tk ON tk.id = tr.truck_id AND tk.tenant_id = tr.tenant_id AND tk.deleted_at IS NULL
     WHERE tr.driver_share_token = $1 AND tr.deleted_at IS NULL
       AND (tr.driver_share_expires_at IS NULL OR tr.driver_share_expires_at > NOW())`, [token]);
    return r.rows[0] ?? null;
}
export async function setDriverShareToken(client, tenantId, id, token, expiresAt) {
    await client.query(`UPDATE truck_routes SET driver_share_token = $3, driver_share_expires_at = $4, updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`, [tenantId, id, token, expiresAt]);
    return getTruckRouteById(client, tenantId, id);
}
export async function updateTruckRoutePartial(client, tenantId, id, patch) {
    const cur = await getTruckRouteById(client, tenantId, id);
    if (!cur)
        return null;
    const nextOriginRef = patch.origin_ref !== undefined ? patch.origin_ref : cur.origin_ref;
    const nextDestRef = patch.destination_ref !== undefined ? patch.destination_ref : cur.destination_ref;
    const nextMeta = patch.metadata !== undefined ? patch.metadata : cur.metadata;
    const nextGeom = patch.route_geometry !== undefined ? patch.route_geometry : cur.route_geometry;
    await client.query(`UPDATE truck_routes SET
      driver_id = $3,
      origin = $4,
      destination = $5,
      origin_ref = $6::jsonb,
      destination_ref = $7::jsonb,
      waypoints = $8::jsonb,
      departure_datetime = $9::timestamptz,
      estimated_arrival = $10::timestamptz,
      actual_arrival = $11::timestamptz,
      distance_miles = $12,
      actual_distance_miles = $13,
      estimated_fuel_cost = $14,
      actual_fuel_cost = $15,
      cargo_description = $16,
      notes = $17,
      metadata = $18::jsonb,
      route_geometry = $19::jsonb,
      traffic_aware = $20,
      provider_computed_at = $21::timestamptz,
      status = $22,
      updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`, [
        tenantId,
        id,
        patch.driver_id !== undefined ? patch.driver_id : cur.driver_id,
        patch.origin ?? cur.origin,
        patch.destination ?? cur.destination,
        JSON.stringify(nextOriginRef ?? {}),
        JSON.stringify(nextDestRef ?? {}),
        JSON.stringify(patch.waypoints ?? cur.waypoints),
        patch.departure_datetime ??
            iso(cur.departure_datetime instanceof Date
                ? cur.departure_datetime
                : new Date(cur.departure_datetime)),
        patch.estimated_arrival ??
            iso(cur.estimated_arrival instanceof Date
                ? cur.estimated_arrival
                : new Date(cur.estimated_arrival)),
        patch.actual_arrival !== undefined
            ? patch.actual_arrival
            : cur.actual_arrival
                ? iso(cur.actual_arrival instanceof Date
                    ? cur.actual_arrival
                    : new Date(cur.actual_arrival))
                : null,
        patch.distance_miles !== undefined
            ? patch.distance_miles
            : cur.distance_miles
                ? Number(cur.distance_miles)
                : null,
        patch.actual_distance_miles !== undefined
            ? patch.actual_distance_miles
            : cur.actual_distance_miles
                ? Number(cur.actual_distance_miles)
                : null,
        patch.estimated_fuel_cost !== undefined
            ? patch.estimated_fuel_cost
            : cur.estimated_fuel_cost
                ? Number(cur.estimated_fuel_cost)
                : null,
        patch.actual_fuel_cost !== undefined
            ? patch.actual_fuel_cost
            : cur.actual_fuel_cost
                ? Number(cur.actual_fuel_cost)
                : null,
        patch.cargo_description !== undefined
            ? patch.cargo_description
            : cur.cargo_description,
        patch.notes !== undefined ? patch.notes : cur.notes,
        JSON.stringify(nextMeta && typeof nextMeta === "object" ? nextMeta : asObject(cur.metadata)),
        nextGeom == null ? null : JSON.stringify(nextGeom),
        patch.traffic_aware !== undefined ? patch.traffic_aware : cur.traffic_aware,
        patch.provider_computed_at !== undefined
            ? patch.provider_computed_at
            : cur.provider_computed_at
                ? iso(cur.provider_computed_at instanceof Date
                    ? cur.provider_computed_at
                    : new Date(cur.provider_computed_at))
                : null,
        patch.status ?? cur.status,
    ]);
    return getTruckRouteById(client, tenantId, id);
}
