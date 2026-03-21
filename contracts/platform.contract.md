# Platform admin API (cross-tenant)

Baseline operator endpoints. **Not** tenant-scoped: they use the same Bearer JWT as normal login, but authorize via **`PLD_PLATFORM_ADMIN_EMAILS`** (env on the API server) instead of tenant RBAC.

## Auth

- `Authorization: Bearer <access_token>` (required)
- User must be active; email must appear in `PLD_PLATFORM_ADMIN_EMAILS` (comma-separated, case-insensitive).

## User profile field

- `GET /api/v1/auth/me` and login payloads include **`is_platform_admin`** (boolean) — same allowlist rule — so the SPA can show UI hints without calling platform routes.

## Endpoints

### `GET /api/v1/platform/tenants`

Returns all rows from `tenants` with a condensed list of non-deleted users per tenant (email, name, role, active).

**Response** `200` — envelope `data`: array of:

| Field | Type |
|-------|------|
| `id` | UUID |
| `name` | string |
| `slug` | string |
| `status` | string |
| `created_at` | ISO timestamp |
| `users` | array of `{ id, email, first_name, last_name, role_name, is_active }` |

**Errors**

- `401` — missing/invalid token, or user inactive
- `403` — token valid but email not in allowlist
