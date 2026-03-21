import { describe, expect, it } from "vitest";
import { validateValueForDefinition } from "./validators.js";
import type { CustomFieldDefinitionResponse } from "./types.js";

const base = (): CustomFieldDefinitionResponse => ({
  id: "a",
  entity_type: "event",
  field_key: "f",
  label: "F",
  description: null,
  field_type: "text",
  validation_rules: { max_length: 3 },
  default_value: null,
  options: null,
  is_required: false,
  is_searchable: false,
  display_order: 0,
  visibility: "all",
  version: 1,
  created_at: "",
  updated_at: "",
  deleted_at: null,
});

describe("validateValueForDefinition", () => {
  it("validates text max_length", () => {
    const d = base();
    expect(validateValueForDefinition(d, "ab").ok).toBe(true);
    const r = validateValueForDefinition(d, "abcd");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("OUT_OF_RANGE");
  });

  it("validates select deprecated for new writes", () => {
    const d = {
      ...base(),
      field_type: "select" as const,
      options: [{ value: "x", label: "X", is_deprecated: true }],
    };
    const r = validateValueForDefinition(d, "x", { allowDeprecatedSelect: false });
    expect(r.ok).toBe(false);
  });

  it("validates multi_select", () => {
    const d = {
      ...base(),
      field_type: "multi_select" as const,
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    };
    expect(validateValueForDefinition(d, ["a", "b"]).ok).toBe(true);
  });
});
