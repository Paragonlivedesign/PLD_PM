import { AsyncLocalStorage } from "node:async_hooks";
const storage = new AsyncLocalStorage();
export function getContext() {
    const ctx = storage.getStore();
    if (!ctx) {
        throw new Error("No request context — middleware not applied");
    }
    return ctx;
}
export function tryGetContext() {
    return storage.getStore();
}
export function runWithContext(ctx, fn) {
    return storage.run(ctx, fn);
}
export function hasPermission(required) {
    const ctx = tryGetContext();
    if (!ctx)
        return false;
    if (ctx.permissions.has("*"))
        return true;
    return ctx.permissions.has(required);
}
