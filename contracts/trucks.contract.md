# Trucks Module — Interface Contract

> **Version:** 1.1.0
> **Base Path:** `/api/v1/trucks`, `/api/v1/truck-routes`
> **Owner:** Trucks Module
> **Last Updated:** 2026-03-20

---

## Table of Contents

- [Response Envelope](#response-envelope)
- [Endpoints — Trucks](#endpoints--trucks)
- [Endpoints — Truck Assignments](#endpoints--truck-assignments)
- [Endpoints — Availability](#endpoints--availability)
- [Endpoints — Routes](#endpoints--routes)
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

## Endpoints — Trucks

### POST /api/v1/trucks

**Description:** Register a new truck in the fleet.

**Auth:** Required. Tenant-scoped. Requires `trucks:create` permission.

**Request Body — `CreateTruckRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| name | string | yes | Truck name/identifier (1–100 chars, unique within tenant) |
| type | enum: box_truck, semi_trailer, sprinter_van, flatbed, refrigerated, other | yes | Truck type |
| license_plate | string | no | License plate number |
| vin | string | no | Vehicle identification number |
| capacity_cubic_ft | decimal | no | Cargo capacity in cubic feet |
| capacity_lbs | decimal | no | Weight capacity in pounds |
| home_base | string | no | Home base: free text — e.g. venue name, warehouse, street address, or GPS (`lat,lng`) |
| status | enum: available, in_use, maintenance, retired | no | Default: `available` |
| daily_rate | decimal | no | Internal daily rate for cost tracking |
| mileage_rate | decimal | no | Rate per mile for cost tracking |
| current_mileage | integer | no | Current odometer reading |
| insurance_expiry | ISO 8601 date | no | Insurance expiration date |
| inspection_expiry | ISO 8601 date | no | Inspection expiration date |
| notes | string | no | Notes |
| metadata | object | no | Key-value custom fields |

**Response — `201 Created`:**

```
{
  data: TruckResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure |
| 409 | Name or license plate already exists within tenant |

---

### GET /api/v1/trucks

**Description:** List trucks with filtering and cursor-based pagination.

**Auth:** Required. Tenant-scoped.

**Query Parameters — `TruckFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| type | enum (csv) | no | Filter by truck type |
| status | enum (csv) | no | Filter: `available,in_use,maintenance,retired` |
| home_base | string | no | Filter by home base (partial match) |
| min_capacity_cubic_ft | decimal | no | Minimum cubic ft capacity |
| min_capacity_lbs | decimal | no | Minimum weight capacity |
| search | string | no | Search across name, license plate, home base |
| sort_by | enum: name, type, status, capacity_cubic_ft, created_at | no | Default: `name` |
| sort_order | enum: asc, desc | no | Default: `asc` |
| cursor | string (opaque) | no | Cursor for next page |
| limit | integer (1–100) | no | Default: `25` |

**Response — `200 OK` — `TruckListResponse`:**

```
{
  data: TruckResponse[],
  meta: {
    cursor: string | null,
    has_more: boolean,
    total_count: integer
  },
  errors: null
}
```

---

### GET /api/v1/trucks/:id

**Description:** Retrieve a single truck.

**Auth:** Required. Tenant-scoped.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Truck ID |

**Response — `200 OK`:**

```
{
  data: TruckResponse,
  meta: null,
  errors: null
}
```

---

### PUT /api/v1/trucks/:id

**Description:** Update a truck record. Partial updates supported.

**Auth:** Required. Tenant-scoped. Requires `trucks:update` permission.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Truck ID |

**Request Body — `UpdateTruckRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| name | string | no | Truck name |
| type | enum | no | Truck type |
| license_plate | string | no | License plate |
| vin | string | no | VIN |
| capacity_cubic_ft | decimal | no | Cubic ft capacity |
| capacity_lbs | decimal | no | Weight capacity |
| home_base | string | no | Home base (venue, warehouse, address, or GPS as free text) |
| status | enum | no | Status |
| daily_rate | decimal | no | Daily rate |
| mileage_rate | decimal | no | Mileage rate |
| current_mileage | integer | no | Current mileage |
| insurance_expiry | ISO 8601 date | no | Insurance expiry |
| inspection_expiry | ISO 8601 date | no | Inspection expiry |
| notes | string | no | Notes |
| metadata | object | no | Merged with existing metadata |

**Response — `200 OK`:**

```
{
  data: TruckResponse,
  meta: null,
  errors: null
}
```

---

### DELETE /api/v1/trucks/:id

**Description:** Retire a truck. Sets status to `retired`. Does NOT hard-delete to preserve assignment history.

**Auth:** Required. Tenant-scoped. Requires `trucks:delete` permission.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Truck ID |

**Response — `200 OK`:**

```
{
  data: { id: UUID, status: "retired", retired_at: ISO 8601 datetime },
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 409 | Truck has active future assignments (must unassign first) |

---

## Endpoints — Truck Assignments

Truck assignments are managed through the Scheduling module (`/api/v1/assignments/truck`). The Trucks module provides the following supplemental endpoints.

### POST /api/v1/trucks/:id/assignments

**Description:** Create a truck assignment. Delegates to the Scheduling module internally but provides a truck-centric entry point.

**Auth:** Required. Tenant-scoped. Requires `trucks:assign` permission.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Truck ID |

**Request Body — `CreateTruckAssignmentRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| event_id | UUID | yes | Target event |
| purpose | string | no | Purpose description |
| start_date | ISO 8601 date | yes | Start date |
| end_date | ISO 8601 date | yes | End date |
| driver_id | UUID | no | Assigned driver |
| notes | string | no | Notes |
| status | enum: tentative, confirmed | no | Default: `tentative` |

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

### GET /api/v1/trucks/:id/assignments

**Description:** List all assignments for a specific truck.

**Auth:** Required. Tenant-scoped.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Truck ID |

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| date_range_start | ISO 8601 date | no | Assignments on or after |
| date_range_end | ISO 8601 date | no | Assignments on or before |
| status | enum (csv) | no | Filter by status |
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

## Endpoints — Availability

### GET /api/v1/trucks/:id/availability

**Description:** Check a truck's availability over a date range.

**Auth:** Required. Tenant-scoped.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Truck ID |

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| start | ISO 8601 date | yes | Range start (inclusive) |
| end | ISO 8601 date | yes | Range end (inclusive) |

**Response — `200 OK` — `TruckAvailabilityResponse`:**

```
{
  data: {
    truck_id: UUID,
    truck_name: string,
    status: string,
    range: { start: ISO 8601 date, end: ISO 8601 date },
    days: [
      {
        date: ISO 8601 date,
        available: boolean,
        assignment: {
          assignment_id: UUID,
          event_id: UUID,
          event_name: string,
          purpose: string | null,
          status: string
        } | null
      }
    ],
    summary: {
      total_days: integer,
      available_days: integer,
      assigned_days: integer
    }
  },
  meta: null,
  errors: null
}
```

---

## Endpoints — Routes

### RouteLocationRef

Structured endpoint/waypoint location. Server resolves `origin` / `destination` / `location` display strings from refs when provided.

| Variant | Fields |
|---------|--------|
| `address` | `kind: "address"`, `text` (string) |
| `coordinates` | `kind: "coordinates"`, `latitude`, `longitude`, optional `label` |
| `venue` | `kind: "venue"`, `venue_id` (UUID) |
| `contact` | `kind: "contact"`, `contact_id` (UUID), optional `use: "primary" \| "custom"`, optional `custom_address` |

---

### GET /api/v1/truck-routes

**Description:** List truck routes for the tenant with filters and cursor pagination.

**Auth:** Required. Tenant-scoped.

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| event_id | UUID | no | Filter by event |
| truck_id | UUID | no | Filter by truck |
| date_range_start | ISO 8601 date | no | Departure on or after (UTC date) |
| date_range_end | ISO 8601 date | no | Departure on or before (UTC date) |
| cursor | string (opaque) | no | Pagination cursor |
| limit | integer (1–100) | no | Default: `25` |

**Response — `200 OK`:**

```
{
  data: TruckRouteResponse[],
  meta: {
    cursor: string | null,
    has_more: boolean,
    total_count: integer
  },
  errors: null
}
```

---

### GET /api/v1/truck-routes/:eventId

**Description:** Retrieve truck routes for an event. A route represents the planned movement of a truck between structured or free-text locations.

**Auth:** Required. Tenant-scoped.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| eventId | UUID | yes | Event ID |

**Response — `200 OK` — `EventTruckRoutesResponse`:**

```
{
  data: {
    event_id: UUID,
    event_name: string,
    routes: TruckRouteResponse[]
  },
  meta: {
    total_routes: integer,
    total_distance_miles: decimal | null,
    total_estimated_cost: decimal | null,
    currency: string
  },
  errors: null
}
```

---

### POST /api/v1/truck-routes

**Description:** Create a truck route for an event.

**Auth:** Required. Tenant-scoped. Requires `trucks:route` permission.

**Request Body — `CreateTruckRouteRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| event_id | UUID | yes | Associated event |
| truck_id | UUID | yes | Assigned truck |
| assignment_id | UUID | no | Link to truck assignment |
| driver_id | UUID | no | Assigned driver |
| origin | string | conditional | Plain-text origin (required if `origin_ref` omitted) |
| destination | string | conditional | Plain-text destination (required if `destination_ref` omitted; may mirror origin for single-stop) |
| origin_ref | RouteLocationRef | no | Structured origin |
| destination_ref | RouteLocationRef | no | Structured destination |
| waypoints | RouteWaypoint[] | no | Intermediate stops |
| departure_datetime | ISO 8601 datetime | yes | Planned departure |
| estimated_arrival | ISO 8601 datetime | yes | Estimated arrival |
| distance_miles | decimal | no | Estimated distance |
| estimated_fuel_cost | decimal | no | Estimated fuel cost |
| cargo_description | string | no | Description of cargo |
| notes | string | no | Route notes |
| metadata | object | no | Includes optional `route_pattern: "single_stop"` |
| status | enum: planned, in_transit, completed, cancelled | no | Default: `planned` |

**RouteWaypoint:**

| Field | Type | Required | Description |
|---|---|---|---|
| location | string | conditional | Label (required if `location_ref` omitted) |
| location_ref | RouteLocationRef | no | Structured stop |
| purpose | string | no | Reason for stop |
| estimated_arrival | ISO 8601 datetime | no | Estimated arrival at waypoint |
| estimated_departure | ISO 8601 datetime | no | Estimated departure from waypoint |
| order | integer | yes | Waypoint order (1-based) |

**Response — `201 Created`:**

```
{
  data: TruckRouteResponse,
  meta: null,
  errors: null
}
```

---

### PUT /api/v1/truck-routes/:id

**Description:** Update a truck route.

**Auth:** Required. Tenant-scoped. Requires `trucks:route` permission.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Route ID |

**Request Body — `UpdateTruckRouteRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| driver_id | UUID | no | Driver (set `null` to clear) |
| origin | string | no | Origin |
| destination | string | no | Destination |
| origin_ref | RouteLocationRef | no | Structured origin (replaces stored ref) |
| destination_ref | RouteLocationRef | no | Structured destination |
| waypoints | RouteWaypoint[] | no | Waypoints (replaces existing) |
| departure_datetime | ISO 8601 datetime | no | Departure |
| estimated_arrival | ISO 8601 datetime | no | Estimated arrival |
| actual_arrival | ISO 8601 datetime | no | Actual arrival (for completed routes) |
| distance_miles | decimal | no | Distance |
| actual_distance_miles | decimal | no | Actual distance traveled |
| estimated_fuel_cost | decimal | no | Estimated fuel cost |
| actual_fuel_cost | decimal | no | Actual fuel cost |
| cargo_description | string | no | Cargo description |
| notes | string | no | Notes |
| metadata | object | no | Merged with existing metadata |
| status | enum: planned, in_transit, completed, cancelled | no | Status |

**Response — `200 OK`:**

```
{
  data: TruckRouteResponse,
  meta: null,
  errors: null
}
```

---

### POST /api/v1/truck-routes/:id/compute-route

**Description:** Compute distance, duration, and route geometry using the configured directions provider (or haversine fallback). Updates `distance_miles`, `estimated_arrival` from `departure_datetime` + duration when applicable, `route_geometry`, `traffic_aware`, and `provider_computed_at`.

**Auth:** Required. Tenant-scoped. Requires `trucks:route` permission.

**Response — `200 OK`:** `{ data: TruckRouteResponse, meta: null, errors: null }`

---

### POST /api/v1/truck-routes/:id/share

**Description:** Mint a driver share token and expiry. Returns a public URL path for read-only route viewing.

**Auth:** Required. Tenant-scoped. Requires `trucks:route` permission.

**Request Body:** optional `{ "ttl_hours": integer }` (default 72, max 168).

**Response — `200 OK`:**

```
{
  data: {
    share_url: string,
    expires_at: ISO 8601 datetime
  },
  meta: null,
  errors: null
}
```

---

### POST /api/v1/truck-routes/:id/refresh-eta

**Description:** Recompute traffic-aware ETA (same as compute-route) for in-flight monitoring. May emit notifications when delay exceeds tenant policy.

**Auth:** Required. Tenant-scoped. Requires `trucks:route` permission.

**Response — `200 OK`:** `{ data: TruckRouteResponse, meta: null, errors: null }`

---

### GET /api/v1/truck-routes/public/:token

**Description:** Read-only route details for drivers (no tenant headers; token authenticates). Does not require `trucks:route`.

**Response — `200 OK`:** `{ data: TruckRoutePublicResponse, meta: null, errors: null }`  
**404** if token invalid or expired.

---

## Type Definitions

### TruckResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Truck ID |
| name | string | Truck name/identifier |
| type | enum: box_truck, semi_trailer, sprinter_van, flatbed, refrigerated, other | Truck type |
| license_plate | string | null | License plate |
| vin | string | null | Vehicle identification number |
| capacity_cubic_ft | decimal | null | Cargo capacity (cubic feet) |
| capacity_lbs | decimal | null | Weight capacity (pounds) |
| home_base | string | null | Home base (venue, warehouse, address, or GPS as free text) |
| status | enum: available, in_use, maintenance, retired | Current status |
| daily_rate | decimal | null | Daily rate for cost tracking |
| mileage_rate | decimal | null | Per-mile rate |
| current_mileage | integer | null | Odometer reading |
| insurance_expiry | ISO 8601 date | null | Insurance expiration |
| inspection_expiry | ISO 8601 date | null | Inspection expiration |
| notes | string | null | Notes |
| metadata | object | Custom fields |
| created_at | ISO 8601 datetime | Creation timestamp |
| updated_at | ISO 8601 datetime | Last update timestamp |
| retired_at | ISO 8601 datetime | null | Retirement timestamp |

### TruckAssignmentResponse

Defined in the Scheduling module contract. See `scheduling/contract.md → TruckAssignmentResponse`.

| Field | Type | Description |
|---|---|---|
| id | UUID | Assignment ID |
| event_id | UUID | Event reference |
| event_name | string | Denormalized event name |
| truck_id | UUID | Truck reference |
| truck_name | string | Denormalized truck name |
| purpose | string | null | Purpose |
| start_date | ISO 8601 date | Start date |
| end_date | ISO 8601 date | End date |
| driver_id | UUID | null | Assigned driver |
| driver_name | string | null | Driver name |
| total_days | integer | Total assignment days |
| notes | string | null | Notes |
| status | enum: tentative, confirmed, cancelled | Status |
| has_conflicts | boolean | Whether conflicts exist |
| created_at | ISO 8601 datetime | Creation timestamp |
| updated_at | ISO 8601 datetime | Last update timestamp |

### ConflictSummary

Defined in the Scheduling module contract. See `scheduling/contract.md → ConflictSummary`.

### TruckRouteResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Route ID |
| event_id | UUID | Associated event |
| event_name | string | Denormalized event name |
| truck_id | UUID | Assigned truck |
| truck_name | string | Denormalized truck name |
| assignment_id | UUID | null | Linked truck assignment |
| driver_id | UUID | null | Assigned driver |
| driver_name | string | null | Driver name |
| origin | string | Origin location (denormalized label) |
| destination | string | Destination location (denormalized label) |
| origin_ref | object | Structured origin (`RouteLocationRef` or empty object) |
| destination_ref | object | Structured destination (`RouteLocationRef` or empty object) |
| waypoints | RouteWaypointResponse[] | Intermediate stops |
| departure_datetime | ISO 8601 datetime | Planned departure |
| estimated_arrival | ISO 8601 datetime | Estimated arrival |
| actual_arrival | ISO 8601 datetime | null | Actual arrival |
| distance_miles | decimal | null | Estimated distance |
| actual_distance_miles | decimal | null | Actual distance |
| estimated_fuel_cost | decimal | null | Estimated fuel cost |
| actual_fuel_cost | decimal | null | Actual fuel cost |
| cargo_description | string | null | Cargo description |
| notes | string | null | Notes |
| metadata | object | Custom fields; may include `route_versions` history |
| route_geometry | object | null | `{ encoded_polyline?, geojson?, provider?, computed_at?, legs?, traffic_aware? }` |
| traffic_aware | boolean | Whether last compute used traffic (provider-dependent) |
| provider_computed_at | ISO 8601 datetime | null | Last directions compute |
| driver_share_url | string | null | Absolute or path URL when share active |
| driver_share_expires_at | ISO 8601 datetime | null | Share expiry |
| schedule_conflict_hint | string | null | Optional warning (e.g. ETA vs load-in window) |
| status | enum: planned, in_transit, completed, cancelled | Route status |
| created_at | ISO 8601 datetime | Creation timestamp |
| updated_at | ISO 8601 datetime | Last update timestamp |

### RouteWaypointResponse

| Field | Type | Description |
|---|---|---|
| location | string | Waypoint location label |
| location_ref | object | Structured ref (`RouteLocationRef` or empty) |
| purpose | string | null | Stop purpose |
| estimated_arrival | ISO 8601 datetime | null | Estimated arrival |
| estimated_departure | ISO 8601 datetime | null | Estimated departure |
| actual_arrival | ISO 8601 datetime | null | Actual arrival |
| actual_departure | ISO 8601 datetime | null | Actual departure |
| order | integer | Waypoint order |

### TruckRoutePublicResponse

Subset for driver share: `id`, `event_name`, `truck_name`, `origin`, `destination`, `waypoints`, `departure_datetime`, `estimated_arrival`, `route_geometry`, `status`, `driver_share_expires_at`.

---

## Internal Interface

These functions are callable by other modules via internal service calls. They are NOT exposed as HTTP endpoints.

### getTruckById

**Description:** Retrieve a single truck by ID. Returns `null` if not found or retired.

```
getTruckById(
  truck_id: UUID,
  tenant_id: UUID,
  options?: {
    include_retired?: boolean       // default: false
  }
) → TruckResponse | null
```

---

### getAvailableTrucks

**Description:** Retrieve trucks available for a given date range. Excludes trucks with conflicting assignments, in maintenance, or retired.

```
getAvailableTrucks(
  tenant_id: UUID,
  start_date: ISO 8601 date,
  end_date: ISO 8601 date,
  options?: {
    type?: enum[],                  // filter by truck type
    min_capacity_cubic_ft?: decimal,
    min_capacity_lbs?: decimal,
    home_base?: string
  }
) → TruckResponse[]
```

---

### getTruckAssignmentsByEvent

**Description:** Retrieve all truck assignments for a given event. Delegates to the Scheduling module's `getAssignmentsByTruck` but filtered by event.

```
getTruckAssignmentsByEvent(
  event_id: UUID,
  tenant_id: UUID,
  options?: {
    status?: enum[],
    include_cancelled?: boolean     // default: false
  }
) → TruckAssignmentResponse[]
```

---

## Domain Events

All domain events are published to the internal event bus. Consumers must be idempotent.

### truck.assigned

**Trigger:** A truck is assigned to an event (via Trucks module or Scheduling module).

**Payload — `TruckAssignedPayload`:**

| Field | Type | Description |
|---|---|---|
| assignment_id | UUID | Assignment ID |
| tenant_id | UUID | Tenant scope |
| truck_id | UUID | Truck ID |
| truck_name | string | Truck name |
| event_id | UUID | Event reference |
| event_name | string | Event name |
| start_date | ISO 8601 date | Start date |
| end_date | ISO 8601 date | End date |
| driver_id | UUID | null | Assigned driver |
| purpose | string | null | Assignment purpose |
| assigned_by | UUID | User who assigned |
| assigned_at | ISO 8601 datetime | Timestamp |

---

### truck.unassigned

**Trigger:** A truck assignment is deleted or cancelled.

**Payload — `TruckUnassignedPayload`:**

| Field | Type | Description |
|---|---|---|
| assignment_id | UUID | Assignment ID |
| tenant_id | UUID | Tenant scope |
| truck_id | UUID | Truck ID |
| truck_name | string | Truck name |
| event_id | UUID | Event reference |
| start_date | ISO 8601 date | Original start date |
| end_date | ISO 8601 date | Original end date |
| reason | enum: deleted, cancelled | Unassignment reason |
| unassigned_by | UUID | User who unassigned |
| unassigned_at | ISO 8601 datetime | Timestamp |

---

### route.created

**Trigger:** A truck route is created.

**Payload — `RouteCreatedPayload`:**

| Field | Type | Description |
|---|---|---|
| route_id | UUID | Route ID |
| tenant_id | UUID | Tenant scope |
| event_id | UUID | Associated event |
| truck_id | UUID | Assigned truck |
| driver_id | UUID | null | Assigned driver |
| origin | string | Origin |
| destination | string | Destination |
| departure_datetime | ISO 8601 datetime | Departure |
| distance_miles | decimal | null | Estimated distance |
| estimated_fuel_cost | decimal | null | Estimated fuel cost |
| waypoint_count | integer | Number of waypoints |
| created_by | UUID | User who created |
| created_at | ISO 8601 datetime | Timestamp |

---

### route.updated

**Trigger:** A truck route is updated (including status changes like in_transit → completed).

**Payload — `RouteUpdatedPayload`:**

| Field | Type | Description |
|---|---|---|
| route_id | UUID | Route ID |
| tenant_id | UUID | Tenant scope |
| event_id | UUID | Associated event |
| truck_id | UUID | Assigned truck |
| changed_fields | string[] | Fields that changed |
| previous_values | object | Map of field → old value |
| new_values | object | Map of field → new value |
| previous_status | string | null | Previous status (if status changed) |
| new_status | string | null | New status (if status changed) |
| updated_by | UUID | User who updated |
| updated_at | ISO 8601 datetime | Timestamp |

---

### route.eta_updated

**Trigger:** Estimated arrival changed (e.g. directions recompute or traffic refresh).

**Payload:** `route_id`, `tenant_id`, `event_id`, `truck_id`, `previous_estimated_arrival`, `new_estimated_arrival`, `source` (e.g. `compute_route` | `refresh_eta`), `updated_at`.

---

### route.delay_threshold_exceeded

**Trigger:** ETA slip exceeds configured threshold (minutes).

**Payload:** `route_id`, `tenant_id`, `event_id`, `truck_id`, `delay_minutes`, `threshold_minutes`, `estimated_arrival`, `detected_at`.
