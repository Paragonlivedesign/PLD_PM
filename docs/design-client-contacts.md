# Design note: multiple contacts per client and per project

**Status:** Partially implemented in API + UI; this doc captures the model and remaining options.

## Historical gap

Originally, **clients** exposed a **single** optional contact pair (`contact_name`, `contact_email`) on the org row. That does not model **one company, many stakeholders** (production vs billing vs executive) per account or per show.

## Current implementation (additive)

1. **Nested CRM contacts** — `GET/POST/PUT/DELETE` under `/api/v1/clients/:id/contacts` (and similarly for venues/vendors). Multiple rows per parent; optional `personnel_id`, `is_primary`, etc.
2. **Event primary contact** — Events may set **`primary_contact_id`** to a `contacts.id` that belongs to the event’s **client** or **venue** (validated server-side). See [`contracts/events.contract.md`](../contracts/events.contract.md).

Together, this supports **many people per client** and a **show-level** primary contact without duplicating personnel.

## Optional extensions (when needed)

| Direction | Description |
|-----------|-------------|
| **Event-only** | Add `client_contact_id` (or rename clarity) if the main need is “per project” without exposing full CRM in every surface. |
| **Tags / roles** | Tag contacts (`billing`, `production`, `legal`) for filtering and comms templates. |
| **Unify with roster** | Optional `personnel_id` on each contact row so one human links CRM + internal profile where applicable. |

## Contracts

- [`contracts/clients.contract.md`](../contracts/clients.contract.md)
- [`contracts/events.contract.md`](../contracts/events.contract.md) — `primary_contact_id` rules

See also [`personnel-vs-crew-glossary.md`](personnel-vs-crew-glossary.md) for terminology vs personnel/crew.
