# Clients — Interface Contract

> **Version:** 1.0.0  
> **Base Path:** `/api/v1/clients`  
> **Owner:** Events Module (clients are owned alongside events)  
> **Last Updated:** 2026-03-20

---

## Response Envelope

Same as [events.contract.md](./events.contract.md): `{ data, meta, errors }`.

---

## Authorization

| Action | Permission |
|--------|------------|
| List / get | `clients:read` |
| Create | `clients:create` |
| Update | `clients:update` |
| Delete | `clients:delete` |
| Contacts (nested) | Read: `clients:read`, write: `clients:update` |

---

## Endpoints

### POST /api/v1/clients

**Description:** Create a client (organization that hires the tenant).

**Auth:** Required. Tenant-scoped. **`clients:create`**

**Request Body — `CreateClientRequest`:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | yes | Display name (1–255 chars) |
| contact_name | string | no | Primary contact |
| contact_email | string | no | Email |
| phone | string | no | Phone |
| notes | string | no | Internal notes (max 5000 chars) |
| metadata | object | no | Key-value custom fields |

**Response — `201 Created`:** `{ data: ClientResponse, meta: null, errors: null }`

**Errors:** 400 validation, 401, 403

---

### GET /api/v1/clients

**Description:** List clients for the tenant.

**Auth:** **`clients:read`**

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| search | string | no | `ILIKE` on name, contact_name |
| cursor | string | no | Opaque cursor |
| limit | integer | no | Default 25, max 100 |

**Response — `200 OK`:** `{ data: ClientResponse[], meta: { cursor, has_more, total_count }, errors: null }`

---

### GET /api/v1/clients/:id

**Description:** Get one client.

**Auth:** **`clients:read`**

**Response — `200 OK`:** `{ data: ClientResponse, meta: null, errors: null }`  
**404** if not found or wrong tenant.

---

### PUT /api/v1/clients/:id

**Description:** Partial update.

**Auth:** **`clients:update`**

**Request Body — `UpdateClientRequest`:** optional fields: `name`, `contact_name`, `contact_email`, `phone`, `notes`, `metadata` (merged).

**Response — `200 OK`:** `{ data: ClientResponse, meta: null, errors: null }`  
**409** optimistic lock via `updated_at` if implemented.

---

### DELETE /api/v1/clients/:id

**Description:** Soft-delete. **409** if events still reference this client.

**Auth:** **`clients:delete`**

---

### Contacts under a client

Nested base path: **`/api/v1/clients/:clientId/contacts`**

Same CRUD shape as vendor/venue contacts (polymorphic `contacts` table; path implies `parent_type = client_organization`).

| Method | Path | Body / notes |
|--------|------|----------------|
| GET | `/` | List contacts for the client |
| POST | `/` | Create: `name`, optional `email`, `phone`, `title`, `is_primary`, `personnel_id`, `metadata` |
| GET | `/:contactId` | Detail |
| PUT | `/:contactId` | Partial update |
| DELETE | `/:contactId` | Soft-delete |

**`ContactResponse`:** includes `personnel_id` and, when set, optional embedded **`personnel`** (`ContactPersonnelEmbed`) with the same field visibility rules as `GET /api/v1/personnel` (e.g. rates/contact hidden without `personnel:view_rates` / `personnel:view_contact`).

**Response — `200 OK`:** `{ data: { id, deleted_at }, meta: null, errors: null }`

---

## Type Definitions

### ClientResponse

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| name | string | |
| contact_name | string \| null | |
| contact_email | string \| null | |
| phone | string \| null | |
| notes | string \| null | |
| metadata | object | |
| created_at | ISO 8601 datetime | |
| updated_at | ISO 8601 datetime | |
| deleted_at | ISO 8601 datetime \| null | |
