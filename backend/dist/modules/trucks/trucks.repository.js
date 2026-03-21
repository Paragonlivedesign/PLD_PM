function iso(d) {
    return d.toISOString();
}
function isoDateOnly(d) {
    if (d == null)
        return null;
    if (typeof d === "string")
        return d.slice(0, 10);
    return d.toISOString().slice(0, 10);
}
function dec(v) {
    if (v == null)
        return null;
    return String(v);
}
export function mapTruckRow(r) {
    const metadata = r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
        ? r.metadata
        : {};
    const custom_fields = r.custom_fields && typeof r.custom_fields === "object" && !Array.isArray(r.custom_fields)
        ? r.custom_fields
        : {};
    return {
        id: r.id,
        name: r.name,
        type: r.type,
        license_plate: r.license_plate,
        vin: r.vin,
        capacity_cubic_ft: dec(r.capacity_cubic_ft),
        capacity_lbs: dec(r.capacity_lbs),
        home_base: r.home_base,
        status: r.status,
        daily_rate: dec(r.daily_rate),
        mileage_rate: dec(r.mileage_rate),
        current_mileage: r.current_mileage,
        insurance_expiry: isoDateOnly(r.insurance_expiry),
        inspection_expiry: isoDateOnly(r.inspection_expiry),
        notes: r.notes,
        metadata,
        custom_fields,
        created_at: iso(r.created_at instanceof Date ? r.created_at : new Date(r.created_at)),
        updated_at: iso(r.updated_at instanceof Date ? r.updated_at : new Date(r.updated_at)),
        retired_at: r.retired_at
            ? iso(r.retired_at instanceof Date ? r.retired_at : new Date(r.retired_at))
            : null,
    };
}
export async function insertTruck(client, p) {
    const cf = p.customFields && typeof p.customFields === "object" ? p.customFields : {};
    const r = await client.query(`INSERT INTO trucks (
      id, tenant_id, name, type, license_plate, vin,
      capacity_cubic_ft, capacity_lbs, home_base, status,
      daily_rate, mileage_rate, current_mileage,
      insurance_expiry, inspection_expiry, notes, metadata, custom_fields
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::date,$15::date,$16,$17::jsonb,$18::jsonb
    ) RETURNING *`, [
        p.id,
        p.tenantId,
        p.name,
        p.type,
        p.licensePlate,
        p.vin,
        p.capacityCubicFt,
        p.capacityLbs,
        p.homeBase,
        p.status,
        p.dailyRate,
        p.mileageRate,
        p.currentMileage,
        p.insuranceExpiry,
        p.inspectionExpiry,
        p.notes,
        JSON.stringify(p.metadata),
        JSON.stringify(cf),
    ]);
    return mapTruckRow(r.rows[0]);
}
export async function getTruckRowById(client, tenantId, id, includeDeleted = false) {
    const del = includeDeleted ? "" : " AND deleted_at IS NULL";
    const r = await client.query(`SELECT * FROM trucks WHERE tenant_id = $1 AND id = $2${del}`, [tenantId, id]);
    return r.rows[0] ?? null;
}
export async function findDuplicateNameOrPlate(client, tenantId, name, licensePlate, excludeId) {
    const r = await client.query(`SELECT id FROM trucks WHERE tenant_id = $1 AND deleted_at IS NULL
     AND lower(name) = lower($2) AND ($3::uuid IS NULL OR id <> $3)`, [tenantId, name, excludeId ?? null]);
    if (r.rows[0])
        return "name";
    if (licensePlate?.trim()) {
        const r2 = await client.query(`SELECT id FROM trucks WHERE tenant_id = $1 AND deleted_at IS NULL
       AND license_plate IS NOT NULL AND lower(license_plate) = lower($2)
       AND ($3::uuid IS NULL OR id <> $3)`, [tenantId, licensePlate.trim(), excludeId ?? null]);
        if (r2.rows[0])
            return "plate";
    }
    return null;
}
function truckSortExpr(sortBy) {
    switch (sortBy) {
        case "name":
            return "lower(t.name)";
        case "type":
            return "t.type";
        case "status":
            return "t.status";
        case "capacity_cubic_ft":
            return "t.capacity_cubic_ft";
        case "created_at":
            return "t.created_at";
        default:
            return "lower(t.name)";
    }
}
export async function countTrucks(client, p) {
    const { where, vals } = buildTruckWhere(p);
    const r = await client.query(`SELECT count(*)::int AS c FROM trucks t ${where}`, vals);
    return r.rows[0]?.c ?? 0;
}
function buildTruckWhere(p) {
    const vals = [p.tenantId];
    let i = 2;
    const parts = [`t.tenant_id = $1`, `t.deleted_at IS NULL`];
    if (p.type?.length) {
        parts.push(`t.type = ANY($${i}::text[])`);
        vals.push(p.type);
        i++;
    }
    if (p.status?.length) {
        parts.push(`t.status = ANY($${i}::text[])`);
        vals.push(p.status);
        i++;
    }
    if (p.homeBase?.trim()) {
        parts.push(`t.home_base ILIKE $${i}`);
        vals.push(`%${p.homeBase.trim()}%`);
        i++;
    }
    if (p.minCapacityCubicFt != null) {
        parts.push(`t.capacity_cubic_ft >= $${i}`);
        vals.push(p.minCapacityCubicFt);
        i++;
    }
    if (p.minCapacityLbs != null) {
        parts.push(`t.capacity_lbs >= $${i}`);
        vals.push(p.minCapacityLbs);
        i++;
    }
    if (p.search?.trim()) {
        parts.push(`(t.name ILIKE $${i} OR t.license_plate ILIKE $${i} OR t.home_base ILIKE $${i})`);
        vals.push(`%${p.search.trim()}%`);
        i++;
    }
    return { where: `WHERE ${parts.join(" AND ")}`, vals };
}
export async function listTrucks(client, p) {
    const { where, vals } = buildTruckWhere(p);
    const sort = truckSortExpr(p.sortBy);
    const dir = p.sortOrder === "desc" ? "DESC" : "ASC";
    const idDir = p.sortOrder === "desc" ? "DESC" : "ASC";
    const order = p.sortBy === "name"
        ? `ORDER BY lower(t.name) ${dir}, t.id ${idDir}`
        : `ORDER BY ${sort} ${dir}, t.id ${idDir}`;
    const take = p.limit + 1;
    const v = [...vals, take, p.offset];
    const li = vals.length + 1;
    const oi = vals.length + 2;
    const r = await client.query(`SELECT t.* FROM trucks t
     ${where}
     ${order}
     LIMIT $${li} OFFSET $${oi}`, v);
    return r.rows;
}
export function decodeListCursor(cursor) {
    if (!cursor?.trim())
        return 0;
    try {
        const j = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
        return typeof j.o === "number" && j.o >= 0 ? j.o : 0;
    }
    catch {
        return 0;
    }
}
export function encodeListCursor(nextOffset) {
    return Buffer.from(JSON.stringify({ o: nextOffset }), "utf8").toString("base64url");
}
export async function updateTruckPartial(client, tenantId, id, patch) {
    const cur = await getTruckRowById(client, tenantId, id);
    if (!cur)
        return null;
    const name = patch.name ?? cur.name;
    const type = patch.type ?? cur.type;
    const license_plate = patch.license_plate !== undefined ? patch.license_plate : cur.license_plate;
    const vin = patch.vin !== undefined ? patch.vin : cur.vin;
    const capacity_cubic_ft = patch.capacity_cubic_ft !== undefined
        ? patch.capacity_cubic_ft
        : cur.capacity_cubic_ft
            ? Number(cur.capacity_cubic_ft)
            : null;
    const capacity_lbs = patch.capacity_lbs !== undefined
        ? patch.capacity_lbs
        : cur.capacity_lbs
            ? Number(cur.capacity_lbs)
            : null;
    const home_base = patch.home_base !== undefined ? patch.home_base : cur.home_base;
    const status = patch.status ?? cur.status;
    const daily_rate = patch.daily_rate !== undefined
        ? patch.daily_rate
        : cur.daily_rate
            ? Number(cur.daily_rate)
            : null;
    const mileage_rate = patch.mileage_rate !== undefined
        ? patch.mileage_rate
        : cur.mileage_rate
            ? Number(cur.mileage_rate)
            : null;
    const current_mileage = patch.current_mileage !== undefined
        ? patch.current_mileage
        : cur.current_mileage;
    const insurance_expiry = patch.insurance_expiry !== undefined
        ? patch.insurance_expiry
        : isoDateOnly(cur.insurance_expiry);
    const inspection_expiry = patch.inspection_expiry !== undefined
        ? patch.inspection_expiry
        : isoDateOnly(cur.inspection_expiry);
    const notes = patch.notes !== undefined ? patch.notes : cur.notes;
    const md = patch.metadata !== undefined
        ? patch.metadata
        : cur.metadata;
    const custom_fields = patch.custom_fields !== undefined
        ? patch.custom_fields
        : cur.custom_fields && typeof cur.custom_fields === "object" && !Array.isArray(cur.custom_fields)
            ? cur.custom_fields
            : {};
    const retired_at = patch.retired_at !== undefined
        ? patch.retired_at
        : cur.retired_at
            ? iso(cur.retired_at instanceof Date ? cur.retired_at : new Date(cur.retired_at))
            : null;
    await client.query(`UPDATE trucks SET
      name = $3, type = $4, license_plate = $5, vin = $6,
      capacity_cubic_ft = $7, capacity_lbs = $8, home_base = $9, status = $10,
      daily_rate = $11, mileage_rate = $12, current_mileage = $13,
      insurance_expiry = $14::date, inspection_expiry = $15::date,
      notes = $16, metadata = $17::jsonb,
      custom_fields = $18::jsonb,
      retired_at = $19::timestamptz,
      updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`, [
        tenantId,
        id,
        name,
        type,
        license_plate,
        vin,
        capacity_cubic_ft,
        capacity_lbs,
        home_base,
        status,
        daily_rate,
        mileage_rate,
        current_mileage,
        insurance_expiry,
        inspection_expiry,
        notes,
        JSON.stringify(md),
        JSON.stringify(custom_fields),
        retired_at,
    ]);
    const row = await getTruckRowById(client, tenantId, id);
    return row ? mapTruckRow(row) : null;
}
export async function retireTruck(client, tenantId, id) {
    const r = await client.query(`UPDATE trucks SET status = 'retired', retired_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING retired_at`, [tenantId, id]);
    if (!r.rows[0])
        return null;
    return {
        id,
        status: "retired",
        retired_at: iso(r.rows[0].retired_at),
    };
}
