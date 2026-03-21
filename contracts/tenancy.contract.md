# Tenancy Module — Interface Contract

> **Version:** 1.0.0
> **Base Path:** `/api/v1/tenant`, `/api/v1/departments`
> **Owner:** Tenancy Module
> **Last Updated:** 2026-03-20

---

## Table of Contents

- [Response Envelope](#response-envelope)
- [Endpoints — Tenant Configuration](#endpoints--tenant-configuration)
- [POST /api/v1/tenant/reset-data](#post-apiv1tenantreset-data)
- [Endpoints — Departments](#endpoints--departments)
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

## Endpoints — Tenant Configuration

### GET /api/v1/tenant

**Description:** Retrieve the current tenant's profile and configuration. All authenticated users can view tenant name and branding; full settings require elevated permissions.

**Auth:** Required. Tenant-scoped. Full settings require `tenancy.settings.view` permission; otherwise branding-only subset is returned.

**Response — `200 OK` — `TenantResponse`:**

```
{
  data: TenantResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 401 | Unauthenticated |

---

### PUT /api/v1/tenant

**Description:** Update the current tenant's configuration. Partial updates — only provided fields are merged into existing settings. Does NOT support tenant creation (Phase 1 — single default tenant).

**Auth:** Required. Tenant-scoped. Requires `tenancy.settings.edit` permission.

**Request Body — `UpdateTenantRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| name | string | no | Tenant display name (1–100 chars) |
| settings | TenantSettings | no | Partial settings object — deep-merged with existing settings |

**Response — `200 OK`:**

```
{
  data: TenantResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure (invalid settings values, unknown keys stripped) |
| 401 | Unauthenticated |
| 403 | Insufficient permissions |

---

### POST /api/v1/tenant/reset-data

**Description:** Irreversibly deletes **operational** data for the current tenant (events, clients, venues, personnel, travel, documents, scheduling, financial rows, custom fields, departments, etc.). **Does not** delete the tenant row, users, roles, or role permissions — users remain able to sign in.

**Auth:** Required. Tenant-scoped. Requires `tenancy.settings.edit` (or wildcard `*`).

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| confirm | string | yes | Must be exactly `RESET` |

**Response — `200 OK`:**

```
{
  data: {
    reset: true,
    tenant_id: "<uuid>",
    deleted_steps: <integer>
  },
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | `confirm` is not `RESET` |
| 403 | Insufficient permissions, or reset disabled on server (production requires `PLD_ALLOW_TENANT_DATA_RESET=1`) |
| 500 | Database error during transaction (rolled back) |

**Server:** In `NODE_ENV=production`, the handler returns **403** unless environment variable `PLD_ALLOW_TENANT_DATA_RESET` is set to `1` or `true`. Non-production environments allow reset by default.

---

## Endpoints — Departments

### GET /api/v1/departments

**Description:** List all departments for the current tenant, ordered by `sort_order`.

**Auth:** Required. Tenant-scoped.

**Query Parameters — `DepartmentFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| is_active | boolean | no | When omitted or `true`, only `is_active=true` rows. When `false`, both active and inactive are returned. |
| include_counts | boolean | no | Include `personnel_count` per department. Default: `false` |

**Response — `200 OK` — `DepartmentListResponse`:**

```
{
  data: DepartmentResponse[],
  meta: {
    total_count: integer
  },
  errors: null
}
```

---

### POST /api/v1/departments

**Description:** Create a new department.

**Auth:** Required. Tenant-scoped. Requires `tenancy.departments.create` permission (legacy alias: `departments:create`).

**Request Body — `CreateDepartmentRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| name | string | yes | Department name (1–100 chars, unique within tenant) |
| description | string | no | Department description (max 500 chars) |
| head_id | UUID | no | Personnel ID of department head |
| color | string | no | Hex color for UI (e.g. `#3B82F6`) |
| sort_order | integer | no | Display position. Default: appended to end |
| is_active | boolean | no | Default: `true` |

**Response — `201 Created`:**

```
{
  data: DepartmentResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure (missing name, exceeds length) |
| 403 | Insufficient permissions |
| 409 | Department name already exists within tenant |

---

### PUT /api/v1/departments/:id

**Description:** Update an existing department. Partial updates — only provided fields are changed.

**Auth:** Required. Tenant-scoped. Requires `tenancy.departments.edit` permission (legacy alias: `departments:update`).

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Department ID |

**Request Body — `UpdateDepartmentRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| name | string | no | Department name (1–100 chars) |
| description | string | no | Description |
| head_id | UUID | no | Department head (set `null` to clear) |
| color | string | no | Hex color code |
| sort_order | integer | no | Display position |
| is_active | boolean | no | Active status |

**Response — `200 OK`:**

```
{
  data: DepartmentResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure |
| 404 | Department not found |
| 409 | Name conflict (duplicate within tenant) |

---

### PATCH /api/v1/departments/reorder

**Description:** Bulk update `sort_order` for departments from an ordered list of IDs (e.g. drag-and-drop). All IDs must belong to the current tenant.

**Auth:** Required. Tenant-scoped. Requires `tenancy.departments.edit` permission (legacy alias: `departments:update`).

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| ordered_ids | UUID[] | yes | Department IDs in desired display order (index 0 = first) |

**Response — `200 OK`:**

```
{
  data: { ok: true },
  meta: null,
  errors: null
}
```

---

### DELETE /api/v1/departments/:id

**Description:** Soft-delete a department. Fails if the department has active personnel or event assignments referencing it.

**Auth:** Required. Tenant-scoped. Requires `tenancy.departments.delete` permission (legacy alias: `departments:delete`).

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Department ID |

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
| 404 | Department not found |
| 409 | Department has active personnel or assignments (reassign first). Error `details` may include `{ blocking_references_count: integer }`. |

---

## Type Definitions

### TenantResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Tenant ID |
| name | string | Tenant display name |
| slug | string | URL-safe identifier |
| status | enum: active, suspended, deactivated | Tenant status |
| settings | TenantSettings | Full tenant configuration |
| created_at | ISO 8601 datetime | Creation timestamp |
| updated_at | ISO 8601 datetime | Last update timestamp |

### TenantSettings

| Field | Type | Description |
|---|---|---|
| default_timezone | string | Timezone (IANA format). Default: `"America/New_York"` |
| default_currency | string | ISO 4217 currency code. Default: `"USD"` |
| date_format | string | Display date format. Default: `"MM/DD/YYYY"` |
| time_format | enum: 12h, 24h | Time display format. Default: `"12h"` |
| branding | TenantBranding | Branding configuration |
| password_policy | PasswordPolicy | Password requirements |
| features | object | Feature flags (merged with server defaults). See [Tenant features](#tenant-features). |

### Tenant features

Nested under `settings.features` (deep-merged on `PUT /api/v1/tenant`):

**`features.scheduling`**

| Field | Type | Default | Description |
|---|---|---|---|
| conflict_detection_enabled | boolean | `true` | When `false`, scheduling does not record new conflicts and conflict list APIs return empty. |
| buffer_windows_enabled | boolean | `true` | When `false`, double-booking soft conflicts are not created (drive-time checks may still apply). |
| drive_time_buffer_hours | number | `4` | Extra hours required beyond computed drive time between consecutive gigs (0–168). |

**`features.data_export`**

| Field | Type | Default | Description |
|---|---|---|---|
| audit_logging_enabled | boolean | `true` | When `false`, `writeAuditLog` is a no-op for this tenant. |

### TenantBranding

| Field | Type | Description |
|---|---|---|
| company_name | string | null | Name displayed in generated documents. Defaults to `tenant.name` |
| logo_url | string | null | Logo URL for documents and UI |
| primary_color | string | Hex color code for tenant theme. Default: `"#1a73e8"` |

### PasswordPolicy

| Field | Type | Description |
|---|---|---|
| min_length | integer | Minimum password length. Default: `8` |
| require_uppercase | boolean | Require uppercase character. Default: `true` |
| require_number | boolean | Require numeric character. Default: `true` |
| require_special | boolean | Require special character. Default: `false` |

### DepartmentResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Department ID |
| name | string | Department name |
| description | string | null | Description |
| sort_order | integer | Display position |
| is_active | boolean | Active status |
| head_id | UUID | null | Department head personnel ID (legacy) |
| head_name | string | null | Denormalized head name (legacy) |
| color | string | null | Hex color for UI (legacy) |
| personnel_count | integer | null | Count of assigned personnel (when `include_counts=true`) |
| created_at | ISO 8601 datetime | Creation timestamp |
| updated_at | ISO 8601 datetime | Last update timestamp |

---

## Internal Interface

These functions are callable by other modules via internal service calls. They are NOT exposed as HTTP endpoints.

### getCurrentTenant

**Description:** Retrieve the tenant record for a given tenant ID. Returns `null` if not found or inactive. Used by middleware and modules that need tenant context outside the standard HTTP request chain.

```
getCurrentTenant(
  tenant_id: UUID
) → TenantResponse | null
```

---

### getTenantConfig

**Description:** Retrieve the resolved tenant settings with all defaults applied. Returns a fully-populated `TenantSettings` object (no null fields — defaults fill any unset values).

```
getTenantConfig(
  tenant_id: UUID
) → TenantSettings
```

---

### getDepartments

**Description:** Retrieve all active departments for a tenant, ordered by `sort_order`. Used by other modules (personnel, scheduling) to validate department references and resolve department names.

```
getDepartments(
  tenant_id: UUID,
  options?: {
    include_inactive?: boolean,   // default: false
    ids?: UUID[]                  // filter to specific department IDs
  }
) → DepartmentResponse[]
```

---

## Domain Events

All domain events are published to the internal event bus. Consumers must be idempotent.

### tenant.configUpdated

**Trigger:** Tenant name or settings are updated via `PUT /tenant`.

**Payload — `TenantConfigUpdatedPayload`:**

| Field | Type | Description |
|---|---|---|
| tenant_id | UUID | Tenant ID |
| changed_fields | string[] | Top-level keys that changed (e.g., `["name", "settings.default_timezone"]`) |
| previous_values | object | Map of field → old value for changed fields |
| new_values | object | Map of field → new value for changed fields |
| updated_by | UUID | User who made the change |
| updated_at | ISO 8601 datetime | Timestamp |

---

### department.created

**Trigger:** A new department is created.

**Payload — `DepartmentCreatedPayload`:**

| Field | Type | Description |
|---|---|---|
| department_id | UUID | Created department ID |
| tenant_id | UUID | Tenant scope |
| name | string | Department name |
| sort_order | integer | Display position |
| created_by | UUID | User who created the department |
| created_at | ISO 8601 datetime | Timestamp |

---

### department.updated

**Trigger:** A department is updated.

**Payload — `DepartmentUpdatedPayload`:**

| Field | Type | Description |
|---|---|---|
| department_id | UUID | Updated department ID |
| tenant_id | UUID | Tenant scope |
| changed_fields | string[] | List of field names that changed |
| previous_values | object | Map of field → old value |
| new_values | object | Map of field → new value |
| updated_by | UUID | User who updated |
| updated_at | ISO 8601 datetime | Timestamp |

---

### department.deleted

**Trigger:** A department is soft-deleted.

**Payload — `DepartmentDeletedPayload`:**

| Field | Type | Description |
|---|---|---|
| department_id | UUID | Deleted department ID |
| tenant_id | UUID | Tenant scope |
| name | string | Department name (for audit/log reference) |
| deleted_by | UUID | User who deleted |
| deleted_at | ISO 8601 datetime | Timestamp |

---

### department.reordered

**Trigger:** `PATCH /api/v1/departments/reorder` completes successfully.

**Payload (representative):** `tenant_id`, `ordered_ids` (UUID[]), `updated_by`, `updated_at`
