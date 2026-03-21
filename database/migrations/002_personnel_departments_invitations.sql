-- Wave 1: personnel, departments, blocked dates, invitations (tenant-scoped)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE departments (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  head_id UUID,
  color VARCHAR(16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_departments_tenant_name
  ON departments (tenant_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX idx_departments_tenant ON departments (tenant_id) WHERE deleted_at IS NULL;

CREATE TABLE personnel (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  department_id UUID REFERENCES departments (id) ON DELETE SET NULL,
  role VARCHAR(255) NOT NULL,
  employment_type VARCHAR(32) NOT NULL,
  skills TEXT[] NOT NULL DEFAULT '{}',
  day_rate_amount NUMERIC(12, 2),
  day_rate_currency CHAR(3) NOT NULL DEFAULT 'USD',
  per_diem_amount NUMERIC(12, 2),
  per_diem_currency CHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  emergency_contact JSONB,
  metadata JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_personnel_tenant_email
  ON personnel (tenant_id, lower(email))
  WHERE deleted_at IS NULL;

CREATE INDEX idx_personnel_tenant_dept
  ON personnel (tenant_id, department_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_personnel_tenant_status
  ON personnel (tenant_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_personnel_skills ON personnel USING GIN (skills);
CREATE INDEX idx_personnel_metadata ON personnel USING GIN (metadata);

CREATE INDEX idx_personnel_name_trgm
  ON personnel USING GIN ((first_name || ' ' || last_name) gin_trgm_ops);

CREATE INDEX idx_personnel_email_trgm ON personnel USING GIN (email gin_trgm_ops);

ALTER TABLE departments
  ADD CONSTRAINT fk_departments_head
  FOREIGN KEY (head_id) REFERENCES personnel (id) ON DELETE SET NULL;

CREATE TABLE personnel_blocked_dates (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  personnel_id UUID NOT NULL REFERENCES personnel (id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_personnel_blocked_dates CHECK (start_date <= end_date)
);

CREATE INDEX idx_blocked_dates_personnel
  ON personnel_blocked_dates (tenant_id, personnel_id, start_date, end_date);

CREATE TABLE personnel_invitations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(255) NOT NULL,
  department_id UUID REFERENCES departments (id) ON DELETE SET NULL,
  employment_type VARCHAR(32),
  message TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  invited_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT uq_personnel_invitations_token UNIQUE (token_hash)
);

CREATE INDEX idx_invitations_tenant_status
  ON personnel_invitations (tenant_id, status);

CREATE INDEX idx_invitations_tenant_email
  ON personnel_invitations (tenant_id, lower(email));

ALTER TABLE personnel
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_personnel_custom_fields
  ON personnel USING GIN (custom_fields);

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_departments_custom_fields
  ON departments USING GIN (custom_fields);
