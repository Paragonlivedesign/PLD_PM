import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import { resolveBearerContext } from "../auth/middleware-support.js";
/** ws `WebSocket.OPEN` — avoid clashing with DOM `WebSocket` type. */
const WS_OPEN = 1;
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function devHeadersAllowed() {
    return process.env.PLD_DEV_AUTH_HEADERS !== "false";
}
function broadcastRoom(room, msg, except) {
    const raw = JSON.stringify(msg);
    for (const c of room) {
        if (c === except)
            continue;
        if (c.readyState === WS_OPEN)
            c.send(raw);
    }
}
async function resolveWsAuth(token, tenantIdFromMessage) {
    const trimmed = token.trim();
    if (!trimmed)
        return null;
    const ctx = await resolveBearerContext(trimmed);
    if (ctx) {
        return { tenantId: ctx.tenantId, userId: ctx.userId };
    }
    if (devHeadersAllowed() && trimmed === "dev") {
        const tid = tenantIdFromMessage?.trim();
        if (tid && uuidRe.test(tid)) {
            return { tenantId: tid, userId: "00000000-0000-4000-8000-000000000001" };
        }
    }
    return null;
}
/**
 * `/ws` — `auth` / `reauth` with JWT validation (`resolveBearerContext`), then `subscribe` / `unsubscribe`.
 * Dev-only: when `PLD_DEV_AUTH_HEADERS` is not `false`, `token: "dev"` + `tenant_id` UUID is accepted (matches UI presence helper).
 */
export function attachWebSocketServer(server) {
    const wss = new WebSocketServer({ noServer: true });
    const rooms = new Map();
    function leaveAllChannels(ws) {
        if (!ws.channels?.size)
            return;
        for (const ch of [...ws.channels]) {
            const set = rooms.get(ch);
            if (set) {
                set.delete(ws);
                if (set.size === 0)
                    rooms.delete(ch);
                else {
                    broadcastRoom(set, {
                        id: randomUUID(),
                        type: "presence_update",
                        channel: ch,
                        payload: { connected: set.size },
                        timestamp: new Date().toISOString(),
                    });
                }
            }
        }
        ws.channels?.clear();
    }
    function leaveChannel(ws, ch) {
        const set = rooms.get(ch);
        if (!set)
            return;
        set.delete(ws);
        ws.channels?.delete(ch);
        if (set.size === 0)
            rooms.delete(ch);
        else {
            broadcastRoom(set, {
                id: randomUUID(),
                type: "presence_update",
                channel: ch,
                payload: { connected: set.size },
                timestamp: new Date().toISOString(),
            });
        }
    }
    server.on("upgrade", (req, socket, head) => {
        const path = req.url?.split("?")[0];
        if (path !== "/ws") {
            socket.destroy();
            return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
            const c = ws;
            c.channels = new Set();
            const timer = setTimeout(() => {
                if (!c.authed) {
                    c.close(4401, "auth timeout");
                }
            }, 5000);
            ws.on("close", () => {
                clearTimeout(timer);
                leaveAllChannels(c);
            });
            ws.on("message", (raw) => {
                void (async () => {
                    try {
                        const msg = JSON.parse(raw.toString());
                        const msgType = msg.type;
                        if (msgType === "auth" || msgType === "reauth") {
                            const tok = msg.token != null ? String(msg.token) : "";
                            const resolved = await resolveWsAuth(tok, msg.tenant_id);
                            if (!resolved) {
                                c.send(JSON.stringify({
                                    id: randomUUID(),
                                    type: "auth_error",
                                    channel: "system",
                                    payload: {
                                        code: "unauthorized",
                                        message: "Invalid or expired access token",
                                    },
                                    timestamp: new Date().toISOString(),
                                }));
                                c.close(4401, "unauthorized");
                                return;
                            }
                            if (msgType === "reauth" && c.authed && c.tenantId && c.tenantId !== resolved.tenantId) {
                                leaveAllChannels(c);
                            }
                            c.authed = true;
                            c.tenantId = resolved.tenantId;
                            c.userId = resolved.userId;
                            clearTimeout(timer);
                            c.send(JSON.stringify({
                                id: randomUUID(),
                                type: "auth_ok",
                                channel: "system",
                                payload: {
                                    tenant_id: resolved.tenantId,
                                    user_id: resolved.userId,
                                },
                                timestamp: new Date().toISOString(),
                            }));
                            return;
                        }
                        if (!c.authed || !c.tenantId)
                            return;
                        if (msgType === "ping") {
                            c.send(JSON.stringify({
                                id: randomUUID(),
                                type: "pong",
                                channel: "system",
                                payload: {},
                                timestamp: new Date().toISOString(),
                            }));
                            return;
                        }
                        if (msgType === "subscribe" && msg.channel) {
                            const ch = String(msg.channel);
                            if (!ch.startsWith(`tenant:${c.tenantId}:`)) {
                                c.send(JSON.stringify({
                                    id: randomUUID(),
                                    type: "error",
                                    channel: "system",
                                    payload: {
                                        code: "forbidden_channel",
                                        message: "Channel must start with tenant:{your_tenant_id}:",
                                    },
                                    timestamp: new Date().toISOString(),
                                }));
                                return;
                            }
                            leaveAllChannels(c);
                            let set = rooms.get(ch);
                            if (!set) {
                                set = new Set();
                                rooms.set(ch, set);
                            }
                            set.add(c);
                            c.channels.add(ch);
                            broadcastRoom(set, {
                                id: randomUUID(),
                                type: "presence_update",
                                channel: ch,
                                payload: { connected: set.size },
                                timestamp: new Date().toISOString(),
                            });
                            return;
                        }
                        if (msgType === "unsubscribe" && msg.channel) {
                            const ch = String(msg.channel);
                            leaveChannel(c, ch);
                            return;
                        }
                    }
                    catch {
                        /* ignore malformed */
                    }
                })();
            });
        });
    });
}
