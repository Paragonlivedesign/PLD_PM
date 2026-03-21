# Design note: personnel category & assignment eligibility

**Status:** Design / future. No breaking change to current APIs until explicitly adopted.

## Problem

Today, **employment_type** (`full_time` | `part_time` | `freelance` | `contractor`) classifies payroll-style employment. The **Assign Crew** UI lists everyone on the **personnel** roster who is not already on the event—there is no first-class flag for “directory only” or “do not schedule.”

Some orgs want:

- People in the directory who should **never** receive crew assignments.
- Or only certain categories (e.g. staff vs contractors) eligible for scheduling.

## Soft path (minimal contract change)

1. **Conventions in `metadata`** (or tags), e.g. `metadata.schedule_eligible: true | false` or `metadata.directory_only: true`.
2. **UI**: filter the assign-crew picker to exclude rows matching the convention.
3. **Optional**: document the keys in [`personnel.contract.md`](../contracts/personnel.contract.md) as reserved semantics (not enforced by the server initially).

**Pros:** No migration. **Cons:** Easy to bypass if other clients ignore metadata.

## Hard path (contract + schema)

1. Add **`person_category`** or extend **`employment_type`** with values such as `contact` / `non_operational` (names TBD).
2. **`personnel.contract.md`**: document allowed values and meaning.
3. **Backend**: validate on create/update.
4. **Scheduling**: `POST /assignments/crew` rejects when personnel is not eligible (clear error code).
5. **UI**: roster badges, filters, and assign-crew picker aligned with the same rules.

**Pros:** Single source of truth. **Cons:** Migration, validators, and scheduling checks.

## Recommendation

Treat **crew assignments** as the definitive “this person is on the show” signal. Use **employment_type** for how you classify payroll; add **category / eligibility** only when product requirements justify the hard path.
