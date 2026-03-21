import type { BulkAssignmentResult, ConflictSummary, CrewAssignmentResponse, TruckAssignmentResponse } from "@pld/shared";
import type { PoolClient } from "pg";
import { v7 as uuidv7 } from "uuid";
import { domainBus } from "../../domain/bus.js";
import { pool } from "../../db/pool.js";
import { createCrewAssignmentApi } from "./crew-assignments.service.js";
import { createTruckAssignmentApi } from "./truck-assignments.service.js";

export type BulkAssignmentItemInput = {
  type: "crew" | "truck";
  event_id: string;
  resource_id: string;
  role?: string;
  start_date: string;
  end_date: string;
  status?: string;
  notes?: string | null;
};

export async function bulkCreateAssignmentsApi(input: {
  tenantId: string;
  userId: string;
  assignments: BulkAssignmentItemInput[];
  conflictStrategy: "fail" | "warn" | "skip";
}): Promise<
  | {
      ok: true;
      data: BulkAssignmentResult;
      meta: {
        total_requested: number;
        total_created: number;
        total_skipped: number;
        conflicts: ConflictSummary[];
        operation_id: string;
      };
    }
  | { ok: false; status: number; code: string; message: string }
> {
  if (input.assignments.length > 50) {
    return {
      ok: false,
      status: 400,
      code: "VALIDATION",
      message: "Maximum 50 assignments per bulk request",
    };
  }
  if (input.assignments.length === 0) {
    return {
      ok: false,
      status: 400,
      code: "VALIDATION",
      message: "assignments array is required",
    };
  }

  const strategy = input.conflictStrategy ?? "fail";
  const created: (CrewAssignmentResponse | TruckAssignmentResponse)[] = [];
  const skipped: BulkAssignmentResult["skipped"] = [];
  const allConflicts: ConflictSummary[] = [];

  const runOne = async (client: PoolClient | undefined, item: BulkAssignmentItemInput) => {
    if (item.type === "crew") {
      const role = item.role?.trim() || "Crew";
      const r = await createCrewAssignmentApi({
        tenantId: input.tenantId,
        userId: input.userId,
        eventId: item.event_id,
        personnelId: item.resource_id,
        role,
        departmentId: null,
        startDate: item.start_date.slice(0, 10),
        endDate: item.end_date.slice(0, 10),
        startTime: null,
        endTime: null,
        dayRateOverride: null,
        perDiemOverride: null,
        notes: item.notes ?? null,
        status: item.status ?? "tentative",
        client,
      });
      return { kind: "crew" as const, r };
    }
    const r = await createTruckAssignmentApi({
      tenantId: input.tenantId,
      userId: input.userId,
      eventId: item.event_id,
      truckId: item.resource_id,
      purpose: null,
      startDate: item.start_date.slice(0, 10),
      endDate: item.end_date.slice(0, 10),
      driverId: null,
      notes: item.notes ?? null,
      status: item.status ?? "tentative",
      client,
    });
    return { kind: "truck" as const, r };
  };

  if (strategy === "fail") {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const item of input.assignments) {
        const out = await runOne(client, item);
        if (!out.r.ok) {
          await client.query("ROLLBACK");
          return {
            ok: false,
            status: out.r.status,
            code: out.r.code,
            message: out.r.message,
          };
        }
        created.push(out.r.data);
        allConflicts.push(...out.r.conflicts);
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } else if (strategy === "warn") {
    for (const item of input.assignments) {
      const out = await runOne(undefined, item);
      if (!out.r.ok) continue;
      created.push(out.r.data);
      allConflicts.push(...out.r.conflicts);
    }
  } else {
    for (let i = 0; i < input.assignments.length; i++) {
      const item = input.assignments[i]!;
      const out = await runOne(undefined, item);
      if (!out.r.ok) {
        skipped.push({
          index: i,
          reason: out.r.message,
          conflicts: [],
        });
        continue;
      }
      created.push(out.r.data);
      allConflicts.push(...out.r.conflicts);
    }
  }

  const operationId = uuidv7();
  domainBus.emit("bulk_operation.completed", {
    operation_id: operationId,
    tenant_id: input.tenantId,
    initiated_by: input.userId,
    conflict_strategy: strategy,
    total_requested: input.assignments.length,
    total_created: created.length,
    total_skipped: skipped.length,
    completed_at: new Date().toISOString(),
  });

  return {
    ok: true,
    data: { created, skipped },
    meta: {
      total_requested: input.assignments.length,
      total_created: created.length,
      total_skipped: skipped.length,
      conflicts: allConflicts,
      operation_id: operationId,
    },
  };
}
