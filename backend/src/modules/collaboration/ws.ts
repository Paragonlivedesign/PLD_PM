import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import type { WebSocket as WsSocket } from "ws";

/** ws `WebSocket.OPEN` — avoid clashing with DOM `WebSocket` type. */
const WS_OPEN = 1;

type ClientWs = WsSocket & {
  authed?: boolean;
  tenantId?: string;
  channels?: Set<string>;
};

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function broadcastRoom(
  room: Set<ClientWs>,
  msg: Record<string, unknown>,
  except?: ClientWs,
): void {
  const raw = JSON.stringify(msg);
  for (const c of room) {
    if (c === except) continue;
    if (c.readyState === WS_OPEN) c.send(raw);
  }
}

/**
 * `/ws` — auth message then optional `subscribe` for tenant-scoped channels.
 * MVP: non-empty token + valid `tenant_id` UUID; optional in-memory presence counts per channel.
 */
export function attachWebSocketServer(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });
  const rooms = new Map<string, Set<ClientWs>>();

  function leaveAllChannels(ws: ClientWs): void {
    if (!ws.channels?.size) return;
    for (const ch of [...ws.channels]) {
      const set = rooms.get(ch);
      if (set) {
        set.delete(ws);
        if (set.size === 0) rooms.delete(ch);
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

  server.on("upgrade", (req, socket, head) => {
    const path = req.url?.split("?")[0];
    if (path !== "/ws") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const c = ws as ClientWs;
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
        try {
          const msg = JSON.parse(raw.toString()) as {
            type?: string;
            token?: string;
            tenant_id?: string;
            channel?: string;
          };
          if (msg.type === "auth" && msg.token && String(msg.token).length > 0) {
            const tid = msg.tenant_id?.trim();
            if (!tid || !uuidRe.test(tid)) {
              c.send(
                JSON.stringify({
                  id: randomUUID(),
                  type: "auth_error",
                  channel: "system",
                  payload: { code: "tenant_required", message: "tenant_id UUID required in auth payload" },
                  timestamp: new Date().toISOString(),
                }),
              );
              c.close(4401, "invalid tenant");
              return;
            }
            c.authed = true;
            c.tenantId = tid;
            clearTimeout(timer);
            c.send(
              JSON.stringify({
                id: randomUUID(),
                type: "auth_ok",
                channel: "system",
                payload: { tenant_id: tid },
                timestamp: new Date().toISOString(),
              }),
            );
            return;
          }
          if (!c.authed || !c.tenantId) return;

          if (msg.type === "ping") {
            c.send(
              JSON.stringify({
                id: randomUUID(),
                type: "pong",
                channel: "system",
                payload: {},
                timestamp: new Date().toISOString(),
              }),
            );
            return;
          }

          if (msg.type === "subscribe" && msg.channel) {
            const ch = String(msg.channel);
            if (!ch.startsWith(`tenant:${c.tenantId}:`)) {
              c.send(
                JSON.stringify({
                  id: randomUUID(),
                  type: "error",
                  channel: "system",
                  payload: { code: "forbidden_channel", message: "Channel must start with tenant:{your_tenant_id}:" },
                  timestamp: new Date().toISOString(),
                }),
              );
              return;
            }
            leaveAllChannels(c);
            let set = rooms.get(ch);
            if (!set) {
              set = new Set();
              rooms.set(ch, set);
            }
            set.add(c);
            c.channels!.add(ch);
            broadcastRoom(set, {
              id: randomUUID(),
              type: "presence_update",
              channel: ch,
              payload: { connected: set.size },
              timestamp: new Date().toISOString(),
            });
            return;
          }
        } catch {
          /* ignore malformed */
        }
      });
    });
  });
}
