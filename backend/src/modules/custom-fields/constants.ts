export const ENTITY_TYPES = [
  "event",
  "personnel",
  "travel_record",
  "financial_line_item",
  "department",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const FIELD_TYPES = [
  "text",
  "number",
  "boolean",
  "date",
  "datetime",
  "select",
  "multi_select",
  "url",
  "email",
  "phone",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const VISIBILITY = ["all", "admin_only"] as const;
export type Visibility = (typeof VISIBILITY)[number];

export const FIELD_KEY_REGEX = /^[a-z][a-z0-9_]{0,49}$/;

/** Max JSONB payload for custom field values on an entity (bytes). */
export const MAX_CUSTOM_FIELDS_JSON_BYTES = 64 * 1024;
