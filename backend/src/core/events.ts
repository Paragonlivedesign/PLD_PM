import { EventEmitter } from "node:events";

export type DomainEvent = {
  name: string;
  payload: Record<string, unknown>;
};

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

export function publishEvent(event: DomainEvent): void {
  emitter.emit(event.name, event.payload);
  emitter.emit("*", event);
}

export function onEvent(
  name: string,
  handler: (payload: Record<string, unknown>) => void,
): () => void {
  emitter.on(name, handler);
  return () => emitter.off(name, handler);
}
