/** Express 5 types dynamic segments as `string | string[]`. */
export function routeParam(v) {
    if (v == null)
        return "";
    return typeof v === "string" ? v : (v[0] ?? "");
}
