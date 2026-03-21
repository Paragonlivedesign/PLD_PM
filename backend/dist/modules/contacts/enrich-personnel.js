import { tryGetContext } from "../../core/context.js";
import { projectPersonnel } from "../personnel/personnel.permissions.js";
import { getPersonnelById } from "../personnel/personnel.service.js";
function toEmbed(p) {
    return {
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        role: p.role,
        phone: p.phone,
        department_id: p.department_id,
        department_name: p.department_name,
        day_rate: p.day_rate,
        per_diem: p.per_diem,
        skills: p.skills,
        status: p.status,
        employment_type: p.employment_type,
        emergency_contact: p.emergency_contact,
        metadata: p.metadata,
        created_at: p.created_at,
        updated_at: p.updated_at,
        deactivated_at: p.deactivated_at,
        version: p.version,
    };
}
export async function enrichContactWithPersonnel(tenantId, contact) {
    if (!contact.personnel_id)
        return contact;
    const row = await getPersonnelById(contact.personnel_id, tenantId, {
        include_deactivated: true,
    });
    if (!row)
        return contact;
    const perm = tryGetContext()?.permissions ?? new Set();
    const projected = projectPersonnel(row, perm);
    return { ...contact, personnel: toEmbed(projected) };
}
export async function enrichContactsWithPersonnel(tenantId, contacts) {
    const out = [];
    for (const c of contacts) {
        out.push(await enrichContactWithPersonnel(tenantId, c));
    }
    return out;
}
