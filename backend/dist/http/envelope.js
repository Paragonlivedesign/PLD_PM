export function ok(data, meta = null) {
    return { data, meta, errors: null };
}
export function fail(errors, statusCode) {
    return {
        status: statusCode,
        body: { data: null, meta: null, errors },
    };
}
export function singleError(code, message, status, field) {
    return fail([{ code, message, field }], status);
}
