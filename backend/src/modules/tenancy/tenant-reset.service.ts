/**
 * Destructive: deletes all operational rows for a tenant while preserving
 * tenants, users, roles, and auth structure (login still works).
 */
import type { PoolClient } from "pg";
import { pool } from "../../db/pool.js";
import { HttpError } from "../../core/http-error.js";
import { LocalFileStorageAdapter } from "../documents/storage.js";
import { tenantCacheInvalidate } from "./tenant-cache.js";

const storage = new LocalFileStorageAdapter();

export function isTenantDataResetAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const v = process.env.PLD_ALLOW_TENANT_DATA_RESET;
  return v === "1" || v === "true";
}

async function deleteDocumentFiles(client: PoolClient, tenantId: string): Promise<void> {
  const r = await client.query<{ storage_key: string }>(
    `SELECT storage_key FROM documents WHERE tenant_id = $1`,
    [tenantId],
  );
  for (const row of r.rows) {
    try {
      await storage.deleteObject(tenantId, row.storage_key);
    } catch {
      /* best-effort */
    }
  }
}

/**
 * Runs in a single transaction. Order respects FK dependencies (children first).
 */
export async function resetTenantOperationalData(tenantId: string): Promise<{ deleted_tables: number }> {
  if (!isTenantDataResetAllowed()) {
    throw new HttpError(
      403,
      "FORBIDDEN",
      "Tenant data reset is disabled. Set PLD_ALLOW_TENANT_DATA_RESET=1 in production or use a non-production NODE_ENV.",
    );
  }

  const client = await pool.connect();
  let steps = 0;
  try {
    await client.query("BEGIN");

    const run = async (sql: string) => {
      await client.query(sql, [tenantId]);
      steps += 1;
    };

    await run(`DELETE FROM search_index WHERE tenant_id = $1`);
    await run(`DELETE FROM audit_logs WHERE tenant_id = $1`);
    await run(`DELETE FROM notifications WHERE tenant_id = $1`);
    await run(`DELETE FROM notification_preferences WHERE tenant_id = $1`);

    await run(
      `DELETE FROM scheduling_conflict_participants WHERE conflict_id IN (SELECT id FROM scheduling_conflicts WHERE tenant_id = $1)`,
    );
    await run(`DELETE FROM scheduling_conflicts WHERE tenant_id = $1`);

    await run(`DELETE FROM crew_assignments WHERE tenant_id = $1`);
    await run(`DELETE FROM truck_routes WHERE tenant_id = $1`);
    await run(`DELETE FROM truck_assignments WHERE tenant_id = $1`);
    await run(`DELETE FROM travel_records WHERE tenant_id = $1`);

    await run(`DELETE FROM rider_items WHERE tenant_id = $1`);
    await run(`DELETE FROM email_drafts WHERE tenant_id = $1`);

    await deleteDocumentFiles(client, tenantId);
    await run(`DELETE FROM documents WHERE tenant_id = $1`);

    await run(`DELETE FROM invoice_line_items WHERE tenant_id = $1`);
    await run(`DELETE FROM invoices WHERE tenant_id = $1`);
    await run(`DELETE FROM financial_records WHERE tenant_id = $1`);
    await run(`DELETE FROM financial_line_items WHERE tenant_id = $1`);

    await run(`DELETE FROM pay_statements WHERE tenant_id = $1`);
    await run(`DELETE FROM pay_periods WHERE tenant_id = $1`);
    await run(`DELETE FROM time_entries WHERE tenant_id = $1`);

    await run(`DELETE FROM personnel_invitations WHERE tenant_id = $1`);
    await run(`DELETE FROM personnel_blocked_dates WHERE tenant_id = $1`);

    await run(`DELETE FROM auth_invitations WHERE tenant_id = $1`);

    await run(`UPDATE users SET personnel_id = NULL WHERE tenant_id = $1`);

    await run(`DELETE FROM personnel WHERE tenant_id = $1`);

    await run(`DELETE FROM custom_field_index WHERE tenant_id = $1`);
    await run(`DELETE FROM custom_field_definitions WHERE tenant_id = $1`);

    await run(`DELETE FROM events WHERE tenant_id = $1`);

    await run(`DELETE FROM contacts WHERE tenant_id = $1`);

    await run(`DELETE FROM vendors WHERE tenant_id = $1`);
    await run(`DELETE FROM clients WHERE tenant_id = $1`);
    await run(`DELETE FROM venues WHERE tenant_id = $1`);

    await run(`DELETE FROM trucks WHERE tenant_id = $1`);

    await run(`DELETE FROM document_templates WHERE tenant_id = $1`);

    await run(`DELETE FROM field_visibility_rules WHERE tenant_id = $1`);

    await run(`DELETE FROM departments WHERE tenant_id = $1`);

    await run(`DELETE FROM refresh_tokens WHERE tenant_id = $1`);
    await run(`DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE tenant_id = $1)`);

    await client.query("COMMIT");
    tenantCacheInvalidate(tenantId);
    return { deleted_tables: steps };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
