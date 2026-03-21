# Travel Module — Interface Contract

> **Version:** 1.0.0
> **Base Path:** `/api/v1/travel`
> **Owner:** Travel Module
> **Last Updated:** 2026-02-15

---

## Table of Contents

- [Response Envelope](#response-envelope)
- [Endpoints — Travel Records](#endpoints--travel-records)
- [Endpoints — Event & Personnel Travel Views](#endpoints--event--personnel-travel-views)
- [Endpoints — Rooming](#endpoints--rooming)
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

## Endpoints — Travel Records

### POST /api/v1/travel

**Description:** Create a travel record for personnel associated with an event.

**Auth:** Required. Tenant-scoped. Requires `travel:create` permission.

**Request Body — `CreateTravelRecordRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| event_id | UUID | yes | Associated event |
| personnel_id | UUID | yes | Traveling personnel |
| travel_type | enum: flight, train, bus, car_rental, rideshare, personal_vehicle, other | yes | Mode of transportation |
| direction | enum: outbound, return, inter_venue | yes | Travel direction |
| departure_location | string | yes | Departure city/airport/station |
| arrival_location | string | yes | Arrival city/airport/station |
| departure_datetime | ISO 8601 datetime | yes | Departure date and time |
| arrival_datetime | ISO 8601 datetime | yes | Arrival date and time |
| carrier | string | no | Carrier/airline name |
| booking_reference | string | no | Confirmation/booking number |
| seat_preference | string | no | Seat preference or assignment |
| cost | decimal | no | Travel cost |
| currency | string | no | ISO 4217 currency code. Default: tenant default |
| status | enum: planned, booked, confirmed, cancelled | no | Default: `planned` |
| notes | string | no | Additional notes |
| accommodation | TravelAccommodation | no | Linked accommodation details |
| metadata | object | no | Key-value custom fields |

**TravelAccommodation (inline):**

| Field | Type | Required | Description |
|---|---|---|---|
| hotel_name | string | yes | Hotel/accommodation name |
| address | string | no | Full address |
| check_in_date | ISO 8601 date | yes | Check-in date |
| check_out_date | ISO 8601 date | yes | Check-out date |
| room_type | string | no | Room type (e.g., "Single", "Double", "Suite") |
| confirmation_number | string | no | Hotel booking confirmation |
| nightly_rate | decimal | no | Rate per night |
| total_cost | decimal | no | Total accommodation cost |
| sharing_with | UUID | no | Personnel ID of room share partner |
| notes | string | no | Accommodation notes |

**Response — `201 Created`:**

```
{
  data: TravelRecordResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure (invalid dates, personnel not assigned to event) |
| 404 | Event or personnel not found |

---

### GET /api/v1/travel

**Description:** List travel records with filtering and cursor-based pagination.

**Auth:** Required. Tenant-scoped.

**Query Parameters — `TravelRecordFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| event_id | UUID | no | Filter by event |
| personnel_id | UUID | no | Filter by personnel |
| travel_type | enum (csv) | no | Filter by travel type |
| direction | enum (csv) | no | Filter by direction |
| status | enum (csv) | no | Filter: `planned,booked,confirmed,cancelled` |
| date_range_start | ISO 8601 date | no | Travel on or after |
| date_range_end | ISO 8601 date | no | Travel on or before |
| has_accommodation | boolean | no | Filter by whether accommodation is included |
| search | string | no | Search across locations, carrier, booking reference |
| sort_by | enum: departure_datetime, personnel_name, created_at | no | Default: `departure_datetime` |
| sort_order | enum: asc, desc | no | Default: `asc` |
| cursor | string (opaque) | no | Cursor for next page |
| limit | integer (1–100) | no | Default: `25` |

**Response — `200 OK`:**

```
{
  data: TravelRecordResponse[],
  meta: {
    cursor: string | null,
    has_more: boolean,
    total_count: integer
  },
  errors: null
}
```

---

### GET /api/v1/travel/:id

**Description:** Retrieve a single travel record.

**Auth:** Required. Tenant-scoped.

**Response — `200 OK`:**

```
{
  data: TravelRecordResponse,
  meta: null,
  errors: null
}
```

---

### PUT /api/v1/travel/:id

**Description:** Update a travel record. Partial updates supported.

**Auth:** Required. Tenant-scoped. Requires `travel:update` permission.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Travel record ID |

**Request Body — `UpdateTravelRecordRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| travel_type | enum | no | Travel type |
| direction | enum | no | Direction |
| departure_location | string | no | Departure location |
| arrival_location | string | no | Arrival location |
| departure_datetime | ISO 8601 datetime | no | Departure date/time |
| arrival_datetime | ISO 8601 datetime | no | Arrival date/time |
| carrier | string | no | Carrier name |
| booking_reference | string | no | Booking reference |
| seat_preference | string | no | Seat preference |
| cost | decimal | no | Cost |
| currency | string | no | Currency |
| status | enum | no | Status |
| notes | string | no | Notes |
| accommodation | TravelAccommodation | no | Accommodation (replaces existing) |
| metadata | object | no | Merged with existing metadata |

**Response — `200 OK`:**

```
{
  data: TravelRecordResponse,
  meta: null,
  errors: null
}
```

---

### DELETE /api/v1/travel/:id

**Description:** Delete a travel record.

**Auth:** Required. Tenant-scoped. Requires `travel:delete` permission.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Travel record ID |

**Response — `200 OK`:**

```
{
  data: { id: UUID, deleted_at: ISO 8601 datetime },
  meta: null,
  errors: null
}
```

---

## Endpoints — Event & Personnel Travel Views

### GET /api/v1/events/:id/travel

**Description:** Retrieve all travel records for a specific event, grouped by personnel. Provides a consolidated travel manifest view.

**Auth:** Required. Tenant-scoped.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Event ID |

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| direction | enum: outbound, return, inter_venue | no | Filter by direction |
| status | enum (csv) | no | Filter by status |
| sort_by | enum: departure_datetime, personnel_name | no | Default: `departure_datetime` |

**Response — `200 OK` — `EventTravelResponse`:**

```
{
  data: {
    event_id: UUID,
    event_name: string,
    personnel_travel: [
      {
        personnel_id: UUID,
        personnel_name: string,
        records: TravelRecordResponse[]
      }
    ]
  },
  meta: {
    total_records: integer,
    total_personnel: integer,
    total_travel_cost: decimal,
    total_accommodation_cost: decimal,
    currency: string
  },
  errors: null
}
```

---

### GET /api/v1/personnel/:id/travel

**Description:** Retrieve all travel records for a specific person across events.

**Auth:** Required. Tenant-scoped.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Personnel ID |

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| date_range_start | ISO 8601 date | no | Travel on or after |
| date_range_end | ISO 8601 date | no | Travel on or before |
| event_id | UUID | no | Limit to a specific event |
| status | enum (csv) | no | Filter by status |
| cursor | string (opaque) | no | Cursor for next page |
| limit | integer (1–100) | no | Default: `25` |

**Response — `200 OK`:**

```
{
  data: TravelRecordResponse[],
  meta: {
    cursor: string | null,
    has_more: boolean,
    total_count: integer,
    total_cost: decimal,
    currency: string
  },
  errors: null
}
```

---

## Endpoints — Rooming

### GET /api/v1/events/:id/rooming

**Description:** Retrieve the rooming list for an event. Aggregates accommodation data from all travel records into a unified rooming view.

**Auth:** Required. Tenant-scoped.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Event ID |

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| date | ISO 8601 date | no | Show rooming for a specific night |
| hotel_name | string | no | Filter by hotel |

**Response — `200 OK` — `RoomingListResponse`:**

```
{
  data: {
    event_id: UUID,
    event_name: string,
    hotels: [
      {
        hotel_name: string,
        address: string | null,
        rooms: [
          {
            room_type: string | null,
            confirmation_number: string | null,
            check_in_date: ISO 8601 date,
            check_out_date: ISO 8601 date,
            nightly_rate: decimal | null,
            guests: [
              {
                personnel_id: UUID,
                personnel_name: string,
                travel_record_id: UUID
              }
            ]
          }
        ],
        total_rooms: integer,
        total_room_nights: integer,
        total_cost: decimal | null
      }
    ]
  },
  meta: {
    total_hotels: integer,
    total_rooms: integer,
    total_guests: integer,
    total_room_nights: integer,
    total_accommodation_cost: decimal,
    currency: string
  },
  errors: null
}
```

---

## Type Definitions

### TravelRecordResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Travel record ID |
| event_id | UUID | Associated event |
| event_name | string | Denormalized event name |
| personnel_id | UUID | Traveling personnel |
| personnel_name | string | Denormalized personnel full name |
| travel_type | enum: flight, train, bus, car_rental, rideshare, personal_vehicle, other | Travel type |
| direction | enum: outbound, return, inter_venue | Travel direction |
| departure_location | string | Departure location |
| arrival_location | string | Arrival location |
| departure_datetime | ISO 8601 datetime | Departure date/time |
| arrival_datetime | ISO 8601 datetime | Arrival date/time |
| carrier | string | null | Carrier name |
| booking_reference | string | null | Booking reference |
| seat_preference | string | null | Seat preference |
| cost | decimal | null | Travel cost |
| currency | string | Currency code |
| status | enum: planned, booked, confirmed, cancelled | Travel status |
| notes | string | null | Notes |
| accommodation | TravelAccommodationResponse | null | Accommodation details |
| metadata | object | Custom fields |
| created_at | ISO 8601 datetime | Creation timestamp |
| updated_at | ISO 8601 datetime | Last update timestamp |

### TravelAccommodationResponse

| Field | Type | Description |
|---|---|---|
| hotel_name | string | Hotel/accommodation name |
| address | string | null | Full address |
| check_in_date | ISO 8601 date | Check-in date |
| check_out_date | ISO 8601 date | Check-out date |
| room_type | string | null | Room type |
| confirmation_number | string | null | Hotel confirmation |
| nightly_rate | decimal | null | Rate per night |
| total_nights | integer | Calculated number of nights |
| total_cost | decimal | null | Total accommodation cost |
| sharing_with | UUID | null | Room share partner personnel ID |
| sharing_with_name | string | null | Room share partner name |
| notes | string | null | Notes |

---

## Internal Interface

These functions are callable by other modules via internal service calls. They are NOT exposed as HTTP endpoints.

### getTravelByEvent

**Description:** Retrieve all travel records for a given event.

```
getTravelByEvent(
  event_id: UUID,
  tenant_id: UUID,
  options?: {
    direction?: enum: outbound, return, inter_venue,
    status?: enum[],
    include_cancelled?: boolean     // default: false
  }
) → TravelRecordResponse[]
```

---

### getTravelByPersonnel

**Description:** Retrieve all travel records for a given person.

```
getTravelByPersonnel(
  personnel_id: UUID,
  tenant_id: UUID,
  options?: {
    date_range_start?: ISO 8601 date,
    date_range_end?: ISO 8601 date,
    event_id?: UUID,
    include_cancelled?: boolean
  }
) → TravelRecordResponse[]
```

---

### getTravelCosts

**Description:** Calculate total travel and accommodation costs for an event. Used by the Financial module for cost aggregation.

```
getTravelCosts(
  event_id: UUID,
  tenant_id: UUID,
  options?: {
    include_cancelled?: boolean,    // default: false
    status?: enum[]                 // filter by record status
  }
) → {
  event_id: UUID,
  currency: string,
  travel_cost: decimal,
  accommodation_cost: decimal,
  total_cost: decimal,
  breakdown: {
    by_type: [
      { travel_type: string, cost: decimal, count: integer }
    ],
    by_personnel: [
      {
        personnel_id: UUID,
        personnel_name: string,
        travel_cost: decimal,
        accommodation_cost: decimal,
        total: decimal
      }
    ]
  }
}
```

---

### getRoomingList

**Description:** Retrieve the rooming list for an event. Same data as the rooming endpoint, for internal consumption.

```
getRoomingList(
  event_id: UUID,
  tenant_id: UUID,
  options?: {
    date?: ISO 8601 date,
    hotel_name?: string
  }
) → {
  event_id: UUID,
  hotels: [
    {
      hotel_name: string,
      rooms: [
        {
          room_type: string | null,
          check_in_date: ISO 8601 date,
          check_out_date: ISO 8601 date,
          guests: [
            { personnel_id: UUID, personnel_name: string }
          ]
        }
      ],
      total_rooms: integer
    }
  ],
  total_rooms: integer,
  total_guests: integer
}
```

---

## Domain Events

All domain events are published to the internal event bus. Consumers must be idempotent.

### travel.created

**Trigger:** A new travel record is created.

**Payload — `TravelCreatedPayload`:**

| Field | Type | Description |
|---|---|---|
| travel_id | UUID | Created travel record ID |
| tenant_id | UUID | Tenant scope |
| event_id | UUID | Associated event |
| personnel_id | UUID | Traveling personnel |
| travel_type | string | Travel type |
| direction | string | Travel direction |
| departure_location | string | Departure location |
| arrival_location | string | Arrival location |
| departure_datetime | ISO 8601 datetime | Departure date/time |
| cost | decimal | null | Travel cost |
| has_accommodation | boolean | Whether accommodation is included |
| accommodation_cost | decimal | null | Accommodation cost (if included) |
| created_by | UUID | User who created |
| created_at | ISO 8601 datetime | Timestamp |

---

### travel.updated

**Trigger:** A travel record is updated.

**Payload — `TravelUpdatedPayload`:**

| Field | Type | Description |
|---|---|---|
| travel_id | UUID | Updated travel record ID |
| tenant_id | UUID | Tenant scope |
| event_id | UUID | Associated event |
| personnel_id | UUID | Personnel |
| changed_fields | string[] | Fields that changed |
| previous_values | object | Map of field → old value |
| new_values | object | Map of field → new value |
| cost_changed | boolean | Whether cost fields changed |
| updated_by | UUID | User who updated |
| updated_at | ISO 8601 datetime | Timestamp |

---

### travel.deleted

**Trigger:** A travel record is deleted.

**Payload — `TravelDeletedPayload`:**

| Field | Type | Description |
|---|---|---|
| travel_id | UUID | Deleted travel record ID |
| tenant_id | UUID | Tenant scope |
| event_id | UUID | Associated event |
| personnel_id | UUID | Personnel |
| travel_type | string | Travel type |
| cost | decimal | null | Travel cost (for financial recalculation) |
| accommodation_cost | decimal | null | Accommodation cost |
| deleted_by | UUID | User who deleted |
| deleted_at | ISO 8601 datetime | Timestamp |
