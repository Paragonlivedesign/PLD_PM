# Custom Fields Module — Interface Contract

> **Version:** 1.0.0
> **Base Path:** `/api/v1/custom-fields`
> **Owner:** Custom Fields Module
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

### GET /api/v1/custom-fields

**Description:** List custom field definitions for a given entity type and the current tenant. Returns definitions ordered by `display_order`.

**Auth:** Required. Tenant-scoped.

**Query Parameters — `CustomFieldFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| entity_type | enum: event, personnel, travel_record, financial_line_item, department | yes | Entity type to retrieve definitions for |
| include_deprecated | boolean | no | Include soft-deleted definitions. Default: `false` |

**Response — `200 OK` — `CustomFieldDefinitionListResponse`:**

```
{
  data: CustomFieldDefinitionResponse[],
  meta: {
    total_count: integer,
    entity_type: string
  },
  errors: null
}
```

---

### POST /api/v1/custom-fields

**Description:** Create a new custom field definition. The `field_key` is immutable after creation.

**Auth:** Required. Tenant-scoped. Requires `custom_fields.definitions.manage` permission.

**Request Body — `CreateCustomFieldRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| entity_type | enum: event, personnel, travel_record, financial_line_item, department | yes | Target entity type |
| field_key | string | yes | Unique key within entity type (1–50 chars, snake_case, immutable) |
| label | string | yes | Display label (1–100 chars) |
| description | string | no | Help text for the field (max 500 chars) |
| field_type | enum: text, number, boolean, date, datetime, select, multi_select, url, email, phone | yes | Value type |
| validation_rules | ValidationRules | no | Type-specific validation rules (see type definition) |
| default_value | any | no | Default value (must pass validation for the field type) |
| options | SelectOption[] | conditional | Required for `select` and `multi_select` field types |
| is_required | boolean | no | Whether the field is mandatory. Default: `false` |
| is_searchable | boolean | no | Whether the field is indexed for search/filter. Default: `false` |
| display_order | integer | no | Position in form layout. Default: appended to end |
| visibility | enum: all, admin_only | no | Who can see this field. Default: `all` |

**Response — `201 Created`:**

```
{
  data: CustomFieldDefinitionResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure (invalid field_type, invalid field_key format, invalid default_value) |
| 402 | Tier limit reached for custom fields per entity type |
| 403 | Insufficient permissions |
| 409 | `field_key` already exists for this entity type within the tenant |

---

### PUT /api/v1/custom-fields/:id

**Description:** Update an existing custom field definition. The `field_key` and `field_type` cannot be changed. Label, description, validation rules, options, and display properties can be modified. Increments the definition `version`.

**Auth:** Required. Tenant-scoped. Requires `custom_fields.definitions.manage` permission.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Custom field definition ID |

**Request Body — `UpdateCustomFieldRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| label | string | no | Display label |
| description | string | no | Help text |
| validation_rules | ValidationRules | no | Updated validation rules |
| default_value | any | no | Updated default value |
| options | SelectOption[] | no | Updated options (select/multi_select only). New options appended; existing options can be deprecated but not removed. |
| is_required | boolean | no | Required status |
| is_searchable | boolean | no | Searchable status |
| display_order | integer | no | Display position |
| visibility | enum: all, admin_only | no | Visibility scope |

**Response — `200 OK`:**

```
{
  data: CustomFieldDefinitionResponse,
  meta: {
    previous_version: integer,
    new_version: integer
  },
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure (e.g., attempted to change `field_type`) |
| 402 | Tier limit reached for searchable fields (when enabling `is_searchable`) |
| 403 | Insufficient permissions |
| 404 | Definition not found |

---

### DELETE /api/v1/custom-fields/:id

**Description:** Soft-delete a custom field definition. Existing values in entity JSONB are preserved but the field stops appearing in forms. Sets `deleted_at` and increments version.

**Auth:** Required. Tenant-scoped. Requires `custom_fields.definitions.manage` permission.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Custom field definition ID |

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
| 403 | Insufficient permissions |
| 404 | Definition not found |

---

### PUT /api/v1/custom-fields/reorder

**Description:** Bulk update the `display_order` of custom field definitions for a given entity type. Accepts an ordered array of definition IDs and reassigns `display_order` sequentially.

**Auth:** Required. Tenant-scoped. Requires `custom_fields.definitions.manage` permission.

**Request Body — `ReorderCustomFieldsRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| entity_type | enum: event, personnel, travel_record, financial_line_item, department | yes | Target entity type |
| ordered_ids | UUID[] | yes | Definition IDs in desired display order |

**Response — `200 OK`:**

