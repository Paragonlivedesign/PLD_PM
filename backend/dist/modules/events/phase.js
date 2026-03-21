import { EVENT_PHASES } from "@pld/shared";
const order = new Map(EVENT_PHASES.map((p, i) => [p, i]));
export function isValidPhaseTransition(from, to) {
    if (from === to)
        return false;
    const fi = order.get(from);
    const ti = order.get(to);
    if (fi === undefined || ti === undefined)
        return false;
    /** Contract: any phase may reset to `planning` (PUT /events/:id/phase). */
    if (to === "planning")
        return true;
    /** Single forward step only (no skipping). */
    return ti === fi + 1;
}
