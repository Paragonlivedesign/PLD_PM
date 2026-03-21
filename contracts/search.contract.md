# Search Module — Interface Contract

> **Version:** 1.0.0
> **Base Path:** `/api/v1/search`
> **Owner:** Search Module
> **Last Updated:** 2026-02-15

---

## Table of Contents

- [Response Envelope](#response-envelope)
- [Endpoints](#endpoints)
- [Type Definitions](#type-definitions)
- [Internal Interface](#internal-interface)
- [Domain Events](#domain-events)

---

## Response Envelope

All responses follow the standard envelope:

```
{
  data: <T> | null,
  meta: { ... } | null,
  errors: [ { code: string, message: string, field?: string } ] | null
}
```

---

## Endpoints

### GET /api/v1/search

**Description:** Unified search across all entity types. Returns results grouped by entity type, ranked by relevance with recency boosting. Results are post-filtered by the authenticated user's role-based entity permissions — entity types the user cannot access are excluded.

**Auth:** Required. Tenant-scoped. Requires `search.query` permission (granted to all authenticated users by default).

**Query Parameters — `SearchParams`:**

| Param | Type | Required | Description |
|---|---|---|---|
| q | string | yes | Search query text (min 1 char, max 200 chars). Supports quoted phrases for exact matching. |
| type | string (csv) | no | Filter to specific entity types: `events,personnel,trucks,venues,clients,documents`. Default: all types the user has access to. |
| limit | integer (1–25) | no | Results per entity type. Default: `5` (omnibar), use `25` for full search page. |
| include_archived | boolean | no | Include soft-deleted / completed / settled entities. Default: `false` |

**Response — `200 OK` — `SearchResponse`:**

```
{
  data: {
    results: {
      [entity_type: string]: SearchResult[]
    }
  },
  meta: {
    total_counts: {
      [entity_type: string]: integer
    },
    query: string,
    query_time_ms: integer
  },
  errors: null
}
```

**Example Response:**

```
{
  data: {
    results: {
      events: [
        {
          entity_id: "a1b2c3d4-...",
          entity_type: "events",
          title: "SXSW 2026",
          subtitle: "Client: Live Nation",
          metadata: { status: "confirmed", start_date: "2026-03-15" },
          relevance_score: 0.92
        }
      ],
      personnel: [
        {
          entity_id: "e5f6g7h8-...",
          entity_type: "personnel",
          title: "Alex Chen",
          subtitle: "Audio Engineer — Audio Department",
          metadata: { status: "active", email: "alex@example.com" },
          relevance_score: 0.85
        }
      ]
    }
  },
  meta: {
    total_counts: { events: 3, personnel: 12, trucks: 0, documents: 1 },
    query: "SXSW",
    query_time_ms: 42
  },
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Missing `q` parameter or query exceeds max length |
| 401 | Unauthenticated |

---

## Type Definitions

### SearchResult

| Field | Type | Description |
|---|---|---|
| entity_id | UUID | Source entity ID |
| entity_type | string | Entity type (`events`, `personnel`, `trucks`, `venues`, `clients`, `documents`) |
| title | string | Primary display text (entity name) |
| subtitle | string | null | Secondary display text (e.g., client name, role, department) |
| metadata | object | Additional display fields for result rendering (status, dates, type — varies by entity) |
| relevance_score | decimal | Combined relevance + recency score (0–1, higher is more relevant) |

---

## Internal Interface

These functions are callable by other modules via internal service calls. They are NOT exposed as HTTP endpoints.

### indexEntity

**Description:** Add or update an entity in the search index. Computes the search vector from provided data fields, using weighted full-text indexing (A/B/C/D weights based on entity type). Called by domain event listeners or directly by modules when they need immediate index consistency.

```
indexEntity(
  entity_type: string,             // e.g., "events", "personnel", "trucks"
  entity_id: UUID,
  tenant_id: UUID,
  data: {
    title: string,                 // primary display text
    subtitle?: string,             // secondary display text
    search_fields: {
      weight_a: string[],          // highest relevance fields (e.g., name)
      weight_b: string[],          // high relevance (e.g., client, email)
      weight_c: string[],          // medium relevance (e.g., description)
      weight_d: string[]           // low relevance (e.g., status, notes)
    },
    metadata: object,              // display fields stored alongside the index entry
    entity_updated_at: ISO 8601 datetime
  }
) → { indexed: boolean }
```

---

### removeFromIndex

**Description:** Remove an entity from the search index. Called when an entity is hard-deleted or permanently archived.

```
removeFromIndex(
  entity_type: string,
  entity_id: UUID,
  tenant_id: UUID
) → { removed: boolean }
```

---

### reindexAll

**Description:** Trigger a full re-index for a given entity type (or all types). Processes entities in batches using cursor-based pagination. Runs as a background job — returns immediately with a job ID. Admin-only operation.

```
reindexAll(
  entity_type: string | "all",
  tenant_id: UUID,
  options?: {
    batch_size?: integer,          // default: 500
    force?: boolean                // re-index even if entries appear up-to-date
  }
) → {
  job_id: UUID,
  status: "queued",
  estimated_entities: integer
}
```

---

## Domain Events

The Search module does **not** publish domain events to the shared event bus. It is a pure consumer — it listens to entity CRUD events from all modules to maintain the search index.

**Consumed events (for reference):**

| Source Event Pattern | Search Action |
|---|---|
| `*.created` (e.g., `event.created`, `personnel.created`) | Insert new search index entry |
| `*.updated` (e.g., `event.updated`, `personnel.updated`) | Re-compute search vector, upsert index entry |
| `*.deleted` (e.g., `event.deleted`, `personnel.deactivated`) | Mark index entry as deleted or remove |
| `fieldDefinition.created`, `fieldDefinition.updated`, `fieldDefinition.deleted` | Re-index affected entity type to incorporate custom field changes |