```
{
  data: CustomFieldDefinitionResponse[],
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Mismatch between provided IDs and existing definitions for the entity type |
| 403 | Insufficient permissions |

---

## Type Definitions

### CustomFieldDefinitionResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Definition ID |
| entity_type | string | Target entity type |
| field_key | string | Unique field key (immutable) |
| label | string | Display label |
| description | string | null | Help text |
| field_type | enum: text, number, boolean, date, datetime, select, multi_select, url, email, phone | Value type |
| validation_rules | ValidationRules | null | Type-specific validation rules |
| default_value | any | null | Default value |
| options | SelectOption[] | null | Options for select/multi_select types |
| is_required | boolean | Whether the field is mandatory |
| is_searchable | boolean | Whether the field is indexed |
| display_order | integer | Position in form layout |
| visibility | enum: all, admin_only | Visibility scope |
| version | integer | Definition version (incremented on every update) |
| created_at | ISO 8601 datetime | Creation timestamp |
| updated_at | ISO 8601 datetime | Last update timestamp |
| deleted_at | ISO 8601 datetime | null | Soft-delete timestamp |

### ValidationRules

Type-specific validation constraints. Only applicable fields for the given `field_type` are present.

| Field | Type | Applies To | Description |
|---|---|---|---|
| min_length | integer | text | Minimum character length |
| max_length | integer | text | Maximum character length |
| pattern | string | text | Regex pattern for validation |
| min | number | number | Minimum numeric value |
| max | number | number | Maximum numeric value |
| precision | integer | number | Maximum decimal places |
| min_date | ISO 8601 date | date, datetime | Earliest allowed date |
| max_date | ISO 8601 date | date, datetime | Latest allowed date |
| not_in_past | boolean | date, datetime | Reject dates before today |

### SelectOption

| Field | Type | Description |
|---|---|---|
| value | string | Stored identifier (immutable once created) |
| label | string | Display text (mutable) |
| color | string | null | Hex color code for visual coding |
| is_deprecated | boolean | Whether the option is deprecated (hidden from new selections, displayed in historical data) |

---

## Internal Interface

These functions are callable by other modules via internal service calls. They are NOT exposed as HTTP endpoints.

### getFieldDefinitions

**Description:** Retrieve all active custom field definitions for a given entity type and tenant. Used by modules to render custom field sections in forms and to include custom field metadata in API responses.

```
getFieldDefinitions(
  entity_type: string,
  tenant_id: UUID,
  options?: {
    include_deprecated?: boolean   // default: false
  }
) → CustomFieldDefinitionResponse[]
```

---

### validateCustomFields

**Description:** Validate a set of custom field values against the definitions for a given entity type. Returns the cleaned values (unknown keys stripped, defaults injected) and any validation errors. Called by entity modules during create/update operations.

```
validateCustomFields(
  entity_type: string,
  tenant_id: UUID,
  values: object                   // key-value map of custom field data
) → {
  valid: boolean,
  cleaned_values: object,          // sanitized key-value map with defaults injected
  errors: [
    {
      field_key: string,
      code: string,                // e.g., "REQUIRED", "INVALID_TYPE", "OUT_OF_RANGE"
      message: string
    }
  ]
}
```

---

### getFieldsForSearch

**Description:** Retrieve custom field definitions marked as searchable for a given entity type. Used by the Search and Analytics modules to discover available filter/dimension fields.

```
getFieldsForSearch(
  entity_type: string,
  tenant_id: UUID
) → [
  {
    field_key: string,
    label: string,
    field_type: string,
    options: SelectOption[] | null  // for select/multi_select types
  }
]
```

---

## Domain Events

All domain events are published to the internal event bus. Consumers must be idempotent.

### fieldDefinition.created

**Trigger:** A new custom field definition is created.

**Payload — `FieldDefinitionCreatedPayload`:**

| Field | Type | Description |
|---|---|---|
| definition_id | UUID | Created definition ID |
| tenant_id | UUID | Tenant scope |
| entity_type | string | Target entity type |
| field_key | string | Unique field key |
| field_type | string | Value type |
| label | string | Display label |
| is_required | boolean | Whether required |
| is_searchable | boolean | Whether indexed |
| created_by | UUID | User who created |
| created_at | ISO 8601 datetime | Timestamp |

---

### fieldDefinition.updated

**Trigger:** A custom field definition is updated (label, validation, options, or properties changed).

**Payload — `FieldDefinitionUpdatedPayload`:**

| Field | Type | Description |
|---|---|---|
| definition_id | UUID | Updated definition ID |
| tenant_id | UUID | Tenant scope |
| entity_type | string | Target entity type |
| field_key | string | Field key |
| changed_fields | string[] | List of properties that changed |
| previous_values | object | Map of property → old value |
| new_values | object | Map of property → new value |
| previous_version | integer | Version before update |
| new_version | integer | Version after update |
| updated_by | UUID | User who updated |
| updated_at | ISO 8601 datetime | Timestamp |

---

### fieldDefinition.deleted

**Trigger:** A custom field definition is soft-deleted.

**Payload — `FieldDefinitionDeletedPayload`:**

| Field | Type | Description |
|---|---|---|
| definition_id | UUID | Deleted definition ID |
| tenant_id | UUID | Tenant scope |
| entity_type | string | Target entity type |
| field_key | string | Field key (for reference — existing JSONB values are preserved) |
| label | string | Display label (for audit reference) |
| deleted_by | UUID | User who deleted |
| deleted_at | ISO 8601 datetime | Timestamp |
