import { describe, expect, it } from "vitest";
import type { EventResponse } from "@pld/shared";
import { buildGenerationContext } from "../src/modules/documents/generate-html.js";
import { BUILTIN_MERGE_KEYS, TEMPLATE_VARIABLE_CATALOG } from "../src/modules/documents/template-merge-catalog.js";

const minimalEvent: EventResponse = {
  id: "01900000-0000-7000-8000-000000000001",
  name: "Test Event",
  client_id: "01900000-0000-7000-8000-000000000002",
  venue_id: null,
  start_date: "2026-01-01",
  end_date: "2026-01-02",
  load_in_date: null,
  load_out_date: null,
  status: "active",
  phase: "production",
  description: "Desc",
  tags: [],
  metadata: {},
  custom_fields: {},
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

describe("template merge catalog", () => {
  it("catalog keys match BUILTIN_MERGE_KEYS", () => {
    const fromCat = TEMPLATE_VARIABLE_CATALOG.map((e) => e.key);
    expect(fromCat).toEqual([...BUILTIN_MERGE_KEYS]);
  });

  it("buildGenerationContext includes every builtin key before overrides", () => {
    const flat = buildGenerationContext({
      event: minimalEvent,
      personnel: [],
      fieldDefinitions: [],
    });
    for (const k of BUILTIN_MERGE_KEYS) {
      expect(flat).toHaveProperty(k);
      expect(typeof flat[k]).toBe("string");
    }
  });

  it("data_overrides add merge keys", () => {
    const flat = buildGenerationContext({
      event: minimalEvent,
      personnel: [],
      fieldDefinitions: [],
      dataOverrides: { my_line: "Hello", extra_html: "<b>x</b>" },
    });
    expect(flat.my_line).toBe("Hello");
    expect(flat.extra_html).not.toContain("<b>");
    expect(flat.extra_html).toContain("&lt;");
  });
});
