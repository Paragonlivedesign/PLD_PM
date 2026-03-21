import { EventEmitter } from "node:events";

/** In-process domain event bus (replace with message broker later). */
export const domainBus = new EventEmitter();
domainBus.setMaxListeners(50);
