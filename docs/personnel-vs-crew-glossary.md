# Glossary: Personnel, crew, and contacts

Short definitions for product language and contracts. Authoritative HTTP shapes live under `contracts/`.

## Personnel

**Personnel** is the **tenant-wide roster**: one canonical record per person in your organization (name, email, role, `employment_type`, department, rates, skills, `status`, etc.). See [`contracts/personnel.contract.md`](../contracts/personnel.contract.md) (`PersonnelResponse`).

- The **Personnel** page in the app lists this roster—not “everyone who is crew on a show.”

## Crew (on an event)

**Crew** (in scheduling) means a **crew assignment**: a link between **personnel** and an **event** (dates, role on the show, optional rate overrides). It is **not** a second “people table.” See [`contracts/scheduling.contract.md`](../contracts/scheduling.contract.md) (`POST /api/v1/assignments/crew`, `personnel_id` + `event_id`).

- **Someone is “crew for Show X”** when they have (or will have) a crew assignment on that event—not merely because they appear on the Personnel roster.

## Client / venue / vendor contacts (CRM)

**Client contacts** (and venue/vendor contacts) are **CRM directory rows** for companies you work with: names, emails, titles, optional `personnel_id` link, `is_primary`, etc. They are **not** personnel roster members by default.

- Legacy **single** fields on the client org row (`contact_name`, `contact_email`) are a summary; **multiple contacts** are modeled via nested routes (e.g. `GET/POST /api/v1/clients/:id/contacts`) and optional **event** `primary_contact_id` pointing at a `contacts.id` validated against that event’s client/venue. See [`contracts/clients.contract.md`](../contracts/clients.contract.md) and [`contracts/events.contract.md`](../contracts/events.contract.md).

## How the terms relate

| Term              | Meaning |
|-------------------|---------|
| Personnel         | Roster identity for **your** org (scheduling references `personnel_id`). |
| Crew assignment   | **Event-scoped** placement of a roster person on a show. |
| Client contact    | **External** stakeholder at a client company (CRM), not the same as personnel unless explicitly linked. |

## See also

- [`design-personnel-category-eligibility.md`](design-personnel-category-eligibility.md) — optional future: assignability / categories.
- [`design-client-contacts.md`](design-client-contacts.md) — multi-contact companies and events.
