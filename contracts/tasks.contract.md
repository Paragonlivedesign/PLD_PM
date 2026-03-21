# Tasks / Roadmap — Interface Contract

> **Version:** 1.0.0  
> **Base Path:** `/api/v1/tasks`  
> **Last Updated:** 2026-03-21

Inventory, warehouse, and equipment checkout metrics are **out of scope** for this module.

---

## Response Envelope

`{ data, meta, errors }` per project conventions.

---

## Authorization

| Action | Permission |
|--------|------------|
| List / get | `tasks:read` |
| Create | `tasks:create` |
| Update | `tasks:update` |
| Delete | `tasks:delete` |

---

## Task fields

| Field | Type | Notes |
|-------|------|--------|
| id | UUID | |
| tenant_id | UUID | server-side |
| title | string | required on create |
| description | string \| null | |
| status | enum | `open`, `in_progress`, `blocked`, `done`, `cancelled` |
| priority | enum | `low`, `normal`, `high`, `urgent` |
| task_type | enum | `task`, `milestone`, `checklist` |
| event_id | UUID \| null | optional FK to events |
| assignee_personnel_id | UUID \| null | optional FK to personnel |
| parent_task_id | UUID \| null | subtasks |
| start_at | ISO-8601 \| null | |
| due_at | ISO-8601 \| null | |
| completion_percent | int 0–100 \| null | optional rollup |
| tags | string[] | |
| sort_order | int | |
| metadata | object | |
| created_at, updated_at | ISO-8601 | |
| deleted_at | ISO-8601 \| null | soft delete |

---

## Endpoints

### POST /api/v1/tasks

Create. **Auth:** `tasks:create`

### GET /api/v1/tasks

List (tenant-scoped). **Auth:** `tasks:read`

**Query:** `status`, `priority`, `event_id`, `assignee_personnel_id`, `parent_task_id` (use `root` or empty for top-level only), `due_from`, `due_to`, `search`, `mine` (boolean — assignee = current user’s personnel id when JWT maps), `limit` (default 50, max 100), `cursor` (optional).

**Response:** `{ data: TaskResponse[], meta: { cursor, has_more, total_count }, errors: null }`

### GET /api/v1/tasks/:id

**Auth:** `tasks:read`

### PATCH /api/v1/tasks/:id

Partial update. **Auth:** `tasks:update`

### DELETE /api/v1/tasks/:id

Soft-delete. **Auth:** `tasks:delete`

### POST /api/v1/tasks/bulk-update

**Auth:** `tasks:update`

**Body:** `{ task_ids: UUID[], patch: UpdateTaskRequest }` — applies the same patch to all ids (tenant-scoped).

---

## Errors

400 validation, 401, 403, 404 for unknown id.
