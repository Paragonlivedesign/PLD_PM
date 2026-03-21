function num(v) {
    if (v == null || v === "")
        return 0;
    return Number(v);
}
export function mapFinancialRecordRow(r) {
    return {
        id: r.id,
        event_id: r.event_id,
        event_name: r.event_name,
        category: r.category,
        type: r.type,
        description: r.description,
        amount: num(r.amount),
        currency: r.currency,
        quantity: r.quantity != null ? num(r.quantity) : null,
        unit_price: r.unit_price != null ? num(r.unit_price) : null,
        date: r.record_date ? r.record_date.toISOString().slice(0, 10) : null,
        source: r.source,
        source_ref: r.source_ref ?? null,
        status: r.status,
        notes: r.notes,
        metadata: r.metadata ?? {},
        invoice_id: r.invoice_id,
        created_at: r.created_at.toISOString(),
        updated_at: r.updated_at.toISOString(),
    };
}
const FR_SELECT = `
  SELECT fr.*, e.name AS event_name,
    (
      SELECT i.id FROM invoice_line_items ili
      JOIN invoices i ON i.id = ili.invoice_id AND i.tenant_id = fr.tenant_id
      WHERE ili.financial_record_id = fr.id
        AND i.status NOT IN ('void')
      ORDER BY i.created_at DESC
      LIMIT 1
    ) AS invoice_id
  FROM financial_records fr
  INNER JOIN events e ON e.id = fr.event_id AND e.tenant_id = fr.tenant_id AND e.deleted_at IS NULL
`;
/** Insert and return mapped row via follow-up select. */
export async function insertFinancialRecordSimple(client, p) {
    await client.query(`INSERT INTO financial_records (
      id, tenant_id, event_id, category, type, description, amount, currency,
      quantity, unit_price, record_date, source, source_ref, status, notes, metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12,$13::jsonb,$14,$15,$16::jsonb)`, [
        p.id,
        p.tenantId,
        p.eventId,
        p.category,
        p.type,
        p.description,
        p.amount,
        p.currency,
        p.quantity,
        p.unitPrice,
        p.recordDate,
        p.source,
        p.sourceRef != null ? JSON.stringify(p.sourceRef) : null,
        p.status,
        p.notes,
        JSON.stringify(p.metadata ?? {}),
    ]);
    const r = await client.query(`${FR_SELECT} WHERE fr.tenant_id = $1 AND fr.id = $2 AND fr.deleted_at IS NULL`, [p.tenantId, p.id]);
    return r.rows[0];
}
export async function getFinancialRecordById(client, tenantId, id) {
    const r = await client.query(`${FR_SELECT}
     WHERE fr.tenant_id = $1 AND fr.id = $2 AND fr.deleted_at IS NULL`, [tenantId, id]);
    return r.rows[0] ?? null;
}
export async function isFinancialRecordLockedByInvoice(client, tenantId, recordId) {
    const r = await client.query(`SELECT EXISTS (
      SELECT 1 FROM invoice_line_items ili
      JOIN invoices i ON i.id = ili.invoice_id AND i.tenant_id = ili.tenant_id
      WHERE ili.tenant_id = $1 AND ili.financial_record_id = $2
        AND i.status NOT IN ('draft', 'void')
    ) AS x`, [tenantId, recordId]);
    return Boolean(r.rows[0]?.x);
}
/** Soft-delete calculated cost rows for an event that are not locked by a non-draft invoice. */
export async function softDeleteUnlockedCalculatedCostRecordsForEvent(client, tenantId, eventId) {
    const r = await client.query(`UPDATE financial_records fr SET deleted_at = NOW(), updated_at = NOW()
     WHERE fr.tenant_id = $1 AND fr.event_id = $2 AND fr.deleted_at IS NULL
       AND fr.type = 'cost' AND fr.source = 'calculated'
       AND NOT EXISTS (
         SELECT 1 FROM invoice_line_items ili
         JOIN invoices i ON i.id = ili.invoice_id AND i.tenant_id = ili.tenant_id
         WHERE ili.tenant_id = fr.tenant_id AND ili.financial_record_id = fr.id
           AND i.status NOT IN ('draft', 'void')
       )
     RETURNING fr.id`, [tenantId, eventId]);
    return r.rowCount ?? 0;
}
export async function softDeleteFinancialRecord(client, tenantId, id) {
    const r = await client.query(`UPDATE financial_records SET deleted_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING id, deleted_at`, [tenantId, id]);
    const row = r.rows[0];
    if (!row)
        return null;
    return { id: row.id, deleted_at: row.deleted_at.toISOString() };
}
export async function updateFinancialRecordPartial(client, tenantId, id, patch) {
    const sets = [];
    const vals = [];
    let i = 1;
    const add = (col, val) => {
        sets.push(`${col} = $${i++}`);
        vals.push(val);
    };
    if (patch.category != null)
        add("category", patch.category);
    if (patch.description != null)
        add("description", patch.description);
    if (patch.amount != null)
        add("amount", patch.amount);
    if (patch.quantity !== undefined)
        add("quantity", patch.quantity);
    if (patch.unitPrice !== undefined)
        add("unit_price", patch.unitPrice);
    if (patch.recordDate !== undefined)
        add("record_date", patch.recordDate ? patch.recordDate : null);
    if (patch.status != null)
        add("status", patch.status);
    if (patch.notes !== undefined)
        add("notes", patch.notes);
    if (patch.metadata != null)
        add("metadata", JSON.stringify(patch.metadata));
    if (sets.length === 0)
        return getFinancialRecordById(client, tenantId, id);
    sets.push(`updated_at = NOW()`);
    vals.push(tenantId, id);
    const r = await client.query(`UPDATE financial_records SET ${sets.join(", ")}
     WHERE tenant_id = $${i++} AND id = $${i} AND deleted_at IS NULL`, vals);
    if (r.rowCount === 0)
        return null;
    return getFinancialRecordById(client, tenantId, id);
}
export async function listFinancialRecords(client, p) {
    const cond = ["fr.tenant_id = $1", "fr.deleted_at IS NULL"];
    const v = [p.tenantId];
    let n = 2;
    if (p.eventId) {
        cond.push(`fr.event_id = $${n++}`);
        v.push(p.eventId);
    }
    if (p.categories?.length) {
        cond.push(`fr.category = ANY($${n++})`);
        v.push(p.categories);
    }
    if (p.type) {
        cond.push(`fr.type = $${n++}`);
        v.push(p.type);
    }
    if (p.statuses?.length) {
        cond.push(`fr.status = ANY($${n++})`);
        v.push(p.statuses);
    }
    if (p.sources?.length) {
        cond.push(`fr.source = ANY($${n++})`);
        v.push(p.sources);
    }
    if (p.dateStart) {
        cond.push(`fr.record_date >= $${n++}::date`);
        v.push(p.dateStart);
    }
    if (p.dateEnd) {
        cond.push(`fr.record_date <= $${n++}::date`);
        v.push(p.dateEnd);
    }
    if (p.minAmount != null) {
        cond.push(`fr.amount >= $${n++}`);
        v.push(p.minAmount);
    }
    if (p.maxAmount != null) {
        cond.push(`fr.amount <= $${n++}`);
        v.push(p.maxAmount);
    }
    if (p.search?.trim()) {
        cond.push(`(fr.description ILIKE $${n} OR COALESCE(fr.notes,'') ILIKE $${n})`);
        v.push(`%${p.search.trim()}%`);
        n++;
    }
    const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
    const order = p.sortBy === "amount"
        ? `fr.amount ${p.sortOrder.toUpperCase()}`
        : p.sortBy === "category"
            ? `fr.category ${p.sortOrder.toUpperCase()}, fr.created_at DESC`
            : p.sortBy === "created_at"
                ? `fr.created_at ${p.sortOrder.toUpperCase()}`
                : `fr.record_date ${p.sortOrder.toUpperCase()} NULLS LAST, fr.created_at ${p.sortOrder.toUpperCase()}`;
    const countR = await client.query(`SELECT COUNT(*)::text AS c FROM financial_records fr ${where}`, v);
    const total = Number(countR.rows[0]?.c ?? 0);
    const lim = p.limit;
    const off = p.offset;
    const r = await client.query(`${FR_SELECT} ${where} ORDER BY ${order} LIMIT ${lim} OFFSET ${off}`, v);
    return { rows: r.rows, total };
}
export async function selectFinancialAggregatesByCategoryStatus(client, tenantId, eventId, costOrRevenue) {
    const r = await client.query(`SELECT fr.category, fr.type, fr.status,
            SUM(fr.amount)::text AS sum_amt,
            COUNT(*)::text AS cnt
     FROM financial_records fr
     WHERE fr.tenant_id = $1 AND fr.event_id = $2 AND fr.deleted_at IS NULL
       AND fr.type = $3
     GROUP BY fr.category, fr.type, fr.status`, [tenantId, eventId, costOrRevenue]);
    return r.rows;
}
export async function selectFinancialSummaryTotals(client, tenantId, eventId) {
    const r = await client.query(`SELECT
       COALESCE(SUM(CASE WHEN type = 'revenue' THEN amount ELSE 0 END), 0)::text AS total_revenue,
       COALESCE(SUM(CASE WHEN type = 'cost' THEN amount ELSE 0 END), 0)::text AS total_costs,
       COUNT(*)::text AS record_count
     FROM financial_records
     WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL`, [tenantId, eventId]);
    return r.rows[0];
}
/** For budget diff emit — caller passes previous totals before mutation. */
export async function selectNetTotals(client, tenantId, eventId) {
    const r = await selectFinancialSummaryTotals(client, tenantId, eventId);
    return {
        total_revenue: num(r.total_revenue),
        total_costs: num(r.total_costs),
        record_count: Number(r.record_count),
    };
}
export async function sumEventFinancialTotals(client, tenantId, eventId, extraWhere, extraVals) {
    const r = await client.query(`SELECT
       COALESCE(SUM(CASE WHEN type = 'cost' THEN amount ELSE 0 END), 0)::text AS costs,
       COALESCE(SUM(CASE WHEN type = 'revenue' THEN amount ELSE 0 END), 0)::text AS revenue
     FROM financial_records fr
     WHERE fr.tenant_id = $1 AND fr.event_id = $2 AND fr.deleted_at IS NULL ${extraWhere}`, [tenantId, eventId, ...extraVals]);
    const costs = num(r.rows[0]?.costs);
    const revenue = num(r.rows[0]?.revenue);
    return { costs, revenue, net: revenue - costs };
}
export async function insertInvoiceWithLines(client, p) {
    await client.query(`INSERT INTO invoices (
      id, tenant_id, event_id, client_id, invoice_number, status,
      tax_rate, discount, discount_type, subtotal, tax_amount, total, currency,
      due_date, notes, payment_terms, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::date,$15,$16,$17)`, [
        p.id,
        p.tenantId,
        p.eventId,
        p.clientId,
        p.invoiceNumber,
        p.status,
        p.taxRate,
        p.discount,
        p.discountType,
        p.subtotal,
        p.taxAmount,
        p.total,
        p.currency,
        p.dueDate,
        p.notes,
        p.paymentTerms,
        p.createdBy,
    ]);
    for (const li of p.lines) {
        await client.query(`INSERT INTO invoice_line_items (
        id, invoice_id, tenant_id, description, quantity, unit_price, amount, financial_record_id, sort_order
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [
            li.id,
            p.id,
            p.tenantId,
            li.description,
            li.quantity,
            li.unitPrice,
            li.amount,
            li.financialRecordId,
            li.sortOrder,
        ]);
    }
}
export async function getInvoiceHeader(client, tenantId, id) {
    const r = await client.query(`SELECT i.*, e.name AS event_name, c.name AS client_name
     FROM invoices i
     INNER JOIN events e ON e.id = i.event_id AND e.tenant_id = i.tenant_id AND e.deleted_at IS NULL
     INNER JOIN clients c ON c.id = i.client_id AND c.tenant_id = i.tenant_id AND c.deleted_at IS NULL
     WHERE i.tenant_id = $1 AND i.id = $2`, [tenantId, id]);
    return r.rows[0] ?? null;
}
export async function listInvoiceLines(client, tenantId, invoiceId) {
    const r = await client.query(`SELECT id, description, quantity, unit_price, amount, financial_record_id
     FROM invoice_line_items
     WHERE tenant_id = $1 AND invoice_id = $2
     ORDER BY sort_order, id`, [tenantId, invoiceId]);
    return r.rows;
}
export async function listInvoices(client, p) {
    const cond = ["i.tenant_id = $1"];
    const v = [p.tenantId];
    let n = 2;
    if (p.eventId) {
        cond.push(`i.event_id = $${n++}`);
        v.push(p.eventId);
    }
    if (p.clientId) {
        cond.push(`i.client_id = $${n++}`);
        v.push(p.clientId);
    }
    if (p.statuses?.length) {
        cond.push(`i.status = ANY($${n++})`);
        v.push(p.statuses);
    }
    if (p.dateStart) {
        cond.push(`i.created_at >= $${n++}::date`);
        v.push(p.dateStart);
    }
    if (p.dateEnd) {
        cond.push(`i.created_at < ($${n++}::date + INTERVAL '1 day')`);
        v.push(p.dateEnd);
    }
    const where = `WHERE ${cond.join(" AND ")}`;
    const countR = await client.query(`SELECT COUNT(*)::text AS c FROM invoices i ${where}`, v);
    const total = Number(countR.rows[0]?.c ?? 0);
    const r = await client.query(`SELECT i.*, e.name AS event_name, c.name AS client_name
     FROM invoices i
     INNER JOIN events e ON e.id = i.event_id AND e.tenant_id = i.tenant_id AND e.deleted_at IS NULL
     INNER JOIN clients c ON c.id = i.client_id AND c.tenant_id = i.tenant_id AND c.deleted_at IS NULL
     ${where}
     ORDER BY i.created_at DESC
     LIMIT ${p.limit} OFFSET ${p.offset}`, v);
    return { rows: r.rows, total };
}
export async function selectInvoiceTotals(client, tenantId, p) {
    const cond = ["i.tenant_id = $1"];
    const v = [p.tenantId];
    let n = 2;
    if (p.eventId) {
        cond.push(`i.event_id = $${n++}`);
        v.push(p.eventId);
    }
    if (p.clientId) {
        cond.push(`i.client_id = $${n++}`);
        v.push(p.clientId);
    }
    if (p.statuses?.length) {
        cond.push(`i.status = ANY($${n++})`);
        v.push(p.statuses);
    }
    if (p.dateStart) {
        cond.push(`i.created_at >= $${n++}::date`);
        v.push(p.dateStart);
    }
    if (p.dateEnd) {
        cond.push(`i.created_at < ($${n++}::date + INTERVAL '1 day')`);
        v.push(p.dateEnd);
    }
    const where = `WHERE ${cond.join(" AND ")}`;
    const r = await client.query(`SELECT
       COALESCE(SUM(i.total), 0)::text AS ti,
       COALESCE(SUM(CASE WHEN i.status = 'paid' THEN COALESCE(i.paid_amount, i.total) ELSE 0 END), 0)::text AS tp
     FROM invoices i ${where}`, v);
    const total_invoiced = num(r.rows[0]?.ti);
    const total_paid = num(r.rows[0]?.tp);
    return {
        total_invoiced,
        total_paid,
        total_outstanding: total_invoiced - total_paid,
    };
}
export async function updateInvoiceRow(client, tenantId, id, patch) {
    const sets = [];
    const vals = [];
    let i = 1;
    const add = (col, val) => {
        sets.push(`${col} = $${i++}`);
        vals.push(val);
    };
    if (patch.status != null)
        add("status", patch.status);
    if (patch.dueDate != null)
        add("due_date", patch.dueDate);
    if (patch.taxRate !== undefined)
        add("tax_rate", patch.taxRate);
    if (patch.discount != null)
        add("discount", patch.discount);
    if (patch.discountType != null)
        add("discount_type", patch.discountType);
    if (patch.subtotal != null)
        add("subtotal", patch.subtotal);
    if (patch.taxAmount != null)
        add("tax_amount", patch.taxAmount);
    if (patch.total != null)
        add("total", patch.total);
    if (patch.notes !== undefined)
        add("notes", patch.notes);
    if (patch.paymentTerms !== undefined)
        add("payment_terms", patch.paymentTerms);
    if (patch.paidDate !== undefined)
        add("paid_date", patch.paidDate);
    if (patch.paidAmount !== undefined)
        add("paid_amount", patch.paidAmount);
    if (sets.length === 0)
        return true;
    sets.push("updated_at = NOW()");
    vals.push(tenantId, id);
    const r = await client.query(`UPDATE invoices SET ${sets.join(", ")} WHERE tenant_id = $${i++} AND id = $${i}`, vals);
    return (r.rowCount ?? 0) > 0;
}
export async function deleteInvoiceLines(client, tenantId, invoiceId) {
    await client.query(`DELETE FROM invoice_line_items WHERE tenant_id = $1 AND invoice_id = $2`, [tenantId, invoiceId]);
}
export async function costReportGrouped(client, p) {
    const cond = [
        "fr.tenant_id = $1",
        "fr.deleted_at IS NULL",
        "fr.record_date >= $2::date",
        "fr.record_date <= $3::date",
    ];
    const v = [p.tenantId, p.dateStart, p.dateEnd];
    let n = 4;
    if (p.eventId) {
        cond.push(`fr.event_id = $${n++}`);
        v.push(p.eventId);
    }
    if (p.categories?.length) {
        cond.push(`fr.category = ANY($${n++})`);
        v.push(p.categories);
    }
    if (p.statuses?.length) {
        cond.push(`fr.status = ANY($${n++})`);
        v.push(p.statuses);
    }
    if (p.clientId) {
        cond.push(`e.client_id = $${n++}`);
        v.push(p.clientId);
    }
    const where = cond.join(" AND ");
    let keyExpr;
    let labelExpr;
    let groupExpr;
    let joinExtra = "";
    if (p.groupBy === "event") {
        keyExpr = "fr.event_id::text";
        labelExpr = "e.name";
        groupExpr = "fr.event_id, e.name";
    }
    else if (p.groupBy === "category") {
        keyExpr = "fr.category";
        labelExpr = "fr.category";
        groupExpr = "fr.category";
    }
    else if (p.groupBy === "month") {
        keyExpr = `to_char(date_trunc('month', fr.record_date), 'YYYY-MM')`;
        labelExpr = `to_char(date_trunc('month', fr.record_date), 'YYYY-MM')`;
        groupExpr = `date_trunc('month', fr.record_date)`;
    }
    else {
        keyExpr = "e.client_id::text";
        labelExpr = "c.name";
        groupExpr = "e.client_id, c.name";
        joinExtra = "INNER JOIN clients c ON c.id = e.client_id AND c.tenant_id = e.tenant_id AND c.deleted_at IS NULL";
    }
    const r = await client.query(`SELECT
       ${keyExpr} AS key,
       ${labelExpr} AS label,
       COALESCE(SUM(CASE WHEN fr.type = 'cost' THEN fr.amount ELSE 0 END), 0)::text AS total_costs,
       COALESCE(SUM(CASE WHEN fr.type = 'revenue' THEN fr.amount ELSE 0 END), 0)::text AS total_revenue,
       COUNT(*)::text AS record_count
     FROM financial_records fr
     INNER JOIN events e ON e.id = fr.event_id AND e.tenant_id = fr.tenant_id AND e.deleted_at IS NULL
     ${joinExtra}
     WHERE ${where}
     GROUP BY ${groupExpr}
     ORDER BY label`, v);
    return r.rows;
}
export async function costReportGrandTotals(client, p) {
    const cond = [
        "fr.tenant_id = $1",
        "fr.deleted_at IS NULL",
        "fr.record_date >= $2::date",
        "fr.record_date <= $3::date",
    ];
    const v = [p.tenantId, p.dateStart, p.dateEnd];
    let n = 4;
    if (p.eventId) {
        cond.push(`fr.event_id = $${n++}`);
        v.push(p.eventId);
    }
    if (p.categories?.length) {
        cond.push(`fr.category = ANY($${n++})`);
        v.push(p.categories);
    }
    if (p.statuses?.length) {
        cond.push(`fr.status = ANY($${n++})`);
        v.push(p.statuses);
    }
    if (p.clientId) {
        cond.push(`e.client_id = $${n++}`);
        v.push(p.clientId);
    }
    const where = cond.join(" AND ");
    const r = await client.query(`SELECT
       COALESCE(SUM(CASE WHEN fr.type = 'cost' THEN fr.amount ELSE 0 END), 0)::text AS tc,
       COALESCE(SUM(CASE WHEN fr.type = 'revenue' THEN fr.amount ELSE 0 END), 0)::text AS tr,
       COUNT(*)::text AS rc
     FROM financial_records fr
     INNER JOIN events e ON e.id = fr.event_id AND e.tenant_id = fr.tenant_id AND e.deleted_at IS NULL
     WHERE ${where}`, v);
    return {
        total_costs: num(r.rows[0]?.tc),
        total_revenue: num(r.rows[0]?.tr),
        record_count: Number(r.rows[0]?.rc ?? 0),
    };
}
