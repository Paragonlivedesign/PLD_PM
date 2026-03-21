import * as jose from "jose";
const ACCESS_TTL_SEC = 15 * 60;
function getSecret() {
    const s = process.env.JWT_SECRET?.trim();
    if (!s)
        return null;
    return new TextEncoder().encode(s);
}
let rsaPrivate = null;
let rsaPublic = null;
async function loadRsaKeys() {
    if (rsaPrivate && rsaPublic)
        return { privateKey: rsaPrivate, publicKey: rsaPublic };
    const privPem = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const pubPem = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, "\n");
    if (!privPem || !pubPem)
        throw new Error("JWT RSA keys not configured");
    rsaPrivate = await jose.importPKCS8(privPem, "RS256");
    rsaPublic = await jose.importSPKI(pubPem, "RS256");
    return { privateKey: rsaPrivate, publicKey: rsaPublic };
}
function useRs256() {
    return Boolean(process.env.JWT_PRIVATE_KEY?.trim() && process.env.JWT_PUBLIC_KEY?.trim());
}
export async function signAccessToken(claims) {
    if (useRs256()) {
        const { privateKey } = await loadRsaKeys();
        return new jose.SignJWT({
            tid: claims.tid,
            role: claims.role,
            pid: claims.pid ?? "",
        })
            .setProtectedHeader({ alg: "RS256" })
            .setSubject(claims.sub)
            .setIssuedAt()
            .setExpirationTime(`${ACCESS_TTL_SEC}s`)
            .sign(privateKey);
    }
    const secret = getSecret();
    if (!secret)
        throw new Error("JWT_SECRET not configured");
    return new jose.SignJWT({
        tid: claims.tid,
        role: claims.role,
        pid: claims.pid ?? "",
    })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(claims.sub)
        .setIssuedAt()
        .setExpirationTime(`${ACCESS_TTL_SEC}s`)
        .sign(secret);
}
export async function validateAccessToken(token) {
    try {
        if (useRs256()) {
            const { publicKey } = await loadRsaKeys();
            const { payload } = await jose.jwtVerify(token, publicKey, { algorithms: ["RS256"] });
            return normalizePayload(payload);
        }
        const secret = getSecret();
        if (!secret)
            return { valid: false, error: "jwt_not_configured" };
        const { payload } = await jose.jwtVerify(token, secret, { algorithms: ["HS256"] });
        return normalizePayload(payload);
    }
    catch (e) {
        return { valid: false, error: e instanceof Error ? e.message : "invalid_token" };
    }
}
function normalizePayload(payload) {
    const sub = payload.sub;
    const tid = payload.tid;
    const role = payload.role;
    if (!sub || !tid || !role) {
        return { valid: false, error: "missing_claims" };
    }
    const pidRaw = payload.pid;
    const pid = pidRaw && pidRaw.length > 0 ? pidRaw : null;
    const exp = payload.exp;
    if (typeof exp !== "number")
        return { valid: false, error: "missing_exp" };
    return {
        valid: true,
        claims: { sub, tid, role, pid, exp },
    };
}
export function accessTokenTtlSeconds() {
    return ACCESS_TTL_SEC;
}
