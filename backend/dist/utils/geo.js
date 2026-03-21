/** Great-circle distance (km) between two WGS84 points. CP2 2.E.3 drive-time foundation. */
export function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
/** Rough drive hours from distance (MVP constant speed). */
export function driveHoursForDistanceKm(km, avgKmh = 80) {
    return km / avgKmh;
}
/** Hours between end date (inclusive last day) and start date of the next gig (exclusive of gap days as 24h each). */
export function calendarHoursBetweenIsoDates(endYmd, startYmd) {
    const [ey, em, ed] = endYmd.split("-").map(Number);
    const [sy, sm, sd] = startYmd.split("-").map(Number);
    const end = Date.UTC(ey, em - 1, ed);
    const start = Date.UTC(sy, sm - 1, sd);
    return (start - end) / 3_600_000;
}
