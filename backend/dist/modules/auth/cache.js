/**
 * Permission list cache (short TTL). In-memory by default; optional Redis when
 * REDIS_URL is set (multi-instance / shared invalidation).
 */
import { createClient } from "redis";
const TTL_MS = 60_000;
const TTL_SEC = Math.ceil(TTL_MS / 1000);
const KEY_PREFIX = "pld:perm:";
const memoryCache = new Map();
let redisClient = null;
let redisConnectAttempted = false;
let redisUnavailable = false;
let redisWarned = false;
function redisWarnOnce() {
    if (redisWarned)
        return;
    redisWarned = true;
    console.warn("[auth/cache] Redis unavailable; using in-memory permission cache (single process only).");
}
function cacheKey(tenantId, userId) {
    return `${tenantId}:${userId}`;
}
function memoryGet(tenantId, userId) {
    const k = cacheKey(tenantId, userId);
    const e = memoryCache.get(k);
    if (!e || e.expires < Date.now()) {
        memoryCache.delete(k);
        return null;
    }
    return e.permissions;
}
function memorySet(tenantId, userId, permissions) {
    memoryCache.set(cacheKey(tenantId, userId), {
        permissions,
        expires: Date.now() + TTL_MS,
    });
}
function memoryDelete(tenantId, userId) {
    memoryCache.delete(cacheKey(tenantId, userId));
}
async function getRedisClient() {
    const url = process.env.REDIS_URL?.trim();
    if (!url)
        return null;
    if (redisUnavailable)
        return null;
    if (redisClient)
        return redisClient;
    if (redisConnectAttempted)
        return null;
    redisConnectAttempted = true;
    try {
        const c = createClient({ url });
        c.on("error", () => {
            /* handled on connect */
        });
        await c.connect();
        redisClient = c;
        return c;
    }
    catch {
        redisUnavailable = true;
        redisWarnOnce();
        return null;
    }
}
export async function getCachedPermissions(tenantId, userId) {
    const mem = memoryGet(tenantId, userId);
    if (mem)
        return mem;
    const client = await getRedisClient();
    if (!client)
        return null;
    try {
        const raw = await client.get(`${KEY_PREFIX}${cacheKey(tenantId, userId)}`);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string")) {
            await client.del(`${KEY_PREFIX}${cacheKey(tenantId, userId)}`);
            return null;
        }
        memorySet(tenantId, userId, parsed);
        return parsed;
    }
    catch {
        redisWarnOnce();
        return null;
    }
}
export async function setCachedPermissions(tenantId, userId, permissions) {
    memorySet(tenantId, userId, permissions);
    const client = await getRedisClient();
    if (!client)
        return;
    try {
        await client.set(`${KEY_PREFIX}${cacheKey(tenantId, userId)}`, JSON.stringify(permissions), {
            EX: TTL_SEC,
        });
    }
    catch {
        redisWarnOnce();
    }
}
export async function invalidateUserPermissions(tenantId, userId) {
    memoryDelete(tenantId, userId);
    const client = await getRedisClient();
    if (!client)
        return;
    try {
        await client.del(`${KEY_PREFIX}${cacheKey(tenantId, userId)}`);
    }
    catch {
        redisWarnOnce();
    }
}
