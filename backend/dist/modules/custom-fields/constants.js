export const ENTITY_TYPES = [
    "event",
    "personnel",
    "travel_record",
    "financial_line_item",
    "department",
    "truck",
];
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
];
export const VISIBILITY = ["all", "admin_only"];
export const FIELD_KEY_REGEX = /^[a-z][a-z0-9_]{0,49}$/;
/** Max JSONB payload for custom field values on an entity (bytes). */
export const MAX_CUSTOM_FIELDS_JSON_BYTES = 64 * 1024;
