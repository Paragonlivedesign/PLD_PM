/**
 * Notification preferences REST + sendNotification (in-app gating).
 * Follow-ups: email/Slack outbound workers, quiet hours, comment domain events.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { v7 as uuidv7 } from "uuid";
import { buildApp } from "../src/app-factory.js";
import { pool } from "../src/db/pool.js";
import {
  getPreferences,
  sendNotification,
  updatePreferences,
} from "../src/modules/collaboration/notifications.service.js";
import { NOTIFICATION_TYPES } from "../src/modules/collaboration/notification-types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "../../database/migrations");

function sortedMigrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function ensureSlackChannelConstraint(): Promise<void> {
  const r = await pool.query<{ def: string | null }>(
    `SELECT pg_get_constraintdef(c.oid) AS def
     FROM pg_constraint c
     JOIN pg_class t ON c.conrelid = t.oid
     WHERE t.relname = 'notification_preferences' AND c.conname = 'notification_preferences_channel_check'`,
  );
  const def = r.rows[0]?.def ?? "";
  if (def.includes("slack")) return;
  await pool.query(
    `ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_channel_check`,
  );
  await pool.query(
    `ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_channel_check
     CHECK (channel IN ('in_app', 'email', 'slack'))`,
  );
}

async function ensureSchema(): Promise<boolean> {
  try {
    await pool.query("SELECT 1 FROM notifications LIMIT 1");
    await ensureSlackChannelConstraint();
    return true;
  } catch {
    /* apply migrations */
  }
  try {
    for (const f of sortedMigrationFiles()) {
      const sql = readFileSync(path.join(migrationsDir, f), "utf8");
      await pool.query(sql);
    }
    await pool.query("SELECT 1 FROM notifications LIMIT 1");
    await ensureSlackChannelConstraint();
    return true;
  } catch (e) {
    console.warn("notifications.integration: DB unavailable:", e);
    return false;
  }
}

function apiHeaders(tenantId: string, userId: string) {
  return {
    "x-tenant-id": tenantId,
    "x-user-id": userId,
    "x-permissions": "*",
  };
}

describe("notifications API + sendNotification", () => {
  const app = buildApp();
  let okDb = false;

  beforeAll(async () => {
    okDb = await ensureSchema();
  });

  afterAll(() => {
    /* pool shared */
  });

  it("GET /notifications/preferences returns merged matrix for seven types × three channels", async () => {
    if (!okDb) return;
    const tenantId = uuidv7();
    const userId = uuidv7();
    const res = await request(app)
      .get("/api/v1/notifications/preferences")
      .set(apiHeaders(tenantId, userId));
    expect(res.status).toBe(200);
    const rows = res.body.data as { notification_type: string; channel: string; enabled: boolean }[];
    expect(rows.length).toBe(NOTIFICATION_TYPES.length * 3);
    const types = new Set(rows.map((r) => r.notification_type));
    for (const t of NOTIFICATION_TYPES) {
      expect(types.has(t)).toBe(true);
    }
    const slack = rows.filter((r) => r.channel === "slack");
    expect(slack.length).toBe(NOTIFICATION_TYPES.length);
  });

  it("PUT preferences persists slack channel", async () => {
    if (!okDb) return;
    const tenantId = uuidv7();
    const userId = uuidv7();
    const put = await request(app)
      .put("/api/v1/notifications/preferences")
      .set(apiHeaders(tenantId, userId))
      .send({
        preferences: [
          { notification_type: "phase_transition", channel: "slack", enabled: true },
        ],
      });
    expect(put.status).toBe(200);
    const row = (put.body.data as { notification_type: string; channel: string; enabled: boolean }[]).find(
      (p) => p.notification_type === "phase_transition" && p.channel === "slack",
    );
    expect(row?.enabled).toBe(true);
  });

  it("sendNotification skips in_app insert when pref disabled; inserts when enabled", async () => {
    if (!okDb) return;
    const tenantId = uuidv7();
    const userId = uuidv7();
    await updatePreferences(pool, tenantId, userId, [
      { notification_type: "crew_assignment", channel: "in_app", enabled: false },
    ]);
    const off = await sendNotification(pool, {
      tenantId,
      userId,
      notificationType: "crew_assignment",
      title: "T",
      body: "B",
      payload: {},
    });
    expect(off.notification_id).toBeNull();
    expect(off.delivered_channels).not.toContain("in_app");

    await updatePreferences(pool, tenantId, userId, [
      { notification_type: "crew_assignment", channel: "in_app", enabled: true },
    ]);
    const on = await sendNotification(pool, {
      tenantId,
      userId,
      notificationType: "crew_assignment",
      title: "T2",
      body: "B2",
      payload: { x: 1 },
    });
    expect(on.notification_id).not.toBeNull();
    expect(on.delivered_channels).toContain("in_app");

    const list = await request(app)
      .get("/api/v1/notifications?limit=10")
      .set(apiHeaders(tenantId, userId));
    expect(list.status).toBe(200);
    const data = list.body.data as { id: string; title: string }[];
    expect(data.some((n) => n.title === "T2")).toBe(true);
  });

  it("getPreferences merges stored rows over defaults", async () => {
    if (!okDb) return;
    const tenantId = uuidv7();
    const userId = uuidv7();
    await updatePreferences(pool, tenantId, userId, [
      { notification_type: "budget_alert", channel: "email", enabled: false },
    ]);
    const prefs = await getPreferences(pool, tenantId, userId);
    const emailBudget = prefs.find((p) => p.notification_type === "budget_alert" && p.channel === "email");
    expect(emailBudget?.enabled).toBe(false);
    const inAppBudget = prefs.find((p) => p.notification_type === "budget_alert" && p.channel === "in_app");
    expect(inAppBudget?.enabled).toBe(false);
  });
});
