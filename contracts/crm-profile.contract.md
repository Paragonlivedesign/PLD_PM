# CRM profile — shared UI metadata (cross-cutting)

> **Version:** 1.0.0  
> **Scope:** Front-end `metadata.profile` JSON used for organization-style CRM profiles (clients, vendors, venues).  
> **Last Updated:** 2026-03-22

Module-specific contracts remain authoritative for API shape; this document describes **optional** keys stored under `metadata.profile` so branding behaves consistently across the shared shell (`js/pld-crm-profile-shell.js`).

---

## `metadata.profile` (organizations)

| Key | Type | Used by | Description |
|-----|------|---------|-------------|
| `tagline` | string | client, vendor, venue | Short subtitle under the name |
| `about` | string | client, vendor, venue | Longer description |
| `website` | string (URL) | client | Public website |
| `social_url` | string (URL) | client | Single social link |
| `avatar_document_id` | UUID \| null | venue (and org patterns that resolve document URLs) | Logo / avatar image document |
| `cover_document_id` | UUID \| null | venue | Custom wide banner image |
| `cover_banner_mode` | string | venue | `gradient` \| `map` \| `custom` \| `google_map` \| `google_streetview` — see [`venues.contract.md`](./venues.contract.md) |
| `maps_link` | string (URL) \| null | venue | Saved maps URL; “Apply link” resolves coords/timezone when permitted |

Clients and vendors may grow additional keys; merges must **preserve unknown** keys (deep merge at `profile` level only for known update paths).

---

## Contact model (unified person + memberships)

**Mental model for product and docs:**

- **`contact_persons`** — canonical CRM **person** per tenant: `display_name`, `emails` / `phones` JSON arrays (primary flags), optional `personnel_id`, optional `user_id` (link to tenant login user). See migration `020_contact_persons.sql`.
- **`contacts`** — **membership** rows: `person_id` → `contact_persons`, plus `parent_type` + `parent_id` (`client_organization`, `vendor_organization`, `venue`). Legacy `contacts.email` / `contacts.phone` mirror the person’s primary values on write.
- **Clients, vendors, venues** remain first-class tenant-scoped entities with their own APIs and permissions.
- **Personnel** — workforce records; both `contact_persons` and `users` may reference `personnel_id` where applicable.

**Hub API:** [`contacts-hub.contract.md`](./contacts-hub.contract.md) (`GET /api/v1/contact-persons`, export).

---

## Related

- [`012_contacts_vendor_link_events_time_pay_rbac.sql`](../database/migrations/012_contacts_vendor_link_events_time_pay_rbac.sql) — `contacts` DDL  
- [`020_contact_persons.sql`](../database/migrations/020_contact_persons.sql) — `contact_persons` + `contacts.person_id`  
- [`clients.contract.md`](./clients.contract.md), [`vendors.contract.md`](./vendors.contract.md), [`venues.contract.md`](./venues.contract.md)
