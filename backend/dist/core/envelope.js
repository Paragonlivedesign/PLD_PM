export function ok(data, meta) {
    return { data, meta: meta ?? null, errors: null };
}
export function fail(errors, meta) {
    return { data: null, meta: meta ?? null, errors };
}
