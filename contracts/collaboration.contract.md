# Collaboration Module — Interface Contract

> **Version:** 1.0.0
> **Base Path:** `/api/v1/notifications` (REST), `/ws` (WebSocket)
> **Owner:** Collaboration Module
> **Last Updated:** 2026-03-22

---

## Implementation status (server)

| Area | Status |
|------|--------|
| REST `/api/v1/notifications` | Implemented |
| WebSocket `/ws` | **JWT auth:** `auth` / `reauth` frames validate the access token via the same path as HTTP Bearer (`resolveBearerContext`). `tenant_id` and `user_id` on the connection come from the token claims (not from client-supplied tenant alone). **Dev only:** when `PLD_DEV_AUTH_HEADERS` is not set to `false`, `token: "dev"` plus `tenant_id` UUID in the `auth` frame is accepted for local presence/testing (matches [`js/pld-presence-ws.js`](../js/pld-presence-ws.js)). |
| Channel permission matrix below | **Partial:** subscription is allowed only for channels under `tenant:{resolvedTenantId}:*`. Patterns like `event:{id}` / `user:{id}` are not yet enforced server-side. |

---

## Table of Contents

- [Response Envelope](#response-envelope)
- [WebSocket — Connection](#websocket--connection)
- [WebSocket — Channels](#websocket--channels)
- [WebSocket — Message Types](#websocket--message-types)
- [Endpoints — Notifications](#endpoints--notifications)
- [Endpoints — Notification Preferences](#endpoints--notification-preferences)
- [Type Definitions](#type-definitions)
- [Internal Interface](#internal-interface)
- [Domain Events](#domain-events)

---

## Response Envelope

REST responses follow the standard envelope:

```
{
  data: <T> | null,
  meta: { ... } | null,
  errors: [ { code: string, message: string, field?: string } ] | null
}
```

WebSocket messages use a separate envelope defined in [Message Envelope](#websocket-message-envelope).

---

## WebSocket — Connection

### Connection Lifecycle

| Phase | Description |
|---|---|
| **Connect** | Client opens WebSocket to `/ws`. Server upgrades the HTTP connection. |
| **Authenticate** | Client sends an `auth` frame with the access token within 5 seconds. Server validates the JWT, extracts `tenant_id`, `user_id`, and `role`, and binds them to the connection. Failure or timeout closes with code `4401`. |
| **Subscribe** | Client sends `subscribe` frames to join channels. Server validates read permission for the requested resource before adding the connection to the channel. |
| **Active** | Server pushes messages on subscribed channels. Client sends `ping` frames for keepalive. |
| **Reauth** | When the access token nears expiry, client refreshes via REST API and sends a `reauth` frame with the new token. |
| **Disconnect** | On close (client, network, or server-initiated), the server removes the connection from all channels and broadcasts a `presence.leave` to affected channels. |

### Client → Server Frames

| Frame Type | Payload | Description |
|---|---|---|
| `auth` | `{ token: string, tenant_id?: string }` | Initial authentication (must be sent within 5 seconds). `tenant_id` is **ignored** when the token is a valid JWT (tenant comes from the token). Optional `tenant_id` is used only for the **dev** token path (see Implementation status). |
| `reauth` | `{ token: string, tenant_id?: string }` | Token refresh during active connection; same rules as `auth`. |
| `subscribe` | `{ channel: string }` | Subscribe to a channel |
| `unsubscribe` | `{ channel: string }` | Leave a channel |
| `ping` | `{}` | Keepalive (server responds with `pong`) |
| `heartbeat` | `{ channel: string }` | Presence heartbeat for the active channel (every 30 seconds) |

### Server Close Codes

| Code | Meaning |
|---|---|
| `4401` | Authentication failed or timed out |
| `4403` | Token expired, no reauth received |
| `4409` | Duplicate connection (same user already connected, policy-dependent) |
| `4503` | Server at capacity, try another instance |

---

## WebSocket — Channels

### Channel Definitions

| Channel Pattern | Example | Purpose | Permission Required |
|---|---|---|---|
| `tenant:{tenantId}` | `tenant:a1b2c3d4-...` | Tenant-wide broadcasts — system announcements, global notifications | Any authenticated user in tenant |
| `event:{eventId}` | `event:e5f6g7h8-...` | All updates for a specific event — data changes, presence, conflicts | `events:read` or assigned to event |
| `schedule:global` | `schedule:global` | Global schedule changes — new assignments, conflicts, bulk updates | `scheduling:read` |
| `user:{userId}` | `user:x9y0z1a2-...` | Private channel — personal notifications, assignment alerts, export-ready signals | Own user ID only |

### Subscription Validation

When a client sends a `subscribe` frame, the server validates:

1. The channel format matches a known pattern.
2. The authenticated user has read permission for the referenced resource.
3. For `user:{userId}` channels, the user ID matches the authenticated user (no subscribing to other users' channels).
4. For `event:{eventId}` channels, the user has access to the event (via role-based or assignment-based check).

If validation fails, the server responds with a `subscribe_error` message and does not add the connection to the channel.

---

## WebSocket — Message Types

### WebSocket Message Envelope

All server → client messages follow this envelope:

```
{
  id: string,                      // unique message ID (UUID) for client-side dedup
  type: string,                    // message type (see below)
  channel: string,                 // channel this message belongs to
  payload: object,                 // type-specific data
  timestamp: ISO 8601 datetime     // server-issued UTC timestamp
}
```

### presence.join

**Trigger:** A user subscribes to a channel.

**Payload:**

| Field | Type | Description |
|---|---|---|
| user_id | UUID | User who joined |
| user_name | string | Display name |
| channel | string | Channel joined |

---

### presence.leave

**Trigger:** A user unsubscribes, disconnects, or heartbeat expires.

**Payload:**

| Field | Type | Description |
|---|---|---|
| user_id | UUID | User who left |
| channel | string | Channel left |

---

### record.created

**Trigger:** A new entity is created in any module. Broadcast to relevant channels based on entity context.

**Payload:**

| Field | Type | Description |
|---|---|---|
| entity_type | string | Entity type (e.g., `event`, `assignment`, `travel_record`) |
| entity_id | UUID | Created entity ID |
| summary | string | Human-readable summary (e.g., "New crew assignment: Alex Chen → SXSW") |
| actor | ActorSummary | User who performed the action |
| data | object | Key fields from the created entity (varies by type) |

---

### record.updated

**Trigger:** An existing entity is updated. Broadcast to relevant channels.

**Payload:**

| Field | Type | Description |
|---|---|---|
| entity_type | string | Entity type |
| entity_id | UUID | Updated entity ID |
| summary | string | Human-readable summary of changes |
| actor | ActorSummary | User who performed the action |
| changed_fields | string[] | List of fields that changed |
| version | integer | New entity version (for optimistic concurrency) |

---

### record.deleted

**Trigger:** An entity is deleted (soft-deleted). Broadcast to relevant channels.

**Payload:**

| Field | Type | Description |
|---|---|---|
| entity_type | string | Entity type |
| entity_id | UUID | Deleted entity ID |
| summary | string | Human-readable summary |
| actor | ActorSummary | User who performed the action |

---

### conflict.detected

**Trigger:** An optimistic concurrency conflict is detected (another user updated the same record). Sent to the specific user's channel whose update was rejected.

**Payload:**

| Field | Type | Description |
|---|---|---|
| entity_type | string | Entity type |
| entity_id | UUID | Entity ID |
| current_version | integer | Version now in the database |
| your_version | integer | Version the user attempted to update from |
| conflicting_user | ActorSummary | User whose update succeeded |

---

### notification

**Trigger:** An in-app notification is created for a user. Sent on the user's private `user:{userId}` channel.

**Payload:**

| Field | Type | Description |
|---|---|---|
| notification_id | UUID | Notification ID |
| type | string | Notification type (e.g., `assignment`, `mention`, `deadline`, `system`, `export_ready`) |
| title | string | Notification title |
| body | string | Notification body text |
| payload | object | Type-specific data (e.g., `{ event_id, assignment_id }`) |
| created_at | ISO 8601 datetime | Timestamp |

---

## Endpoints — Notifications

### Delivery channels (REST `sendNotification` behavior)

| Channel | Current behavior |
|---------|------------------|
| `in_app` | Persisted; rows appear in `GET /api/v1/notifications`. |
| `email` | **Not delivered:** preference may list `email` in `delivered_channels` for API compatibility; the server does not send mail (stub log only) until an outbound provider is integrated. |
| `slack` | **Not delivered:** same as `email`. |

### GET /api/v1/notifications

**Description:** List notifications for the authenticated user with cursor-based pagination.

**Auth:** Required. Tenant-scoped.

**Query Parameters — `NotificationFilters`:**

| Param | Type | Required | Description |
|---|---|---|---|
| status | enum: unread, read, all | no | Filter by read status. Default: `all` |
| type | string | no | Filter by notification type (e.g., `assignment`, `mention`, `deadline`) |
| sort_order | enum: asc, desc | no | Default: `desc` (newest first) |
| cursor | string (opaque) | no | Cursor for next page |
| limit | integer (1–100) | no | Default: `25` |

**Response — `200 OK` — `NotificationListResponse`:**

```
{
  data: NotificationResponse[],
  meta: {
    cursor: string | null,
    has_more: boolean,
    total_count: integer,
    unread_count: integer
  },
  errors: null
}
```

---

### PUT /api/v1/notifications/:id/read

**Description:** Mark a single notification as read. Sets `read_at` timestamp.

**Auth:** Required. Tenant-scoped. User can only mark their own notifications.

**Path Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| id | UUID | yes | Notification ID |

**Response — `200 OK`:**

```
{
  data: NotificationResponse,
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 404 | Notification not found or not owned by current user |

---

### PUT /api/v1/notifications/read-all

**Description:** Mark all unread notifications as read for the authenticated user.

**Auth:** Required. Tenant-scoped.

**Response — `200 OK`:**

```
{
  data: { marked_count: integer },
  meta: null,
  errors: null
}
```

---

### GET /api/v1/notifications/preferences

**Description:** Retrieve notification preferences for the authenticated user. Returns per-type channel settings.

**Auth:** Required. Tenant-scoped.

**Response — `200 OK` — `NotificationPreferencesResponse`:**

```
{
  data: NotificationPreference[],
  meta: null,
  errors: null
}
```

---

### PUT /api/v1/notifications/preferences

**Description:** Update notification preferences for the authenticated user. Partial updates — only provided preference entries are changed.

**Auth:** Required. Tenant-scoped.

**Request Body — `UpdateNotificationPreferencesRequest`:**

| Field | Type | Required | Description |
|---|---|---|---|
| preferences | NotificationPreferenceInput[] | yes | Array of preference updates |

**NotificationPreferenceInput:**

| Field | Type | Required | Description |
|---|---|---|---|
| notification_type | string | yes | Notification type: canonical keys include `phase_transition`, `scheduling_conflict`, `budget_alert`, `crew_assignment`, `travel_update`, `document_generated`, `comment` (legacy: `assignment`, `mention`, `deadline`, `system`) |
| channel | enum: in_app, email, slack | yes | Delivery channel (`slack` persisted; outbound delivery is implementation-dependent) |
| enabled | boolean | yes | Whether this channel is enabled for this type |

**Response — `200 OK`:**

```
{
  data: NotificationPreference[],
  meta: null,
  errors: null
}
```

**Error Responses:**

| Status | Condition |
|---|---|
| 400 | Invalid notification type or channel |

---

## Type Definitions

### NotificationResponse

| Field | Type | Description |
|---|---|---|
| id | UUID | Notification ID |
| type | string | Notification type |
| title | string | Title |
| body | string | Body text |
| payload | object | Type-specific data (e.g., `{ event_id, entity_type, entity_id }`) |
| read_at | ISO 8601 datetime | null | When the notification was read |
| created_at | ISO 8601 datetime | Creation timestamp |

### NotificationPreference

| Field | Type | Description |
|---|---|---|
| notification_type | string | Notification type |
| channel | enum: in_app, email, slack | Delivery channel |
| enabled | boolean | Whether enabled |

### ActorSummary

Compact user reference included in WebSocket messages.

| Field | Type | Description |
|---|---|---|
| user_id | UUID | User ID |
| user_name | string | Display name |

---

## Internal Interface

These functions are callable by other modules via internal service calls. They are NOT exposed as HTTP or WebSocket endpoints.

### broadcastToChannel

**Description:** Broadcast a message to all subscribers of a given channel. Used by modules that need to push real-time updates beyond the automatic domain event fan-out (e.g., custom system announcements).

```
broadcastToChannel(
  channel: string,                 // e.g., "tenant:abc123", "event:def456"
  message: {
    type: string,                  // message type
    payload: object                // message payload
  },
  options?: {
    exclude_user_id?: UUID,        // exclude a specific user (e.g., the actor)
    require_permission?: string    // only deliver to users with this permission
  }
) → { delivered_count: integer }
```

---

### getPresence

**Description:** Retrieve the list of users currently subscribed to a given channel. Used for "who's viewing this" indicators and edit-conflict warnings.

```
getPresence(
  channel: string
) → [
  {
    user_id: UUID,
    user_name: string,
    connected_at: ISO 8601 datetime,
    last_heartbeat: ISO 8601 datetime
  }
]
```

---

### sendNotification

**Description:** Create and deliver a notification to a specific user. Handles persistence, preference checking, in-app push via WebSocket, and email enqueuing based on user preferences.

```
sendNotification(
  tenant_id: UUID,
  user_id: UUID,
  notification: {
    type: string,                  // e.g., "assignment", "mention", "deadline", "system"
    title: string,
    body: string,
    payload?: object               // type-specific data for deep linking
  }
) → {
  notification_id: UUID,
  delivered_channels: string[]     // e.g., ["in_app", "email"] or ["in_app"]
}
```

---

## Domain Events

The Collaboration module does **not** publish domain events to the shared event bus. It is a pure consumer — it listens to all domain events from all other modules to power live broadcasts, notification triggers, and activity feeds.

**Consumed events (for reference):** All entity CRUD events from every module, including `event.created`, `event.updated`, `assignment.created`, `assignment.updated`, `assignment.deleted`, `conflict.detected`, `conflict.resolved`, `personnel.created`, `personnel.updated`, `travel.record.created`, `travel.record.updated`, `financial.lineItem.created`, `financial.lineItem.updated`, `analytics.export.ready`, and all others.
