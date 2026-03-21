# Events Module — Interface Contract

> **Version:** 1.0.0
> **Base Path:** `/api/v1/events`
> **Owner:** Events Module
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

### POST /api/v1/events

**Description:** Create a new event.

**Auth:** Required. Tenant-scoped. **`events:create`**

**Request Body — `CreateEventRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| name | string | yes | Event name (1–255 chars) |
| client_id | UUID | yes | Owning client reference |
| venue_id | UUID | no | Venue reference |
| primary_contact_id | UUID | no | Optional `contacts.id` for show primary contact; must be tenant-scoped and match **client** or **venue** parent rules (see below) |
| start_date | ISO 8601 date | yes | Event start date |
| end_date | ISO 8601 date | yes | Event end date |
| load_in_date | ISO 8601 date | no | Load-in date (must be <= start_date) |
| load_out_date | ISO 8601 date | no | Load-out date (must be >= end_date) |
| status | enum: draft, confirmed, in_progress, completed, cancelled | no | Defaults to `draft` |
| phase | enum: planning, pre_production, production, post_production, closed | no | Defaults to `planning` |
| description | string | no | Free-text description (max 5000 chars) |
| tags | string[] | no | Arbitrary tags for filtering |
| metadata | object | no | Key-value custom fields |

**Reserved metadata keys (UI / product):**

- `running_schedule` — object: `cells` (map of `rowKey|YYYY-MM-DD` → string), optional `phaseByDate` (map of date → label, use `off` to mark off columns), optional `showDate` (`YYYY-MM-DD` for show-day highlight; defaults to event `end_date` in the UI). Merged on `PUT` like other metadata keys.

**Response — `201 Created`:**

```
{
  data: EventResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure (missing required fields, invalid dates) |
| 401 | Unauthenticated |
| 403 | Insufficient permissions |
| 409 | Duplicate event name for the same client + date range |

**Primary contact:** If `primary_contact_id` is set, the contact must belong to the same tenant and either (a) `parent_type = client_organization` and `parent_id = client_id`, or (b) `parent_type = venue` and `parent_id = venue_id` when the event has a `venue_id`. Vendor-only contacts cannot be used as the event primary contact.

---

### GET /api/v1/events

**Description:** List events with filtering, search, and cursor-based pagination.

**Auth:** Required. Tenant-scoped. **`events:read`**

**Query Parameters — `EventFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| status | enum (csv) | no | Filter by one or more statuses: `draft,confirmed,in_progress,completed,cancelled` |
| phase | enum (csv) | no | Filter by one or more phases |
| client_id | UUID | no | Filter by client |
| venue_id | UUID | no | Filter by venue |
| date_range_start | ISO 8601 date | no | Events overlapping on or after this date |
| date_range_end | ISO 8601 date | no | Events overlapping on or before this date |
| search | string | no | Full-text search across name, description, tags |
| sort_by | enum: name, start_date, end_date, created_at, updated_at | no | Default: `start_date` |
| sort_order | enum: asc, desc | no | Default: `asc` |
| cursor | string (opaque) | no | Cursor for next page |
| limit | integer (1–100) | no | Default: `25` |

**Response — `200 OK` — `EventListResponse`:**

```
{
  data: EventResponse[],
  meta: {
    cursor: string | null,       // null when no more pages
    has_more: boolean,
    total_count: integer          // total matching records
  },
  errors: null
}
```

---

### GET /api/v1/events/:id

**Description:** Retrieve a single event by ID.

**Auth:** Required. Tenant-scoped. **`events:read`**

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Event ID |

**Response — `200 OK`:**

```
{
  data: EventResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 404 | Event not found or not accessible within tenant |

---

### PUT /api/v1/events/:id

**Description:** Update an existing event. Partial updates supported — only provided fields are changed.

**Auth:** Required. Tenant-scoped. **`events:update`**

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Event ID |

**Request Body — `UpdateEventRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| name | string | no | Event name (1–255 chars) |
| client_id | UUID | no | Owning client reference |
| venue_id | UUID | no | Venue reference (set `null` to clear) |
| primary_contact_id | UUID | no | Set or clear (`null`); re-validated against resulting `client_id` / `venue_id` |
| start_date | ISO 8601 date | no | Event start date |
| end_date | ISO 8601 date | no | Event end date |
| load_in_date | ISO 8601 date | no | Load-in date |
| load_out_date | ISO 8601 date | no | Load-out date |
| status | enum | no | Event status |
| description | string | no | Free-text description |
| tags | string[] | no | Replaces existing tags |
| metadata | object | no | Merged with existing metadata |

**Response — `200 OK`:**

```
{
  data: EventResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure (including invalid `primary_contact_id` for the event’s client/venue) |
| 404 | Event not found |
| 409 | Conflicting update (optimistic lock via `updated_at`) |

---

### DELETE /api/v1/events/:id

**Description:** Soft-delete an event. Sets `deleted_at` timestamp. Event becomes inaccessible via standard queries.

**Auth:** Required. Tenant-scoped. **`events:delete`**

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Event ID |

**Response — `200 OK`:**

```
{
  data: { id: UUID, deleted_at: ISO 8601 datetime },
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 404 | Event not found |
| 409 | Event has active assignments or unpaid invoices (cannot delete) |

---

### POST /api/v1/events/:id/clone

**Description:** Clone an event, creating a new event with the same configuration. Does NOT clone assignments, financials, or documents.

**Auth:** Required. Tenant-scoped. **`events:create`**

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Source event ID |

**Request Body — `CloneEventRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| name | string | yes | Name for the cloned event |
| start_date | ISO 8601 date | yes | New start date |
| end_date | ISO 8601 date | yes | New end date |
| clone_options | object | no | See below |

**clone_options:**

| Field | Type | Default | Description |
|---|---|---|---|
| include_venue | boolean | true | Carry over venue reference |
| include_tags | boolean | true | Carry over tags |
| include_metadata | boolean | true | Carry over metadata |

**Response — `201 Created`:**

```
{
  data: EventResponse,
  meta: { cloned_from: UUID },
  errors: null
}
```

---

### PUT /api/v1/events/:id/phase

**Description:** Advance or set the event phase. Phase transitions are validated (cannot skip phases or move backward except to `planning`).

**Auth:** Required. Tenant-scoped. **`events:update`** (same as general event update).

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Event ID |

**Request Body — `UpdatePhaseRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| phase | enum: planning, pre_production, production, post_production, closed | yes | Target phase |
| notes | string | no | Reason or notes for phase change |

**Valid Phase Transitions:**

```
planning → pre_production → production → post_production → closed
Any phase → planning (reset)
```

**Response — `200 OK`:**

```
{
  data: EventResponse,
  meta: {
    previous_phase: string,
    new_phase: string,
    transitioned_at: ISO 8601 datetime
  },
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Invalid phase transition |
| 404 | Event not found |
| 409 | Preconditions not met (e.g., moving to `closed` with open assignments) |

---

## Type Definitions

### EventResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Unique event identifier |
| name | string | Event name |
| client_id | UUID | Owning client reference |
| venue_id | UUID \| null | Venue reference |
| primary_contact_id | UUID \| null | Optional primary CRM contact (`contacts.id`), validated against client/venue |
| start_date | ISO 8601 date | Event start date |
| end_date | ISO 8601 date | Event end date |
| load_in_date | ISO 8601 date | null | Load-in date |
| load_out_date | ISO 8601 date | null | Load-out date |
| status | enum: draft, confirmed, in_progress, completed, cancelled | Current status |
| phase | enum: planning, pre_production, production, post_production, closed | Current phase |
| description | string | null | Free-text description |
| tags | string[] | Tags |
| metadata | object | Custom key-value fields |
| custom_fields | object | Tenant-defined custom field values |
| created_at | ISO 8601 datetime | Creation timestamp |
| updated_at | ISO 8601 datetime | Last update timestamp |
| deleted_at | ISO 8601 datetime | null | Soft-delete timestamp |

---

## Internal Interface

These functions are callable by other modules via internal service calls. They are NOT exposed as HTTP endpoints.

### getEventById

**Description:** Retrieve a single event by its ID. Returns `null` if not found or soft-deleted.

```
getEventById(
  event_id: UUID,
  tenant_id: UUID
) → EventResponse | null
```

---

### getEventsByDateRange

**Description:** Retrieve all events overlapping a given date range.

```
getEventsByDateRange(
  start_date: ISO 8601 date,
  end_date: ISO 8601 date,
  tenant_id: UUID,
  options?: {
    status?: enum[],
    phase?: enum[],
    include_load_dates?: boolean     // if true, overlap check includes load_in/load_out
  }
) → EventResponse[]
```

---

### getEventsByClient

**Description:** Retrieve all events belonging to a specific client.

```
getEventsByClient(
  client_id: UUID,
  tenant_id: UUID,
  options?: {
    status?: enum[],
    limit?: integer
  }
) → EventResponse[]
```

---

### validateEventAccess

**Description:** Verify that a given user/role has access to a specific event. Returns a boolean. Used by other modules before performing cross-module operations.

```
validateEventAccess(
  event_id: UUID,
  tenant_id: UUID,
  user_id: UUID,
  required_permission?: string       // e.g., "events:read", "events:write"
) → { allowed: boolean, reason?: string }
```

---

## Domain Events

All domain events are published to the internal event bus. Consumers must be idempotent.

### event.created

**Trigger:** A new event is successfully created.

**Payload — `EventCreatedPayload`:**

| Field | Type | Description |
|---|---|---|
| event_id | UUID | Created event ID |
| tenant_id | UUID | Tenant scope |
| name | string | Event name |
| client_id | UUID | Client reference |
| venue_id | UUID | null | Venue reference |
| start_date | ISO 8601 date | Event start date |
| end_date | ISO 8601 date | Event end date |
| status | string | Initial status |
| phase | string | Initial phase |
| created_by | UUID | User who created the event |
| created_at | ISO 8601 datetime | Timestamp |

---

### event.updated

**Trigger:** An existing event is updated (any field change via PUT).

**Payload — `EventUpdatedPayload`:**

| Field | Type | Description |
|---|---|---|
| event_id | UUID | Updated event ID |
| tenant_id | UUID | Tenant scope |
| changed_fields | string[] | List of field names that changed |
| previous_values | object | Map of field → old value for changed fields |
| new_values | object | Map of field → new value for changed fields |
| updated_by | UUID | User who made the update |
| updated_at | ISO 8601 datetime | Timestamp |

---

### event.datesChanged

**Trigger:** `start_date` and/or `end_date` change on an existing event (partial update). Emitted after `event.updated` for the same request when dates are in the patch.

**Payload — `EventDatesChangedPayload`:**

| Field | Type | Description |
|---|---|---|
| event_id | UUID | Event ID |
| tenant_id | UUID | Tenant scope |
| old_start_date | ISO 8601 date | Previous start |
| old_end_date | ISO 8601 date | Previous end |
| new_start_date | ISO 8601 date | Updated start |
| new_end_date | ISO 8601 date | Updated end |

**Bus name:** `event.datesChanged` (camelCase), consistent with other Events module emits.

---

### event.phaseChanged

**Trigger:** An event's phase is changed via the phase endpoint.

**Payload — `EventPhaseChangedPayload`:**

| Field | Type | Description |
|---|---|---|
| event_id | UUID | Event ID |
| tenant_id | UUID | Tenant scope |
| previous_phase | string | Phase before the change |
| new_phase | string | Phase after the change |
| notes | string | null | Optional notes |
| changed_by | UUID | User who changed the phase |
| changed_at | ISO 8601 datetime | Timestamp |

---

### event.deleted

**Trigger:** An event is soft-deleted.

**Payload — `EventDeletedPayload`:**

| Field | Type | Description |
|---|---|---|
| event_id | UUID | Deleted event ID |
| tenant_id | UUID | Tenant scope |
| name | string | Event name (for audit/log reference) |
| client_id | UUID | Client reference |
| deleted_by | UUID | User who deleted the event |
| deleted_at | ISO 8601 datetime | Timestamp |
