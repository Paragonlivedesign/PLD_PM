-- Wave 2 — Financial: tenant-scoped financial records + invoices (contracts/financial.contract.md)

CREATE TABLE financial_records (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES events (id),
  category VARCHAR(32) NOT NULL,
  type VARCHAR(16) NOT NULL CHECK (type IN ('cost', 'revenue')),
  description TEXT NOT NULL,
  amount NUMERIC(19, 4) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  quantity NUMERIC(19, 4),
  unit_price NUMERIC(19, 4),
  record_date DATE,
  source VARCHAR(16) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'calculated', 'imported')),
  source_ref JSONB,
  status VARCHAR(16) NOT NULL DEFAULT 'estimated' CHECK (status IN ('estimated', 'actual', 'approved')),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_financial_records_tenant_event ON financial_records (tenant_id, event_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_financial_records_tenant_date ON financial_records (tenant_id, record_date)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_financial_records_tenant_created ON financial_records (tenant_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES events (id),
  client_id UUID NOT NULL REFERENCES clients (id),
  invoice_number VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'sent', 'paid', 'overdue', 'void')
  ),
  tax_rate NUMERIC(10, 4),
  discount NUMERIC(19, 4) NOT NULL DEFAULT 0,
  discount_type VARCHAR(16) NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage')),
  subtotal NUMERIC(19, 4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(19, 4) NOT NULL DEFAULT 0,
  total NUMERIC(19, 4) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  due_date DATE NOT NULL,
  paid_date DATE,
  paid_amount NUMERIC(19, 4),
  notes TEXT,
  payment_terms TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_invoices_tenant_number UNIQUE (tenant_id, invoice_number)
);

CREATE INDEX idx_invoices_tenant_event ON invoices (tenant_id, event_id);
CREATE INDEX idx_invoices_tenant_client ON invoices (tenant_id, client_id);
CREATE INDEX idx_invoices_tenant_status ON invoices (tenant_id, status);

CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(19, 4) NOT NULL,
  unit_price NUMERIC(19, 4) NOT NULL,
  amount NUMERIC(19, 4) NOT NULL,
  financial_record_id UUID REFERENCES financial_records (id),
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items (invoice_id);
CREATE INDEX idx_invoice_line_items_financial_record ON invoice_line_items (financial_record_id)
  WHERE financial_record_id IS NOT NULL;
