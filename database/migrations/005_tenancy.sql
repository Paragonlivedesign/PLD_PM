-- Wave 0: tenants root table, department tenancy fields, FK to tenants

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'deactivated')),
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default tenant when `005_auth_module.sql` was not applied (id matches middleware dev default).
INSERT INTO tenants (id, name, slug, status, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Organization',
  'default',
  'active',
  '{}'
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE departments
  DROP CONSTRAINT IF EXISTS fk_departments_tenant;

ALTER TABLE departments
  ADD CONSTRAINT fk_departments_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants (id);

CREATE INDEX IF NOT EXISTS idx_departments_tenant_sort
  ON departments (tenant_id, sort_order)
  WHERE deleted_at IS NULL;
