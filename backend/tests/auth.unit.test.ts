import { describe, expect, it, beforeAll } from "vitest";
import * as pwd from "../src/modules/auth/password.js";
import * as jwt from "../src/modules/auth/jwt.js";

describe("auth unit", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "vitest-jwt-secret-min-32-chars!!";
  });

  it("password hash and verify", async () => {
    const h = await pwd.hashPassword("correct horse battery");
    expect(await pwd.verifyPassword("correct horse battery", h)).toBe(true);
    expect(await pwd.verifyPassword("wrong", h)).toBe(false);
  });

  it("JWT sign and validate (HS256 dev)", async () => {
    const token = await jwt.signAccessToken({
      sub: "00000000-0000-0000-0000-000000000002",
      tid: "00000000-0000-0000-0000-000000000001",
      role: "admin",
      pid: null,
    });
    const v = await jwt.validateAccessToken(token);
    expect(v.valid).toBe(true);
    if (v.valid) {
      expect(v.claims.sub).toBe("00000000-0000-0000-0000-000000000002");
      expect(v.claims.tid).toBe("00000000-0000-0000-0000-000000000001");
    }
  });
});
