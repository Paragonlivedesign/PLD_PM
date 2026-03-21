-- Domain: vendors (Phase 0 scope §4 — tenant-scoped suppliers)

CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  phone VARCHAR(64),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_vendors_tenant ON vendors (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_tenant_name ON vendors (tenant_id, lower(name)) WHERE deleted_at IS NULL;
