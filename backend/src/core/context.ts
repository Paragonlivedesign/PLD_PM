import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContext = {
  tenantId: string;
  userId: string;
  permissions: Set<string>;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function getContext(): RequestContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error("No request context — middleware not applied");
  }
  return ctx;
}

export function tryGetContext(): RequestContext | undefined {
  return storage.getStore();
}

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function hasPermission(required: string): boolean {
  const ctx = tryGetContext();
  if (!ctx) return false;
  if (ctx.permissions.has("*")) return true;
  return ctx.permissions.has(required);
}
