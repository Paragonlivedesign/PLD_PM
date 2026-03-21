-- Truck routes: structured location refs, geometry, share tokens, metadata

ALTER TABLE truck_routes
  ADD COLUMN IF NOT EXISTS origin_ref JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS destination_ref JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS route_geometry JSONB,
  ADD COLUMN IF NOT EXISTS traffic_aware BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS provider_computed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS driver_share_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS driver_share_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_truck_routes_share_token
  ON truck_routes (driver_share_token)
  WHERE driver_share_token IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_truck_routes_tenant_departure
  ON truck_routes (tenant_id, departure_datetime)
  WHERE deleted_at IS NULL;
