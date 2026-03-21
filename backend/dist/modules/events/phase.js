import { EVENT_PHASES } from "@pld/shared";
const order = new Map(EVENT_PHASES.map((p, i) => [p, i]));
export function isValidPhaseTransition(from, to) {
    if (from === to)
        return false;
    const fi = order.get(from);
    const ti = order.get(to);
    if (fi === undefined || ti === undefined)
        return false;
    /** Single forward step only (no jump back to planning from terminal phases). */
    return ti === fi + 1;
}
