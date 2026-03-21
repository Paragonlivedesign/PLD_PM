-- Trucks fleet, truck routes, and scheduling-owned truck assignments (tenant-scoped)

CREATE TABLE trucks (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(32) NOT NULL,
  license_plate VARCHAR(32),
  vin VARCHAR(64),
  capacity_cubic_ft NUMERIC(12, 2),
  capacity_lbs NUMERIC(12, 2),
  home_base VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'available',
  daily_rate NUMERIC(14, 4),
  mileage_rate NUMERIC(14, 4),
  current_mileage INTEGER,
  insurance_expiry DATE,
  inspection_expiry DATE,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_trucks_status CHECK (status IN ('available', 'in_use', 'maintenance', 'retired')),
  CONSTRAINT chk_trucks_type CHECK (type IN ('box_truck', 'semi_trailer', 'sprinter_van', 'flatbed', 'refrigerated', 'other'))
);

CREATE UNIQUE INDEX uq_trucks_tenant_name ON trucks (tenant_id, lower(name)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_trucks_tenant_plate ON trucks (tenant_id, lower(license_plate)) WHERE deleted_at IS NULL AND license_plate IS NOT NULL AND license_plate <> '';

CREATE INDEX idx_trucks_tenant ON trucks (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_trucks_tenant_status ON trucks (tenant_id, status) WHERE deleted_at IS NULL;

-- Scheduling module: truck assignments (no cross-module FK to events)
CREATE TABLE truck_assignments (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL,
  truck_id UUID NOT NULL REFERENCES trucks (id),
  purpose TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  driver_id UUID,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'tentative',
  has_conflicts BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_ta_dates CHECK (start_date <= end_date),
  CONSTRAINT chk_ta_status CHECK (status IN ('tentative', 'confirmed', 'cancelled'))
);

CREATE INDEX idx_ta_tenant ON truck_assignments (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ta_truck_dates ON truck_assignments (tenant_id, truck_id, start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_ta_event ON truck_assignments (tenant_id, event_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ta_driver ON truck_assignments (tenant_id, driver_id, start_date, end_date) WHERE deleted_at IS NULL AND driver_id IS NOT NULL;

CREATE TABLE truck_routes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL,
  truck_id UUID NOT NULL REFERENCES trucks (id),
  assignment_id UUID REFERENCES truck_assignments (id),
  driver_id UUID,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  waypoints JSONB NOT NULL DEFAULT '[]',
  departure_datetime TIMESTAMPTZ NOT NULL,
  estimated_arrival TIMESTAMPTZ NOT NULL,
  actual_arrival TIMESTAMPTZ,
  distance_miles NUMERIC(12, 2),
  actual_distance_miles NUMERIC(12, 2),
  estimated_fuel_cost NUMERIC(14, 4),
  actual_fuel_cost NUMERIC(14, 4),
  cargo_description TEXT,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_tr_status CHECK (status IN ('planned', 'in_transit', 'completed', 'cancelled'))
);

CREATE INDEX idx_tr_routes_tenant_event ON truck_routes (tenant_id, event_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tr_routes_truck ON truck_routes (tenant_id, truck_id) WHERE deleted_at IS NULL;
