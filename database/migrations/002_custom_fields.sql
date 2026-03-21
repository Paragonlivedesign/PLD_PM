-- Custom field definitions (Wave 1) + index + entity JSONB columns
-- Contract: contracts/custom-fields.contract.md

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- custom_field_definitions
-- ---------------------------------------------------------------------------
CREATE TABLE custom_field_definitions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  entity_type VARCHAR(32) NOT NULL
    CHECK (entity_type IN ('event', 'personnel', 'travel_record', 'financial_line_item', 'department')),
  field_key VARCHAR(50) NOT NULL,
  label VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  field_type VARCHAR(32) NOT NULL
    CHECK (field_type IN (
      'text', 'number', 'boolean', 'date', 'datetime', 'select', 'multi_select', 'url', 'email', 'phone'
    )),
  validation_rules JSONB,
  default_value JSONB,
  options JSONB,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_searchable BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  visibility VARCHAR(16) NOT NULL DEFAULT 'all'
    CHECK (visibility IN ('all', 'admin_only')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_custom_field_definitions_active_key
  ON custom_field_definitions (tenant_id, entity_type, field_key)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_cfd_tenant_entity_active
  ON custom_field_definitions (tenant_id, entity_type)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_cfd_tenant_entity_order
  ON custom_field_definitions (tenant_id, entity_type, display_order)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- custom_field_definition_history (append-only snapshots)
-- ---------------------------------------------------------------------------
CREATE TABLE custom_field_definition_history (
  id UUID PRIMARY KEY,
  definition_id UUID NOT NULL REFERENCES custom_field_definitions (id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  snapshot JSONB NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cfhist_definition ON custom_field_definition_history (definition_id);

-- ---------------------------------------------------------------------------
-- custom_field_index (searchable / filterable denormalized values)
-- ---------------------------------------------------------------------------
CREATE TABLE custom_field_index (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id UUID NOT NULL,
  field_key VARCHAR(50) NOT NULL,
  value_text TEXT,
  value_numeric DOUBLE PRECISION,
  value_date TIMESTAMPTZ,
  value_boolean BOOLEAN,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, entity_type, entity_id, field_key)
);

CREATE INDEX idx_cfi_tenant_entity_field
  ON custom_field_index (tenant_id, entity_type, field_key);

CREATE INDEX idx_cfi_value_numeric ON custom_field_index (tenant_id, entity_type, field_key, value_numeric);
CREATE INDEX idx_cfi_value_date ON custom_field_index (tenant_id, entity_type, field_key, value_date);
CREATE INDEX idx_cfi_value_boolean ON custom_field_index (tenant_id, entity_type, field_key, value_boolean);
CREATE INDEX idx_cfi_value_text_trgm ON custom_field_index USING GIN (value_text gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Entity tables: custom_fields JSONB (owning modules write; CF module validates)
-- ---------------------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_events_custom_fields ON events USING GIN (custom_fields);

-- personnel, departments, travel_records: columns added in their owning migrations
-- (avoid stub tables here — alphabetical order runs this file before 002_personnel / 003_travel)

CREATE TABLE IF NOT EXISTS financial_line_items (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_financial_line_items_tenant ON financial_line_items (tenant_id);
CREATE INDEX idx_financial_line_items_custom_fields ON financial_line_items USING GIN (custom_fields);
