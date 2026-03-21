import { pool } from "../../db/pool.js";
import { countConflicts, listConflicts, mapConflictRow, } from "./conflicts.repository.js";
export async function listConflictsApi(p) {
    const { limit: _l, cursorId: _c, ...countParams } = p;
    const total = await countConflicts(pool, countParams);
    const raw = await listConflicts(pool, p);
    const hasMore = raw.length > p.limit;
    const slice = hasMore ? raw.slice(0, p.limit) : raw;
    const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1].id : null;
    return {
        rows: slice.map(mapConflictRow),
        total,
        nextCursor,
        hasMore,
    };
}
