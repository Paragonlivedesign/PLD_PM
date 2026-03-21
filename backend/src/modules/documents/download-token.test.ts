import { describe, expect, it } from "vitest";
import { createDownloadToken, verifyDownloadToken } from "./download-token.js";

describe("download-token", () => {
  it("round-trips and binds tenant + document", () => {
    const doc = "11111111-1111-4111-8111-111111111111";
    const tenant = "22222222-2222-4222-8222-222222222222";
    const { token } = createDownloadToken(doc, tenant);
    expect(verifyDownloadToken(token)).toEqual({ documentId: doc, tenantId: tenant });
  });

  it("rejects tampered token", () => {
    const { token } = createDownloadToken(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
    const broken = token.slice(0, -4) + "xxxx";
    expect(verifyDownloadToken(broken)).toBeNull();
  });
});
