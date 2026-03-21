import { EventEmitter } from "node:events";
const emitter = new EventEmitter();
emitter.setMaxListeners(50);
export function publishEvent(event) {
    emitter.emit(event.name, event.payload);
    emitter.emit("*", event);
}
export function onEvent(name, handler) {
    emitter.on(name, handler);
    return () => emitter.off(name, handler);
}
