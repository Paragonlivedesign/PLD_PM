import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    /** Random `X-Tenant-Id` in integration tests has no `tenants` row — bypass DB lookup (see `tenant-resolution.ts`). */
    env: {
      PLD_SKIP_TENANT_RESOLUTION: "1",
    },
  },
});
