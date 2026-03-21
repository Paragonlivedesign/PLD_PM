# Vendors — Interface Contract

> **Version:** 1.0.0  
> **Base Path:** `/api/v1/vendors`  
> **Owner:** CRM / events-adjacent  
> **Last Updated:** 2026-03-21

---

## Response Envelope

Same as [events.contract.md](./events.contract.md): `{ data, meta, errors }`.

---

## Authorization

| Action | Permission |
|--------|------------|
| List / get | `vendors:read` |
| Create | `vendors:create` |
| Update | `vendors:update` |
| Delete | `vendors:delete` |
| Contacts (nested) | Read: `vendors:read`, write: `vendors:update` |

---

## Endpoints

### GET /api/v1/vendors

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| search | string | no | ILIKE on name, contact_email, contact_name |
| limit | integer | no | 1–200, default 50 |

**Response:** `{ data: VendorResponse[], meta: { total_count }, errors: null }`

---

### POST /api/v1/vendors

**Request — `CreateVendorRequest`**

| Field | Type | Required |
|-------|------|----------|
| name | string | yes (1–255) |
| contact_name | string | no |
| contact_email | string | no |
| phone | string | no |
| notes | string | no (max 5000) |
| metadata | object | no |
| linked_client_id | uuid | no (must exist in tenant) |

**Response:** `201 Created` with `VendorResponse`.

---

### GET /api/v1/vendors/:id

**Response:** `200` with `VendorResponse`, or `404`.

---

### PUT /api/v1/vendors/:id

**Request — `UpdateVendorRequest`:** optional fields: `name`, `contact_name`, `contact_email`, `phone`, `notes`, `metadata` (merged), `linked_client_id` (nullable), `updated_at` (optimistic concurrency, optional).

**Response:** `200` with `VendorResponse`.  
**Errors:** `400` validation / invalid linked client, `404` not found, `409` stale `updated_at`.

---

### DELETE /api/v1/vendors/:id

Soft-delete vendor and soft-delete nested CRM contacts for this vendor.

**Response:** `{ data: { id, deleted_at }, meta: null, errors: null }`  
**404** if not found.

---

### Nested: `/api/v1/vendors/:vendorId/contacts`

Same CRUD shape as [clients.contract.md](./clients.contract.md) contacts (polymorphic `contacts`; `parent_type = vendor_organization`).

---

## Type: VendorResponse

| Field | Type |
|-------|------|
| id | uuid |
| name | string |
| contact_name | string \| null |
| contact_email | string \| null |
| phone | string \| null |
| notes | string \| null |
| metadata | object |
| linked_client_id | uuid \| null |
| created_at | ISO-8601 |
| updated_at | ISO-8601 |
| deleted_at | ISO-8601 \| null |

---

### Profile metadata (optional)

`metadata` is merged on `PUT`. For CRM profile UIs, nested keys under **`metadata.profile`** are reserved (optional): `tagline`, `about`, `website`, `social_url`, `avatar_document_id`, `cover_document_id` (document UUIDs per [documents.contract.md](./documents.contract.md)). See [clients.contract.md](./clients.contract.md) nested contact `metadata` for optional contact fields.

