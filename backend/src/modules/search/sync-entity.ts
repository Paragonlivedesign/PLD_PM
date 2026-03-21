import type { Pool } from "pg";
import { getClientById } from "../clients/repository.js";
import { getEventById } from "../events/repository.js";
import { getFieldsForSearch } from "../custom-fields/service.js";
import type { EntityType } from "../custom-fields/constants.js";
import { getTruckByIdInternal } from "../trucks/index.js";
import { getDocumentById } from "../documents/repository.js";
import { findPersonnelById } from "../personnel/personnel.repository.js";
import { indexEntity, removeFromIndex } from "./service.js";

function customFieldSearchParts(
  cf: Record<string, unknown> | undefined,
  keys: Set<string>,
): string[] {
  if (!cf) return [];
  const out: string[] = [];
  for (const k of keys) {
    const v = cf[k];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim()) out.push(v);
    else if (typeof v === "number" || typeof v === "boolean") out.push(String(v));
    else if (Array.isArray(v)) out.push(v.map(String).join(" "));
  }
  return out;
}

export async function syncEventSearchRow(pool: Pool, tenantId: string, eventId: string): Promise<void> {
  const ev = await getEventById(pool, tenantId, eventId);
  if (!ev) {
    await removeFromIndex(pool, "events", eventId, tenantId);
    return;
  }
  const client = ev.client_id ? await getClientById(pool, tenantId, ev.client_id) : null;
  const searchable = await getFieldsForSearch(pool, tenantId, "event" as EntityType);
  const keySet = new Set(searchable.map((f) => f.field_key));
  const weight_d = customFieldSearchParts(ev.custom_fields as Record<string, unknown> | undefined, keySet);
  await indexEntity(pool, "events", eventId, tenantId, {
    title: ev.name,
    subtitle: client?.name ?? undefined,
    search_fields: {
      weight_c: [ev.description ? String(ev.description) : ""],
      weight_d,
    },
    metadata: {
      status: ev.status,
      start_date: ev.start_date,
      phase: ev.phase,
    },
    entity_updated_at: ev.updated_at,
  });
}

export async function syncTruckSearchRow(pool: Pool, tenantId: string, truckId: string): Promise<void> {
  const tr = await getTruckByIdInternal(truckId, tenantId, { include_retired: true });
  if (!tr) {
    await removeFromIndex(pool, "trucks", truckId, tenantId);
    return;
  }
  await indexEntity(pool, "trucks", truckId, tenantId, {
    title: tr.name,
    subtitle: tr.type,
    search_fields: {
      weight_c: [tr.notes ? String(tr.notes) : ""],
    },
    metadata: { status: tr.status, type: tr.type },
    entity_updated_at: tr.updated_at,
  });
}

export async function syncDocumentSearchRow(pool: Pool, tenantId: string, documentId: string): Promise<void> {
  const row = await getDocumentById(pool, tenantId, documentId);
  if (!row || row.deleted_at) {
    await removeFromIndex(pool, "documents", documentId, tenantId);
    return;
  }
  await indexEntity(pool, "documents", documentId, tenantId, {
    title: row.name,
    subtitle: row.category,
    search_fields: {
      weight_c: [row.description ? String(row.description) : ""],
    },
    metadata: {
      category: row.category,
      mime_type: row.mime_type,
      event_id: row.event_id,
    },
    entity_updated_at: row.updated_at,
  });
}

export async function syncPersonnelSearchRow(
  pool: Pool,
  tenantId: string,
  personnelId: string,
): Promise<void> {
  const row = await findPersonnelById(pool, tenantId, personnelId, true);
  if (!row) {
    await removeFromIndex(pool, "personnel", personnelId, tenantId);
    return;
  }
  const searchable = await getFieldsForSearch(pool, tenantId, "personnel" as EntityType);
  const keySet = new Set(searchable.map((f) => f.field_key));
  const metaCf =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>).custom_fields
      : undefined;
  const cf =
    metaCf && typeof metaCf === "object" && !Array.isArray(metaCf)
      ? (metaCf as Record<string, unknown>)
      : undefined;
  const weight_d = customFieldSearchParts(cf, keySet);
  if (row.skills?.length) weight_d.push(row.skills.join(" "));
  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || row.email;
  await indexEntity(pool, "personnel", personnelId, tenantId, {
    title: name,
    subtitle: row.email,
    search_fields: {
      weight_c: [row.role ? String(row.role) : ""],
      weight_d,
    },
    metadata: { status: row.status, email: row.email },
    entity_updated_at: row.updated_at,
  });
}
