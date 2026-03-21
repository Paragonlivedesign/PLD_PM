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

### POST /api/v1/venues/resolve-maps-link

**Description:** Resolve a pasted maps URL (Google, Apple, OpenStreetMap, etc.) to coordinates and an IANA timezone when possible. Used by the venue CRM UI to auto-fill latitude, longitude, and timezone before save.

**Auth:** Required. **`venues:update`** (prevents unauthenticated abuse of geocoding).

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| url | string | yes | HTTP(S) URL from a maps application |

**Response — `200 OK`:** `{ data: ResolveMapsLinkResult, meta: null, errors: null }`

**`ResolveMapsLinkResult`:**

| Field | Type | Description |
|-------|------|-------------|
| latitude | number \| null | WGS84 |
| longitude | number \| null | WGS84 |
| timezone | string \| null | IANA e.g. `America/Chicago` |
| formatted_address | string \| null | Best-effort formatted place |
| partial | boolean | `true` if coordinates could not be fully resolved server-side (client may apply extra parsing) |
| source | string | `google` \| `regex` \| `none` — how coordinates were obtained |

**Behavior:**

- When **`GOOGLE_MAPS_API_KEY`** is set on the server: uses Google Geocoding (including `place_id` when present in the URL) and derives timezone from coordinates (server-side zone lookup).
- When the key is **not** set: attempts **regex / URL parsing** only; often returns `partial: true` with nulls unless the URL embeds coordinates (e.g. `@lat,lng`).

**Errors:** `400` validation, `403` missing `venues:update`.

---

### GET /api/v1/venues/:id/banner-preview

**Description:** Returns a **PNG** image for the venue header when Google Maps is configured: either a **roadmap** overview (`variant=google_map`) or **Street View** (`variant=google_streetview`) when a panorama exists at the venue coordinates. Proxies Google Static Maps / Street View so the API key is not embedded in the SPA.

**Auth:** Required. **`venues:read`**.

**Query:**

| Param | Type | Description |
|-------|------|-------------|
| variant | string | `google_map` (default) \| `google_streetview` |

**Response — `200 OK`:** Raw image body (`Content-Type: image/png`).

**Errors:** `404` venue not found or coordinates missing; `404` or `502` when `GOOGLE_MAPS_API_KEY` is not set or Google returns no image (e.g. no Street View coverage). **`403`** if forbidden.

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

---

### Profile metadata (optional)

`metadata` is merged on `PUT`. For CRM profile UIs, nested keys under **`metadata.profile`** are reserved (optional): `tagline`, `about`, `website`, `social_url`, `avatar_document_id`, `cover_document_id` (document UUIDs per [documents.contract.md](./documents.contract.md)), `cover_banner_mode` (`gradient` \| `map` \| `custom` \| `google_map` \| `google_streetview` — `gradient` default styling; `map` OpenStreetMap snapshot; `custom` uploaded `cover_document_id`; `google_*` use server banner preview when `GOOGLE_MAPS_API_KEY` is configured), and `maps_link` (optional URL — e.g. Google or Apple Maps “place” link, shown alongside auto-generated map shortcuts). Nested CRM contacts under `/api/v1/venues/:venueId/contacts` mirror [clients.contract.md](./clients.contract.md) contact shape and optional contact `metadata` keys.

