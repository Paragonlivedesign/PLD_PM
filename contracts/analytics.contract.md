# Analytics Module — Interface Contract

> **Version:** 1.0.0
> **Base Path:** `/api/v1/dashboard`, `/api/v1/reports`, `/api/v1/saved-reports`
> **Owner:** Analytics Module
> **Last Updated:** 2026-02-15

---

## Table of Contents

- [Response Envelope](#response-envelope)
- [Endpoints — Dashboards](#endpoints--dashboards)
- [Endpoints — Reports](#endpoints--reports)
- [Endpoints — Saved Reports](#endpoints--saved-reports)
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

## Endpoints — Dashboards

### GET /api/v1/dashboard/operations

**Description:** Retrieve the operations dashboard data. Returns aggregated KPIs and chart data for active events, personnel utilization, scheduling conflicts, and upcoming deadlines. Data is role-scoped — coordinators see only their assigned events.

**Auth:** Required. Tenant-scoped. Requires `analytics.dashboard.read` permission.

**Query Parameters — `OperationsDashboardFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| date_range_start | ISO 8601 date | no | Start of date range. Default: 30 days ago |
| date_range_end | ISO 8601 date | no | End of date range. Default: today |
| department_id | UUID | no | Filter by department |
| event_status | enum (csv) | no | Filter by event status: `draft,confirmed,in_progress,completed,cancelled` |

**Response — `200 OK` — `OperationsDashboardResponse`:**

```
{
  data: {
    kpis: {
      active_events: integer,
      upcoming_events_7d: integer,
      personnel_assigned: integer,
      open_conflicts: integer,
      utilization_rate: decimal       // percentage (0–100)
    },
    events_by_status: ChartData,
    events_by_phase: ChartData,
    personnel_utilization: ChartData,
    upcoming_deadlines: [
      {
        entity_type: string,
        entity_id: UUID,
        entity_name: string,
        deadline_type: string,
        deadline_date: ISO 8601 date,
        days_remaining: integer
      }
    ]
  },
  meta: {
    date_range: { start: ISO 8601 date, end: ISO 8601 date },
    cached_at: ISO 8601 datetime | null,
    data_freshness: enum: live, cached
  },
  errors: null
}
```

---

### GET /api/v1/dashboard/financial

**Description:** Retrieve the financial dashboard data. Returns aggregated revenue, cost, and profitability metrics. Restricted to users with financial data access.

**Auth:** Required. Tenant-scoped. Requires `analytics.dashboard.read` and financial read permissions.

**Query Parameters — `FinancialDashboardFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| date_range_start | ISO 8601 date | no | Start of date range. Default: current quarter start |
| date_range_end | ISO 8601 date | no | End of date range. Default: today |
| client_id | UUID | no | Filter by client |
| event_id | UUID | no | Filter by specific event |

**Response — `200 OK` — `FinancialDashboardResponse`:**

```
{
  data: {
    kpis: {
      total_revenue: decimal,
      total_costs: decimal,
      gross_margin: decimal,
      gross_margin_pct: decimal,      // percentage
      outstanding_invoices: decimal,
      events_in_range: integer
    },
    revenue_vs_cost_trend: ChartData,
    cost_breakdown_by_category: ChartData,
    profitability_by_event: ChartData,
    top_clients_by_revenue: [
      {
        client_id: UUID,
        client_name: string,
        total_revenue: decimal,
        event_count: integer
      }
    ]
  },
  meta: {
    date_range: { start: ISO 8601 date, end: ISO 8601 date },
    currency: string,
    cached_at: ISO 8601 datetime | null,
    data_freshness: enum: live, cached
  },
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 403 | Insufficient permissions (no financial data access) |

---

## Endpoints — Reports

### GET /api/v1/reports/:type

**Description:** Run a report and return tabular results. The report type determines which data source and default columns are used. Custom filters, grouping, and sorting can be applied via query parameters.

**Auth:** Required. Tenant-scoped. Requires `analytics.reports.read` permission. Data is role-scoped.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| type | enum: costs, utilization, profitability | yes | Report type |

**Query Parameters — `ReportFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| date_range_start | ISO 8601 date | no | Start of date range |
| date_range_end | ISO 8601 date | no | End of date range |
| event_id | UUID | no | Filter by event |
| client_id | UUID | no | Filter by client |
| department_id | UUID | no | Filter by department |
| personnel_id | UUID | no | Filter by person (utilization report) |
| group_by | string (csv) | no | Grouping dimensions (e.g., `event,department`, `month,client`) |
| sort_by | string | no | Column to sort by |
| sort_order | enum: asc, desc | no | Default: `desc` |
| cursor | string (opaque) | no | Cursor for next page |
| limit | integer (1–100) | no | Default: `25` |

**Response — `200 OK` — `ReportResponse`:**

```
{
  data: {
    columns: [
      {
        key: string,
        label: string,
        type: enum: string, number, date, currency, percentage
      }
    ],
    rows: object[],                   // array of row objects keyed by column key
    summary: object | null            // totals row (e.g., total cost, average utilization)
  },
  meta: {
    report_type: string,
    date_range: { start: ISO 8601 date, end: ISO 8601 date },
    cursor: string | null,
    has_more: boolean,
    total_count: integer,
    query_time_ms: integer
  },
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Invalid report type, invalid filter parameters |
| 403 | Insufficient permissions or data scope |

---

### GET /api/v1/reports/:type/export

**Description:** Export a report as CSV or PDF. For small datasets (< 5,000 rows), returns the file synchronously. For large datasets, returns `202 Accepted` with a job ID — the file URL is delivered via the `analytics.export.ready` event.

**Auth:** Required. Tenant-scoped. Requires `analytics.reports.export` permission.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| type | enum: costs, utilization, profitability | yes | Report type |

**Query Parameters — `ReportExportParams`:**

| Param | Type | Required | Description |
|---|---|---|---|
| format | enum: csv, pdf | yes | Export format |
| date_range_start | ISO 8601 date | no | Start of date range |
| date_range_end | ISO 8601 date | no | End of date range |
| event_id | UUID | no | Filter by event |
| client_id | UUID | no | Filter by client |
| department_id | UUID | no | Filter by department |
| group_by | string (csv) | no | Grouping dimensions |

**Response — `200 OK` (synchronous, small dataset):**

File download with appropriate `Content-Type` and `Content-Disposition` headers.

**Response — `202 Accepted` (async, large dataset):**

```
{
  data: {
    job_id: UUID,
    status: "processing",
    estimated_completion_seconds: integer | null
  },
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Invalid format or filter parameters |
| 403 | Insufficient permissions (requires `analytics.reports.export`) |

---

## Endpoints — Saved Reports

### POST /api/v1/saved-reports

**Description:** Save a report configuration for future reuse. Saved reports can be private or shared with the tenant.

**Auth:** Required. Tenant-scoped. Requires `analytics.reports.write` permission.

**Request Body — `CreateSavedReportRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| name | string | yes | Report name (1–100 chars) |
| description | string | no | Report description (max 500 chars) |
| report_type | enum: costs, utilization, profitability | yes | Base report type |
| config | ReportConfig | yes | Full report configuration (filters, grouping, columns, sorting) |
| is_shared | boolean | no | Share with all tenant users. Default: `false` |

**Response — `201 Created`:**

```
{
  data: SavedReportResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure (missing name, invalid config) |
| 403 | Insufficient permissions |

---

### GET /api/v1/saved-reports

**Description:** List saved reports. Returns the user's own reports plus shared reports from other users.

**Auth:** Required. Tenant-scoped. Requires `analytics.reports.read` permission.

**Query Parameters — `SavedReportFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| report_type | enum: costs, utilization, profitability | no | Filter by report type |
| owned_only | boolean | no | Only show user's own reports. Default: `false` |
| cursor | string (opaque) | no | Cursor for next page |
| limit | integer (1–100) | no | Default: `25` |

**Response — `200 OK` — `SavedReportListResponse`:**

```
{
  data: SavedReportResponse[],
  meta: {
    cursor: string | null,
    has_more: boolean,
    total_count: integer
  },
  errors: null
}
```

---

## Type Definitions

### ChartData

Standard chart data structure returned by dashboard endpoints.

| Field | Type | Description |
|---|---|---|
| labels | string[] | Category or time bucket labels |
| datasets | ChartDataset[] | One dataset per series |

### ChartDataset

| Field | Type | Description |
|---|---|---|
| label | string | Series name |
| data | number[] | Numeric values matching labels array |
| color | string | null | Hex color code for rendering |

### ReportConfig

Saved report configuration object.

| Field | Type | Description |
|---|---|---|
| date_range_start | ISO 8601 date | null | Fixed start date (null = relative) |
| date_range_end | ISO 8601 date | null | Fixed end date (null = relative) |
| relative_range | string | null | Relative range (e.g., `last_30_days`, `this_quarter`, `this_year`) |
| filters | object | Key-value filter map matching report query parameters |
| group_by | string[] | Grouping dimensions |
| columns | string[] | null | Selected columns (null = all defaults) |
| sort_by | string | null | Sort column |
| sort_order | enum: asc, desc | null | Sort direction |

### SavedReportResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Saved report ID |
| name | string | Report name |
| description | string | null | Report description |
| report_type | string | Base report type |
| config | ReportConfig | Full report configuration |
| is_shared | boolean | Whether shared with tenant |
| created_by | UUID | User who created the report |
| created_by_name | string | Denormalized creator name |
| created_at | ISO 8601 datetime | Creation timestamp |
| updated_at | ISO 8601 datetime | Last update timestamp |

---

## Internal Interface

The Analytics module does **not** expose internal interfaces. It is a read-only consumer — other modules do not depend on or call into analytics. Data flows one direction: from source modules into analytics for aggregation and display.

---

## Domain Events

The Analytics module does **not** publish domain events to the shared event bus. It is a pure consumer of events from all other modules (for cache invalidation, materialized view refresh, and live dashboard updates).

**Consumed events (for reference):** All entity CRUD events from events, personnel, scheduling, financial, travel, trucks, and documents modules.
