import { config } from "dotenv";
import "dotenv/config";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SHARED_VERSION } from "@pld/shared";
import { buildApp } from "./app-factory.js";
import { pool } from "./db/pool.js";
import { registerCustomFieldIndexListeners } from "./modules/custom-fields/index.js";
import { registerFinancialBusListeners } from "./modules/financial/index.js";
import { registerDocumentStaleListeners } from "./modules/documents/index.js";
import { registerSearchIndexBusListeners } from "./modules/search/index.js";
import { registerEventDatesBusListeners } from "./modules/scheduling/event-dates-bus.js";
import {
  attachWebSocketServer,
  registerNotificationBusListeners,
} from "./modules/collaboration/index.js";
import { registerAuthEventListeners } from "./modules/auth/index.js";

registerAuthEventListeners();
registerCustomFieldIndexListeners(pool);
registerFinancialBusListeners(pool);
registerDocumentStaleListeners(pool);
registerSearchIndexBusListeners(pool);
registerEventDatesBusListeners(pool);
registerNotificationBusListeners(pool);

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env") });

const app = buildApp();
const port = Number(process.env.PORT) || 3000;

const server = createServer(app);
attachWebSocketServer(server);
server.listen(port, () => {
  console.log(`PLD API http://localhost:${port} (shared ${SHARED_VERSION})`);
});
