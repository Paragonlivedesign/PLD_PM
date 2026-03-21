/**
 * Scheduling module is Wave 2. This stub satisfies personnel availability and
 * delete guards until real assignments exist. Replace with internal scheduling
 * service calls (e.g. getAssignmentsByPersonnel from scheduling.contract.md).
 */
/** Returns assignment chips per date for a personnel member in [start, end]. */
export async function getStubAssignmentsForPersonnel(_tenantId, _personnelId, _start, _end) {
    return [];
}
/** True if personnel has any assignment on or after `fromDate` (for delete guard). */
export async function hasStubFutureAssignments(_tenantId, _personnelId, _fromDate) {
    return false;
}
