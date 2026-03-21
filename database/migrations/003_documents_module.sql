-- Documents module (Wave 2): templates, documents, rider items, email drafts

CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'html',
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_output_format TEXT NOT NULL DEFAULT 'pdf',
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_templates_tenant ON document_templates (tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_tenant_active ON document_templates (tenant_id, is_active);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  event_id UUID,
  entity_type TEXT,
  entity_id UUID,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'internal',
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_key TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_from_template_id UUID REFERENCES document_templates (id) ON DELETE SET NULL,
  doc_version INTEGER NOT NULL DEFAULT 1,
  uploaded_by UUID NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'complete',
  stale BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_tenant_event ON documents (tenant_id, event_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_tenant_stale ON documents (tenant_id, stale) WHERE deleted_at IS NULL AND source = 'generated';

CREATE TABLE IF NOT EXISTS rider_items (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  event_id UUID NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  assigned_to UUID,
  estimated_cost NUMERIC(14, 2),
  source_line TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rider_items_tenant ON rider_items (tenant_id);
CREATE INDEX IF NOT EXISTS idx_rider_items_event ON rider_items (tenant_id, event_id);
CREATE INDEX IF NOT EXISTS idx_rider_items_document ON rider_items (tenant_id, document_id);

CREATE TABLE IF NOT EXISTS email_drafts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL,
  template_id UUID REFERENCES document_templates (id) ON DELETE SET NULL,
  to_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
  cc_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_drafts_tenant ON email_drafts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_event ON email_drafts (tenant_id, event_id);
