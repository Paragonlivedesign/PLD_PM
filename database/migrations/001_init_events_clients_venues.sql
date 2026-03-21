-- PLD_PM Wave 1: clients, venues, events (tenant-scoped, soft delete)
-- UUIDs generated in application layer (UUID v4/v7) or use gen_random_uuid()

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE clients (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  phone VARCHAR(64),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_clients_tenant ON clients (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_tenant_name ON clients (tenant_id, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_clients_metadata ON clients USING GIN (metadata);

CREATE TABLE venues (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  city VARCHAR(100),
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  timezone VARCHAR(64),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_venues_tenant ON venues (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_tenant_name ON venues (tenant_id, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_metadata ON venues USING GIN (metadata);

CREATE TABLE events (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  client_id UUID NOT NULL REFERENCES clients (id),
  venue_id UUID REFERENCES venues (id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  load_in_date DATE,
  load_out_date DATE,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  phase VARCHAR(32) NOT NULL DEFAULT 'planning',
  description TEXT,
  tags JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_events_dates CHECK (start_date <= end_date),
  CONSTRAINT chk_events_load_in CHECK (load_in_date IS NULL OR load_in_date <= start_date),
  CONSTRAINT chk_events_load_out CHECK (load_out_date IS NULL OR load_out_date >= end_date)
);

CREATE INDEX idx_events_tenant_phase ON events (tenant_id, phase) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_tenant_dates ON events (tenant_id, start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_deleted ON events (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_client ON events (tenant_id, client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_venue ON events (tenant_id, venue_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_metadata ON events USING GIN (metadata);
CREATE INDEX idx_events_tags ON events USING GIN (tags);
