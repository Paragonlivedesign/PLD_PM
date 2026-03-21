# Auth Module — Interface Contract

> **Version:** 1.0.0
> **Base Path:** `/api/v1/auth`
> **Owner:** Auth Module
> **Last Updated:** 2026-03-21

---

## Table of Contents

- [Response Envelope](#response-envelope)
- [Endpoints — Authentication](#endpoints--authentication)
- [Endpoints — Password Management](#endpoints--password-management)
- [Endpoints — Profile](#endpoints--profile)
- [Endpoints — Invitations](#endpoints--invitations)
- [Type Definitions](#type-definitions)
- [Internal Interface](#internal-interface)
- [Domain Events](#domain-events)

---

## Response Envelope

All responses follow the standard envelope:

```
{
  data: <T> | null,
  meta: { ... } | null,
  errors: [ { code: string, message: string, field?: string } ] | null
}
```

---

## Endpoints — Authentication

### POST /api/v1/auth/login

**Description:** Authenticate a user with email and password. Returns an access/refresh token pair.

**Auth:** None (public endpoint).

**Request Body — `LoginRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| email | string | yes | User email address |
| password | string | yes | User password |
| tenant_slug | string | yes | Tenant identifier for multi-tenant resolution |

**Response — `200 OK` — `LoginResponse`:**

```
{
  data: {
    access_token: string,
    refresh_token: string,
    expires_in: integer,
    token_type: "Bearer",
    user: UserProfileResponse
  },
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure (missing required fields) |
| 401 | Invalid credentials (generic — no user enumeration) |
| 403 | Account disabled |
| 423 | Account locked (too many failed attempts). Response includes `locked_until` |

---

### POST /api/v1/auth/logout

**Description:** Revoke the current refresh token, ending the session.

**Auth:** Required.

**Request Body — `LogoutRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| refresh_token | string | yes | The refresh token to revoke |

**Response — `200 OK`:**

```
{
  data: { message: "Logged out successfully" },
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 401 | Unauthenticated (invalid or expired access token) |

---

### POST /api/v1/auth/logout-all

**Description:** Revoke **all** refresh tokens for the **authenticated** user (every device / session). Access tokens remain valid until they expire; clients should discard stored refresh tokens. Invalidates the server-side permission cache entry for that user.

**Auth:** Required (Bearer access token).

**Request Body:** None.

**Response — `200 OK`:**

```
{
  data: { message: "All sessions logged out" },
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 401 | Unauthenticated |

---

### POST /api/v1/auth/users/:userId/sessions/revoke

**Description:** Revoke **all** refresh tokens for another user in the same tenant (admin / operator “force logout”). Requires permission `auth.sessions.revoke`. Does not revoke the caller’s own sessions unless `:userId` is the caller (same effect as logout-all).

**Auth:** Required. Permission: `auth.sessions.revoke` (tenant admins with wildcard `*` satisfy this check).

**Path Parameters:**

| Param | Type | Description |
|---|---|---|
| userId | UUID | Target user id within the current tenant |

**Response — `200 OK`:**

```
{
  data: { message: "Sessions revoked for user" },
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 403 | Missing `auth.sessions.revoke` |
| 404 | User not found in current tenant |

---

### POST /api/v1/auth/refresh

**Description:** Exchange a valid refresh token for a new access/refresh token pair. The submitted refresh token is revoked (single-use rotation).

**Auth:** None (refresh token is the credential).

**Request Body — `RefreshTokenRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| refresh_token | string | yes | Current refresh token |

**Response — `200 OK` — `TokenPairResponse`:**

```
{
  data: {
    access_token: string,
    refresh_token: string,
    expires_in: integer,
    token_type: "Bearer"
  },
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 401 | Refresh token invalid, expired, or already used |
| 401 | Token reuse detected — entire token family revoked (possible compromise) |

---

## Endpoints — Password Management

### POST /api/v1/auth/forgot-password

**Description:** Request a password reset email. Always returns `200 OK` regardless of whether the email exists (prevents user enumeration).

**Auth:** None (public endpoint).

**Request Body — `ForgotPasswordRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| email | string | yes | Account email address |
| tenant_slug | string | yes | Tenant identifier |

**Response — `200 OK`:**

```
{
  data: { message: "If an account exists with this email, a reset link has been sent." },
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure (invalid email format) |
| 429 | Rate limit exceeded (max 3 requests per email per hour) |

---

### POST /api/v1/auth/reset-password

**Description:** Reset password using a valid reset token from the forgot-password email. Revokes all existing refresh tokens for the user (force re-login on all devices).

**Auth:** None (reset token is the credential).

**Request Body — `ResetPasswordRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| token | string | yes | Password reset token from the email link |
| new_password | string | yes | New password (must meet tenant password policy) |

**Response — `200 OK`:**

```
{
  data: { message: "Password reset successfully. Please log in with your new password." },
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure (password does not meet policy requirements) |
| 401 | Reset token invalid, expired, or already used |

---

## Endpoints — Profile

### GET /api/v1/auth/me

**Description:** Retrieve the authenticated user's profile, including role and permissions.

**Auth:** Required. Tenant-scoped.

**Response — `200 OK` — `UserProfileResponse`:**

```
{
  data: UserProfileResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 401 | Unauthenticated |

---

### PUT /api/v1/auth/me

**Description:** Update the authenticated user's own profile. Only profile fields can be updated — role and permissions cannot be self-modified.

**Auth:** Required. Tenant-scoped.

**Request Body — `UpdateProfileRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| first_name | string | no | First name (1–100 chars) |
| last_name | string | no | Last name (1–100 chars) |
| email | string | no | Email (triggers re-verification if changed) |
| phone | string | no | Phone number |
| current_password | string | conditional | Required when changing email or password |
| new_password | string | no | New password (must meet tenant password policy) |
| preferences | object | no | User preferences (see `UserPreferences` type) |

**Response — `200 OK`:**

```
{
  data: UserProfileResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure (password policy, invalid email format) |
| 401 | Unauthenticated |
| 403 | `current_password` incorrect when attempting email or password change |
| 409 | Email already in use by another user within the tenant |

---

## Endpoints — Invitations

### Two `…/invitations/accept` routes (do not confuse)

| Method and path | Module | Purpose |
|-----------------|--------|---------|
| `POST /api/v1/auth/invitations/accept` | Auth | Public. Accept an **auth** invitation: create/link **user** account (password + token in body). Implemented on [`authPublicRouter`](../backend/src/modules/auth/routes.ts). |
| `POST /api/v1/invitations/accept` | Personnel | Public. Accept a **personnel** invitation token (`personnelService.acceptInvitation`). Implemented at app root in [`app-factory.ts`](../backend/src/app-factory.ts) (not under `/auth`). Response shape differs from auth. |

UI and clients must use the URL that matches the invitation email / token type.

### POST /api/v1/auth/invite

**Description:** Send an invitation to create an account. Generates a secure token and triggers an invitation email.

**Auth:** Required. Tenant-scoped. Requires `auth.invitations.manage` permission.

**Request Body — `InviteUserRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| email | string | yes | Invitee email address |
| role | string | yes | Role to assign: `admin`, `manager`, `coordinator`, `viewer` |
| personnel_id | UUID | no | Link to existing personnel record |
| expires_in_days | integer | no | Invitation expiry in days. Default: `7` |

**Response — `201 Created`:**

```
{
  data: InvitationResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure (invalid email, invalid role) |
| 403 | Insufficient permissions |
| 409 | Email already has an active account or pending invitation |

---

## Type Definitions

### UserProfileResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | User ID |
| email | string | Email address |
| first_name | string | First name |
| last_name | string | Last name |
| phone | string | null | Phone number |
| role | string | Role name (`admin`, `manager`, `coordinator`, `viewer`) |
| permissions | string[] | Resolved permission strings |
| personnel_id | UUID | null | Linked personnel record ID |
| preferences | UserPreferences | User preferences |
| is_active | boolean | Account active status |
| last_login_at | ISO 8601 datetime | null | Last successful login |
| created_at | ISO 8601 datetime | Account creation timestamp |
| updated_at | ISO 8601 datetime | Last update timestamp |

### UserPreferences

| Field | Type | Description |
|---|---|---|
| timezone | string | null | User timezone override (IANA format, e.g., `America/New_York`) |
| date_format | string | null | Preferred date format override |
| time_format | enum: 12h, 24h | null | Preferred time format override |
| notification_sound | boolean | Whether to play notification sounds |

### InvitationResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Invitation ID |
| email | string | Invitee email |
| role | string | Assigned role |
| personnel_id | UUID | null | Linked personnel record |
| status | enum: pending, accepted, expired, revoked | Invitation status |
| invited_by | UUID | User who sent the invitation |
| expires_at | ISO 8601 datetime | Expiry timestamp |
| accepted_at | ISO 8601 datetime | null | When accepted |
| created_at | ISO 8601 datetime | Creation timestamp |

---

## Internal Interface

These functions are callable by other modules via internal service calls. They are NOT exposed as HTTP endpoints.

### validateToken

**Description:** Validate an access token and return the decoded claims. Used by middleware and other modules that need to verify authentication outside the standard HTTP request chain (e.g., WebSocket auth).

```
validateToken(
  token: string
) → {
  valid: boolean,
  claims: {
    sub: UUID,          // user ID
    tid: UUID,          // tenant ID
    role: string,
    pid: UUID | null,   // personnel ID
    exp: integer        // expiration (Unix epoch)
  } | null,
  error?: string
}
```

---

### getCurrentUser

**Description:** Retrieve the full user profile for a given user ID. Returns `null` if the user does not exist, is inactive, or does not belong to the specified tenant.

```
getCurrentUser(
  user_id: UUID,
  tenant_id: UUID
) → UserProfileResponse | null
```

---

### resolvePermissions

**Description:** Resolve the complete set of permissions for a user based on their role and any custom grants. Returns a flat array of permission strings.

```
resolvePermissions(
  user_id: UUID,
  tenant_id: UUID
) → string[]
```

---

### checkPermission

**Description:** Check whether a specific user has a specific permission on a specific resource. Combines role-based permission check with optional resource-scoped access validation.

```
checkPermission(
  user_id: UUID,
  resource: string,       // e.g., "events", "personnel", "financial"
  action: string,         // e.g., "read", "write", "delete", "export"
  options?: {
    resource_id?: UUID,   // specific entity ID for scope check
    tenant_id?: UUID      // override tenant (defaults to user's tenant)
  }
) → {
  allowed: boolean,
  reason?: string         // human-readable denial reason
}
```

---

## Domain Events

The Auth module does **not** publish domain events to the shared event bus. Auth-related state changes (login, logout, password reset) are handled internally and logged to the audit trail. Other modules consume auth via the internal interface above, not via events.

**Note:** The auth module _consumes_ events from other modules (e.g., `personnel.role_changed` for session cache invalidation), but that subscription is documented in the emitting module's contract.
