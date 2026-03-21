# Contacts hub — tenant CRM persons API

> **Version:** 1.0.0  
> **Scope:** `GET /api/v1/contact-persons`, `GET /api/v1/contact-persons/export`, import/bulk stubs.  
> **Envelope:** `{ data, meta, errors }` per global rules.

## Model

- **`contact_persons`**: canonical person (`display_name`, `emails` JSON array, `phones` JSON array, optional `personnel_id`, optional `user_id`).
- **`contacts`**: membership rows (`parent_type`, `parent_id`, `person_id`, legacy `email`/`phone` mirrored from person primary on write).

## `GET /api/v1/contact-persons`

**Permissions:** one of `clients:read`, `venues:read`, `vendors:read`.

**Query:**

| Param | Description |
|-------|-------------|
| `limit` | 1–200, default 50 |
| `search` | Matches display name, primary normalized email, or email addresses |
| `parent_type` | With `parent_id`, filter persons with a membership under that parent |
| `parent_id` | UUID |

**Response `data`:** array of `ContactPersonResponse` extended with `memberships[]` (`membership_id`, `parent_type`, `parent_id`, `title`, `is_primary`). Rows are filtered server-side so only memberships whose `parent_type` the caller may read are included; persons with no visible memberships are omitted.

**Response `meta`:** `{ limit, count }`.

## `GET /api/v1/contact-persons/export`

Same permission gate as list. Returns `text/csv` (membership grain). When tenant audit export is enabled, writes `audit_logs` (`entity_type: contacts_export`, `action: data_export`).

## `POST /api/v1/contact-persons/import/dry-run` (stub)

**Permissions:** `clients:update` or `venues:update` or `vendors:update` (any). Returns `{ staged: [], conflicts: [] }` until full import ships.

## `PATCH /api/v1/contact-persons/bulk` (stub)

**Permissions:** `*`. Returns `501` or empty — reserved for future bulk patch.

## Related

- [`crm-profile.contract.md`](./crm-profile.contract.md) — person + membership model
- [`clients.contract.md`](./clients.contract.md) — nested `/clients/:id/contacts`
