export function inclusiveDays(startDate, endDate) {
    const a = new Date(`${startDate}T12:00:00Z`);
    const b = new Date(`${endDate}T12:00:00Z`);
    const ms = b.getTime() - a.getTime();
    return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}
export function eachDateInclusive(start, end) {
    const out = [];
    const cur = new Date(`${start}T12:00:00Z`);
    const last = new Date(`${end}T12:00:00Z`);
    while (cur.getTime() <= last.getTime()) {
        out.push(cur.toISOString().slice(0, 10));
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return out;
}
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart <= bEnd && bStart <= aEnd;
}
/** Inclusive intersection of two date ranges (assumes YYYY-MM-DD). */
export function overlapRange(aStart, aEnd, bStart, bEnd) {
    const start = aStart > bStart ? aStart : bStart;
    const end = aEnd < bEnd ? aEnd : bEnd;
    return { start, end };
}
export function overlapDatesLabel(start, end) {
    return start === end ? start : `${start} to ${end}`;
}
