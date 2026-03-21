import { describe, expect, it } from "vitest";
import {
  resolveTenantSettings,
  tenantAuditLoggingEnabledResolved,
  tenantConflictDetectionEnabledResolved,
  tenantDriveTimeBufferHoursResolved,
} from "../src/modules/tenancy/tenant-settings.js";

describe("resolveTenantSettings features", () => {
  it("applies scheduling and data_export defaults", () => {
    const r = resolveTenantSettings({}, "Acme");
    const sched = r.features.scheduling as Record<string, unknown>;
    const de = r.features.data_export as Record<string, unknown>;
    expect(sched.conflict_detection_enabled).toBe(true);
    expect(sched.buffer_windows_enabled).toBe(true);
    expect(sched.drive_time_buffer_hours).toBe(4);
    expect(de.audit_logging_enabled).toBe(true);
    expect(tenantConflictDetectionEnabledResolved(r)).toBe(true);
    expect(tenantAuditLoggingEnabledResolved(r)).toBe(true);
    expect(tenantDriveTimeBufferHoursResolved(r)).toBe(4);
  });

  it("respects partial overrides", () => {
    const r = resolveTenantSettings(
      {
        features: {
          scheduling: { conflict_detection_enabled: false, drive_time_buffer_hours: 200 },
          data_export: { audit_logging_enabled: false },
        },
      },
      "Acme",
    );
    expect(tenantConflictDetectionEnabledResolved(r)).toBe(false);
    expect(tenantAuditLoggingEnabledResolved(r)).toBe(false);
    const sched = r.features.scheduling as Record<string, unknown>;
    expect(sched.drive_time_buffer_hours).toBe(168);
  });
});
