import type { ApiEnvelope, ApiErrorItem } from "@pld/shared";

export function ok<T>(
  data: T,
  meta: Record<string, unknown> | null = null,
): ApiEnvelope<T> {
  return { data, meta, errors: null };
}

export function fail(
  errors: ApiErrorItem[],
  statusCode: number,
): { body: ApiEnvelope<null>; status: number } {
  return {
    status: statusCode,
    body: { data: null, meta: null, errors },
  };
}

export function singleError(
  code: string,
  message: string,
  status: number,
  field?: string,
): { body: ApiEnvelope<null>; status: number } {
  return fail([{ code, message, field }], status);
}
