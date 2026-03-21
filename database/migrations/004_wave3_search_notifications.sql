-- Wave 3: unified search index + collaboration notifications (tenant-scoped)

CREATE TABLE search_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT,
  body_text TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}',
  search_vector tsvector,
  entity_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, entity_type, entity_id)
);

CREATE INDEX idx_search_index_tenant_live ON search_index (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_search_index_tenant_type ON search_index (tenant_id, entity_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_search_index_vector ON search_index USING GIN (search_vector);

CREATE OR REPLACE FUNCTION search_index_set_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.subtitle, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.body_text, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_search_index_vector
  BEFORE INSERT OR UPDATE OF title, subtitle, body_text ON search_index
  FOR EACH ROW
  EXECUTE PROCEDURE search_index_set_vector();

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_tenant_user_created ON notifications (tenant_id, user_id, created_at DESC);

CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (tenant_id, user_id, notification_type, channel)
);

CREATE INDEX idx_notification_prefs_user ON notification_preferences (tenant_id, user_id);
