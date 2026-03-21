# Personnel Module — Interface Contract

> **Version:** 1.0.0
> **Base Path:** `/api/v1/personnel`, `/api/v1/invitations` (department HTTP API is owned by the Tenancy module — see `tenancy.contract.md`)
> **Owner:** Personnel Module
> **Last Updated:** 2026-02-15

---

## Table of Contents

- [Response Envelope](#response-envelope)
- [Endpoints — Personnel](#endpoints--personnel)
- [Departments (Tenancy module)](#departments-tenancy-module)
- [Endpoints — Invitations](#endpoints--invitations)
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

## Endpoints — Personnel

### POST /api/v1/personnel

**Description:** Create a new personnel record.

**Auth:** Required. Tenant-scoped. Requires `personnel:create` permission.

**Request Body — `CreatePersonnelRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| first_name | string | yes | First name (1–100 chars) |
| last_name | string | yes | Last name (1–100 chars) |
| email | string | yes | Unique email within tenant |
| phone | string | no | Phone number |
| department_id | UUID | no | Department assignment |
| role | string | yes | Job role/title |
| employment_type | enum: full_time, part_time, freelance, contractor | yes | Employment classification |
| day_rate | decimal | no | Standard day rate (currency units) |
| per_diem | decimal | no | Per-diem allowance |
| skills | string[] | no | List of skill tags |
| status | enum: active, inactive, on_leave | no | Default: `active` |
| emergency_contact | object | no | See `EmergencyContact` type |
| metadata | object | no | Key-value custom fields |
| photo_document_id | UUID | no | Headshot: must reference an existing tenant `documents` row with `category=photo` and an image `mime_type` (typically set after `POST /api/v1/documents/upload`) |

**Response — `201 Created`:**

```
{
  data: PersonnelResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure |
| 409 | Email already exists within tenant |

---

### GET /api/v1/personnel

**Description:** List personnel with filtering and cursor-based pagination.

**Auth:** Required. Tenant-scoped.

**Query Parameters — `PersonnelFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| status | enum (csv) | no | Filter by status: `active,inactive,on_leave` |
| department_id | UUID | no | Filter by department |
| employment_type | enum (csv) | no | Filter by employment type |
| role | string | no | Filter by role (partial match) |
| skill | string | no | Filter by skill tag |
| search | string | no | Full-text search across name, email, role |
| sort_by | enum: name, role, department, created_at | no | Default: `name` |
| sort_order | enum: asc, desc | no | Default: `asc` |
| cursor | string (opaque) | no | Cursor for next page |
| limit | integer (1–100) | no | Default: `25` |

**Response — `200 OK` — `PersonnelListResponse`:**

```
{
  data: PersonnelResponse[],
  meta: {
    cursor: string | null,
    has_more: boolean,
    total_count: integer
  },
  errors: null
}
```

---

### GET /api/v1/personnel/:id

**Description:** Retrieve a single personnel record by ID.

**Auth:** Required. Tenant-scoped.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Personnel ID |

**Response — `200 OK`:**

```
{
  data: PersonnelResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 404 | Personnel not found or not accessible within tenant |

---

### PUT /api/v1/personnel/:id

**Description:** Update a personnel record. Partial updates — only provided fields are changed.

**Auth:** Required. Tenant-scoped. Requires `personnel:update` permission.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Personnel ID |

**Request Body — `UpdatePersonnelRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| first_name | string | no | First name |
| last_name | string | no | Last name |
| email | string | no | Email |
| phone | string | no | Phone number |
| department_id | UUID | no | Department assignment (set `null` to clear) |
| role | string | no | Job role/title |
| employment_type | enum | no | Employment classification |
| day_rate | decimal | no | Day rate |
| per_diem | decimal | no | Per-diem allowance |
| skills | string[] | no | Replaces existing skills |
| status | enum | no | Status |
| emergency_contact | object | no | Emergency contact |
| metadata | object | no | Merged with existing metadata |
| photo_document_id | UUID | no | Set or replace headshot document; send `null` to clear |
| version | integer | no | Expected row version for optimistic locking; must match `PersonnelResponse.version` from the last read. If omitted, update applies without version check. |

**Response — `200 OK`:**

```
{
  data: PersonnelResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure |
| 404 | Personnel not found |
| 409 | Email conflict or optimistic lock conflict |

---

### DELETE /api/v1/personnel/:id

**Description:** Deactivate a personnel record. Sets status to `inactive` and `deactivated_at` timestamp. Does NOT hard-delete.

**Auth:** Required. Tenant-scoped. Requires `personnel:delete` permission.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Personnel ID |

**Response — `200 OK`:**

```
{
  data: { id: UUID, status: "inactive", deactivated_at: ISO 8601 datetime },
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 404 | Personnel not found |
| 409 | Personnel has active future assignments (must reassign first) |

---

### GET /api/v1/personnel/availability

**Description:** Bulk availability for many personnel in one request (assignments + blocked dates). Paginate with `cursor` / `limit` over the personnel roster.

**Auth:** Required. Tenant-scoped.

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| start | ISO 8601 date | yes | Range start (inclusive) |
| end | ISO 8601 date | yes | Range end (inclusive), max 90 days from start |
| department_id | UUID | no | Filter personnel by department |
| status | csv enum | no | `active`, `inactive`, `on_leave` (default: active + on_leave) |
| cursor | string | no | Pagination cursor |
| limit | integer | no | Default 50, max 200 |

**Response — `200 OK`:**

```
{
  data: BulkAvailabilityPersonnelRow[],
  meta: {
    cursor: string | null,
    has_more: boolean,
    total_count: integer,
    range: { start: ISO 8601 date, end: ISO 8601 date }
  },
  errors: null
}
```

`BulkAvailabilityPersonnelRow`: `personnel_id`, `first_name`, `last_name`, `department_id`, `range`, `days` (same day shape as single-person availability: `date`, `available`, `assignments[]`).

---

### POST /api/v1/personnel/import/upload

**Auth:** `personnel:create`

**Body:** `{ "csv_text": string }` (max 5 MB, max 500 data rows)

**Response:** `{ session_id, columns, sample_rows, row_count }`

---

### POST /api/v1/personnel/import/validate

**Auth:** `personnel:create`

**Body:** `{ "session_id": string, "column_map": { [csvHeader]: fieldName } }`  
Field names: `first_name`, `last_name`, `email`, `role`, `employment_type`, `phone`, `department`, `department_id`, `day_rate`, `per_diem`, `skills`, `status`, `ignore`.

**Response:** `{ session_id, valid, errors[], column_map }`

---

### POST /api/v1/personnel/import/preview

**Auth:** `personnel:create`

**Body:** `{ "session_id": string, "column_map": object }`

**Response:** `{ session_id, new_count, update_count, skip_count, preview[] }`

---

### POST /api/v1/personnel/import/confirm

**Auth:** `personnel:create`

**Body:** `{ "session_id": string, "column_map": object }`

**Response:** `{ created, updated, skipped, session_id }`

---

### GET /api/v1/personnel/:id/availability

**Description:** Retrieve availability windows for a specific person over a date range.

**Auth:** Required. Tenant-scoped.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Personnel ID |

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| start | ISO 8601 date | yes | Range start (inclusive) |
| end | ISO 8601 date | yes | Range end (inclusive) |

**Response — `200 OK` — `AvailabilityResponse`:**

```
{
  data: {
    personnel_id: UUID,
    range: { start: ISO 8601 date, end: ISO 8601 date },
    days: [
      {
        date: ISO 8601 date,
        available: boolean,
        assignments: [
          {
            assignment_id: UUID,
            event_id: UUID,
            event_name: string,
            role: string
          }
        ]
      }
    ]
  },
  meta: null,
  errors: null
}
```

---

## Departments (Tenancy module)

All `/api/v1/departments` routes, `DepartmentResponse`, department domain events (`department.created`, `department.updated`, `department.deleted`, `department.reordered`), and permissions `tenancy.departments.*` are defined in **`contracts/tenancy.contract.md`**.

The backend accepts legacy permission names `departments:create`, `departments:update`, and `departments:delete` as aliases for the corresponding `tenancy.departments.*` checks.

---

## Endpoints — Invitations

### POST /api/v1/invitations

**Description:** Send an invitation to join the tenant as personnel. Creates a pending invitation and sends an email.

**Auth:** Required. Tenant-scoped. Requires `personnel:invite` permission.

**Request Body — `CreateInvitationRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| email | string | yes | Invitee email address |
| first_name | string | yes | Invitee first name |
| last_name | string | yes | Invitee last name |
| role | string | yes | Intended job role |
| department_id | UUID | no | Target department |
| employment_type | enum | no | Employment classification |
| message | string | no | Custom invitation message |
| expires_in_days | integer | no | Expiry in days. Default: `7` |

**Response — `201 Created`:**

```
{
  data: InvitationResponse,
  meta: null,
  errors: null
}
```

---

### GET /api/v1/invitations

**Description:** List pending and recent invitations.

**Auth:** Required. Tenant-scoped.

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| status | enum: pending, accepted, expired, revoked | no | Filter by invitation status |
| cursor | string (opaque) | no | Cursor for next page |
| limit | integer (1–100) | no | Default: `25` |

**Response — `200 OK`:**

```
{
  data: InvitationResponse[],
  meta: {
    cursor: string | null,
    has_more: boolean,
    total_count: integer
  },
  errors: null
}
```

---

### DELETE /api/v1/invitations/:id

**Description:** Revoke a pending invitation.

**Auth:** Required. Tenant-scoped. Requires `personnel:invite` permission.

**Response — `200 OK`:**

```
{
  data: { id: UUID, status: "revoked", revoked_at: ISO 8601 datetime },
  meta: null,
  errors: null
}
```

---

## Type Definitions

### PersonnelResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Unique personnel identifier |
| first_name | string | First name |
| last_name | string | Last name |
| email | string | Email address |
| phone | string | null | Phone number |
| department_id | UUID | null | Department reference |
| department_name | string | null | Denormalized department name |
| role | string | Job role/title |
| employment_type | enum: full_time, part_time, freelance, contractor | Employment classification |
| day_rate | decimal | null | Standard day rate |
| per_diem | decimal | null | Per-diem allowance |
| skills | string[] | Skill tags |
| status | enum: active, inactive, on_leave | Current status |
| emergency_contact | EmergencyContact | null | Emergency contact info |
| metadata | object | Custom fields |
| photo_document_id | UUID | null | Linked headshot document id |
| photo_url | string | null | Time-limited direct URL for the image file (list/get only; use for `<img src>`) |
| photo_url_expires_at | ISO 8601 datetime | null | When `photo_url` stops working |
| created_at | ISO 8601 datetime | Creation timestamp |
| updated_at | ISO 8601 datetime | Last update timestamp |
| deactivated_at | ISO 8601 datetime | null | Deactivation timestamp |
| version | integer | Row version for optimistic locking on PUT |

### EmergencyContact

| Field | Type | Description |
|---|---|---|
| name | string | Contact name |
| relationship | string | Relationship to personnel |
| phone | string | Contact phone number |
| email | string | null | Contact email |

### DepartmentResponse

Defined in **`tenancy.contract.md`** (includes `sort_order`, `is_active`, and legacy `head_id`, `head_name`, `color` for existing clients).

### InvitationResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Invitation ID |
| email | string | Invitee email |
| first_name | string | Invitee first name |
| last_name | string | Invitee last name |
| role | string | Intended job role |
| department_id | UUID | null | Target department |
| status | enum: pending, accepted, expired, revoked | Invitation status |
| invited_by | UUID | User who sent the invitation |
| expires_at | ISO 8601 datetime | Expiry timestamp |
| accepted_at | ISO 8601 datetime | null | Acceptance timestamp |
| created_at | ISO 8601 datetime | Creation timestamp |

---

## Internal Interface

These functions are callable by other modules via internal service calls. They are NOT exposed as HTTP endpoints.

### getPersonnelById

**Description:** Retrieve a single personnel record. Returns `null` if not found or deactivated.

```
getPersonnelById(
  personnel_id: UUID,
  tenant_id: UUID,
  options?: {
    include_deactivated?: boolean   // default: false
  }
) → PersonnelResponse | null
```

---

### getPersonnelByDepartment

**Description:** Retrieve all active personnel within a department.

```
getPersonnelByDepartment(
  department_id: UUID,
  tenant_id: UUID,
  options?: {
    status?: enum[],
    employment_type?: enum[]
  }
) → PersonnelResponse[]
```

---

### getAvailability

**Description:** Check a person's availability across a date range. Returns day-level availability including existing assignment conflicts.

```
getAvailability(
  personnel_id: UUID,
  tenant_id: UUID,
  start_date: ISO 8601 date,
  end_date: ISO 8601 date
) → {
  personnel_id: UUID,
  days: [
    {
      date: ISO 8601 date,
      available: boolean,
      assignment_count: integer
    }
  ]
}
```

---

### getDayRate

**Description:** Get the effective day rate for a person, factoring in overrides by event or date.

```
getDayRate(
  personnel_id: UUID,
  tenant_id: UUID,
  options?: {
    event_id?: UUID,              // check for event-specific rate override
    date?: ISO 8601 date          // check for date-effective rate
  }
) → {
  personnel_id: UUID,
  day_rate: decimal,
  currency: string,
  is_override: boolean,
  source: enum: default, event_override, date_effective
}
```

---

### getPerDiem

**Description:** Get the effective per-diem rate for a person.

```
getPerDiem(
  personnel_id: UUID,
  tenant_id: UUID,
  options?: {
    event_id?: UUID
  }
) → {
  personnel_id: UUID,
  per_diem: decimal,
  currency: string,
  is_override: boolean
}
```

---

## Domain Events

All domain events are published to the internal event bus. Consumers must be idempotent.

### personnel.created

**Trigger:** A new personnel record is created.

**Payload — `PersonnelCreatedPayload`:**

| Field | Type | Description |
|---|---|---|
| personnel_id | UUID | Created personnel ID |
| tenant_id | UUID | Tenant scope |
| first_name | string | First name |
| last_name | string | Last name |
| email | string | Email |
| role | string | Job role |
| department_id | UUID | null | Department |
| employment_type | string | Employment classification |
| created_by | UUID | User who created the record |
| created_at | ISO 8601 datetime | Timestamp |

---

### personnel.updated

**Trigger:** A personnel record is updated.

**Payload — `PersonnelUpdatedPayload`:**

| Field | Type | Description |
|---|---|---|
| personnel_id | UUID | Updated personnel ID |
| tenant_id | UUID | Tenant scope |
| changed_fields | string[] | List of field names that changed |
| previous_values | object | Map of field → old value |
| new_values | object | Map of field → new value |
| updated_by | UUID | User who updated the record |
| updated_at | ISO 8601 datetime | Timestamp |

---

### personnel.deactivated

**Trigger:** A personnel record is deactivated (soft-deleted).

**Payload — `PersonnelDeactivatedPayload`:**

| Field | Type | Description |
|---|---|---|
| personnel_id | UUID | Deactivated personnel ID |
| tenant_id | UUID | Tenant scope |
| first_name | string | First name (for audit reference) |
| last_name | string | Last name (for audit reference) |
| email | string | Email (for audit reference) |
| department_id | UUID | null | Department |
| deactivated_by | UUID | User who deactivated |
| deactivated_at | ISO 8601 datetime | Timestamp |

---

### department.*

Department lifecycle events are published by the **Tenancy** module. See **`tenancy.contract.md`** (`department.created`, `department.updated`, `department.deleted`, `department.reordered`).

---

### personnel.rate_changed

**Trigger:** `day_rate` or `per_diem` changed on a personnel record.

**Payload (representative):** `personnel_id`, `tenant_id`, `old_day_rate`, `new_day_rate`, `old_per_diem`, `new_per_diem`, `currency`, `updated_by`, `updated_at`

---

### personnel.invited

**Trigger:** A tenant invitation row is created (`POST /api/v1/invitations`).

**Payload (representative):** `invitation_id`, `tenant_id`, `email`, `first_name`, `last_name`, `role`, `department_id`, `invited_by`, `expires_at`, `created_at`

---

### personnel.linkedToUser

**Trigger:** An invitation is accepted (`POST /api/v1/invitations/accept`).

**Payload (representative):** `personnel_id`, `tenant_id`, `invitation_id`, `user_id` (nullable until auth linkage), `email`

---

### personnel.bulkImportCompleted

**Trigger:** CSV import confirm finished.

**Payload (representative):** `tenant_id`, `session_id`, `created`, `updated`, `skipped`, `completed_by`, `completed_at`
