# Documents Module — Interface Contract

> **Version:** 1.0.0
> **Base Path:** `/api/v1/documents`, `/api/v1/templates`, `/api/v1/rider-items`, `/api/v1/email-drafts`
> **Owner:** Documents Module
> **Last Updated:** 2026-02-15

---

## Table of Contents

- [Response Envelope](#response-envelope)
- [Endpoints — Documents](#endpoints--documents)
- [Endpoints — Document Generation](#endpoints--document-generation)
- [Endpoints — Templates](#endpoints--templates)
- [Endpoints — Rider Items](#endpoints--rider-items)
- [Endpoints — Email Drafts](#endpoints--email-drafts)
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

## Endpoints — Documents

### POST /api/v1/documents/upload

**Description:** Upload a document file and associate it with an event or entity. Accepts multipart/form-data.

**Auth:** Required. Tenant-scoped. Requires `documents:upload` permission.

**Content-Type:** `multipart/form-data`

**Request Body — `UploadDocumentRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| file | binary | yes | File to upload |
| event_id | UUID | no | Associated event |
| entity_type | string | no | Associated entity type (e.g., `personnel`, `client`, `vendor`, `venue`, `contact`) |
| entity_id | UUID | no | Associated entity ID |
| category | enum: contract, rider, invoice, production_schedule, stage_plot, tech_spec, photo, other | yes | Document category |
| name | string | no | Display name (defaults to filename) |
| description | string | no | Description |
| tags | string[] | no | Tags for filtering |
| visibility | enum: internal, client, public | no | Default: `internal` |

**Constraints:**

| Constraint | Value |
|---|---|
| Max file size | 50 MB |
| Allowed MIME types | application/pdf, image/*, application/msword, application/vnd.openxmlformats-officedocument.*, text/plain, text/csv |

**Response — `201 Created`:**

```
{
  data: DocumentResponse,
  meta: {
    upload_size_bytes: integer,
    processing_status: enum: complete, processing
  },
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Missing file, unsupported MIME type, or file exceeds size limit |
| 413 | File too large |

---

### GET /api/v1/documents

**Description:** List documents with filtering and cursor-based pagination.

**Auth:** Required. Tenant-scoped.

**Query Parameters — `DocumentFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| event_id | UUID | no | Filter by event |
| entity_type | string | no | Filter by associated entity type |
| entity_id | UUID | no | Filter by associated entity ID |
| category | enum (csv) | no | Filter by category |
| visibility | enum (csv) | no | Filter by visibility |
| source | enum: uploaded, generated | no | Filter by document source |
| search | string | no | Search across name, description, tags |
| sort_by | enum: name, created_at, category, size | no | Default: `created_at` |
| sort_order | enum: asc, desc | no | Default: `desc` |
| cursor | string (opaque) | no | Cursor for next page |
| limit | integer (1–100) | no | Default: `25` |

**Response — `200 OK` — `DocumentListResponse`:**

```
{
  data: DocumentResponse[],
  meta: {
    cursor: string | null,
    has_more: boolean,
    total_count: integer
  },
  errors: null
}
```

---

### GET /api/v1/documents/:id

**Description:** Retrieve document metadata and a time-limited download URL.

**Auth:** Required. Tenant-scoped.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Document ID |

**Response — `200 OK`:**

```
{
  data: DocumentResponse,
  meta: {
    download_url: string,           // pre-signed URL, expires in 15 minutes
    download_url_expires_at: ISO 8601 datetime
  },
  errors: null
}
```

---

### DELETE /api/v1/documents/:id

**Description:** Delete a document. Removes the file from storage and the metadata record.

**Auth:** Required. Tenant-scoped. Requires `documents:delete` permission.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Document ID |

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
| 404 | Document not found |
| 409 | Document is referenced by an active invoice or contract (cannot delete) |

---

## Endpoints — Document Generation

### POST /api/v1/documents/generate

**Description:** Generate a document from a template, populated with data from the platform. Returns the generated document metadata. The file is generated asynchronously for complex templates.

**Auth:** Required. Tenant-scoped. Requires `documents:generate` permission.

**Request Body — `GenerateDocumentRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| template_id | UUID | yes | Template to use |
| event_id | UUID | yes | Event context for data population |
| output_format | enum: pdf, docx | no | Default: `pdf` |
| data_overrides | object | no | Key-value overrides for template variables |
| name | string | no | Output document name (auto-generated from template if omitted) |
| category | enum | no | Document category (inherited from template if omitted) |
| visibility | enum: internal, client, public | no | Default: `internal` |

**Response — `202 Accepted` (async generation):**

```
{
  data: {
    generation_id: UUID,
    status: enum: queued, processing, complete, failed,
    document_id: UUID | null,       // populated when status = complete
    estimated_completion: ISO 8601 datetime | null
  },
  meta: null,
  errors: null
}
```

**Response — `201 Created` (sync generation for simple templates):**

```
{
  data: DocumentResponse,
  meta: {
    generated_from_template: UUID,
    generation_time_ms: integer
  },
  errors: null
}
```

---

## Endpoints — Templates

### GET /api/v1/templates

**Description:** List available document templates.

**Auth:** Required. Tenant-scoped.

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| category | enum (csv) | no | Filter by template category |
| search | string | no | Search across name, description |
| sort_by | enum: name, created_at, category | no | Default: `name` |
| sort_order | enum: asc, desc | no | Default: `asc` |

**Response — `200 OK`:**

```
{
  data: TemplateResponse[],
  meta: null,
  errors: null
}
```

`TemplateResponse` on the list endpoint **omits** `content` (summary only). Use **GET /:id** for the full body.

---

### GET /api/v1/templates/variable-catalog

**Description:** List built-in merge keys for HTML/Markdown templates (`{{key}}` placeholders). Used by the template editor UI and for author documentation. Does not include ad hoc keys from `data_overrides` on document generation.

**Auth:** Required. Tenant-scoped (same as template list).

**Response — `200 OK`:**

```
{
  data: TemplateMergeKeyDefinition[],
  meta: null,
  errors: null
}
```

**`TemplateMergeKeyDefinition`:**

| Field | Type | Description |
|---|---|---|
| key | string | Placeholder name (use as `{{key}}` in template content) |
| category | enum: event, personnel, custom_fields, placeholders | UI grouping |
| label | string | Short human label |
| kind | enum: text, html | `html` values are pre-rendered snippets; `text` is plain |
| description | string | What the key resolves to at generate time |
| stub | boolean | Present and true when output is a placeholder until another module is wired |

Human-oriented reference: `docs/template-variables.md` in the repo.

---

### GET /api/v1/templates/:id

**Description:** Get one template including `content` for viewing or editing in the UI.

**Auth:** Required. Tenant-scoped (same as list).

**Response — `200 OK`:**

```
{
  data: TemplateResponse & { content: string },
  meta: null,
  errors: null
}
```

**Error responses:** `404` if not found or other tenant.

---

### POST /api/v1/templates

**Description:** Create a new document template.

**Auth:** Required. Tenant-scoped. Requires `templates:create` permission.

**Request Body — `CreateTemplateRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| name | string | yes | Template name (1–255 chars) |
| description | string | no | Description of what this template generates |
| category | enum: contract, rider, invoice, production_schedule, stage_plot, tech_spec, report, other | yes | Template category |
| content | string | yes | Template content with variable placeholders |
| format | enum: html, markdown, docx_xml | yes | Template format |
| variables | TemplateVariable[] | no | Defined template variables |
| default_output_format | enum: pdf, docx | no | Default: `pdf` |
| is_active | boolean | no | Default: `true` |

**TemplateVariable:**

| Field | Type | Required | Description |
|---|---|---|---|
| key | string | yes | Variable key (used in template as `{{key}}`) |
| label | string | yes | Human-readable label |
| type | enum: string, number, date, boolean, list | yes | Variable data type |
| required | boolean | no | Whether the variable must be provided. Default: `false` |
| default_value | string | no | Default value |
| source | string | no | Auto-population source path (e.g., "event.name", "event.venue.address") |

**Response — `201 Created`:**

```
{
  data: TemplateResponse,
  meta: null,
  errors: null
}
```

---

### PUT /api/v1/templates/:id

**Description:** Update a template.

**Auth:** Required. Tenant-scoped. Requires `templates:update` permission.

**Request Body — `UpdateTemplateRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| name | string | no | Template name |
| description | string | no | Description |
| category | enum | no | Category |
| content | string | no | Template content |
| format | enum | no | Template format |
| variables | TemplateVariable[] | no | Replaces existing variables |
| default_output_format | enum | no | Output format |
| is_active | boolean | no | Active status |

**Response — `200 OK`:**

```
{
  data: TemplateResponse,
  meta: {
    version: integer               // template version auto-incremented on content changes
  },
  errors: null
}
```

---

## Endpoints — Rider Items

### GET /api/v1/rider-items

**Description:** List rider items (parsed from rider documents). Rider items are individual line items extracted from uploaded rider/tech-spec documents.

**Auth:** Required. Tenant-scoped.

**Query Parameters — `RiderItemFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| event_id | UUID | no | Filter by event |
| document_id | UUID | no | Filter by source document |
| category | enum: audio, lighting, video, staging, backline, catering, hospitality, transport, other | no | Filter by item category |
| status | enum: pending, confirmed, sourced, declined | no | Filter by status |
| search | string | no | Search item descriptions |
| cursor | string (opaque) | no | Cursor for next page |
| limit | integer (1–100) | no | Default: `50` |

**Response — `200 OK`:**

```
{
  data: RiderItemResponse[],
  meta: {
    cursor: string | null,
    has_more: boolean,
    total_count: integer
  },
  errors: null
}
```

---

### PUT /api/v1/rider-items/:id

**Description:** Update a rider item (e.g., change status, add notes, assign to a category).

**Auth:** Required. Tenant-scoped. Requires `documents:update` permission.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Rider item ID |

**Request Body — `UpdateRiderItemRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| category | enum | no | Item category |
| status | enum: pending, confirmed, sourced, declined | no | Item status |
| quantity | integer | no | Quantity |
| notes | string | no | Notes |
| assigned_to | UUID | no | Personnel responsible for sourcing |
| estimated_cost | decimal | no | Estimated cost |

**Response — `200 OK`:**

```
{
  data: RiderItemResponse,
  meta: null,
  errors: null
}
```

---

## Endpoints — Email Drafts

### POST /api/v1/email-drafts

**Description:** Generate an email draft populated with event/document data. Does NOT send — returns a draft for review.

**Auth:** Required. Tenant-scoped. Requires `documents:generate` permission.

**Request Body — `CreateEmailDraftRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| template_id | UUID | no | Email template to use (if omitted, uses raw content) |
| event_id | UUID | yes | Event context |
| to | string[] | yes | Recipient email addresses |
| cc | string[] | no | CC recipients |
| subject | string | yes | Email subject line |
| body | string | no | Custom body content (used if no template) |
| data_overrides | object | no | Template variable overrides |
| attachments | UUID[] | no | Document IDs to attach |

**Response — `201 Created`:**

```
{
  data: {
    id: UUID,
    event_id: UUID,
    to: string[],
    cc: string[],
    subject: string,
    body_html: string,
    body_text: string,
    attachments: [
      { document_id: UUID, name: string, size_bytes: integer }
    ],
    status: enum: draft, ready,
    created_at: ISO 8601 datetime
  },
  meta: null,
  errors: null
}
```

---

## Type Definitions

### DocumentResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Document ID |
| name | string | Display name |
| description | string | null | Description |
| event_id | UUID | null | Associated event |
| entity_type | string | null | Associated entity type |
| entity_id | UUID | null | Associated entity ID |
| category | enum: contract, rider, invoice, production_schedule, stage_plot, tech_spec, photo, other | Document category |
| source | enum: uploaded, generated | Document source |
| visibility | enum: internal, client, public | Visibility level |
| mime_type | string | MIME type |
| size_bytes | integer | File size in bytes |
| file_path | string | Internal storage path (not exposed to clients) |
| tags | string[] | Tags |
| generated_from_template | UUID | null | Template ID if generated |
| version | integer | Document version |
| uploaded_by | UUID | User who uploaded/generated |
| created_at | ISO 8601 datetime | Creation timestamp |
| updated_at | ISO 8601 datetime | Last update timestamp |

### TemplateResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Template ID |
| name | string | Template name |
| description | string | null | Description |
| category | enum: contract, rider, invoice, production_schedule, stage_plot, tech_spec, report, other | Template category |
| format | enum: html, markdown, docx_xml | Template format |
| variables | TemplateVariable[] | Defined variables |
| default_output_format | enum: pdf, docx | Default output format |
| version | integer | Template version (auto-incremented) |
| is_active | boolean | Whether the template is active |
| created_at | ISO 8601 datetime | Creation timestamp |
| updated_at | ISO 8601 datetime | Last update timestamp |

### RiderItemResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Rider item ID |
| document_id | UUID | Source document reference |
| event_id | UUID | Associated event |
| description | string | Item description |
| category | enum: audio, lighting, video, staging, backline, catering, hospitality, transport, other | Item category |
| quantity | integer | Quantity |
| status | enum: pending, confirmed, sourced, declined | Item status |
| notes | string | null | Notes |
| assigned_to | UUID | null | Personnel responsible |
| assigned_to_name | string | null | Denormalized personnel name |
| estimated_cost | decimal | null | Estimated cost |
| source_line | string | null | Original line from the rider document |
| created_at | ISO 8601 datetime | Creation timestamp |
| updated_at | ISO 8601 datetime | Last update timestamp |

---

## Internal Interface

These functions are callable by other modules via internal service calls. They are NOT exposed as HTTP endpoints.

### getDocumentsByEvent

**Description:** Retrieve all documents associated with an event.

```
getDocumentsByEvent(
  event_id: UUID,
  tenant_id: UUID,
  options?: {
    category?: enum[],
    visibility?: enum[],
    source?: enum: uploaded, generated
  }
) → DocumentResponse[]
```

---

### generateDocument

**Description:** Programmatically generate a document from a template. Used by other modules (e.g., Financial module generating invoices as PDFs).

```
generateDocument(
  template_id: UUID,
  tenant_id: UUID,
  context: {
    event_id: UUID,
    data: object,                   // template variable values
    output_format?: enum: pdf, docx,
    name?: string,
    category?: enum,
    visibility?: enum
  }
) → {
  document_id: UUID,
  status: enum: complete, processing,
  download_url: string | null       // available immediately if sync generation
}
```

---

### getTemplates

**Description:** Retrieve available templates, optionally filtered by category.

```
getTemplates(
  tenant_id: UUID,
  options?: {
    category?: enum[],
    active_only?: boolean           // default: true
  }
) → TemplateResponse[]
```

---

## Domain Events

All domain events are published to the internal event bus. Consumers must be idempotent.

### document.uploaded

**Trigger:** A document is uploaded successfully.

**Payload — `DocumentUploadedPayload`:**

| Field | Type | Description |
|---|---|---|
| document_id | UUID | Uploaded document ID |
| tenant_id | UUID | Tenant scope |
| event_id | UUID | null | Associated event |
| entity_type | string | null | Associated entity type |
| entity_id | UUID | null | Associated entity ID |
| name | string | Document name |
| category | string | Document category |
| mime_type | string | MIME type |
| size_bytes | integer | File size |
| visibility | string | Visibility level |
| uploaded_by | UUID | User who uploaded |
| uploaded_at | ISO 8601 datetime | Timestamp |

---

### document.generated

**Trigger:** A document is generated from a template.

**Payload — `DocumentGeneratedPayload`:**

| Field | Type | Description |
|---|---|---|
| document_id | UUID | Generated document ID |
| tenant_id | UUID | Tenant scope |
| event_id | UUID | Event context |
| template_id | UUID | Template used |
| template_name | string | Template name |
| name | string | Document name |
| category | string | Document category |
| output_format | string | Output format (pdf, docx) |
| generation_time_ms | integer | Time to generate |
| generated_by | UUID | User who triggered generation |
| generated_at | ISO 8601 datetime | Timestamp |

---

### rider.processed

**Trigger:** Rider items are extracted from an uploaded rider document.

**Payload — `RiderProcessedPayload`:**

| Field | Type | Description |
|---|---|---|
| document_id | UUID | Source document ID |
| tenant_id | UUID | Tenant scope |
| event_id | UUID | Associated event |
| items_extracted | integer | Number of rider items created |
| categories_found | string[] | Distinct categories among extracted items |
| processed_at | ISO 8601 datetime | Timestamp |
