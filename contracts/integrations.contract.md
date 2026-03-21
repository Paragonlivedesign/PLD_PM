# Integrations Module — Interface Contract

> **Version:** 1.0.0
> **Base Path:** `/api/v1/integrations`, `/api/v1/webhooks`, `/api/v1/api-keys`
> **Owner:** Integrations Module
> **Last Updated:** 2026-02-15

---

## Table of Contents

- [Response Envelope](#response-envelope)
- [Endpoints — Integration Connections](#endpoints--integration-connections)
- [Endpoints — Webhooks](#endpoints--webhooks)
- [Endpoints — API Keys](#endpoints--api-keys)
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

## Endpoints — Integration Connections

### GET /api/v1/integrations

**Description:** List all configured integration providers and their current connection status for the tenant. Returns both connected and available (not-yet-connected) providers.

**Auth:** Required. Tenant-scoped. Requires `integrations.view` permission.

**Response — `200 OK` — `IntegrationListResponse`:**

```
{
  data: IntegrationResponse[],
  meta: {
    total_connected: integer,
    total_available: integer
  },
  errors: null
}
```

---

### POST /api/v1/integrations/:provider/connect

**Description:** Initiate an OAuth2 connection flow for the specified provider. Returns an authorization URL that the client must redirect the user to. After the user authorizes, the provider redirects back to the platform callback endpoint which completes token exchange.

**Auth:** Required. Tenant-scoped. Requires `integrations.connect` permission.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| provider | enum: google_drive, google_calendar, outlook, dropbox | yes | Integration provider |

**Request Body — `ConnectIntegrationRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| scopes | string[] | no | Requested OAuth scopes (provider defaults used if omitted) |
| redirect_uri | string | no | Custom redirect URI after authorization. Default: platform callback |

**Response — `200 OK`:**

```
{
  data: {
    authorization_url: string,
    state: string,
    expires_in: integer
  },
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Invalid provider or unsupported scopes |
| 403 | Insufficient permissions |
| 409 | Provider already connected for this user (disconnect first) |

---

### DELETE /api/v1/integrations/:provider/disconnect

**Description:** Disconnect an integration provider. Revokes stored OAuth tokens, removes credential records, and stops all sync operations for this provider.

**Auth:** Required. Tenant-scoped. Requires `integrations.connect` permission.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| provider | enum: google_drive, google_calendar, outlook, dropbox | yes | Integration provider |

**Response — `200 OK`:**

```
{
  data: {
    provider: string,
    disconnected_at: ISO 8601 datetime
  },
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 404 | No active connection found for this provider |

---

### POST /api/v1/integrations/:provider/sync

**Description:** Trigger a manual sync operation for the specified provider. Pushes pending data to the external service (files to Drive, events to Calendar, etc.). Runs asynchronously — returns immediately with a job ID.

**Auth:** Required. Tenant-scoped. Requires `integrations.connect` permission.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| provider | enum: google_drive, google_calendar, outlook, dropbox | yes | Integration provider |

**Request Body — `SyncRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| entity_type | string | no | Limit sync to a specific entity type |
| entity_ids | UUID[] | no | Limit sync to specific entity IDs (max 50) |
| force | boolean | no | Re-sync all data even if already synced. Default: `false` |

**Response — `202 Accepted`:**

```
{
  data: {
    job_id: UUID,
    provider: string,
    status: "processing",
    queued_at: ISO 8601 datetime
  },
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Invalid entity type or too many entity IDs |
| 404 | No active connection found for this provider |
| 409 | A sync is already in progress for this provider |

---

## Endpoints — Webhooks

### GET /api/v1/webhooks

**Description:** List all webhook configurations for the current tenant.

**Auth:** Required. Tenant-scoped. Requires `integrations.configure` permission.

**Response — `200 OK` — `WebhookListResponse`:**

```
{
  data: WebhookResponse[],
  meta: {
    total_count: integer
  },
  errors: null
}
```

---

### POST /api/v1/webhooks

**Description:** Create a new webhook configuration. The platform will POST event payloads to the specified URL when subscribed events occur.

**Auth:** Required. Tenant-scoped. Requires `integrations.configure` permission.

**Request Body — `CreateWebhookRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| url | string | yes | Target endpoint URL (must be HTTPS in production, max 2048 chars) |
| secret | string | yes | Shared secret for HMAC-SHA256 payload signing (min 16 chars) |
| event_types | string[] | yes | Subscribed event types (e.g., `["event.created", "assignment.updated"]`) |
| description | string | no | Human-readable description (max 255 chars) |
| is_active | boolean | no | Default: `true` |

**Response — `201 Created`:**

```
{
  data: WebhookResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure (invalid URL, secret too short, unknown event types) |
| 403 | Insufficient permissions |

---

### PUT /api/v1/webhooks/:id

**Description:** Update a webhook configuration.

**Auth:** Required. Tenant-scoped. Requires `integrations.configure` permission.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Webhook ID |

**Request Body — `UpdateWebhookRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| url | string | no | Target endpoint URL |
| secret | string | no | New shared secret |
| event_types | string[] | no | Updated subscribed event types (replaces existing) |
| description | string | no | Description |
| is_active | boolean | no | Enable/disable |

**Response — `200 OK`:**

```
{
  data: WebhookResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure |
| 404 | Webhook not found |

---

### DELETE /api/v1/webhooks/:id

**Description:** Delete a webhook configuration. Pending deliveries for this webhook are cancelled.

**Auth:** Required. Tenant-scoped. Requires `integrations.configure` permission.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Webhook ID |

**Response — `200 OK`:**

```
{
  data: { id: UUID, deleted_at: ISO 8601 datetime },
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 404 | Webhook not found |

---

## Endpoints — API Keys

### GET /api/v1/api-keys

**Description:** List all API keys for the current tenant. Returns key metadata only — the actual key value is only shown once on creation.

**Auth:** Required. Tenant-scoped. Requires `integrations.api_keys` permission.

**Response — `200 OK` — `ApiKeyListResponse`:**

```
{
  data: ApiKeyResponse[],
  meta: {
    total_count: integer
  },
  errors: null
}
```

---

### POST /api/v1/api-keys

**Description:** Create a new API key. The plaintext key is returned **only in this response** — it is stored as a bcrypt hash and cannot be retrieved again.

**Auth:** Required. Tenant-scoped. Requires `integrations.api_keys` permission.

**Request Body — `CreateApiKeyRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| name | string | yes | Key name/label (1–100 chars) |
| permissions | string[] | yes | Granted permissions (e.g., `["events:read", "personnel:read"]`). Cannot exceed the creating user's own permissions. |
| expires_at | ISO 8601 datetime | no | Expiration date. Default: no expiration |

**Response — `201 Created`:**

```
{
  data: {
    id: UUID,
    name: string,
    key: string,                   // plaintext API key — ONLY shown once
    key_prefix: string,            // first 8 chars for identification (e.g., "pm_live_a1b2c3d4")
    permissions: string[],
    expires_at: ISO 8601 datetime | null,
    created_at: ISO 8601 datetime
  },
  meta: {
    warning: "Store this key securely. It cannot be retrieved again."
  },
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Validation failure (invalid permissions, missing name) |
| 403 | Requested permissions exceed the creating user's own permissions |

---

### DELETE /api/v1/api-keys/:id

**Description:** Revoke an API key. Immediately invalidates the key — any in-flight requests using it will fail.

**Auth:** Required. Tenant-scoped. Requires `integrations.api_keys` permission.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | API key ID |

**Response — `200 OK`:**

```
{
  data: { id: UUID, revoked_at: ISO 8601 datetime },
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 404 | API key not found |

---

## Type Definitions

### IntegrationResponse

| Field | Type | Description |
|---|---|---|
| provider | string | Provider identifier (e.g., `google_drive`, `google_calendar`, `outlook`, `dropbox`) |
| display_name | string | Human-readable provider name |
| category | enum: file_storage, calendar, email | Integration category |
| connection_status | enum: connected, expired, revoked, error, not_connected | Current status |
| connected_by | UUID | null | User who authorized the connection |
| connected_at | ISO 8601 datetime | null | When the connection was established |
| last_sync_at | ISO 8601 datetime | null | Last successful sync timestamp |
| health | IntegrationHealth | null | Health metrics (only for connected providers) |

### IntegrationHealth

| Field | Type | Description |
|---|---|---|
| status | enum: healthy, degraded, error | Derived health status |
| last_success_at | ISO 8601 datetime | null | Last successful API call |
| last_error_at | ISO 8601 datetime | null | Last failed API call |
| last_error_message | string | null | Truncated error description |
| consecutive_failures | integer | Count of consecutive failures (resets on success) |

### WebhookResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Webhook ID |
| url | string | Target endpoint URL |
| event_types | string[] | Subscribed event types |
| description | string | null | Description |
| is_active | boolean | Whether enabled |
| last_delivery_at | ISO 8601 datetime | null | Last successful delivery |
| last_delivery_status | enum: success, failed | null | Last delivery result |
| consecutive_failures | integer | Consecutive failed deliveries (auto-disables at 10) |
| created_at | ISO 8601 datetime | Creation timestamp |
| updated_at | ISO 8601 datetime | Last update timestamp |

### ApiKeyResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | API key ID |
| name | string | Key name/label |
| key_prefix | string | First 8 characters of the key for identification |
| permissions | string[] | Granted permissions |
| expires_at | ISO 8601 datetime | null | Expiration date |
| last_used_at | ISO 8601 datetime | null | Last time the key was used |
| created_by | UUID | User who created the key |
| created_at | ISO 8601 datetime | Creation timestamp |
| revoked_at | ISO 8601 datetime | null | Revocation timestamp |

---

## Internal Interface

These functions are callable by other modules via internal service calls. They are NOT exposed as HTTP endpoints.

### getActiveIntegration

**Description:** Check whether a specific integration provider is connected and healthy for a given tenant. Returns the connection details and active adapter reference. Used by modules that need to conditionally trigger sync operations (e.g., documents module pushing a file to Drive).

```
getActiveIntegration(
  provider: string,                // e.g., "google_drive", "google_calendar"
  tenant_id: UUID,
  options?: {
    user_id?: UUID                 // check a specific user's connection (for per-user OAuth)
  }
) → {
  connected: boolean,
  provider: string,
  connection_status: string,
  health_status: string,
  user_id: UUID | null,
  last_sync_at: ISO 8601 datetime | null
} | null                           // null if provider not configured
```

---

### syncToProvider

**Description:** Push data to an external provider. Handles token refresh, API calls, error handling, retry queuing, and health tracking. Returns the sync result or queues for async processing if the operation is large.

```
syncToProvider(
  provider: string,
  tenant_id: UUID,
  data: {
    operation: enum: push, update, delete,
    entity_type: string,
    entity_id: UUID,
    payload: object                // provider-specific data (file buffer, calendar event, etc.)
  },
  options?: {
    user_id?: UUID,                // use this user's OAuth credentials
    async?: boolean                // queue for background processing. Default: false for single items
  }
) → {
  success: boolean,
  external_id: string | null,      // provider's ID for the synced resource
  sync_timestamp: ISO 8601 datetime,
  error?: string
}
```

---

## Domain Events

All domain events are published to the internal event bus. Consumers must be idempotent.

### sync.completed

**Trigger:** A sync operation to an external provider completes successfully.

**Payload — `SyncCompletedPayload`:**

| Field | Type | Description |
|---|---|---|
| sync_id | UUID | Sync job ID |
| tenant_id | UUID | Tenant scope |
| provider | string | Provider identifier |
| operation | enum: push, update, delete | Operation type |
| entity_type | string | Entity type that was synced |
| entity_id | UUID | Entity ID that was synced |
| external_id | string | Provider's ID for the synced resource |
| synced_by | UUID | User whose credentials were used |
| synced_at | ISO 8601 datetime | Timestamp |

---

### sync.failed

**Trigger:** A sync operation fails after all retry attempts are exhausted.

**Payload — `SyncFailedPayload`:**

| Field | Type | Description |
|---|---|---|
| sync_id | UUID | Sync job ID |
| tenant_id | UUID | Tenant scope |
| provider | string | Provider identifier |
| operation | enum: push, update, delete | Operation type |
| entity_type | string | Entity type |
| entity_id | UUID | Entity ID |
| error_code | string | Error classification (e.g., `TOKEN_EXPIRED`, `PROVIDER_ERROR`, `RATE_LIMITED`) |
| error_message | string | Human-readable error description |
| retry_count | integer | Number of retries attempted |
| failed_at | ISO 8601 datetime | Timestamp |
