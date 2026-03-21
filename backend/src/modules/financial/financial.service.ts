import { randomUUID } from "node:crypto";
import { domainBus } from "../../domain/bus.js";
import { pool } from "../../db/pool.js";
import { HttpError } from "../../core/http-error.js";
import { getClientById } from "../clients/repository.js";
import { getEventById } from "../events/repository.js";
import { decodeListCursor, encodeListCursor } from "../trucks/trucks.repository.js";
import { getAssignmentDays } from "../scheduling/index.js";
import { getTravelCosts } from "../travel/index.js";
import * as repo from "./financial.repository.js";
import type { InvoiceRow } from "./financial.repository.js";
import {
  costReportQuerySchema,
  createFinancialRecordSchema,
  createInvoiceSchema,
  listFinancialRecordsQuerySchema,
  listInvoicesQuerySchema,
  updateFinancialRecordSchema,
  updateInvoiceSchema,
} from "./schemas.js";

function parseCsv(s: string | undefined): string[] | undefined {
  if (!s?.trim()) return undefined;
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function buildCategoryBuckets(
  aggs: repo.StatusAgg[],
  kind: "cost" | "revenue",
): Array<{
  category: string;
  estimated: number;
  actual: number;
  approved: number;
  count: number;
}> {
  const byCat = new Map<
    string,
    { estimated: number; actual: number; approved: number; count: number }
  >();
  for (const row of aggs) {
    if (row.type !== kind) continue;
    const cur = byCat.get(row.category) ?? {
      estimated: 0,
      actual: 0,
      approved: 0,
      count: 0,
    };
    const amt = Number(row.sum_amt);
    const c = Number(row.cnt);
    if (row.status === "estimated") cur.estimated += amt;
    else if (row.status === "actual") cur.actual += amt;
    else if (row.status === "approved") cur.approved += amt;
    cur.count += c;
    byCat.set(row.category, cur);
  }
  return [...byCat.entries()].map(([category, v]) => ({
    category,
    ...v,
  }));
}

function summaryFromAggs(aggs: repo.StatusAgg[]): {
  total_estimated_costs: number;
  total_actual_costs: number;
  total_approved_costs: number;
  total_estimated_revenue: number;
  total_actual_revenue: number;
  total_approved_revenue: number;
} {
  let total_estimated_costs = 0;
  let total_actual_costs = 0;
  let total_approved_costs = 0;
  let total_estimated_revenue = 0;
  let total_actual_revenue = 0;
  let total_approved_revenue = 0;
  for (const row of aggs) {
    const amt = Number(row.sum_amt);
    if (row.type === "cost") {
      if (row.status === "estimated") total_estimated_costs += amt;
      if (row.status === "actual") total_actual_costs += amt;
      if (row.status === "approved") total_approved_costs += amt;
    } else {
      if (row.status === "estimated") total_estimated_revenue += amt;
      if (row.status === "actual") total_actual_revenue += amt;
      if (row.status === "approved") total_approved_revenue += amt;
    }
  }
  return {
    total_estimated_costs,
    total_actual_costs,
    total_approved_costs,
    total_estimated_revenue,
    total_actual_revenue,
    total_approved_revenue,
  };
}

export async function getEventBudgetApi(tenantId: string, eventId: string) {
  const ev = await getEventById(pool, tenantId, eventId);
  if (!ev) throw new HttpError(404, "NOT_FOUND", "Event not found");
  const [costAggs, revAggs] = await Promise.all([
    repo.selectFinancialAggregatesByCategoryStatus(pool, tenantId, eventId, "cost"),
    repo.selectFinancialAggregatesByCategoryStatus(pool, tenantId, eventId, "revenue"),
  ]);
  const aggs = [...costAggs, ...revAggs];
  const totals = await repo.selectNetTotals(pool, tenantId, eventId);
  const total_revenue = totals.total_revenue;
  const total_costs = totals.total_costs;
  const net_profit = total_revenue - total_costs;
  const profit_margin_pct =
    total_revenue > 0 ? (net_profit / total_revenue) * 100 : 0;
  const costs_by_category = buildCategoryBuckets(aggs, "cost");
  const revenue_by_category = buildCategoryBuckets(aggs, "revenue");
  const summary = summaryFromAggs(aggs);
  return {
    data: {
      event_id: eventId,
      event_name: ev.name,
      currency: "USD",
      total_revenue,
      total_costs,
      net_profit,
      profit_margin_pct,
      costs_by_category,
      revenue_by_category,
      summary,
    },
    meta: {
      last_calculated_at: new Date().toISOString(),
      record_count: totals.record_count,
    },
  };
}

function emitBudgetUpdated(
  tenantId: string,
  eventId: string,
  prev: { costs: number; revenue: number; net: number },
  next: { costs: number; revenue: number; net: number },
  trigger: string,
): void {
  domainBus.emit("budget.updated", {
    event_id: eventId,
    tenant_id: tenantId,
    previous_total_costs: prev.costs,
    new_total_costs: next.costs,
    previous_total_revenue: prev.revenue,
    new_total_revenue: next.revenue,
    previous_net: prev.net,
    new_net: next.net,
    trigger,
    updated_at: new Date().toISOString(),
  });
}

export async function createFinancialRecordApi(
  tenantId: string,
  userId: string,
  body: unknown,
) {
  const parsed = createFinancialRecordSchema.parse(body);
  const ev = await getEventById(pool, tenantId, parsed.event_id);
  if (!ev) throw new HttpError(404, "NOT_FOUND", "Event not found", "event_id");

  let amount = parsed.amount;
  if (amount == null && parsed.quantity != null && parsed.unit_price != null) {
    amount = parsed.quantity * parsed.unit_price;
  }
  if (amount == null || Number.isNaN(amount)) {
    throw new HttpError(400, "VALIDATION", "amount or quantity+unit_price required");
  }

  const prev = await repo.selectNetTotals(pool, tenantId, parsed.event_id);
  const prevNet = {
    costs: prev.total_costs,
    revenue: prev.total_revenue,
    net: prev.total_revenue - prev.total_costs,
  };

  const id = randomUUID();
  const row = await repo.insertFinancialRecordSimple(pool, {
    id,
    tenantId,
    eventId: parsed.event_id,
    category: parsed.category,
    type: parsed.type,
    description: parsed.description,
    amount: String(amount),
    currency: parsed.currency ?? "USD",
    quantity: parsed.quantity != null ? String(parsed.quantity) : null,
    unitPrice: parsed.unit_price != null ? String(parsed.unit_price) : null,
    recordDate: parsed.date ?? null,
    source: parsed.source ?? "manual",
    sourceRef: parsed.source_ref ?? null,
    status: parsed.status ?? "estimated",
    notes: parsed.notes ?? null,
    metadata: parsed.metadata ?? {},
  });

  const nextT = await repo.selectNetTotals(pool, tenantId, parsed.event_id);
  const nextNet = {
    costs: nextT.total_costs,
    revenue: nextT.total_revenue,
    net: nextT.total_revenue - nextT.total_costs,
  };
  emitBudgetUpdated(tenantId, parsed.event_id, prevNet, nextNet, "record_created");

  void userId;
  return repo.mapFinancialRecordRow(row);
}

export async function listFinancialRecordsApi(tenantId: string, query: unknown) {
  const q = listFinancialRecordsQuerySchema.parse(query);
  const limit = q.limit ?? 25;
  const offset = decodeListCursor(q.cursor ?? null);
  const rows = await repo.listFinancialRecords(pool, {
    tenantId,
    eventId: q.event_id,
    categories: parseCsv(q.category),
    type: q.type,
    statuses: parseCsv(q.status),
    sources: parseCsv(q.source),
    dateStart: q.date_range_start,
    dateEnd: q.date_range_end,
    minAmount: q.min_amount,
    maxAmount: q.max_amount,
    search: q.search,
    sortBy: q.sort_by ?? "date",
    sortOrder: q.sort_order ?? "desc",
    limit: limit + 1,
    offset,
  });
  const hasMore = rows.rows.length > limit;
  const slice = hasMore ? rows.rows.slice(0, limit) : rows.rows;
  const nextCursor = hasMore ? encodeListCursor(offset + limit) : null;
  return {
    data: slice.map((r) => repo.mapFinancialRecordRow(r)),
    meta: {
      cursor: nextCursor,
      has_more: hasMore,
      total_count: rows.total,
    },
  };
}

export async function getFinancialRecordApi(tenantId: string, id: string) {
  const row = await repo.getFinancialRecordById(pool, tenantId, id);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Financial record not found");
  return repo.mapFinancialRecordRow(row);
}

export async function updateFinancialRecordApi(
  tenantId: string,
  id: string,
  body: unknown,
) {
  const parsed = updateFinancialRecordSchema.parse(body);
  const existing = await repo.getFinancialRecordById(pool, tenantId, id);
  if (!existing) throw new HttpError(404, "NOT_FOUND", "Financial record not found");

  const eventId = existing.event_id;
  const prev = await repo.selectNetTotals(pool, tenantId, eventId);
  const prevNet = {
    costs: prev.total_costs,
    revenue: prev.total_revenue,
    net: prev.total_revenue - prev.total_costs,
  };

  let amountStr: string | undefined;
  if (parsed.amount != null) amountStr = String(parsed.amount);
  const mergedMeta =
    parsed.metadata != null
      ? { ...(existing.metadata as Record<string, unknown>), ...parsed.metadata }
      : undefined;
  const patch: Parameters<typeof repo.updateFinancialRecordPartial>[3] = {
    category: parsed.category,
    description: parsed.description,
    amount: amountStr,
    quantity:
      parsed.quantity !== undefined
        ? parsed.quantity != null
          ? String(parsed.quantity)
          : null
        : undefined,
    unitPrice:
      parsed.unit_price !== undefined
        ? parsed.unit_price != null
          ? String(parsed.unit_price)
          : null
        : undefined,
    recordDate: parsed.date,
    status: parsed.status,
    notes: parsed.notes,
    metadata: mergedMeta,
  };
  const row = await repo.updateFinancialRecordPartial(pool, tenantId, id, patch);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Financial record not found");

  const nextT = await repo.selectNetTotals(pool, tenantId, eventId);
  const nextNet = {
    costs: nextT.total_costs,
    revenue: nextT.total_revenue,
    net: nextT.total_revenue - nextT.total_costs,
  };
  emitBudgetUpdated(tenantId, eventId, prevNet, nextNet, "record_updated");

  return repo.mapFinancialRecordRow(row);
}

export async function deleteFinancialRecordApi(tenantId: string, id: string) {
  const existing = await repo.getFinancialRecordById(pool, tenantId, id);
  if (!existing) throw new HttpError(404, "NOT_FOUND", "Financial record not found");
  if (existing.source === "calculated") {
    throw new HttpError(
      409,
      "CONFLICT",
      "Calculated records cannot be deleted directly",
    );
  }
  const locked = await repo.isFinancialRecordLockedByInvoice(pool, tenantId, id);
  if (locked) {
    throw new HttpError(
      409,
      "CONFLICT",
      "Record is attached to a non-draft invoice",
    );
  }

  const eventId = existing.event_id;
  const prev = await repo.selectNetTotals(pool, tenantId, eventId);
  const prevNet = {
    costs: prev.total_costs,
    revenue: prev.total_revenue,
    net: prev.total_revenue - prev.total_costs,
  };

  const del = await repo.softDeleteFinancialRecord(pool, tenantId, id);
  if (!del) throw new HttpError(404, "NOT_FOUND", "Financial record not found");

  const nextT = await repo.selectNetTotals(pool, tenantId, eventId);
  const nextNet = {
    costs: nextT.total_costs,
    revenue: nextT.total_revenue,
    net: nextT.total_revenue - nextT.total_costs,
  };
  emitBudgetUpdated(tenantId, eventId, prevNet, nextNet, "record_deleted");

  return del;
}

export async function listEventFinancialsApi(
  tenantId: string,
  eventId: string,
  query: unknown,
) {
  const ev = await getEventById(pool, tenantId, eventId);
  if (!ev) throw new HttpError(404, "NOT_FOUND", "Event not found");
  const q = listFinancialRecordsQuerySchema.parse(query);
  const limit = q.limit ?? 25;
  const offset = decodeListCursor(q.cursor ?? null);
  const rows = await repo.listFinancialRecords(pool, {
    tenantId,
    eventId,
    categories: parseCsv(q.category),
    type: q.type,
    statuses: parseCsv(q.status),
    sources: parseCsv(q.source),
    dateStart: q.date_range_start,
    dateEnd: q.date_range_end,
    minAmount: q.min_amount,
    maxAmount: q.max_amount,
    search: q.search,
    sortBy: q.sort_by ?? "date",
    sortOrder: q.sort_order ?? "desc",
    limit: limit + 1,
    offset,
  });
  const hasMore = rows.rows.length > limit;
  const slice = hasMore ? rows.rows.slice(0, limit) : rows.rows;
  const nextCursor = hasMore ? encodeListCursor(offset + limit) : null;
  const totals = await repo.sumEventFinancialTotals(pool, tenantId, eventId, "", []);
  return {
    data: slice.map((r) => repo.mapFinancialRecordRow(r)),
    meta: {
      cursor: nextCursor,
      has_more: hasMore,
      total_count: rows.total,
      totals: {
        costs: totals.costs,
        revenue: totals.revenue,
        net: totals.net,
      },
    },
  };
}

function mapInvoice(inv: InvoiceRow, lines: repo.InvoiceLineRow[]) {
  return {
    id: inv.id,
    invoice_number: inv.invoice_number,
    event_id: inv.event_id,
    event_name: inv.event_name,
    client_id: inv.client_id,
    client_name: inv.client_name,
    status: inv.status,
    line_items: lines.map((li) => ({
      id: li.id,
      description: li.description,
      quantity: Number(li.quantity),
      unit_price: Number(li.unit_price),
      amount: Number(li.amount),
      financial_record_id: li.financial_record_id,
    })),
    subtotal: Number(inv.subtotal),
    tax_rate: inv.tax_rate != null ? Number(inv.tax_rate) : null,
    tax_amount: Number(inv.tax_amount),
    discount: Number(inv.discount),
    discount_type: inv.discount_type,
    total: Number(inv.total),
    currency: inv.currency,
    due_date: inv.due_date.toISOString().slice(0, 10),
    paid_date: inv.paid_date ? inv.paid_date.toISOString().slice(0, 10) : null,
    paid_amount: inv.paid_amount != null ? Number(inv.paid_amount) : null,
    notes: inv.notes,
    payment_terms: inv.payment_terms,
    created_at: inv.created_at.toISOString(),
    updated_at: inv.updated_at.toISOString(),
  };
}

function computeInvoiceTotals(
  lines: { quantity: number; unit_price: number }[],
  taxRate: number | undefined,
  discount: number,
  discountType: "fixed" | "percentage",
): { subtotal: string; taxAmount: string; total: string } {
  const subtotal = lines.reduce((s, li) => s + li.quantity * li.unit_price, 0);
  let discAmt = discount;
  if (discountType === "percentage") {
    discAmt = (subtotal * discount) / 100;
  }
  const afterDisc = Math.max(0, subtotal - discAmt);
  const tr = taxRate ?? 0;
  const taxAmount = (afterDisc * tr) / 100;
  const total = afterDisc + taxAmount;
  return {
    subtotal: String(subtotal),
    taxAmount: String(taxAmount),
    total: String(total),
  };
}

export async function createInvoiceApi(
  tenantId: string,
  userId: string,
  body: unknown,
) {
  const parsed = createInvoiceSchema.parse(body);
  const ev = await getEventById(pool, tenantId, parsed.event_id);
  if (!ev) throw new HttpError(404, "NOT_FOUND", "Event not found");
  const cl = await getClientById(pool, tenantId, parsed.client_id);
  if (!cl) throw new HttpError(404, "NOT_FOUND", "Client not found");

  const lineNums = parsed.line_items.map((li) => ({
    quantity: li.quantity,
    unit_price: li.unit_price,
  }));
  const totals = computeInvoiceTotals(
    lineNums,
    parsed.tax_rate,
    parsed.discount ?? 0,
    parsed.discount_type ?? "fixed",
  );

  const invoiceNumber =
    parsed.invoice_number ?? `INV-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  const id = randomUUID();
  const discountType = parsed.discount_type ?? "fixed";

  const lines = parsed.line_items.map((li, idx) => ({
    id: randomUUID(),
    description: li.description,
    quantity: String(li.quantity),
    unitPrice: String(li.unit_price),
    amount: String(li.quantity * li.unit_price),
    financialRecordId: li.financial_record_id ?? null,
    sortOrder: idx,
  }));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await repo.insertInvoiceWithLines(client, {
      id,
      tenantId,
      eventId: parsed.event_id,
      clientId: parsed.client_id,
      invoiceNumber,
      status: "draft",
      taxRate: parsed.tax_rate != null ? String(parsed.tax_rate) : null,
      discount: String(parsed.discount ?? 0),
      discountType,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      total: totals.total,
      currency: "USD",
      dueDate: parsed.due_date,
      notes: parsed.notes ?? null,
      paymentTerms: parsed.payment_terms ?? null,
      createdBy: userId,
      lines,
    });
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  const inv = await repo.getInvoiceHeader(pool, tenantId, id);
  const liRows = await repo.listInvoiceLines(pool, tenantId, id);
  const data = mapInvoice(inv!, liRows);

  domainBus.emit("invoice.created", {
    invoice_id: id,
    invoice_number: invoiceNumber,
    tenant_id: tenantId,
    event_id: parsed.event_id,
    client_id: parsed.client_id,
    total: Number(totals.total),
    currency: "USD",
    due_date: parsed.due_date,
    line_item_count: lines.length,
    created_by: userId,
    created_at: new Date().toISOString(),
  });

  return data;
}

export async function listInvoicesApi(tenantId: string, query: unknown) {
  const q = listInvoicesQuerySchema.parse(query);
  const limit = q.limit ?? 25;
  const offset = decodeListCursor(q.cursor ?? null);
  const params: repo.ListInvoiceParams = {
    tenantId,
    eventId: q.event_id,
    clientId: q.client_id,
    statuses: parseCsv(q.status),
    dateStart: q.date_range_start,
    dateEnd: q.date_range_end,
    limit: limit + 1,
    offset,
  };
  const { rows, total } = await repo.listInvoices(pool, params);
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? encodeListCursor(offset + limit) : null;
  const totals = await repo.selectInvoiceTotals(pool, tenantId, {
    ...params,
    limit: total,
    offset: 0,
  });
  const data = await Promise.all(
    slice.map(async (inv) => {
      const lines = await repo.listInvoiceLines(pool, tenantId, inv.id);
      return mapInvoice(inv, lines);
    }),
  );
  return {
    data,
    meta: {
      cursor: nextCursor,
      has_more: hasMore,
      total_count: total,
      totals,
    },
  };
}

export async function getInvoiceApi(tenantId: string, id: string) {
  const inv = await repo.getInvoiceHeader(pool, tenantId, id);
  if (!inv) throw new HttpError(404, "NOT_FOUND", "Invoice not found");
  const lines = await repo.listInvoiceLines(pool, tenantId, id);
  return mapInvoice(inv, lines);
}

export async function updateInvoiceApi(tenantId: string, userId: string, id: string, body: unknown) {
  const parsed = updateInvoiceSchema.parse(body);
  const inv = await repo.getInvoiceHeader(pool, tenantId, id);
  if (!inv) throw new HttpError(404, "NOT_FOUND", "Invoice not found");
  if (
    inv.status !== "draft" &&
    (parsed.line_items ||
      parsed.due_date ||
      parsed.tax_rate !== undefined ||
      parsed.discount !== undefined ||
      parsed.discount_type)
  ) {
    throw new HttpError(
      409,
      "CONFLICT",
      "Only draft invoices can be modified for line items and pricing fields",
    );
  }

  const prevStatus = inv.status;
  let subtotal = inv.subtotal;
  let taxAmount = inv.tax_amount;
  let total = inv.total;
  let taxRate = inv.tax_rate;
  let discount = inv.discount;
  let discountType = inv.discount_type;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (parsed.line_items && inv.status === "draft") {
      await repo.deleteInvoiceLines(client, tenantId, id);
      const lineNums = parsed.line_items.map((li) => ({
        quantity: li.quantity,
        unit_price: li.unit_price,
      }));
      const tr =
        parsed.tax_rate !== undefined && parsed.tax_rate !== null
          ? parsed.tax_rate
          : inv.tax_rate != null
            ? Number(inv.tax_rate)
            : undefined;
      const disc = parsed.discount ?? Number(inv.discount);
      const dt = (parsed.discount_type ?? inv.discount_type) as "fixed" | "percentage";
      const t = computeInvoiceTotals(lineNums, tr, disc, dt);
      subtotal = t.subtotal;
      taxAmount = t.taxAmount;
      total = t.total;
      taxRate = tr != null ? String(tr) : null;
      discount = String(disc);
      discountType = dt;

      let idx = 0;
      for (const li of parsed.line_items) {
        await client.query(
          `INSERT INTO invoice_line_items (
            id, invoice_id, tenant_id, description, quantity, unit_price, amount, financial_record_id, sort_order
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            randomUUID(),
            id,
            tenantId,
            li.description,
            String(li.quantity),
            String(li.unit_price),
            String(li.quantity * li.unit_price),
            li.financial_record_id ?? null,
            idx++,
          ],
        );
      }
    } else if (
      inv.status === "draft" &&
      (parsed.tax_rate !== undefined || parsed.discount !== undefined || parsed.discount_type)
    ) {
      const lines = await repo.listInvoiceLines(pool, tenantId, id);
      const lineNums = lines.map((li) => ({
        quantity: Number(li.quantity),
        unit_price: Number(li.unit_price),
      }));
      const tr =
        parsed.tax_rate !== undefined && parsed.tax_rate !== null
          ? parsed.tax_rate
          : inv.tax_rate != null
            ? Number(inv.tax_rate)
            : undefined;
      const disc = parsed.discount ?? Number(inv.discount);
      const dt = (parsed.discount_type ?? inv.discount_type) as "fixed" | "percentage";
      const t = computeInvoiceTotals(lineNums, tr, disc, dt);
      subtotal = t.subtotal;
      taxAmount = t.taxAmount;
      total = t.total;
      taxRate = tr != null ? String(tr) : null;
      discount = String(disc);
      discountType = dt;
    }

    const newStatus = parsed.status ?? inv.status;
    const patch: Parameters<typeof repo.updateInvoiceRow>[3] = {};
    if (parsed.status != null) patch.status = parsed.status;
    if (parsed.due_date != null) patch.dueDate = parsed.due_date;
    if (parsed.tax_rate !== undefined) patch.taxRate = taxRate as string | null;
    if (parsed.discount !== undefined || parsed.discount_type || parsed.line_items) {
      patch.discount = discount;
    }
    if (parsed.discount_type != null || parsed.line_items) patch.discountType = discountType;
    if (parsed.line_items || parsed.tax_rate !== undefined || parsed.discount !== undefined) {
      patch.subtotal = subtotal;
      patch.taxAmount = taxAmount;
      patch.total = total;
    }
    if (parsed.notes !== undefined) patch.notes = parsed.notes;
    if (parsed.payment_terms !== undefined) patch.paymentTerms = parsed.payment_terms;
    if (parsed.paid_date !== undefined) patch.paidDate = parsed.paid_date;
    if (parsed.paid_amount !== undefined)
      patch.paidAmount =
        parsed.paid_amount != null ? String(parsed.paid_amount) : null;

    await repo.updateInvoiceRow(client, tenantId, id, patch);

    await client.query("COMMIT");

    if (newStatus !== prevStatus) {
      domainBus.emit("payment.statusChanged", {
        invoice_id: id,
        invoice_number: inv.invoice_number,
        tenant_id: tenantId,
        event_id: inv.event_id,
        client_id: inv.client_id,
        previous_status: prevStatus,
        new_status: newStatus,
        total: Number(total),
        paid_amount: parsed.paid_amount ?? (newStatus === "paid" ? Number(total) : null),
        paid_date:
          parsed.paid_date ??
          (newStatus === "paid" ? new Date().toISOString().slice(0, 10) : null),
        changed_by: userId,
        changed_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return getInvoiceApi(tenantId, id);
}

export async function costReportApi(tenantId: string, query: unknown) {
  const q = costReportQuerySchema.parse(query);
  const groupBy = q.group_by ?? "event";
  const categories = parseCsv(q.category);
  const statuses = parseCsv(q.status);
  const groups = await repo.costReportGrouped(pool, {
    tenantId,
    dateStart: q.date_range_start,
    dateEnd: q.date_range_end,
    groupBy,
    eventId: q.event_id,
    clientId: q.client_id,
    categories,
    statuses,
  });
  const grand = await repo.costReportGrandTotals(pool, {
    tenantId,
    dateStart: q.date_range_start,
    dateEnd: q.date_range_end,
    eventId: q.event_id,
    clientId: q.client_id,
    categories,
    statuses,
  });
  return {
    data: {
      period: { start: q.date_range_start, end: q.date_range_end },
      group_by: groupBy,
      groups: groups.map((g) => ({
        key: g.key,
        label: g.label,
        total_costs: Number(g.total_costs),
        total_revenue: Number(g.total_revenue),
        net: Number(g.total_revenue) - Number(g.total_costs),
        record_count: Number(g.record_count),
        breakdown: [] as { category: string; amount: number; count: number }[],
      })),
      totals: {
        total_costs: grand.total_costs,
        total_revenue: grand.total_revenue,
        net: grand.total_revenue - grand.total_costs,
        record_count: grand.record_count,
      },
    },
    meta: {
      generated_at: new Date().toISOString(),
      currency: "USD",
    },
  };
}

/** CSV export for cost report (same filters as `GET /reports/costs`). */
export async function costReportCsvApi(tenantId: string, query: unknown): Promise<string> {
  const { data } = await costReportApi(tenantId, query);
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [
    "group_key,group_label,total_costs,total_revenue,net,record_count",
    ...data.groups.map((g) =>
      [
        esc(g.key),
        esc(g.label),
        g.total_costs,
        g.total_revenue,
        g.net,
        g.record_count,
      ].join(","),
    ),
    [
      "TOTAL",
      "",
      data.totals.total_costs,
      data.totals.total_revenue,
      data.totals.net,
      data.totals.record_count,
    ].join(","),
  ];
  return lines.join("\n");
}

export async function recalculateEventCostsApi(
  tenantId: string,
  eventId: string,
  options?: { triggered_by?: string },
) {
  const ev = await getEventById(pool, tenantId, eventId);
  if (!ev) throw new HttpError(404, "NOT_FOUND", "Event not found");

  const trigger = options?.triggered_by ?? "recalculate";
  const prev = await repo.selectNetTotals(pool, tenantId, eventId);
  const prevNet = {
    costs: prev.total_costs,
    revenue: prev.total_revenue,
    net: prev.total_revenue - prev.total_costs,
  };

  const client = await pool.connect();
  let recordsDeleted = 0;
  let recordsCreated = 0;
  try {
    await client.query("BEGIN");
    recordsDeleted = await repo.softDeleteUnlockedCalculatedCostRecordsForEvent(
      client,
      tenantId,
      eventId,
    );

    const days = await getAssignmentDays(eventId, tenantId, { type: "all" });
    const travel = await getTravelCosts(eventId, tenantId, {
      include_cancelled: false,
    });
    const currency = travel.currency || "USD";

    const labor = days.crew.total_day_rate_cost;
    const perDiem = days.crew.total_per_diem_cost;
    const travelTotal = Number(travel.total_cost);
    const truckFleet = days.truck.total_daily_rate_cost;

    if (labor > 0) {
      await repo.insertFinancialRecordSimple(client, {
        id: randomUUID(),
        tenantId,
        eventId,
        category: "labor",
        type: "cost",
        description: "Labor (from scheduling assignments)",
        amount: String(labor),
        currency,
        quantity: null,
        unitPrice: null,
        recordDate: null,
        source: "calculated",
        sourceRef: { kind: "scheduling", component: "day_rate" },
        status: "actual",
        notes: null,
        metadata: {},
      });
      recordsCreated += 1;
    }
    if (perDiem > 0) {
      await repo.insertFinancialRecordSimple(client, {
        id: randomUUID(),
        tenantId,
        eventId,
        category: "miscellaneous",
        type: "cost",
        description: "Per diem (from scheduling assignments)",
        amount: String(perDiem),
        currency,
        quantity: null,
        unitPrice: null,
        recordDate: null,
        source: "calculated",
        sourceRef: { kind: "scheduling", component: "per_diem" },
        status: "actual",
        notes: null,
        metadata: {},
      });
      recordsCreated += 1;
    }
    if (travelTotal > 0) {
      await repo.insertFinancialRecordSimple(client, {
        id: randomUUID(),
        tenantId,
        eventId,
        category: "travel",
        type: "cost",
        description: "Travel and accommodation (from travel module)",
        amount: String(travelTotal),
        currency,
        quantity: null,
        unitPrice: null,
        recordDate: null,
        source: "calculated",
        sourceRef: { kind: "travel", component: "aggregated" },
        status: "actual",
        notes: null,
        metadata: {},
      });
      recordsCreated += 1;
    }
    if (truckFleet > 0) {
      await repo.insertFinancialRecordSimple(client, {
        id: randomUUID(),
        tenantId,
        eventId,
        category: "transport",
        type: "cost",
        description: "Fleet / truck daily rates (from scheduling truck assignments)",
        amount: String(truckFleet),
        currency,
        quantity: null,
        unitPrice: null,
        recordDate: null,
        source: "calculated",
        sourceRef: { kind: "scheduling", component: "truck_daily_rate" },
        status: "actual",
        notes: null,
        metadata: {},
      });
      recordsCreated += 1;
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  const totals = await repo.selectNetTotals(pool, tenantId, eventId);
  const nextNet = {
    costs: totals.total_costs,
    revenue: totals.total_revenue,
    net: totals.total_revenue - totals.total_costs,
  };
  if (
    prevNet.costs !== nextNet.costs ||
    prevNet.revenue !== nextNet.revenue ||
    prevNet.net !== nextNet.net
  ) {
    emitBudgetUpdated(tenantId, eventId, prevNet, nextNet, trigger);
  }

  return {
    event_id: eventId,
    records_updated: 0,
    records_created: recordsCreated,
    records_deleted: recordsDeleted,
    new_total_costs: totals.total_costs,
  };
}

/** Internal: same shape as HTTP budget `data` + `meta.last_calculated_at`. */
export async function getEventBudgetInternal(tenantId: string, eventId: string) {
  return getEventBudgetApi(tenantId, eventId);
}

export async function getEventCostsInternal(
  tenantId: string,
  eventId: string,
  _options?: { category?: string[]; source?: string[]; status?: string[] },
) {
  const ev = await getEventById(pool, tenantId, eventId);
  if (!ev) return null;
  const { rows } = await repo.listFinancialRecords(pool, {
    tenantId,
    eventId,
    type: "cost",
    categories: _options?.category,
    statuses: _options?.status,
    sources: _options?.source,
    sortBy: "created_at",
    sortOrder: "desc",
    limit: 10_000,
    offset: 0,
  });
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  return {
    event_id: eventId,
    total,
    currency: "USD",
    records: rows.map((r) => repo.mapFinancialRecordRow(r)),
  };
}

export { recalculateEventCostsApi as recalculateEventCostsInternal };
