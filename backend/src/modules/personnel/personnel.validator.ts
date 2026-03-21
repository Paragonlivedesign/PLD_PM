import { HttpError } from "../../core/http-error.js";
import type { EmploymentType, PersonnelStatus } from "./personnel.types.js";

const EMPLOYMENT: EmploymentType[] = ["full_time", "part_time", "freelance", "contractor"];
const STATUS: PersonnelStatus[] = ["active", "inactive", "on_leave"];

export function assertEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "VALIDATION", "Invalid email", "email");
  }
}

export function assertEmploymentType(v: string): asserts v is EmploymentType {
  if (!EMPLOYMENT.includes(v as EmploymentType)) {
    throw new HttpError(400, "VALIDATION", "Invalid employment_type", "employment_type");
  }
}

export function assertPersonnelStatus(v: string): asserts v is PersonnelStatus {
  if (!STATUS.includes(v as PersonnelStatus)) {
    throw new HttpError(400, "VALIDATION", "Invalid status", "status");
  }
}

export function parseOptionalStatus(s: string | undefined): PersonnelStatus | undefined {
  if (s === undefined) return undefined;
  assertPersonnelStatus(s);
  return s;
}

export function clampLimit(raw: string | undefined, fallback: number, max = 100): number {
  const n = raw === undefined ? fallback : Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1) return fallback;
  return Math.min(n, max);
}

export function parseCsvEnums<T extends string>(raw: string | undefined, allowed: readonly T[]): T[] | undefined {
  if (!raw || raw.trim() === "") return undefined;
  const parts = raw.split(",").map((s) => s.trim());
  for (const p of parts) {
    if (!allowed.includes(p as T)) {
      throw new HttpError(400, "VALIDATION", `Invalid filter value: ${p}`);
    }
  }
  return parts as T[];
}
