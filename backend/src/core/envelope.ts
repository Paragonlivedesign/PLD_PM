export type ApiError = { code: string; message: string; field?: string; details?: unknown };

export type Envelope<T> = {
  data: T | null;
  meta: Record<string, unknown> | null;
  errors: ApiError[] | null;
};

export function ok<T>(data: T, meta?: Record<string, unknown> | null): Envelope<T> {
  return { data, meta: meta ?? null, errors: null };
}

export function fail(errors: ApiError[], meta?: Record<string, unknown> | null): Envelope<null> {
  return { data: null, meta: meta ?? null, errors };
}
