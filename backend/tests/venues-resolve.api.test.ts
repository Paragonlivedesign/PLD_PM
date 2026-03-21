import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { buildApp } from "../src/app-factory.js";
import { parseCoordsFromMapsUrl } from "../src/modules/venues/resolve-maps-link.js";

describe("venues resolve-maps-link + banner", () => {
  const app = buildApp();
  let skip = false;

  beforeAll(async () => {
    try {
      const login = await request(app).post("/api/v1/auth/login").send({
        email: "admin@demo.local",
        password: "pld",
        tenant_slug: "demo",
      });
      skip = login.status !== 200;
    } catch {
      skip = true;
    }
  });

  it("parseCoordsFromMapsUrl extracts @lat,lng", () => {
    const c = parseCoordsFromMapsUrl("https://www.google.com/maps/@32.7767,-96.7970,15z");
    expect(c).not.toBeNull();
    expect(c!.lat).toBeCloseTo(32.7767, 4);
    expect(c!.lng).toBeCloseTo(-96.797, 3);
  });

  it("POST /venues/resolve-maps-link returns 403 for viewer (venues:read only)", async () => {
    if (skip) return;
    const login = await request(app).post("/api/v1/auth/login").send({
      email: "viewer-sess@demo.local",
      password: "pld",
      tenant_slug: "demo",
    });
    if (login.status !== 200) return;
    const tok = login.body.data?.access_token as string;
    const res = await request(app)
      .post("/api/v1/venues/resolve-maps-link")
      .set("Authorization", `Bearer ${tok}`)
      .send({ url: "https://www.google.com/maps/@32.77,-96.79,12z" });
    expect(res.status).toBe(403);
  });

  it("POST /venues/resolve-maps-link returns coordinates for manager", async () => {
    if (skip) return;
    const login = await request(app).post("/api/v1/auth/login").send({
      email: "manager-sess@demo.local",
      password: "pld",
      tenant_slug: "demo",
    });
    if (login.status !== 200) return;
    const tok = login.body.data?.access_token as string;
    const res = await request(app)
      .post("/api/v1/venues/resolve-maps-link")
      .set("Authorization", `Bearer ${tok}`)
      .send({ url: "https://www.google.com/maps/@32.7767,-96.7970,15z" });
    expect(res.status).toBe(200);
    expect(res.body.data?.latitude).toBeCloseTo(32.7767, 3);
    expect(res.body.data?.longitude).toBeCloseTo(-96.797, 3);
    expect(["regex", "google"]).toContain(res.body.data?.source);
    expect(res.body.data?.timezone).toBeTruthy();
  });
});
