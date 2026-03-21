const TTL_MS = 5 * 60 * 1000;
const store = new Map();
export function tenantCacheGet(id) {
    const e = store.get(id);
    if (!e)
        return null;
    if (Date.now() > e.expiresAt) {
        store.delete(id);
        return null;
    }
    return e.row;
}
export function tenantCacheSet(row) {
    store.set(row.id, { row, expiresAt: Date.now() + TTL_MS });
}
export function tenantCacheInvalidate(id) {
    store.delete(id);
}
