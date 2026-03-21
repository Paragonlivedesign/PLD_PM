# Scheduling Module — Interface Contract

> **Version:** 1.0.0
> **Base Path:** `/api/v1/assignments`, `/api/v1/schedule`, `/api/v1/conflicts`
> **Owner:** Scheduling Module
> **Last Updated:** 2026-03-22

---

## Table of Contents

- [Response Envelope](#response-envelope)
- [Endpoints — Crew Assignments](#endpoints--crew-assignments)
- [Endpoints — Truck Assignments](#endpoints--truck-assignments)
- [Endpoints — Schedule View](#endpoints--schedule-view)
- [Endpoints — Conflicts](#endpoints--conflicts)
- [Endpoints — Bulk Operations](#endpoints--bulk-operations)
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

## Endpoints — Crew Assignments

### POST /api/v1/assignments/crew

**Description:** Create a crew (personnel) assignment to an event.

**Auth:** Required. Tenant-scoped. Requires `scheduling:create` permission.

**Request Body — `CreateCrewAssignmentRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| event_id | UUID | yes | Target event |
| personnel_id | UUID | yes | Personnel being assigned |
| role | string | yes | Assignment role (e.g., "Stage Manager", "Audio Engineer") |
| department_id | UUID | no | Department context for this assignment |
| start_date | ISO 8601 date | yes | Assignment start date |
| end_date | ISO 8601 date | yes | Assignment end date |
| start_time | string (HH:MM) | no | Daily start time |
| end_time | string (HH:MM) | no | Daily end time |
| day_rate_override | decimal | no | Override the personnel's default day rate |
| per_diem_override | decimal | no | Override the personnel's default per-diem |
| notes | string | no | Assignment notes |
| status | enum: tentative, confirmed, cancelled | no | Default: `tentative` |

**Response — `201 Created`:**

```
{
  data: CrewAssignmentResponse,
  meta: {
    conflicts: ConflictSummary[]    // any detected scheduling conflicts
  },
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure (invalid dates, personnel not found) |
| 404 | Event or personnel not found |
| 409 | Hard conflict — personnel already has a confirmed assignment for the same dates |

---

### GET /api/v1/assignments/crew

**Description:** List crew assignments with filtering.

**Auth:** Required. Tenant-scoped.

**Query Parameters — `CrewAssignmentFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| event_id | UUID | no | Filter by event |
| personnel_id | UUID | no | Filter by personnel |
| department_id | UUID | no | Filter by department |
| status | enum (csv) | no | Filter by status: `tentative,confirmed,cancelled` |
| date_range_start | ISO 8601 date | no | Assignments overlapping on or after |
| date_range_end | ISO 8601 date | no | Assignments overlapping on or before |
| sort_by | enum: start_date, personnel_name, event_name, created_at | no | Default: `start_date` |
| sort_order | enum: asc, desc | no | Default: `asc` |
| cursor | string (opaque) | no | Cursor for next page |
| limit | integer (1–100) | no | Default: `25` |

**Response — `200 OK`:**

```
{
  data: CrewAssignmentResponse[],
  meta: {
    cursor: string | null,
    has_more: boolean,
    total_count: integer
  },
  errors: null
}
```

---

### GET /api/v1/assignments/crew/:id

**Description:** Retrieve a single crew assignment.

**Auth:** Required. Tenant-scoped.

**Response — `200 OK`:**

```
{
  data: CrewAssignmentResponse,
  meta: null,
  errors: null
}
```

---

### PUT /api/v1/assignments/crew/:id

**Description:** Update a crew assignment. Partial updates supported.

**Auth:** Required. Tenant-scoped. Requires `scheduling:update` permission.

**Request Body — `UpdateCrewAssignmentRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| role | string | no | Assignment role |
| department_id | UUID | no | Department context |
| start_date | ISO 8601 date | no | Assignment start date |
| end_date | ISO 8601 date | no | Assignment end date |
| start_time | string (HH:MM) | no | Daily start time |
| end_time | string (HH:MM) | no | Daily end time |
| day_rate_override | decimal | no | Rate override (set `null` to clear) |
| per_diem_override | decimal | no | Per-diem override (set `null` to clear) |
| notes | string | no | Notes |
| status | enum: tentative, confirmed, cancelled | no | Status |

**Response — `200 OK`:**

```
{
  data: CrewAssignmentResponse,
  meta: {
    conflicts: ConflictSummary[]
  },
  errors: null
}
```

---

### DELETE /api/v1/assignments/crew/:id

**Description:** Delete a crew assignment.

**Auth:** Required. Tenant-scoped. Requires `scheduling:delete` permission.

**Response — `200 OK`:**

```
{
  data: { id: UUID, deleted_at: ISO 8601 datetime },
  meta: null,
  errors: null
}
```

---

## Endpoints — Truck Assignments

### POST /api/v1/assignments/truck

**Description:** Create a truck assignment to an event.

**Auth:** Required. Tenant-scoped. Requires `scheduling:create` permission.

**Request Body — `CreateTruckAssignmentRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| event_id | UUID | yes | Target event |
| truck_id | UUID | yes | Truck being assigned |
| purpose | string | no | Purpose description (e.g., "Audio transport") |
| start_date | ISO 8601 date | yes | Assignment start date |
| end_date | ISO 8601 date | yes | Assignment end date |
| driver_id | UUID | no | Assigned driver (personnel reference) |
| notes | string | no | Assignment notes |
| status | enum: tentative, confirmed, cancelled | no | Default: `tentative` |

**Response — `201 Created`:**

```
{
  data: TruckAssignmentResponse,
  meta: {
    conflicts: ConflictSummary[]
  },
  errors: null
}
```

---

### GET /api/v1/assignments/truck

**Description:** List truck assignments with filtering.

**Auth:** Required. Tenant-scoped.

**Query Parameters — `TruckAssignmentFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| event_id | UUID | no | Filter by event |
| truck_id | UUID | no | Filter by truck |
| driver_id | UUID | no | Filter by driver |
| status | enum (csv) | no | Filter by status |
| date_range_start | ISO 8601 date | no | Assignments overlapping on or after |
| date_range_end | ISO 8601 date | no | Assignments overlapping on or before |
| cursor | string (opaque) | no | Cursor for next page |
| limit | integer (1–100) | no | Default: `25` |

**Response — `200 OK`:**

```
{
  data: TruckAssignmentResponse[],
  meta: {
    cursor: string | null,
    has_more: boolean,
    total_count: integer
  },
  errors: null
}
```

---

### GET /api/v1/assignments/truck/:id

**Description:** Retrieve a single truck assignment.

**Response — `200 OK`:**

```
{
  data: TruckAssignmentResponse,
  meta: null,
  errors: null
}
```

---

### PUT /api/v1/assignments/truck/:id

**Description:** Update a truck assignment. Partial updates supported.

**Auth:** Required. Tenant-scoped. Requires `scheduling:update` permission.

**Request Body — `UpdateTruckAssignmentRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| purpose | string | no | Purpose |
| start_date | ISO 8601 date | no | Start date |
| end_date | ISO 8601 date | no | End date |
| driver_id | UUID | no | Driver (set `null` to clear) |
| notes | string | no | Notes |
| status | enum | no | Status |

**Response — `200 OK`:**

```
{
  data: TruckAssignmentResponse,
  meta: {
    conflicts: ConflictSummary[]
  },
  errors: null
}
```

---

### DELETE /api/v1/assignments/truck/:id

**Description:** Delete a truck assignment.

**Auth:** Required. Tenant-scoped. Requires `scheduling:delete` permission.

**Response — `200 OK`:**

```
{
  data: { id: UUID, deleted_at: ISO 8601 datetime },
  meta: null,
  errors: null
}
```

---

## Endpoints — Schedule View

### GET /api/v1/schedule

**Description:** Retrieve a unified schedule view. Aggregates crew and truck assignments into a calendar-oriented structure. This is the primary read endpoint for calendar/timeline UIs.

**Auth:** Required. Tenant-scoped.

**Query Parameters — `ScheduleViewFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| view | enum: day, week, month | yes | View granularity |
| date | ISO 8601 date | yes | Anchor date for the view |
| resource_type | enum: personnel, truck, event | no | Group results by resource. Default: `event` |
| event_id | UUID | no | Limit to a single event |
| department_id | UUID | no | Filter crew by department |
| personnel_id | UUID | no | Limit to a single person |
| truck_id | UUID | no | Limit to a single truck |
| status | enum (csv) | no | Filter by assignment status |

**Response — `200 OK` — `ScheduleViewResponse`:**

```
{
  data: {
    view: string,
    range: { start: ISO 8601 date, end: ISO 8601 date },
    resources: [
      {
        resource_type: enum: personnel, truck, event,
        resource_id: UUID,
        resource_name: string,
        assignments: [
          {
            assignment_id: UUID,
            assignment_type: enum: crew, truck,
            event_id: UUID,
            event_name: string,
            role: string | null,
            start_date: ISO 8601 date,
            end_date: ISO 8601 date,
            status: string,
            has_conflicts: boolean
          }
        ]
      }
    ]
  },
  meta: {
    total_assignments: integer,
    conflict_count: integer,
    truck_route_blocks: [
      {
        route_id: UUID,
        event_id: UUID,
        event_name: string,
        truck_id: UUID,
        truck_name: string,
        departure_datetime: ISO 8601 datetime,
        estimated_arrival: ISO 8601 datetime,
        status: string,
        schedule_conflict_hint: string | null
      }
    ]
  },
  errors: null
}
```

`truck_route_blocks`: truck routes whose departure or ETA overlaps the schedule `range` (UTC date comparison). Empty array when none.

---

## Endpoints — Conflicts

### GET /api/v1/conflicts

**Description:** Retrieve all detected scheduling conflicts, optionally filtered.

**Auth:** Required. Tenant-scoped.

**Query Parameters — `ConflictFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| resource_type | enum: personnel, truck | no | Filter by resource type |
| resource_id | UUID | no | Filter by specific resource |
| event_id | UUID | no | Filter conflicts involving a specific event |
| status | enum: active, resolved, dismissed | no | Default: `active` |
| severity | enum: hard, soft | no | Filter by severity |
| date_range_start | ISO 8601 date | no | Conflicts overlapping on or after |
| date_range_end | ISO 8601 date | no | Conflicts overlapping on or before |
| cursor | string (opaque) | no | Cursor for next page |
| limit | integer (1–100) | no | Default: `25` |

**Response — `200 OK` — `ConflictListResponse`:**

```
{
  data: ConflictResponse[],
  meta: {
    cursor: string | null,
    has_more: boolean,
    total_count: integer
  },
  errors: null
}
```

---

## Endpoints — Bulk Operations

### POST /api/v1/assignments/bulk

**Description:** Create multiple assignments in a single request. Applies all-or-nothing semantics: if any assignment fails validation, none are created.

**Auth:** Required. Tenant-scoped. Requires `scheduling:create` permission.

**Request Body — `BulkAssignmentRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| assignments | BulkAssignmentItem[] | yes | Array of assignments to create (max 50) |
| conflict_strategy | enum: fail, warn, skip | no | How to handle conflicts. Default: `fail` |

**BulkAssignmentItem:**

| Field | Type | Required | Description |
|---|---|---|---|
| type | enum: crew, truck | yes | Assignment type |
| event_id | UUID | yes | Target event |
| resource_id | UUID | yes | Personnel ID (crew) or Truck ID (truck) |
| role | string | no | Role (crew only) |
| start_date | ISO 8601 date | yes | Start date |
| end_date | ISO 8601 date | yes | End date |
| status | enum: tentative, confirmed | no | Default: `tentative` |
| notes | string | no | Notes |

**conflict_strategy options:**

| Value | Behavior |
|---|---|
| fail | Reject entire batch if any conflict detected |
| warn | Create all assignments, return conflicts in meta |
| skip | Skip conflicting assignments, create the rest |

**Response — `201 Created`:**

```
{
  data: {
    created: (CrewAssignmentResponse | TruckAssignmentResponse)[],
    skipped: BulkSkippedItem[]      // only populated when conflict_strategy = "skip"
  },
  meta: {
    total_requested: integer,
    total_created: integer,
    total_skipped: integer,
    conflicts: ConflictSummary[],
    operation_id: UUID
  },
  errors: null
}
```

`operation_id` identifies the bulk run for support/audit and matches the domain event `bulk_operation.completed`.

**BulkSkippedItem:**

| Field | Type | Description |
|---|---|---|
| index | integer | Zero-based index in the original request array |
| reason | string | Reason for skipping |
| conflicts | ConflictSummary[] | Detected conflicts |

---

## Type Definitions

### CrewAssignmentResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Assignment ID |
| event_id | UUID | Event reference |
| event_name | string | Denormalized event name |
| personnel_id | UUID | Personnel reference |
| personnel_name | string | Denormalized personnel full name |
| role | string | Assignment role |
| department_id | UUID | null | Department context |
| department_name | string | null | Denormalized department name |
| start_date | ISO 8601 date | Assignment start |
| end_date | ISO 8601 date | Assignment end |
| start_time | string (HH:MM) | null | Daily start time |
| end_time | string (HH:MM) | null | Daily end time |
| day_rate | decimal | Effective day rate (override or default) |
| day_rate_override | decimal | null | Explicit override if set |
| per_diem | decimal | Effective per-diem |
| per_diem_override | decimal | null | Explicit override if set |
| total_days | integer | Calculated total assignment days |
| total_cost | decimal | Calculated: total_days × day_rate |
| total_per_diem | decimal | Calculated: total_days × per_diem |
| notes | string | null | Notes |
| status | enum: tentative, confirmed, cancelled | Assignment status |
| has_conflicts | boolean | Whether active conflicts exist |
| created_at | ISO 8601 datetime | Creation timestamp |
| updated_at | ISO 8601 datetime | Last update timestamp |

### TruckAssignmentResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Assignment ID |
| event_id | UUID | Event reference |
| event_name | string | Denormalized event name |
| truck_id | UUID | Truck reference |
| truck_name | string | Denormalized truck name/identifier |
| purpose | string | null | Purpose description |
| start_date | ISO 8601 date | Assignment start |
| end_date | ISO 8601 date | Assignment end |
| driver_id | UUID | null | Assigned driver |
| driver_name | string | null | Denormalized driver name |
| total_days | integer | Calculated total assignment days |
| notes | string | null | Notes |
| status | enum: tentative, confirmed, cancelled | Assignment status |
| has_conflicts | boolean | Whether active conflicts exist |
| created_at | ISO 8601 datetime | Creation timestamp |
| updated_at | ISO 8601 datetime | Last update timestamp |

### ConflictResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Conflict ID |
| resource_type | enum: personnel, truck | Conflicting resource type |
| resource_id | UUID | Resource reference |
| resource_name | string | Denormalized resource name |
| severity | enum: hard, soft | Conflict severity |
| status | enum: active, resolved, dismissed | Conflict status |
| assignments | ConflictAssignmentRef[] | The conflicting assignments |
| overlap_start | ISO 8601 date | Overlap range start |
| overlap_end | ISO 8601 date | Overlap range end |
| detected_at | ISO 8601 datetime | When the conflict was detected |
| resolved_at | ISO 8601 datetime | null | When the conflict was resolved |

### ConflictAssignmentRef

| Field | Type | Description |
|---|---|---|
| assignment_id | UUID | Assignment ID |
| assignment_type | enum: crew, truck | Assignment type |
| event_id | UUID | Event reference |
| event_name | string | Event name |
| start_date | ISO 8601 date | Assignment start |
| end_date | ISO 8601 date | Assignment end |

### ConflictSummary

| Field | Type | Description |
|---|---|---|
| conflict_id | UUID | Conflict ID |
| resource_type | enum: personnel, truck | Resource type |
| resource_id | UUID | Resource ID |
| resource_name | string | Resource name |
| severity | enum: hard, soft | Severity |
| overlap_dates | string | Human-readable overlap description |

---

## Internal Interface

These functions are callable by other modules via internal service calls. They are NOT exposed as HTTP endpoints.

### getAssignmentsByEvent

**Description:** Retrieve all assignments (crew and truck) for a given event.

```
getAssignmentsByEvent(
  event_id: UUID,
  tenant_id: UUID,
  options?: {
    type?: enum: crew, truck, all,   // default: all
    status?: enum[],
    include_cancelled?: boolean       // default: false
  }
) → {
  crew: CrewAssignmentResponse[],
  truck: TruckAssignmentResponse[]
}
```

---

### getAssignmentsByPersonnel

**Description:** Retrieve all crew assignments for a given person.

```
getAssignmentsByPersonnel(
  personnel_id: UUID,
  tenant_id: UUID,
  options?: {
    date_range_start?: ISO 8601 date,
    date_range_end?: ISO 8601 date,
    status?: enum[],
    include_cancelled?: boolean
  }
) → CrewAssignmentResponse[]
```

---

### getAssignmentsByTruck

**Description:** Retrieve all truck assignments for a given truck.

```
getAssignmentsByTruck(
  truck_id: UUID,
  tenant_id: UUID,
  options?: {
    date_range_start?: ISO 8601 date,
    date_range_end?: ISO 8601 date,
    status?: enum[],
    include_cancelled?: boolean
  }
) → TruckAssignmentResponse[]
```

---

### getConflicts

**Description:** Retrieve active conflicts for a resource or event.

```
getConflicts(
  tenant_id: UUID,
  options?: {
    resource_type?: enum: personnel, truck,
    resource_id?: UUID,
    event_id?: UUID,
    severity?: enum: hard, soft,
    status?: enum: active, resolved, dismissed
  }
) → ConflictResponse[]
```

---

### getAssignmentDays

**Description:** Calculate total assignment days and costs for an event. Used by the Financial module for cost calculations.

```
getAssignmentDays(
  event_id: UUID,
  tenant_id: UUID,
  options?: {
    type?: enum: crew, truck, all
  }
) → {
  event_id: UUID,
  crew: {
    total_days: integer,
    total_day_rate_cost: decimal,
    total_per_diem_cost: decimal,
    assignment_count: integer
  },
  truck: {
    total_days: integer,
    assignment_count: integer
  }
}
```

---

## Domain Events

All domain events are published to the internal event bus. Consumers must be idempotent.

### assignment.created

**Trigger:** A crew or truck assignment is successfully created.

**Payload — `AssignmentCreatedPayload`:**

| Field | Type | Description |
|---|---|---|
| assignment_id | UUID | Created assignment ID |
| assignment_type | enum: crew, truck | Assignment type |
| tenant_id | UUID | Tenant scope |
| event_id | UUID | Event reference |
| resource_id | UUID | Personnel or truck ID |
| resource_type | enum: personnel, truck | Resource type |
| role | string | null | Assignment role (crew only) |
| start_date | ISO 8601 date | Start date |
| end_date | ISO 8601 date | End date |
| status | string | Initial status |
| day_rate | decimal | null | Effective day rate (crew only) |
| total_days | integer | Calculated total days |
| created_by | UUID | User who created |
| created_at | ISO 8601 datetime | Timestamp |

---

### assignment.updated

**Trigger:** An assignment is updated.

**Payload — `AssignmentUpdatedPayload`:**

| Field | Type | Description |
|---|---|---|
| assignment_id | UUID | Updated assignment ID |
| assignment_type | enum: crew, truck | Assignment type |
| tenant_id | UUID | Tenant scope |
| event_id | UUID | Event reference |
| resource_id | UUID | Personnel or truck ID |
| changed_fields | string[] | Fields that changed |
| previous_values | object | Map of field → old value |
| new_values | object | Map of field → new value |
| updated_by | UUID | User who updated |
| updated_at | ISO 8601 datetime | Timestamp |

---

### assignment.deleted

**Trigger:** An assignment is deleted.

**Payload — `AssignmentDeletedPayload`:**

| Field | Type | Description |
|---|---|---|
| assignment_id | UUID | Deleted assignment ID |
| assignment_type | enum: crew, truck | Assignment type |
| tenant_id | UUID | Tenant scope |
| event_id | UUID | Event reference |
| resource_id | UUID | Personnel or truck ID |
| start_date | ISO 8601 date | Original start date |
| end_date | ISO 8601 date | Original end date |
| deleted_by | UUID | User who deleted |
| deleted_at | ISO 8601 datetime | Timestamp |

---

### conflict.detected

**Trigger:** A scheduling conflict is detected (during assignment creation or update).

**Payload — `ConflictDetectedPayload`:**

| Field | Type | Description |
|---|---|---|
| conflict_id | UUID | Conflict ID |
| tenant_id | UUID | Tenant scope |
| resource_type | enum: personnel, truck | Resource type |
| resource_id | UUID | Resource ID |
| resource_name | string | Resource name |
| severity | enum: hard, soft | Conflict severity |
| assignment_ids | UUID[] | IDs of conflicting assignments |
| overlap_start | ISO 8601 date | Overlap start |
| overlap_end | ISO 8601 date | Overlap end |
| detected_at | ISO 8601 datetime | Timestamp |

---

### conflict.resolved

**Trigger:** A scheduling conflict is resolved (assignment deleted, dates changed, or manually dismissed).

**Payload — `ConflictResolvedPayload`:**

| Field | Type | Description |
|---|---|---|
| conflict_id | UUID | Conflict ID |
| tenant_id | UUID | Tenant scope |
| resource_type | enum: personnel, truck | Resource type |
| resource_id | UUID | Resource ID |
| resolution | enum: assignment_deleted, dates_changed, manually_dismissed | How it was resolved |
| resolved_by | UUID | User who resolved (or system if automatic) |
| resolved_at | ISO 8601 datetime | Timestamp |

---

### bulk_operation.completed

**Trigger:** `POST /api/v1/assignments/bulk` completes successfully (at least one assignment processed per strategy; includes partial success for `warn` / `skip`).

**Payload:**

| Field | Type | Description |
|---|---|---|
| operation_id | UUID | Same as `meta.operation_id` on the HTTP response |
| tenant_id | UUID | Tenant scope |
| initiated_by | UUID | User who invoked the bulk request |
| conflict_strategy | enum: fail, warn, skip | Strategy used for the request |
| total_requested | integer | Items in the request body |
| total_created | integer | Assignments created |
| total_skipped | integer | Items skipped (`skip` strategy) |
| completed_at | ISO 8601 datetime | When the bulk finished |
