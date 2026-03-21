import type { FieldType } from "./constants.js";
import type { CustomFieldDefinitionResponse, SelectOption, ValidationRules } from "./types.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_RE = /^\+[1-9]\d{6,14}$/;

function parseIsoDate(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

function todayUtc(): { y: number; m: number; d: number } {
  const n = new Date();
  return { y: n.getUTCFullYear(), m: n.getUTCMonth() + 1, d: n.getUTCDate() };
}

function cmpDate(
  a: { y: number; m: number; d: number },
  b: { y: number; m: number; d: number },
): number {
  if (a.y !== b.y) return a.y - b.y;
  if (a.m !== b.m) return a.m - b.m;
  return a.d - b.d;
}

export function validateValueForDefinition(
  def: Pick<
    CustomFieldDefinitionResponse,
    "field_key" | "field_type" | "validation_rules" | "options"
  >,
  value: unknown,
  opts: { allowDeprecatedSelect?: boolean } = {},
): { ok: true; value: unknown } | { ok: false; code: string; message: string } {
  const rules = def.validation_rules;
  const ft = def.field_type as FieldType;

  switch (ft) {
    case "text": {
      if (typeof value !== "string")
        return { ok: false, code: "INVALID_TYPE", message: "Must be a string" };
      if (rules?.min_length != null && value.length < rules.min_length)
        return { ok: false, code: "OUT_OF_RANGE", message: `Min length ${rules.min_length}` };
      if (rules?.max_length != null && value.length > rules.max_length)
        return { ok: false, code: "OUT_OF_RANGE", message: `Max length ${rules.max_length}` };
      if (rules?.pattern) {
        try {
          const re = new RegExp(rules.pattern);
          if (!re.test(value)) return { ok: false, code: "INVALID_FORMAT", message: "Does not match pattern" };
        } catch {
          return { ok: false, code: "INVALID_FORMAT", message: "Invalid pattern on definition" };
        }
      }
      return { ok: true, value };
    }
    case "number": {
      if (typeof value !== "number" || Number.isNaN(value))
        return { ok: false, code: "INVALID_TYPE", message: "Must be a number" };
      if (rules?.min != null && value < rules.min)
        return { ok: false, code: "OUT_OF_RANGE", message: `Min ${rules.min}` };
      if (rules?.max != null && value > rules.max)
        return { ok: false, code: "OUT_OF_RANGE", message: `Max ${rules.max}` };
      if (rules?.precision != null) {
        const s = String(value);
        const dec = s.includes(".") ? s.split(".")[1].length : 0;
        if (dec > rules.precision)
          return { ok: false, code: "OUT_OF_RANGE", message: `Max ${rules.precision} decimal places` };
      }
      return { ok: true, value };
    }
    case "boolean": {
      if (typeof value !== "boolean") return { ok: false, code: "INVALID_TYPE", message: "Must be boolean" };
      return { ok: true, value };
    }
    case "date": {
      if (typeof value !== "string")
        return { ok: false, code: "INVALID_TYPE", message: "Must be ISO date string" };
      const parsed = parseIsoDate(value);
      if (!parsed) return { ok: false, code: "INVALID_FORMAT", message: "Expected YYYY-MM-DD" };
      if (rules?.min_date) {
        const min = parseIsoDate(rules.min_date);
        if (min && cmpDate(parsed, min) < 0)
          return { ok: false, code: "OUT_OF_RANGE", message: `Not before ${rules.min_date}` };
      }
      if (rules?.max_date) {
        const max = parseIsoDate(rules.max_date);
        if (max && cmpDate(parsed, max) > 0)
          return { ok: false, code: "OUT_OF_RANGE", message: `Not after ${rules.max_date}` };
      }
      if (rules?.not_in_past) {
        const t = todayUtc();
        if (cmpDate(parsed, t) < 0) return { ok: false, code: "OUT_OF_RANGE", message: "Date cannot be in the past" };
      }
      return { ok: true, value };
    }
    case "datetime": {
      if (typeof value !== "string")
        return { ok: false, code: "INVALID_TYPE", message: "Must be ISO datetime string" };
      const ms = Date.parse(value);
      if (Number.isNaN(ms)) return { ok: false, code: "INVALID_FORMAT", message: "Invalid datetime" };
      const dt = new Date(ms);
      const asDate = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
      const parsed = parseIsoDate(asDate);
      if (rules?.min_date && parsed) {
        const min = parseIsoDate(rules.min_date);
        if (min && cmpDate(parsed, min) < 0)
          return { ok: false, code: "OUT_OF_RANGE", message: `Not before ${rules.min_date}` };
      }
      if (rules?.max_date && parsed) {
        const max = parseIsoDate(rules.max_date);
        if (max && cmpDate(parsed, max) > 0)
          return { ok: false, code: "OUT_OF_RANGE", message: `Not after ${rules.max_date}` };
      }
      if (rules?.not_in_past) {
        if (dt.getTime() < Date.now()) return { ok: false, code: "OUT_OF_RANGE", message: "Datetime cannot be in the past" };
      }
      return { ok: true, value: new Date(ms).toISOString() };
    }
    case "select": {
      if (typeof value !== "string")
        return { ok: false, code: "INVALID_TYPE", message: "Must be string option value" };
      const options = def.options ?? [];
      const opt = options.find((o: SelectOption) => o.value === value);
      if (!opt) return { ok: false, code: "INVALID_OPTION", message: "Unknown option" };
      if (opt.is_deprecated && !opts.allowDeprecatedSelect)
        return { ok: false, code: "INVALID_OPTION", message: "Option is deprecated" };
      return { ok: true, value };
    }
    case "multi_select": {
      if (!Array.isArray(value)) return { ok: false, code: "INVALID_TYPE", message: "Must be array of strings" };
      const set = new Set<string>();
      for (const v of value) {
        if (typeof v !== "string")
          return { ok: false, code: "INVALID_TYPE", message: "Each option must be a string" };
        const options = def.options ?? [];
        const opt = options.find((o: SelectOption) => o.value === v);
        if (!opt) return { ok: false, code: "INVALID_OPTION", message: `Unknown option ${v}` };
        if (opt.is_deprecated && !opts.allowDeprecatedSelect)
          return { ok: false, code: "INVALID_OPTION", message: `Option ${v} is deprecated` };
        if (set.has(v)) return { ok: false, code: "INVALID_FORMAT", message: "Duplicate option" };
        set.add(v);
      }
      return { ok: true, value };
    }
    case "url": {
      if (typeof value !== "string") return { ok: false, code: "INVALID_TYPE", message: "Must be string" };
      try {
        const u = new URL(value);
        if (u.protocol !== "http:" && u.protocol !== "https:")
          return { ok: false, code: "INVALID_FORMAT", message: "URL must be http or https" };
      } catch {
        return { ok: false, code: "INVALID_FORMAT", message: "Invalid URL" };
      }
      return { ok: true, value };
    }
    case "email": {
      if (typeof value !== "string") return { ok: false, code: "INVALID_TYPE", message: "Must be string" };
      if (!EMAIL_RE.test(value)) return { ok: false, code: "INVALID_FORMAT", message: "Invalid email" };
      return { ok: true, value };
    }
    case "phone": {
      if (typeof value !== "string") return { ok: false, code: "INVALID_TYPE", message: "Must be string" };
      const digits = value.replace(/\D/g, "");
      if (E164_RE.test(value)) return { ok: true, value };
      if (digits.length >= 10 && digits.length <= 15) return { ok: true, value };
      return { ok: false, code: "INVALID_FORMAT", message: "Use E.164 (+…) or 10–15 digits" };
    }
    default:
      return { ok: false, code: "INVALID_TYPE", message: "Unknown field_type" };
  }
}

export function validateDefaultValueForCreate(
  fieldType: FieldType,
  defaultValue: unknown,
  validationRules: ValidationRules | null,
  options: SelectOption[] | null,
): { ok: true } | { ok: false; message: string } {
  const fake: CustomFieldDefinitionResponse = {
    id: "",
    entity_type: "event",
    field_key: "_",
    label: "",
    description: null,
    field_type: fieldType,
    validation_rules: validationRules,
    default_value: null,
    options,
    is_required: false,
    is_searchable: false,
    display_order: 0,
    visibility: "all",
    version: 1,
    created_at: "",
    updated_at: "",
    deleted_at: null,
  };
  const r = validateValueForDefinition(fake, defaultValue, { allowDeprecatedSelect: true });
  if (r.ok) return { ok: true };
  return { ok: false, message: r.message };
}
