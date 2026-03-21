import { BUILTIN_MERGE_KEYS } from "./template-merge-catalog.js";
function esc(s) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function applyVars(template, flat) {
    let out = template;
    for (const [k, v] of Object.entries(flat)) {
        const re = new RegExp(`\\{\\{\\s*${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}}`, "g");
        out = out.replace(re, v);
    }
    return out;
}
export function buildGenerationContext(params) {
    const ev = params.event;
    const overrides = params.dataOverrides ?? {};
    const personnelRows = params.personnel
        .map((p) => `<tr><td>${esc(p.first_name)} ${esc(p.last_name)}</td><td>${esc(p.role)}</td><td>${esc(p.email ?? "—")}</td></tr>`)
        .join("");
    const cfLines = [];
    for (const def of params.fieldDefinitions) {
        const val = ev.custom_fields?.[def.field_key];
        if (val === undefined || val === null)
            continue;
        cfLines.push(`<li><strong>${esc(def.label)}:</strong> ${esc(String(val))}</li>`);
    }
    const flat = {
        event_name: ev.name,
        event_start_date: ev.start_date,
        event_end_date: ev.end_date,
        event_phase: ev.phase,
        event_status: ev.status,
        event_description: ev.description ?? "",
        personnel_table: `<table border="1" cellpadding="6"><thead><tr><th>Name</th><th>Role</th><th>Email</th></tr></thead><tbody>${personnelRows}</tbody></table>`,
        custom_fields_list: cfLines.length ? `<ul>${cfLines.join("")}</ul>` : "<p>—</p>",
        schedule_section: "<p><em>Scheduling data not yet wired (stub).</em></p>",
        travel_section: "<p><em>Travel data not yet wired (stub).</em></p>",
        financial_section: "<p><em>Financial data not yet wired (stub).</em></p>",
    };
    for (const k of BUILTIN_MERGE_KEYS) {
        if (!(k in flat)) {
            throw new Error(`Internal: builtin merge key "${k}" missing from generation context`);
        }
    }
    for (const [k, v] of Object.entries(overrides)) {
        if (v === undefined || v === null)
            continue;
        flat[k] = typeof v === "object" ? esc(JSON.stringify(v)) : esc(String(v));
    }
    return flat;
}
export function renderTemplateHtml(templateContent, flat) {
    return applyVars(templateContent, flat);
}
