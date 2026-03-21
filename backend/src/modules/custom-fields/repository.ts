import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { EntityType } from "./constants.js";
import type { CustomFieldDefinitionResponse, SelectOption, ValidationRules } from "./types.js";

type Row = {
  id: string;
  tenant_id: string;
  entity_type: string;
  field_key: string;
  label: string;
  description: string | null;
  field_type: string;
  validation_rules: unknown;
  default_value: unknown;
  options: unknown;
  is_required: boolean;
  is_searchable: boolean;
  display_order: number;
  visibility: string;
  version: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

function iso(d: Date): string {
  return d.toISOString();
}

export function mapRow(r: Row): CustomFieldDefinitionResponse {
  return {
    id: r.id,
    entity_type: r.entity_type as EntityType,
    field_key: r.field_key,
    label: r.label,
    description: r.description,
    field_type: r.field_type as CustomFieldDefinitionResponse["field_type"],
    validation_rules:
      r.validation_rules && typeof r.validation_rules === "object"
        ? (r.validation_rules as ValidationRules)
        : null,
    default_value: r.default_value === undefined ? null : r.default_value,
    options: Array.isArray(r.options) ? (r.options as SelectOption[]) : r.options ? (r.options as SelectOption[]) : null,
    is_required: r.is_required,
    is_searchable: r.is_searchable,
    display_order: r.display_order,
    visibility: r.visibility as CustomFieldDefinitionResponse["visibility"],
    version: r.version,
    created_at: iso(r.created_at instanceof Date ? r.created_at : new Date(r.created_at)),
    updated_at: iso(r.updated_at instanceof Date ? r.updated_at : new Date(r.updated_at)),
    deleted_at: r.deleted_at ? iso(r.deleted_at instanceof Date ? r.deleted_at : new Date(r.deleted_at)) : null,
  };
}

export async function listDefinitions(
  client: Pool | PoolClient,
  tenantId: string,
  entityType: EntityType,
  includeDeprecated: boolean,
): Promise<CustomFieldDefinitionResponse[]> {
  const dep = includeDeprecated ? "" : " AND deleted_at IS NULL";
  const r = await client.query<Row>(
    `SELECT * FROM custom_field_definitions
     WHERE tenant_id = $1 AND entity_type = $2${dep}
     ORDER BY display_order ASC, field_key ASC`,
    [tenantId, entityType],
  );
  return r.rows.map(mapRow);
}

export async function getDefinitionById(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
): Promise<CustomFieldDefinitionResponse | null> {
  const r = await client.query<Row>(
    `SELECT * FROM custom_field_definitions WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id],
  );
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

export async function countActiveDefinitions(
  client: Pool | PoolClient,
  tenantId: string,
  entityType: EntityType,
): Promise<number> {
  const r = await client.query<{ c: string }>(
    `SELECT count(*)::int AS c FROM custom_field_definitions
     WHERE tenant_id = $1 AND entity_type = $2 AND deleted_at IS NULL`,
    [tenantId, entityType],
  );
  return r.rows[0] ? Number(r.rows[0].c) : 0;
}

export async function countSearchableDefinitions(
  client: Pool | PoolClient,
  tenantId: string,
  entityType: EntityType,
): Promise<number> {
  const r = await client.query<{ c: string }>(
    `SELECT count(*)::int AS c FROM custom_field_definitions
     WHERE tenant_id = $1 AND entity_type = $2 AND deleted_at IS NULL AND is_searchable = TRUE`,
    [tenantId, entityType],
  );
  return r.rows[0] ? Number(r.rows[0].c) : 0;
}

export async function fieldKeyExists(
  client: Pool | PoolClient,
  tenantId: string,
  entityType: EntityType,
  fieldKey: string,
): Promise<boolean> {
  const r = await client.query<{ c: string }>(
    `SELECT count(*)::int AS c FROM custom_field_definitions
     WHERE tenant_id = $1 AND entity_type = $2 AND field_key = $3 AND deleted_at IS NULL`,
    [tenantId, entityType, fieldKey],
  );
  return Number(r.rows[0]?.c) > 0;
}

export async function nextDisplayOrder(
  client: Pool | PoolClient,
  tenantId: string,
  entityType: EntityType,
): Promise<number> {
  const r = await client.query<{ m: string | null }>(
    `SELECT max(display_order) AS m FROM custom_field_definitions
     WHERE tenant_id = $1 AND entity_type = $2 AND deleted_at IS NULL`,
    [tenantId, entityType],
  );
  const m = r.rows[0]?.m;
  return m == null ? 0 : Number(m) + 1;
}

export async function insertDefinition(
  client: Pool | PoolClient,
  row: {
    id: string;
    tenantId: string;
    entityType: EntityType;
    fieldKey: string;
    label: string;
    description: string | null;
    fieldType: string;
    validationRules: ValidationRules | null;
    defaultValue: unknown;
    options: SelectOption[] | null;
    isRequired: boolean;
    isSearchable: boolean;
    displayOrder: number;
    visibility: string;
  },
): Promise<CustomFieldDefinitionResponse> {
  const r = await client.query<Row>(
    `INSERT INTO custom_field_definitions (
      id, tenant_id, entity_type, field_key, label, description, field_type,
      validation_rules, default_value, options, is_required, is_searchable,
      display_order, visibility, version
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12,$13,$14,1
    ) RETURNING *`,
    [
      row.id,
      row.tenantId,
      row.entityType,
      row.fieldKey,
      row.label,
      row.description,
      row.fieldType,
      row.validationRules ? JSON.stringify(row.validationRules) : null,
      row.defaultValue !== undefined && row.defaultValue !== null
        ? JSON.stringify(row.defaultValue)
        : null,
      row.options ? JSON.stringify(row.options) : null,
      row.isRequired,
      row.isSearchable,
      row.displayOrder,
      row.visibility,
    ],
  );
  return mapRow(r.rows[0]);
}

export async function appendHistory(
  client: Pool | PoolClient,
  id: string,
  definitionId: string,
  tenantId: string,
  snapshot: CustomFieldDefinitionResponse,
  version: number,
): Promise<void> {
  await client.query(
    `INSERT INTO custom_field_definition_history (id, definition_id, tenant_id, snapshot, version)
     VALUES ($1, $2, $3, $4::jsonb, $5)`,
    [id, definitionId, tenantId, JSON.stringify(snapshot), version],
  );
}

export async function updateDefinitionRow(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
  patch: {
    label?: string;
    description?: string | null;
    validation_rules?: ValidationRules | null;
    default_value?: unknown;
    options?: SelectOption[] | null;
    is_required?: boolean;
    is_searchable?: boolean;
    display_order?: number;
    visibility?: string;
    deleted_at?: Date | null;
  },
  previousSnapshot: CustomFieldDefinitionResponse,
): Promise<CustomFieldDefinitionResponse | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let n = 1;
  const add = (col: string, val: unknown, json = false) => {
    sets.push(`${col} = ${json ? `$${n}::jsonb` : `$${n}`}`);
    vals.push(val);
    n++;
  };
  if (patch.label !== undefined) add("label", patch.label);
  if (patch.description !== undefined) add("description", patch.description);
  if (patch.validation_rules !== undefined)
    add("validation_rules", patch.validation_rules ? JSON.stringify(patch.validation_rules) : null, true);
  if (patch.default_value !== undefined)
    add(
      "default_value",
      patch.default_value !== undefined && patch.default_value !== null
        ? JSON.stringify(patch.default_value)
        : null,
      true,
    );
  if (patch.options !== undefined) add("options", patch.options ? JSON.stringify(patch.options) : null, true);
  if (patch.is_required !== undefined) add("is_required", patch.is_required);
  if (patch.is_searchable !== undefined) add("is_searchable", patch.is_searchable);
  if (patch.display_order !== undefined) add("display_order", patch.display_order);
  if (patch.visibility !== undefined) add("visibility", patch.visibility);
  if (patch.deleted_at !== undefined) {
    sets.push(`deleted_at = $${n}`);
    vals.push(patch.deleted_at);
    n++;
  }
  sets.push(`version = version + 1`);
  sets.push(`updated_at = NOW()`);
  vals.push(tenantId, id);
  const i1 = vals.length - 1;
  const i2 = vals.length;
  const sql = `UPDATE custom_field_definitions SET ${sets.join(", ")}
    WHERE tenant_id = $${i1} AND id = $${i2}::uuid AND deleted_at IS NULL RETURNING *`;
  const r = await client.query<Row>(sql, vals);
  if (!r.rows[0]) return null;
  const updated = mapRow(r.rows[0]);
  await appendHistory(
    client,
    randomUUID(),
    id,
    tenantId,
    previousSnapshot,
    previousSnapshot.version,
  );
  return updated;
}

export async function softDeleteDefinition(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
  previousSnapshot: CustomFieldDefinitionResponse,
): Promise<{ id: string; deleted_at: string } | null> {
  const r = await client.query<{ id: string; deleted_at: Date }>(
    `UPDATE custom_field_definitions
     SET deleted_at = NOW(), version = version + 1, updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING id, deleted_at`,
    [tenantId, id],
  );
  if (!r.rows[0]) return null;
  await appendHistory(
    client,
    randomUUID(),
    id,
    tenantId,
    previousSnapshot,
    previousSnapshot.version,
  );
  return {
    id: r.rows[0].id,
    deleted_at: iso(r.rows[0].deleted_at),
  };
}

export async function setDisplayOrders(
  client: Pool | PoolClient,
  tenantId: string,
  entityType: EntityType,
  orderedIds: string[],
): Promise<CustomFieldDefinitionResponse[]> {
  let order = 0;
  for (const defId of orderedIds) {
    await client.query(
      `UPDATE custom_field_definitions SET display_order = $3, updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2 AND entity_type = $4 AND deleted_at IS NULL`,
      [tenantId, defId, order++, entityType],
    );
  }
  return listDefinitions(client, tenantId, entityType, false);
}

/** Read custom_fields JSONB for index sync. */
export async function fetchEntityCustomFieldsJson(
  client: Pool | PoolClient,
  tenantId: string,
  entityType: EntityType,
  entityId: string,
): Promise<Record<string, unknown> | null> {
  const table = entityTable(entityType);
  const r = await client.query<{ custom_fields: unknown }>(
    `SELECT custom_fields FROM ${table} WHERE tenant_id = $1 AND id = $2`,
    [tenantId, entityId],
  );
  if (!r.rows[0]) return null;
  const cf = r.rows[0].custom_fields;
  if (cf && typeof cf === "object" && !Array.isArray(cf)) return cf as Record<string, unknown>;
  return {};
}

function entityTable(entityType: EntityType): string {
  switch (entityType) {
    case "event":
      return "events";
    case "personnel":
      return "personnel";
    case "travel_record":
      return "travel_records";
    case "financial_line_item":
      return "financial_line_items";
    case "department":
      return "departments";
    default:
      return "events";
  }
}

export async function upsertIndexRow(
  client: Pool | PoolClient,
  params: {
    id: string;
    tenantId: string;
    entityType: EntityType;
    entityId: string;
    fieldKey: string;
    valueText: string | null;
    valueNumeric: number | null;
    valueDate: Date | null;
    valueBoolean: boolean | null;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO custom_field_index (
      id, tenant_id, entity_type, entity_id, field_key,
      value_text, value_numeric, value_date, value_boolean, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
    ON CONFLICT (tenant_id, entity_type, entity_id, field_key)
    DO UPDATE SET
      value_text = EXCLUDED.value_text,
      value_numeric = EXCLUDED.value_numeric,
      value_date = EXCLUDED.value_date,
      value_boolean = EXCLUDED.value_boolean,
      updated_at = NOW()`,
    [
      params.id,
      params.tenantId,
      params.entityType,
      params.entityId,
      params.fieldKey,
      params.valueText,
      params.valueNumeric,
      params.valueDate,
      params.valueBoolean,
    ],
  );
}

export async function deleteIndexRow(
  client: Pool | PoolClient,
  tenantId: string,
  entityType: EntityType,
  entityId: string,
  fieldKey: string,
): Promise<void> {
  await client.query(
    `DELETE FROM custom_field_index
     WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 AND field_key = $4`,
    [tenantId, entityType, entityId, fieldKey],
  );
}
