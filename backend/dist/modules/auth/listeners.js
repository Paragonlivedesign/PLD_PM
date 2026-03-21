import { onEvent } from "../../core/events.js";
import { pool } from "../../db/pool.js";
import * as repo from "./repository.js";
import * as cache from "./cache.js";
/** Invalidate permission cache when personnel role changes (linked user). */
export function registerAuthEventListeners() {
    onEvent("personnel.role_changed", (payload) => {
        void (async () => {
            const tenantId = String(payload.tenant_id ?? "");
            const personnelId = String(payload.personnel_id ?? "");
            if (!tenantId || !personnelId)
                return;
            const userId = await repo.findUserIdByPersonnel(pool, tenantId, personnelId);
            if (userId) {
                await cache.invalidateUserPermissions(tenantId, userId);
            }
        })();
    });
}
