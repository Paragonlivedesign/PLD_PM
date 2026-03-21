import { describe, expect, it } from "vitest";
import { calendarHoursBetweenIsoDates, driveHoursForDistanceKm, haversineKm } from "./geo.js";

describe("geo (CP2 drive-time foundation)", () => {
  it("haversineKm NYC to LA is ~3944 km", () => {
    const km = haversineKm(40.7128, -74.006, 34.0522, -118.2437);
    expect(km).toBeGreaterThan(3900);
    expect(km).toBeLessThan(4100);
  });

  it("driveHoursForDistanceKm", () => {
    expect(driveHoursForDistanceKm(400, 100)).toBe(4);
  });

  it("calendarHoursBetweenIsoDates", () => {
    expect(calendarHoursBetweenIsoDates("2027-02-22", "2027-02-23")).toBe(24);
    expect(calendarHoursBetweenIsoDates("2027-02-22", "2027-02-25")).toBe(72);
  });
});
