# Venues — Interface Contract

> **Version:** 1.0.0  
> **Base Path:** `/api/v1/venues`  
> **Owner:** Events Module  
> **Last Updated:** 2026-03-20

---

## Response Envelope

Same as [events.contract.md](./events.contract.md): `{ data, meta, errors }`.

---

## Endpoints

### POST /api/v1/venues

**Description:** Create a venue.

**Auth:** Required. Tenant-scoped.

**Request Body — `CreateVenueRequest`:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | yes | Venue name (1–255 chars) |
| city | string | no | City |
| address | string | no | Street address |
| latitude | number | no | WGS84 |
| longitude | number | no | WGS84 |
| timezone | string | no | IANA e.g. `America/Chicago` |
| notes | string | no | Max 5000 chars |
| metadata | object | no | |

**Response — `201 Created`:** `{ data: VenueResponse, meta: null, errors: null }`

---

### GET /api/v1/venues

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| search | string | no | `ILIKE` on name, city |
| cursor | string | no | |
| limit | integer | no | Default 25, max 100 |

**Response — `200 OK`:** `{ data: VenueResponse[], meta: { cursor, has_more, total_count }, errors: null }`

---

### GET /api/v1/venues/:id

**Response — `200 OK`:** `{ data: VenueResponse, meta: null, errors: null }`  
**404** if missing.

---

### PUT /api/v1/venues/:id

**Request Body — `UpdateVenueRequest`:** optional: `name`, `city`, `address`, `latitude`, `longitude`, `timezone`, `notes`, `metadata` (merged).

**Response — `200 OK`:** `{ data: VenueResponse, meta: null, errors: null }`

---

### DELETE /api/v1/venues/:id

**Description:** Soft-delete. **409** if events still reference this venue.

**Response — `200 OK`:** `{ data: { id, deleted_at }, meta: null, errors: null }`

---

## Type Definitions

### VenueResponse

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| name | string | |
| city | string \| null | |
| address | string \| null | |
| latitude | number \| null | |
| longitude | number \| null | |
| timezone | string \| null | |
| notes | string \| null | |
| metadata | object | |
| created_at | ISO 8601 datetime | |
| updated_at | ISO 8601 datetime | |
| deleted_at | ISO 8601 datetime \| null | |
