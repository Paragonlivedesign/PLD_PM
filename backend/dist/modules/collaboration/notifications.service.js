import { randomUUID } from "node:crypto";
import { defaultPreferenceRows, isNotificationType, } from "./notification-types.js";
function encodeCursor(createdAt, id) {
    return Buffer.from(JSON.stringify({ t: createdAt, id }), "utf8").toString("base64url");
}
function decodeCursor(cursor) {
    try {
        const raw = Buffer.from(cursor, "base64url").toString("utf8");
        const o = JSON.parse(raw);
        if (o.t && o.id)
            return { t: o.t, id: o.id };
        return null;
    }
    catch {
        return null;
    }
}
function isAllowedChannel(c) {
    return c === "in_app" || c === "email" || c === "slack";
}
async function resolveChannelStates(pool, tenantId, userId, notificationType) {
    const defaults = defaultPreferenceRows();
    const base = {
        in_app: true,
        email: true,
        slack: false,
    };
    if (isNotificationType(notificationType)) {
        const row = defaults.filter((d) => d.notification_type === notificationType);
        for (const d of row) {
            base[d.channel] = d.enabled;
        }
    }
    const { rows } = await pool.query(`SELECT channel, enabled FROM notification_preferences
     WHERE tenant_id = $1 AND user_id = $2 AND notification_type = $3`, [tenantId, userId, notificationType]);
    for (const r of rows) {
        if (isAllowedChannel(r.channel)) {
            base[r.channel] = r.enabled;
        }
    }
    return base;
}
/**
 * Persist in-app row when in_app pref enabled; log email/slack stubs when enabled.
 * Matches internal contract sendNotification shape (delivered_channels).
 */
export async function sendNotification(pool, input) {
    const { tenantId, userId, notificationType, title, body, payload = {} } = input;
    const channels = await resolveChannelStates(pool, tenantId, userId, notificationType);
    const delivered = [];
    let notification_id = null;
    if (channels.in_app) {
        const id = randomUUID();
        await pool.query(`INSERT INTO notifications (id, tenant_id, user_id, type, title, body, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`, [id, tenantId, userId, notificationType, title, body, JSON.stringify(payload)]);
        notification_id = id;
        delivered.push("in_app");
    }
    if (channels.email) {
        delivered.push("email");
        console.info("[notifications] email_enqueue_stub", {
            tenantId,
            userId,
            notificationType,
            title,
        });
    }
    if (channels.slack) {
        delivered.push("slack");
        console.info("[notifications] slack_enqueue_stub", {
            tenantId,
            userId,
            notificationType,
            title,
        });
    }
    return { notification_id, delivered_channels: delivered };
}
export async function listNotifications(pool, args) {
    const lim = Math.min(100, Math.max(1, args.limit));
    let filterExtra = "";
    if (args.status === "unread") {
        filterExtra += " AND read_at IS NULL";
    }
    else if (args.status === "read") {
        filterExtra += " AND read_at IS NOT NULL";
    }
    const params = [args.tenantId, args.userId];
    let n = 3;
    if (args.type) {
        filterExtra += ` AND type = $${n}`;
        params.push(args.type);
        n++;
    }
    let cursorExtra = "";
    if (args.cursor) {
        const c = decodeCursor(args.cursor);
        if (c) {
            cursorExtra = ` AND (created_at, id) < ($${n}::timestamptz, $${n + 1}::uuid)`;
            params.push(c.t, c.id);
            n += 2;
        }
    }
    const order = args.sort_order === "asc" ? "ASC" : "DESC";
    params.push(lim + 1);
    const limIdx = n;
    const { rows: list } = await pool.query(`SELECT id, type, title, body, payload, read_at, created_at
     FROM notifications
     WHERE tenant_id = $1 AND user_id = $2${filterExtra}${cursorExtra}
     ORDER BY created_at ${order}, id ${order}
     LIMIT $${limIdx}`, params);
    const hasMore = list.length > lim;
    const slice = hasMore ? list.slice(0, lim) : list;
    const last = slice[slice.length - 1];
    const nextCursor = hasMore && last
        ? encodeCursor(last.created_at.toISOString(), last.id)
        : null;
    const countParams = [args.tenantId, args.userId];
    if (args.type) {
        countParams.push(args.type);
    }
    const { rows: tc } = await pool.query(`SELECT COUNT(*)::text AS c FROM notifications WHERE tenant_id = $1 AND user_id = $2${filterExtra}`, countParams);
    const { rows: uc } = await pool.query(`SELECT COUNT(*)::text AS c FROM notifications WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL`, [args.tenantId, args.userId]);
    return {
        rows: slice.map((r) => ({
            id: r.id,
            type: r.type,
            title: r.title,
            body: r.body,
            payload: r.payload ?? {},
            read_at: r.read_at ? r.read_at.toISOString() : null,
            created_at: r.created_at.toISOString(),
        })),
        nextCursor,
        total_count: Number(tc[0]?.c ?? 0),
        unread_count: Number(uc[0]?.c ?? 0),
    };
}
export async function markNotificationRead(pool, tenantId, userId, id) {
    const { rows } = await pool.query(`UPDATE notifications SET read_at = COALESCE(read_at, NOW())
     WHERE id = $1 AND tenant_id = $2 AND user_id = $3
     RETURNING id, type, title, body, payload, read_at, created_at`, [id, tenantId, userId]);
    const r = rows[0];
    if (!r)
        return null;
    return {
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        payload: r.payload ?? {},
        read_at: r.read_at ? r.read_at.toISOString() : null,
        created_at: r.created_at.toISOString(),
    };
}
export async function markAllRead(pool, tenantId, userId) {
    const r = await pool.query(`UPDATE notifications SET read_at = NOW()
     WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL`, [tenantId, userId]);
    return r.rowCount ?? 0;
}
function prefKey(t, c) {
    return `${t}\0${c}`;
}
/** Merged matrix for the seven canonical types (Settings + API). */
export async function getPreferences(pool, tenantId, userId) {
    const defaults = defaultPreferenceRows();
    const merged = new Map();
    for (const d of defaults) {
        merged.set(prefKey(d.notification_type, d.channel), d.enabled);
    }
    const { rows } = await pool.query(`SELECT notification_type, channel, enabled FROM notification_preferences
     WHERE tenant_id = $1 AND user_id = $2`, [tenantId, userId]);
    for (const r of rows) {
        if (!isNotificationType(r.notification_type) || !isAllowedChannel(r.channel))
            continue;
        merged.set(prefKey(r.notification_type, r.channel), r.enabled);
    }
    return defaults.map((d) => ({
        notification_type: d.notification_type,
        channel: d.channel,
        enabled: merged.get(prefKey(d.notification_type, d.channel)) ?? d.enabled,
    }));
}
export async function updatePreferences(pool, tenantId, userId, preferences) {
    for (const pref of preferences) {
        await pool.query(`INSERT INTO notification_preferences (id, tenant_id, user_id, notification_type, channel, enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, user_id, notification_type, channel)
       DO UPDATE SET enabled = EXCLUDED.enabled`, [
            randomUUID(),
            tenantId,
            userId,
            pref.notification_type,
            pref.channel,
            pref.enabled,
        ]);
    }
}
