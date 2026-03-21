import { z } from "zod";

export const FINANCIAL_CATEGORIES = [
  "labor",
  "travel",
  "transport",
  "equipment",
  "venue",
  "catering",
  "accommodation",
  "miscellaneous",
  "revenue",
] as const;

export const createFinancialRecordSchema = z.object({
  event_id: z.string().uuid(),
  category: z.enum(FINANCIAL_CATEGORIES),
  type: z.enum(["cost", "revenue"]),
  description: z.string().min(1).max(500),
  amount: z.coerce.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  quantity: z.coerce.number().nonnegative().optional(),
  unit_price: z.coerce.number().nonnegative().optional(),
  date: z.string().optional(),
  source: z.enum(["manual", "calculated", "imported"]).optional(),
  source_ref: z.record(z.unknown()).optional(),
  status: z.enum(["estimated", "actual", "approved"]).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateFinancialRecordSchema = z.object({
  category: z.enum(FINANCIAL_CATEGORIES).optional(),
  description: z.string().min(1).max(500).optional(),
  amount: z.coerce.number().nonnegative().optional(),
  quantity: z.coerce.number().nonnegative().optional(),
  unit_price: z.coerce.number().nonnegative().optional(),
  date: z.string().nullable().optional(),
  status: z.enum(["estimated", "actual", "approved"]).optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const listFinancialRecordsQuerySchema = z.object({
  event_id: z.string().uuid().optional(),
  category: z.string().optional(),
  type: z.enum(["cost", "revenue"]).optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  date_range_start: z.string().optional(),
  date_range_end: z.string().optional(),
  min_amount: z.coerce.number().optional(),
  max_amount: z.coerce.number().optional(),
  search: z.string().optional(),
  sort_by: z.enum(["date", "amount", "category", "created_at"]).optional(),
  sort_order: z.enum(["asc", "desc"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

export const invoiceLineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().nonnegative(),
  financial_record_id: z.string().uuid().optional(),
});

export const createInvoiceSchema = z.object({
  event_id: z.string().uuid(),
  client_id: z.string().uuid(),
  invoice_number: z.string().min(1).max(64).optional(),
  line_items: z.array(invoiceLineItemSchema).min(1),
  due_date: z.string(),
  tax_rate: z.coerce.number().nonnegative().optional(),
  discount: z.coerce.number().nonnegative().optional(),
  discount_type: z.enum(["fixed", "percentage"]).optional(),
  notes: z.string().optional(),
  payment_terms: z.string().optional(),
});

export const updateInvoiceSchema = z.object({
  line_items: z.array(invoiceLineItemSchema).optional(),
  due_date: z.string().optional(),
  tax_rate: z.coerce.number().nonnegative().nullable().optional(),
  discount: z.coerce.number().nonnegative().optional(),
  discount_type: z.enum(["fixed", "percentage"]).optional(),
  notes: z.string().nullable().optional(),
  payment_terms: z.string().nullable().optional(),
  status: z.enum(["draft", "sent", "paid", "overdue", "void"]).optional(),
  paid_date: z.string().nullable().optional(),
  paid_amount: z.coerce.number().nonnegative().nullable().optional(),
});

export const listInvoicesQuerySchema = z.object({
  event_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  status: z.string().optional(),
  date_range_start: z.string().optional(),
  date_range_end: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

export const costReportQuerySchema = z.object({
  date_range_start: z.string(),
  date_range_end: z.string(),
  group_by: z.enum(["event", "category", "month", "client"]).optional(),
  event_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
});
