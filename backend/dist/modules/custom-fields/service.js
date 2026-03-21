import { randomUUID } from "node:crypto";
import { FIELD_KEY_REGEX, MAX_CUSTOM_FIELDS_JSON_BYTES } from "./constants.js";
import * as repo from "./repository.js";
import { getTierLimits } from "./tier.js";
import { validateDefaultValueForCreate, validateValueForDefinition, } from "./validators.js";
import { publishFieldDefinitionCreated, publishFieldDefinitionDeleted, publishFieldDefinitionUpdated, } from "./events.js";
function jsonByteLength(obj) {
    return Buffer.byteLength(JSON.stringify(obj ?? {}), "utf8");
}
function mergeSelectOptions(existing, incoming) {
    if (incoming === undefined)
        return existing;
    if (!incoming?.length)
        return existing ?? [];
    const byValue = new Map();
    for (const o of existing ?? []) {
        byValue.set(o.value, { ...o });
    }
    for (const o of incoming) {
        const cur = byValue.get(o.value);
        if (cur) {
            byValue.set(o.value, {
                ...cur,
                label: o.label ?? cur.label,
                color: o.color !== undefined ? o.color : cur.color,
                is_deprecated: o.is_deprecated ?? cur.is_deprecated,
            });
        }
        else {
            byValue.set(o.value, { ...o, is_deprecated: o.is_deprecated ?? false });
        }
    }
    return [...byValue.values()];
}
export async function getFieldDefinitions(pool, tenantId, entityType, options) {
    return repo.listDefinitions(pool, tenantId, entityType, Boolean(options?.include_deprecated));
}
export async function getFieldsForSearch(pool, tenantId, entityType) {
    const defs = await repo.listDefinitions(pool, tenantId, entityType, false);
    return defs
        .filter((d) => d.is_searchable)
        .map((d) => ({
        field_key: d.field_key,
        label: d.label,
        field_type: d.field_type,
        options: d.field_type === "select" || d.field_type === "multi_select" ? d.options : null,
    }));
}
export async function validateCustomFields(pool, entityType, tenantId, values) {
    if (jsonByteLength(values) > MAX_CUSTOM_FIELDS_JSON_BYTES) {
        return {
            valid: false,
            cleaned_values: {},
            errors: [
                {
                    field_key: "_",
                    code: "PAYLOAD_TOO_LARGE",
                    message: `custom_fields JSON exceeds ${MAX_CUSTOM_FIELDS_JSON_BYTES} bytes`,
                },
            ],
        };
    }
    const defs = await repo.listDefinitions(pool, tenantId, entityType, false);
    const defByKey = new Map(defs.map((d) => [d.field_key, d]));
    const errors = [];
    const cleaned = {};
    for (const def of defs) {
        let v = values[def.field_key];
        if ((v === undefined || v === null || v === "") && def.default_value != null && def.default_value !== "") {
            v = def.default_value;
        }
        if (def.is_required && (v === undefined || v === null || v === "")) {
            errors.push({
                field_key: def.field_key,
                code: "REQUIRED",
                message: "Required field missing",
            });
            continue;
        }
        if (v === undefined || v === null)
            continue;
        const r = validateValueForDefinition(def, v, { allowDeprecatedSelect: true });
        if (r.ok)
            cleaned[def.field_key] = r.value;
        else
            errors.push({
                field_key: def.field_key,
                code: r.code,
                message: r.message,
            });
    }
    return { valid: errors.length === 0, cleaned_values: cleaned, errors };
}
export async function createDefinition(pool, tenantId, userId, body) {
    if (!FIELD_KEY_REGEX.test(body.field_key)) {
        return { ok: false, status: 400, code: "invalid_field_key", message: "field_key must be snake_case, 1–50 chars" };
    }
    const limits = getTierLimits();
    const count = await repo.countActiveDefinitions(pool, tenantId, body.entity_type);
    if (count >= limits.maxFieldsPerEntityType) {
        return { ok: false, status: 402, code: "tier_limit_fields", message: "Custom field limit reached for this entity type" };
    }
    if (body.is_searchable) {
        const sc = await repo.countSearchableDefinitions(pool, tenantId, body.entity_type);
        if (sc >= limits.maxSearchableFieldsPerEntityType) {
            return {
                ok: false,
                status: 402,
                code: "tier_limit_searchable",
                message: "Searchable custom field limit reached",
            };
        }
    }
    if (body.field_type === "select" || body.field_type === "multi_select") {
        if (!body.options?.length) {
            return { ok: false, status: 400, code: "options_required", message: "options required for select types" };
        }
        if (body.options.length > limits.maxSelectOptionsPerField) {
            return { ok: false, status: 400, code: "too_many_options", message: "Too many select options for tier" };
        }
    }
    if (body.default_value !== undefined && body.default_value !== null) {
        const dv = validateDefaultValueForCreate(body.field_type, body.default_value, body.validation_rules ?? null, body.options ?? null);
        if (!dv.ok)
            return { ok: false, status: 400, code: "invalid_default", message: dv.message };
    }
    if (await repo.fieldKeyExists(pool, tenantId, body.entity_type, body.field_key)) {
        return { ok: false, status: 409, code: "duplicate_key", message: "field_key already exists" };
    }
    const displayOrder = body.display_order != null ? body.display_order : await repo.nextDisplayOrder(pool, tenantId, body.entity_type);
    const row = await repo.insertDefinition(pool, {
        id: randomUUID(),
        tenantId,
        entityType: body.entity_type,
        fieldKey: body.field_key,
        label: body.label,
        description: body.description ?? null,
        fieldType: body.field_type,
        validationRules: body.validation_rules ?? null,
        defaultValue: body.default_value ?? null,
        options: body.options ?? null,
        isRequired: body.is_required ?? false,
        isSearchable: body.is_searchable ?? false,
        displayOrder,
        visibility: body.visibility ?? "all",
    });
    publishFieldDefinitionCreated({
        definition_id: row.id,
        tenant_id: tenantId,
        entity_type: body.entity_type,
        field_key: row.field_key,
        field_type: row.field_type,
        label: row.label,
        is_required: row.is_required,
        is_searchable: row.is_searchable,
        created_by: userId,
        created_at: row.created_at,
    });
    return { ok: true, data: row };
}
export async function updateDefinition(pool, tenantId, userId, id, patch) {
    const prev = await repo.getDefinitionById(pool, tenantId, id);
    if (!prev || prev.deleted_at) {
        return { ok: false, status: 404, code: "not_found", message: "Definition not found" };
    }
    const limits = getTierLimits();
    if (patch.is_searchable === true && !prev.is_searchable) {
        const sc = await repo.countSearchableDefinitions(pool, tenantId, prev.entity_type);
        if (sc >= limits.maxSearchableFieldsPerEntityType) {
            return {
                ok: false,
                status: 402,
                code: "tier_limit_searchable",
                message: "Searchable custom field limit reached",
            };
        }
    }
    const mergedOptions = patch.options !== undefined ? mergeSelectOptions(prev.options, patch.options) : undefined;
    if (mergedOptions && mergedOptions.length > limits.maxSelectOptionsPerField) {
        return { ok: false, status: 400, code: "too_many_options", message: "Too many select options for tier" };
    }
    const nextDef = {
        ...prev,
        label: patch.label ?? prev.label,
        description: patch.description !== undefined ? patch.description : prev.description,
        validation_rules: patch.validation_rules !== undefined ? patch.validation_rules : prev.validation_rules,
        default_value: patch.default_value !== undefined ? patch.default_value : prev.default_value,
        options: mergedOptions !== undefined ? mergedOptions : prev.options,
        is_required: patch.is_required ?? prev.is_required,
        is_searchable: patch.is_searchable ?? prev.is_searchable,
        display_order: patch.display_order ?? prev.display_order,
        visibility: patch.visibility ?? prev.visibility,
    };
    if (patch.default_value !== undefined && patch.default_value !== null) {
        const dv = validateDefaultValueForCreate(prev.field_type, patch.default_value, nextDef.validation_rules, nextDef.options);
        if (!dv.ok)
            return { ok: false, status: 400, code: "invalid_default", message: dv.message };
    }
    const updated = await repo.updateDefinitionRow(pool, tenantId, id, {
        ...(patch.label !== undefined ? { label: patch.label } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.validation_rules !== undefined ? { validation_rules: patch.validation_rules } : {}),
        ...(patch.default_value !== undefined ? { default_value: patch.default_value } : {}),
        ...(mergedOptions !== undefined ? { options: mergedOptions } : {}),
        ...(patch.is_required !== undefined ? { is_required: patch.is_required } : {}),
        ...(patch.is_searchable !== undefined ? { is_searchable: patch.is_searchable } : {}),
        ...(patch.display_order !== undefined ? { display_order: patch.display_order } : {}),
        ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
    }, prev);
    if (!updated)
        return { ok: false, status: 404, code: "not_found", message: "Definition not found" };
    const changed = Object.keys(patch).filter((k) => patch[k] !== undefined);
    publishFieldDefinitionUpdated({
        definition_id: updated.id,
        tenant_id: tenantId,
        entity_type: prev.entity_type,
        field_key: prev.field_key,
        changed_fields: changed,
        previous_values: Object.fromEntries(changed.map((k) => [k, prev[k]])),
        new_values: Object.fromEntries(changed.map((k) => [k, updated[k]])),
        previous_version: prev.version,
        new_version: updated.version,
        updated_by: userId,
        updated_at: updated.updated_at,
    });
    return {
        ok: true,
        data: updated,
        meta: { previous_version: prev.version, new_version: updated.version },
    };
}
export async function deleteDefinition(pool, tenantId, userId, id) {
    const prev = await repo.getDefinitionById(pool, tenantId, id);
    if (!prev || prev.deleted_at) {
        return { ok: false, status: 404, code: "not_found", message: "Definition not found" };
    }
    const del = await repo.softDeleteDefinition(pool, tenantId, id, prev);
    if (!del)
        return { ok: false, status: 404, code: "not_found", message: "Definition not found" };
    publishFieldDefinitionDeleted({
        definition_id: prev.id,
        tenant_id: tenantId,
        entity_type: prev.entity_type,
        field_key: prev.field_key,
        label: prev.label,
        deleted_by: userId,
        deleted_at: del.deleted_at,
    });
    return { ok: true, data: del };
}
export async function reorderDefinitions(pool, tenantId, entityType, orderedIds) {
    const active = await repo.listDefinitions(pool, tenantId, entityType, false);
    const set = new Set(active.map((d) => d.id));
    if (orderedIds.length !== active.length || orderedIds.some((id) => !set.has(id))) {
        return { ok: false, status: 400, code: "reorder_mismatch", message: "ordered_ids must match all active definitions" };
    }
    const data = await repo.setDisplayOrders(pool, tenantId, entityType, orderedIds);
    return { ok: true, data };
}
