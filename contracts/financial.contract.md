# Financial Module — Interface Contract

> **Version:** 1.0.0
> **Base Path:** `/api/v1/financials`, `/api/v1/invoices`, `/api/v1/reports`
> **Owner:** Financial Module
> **Last Updated:** 2026-02-15

---

## Table of Contents

- [Response Envelope](#response-envelope)
- [Endpoints — Financial Records](#endpoints--financial-records)
- [Endpoints — Event Budget & Financials](#endpoints--event-budget--financials)
- [Endpoints — Invoices](#endpoints--invoices)
- [Endpoints — Reports](#endpoints--reports)
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

## Endpoints — Financial Records

### POST /api/v1/financials

**Description:** Create a financial line item (cost or revenue) associated with an event.

**Auth:** Required. Tenant-scoped. Requires `financials:create` permission.

**Request Body — `CreateFinancialRecordRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| event_id | UUID | yes | Associated event |
| category | enum: labor, travel, transport, equipment, venue, catering, accommodation, miscellaneous, revenue | yes | Cost/revenue category |
| type | enum: cost, revenue | yes | Whether this is a cost or revenue item |
| description | string | yes | Line item description (1–500 chars) |
| amount | decimal | yes | Amount (positive value) |
| currency | string | no | ISO 4217 currency code. Default: tenant default currency |
| quantity | decimal | no | Quantity. Default: `1` |
| unit_price | decimal | no | Price per unit (amount = quantity × unit_price if both provided) |
| date | ISO 8601 date | no | Date the cost/revenue applies to |
| source | enum: manual, calculated, imported | no | How the record was created. Default: `manual` |
| source_ref | object | no | Reference to source (e.g., assignment_id, travel_id) |
| status | enum: estimated, actual, approved | no | Default: `estimated` |
| notes | string | no | Additional notes |
| metadata | object | no | Key-value custom fields |

**source_ref:**

| Field | Type | Description |
|---|---|---|
| module | string | Source module name (e.g., "scheduling", "travel") |
| entity_type | string | Entity type (e.g., "crew_assignment", "travel_record") |
| entity_id | UUID | Entity ID |

**Response — `201 Created`:**

```
{
  data: FinancialRecordResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure |
| 404 | Event not found |

---

### GET /api/v1/financials

**Description:** List financial records with filtering and cursor-based pagination.

**Auth:** Required. Tenant-scoped.

**Query Parameters — `FinancialRecordFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| event_id | UUID | no | Filter by event |
| category | enum (csv) | no | Filter by category |
| type | enum: cost, revenue | no | Filter by type |
| status | enum (csv) | no | Filter by status: `estimated,actual,approved` |
| source | enum (csv) | no | Filter by source |
| date_range_start | ISO 8601 date | no | Records on or after |
| date_range_end | ISO 8601 date | no | Records on or before |
| min_amount | decimal | no | Minimum amount |
| max_amount | decimal | no | Maximum amount |
| search | string | no | Search across description, notes |
| sort_by | enum: date, amount, category, created_at | no | Default: `date` |
| sort_order | enum: asc, desc | no | Default: `desc` |
| cursor | string (opaque) | no | Cursor for next page |
| limit | integer (1–100) | no | Default: `25` |

**Response — `200 OK`:**

```
{
  data: FinancialRecordResponse[],
  meta: {
    cursor: string | null,
    has_more: boolean,
    total_count: integer
  },
  errors: null
}
```

---

### GET /api/v1/financials/:id

**Description:** Retrieve a single financial record.

**Auth:** Required. Tenant-scoped.

**Response — `200 OK`:**

```
{
  data: FinancialRecordResponse,
  meta: null,
  errors: null
}
```

---

### PUT /api/v1/financials/:id

**Description:** Update a financial record. Partial updates supported.

**Auth:** Required. Tenant-scoped. Requires `financials:update` permission.

**Request Body — `UpdateFinancialRecordRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| category | enum | no | Cost/revenue category |
| description | string | no | Description |
| amount | decimal | no | Amount |
| quantity | decimal | no | Quantity |
| unit_price | decimal | no | Unit price |
| date | ISO 8601 date | no | Applicable date |
| status | enum | no | Record status |
| notes | string | no | Notes |
| metadata | object | no | Merged with existing metadata |

**Response — `200 OK`:**

```
{
  data: FinancialRecordResponse,
  meta: null,
  errors: null
}
```

---

### DELETE /api/v1/financials/:id

**Description:** Delete a financial record. Only `manual` source records can be deleted. Calculated records must be recalculated.

**Auth:** Required. Tenant-scoped. Requires `financials:delete` permission.

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
| 409 | Record is `calculated` source — cannot be directly deleted |
| 409 | Record is attached to an approved invoice |

---

## Endpoints — Event Budget & Financials

### GET /api/v1/events/:id/budget

**Description:** Retrieve the budget summary for an event. Aggregates all financial records into a high-level overview.

**Auth:** Required. Tenant-scoped.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Event ID |

**Response — `200 OK` — `EventBudgetResponse`:**

```
{
  data: {
    event_id: UUID,
    event_name: string,
    currency: string,
    total_revenue: decimal,
    total_costs: decimal,
    net_profit: decimal,
    profit_margin_pct: decimal,
    costs_by_category: [
      {
        category: string,
        estimated: decimal,
        actual: decimal,
        approved: decimal,
        count: integer
      }
    ],
    revenue_by_category: [
      {
        category: string,
        estimated: decimal,
        actual: decimal,
        approved: decimal,
        count: integer
      }
    ],
    summary: {
      total_estimated_costs: decimal,
      total_actual_costs: decimal,
      total_approved_costs: decimal,
      total_estimated_revenue: decimal,
      total_actual_revenue: decimal,
      total_approved_revenue: decimal
    }
  },
  meta: {
    last_calculated_at: ISO 8601 datetime,
    record_count: integer
  },
  errors: null
}
```

---

### GET /api/v1/events/:id/financials

**Description:** Retrieve all financial records for a specific event. Convenience endpoint equivalent to `GET /financials?event_id=:id`.

**Auth:** Required. Tenant-scoped.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Event ID |

**Query Parameters:**

Supports the same filters as `GET /api/v1/financials` except `event_id` (implicit from path).

**Response — `200 OK`:**

```
{
  data: FinancialRecordResponse[],
  meta: {
    cursor: string | null,
    has_more: boolean,
    total_count: integer,
    totals: {
      costs: decimal,
      revenue: decimal,
      net: decimal
    }
  },
  errors: null
}
```

---

## Endpoints — Invoices

### POST /api/v1/invoices

**Description:** Create an invoice from selected financial records.

**Auth:** Required. Tenant-scoped. Requires `invoices:create` permission.

**Request Body — `CreateInvoiceRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| event_id | UUID | yes | Associated event |
| client_id | UUID | yes | Invoice recipient (client) |
| invoice_number | string | no | Custom invoice number (auto-generated if omitted) |
| line_items | InvoiceLineItem[] | yes | Line items (min 1) |
| due_date | ISO 8601 date | yes | Payment due date |
| tax_rate | decimal | no | Tax rate as percentage (e.g., `8.5` for 8.5%) |
| discount | decimal | no | Discount amount |
| discount_type | enum: fixed, percentage | no | Discount type. Default: `fixed` |
| notes | string | no | Invoice notes / terms |
| payment_terms | string | no | Payment terms description |

**InvoiceLineItem:**

| Field | Type | Required | Description |
|---|---|---|---|
| description | string | yes | Line item description |
| quantity | decimal | yes | Quantity |
| unit_price | decimal | yes | Price per unit |
| financial_record_id | UUID | no | Link to a financial record |

**Response — `201 Created`:**

```
{
  data: InvoiceResponse,
  meta: null,
  errors: null
}
```

---

### GET /api/v1/invoices

**Description:** List invoices with filtering.

**Auth:** Required. Tenant-scoped.

**Query Parameters — `InvoiceFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| event_id | UUID | no | Filter by event |
| client_id | UUID | no | Filter by client |
| status | enum (csv) | no | Filter: `draft,sent,paid,overdue,void` |
| date_range_start | ISO 8601 date | no | Invoices created on or after |
| date_range_end | ISO 8601 date | no | Invoices created on or before |
| cursor | string (opaque) | no | Cursor for next page |
| limit | integer (1–100) | no | Default: `25` |

**Response — `200 OK`:**

```
{
  data: InvoiceResponse[],
  meta: {
    cursor: string | null,
    has_more: boolean,
    total_count: integer,
    totals: {
      total_invoiced: decimal,
      total_paid: decimal,
      total_outstanding: decimal
    }
  },
  errors: null
}
```

---

### GET /api/v1/invoices/:id

**Description:** Retrieve a single invoice with all line items.

**Response — `200 OK`:**

```
{
  data: InvoiceResponse,
  meta: null,
  errors: null
}
```

---

### PUT /api/v1/invoices/:id

**Description:** Update an invoice. Only `draft` invoices can be modified.

**Auth:** Required. Tenant-scoped. Requires `invoices:update` permission.

**Request Body — `UpdateInvoiceRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| line_items | InvoiceLineItem[] | no | Replace line items |
| due_date | ISO 8601 date | no | Due date |
| tax_rate | decimal | no | Tax rate |
| discount | decimal | no | Discount |
| discount_type | enum | no | Discount type |
| notes | string | no | Notes |
| payment_terms | string | no | Payment terms |
| status | enum: draft, sent, paid, void | no | Invoice status |

**Response — `200 OK`:**

```
{
  data: InvoiceResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 409 | Invoice is not in `draft` status (cannot modify sent/paid invoices) |

---

## Endpoints — Reports

### GET /api/v1/reports/costs

**Description:** Generate a cost report across events. Supports aggregation and grouping.

**Auth:** Required. Tenant-scoped. Requires `reports:read` permission.

**Query Parameters — `CostReportFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| date_range_start | ISO 8601 date | yes | Report period start |
| date_range_end | ISO 8601 date | yes | Report period end |
| group_by | enum: event, category, month, client | no | Grouping dimension. Default: `event` |
| event_id | UUID | no | Limit to a specific event |
| client_id | UUID | no | Limit to a specific client |
| category | enum (csv) | no | Filter by category |
| status | enum (csv) | no | Filter by record status |

**Response — `200 OK` — `CostReportResponse`:**

```
{
  data: {
    period: { start: ISO 8601 date, end: ISO 8601 date },
    group_by: string,
    groups: [
      {
        key: string,
        label: string,
        total_costs: decimal,
        total_revenue: decimal,
        net: decimal,
        record_count: integer,
        breakdown: [
          {
            category: string,
            amount: decimal,
            count: integer
          }
        ]
      }
    ],
    totals: {
      total_costs: decimal,
      total_revenue: decimal,
      net: decimal,
      record_count: integer
    }
  },
  meta: {
    generated_at: ISO 8601 datetime,
    currency: string
  },
  errors: null
}
```

---

## Type Definitions

### FinancialRecordResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Record ID |
| event_id | UUID | Associated event |
| event_name | string | Denormalized event name |
| category | enum: labor, travel, transport, equipment, venue, catering, accommodation, miscellaneous, revenue | Category |
| type | enum: cost, revenue | Cost or revenue |
| description | string | Line item description |
| amount | decimal | Total amount |
| currency | string | ISO 4217 currency code |
| quantity | decimal | Quantity |
| unit_price | decimal | Price per unit |
| date | ISO 8601 date | null | Applicable date |
| source | enum: manual, calculated, imported | Record source |
| source_ref | object | null | Source reference |
| status | enum: estimated, actual, approved | Record status |
| notes | string | null | Notes |
| metadata | object | Custom fields |
| invoice_id | UUID | null | Linked invoice (if invoiced) |
| created_at | ISO 8601 datetime | Creation timestamp |
| updated_at | ISO 8601 datetime | Last update timestamp |

### InvoiceResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Invoice ID |
| invoice_number | string | Invoice number |
| event_id | UUID | Associated event |
| event_name | string | Denormalized event name |
| client_id | UUID | Client reference |
| client_name | string | Denormalized client name |
| status | enum: draft, sent, paid, overdue, void | Invoice status |
| line_items | InvoiceLineItemResponse[] | Invoice line items |
| subtotal | decimal | Sum of line items |
| tax_rate | decimal | Tax percentage |
| tax_amount | decimal | Calculated tax amount |
| discount | decimal | Discount amount |
| discount_type | enum: fixed, percentage | Discount type |
| total | decimal | Final total (subtotal + tax - discount) |
| currency | string | ISO 4217 currency code |
| due_date | ISO 8601 date | Payment due date |
| paid_date | ISO 8601 date | null | Date payment was received |
| paid_amount | decimal | null | Amount paid |
| notes | string | null | Notes/terms |
| payment_terms | string | null | Payment terms |
| created_at | ISO 8601 datetime | Creation timestamp |
| updated_at | ISO 8601 datetime | Last update timestamp |

### InvoiceLineItemResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Line item ID |
| description | string | Description |
| quantity | decimal | Quantity |
| unit_price | decimal | Price per unit |
| amount | decimal | Calculated: quantity × unit_price |
| financial_record_id | UUID | null | Linked financial record |

---

## Internal Interface

These functions are callable by other modules via internal service calls. They are NOT exposed as HTTP endpoints.

### getEventBudget

**Description:** Retrieve the computed budget summary for an event. Same data as the budget endpoint, for internal consumption.

```
getEventBudget(
  event_id: UUID,
  tenant_id: UUID
) → {
  event_id: UUID,
  currency: string,
  total_revenue: decimal,
  total_costs: decimal,
  net_profit: decimal,
  profit_margin_pct: decimal,
  costs_by_category: [
    { category: string, estimated: decimal, actual: decimal, approved: decimal }
  ]
}
```

---

### getEventCosts

**Description:** Retrieve the total costs for an event, optionally filtered by category or source.

```
getEventCosts(
  event_id: UUID,
  tenant_id: UUID,
  options?: {
    category?: enum[],
    source?: enum[],
    status?: enum[]
  }
) → {
  event_id: UUID,
  total: decimal,
  currency: string,
  records: FinancialRecordResponse[]
}
```

---

### recalculateEventCosts

**Description:** Trigger a recalculation of all calculated financial records for an event. Called when assignments, travel, or other cost-driving data changes. Recalculates `labor`, `travel`, and `transport` category records from their source modules.

```
recalculateEventCosts(
  event_id: UUID,
  tenant_id: UUID,
  options?: {
    categories?: enum[],           // limit recalculation to specific categories
    triggered_by?: string          // audit: which module/event triggered this
  }
) → {
  event_id: UUID,
  records_updated: integer,
  records_created: integer,
  records_deleted: integer,
  new_total_costs: decimal
}
```

---

## Domain Events

All domain events are published to the internal event bus. Consumers must be idempotent.

### budget.updated

**Trigger:** An event's budget changes due to financial record creation, update, deletion, or recalculation.

**Payload — `BudgetUpdatedPayload`:**

| Field | Type | Description |
|---|---|---|
| event_id | UUID | Affected event |
| tenant_id | UUID | Tenant scope |
| previous_total_costs | decimal | Total costs before change |
| new_total_costs | decimal | Total costs after change |
| previous_total_revenue | decimal | Total revenue before change |
| new_total_revenue | decimal | Total revenue after change |
| previous_net | decimal | Net before change |
| new_net | decimal | Net after change |
| trigger | string | What caused the update (e.g., "record_created", "recalculation") |
| updated_at | ISO 8601 datetime | Timestamp |

---

### invoice.created

**Trigger:** A new invoice is created.

**Payload — `InvoiceCreatedPayload`:**

| Field | Type | Description |
|---|---|---|
| invoice_id | UUID | Created invoice ID |
| invoice_number | string | Invoice number |
| tenant_id | UUID | Tenant scope |
| event_id | UUID | Associated event |
| client_id | UUID | Client reference |
| total | decimal | Invoice total |
| currency | string | Currency code |
| due_date | ISO 8601 date | Due date |
| line_item_count | integer | Number of line items |
| created_by | UUID | User who created |
| created_at | ISO 8601 datetime | Timestamp |

---

### payment.statusChanged

**Trigger:** An invoice's payment status changes (e.g., sent → paid, sent → overdue).

**Payload — `PaymentStatusChangedPayload`:**

| Field | Type | Description |
|---|---|---|
| invoice_id | UUID | Invoice ID |
| invoice_number | string | Invoice number |
| tenant_id | UUID | Tenant scope |
| event_id | UUID | Associated event |
| client_id | UUID | Client reference |
| previous_status | string | Status before change |
| new_status | string | Status after change |
| total | decimal | Invoice total |
| paid_amount | decimal | null | Amount paid (if status = paid) |
| paid_date | ISO 8601 date | null | Payment date (if status = paid) |
| changed_by | UUID | User who changed status (or system for auto-overdue) |
| changed_at | ISO 8601 datetime | Timestamp |
