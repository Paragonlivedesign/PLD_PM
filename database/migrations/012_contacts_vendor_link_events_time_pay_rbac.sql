-- Contacts (polymorphic parent), vendor↔client link, event primary contact,
-- time/pay foundation tables, RBAC seeds for clients/events/venues/vendors/me.

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
CREATE TABLE contacts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  parent_type VARCHAR(32) NOT NULL
    CONSTRAINT chk_contacts_parent_type CHECK (parent_type IN (
      'client_organization',
      'vendor_organization',
      'venue'
    )),
  parent_id UUID NOT NULL,
  personnel_id UUID REFERENCES personnel (id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(64),
  title VARCHAR(255),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_contacts_tenant_parent
  ON contacts (tenant_id, parent_type, parent_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_contacts_tenant_personnel
  ON contacts (tenant_id, personnel_id)
  WHERE deleted_at IS NULL AND personnel_id IS NOT NULL;

CREATE UNIQUE INDEX uq_contacts_one_primary_per_parent
  ON contacts (tenant_id, parent_type, parent_id)
  WHERE deleted_at IS NULL AND is_primary = TRUE;

-- ---------------------------------------------------------------------------
-- vendors ↔ clients (incremental link; validate same tenant in application)
-- Skipped when `vendors` is missing (some baselined dev DBs skipped 007 DDL).
-- ---------------------------------------------------------------------------
DO $pld_vendor_link$
BEGIN
  IF to_regclass('public.vendors') IS NOT NULL THEN
    ALTER TABLE vendors
      ADD COLUMN IF NOT EXISTS linked_client_id UUID REFERENCES clients (id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_vendors_linked_client
      ON vendors (tenant_id, linked_client_id)
      WHERE deleted_at IS NULL AND linked_client_id IS NOT NULL;
  END IF;
END
$pld_vendor_link$;

-- ---------------------------------------------------------------------------
-- events.primary_contact_id → contacts
-- ---------------------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS primary_contact_id UUID REFERENCES contacts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_primary_contact
  ON events (tenant_id, primary_contact_id)
  WHERE deleted_at IS NULL AND primary_contact_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- time_entries (clock foundation)
-- ---------------------------------------------------------------------------
CREATE TABLE time_entries (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  personnel_id UUID NOT NULL REFERENCES personnel (id) ON DELETE CASCADE,
  event_id UUID REFERENCES events (id) ON DELETE SET NULL,
  crew_assignment_id UUID,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_time_entries_tenant_personnel_started
  ON time_entries (tenant_id, personnel_id, started_at DESC)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- pay_periods + pay_statements (shell for export-first payroll)
-- ---------------------------------------------------------------------------
CREATE TABLE pay_periods (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  pay_date DATE,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_pay_period_range CHECK (period_start <= period_end)
);

CREATE INDEX idx_pay_periods_tenant_dates
  ON pay_periods (tenant_id, period_start, period_end)
  WHERE deleted_at IS NULL;

CREATE TABLE pay_statements (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  pay_period_id UUID NOT NULL REFERENCES pay_periods (id) ON DELETE CASCADE,
  personnel_id UUID NOT NULL REFERENCES personnel (id) ON DELETE CASCADE,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  gross_amount NUMERIC(14, 2),
  net_amount NUMERIC(14, 2),
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  lines JSONB NOT NULL DEFAULT '[]',
  export_storage_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_pay_statements_period_personnel
  ON pay_statements (pay_period_id, personnel_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_pay_statements_tenant_personnel
  ON pay_statements (tenant_id, personnel_id)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- RBAC: demo tenant roles (IDs from 005_auth_module.sql)
-- Admin has '*'; others get least-privilege sets.
-- ---------------------------------------------------------------------------
INSERT INTO role_permissions (id, role_id, permission)
SELECT gen_random_uuid(), p.role_id, p.perm
FROM (VALUES
  ('10000000-0000-0000-0000-000000000002'::uuid, 'clients:read'),
  ('10000000-0000-0000-0000-000000000002', 'clients:create'),
  ('10000000-0000-0000-0000-000000000002', 'clients:update'),
  ('10000000-0000-0000-0000-000000000002', 'clients:delete'),
  ('10000000-0000-0000-0000-000000000002', 'events:read'),
  ('10000000-0000-0000-0000-000000000002', 'events:create'),
  ('10000000-0000-0000-0000-000000000002', 'events:update'),
  ('10000000-0000-0000-0000-000000000002', 'events:delete'),
  ('10000000-0000-0000-0000-000000000002', 'venues:read'),
  ('10000000-0000-0000-0000-000000000002', 'venues:create'),
  ('10000000-0000-0000-0000-000000000002', 'venues:update'),
  ('10000000-0000-0000-0000-000000000002', 'venues:delete'),
  ('10000000-0000-0000-0000-000000000002', 'vendors:read'),
  ('10000000-0000-0000-0000-000000000002', 'vendors:update'),
  ('10000000-0000-0000-0000-000000000002', 'scheduling:read:self'),
  ('10000000-0000-0000-0000-000000000002', 'time:clock:self'),
  ('10000000-0000-0000-0000-000000000002', 'time:read'),
  ('10000000-0000-0000-0000-000000000002', 'time:approve'),
  ('10000000-0000-0000-0000-000000000002', 'payroll:view_own'),
  ('10000000-0000-0000-0000-000000000002', 'payroll:view_all'),
  ('10000000-0000-0000-0000-000000000002', 'payroll:run'),
  ('10000000-0000-0000-0000-000000000002', 'payroll:export')
) AS p(role_id, perm)
JOIN roles role_row ON role_row.id = p.role_id AND role_row.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  WHERE rp.role_id = p.role_id AND rp.permission = p.perm
);

INSERT INTO role_permissions (id, role_id, permission)
SELECT gen_random_uuid(), p.role_id, p.perm
FROM (VALUES
  ('10000000-0000-0000-0000-000000000003'::uuid, 'clients:read'),
  ('10000000-0000-0000-0000-000000000003', 'events:read'),
  ('10000000-0000-0000-0000-000000000003', 'events:create'),
  ('10000000-0000-0000-0000-000000000003', 'events:update'),
  ('10000000-0000-0000-0000-000000000003', 'venues:read'),
  ('10000000-0000-0000-0000-000000000003', 'vendors:read'),
  ('10000000-0000-0000-0000-000000000003', 'scheduling:read:self'),
  ('10000000-0000-0000-0000-000000000003', 'time:clock:self'),
  ('10000000-0000-0000-0000-000000000003', 'time:read'),
  ('10000000-0000-0000-0000-000000000003', 'payroll:view_own')
) AS p(role_id, perm)
JOIN roles role_row ON role_row.id = p.role_id AND role_row.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  WHERE rp.role_id = p.role_id AND rp.permission = p.perm
);

INSERT INTO role_permissions (id, role_id, permission)
SELECT gen_random_uuid(), p.role_id, p.perm
FROM (VALUES
  ('10000000-0000-0000-0000-000000000004'::uuid, 'clients:read'),
  ('10000000-0000-0000-0000-000000000004', 'events:read'),
  ('10000000-0000-0000-0000-000000000004', 'venues:read'),
  ('10000000-0000-0000-0000-000000000004', 'vendors:read'),
  ('10000000-0000-0000-0000-000000000004', 'scheduling:read:self'),
  ('10000000-0000-0000-0000-000000000004', 'payroll:view_own')
) AS p(role_id, perm)
JOIN roles role_row ON role_row.id = p.role_id AND role_row.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  WHERE rp.role_id = p.role_id AND rp.permission = p.perm
);
