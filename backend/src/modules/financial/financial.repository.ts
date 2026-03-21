import type { Pool, PoolClient } from "pg";

export type FinancialRecordRow = {
  id: string;
  tenant_id: string;
  event_id: string;
  event_name: string;
  category: string;
  type: string;
  description: string;
  amount: string;
  currency: string;
  quantity: string | null;
  unit_price: string | null;
  record_date: Date | null;
  source: string;
  source_ref: unknown;
  status: string;
  notes: string | null;
  metadata: unknown;
  invoice_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export type InvoiceRow = {
  id: string;
  tenant_id: string;
  event_id: string;
  event_name: string;
  client_id: string;
  client_name: string;
  invoice_number: string;
  status: string;
  tax_rate: string | null;
  discount: string;
  discount_type: string;
  subtotal: string;
  tax_amount: string;
  total: string;
  currency: string;
  due_date: Date;
  paid_date: Date | null;
  paid_amount: string | null;
  notes: string | null;
  payment_terms: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type InvoiceLineRow = {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
  amount: string;
  financial_record_id: string | null;
};

function num(v: string | null | undefined): number {
  if (v == null || v === "") return 0;
  return Number(v);
}

export function mapFinancialRecordRow(r: FinancialRecordRow) {
  return {
    id: r.id,
    event_id: r.event_id,
    event_name: r.event_name,
    category: r.category,
    type: r.type as "cost" | "revenue",
    description: r.description,
    amount: num(r.amount),
    currency: r.currency,
    quantity: r.quantity != null ? num(r.quantity) : null,
    unit_price: r.unit_price != null ? num(r.unit_price) : null,
    date: r.record_date ? r.record_date.toISOString().slice(0, 10) : null,
    source: r.source as "manual" | "calculated" | "imported",
    source_ref: (r.source_ref as Record<string, unknown> | null) ?? null,
    status: r.status as "estimated" | "actual" | "approved",
    notes: r.notes,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
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
export async function insertFinancialRecordSimple(
  client: Pool | PoolClient,
  p: {
    id: string;
    tenantId: string;
    eventId: string;
    category: string;
    type: string;
    description: string;
    amount: string;
    currency: string;
    quantity: string | null;
    unitPrice: string | null;
    recordDate: string | null;
    source: string;
    sourceRef: unknown | null;
    status: string;
    notes: string | null;
    metadata: unknown;
  },
): Promise<FinancialRecordRow> {
  await client.query(
    `INSERT INTO financial_records (
      id, tenant_id, event_id, category, type, description, amount, currency,
      quantity, unit_price, record_date, source, source_ref, status, notes, metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12,$13::jsonb,$14,$15,$16::jsonb)`,
    [
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
    ],
  );
  const r = await client.query<FinancialRecordRow>(
    `${FR_SELECT} WHERE fr.tenant_id = $1 AND fr.id = $2 AND fr.deleted_at IS NULL`,
    [p.tenantId, p.id],
  );
  return r.rows[0]!;
}

export async function getFinancialRecordById(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
): Promise<FinancialRecordRow | null> {
  const r = await client.query<FinancialRecordRow>(
    `${FR_SELECT}
     WHERE fr.tenant_id = $1 AND fr.id = $2 AND fr.deleted_at IS NULL`,
    [tenantId, id],
  );
  return r.rows[0] ?? null;
}

export async function isFinancialRecordLockedByInvoice(
  client: Pool | PoolClient,
  tenantId: string,
  recordId: string,
): Promise<boolean> {
  const r = await client.query<{ x: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM invoice_line_items ili
      JOIN invoices i ON i.id = ili.invoice_id AND i.tenant_id = ili.tenant_id
      WHERE ili.tenant_id = $1 AND ili.financial_record_id = $2
        AND i.status NOT IN ('draft', 'void')
    ) AS x`,
    [tenantId, recordId],
  );
  return Boolean(r.rows[0]?.x);
}

/** Soft-delete calculated cost rows for an event that are not locked by a non-draft invoice. */
export async function softDeleteUnlockedCalculatedCostRecordsForEvent(
  client: Pool | PoolClient,
  tenantId: string,
  eventId: string,
): Promise<number> {
  const r = await client.query(
    `UPDATE financial_records fr SET deleted_at = NOW(), updated_at = NOW()
     WHERE fr.tenant_id = $1 AND fr.event_id = $2 AND fr.deleted_at IS NULL
       AND fr.type = 'cost' AND fr.source = 'calculated'
       AND NOT EXISTS (
         SELECT 1 FROM invoice_line_items ili
         JOIN invoices i ON i.id = ili.invoice_id AND i.tenant_id = ili.tenant_id
         WHERE ili.tenant_id = fr.tenant_id AND ili.financial_record_id = fr.id
           AND i.status NOT IN ('draft', 'void')
       )
     RETURNING fr.id`,
    [tenantId, eventId],
  );
  return r.rowCount ?? 0;
}

export async function softDeleteFinancialRecord(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
): Promise<{ id: string; deleted_at: string } | null> {
  const r = await client.query<{ id: string; deleted_at: Date }>(
    `UPDATE financial_records SET deleted_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
     RETURNING id, deleted_at`,
    [tenantId, id],
  );
  const row = r.rows[0];
  if (!row) return null;
  return { id: row.id, deleted_at: row.deleted_at.toISOString() };
}

export async function updateFinancialRecordPartial(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
  patch: {
    category?: string;
    description?: string;
    amount?: string;
    quantity?: string | null;
    unitPrice?: string | null;
    recordDate?: string | null;
    status?: string;
    notes?: string | null;
    metadata?: unknown;
  },
): Promise<FinancialRecordRow | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  const add = (col: string, val: unknown) => {
    sets.push(`${col} = $${i++}`);
    vals.push(val);
  };
  if (patch.category != null) add("category", patch.category);
  if (patch.description != null) add("description", patch.description);
  if (patch.amount != null) add("amount", patch.amount);
  if (patch.quantity !== undefined) add("quantity", patch.quantity);
  if (patch.unitPrice !== undefined) add("unit_price", patch.unitPrice);
  if (patch.recordDate !== undefined)
    add("record_date", patch.recordDate ? patch.recordDate : null);
  if (patch.status != null) add("status", patch.status);
  if (patch.notes !== undefined) add("notes", patch.notes);
  if (patch.metadata != null) add("metadata", JSON.stringify(patch.metadata));
  if (sets.length === 0) return getFinancialRecordById(client, tenantId, id);
  sets.push(`updated_at = NOW()`);
  vals.push(tenantId, id);
  const r = await client.query(
    `UPDATE financial_records SET ${sets.join(", ")}
     WHERE tenant_id = $${i++} AND id = $${i} AND deleted_at IS NULL`,
    vals,
  );
  if (r.rowCount === 0) return null;
  return getFinancialRecordById(client, tenantId, id);
}

export type ListFinancialParams = {
  tenantId: string;
  eventId?: string;
  categories?: string[];
  type?: string;
  statuses?: string[];
  sources?: string[];
  dateStart?: string;
  dateEnd?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  sortBy: "date" | "amount" | "category" | "created_at";
  sortOrder: "asc" | "desc";
  limit: number;
  offset: number;
};

export async function listFinancialRecords(
  client: Pool | PoolClient,
  p: ListFinancialParams,
): Promise<{ rows: FinancialRecordRow[]; total: number }> {
  const cond: string[] = ["fr.tenant_id = $1", "fr.deleted_at IS NULL"];
  const v: unknown[] = [p.tenantId];
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
  const order =
    p.sortBy === "amount"
      ? `fr.amount ${p.sortOrder.toUpperCase()}`
      : p.sortBy === "category"
        ? `fr.category ${p.sortOrder.toUpperCase()}, fr.created_at DESC`
        : p.sortBy === "created_at"
          ? `fr.created_at ${p.sortOrder.toUpperCase()}`
          : `fr.record_date ${p.sortOrder.toUpperCase()} NULLS LAST, fr.created_at ${p.sortOrder.toUpperCase()}`;

  const countR = await client.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM financial_records fr ${where}`,
    v,
  );
  const total = Number(countR.rows[0]?.c ?? 0);

  const lim = p.limit;
  const off = p.offset;
  const r = await client.query<FinancialRecordRow>(
    `${FR_SELECT} ${where} ORDER BY ${order} LIMIT ${lim} OFFSET ${off}`,
    v,
  );
  return { rows: r.rows, total };
}

export type StatusAgg = {
  category: string;
  type: string;
  status: string;
  sum_amt: string;
  cnt: string;
};

export async function selectFinancialAggregatesByCategoryStatus(
  client: Pool | PoolClient,
  tenantId: string,
  eventId: string,
  costOrRevenue: "cost" | "revenue",
): Promise<StatusAgg[]> {
  const r = await client.query<StatusAgg>(
    `SELECT fr.category, fr.type, fr.status,
            SUM(fr.amount)::text AS sum_amt,
            COUNT(*)::text AS cnt
     FROM financial_records fr
     WHERE fr.tenant_id = $1 AND fr.event_id = $2 AND fr.deleted_at IS NULL
       AND fr.type = $3
     GROUP BY fr.category, fr.type, fr.status`,
    [tenantId, eventId, costOrRevenue],
  );
  return r.rows;
}

export async function selectFinancialSummaryTotals(
  client: Pool | PoolClient,
  tenantId: string,
  eventId: string,
): Promise<{
  total_revenue: string;
  total_costs: string;
  record_count: string;
}> {
  const r = await client.query<{
    total_revenue: string;
    total_costs: string;
    record_count: string;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'revenue' THEN amount ELSE 0 END), 0)::text AS total_revenue,
       COALESCE(SUM(CASE WHEN type = 'cost' THEN amount ELSE 0 END), 0)::text AS total_costs,
       COUNT(*)::text AS record_count
     FROM financial_records
     WHERE tenant_id = $1 AND event_id = $2 AND deleted_at IS NULL`,
    [tenantId, eventId],
  );
  return r.rows[0]!;
}

/** For budget diff emit — caller passes previous totals before mutation. */
export async function selectNetTotals(
  client: Pool | PoolClient,
  tenantId: string,
  eventId: string,
): Promise<{ total_revenue: number; total_costs: number; record_count: number }> {
  const r = await selectFinancialSummaryTotals(client, tenantId, eventId);
  return {
    total_revenue: num(r.total_revenue),
    total_costs: num(r.total_costs),
    record_count: Number(r.record_count),
  };
}

export async function sumEventFinancialTotals(
  client: Pool | PoolClient,
  tenantId: string,
  eventId: string,
  extraWhere: string,
  extraVals: unknown[],
): Promise<{ costs: number; revenue: number; net: number }> {
  const r = await client.query<{ costs: string; revenue: string }>(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'cost' THEN amount ELSE 0 END), 0)::text AS costs,
       COALESCE(SUM(CASE WHEN type = 'revenue' THEN amount ELSE 0 END), 0)::text AS revenue
     FROM financial_records fr
     WHERE fr.tenant_id = $1 AND fr.event_id = $2 AND fr.deleted_at IS NULL ${extraWhere}`,
    [tenantId, eventId, ...extraVals],
  );
  const costs = num(r.rows[0]?.costs);
  const revenue = num(r.rows[0]?.revenue);
  return { costs, revenue, net: revenue - costs };
}

export async function insertInvoiceWithLines(
  client: PoolClient,
  p: {
    id: string;
    tenantId: string;
    eventId: string;
    clientId: string;
    invoiceNumber: string;
    status: string;
    taxRate: string | null;
    discount: string;
    discountType: string;
    subtotal: string;
    taxAmount: string;
    total: string;
    currency: string;
    dueDate: string;
    notes: string | null;
    paymentTerms: string | null;
    createdBy: string;
    lines: {
      id: string;
      description: string;
      quantity: string;
      unitPrice: string;
      amount: string;
      financialRecordId: string | null;
      sortOrder: number;
    }[];
  },
): Promise<void> {
  await client.query(
    `INSERT INTO invoices (
      id, tenant_id, event_id, client_id, invoice_number, status,
      tax_rate, discount, discount_type, subtotal, tax_amount, total, currency,
      due_date, notes, payment_terms, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::date,$15,$16,$17)`,
    [
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
    ],
  );
  for (const li of p.lines) {
    await client.query(
      `INSERT INTO invoice_line_items (
        id, invoice_id, tenant_id, description, quantity, unit_price, amount, financial_record_id, sort_order
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        li.id,
        p.id,
        p.tenantId,
        li.description,
        li.quantity,
        li.unitPrice,
        li.amount,
        li.financialRecordId,
        li.sortOrder,
      ],
    );
  }
}

export async function getInvoiceHeader(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
): Promise<(InvoiceRow & { raw: true }) | null> {
  const r = await client.query<InvoiceRow>(
    `SELECT i.*, e.name AS event_name, c.name AS client_name
     FROM invoices i
     INNER JOIN events e ON e.id = i.event_id AND e.tenant_id = i.tenant_id AND e.deleted_at IS NULL
     INNER JOIN clients c ON c.id = i.client_id AND c.tenant_id = i.tenant_id AND c.deleted_at IS NULL
     WHERE i.tenant_id = $1 AND i.id = $2`,
    [tenantId, id],
  );
  return (r.rows[0] as (InvoiceRow & { raw: true }) | undefined) ?? null;
}

export async function listInvoiceLines(
  client: Pool | PoolClient,
  tenantId: string,
  invoiceId: string,
): Promise<InvoiceLineRow[]> {
  const r = await client.query<InvoiceLineRow>(
    `SELECT id, description, quantity, unit_price, amount, financial_record_id
     FROM invoice_line_items
     WHERE tenant_id = $1 AND invoice_id = $2
     ORDER BY sort_order, id`,
    [tenantId, invoiceId],
  );
  return r.rows;
}

export type ListInvoiceParams = {
  tenantId: string;
  eventId?: string;
  clientId?: string;
  statuses?: string[];
  dateStart?: string;
  dateEnd?: string;
  limit: number;
  offset: number;
};

export async function listInvoices(
  client: Pool | PoolClient,
  p: ListInvoiceParams,
): Promise<{ rows: InvoiceRow[]; total: number }> {
  const cond: string[] = ["i.tenant_id = $1"];
  const v: unknown[] = [p.tenantId];
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
  const countR = await client.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM invoices i ${where}`,
    v,
  );
  const total = Number(countR.rows[0]?.c ?? 0);
  const r = await client.query<InvoiceRow>(
    `SELECT i.*, e.name AS event_name, c.name AS client_name
     FROM invoices i
     INNER JOIN events e ON e.id = i.event_id AND e.tenant_id = i.tenant_id AND e.deleted_at IS NULL
     INNER JOIN clients c ON c.id = i.client_id AND c.tenant_id = i.tenant_id AND c.deleted_at IS NULL
     ${where}
     ORDER BY i.created_at DESC
     LIMIT ${p.limit} OFFSET ${p.offset}`,
    v,
  );
  return { rows: r.rows, total };
}

export async function selectInvoiceTotals(
  client: Pool | PoolClient,
  tenantId: string,
  p: ListInvoiceParams,
): Promise<{ total_invoiced: number; total_paid: number; total_outstanding: number }> {
  const cond: string[] = ["i.tenant_id = $1"];
  const v: unknown[] = [p.tenantId];
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
  const r = await client.query<{ ti: string; tp: string }>(
    `SELECT
       COALESCE(SUM(i.total), 0)::text AS ti,
       COALESCE(SUM(CASE WHEN i.status = 'paid' THEN COALESCE(i.paid_amount, i.total) ELSE 0 END), 0)::text AS tp
     FROM invoices i ${where}`,
    v,
  );
  const total_invoiced = num(r.rows[0]?.ti);
  const total_paid = num(r.rows[0]?.tp);
  return {
    total_invoiced,
    total_paid,
    total_outstanding: total_invoiced - total_paid,
  };
}

export async function updateInvoiceRow(
  client: Pool | PoolClient,
  tenantId: string,
  id: string,
  patch: {
    status?: string;
    dueDate?: string;
    taxRate?: string | null;
    discount?: string;
    discountType?: string;
    subtotal?: string;
    taxAmount?: string;
    total?: string;
    notes?: string | null;
    paymentTerms?: string | null;
    paidDate?: string | null;
    paidAmount?: string | null;
  },
): Promise<boolean> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  const add = (col: string, val: unknown) => {
    sets.push(`${col} = $${i++}`);
    vals.push(val);
  };
  if (patch.status != null) add("status", patch.status);
  if (patch.dueDate != null) add("due_date", patch.dueDate);
  if (patch.taxRate !== undefined) add("tax_rate", patch.taxRate);
  if (patch.discount != null) add("discount", patch.discount);
  if (patch.discountType != null) add("discount_type", patch.discountType);
  if (patch.subtotal != null) add("subtotal", patch.subtotal);
  if (patch.taxAmount != null) add("tax_amount", patch.taxAmount);
  if (patch.total != null) add("total", patch.total);
  if (patch.notes !== undefined) add("notes", patch.notes);
  if (patch.paymentTerms !== undefined) add("payment_terms", patch.paymentTerms);
  if (patch.paidDate !== undefined) add("paid_date", patch.paidDate);
  if (patch.paidAmount !== undefined) add("paid_amount", patch.paidAmount);
  if (sets.length === 0) return true;
  sets.push("updated_at = NOW()");
  vals.push(tenantId, id);
  const r = await client.query(
    `UPDATE invoices SET ${sets.join(", ")} WHERE tenant_id = $${i++} AND id = $${i}`,
    vals,
  );
  return (r.rowCount ?? 0) > 0;
}

export async function deleteInvoiceLines(
  client: Pool | PoolClient,
  tenantId: string,
  invoiceId: string,
): Promise<void> {
  await client.query(
    `DELETE FROM invoice_line_items WHERE tenant_id = $1 AND invoice_id = $2`,
    [tenantId, invoiceId],
  );
}

export type CostReportGroupRow = {
  key: string;
  label: string;
  total_costs: string;
  total_revenue: string;
  record_count: string;
};

export async function costReportGrouped(
  client: Pool | PoolClient,
  p: {
    tenantId: string;
    dateStart: string;
    dateEnd: string;
    groupBy: "event" | "category" | "month" | "client";
    eventId?: string;
    clientId?: string;
    categories?: string[];
    statuses?: string[];
  },
): Promise<CostReportGroupRow[]> {
  const cond: string[] = [
    "fr.tenant_id = $1",
    "fr.deleted_at IS NULL",
    "fr.record_date >= $2::date",
    "fr.record_date <= $3::date",
  ];
  const v: unknown[] = [p.tenantId, p.dateStart, p.dateEnd];
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
  let keyExpr: string;
  let labelExpr: string;
  let groupExpr: string;
  let joinExtra = "";
  if (p.groupBy === "event") {
    keyExpr = "fr.event_id::text";
    labelExpr = "e.name";
    groupExpr = "fr.event_id, e.name";
  } else if (p.groupBy === "category") {
    keyExpr = "fr.category";
    labelExpr = "fr.category";
    groupExpr = "fr.category";
  } else if (p.groupBy === "month") {
    keyExpr = `to_char(date_trunc('month', fr.record_date), 'YYYY-MM')`;
    labelExpr = `to_char(date_trunc('month', fr.record_date), 'YYYY-MM')`;
    groupExpr = `date_trunc('month', fr.record_date)`;
  } else {
    keyExpr = "e.client_id::text";
    labelExpr = "c.name";
    groupExpr = "e.client_id, c.name";
    joinExtra = "INNER JOIN clients c ON c.id = e.client_id AND c.tenant_id = e.tenant_id AND c.deleted_at IS NULL";
  }
  const r = await client.query<CostReportGroupRow>(
    `SELECT
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
     ORDER BY label`,
    v,
  );
  return r.rows;
}

export async function costReportGrandTotals(
  client: Pool | PoolClient,
  p: {
    tenantId: string;
    dateStart: string;
    dateEnd: string;
    eventId?: string;
    clientId?: string;
    categories?: string[];
    statuses?: string[];
  },
): Promise<{ total_costs: number; total_revenue: number; record_count: number }> {
  const cond: string[] = [
    "fr.tenant_id = $1",
    "fr.deleted_at IS NULL",
    "fr.record_date >= $2::date",
    "fr.record_date <= $3::date",
  ];
  const v: unknown[] = [p.tenantId, p.dateStart, p.dateEnd];
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
  const r = await client.query<{ tc: string; tr: string; rc: string }>(
    `SELECT
       COALESCE(SUM(CASE WHEN fr.type = 'cost' THEN fr.amount ELSE 0 END), 0)::text AS tc,
       COALESCE(SUM(CASE WHEN fr.type = 'revenue' THEN fr.amount ELSE 0 END), 0)::text AS tr,
       COUNT(*)::text AS rc
     FROM financial_records fr
     INNER JOIN events e ON e.id = fr.event_id AND e.tenant_id = fr.tenant_id AND e.deleted_at IS NULL
     WHERE ${where}`,
    v,
  );
  return {
    total_costs: num(r.rows[0]?.tc),
    total_revenue: num(r.rows[0]?.tr),
    record_count: Number(r.rows[0]?.rc ?? 0),
  };
}
