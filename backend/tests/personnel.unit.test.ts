import { describe, expect, it } from "vitest";
import { projectPersonnel } from "../src/modules/personnel/personnel.permissions.js";
import type { PersonnelResponse } from "../src/modules/personnel/personnel.types.js";
import { parseCsv } from "../src/modules/personnel/personnel.import.service.js";

const baseRow = (): PersonnelResponse => ({
  id: "00000000-0000-0000-0000-000000000099",
  first_name: "A",
  last_name: "B",
  email: "a@b.com",
  phone: "555",
  department_id: null,
  department_name: null,
  role: "Tech",
  employment_type: "freelance",
  day_rate: 100,
  per_diem: 50,
  skills: [],
  status: "active",
  emergency_contact: { name: "x", relationship: "y", phone: "z", email: null },
  metadata: { k: 1 },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deactivated_at: null,
  version: 1,
});

describe("projectPersonnel", () => {
  it("strips rates without personnel:view_rates", () => {
    const row = baseRow();
    const p = new Set(["personnel:view"]);
    const out = projectPersonnel(row, p);
    expect(out.day_rate).toBeNull();
    expect(out.per_diem).toBeNull();
    expect(out.first_name).toBe("A");
  });

  it("keeps all fields with *", () => {
    const row = baseRow();
    const out = projectPersonnel(row, new Set(["*"]));
    expect(out).toEqual(row);
  });

  it("strips contact without personnel:view_contact", () => {
    const row = baseRow();
    const out = projectPersonnel(row, new Set(["personnel:view", "personnel:view_rates"]));
    expect(out.phone).toBeNull();
    expect(out.emergency_contact).toBeNull();
    expect(out.day_rate).toBe(100);
  });

  it("clears metadata without personnel:view_custom", () => {
    const row = baseRow();
    const out = projectPersonnel(row, new Set(["personnel:view", "personnel:view_rates", "personnel:view_contact"]));
    expect(out.metadata).toEqual({});
  });
});

describe("parseCsv", () => {
  it("parses header and rows with quotes", () => {
    const { headers, rows } = parseCsv('a,b\n"1,2",3\nx,y');
    expect(headers).toEqual(["a", "b"]);
    expect(rows).toEqual([
      ["1,2", "3"],
      ["x", "y"],
    ]);
  });
});
