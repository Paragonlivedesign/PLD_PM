/**
 * Phase 0 / API foundation — unknown routes under /api return the standard envelope.
 */
import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildApp } from "../src/app-factory.js";

describe("API envelope — 404 for unknown /api routes", () => {
  const app = buildApp();

  it("GET /api/v1/no-such-route returns JSON fail envelope with NOT_FOUND", async () => {
    const res = await request(app).get("/api/v1/no-such-route-pld-test-404");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      data: null,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "NOT_FOUND", message: expect.any(String) }),
      ]),
    });
  });
});
