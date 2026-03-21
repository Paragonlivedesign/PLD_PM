/**
 * Canonical metadata for template merge keys used by document generation.
 * Keep in sync with buildBuiltinMergeFlat in generate-html.ts.
 */

export type TemplateMergeKeyKind = "text" | "html";

export type TemplateMergeKeyCategory = "event" | "personnel" | "custom_fields" | "placeholders";

export type TemplateMergeKeyDefinition = {
  key: string;
  category: TemplateMergeKeyCategory;
  label: string;
  kind: TemplateMergeKeyKind;
  description: string;
  /** True when the value is a stub until another module wires real data */
  stub?: boolean;
};

export const TEMPLATE_VARIABLE_CATALOG: readonly TemplateMergeKeyDefinition[] = [
  {
    key: "event_name",
    category: "event",
    label: "Event name",
    kind: "text",
    description: "Name of the event selected for generation.",
  },
  {
    key: "event_start_date",
    category: "event",
    label: "Start date",
    kind: "text",
    description: "Event start date (ISO string from API).",
  },
  {
    key: "event_end_date",
    category: "event",
    label: "End date",
    kind: "text",
    description: "Event end date (ISO string from API).",
  },
  {
    key: "event_phase",
    category: "event",
    label: "Phase",
    kind: "text",
    description: "Lifecycle phase of the event.",
  },
  {
    key: "event_status",
    category: "event",
    label: "Status",
    kind: "text",
    description: "Operational status of the event.",
  },
  {
    key: "event_description",
    category: "event",
    label: "Description",
    kind: "text",
    description: "Event description text (may be empty).",
  },
  {
    key: "personnel_table",
    category: "personnel",
    label: "Personnel table",
    kind: "html",
    description:
      "HTML table of tenant personnel (name, role, email). Not filtered to event crew assignments yet.",
  },
  {
    key: "custom_fields_list",
    category: "custom_fields",
    label: "Custom fields list",
    kind: "html",
    description: "HTML list of populated event custom fields (label + value). Empty events show an em dash.",
  },
  {
    key: "schedule_section",
    category: "placeholders",
    label: "Schedule block",
    kind: "html",
    description: "Reserved for scheduling output when wired to the scheduling module.",
    stub: true,
  },
  {
    key: "travel_section",
    category: "placeholders",
    label: "Travel block",
    kind: "html",
    description: "Reserved for travel summary when wired to the travel module.",
    stub: true,
  },
  {
    key: "financial_section",
    category: "placeholders",
    label: "Financial block",
    kind: "html",
    description: "Reserved for financial summary when wired to the financial module.",
    stub: true,
  },
];

/** Built-in keys (excluding POST /documents/generate data_overrides). */
export const BUILTIN_MERGE_KEYS: readonly string[] = TEMPLATE_VARIABLE_CATALOG.map((e) => e.key);
