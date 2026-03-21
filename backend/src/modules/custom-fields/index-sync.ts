import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { ENTITY_CUSTOM_FIELDS_UPDATED } from "../../domain/entity-events.js";
import type { EntityType } from "./constants.js";
import type { CustomFieldDefinitionResponse } from "./types.js";
import { domainBus } from "../../domain/bus.js";
import {
  deleteIndexRow,
  fetchEntityCustomFieldsJson,
  listDefinitions,
  upsertIndexRow,
} from "./repository.js";

function valueToIndexColumns(
  def: CustomFieldDefinitionResponse,
  raw: unknown,
): {
  valueText: string | null;
  valueNumeric: number | null;
  valueDate: Date | null;
  valueBoolean: boolean | null;
} {
  const ft = def.field_type;
  if (raw === undefined || raw === null) {
    return { valueText: null, valueNumeric: null, valueDate: null, valueBoolean: null };
  }
  switch (ft) {
    case "text":
    case "url":
    case "email":
    case "phone":
    case "select":
      return {
        valueText: typeof raw === "string" ? raw : String(raw),
        valueNumeric: null,
        valueDate: null,
        valueBoolean: null,
      };
    case "multi_select":
      return {
        valueText: Array.isArray(raw) ? raw.join(", ") : String(raw),
        valueNumeric: null,
        valueDate: null,
        valueBoolean: null,
      };
    case "number":
      return {
        valueText: null,
        valueNumeric: typeof raw === "number" ? raw : Number(raw),
        valueDate: null,
        valueBoolean: null,
      };
    case "boolean":
      return {
        valueText: null,
        valueNumeric: null,
        valueDate: null,
        valueBoolean: Boolean(raw),
      };
    case "date":
      return {
        valueText: null,
        valueNumeric: null,
        valueDate: new Date(`${raw}T00:00:00.000Z`),
        valueBoolean: null,
      };
    case "datetime": {
      const d = new Date(String(raw));
      return {
        valueText: null,
        valueNumeric: null,
        valueDate: Number.isNaN(d.getTime()) ? null : d,
        valueBoolean: null,
      };
    }
    default:
      return { valueText: null, valueNumeric: null, valueDate: null, valueBoolean: null };
  }
}

export async function syncSearchIndexForEntity(
  pool: Pool,
  tenantId: string,
  entityType: EntityType,
  entityId: string,
): Promise<void> {
  const defs = await listDefinitions(pool, tenantId, entityType, false);
  const searchable = defs.filter((d) => d.is_searchable && !d.deleted_at);
  const data = await fetchEntityCustomFieldsJson(pool, tenantId, entityType, entityId);
  if (data === null) return;

  const keys = new Set(searchable.map((d) => d.field_key));
  for (const def of searchable) {
    const raw = data[def.field_key];
    const cols = valueToIndexColumns(def, raw);
    const hasValue =
      raw !== undefined &&
      raw !== null &&
      !(typeof raw === "string" && raw === "") &&
      !(Array.isArray(raw) && raw.length === 0);
    if (!hasValue) {
      await deleteIndexRow(pool, tenantId, entityType, entityId, def.field_key);
      continue;
    }
    await upsertIndexRow(pool, {
      id: randomUUID(),
      tenantId,
      entityType,
      entityId,
      fieldKey: def.field_key,
      valueText: cols.valueText,
      valueNumeric: cols.valueNumeric,
      valueDate: cols.valueDate,
      valueBoolean: cols.valueBoolean,
    });
  }

  for (const key of Object.keys(data)) {
    if (!keys.has(key)) {
      await deleteIndexRow(pool, tenantId, entityType, entityId, key);
    }
  }
}

export function registerCustomFieldIndexListeners(pool: Pool): void {
  domainBus.on(
    ENTITY_CUSTOM_FIELDS_UPDATED,
    (payload: { tenantId: string; entityType: EntityType; entityId: string }) => {
      void syncSearchIndexForEntity(pool, payload.tenantId, payload.entityType, payload.entityId).catch(
        (err) => console.error("[custom-field-index]", err),
      );
    },
  );
}
