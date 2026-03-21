-- Wave 2: travel records (tenant-scoped, soft delete)
-- Validates event_id / personnel_id at application layer via events + personnel modules.

CREATE TABLE travel_records (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL,
  personnel_id UUID NOT NULL,
  travel_type VARCHAR(32) NOT NULL,
  direction VARCHAR(32) NOT NULL,
  departure_location TEXT NOT NULL,
  arrival_location TEXT NOT NULL,
  departure_datetime TIMESTAMPTZ NOT NULL,
  arrival_datetime TIMESTAMPTZ NOT NULL,
  carrier TEXT,
  booking_reference TEXT,
  seat_preference TEXT,
  cost NUMERIC(14, 4),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(32) NOT NULL DEFAULT 'planned',
  notes TEXT,
  accommodation JSONB,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_travel_type CHECK (
    travel_type IN (
      'flight',
      'train',
      'bus',
      'car_rental',
      'rideshare',
      'personal_vehicle',
      'other'
    )
  ),
  CONSTRAINT chk_travel_direction CHECK (direction IN ('outbound', 'return', 'inter_venue')),
  CONSTRAINT chk_travel_status CHECK (status IN ('planned', 'booked', 'confirmed', 'cancelled')),
  CONSTRAINT chk_travel_datetimes CHECK (departure_datetime <= arrival_datetime)
);

CREATE INDEX idx_travel_tenant_event ON travel_records (tenant_id, event_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_travel_tenant_personnel ON travel_records (tenant_id, personnel_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_travel_tenant_departure ON travel_records (tenant_id, departure_datetime) WHERE deleted_at IS NULL;
CREATE INDEX idx_travel_metadata ON travel_records USING GIN (metadata);

ALTER TABLE travel_records
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_travel_records_custom_fields
  ON travel_records USING GIN (custom_fields);
