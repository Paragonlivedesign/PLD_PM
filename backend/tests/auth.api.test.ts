import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { buildApp } from "../src/app-factory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "../../database/migrations");

function readMigration(name: string): string {
  return readFileSync(path.join(migrationsDir, name), "utf8");
}

describe("auth HTTP API", () => {
  const app = buildApp();
  let pool: pg.Pool;
  let skip = false;

  const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";
  const VIEWER_ROLE = "10000000-0000-0000-0000-000000000004";
  const MANAGER_ROLE = "10000000-0000-0000-0000-000000000002";
  const VIEWER_USER_ID = "40000000-0000-0000-0000-000000000001";
  const MANAGER_USER_ID = "30000000-0000-0000-0000-000000000001";
  /** Dev seed password `pld` — matches migration 018 / seed-postgres.mjs */
  const PLD_BCRYPT =
    "$2b$12$7zbywjby2mQvBBlSxE7.gOw5jVUQOV4QZVot/Nx8PjDobit0vyuQC";

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "vitest-jwt-secret-min-32-chars!!";
    const conn = process.env.DATABASE_URL ?? "postgresql://pld:pld@127.0.0.1:5432/pld_dev";
    pool = new pg.Pool({ connectionString: conn });
    try {
      const check = await pool.query(`SELECT to_regclass('public.personnel') AS t`);
      if (!check.rows[0]?.t) {
        await pool.query(readMigration("001_init_events_clients_venues.sql"));
        await pool.query(readMigration("002_personnel_departments_invitations.sql"));
      }
      const authTbl = await pool.query(`SELECT to_regclass('public.users') AS t`);
      if (!authTbl.rows[0]?.t) {
        await pool.query(readMigration("005_auth_module.sql"));
      }
      await pool.query(
        `INSERT INTO users (id, tenant_id, email, password_hash, role_id, first_name, last_name, is_active)
         VALUES ($1, $2, 'viewer-sess@demo.local', $3, $4, 'T', 'V', true)
         ON CONFLICT (id) DO NOTHING`,
        [VIEWER_USER_ID, DEMO_TENANT, PLD_BCRYPT, VIEWER_ROLE],
      );
      await pool.query(
        `INSERT INTO users (id, tenant_id, email, password_hash, role_id, first_name, last_name, is_active)
         VALUES ($1, $2, 'manager-sess@demo.local', $3, $4, 'T', 'M', true)
         ON CONFLICT (id) DO NOTHING`,
        [MANAGER_USER_ID, DEMO_TENANT, PLD_BCRYPT, MANAGER_ROLE],
      );
      const ADMIN_ID = "00000000-0000-0000-0000-000000000002";
      const resetPwd = `UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
        WHERE tenant_id = $2::uuid AND id = $3::uuid`;
      await pool.query(resetPwd, [PLD_BCRYPT, DEMO_TENANT, ADMIN_ID]);
      await pool.query(resetPwd, [PLD_BCRYPT, DEMO_TENANT, VIEWER_USER_ID]);
      await pool.query(resetPwd, [PLD_BCRYPT, DEMO_TENANT, MANAGER_USER_ID]);
    } catch {
      skip = true;
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("POST /api/v1/auth/register creates viewer + returns tokens (CP0.3)", async () => {
    if (skip) return;
    const email = `reg-${Date.now()}@demo.local`;
    const reg = await request(app).post("/api/v1/auth/register").send({
      email,
      password: "Password1!ok",
      tenant_slug: "demo",
      first_name: "Reg",
      last_name: "User",
    });
    expect(reg.status).toBe(201);
    expect(reg.body.data?.access_token).toBeTruthy();
    expect(reg.body.data?.user?.email).toBe(email);
    expect(reg.body.data?.user?.role).toBe("viewer");

    const login = await request(app).post("/api/v1/auth/login").send({
      email,
      password: "Password1!ok",
      tenant_slug: "demo",
    });
    expect(login.status).toBe(200);
    expect(login.body.data?.access_token).toBeTruthy();
  });

  it("POST /api/v1/auth/login + GET /me Bearer", async () => {
    if (skip) return;
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "admin@demo.local",
        password: "pld",
        tenant_slug: "demo",
      });
    expect(login.status).toBe(200);
    expect(login.body.data?.access_token).toBeTruthy();
    expect(login.body.data?.user?.email).toBe("admin@demo.local");
    expect(login.body.data?.user?.is_platform_admin).toBe(false);

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${login.body.data.access_token}`);
    expect(me.status).toBe(200);
    expect(me.body.data?.permissions).toContain("*");
  });

  it("POST /api/v1/auth/refresh", async () => {
    if (skip) return;
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "admin@demo.local",
        password: "pld",
        tenant_slug: "demo",
      });
    const refresh = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refresh_token: login.body.data.refresh_token });
    expect(refresh.status).toBe(200);
    expect(refresh.body.data?.access_token).toBeTruthy();
    expect(refresh.body.data?.refresh_token).toBeTruthy();
  });

  it("dev headers still work for personnel when PLD_DEV_AUTH_HEADERS default", async () => {
    if (skip) return;
    const res = await request(app)
      .get("/api/v1/personnel")
      .set({
        "X-Tenant-Id": "00000000-0000-0000-0000-000000000001",
        "X-User-Id": "00000000-0000-0000-0000-000000000002",
        "X-Permissions": "*",
      });
    expect(res.status).toBe(200);
  });

  it("POST /auth/logout-all revokes all refresh tokens for the user", async () => {
    if (skip) return;
    const a = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "admin@demo.local",
        password: "pld",
        tenant_slug: "demo",
      });
    const b = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "admin@demo.local",
        password: "pld",
        tenant_slug: "demo",
      });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const token = a.body.data.access_token as string;
    const r1 = a.body.data.refresh_token as string;
    const r2 = b.body.data.refresh_token as string;
    const out = await request(app)
      .post("/api/v1/auth/logout-all")
      .set("Authorization", `Bearer ${token}`);
    expect(out.status).toBe(200);
    expect(out.body.data?.message).toBe("All sessions logged out");
    const x1 = await request(app).post("/api/v1/auth/refresh").send({ refresh_token: r1 });
    const x2 = await request(app).post("/api/v1/auth/refresh").send({ refresh_token: r2 });
    expect(x1.status).toBe(401);
    expect(x2.status).toBe(401);
  });

  it("POST /auth/users/:id/sessions/revoke (admin) invalidates target refresh tokens", async () => {
    if (skip) return;
    const viewerLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "viewer-sess@demo.local",
        password: "pld",
        tenant_slug: "demo",
      });
    expect(viewerLogin.status).toBe(200);
    const vRefresh = viewerLogin.body.data.refresh_token as string;
    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "admin@demo.local",
        password: "pld",
        tenant_slug: "demo",
      });
    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.body.data.access_token as string;
    const revoke = await request(app)
      .post(`/api/v1/auth/users/${VIEWER_USER_ID}/sessions/revoke`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(revoke.status).toBe(200);
    expect(revoke.body.data?.message).toBe("Sessions revoked for user");
    const bad = await request(app).post("/api/v1/auth/refresh").send({ refresh_token: vRefresh });
    expect(bad.status).toBe(401);
  });

  it("POST /auth/users/:id/sessions/revoke returns 404 for unknown user in tenant", async () => {
    if (skip) return;
    const adminLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "admin@demo.local",
        password: "pld",
        tenant_slug: "demo",
      });
    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.body.data.access_token as string;
    const res = await request(app)
      .post("/api/v1/auth/users/99999999-9999-9999-9999-999999999999/sessions/revoke")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("POST /auth/users/:id/sessions/revoke returns 403 without auth.sessions.revoke", async () => {
    if (skip) return;
    const mgr = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "manager-sess@demo.local",
        password: "pld",
        tenant_slug: "demo",
      });
    expect(mgr.status).toBe(200);
    const token = mgr.body.data.access_token as string;
    const res = await request(app)
      .post(`/api/v1/auth/users/${VIEWER_USER_ID}/sessions/revoke`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
