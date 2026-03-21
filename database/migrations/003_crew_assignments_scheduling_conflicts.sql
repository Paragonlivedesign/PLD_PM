-- Wave 2: crew assignments + persisted scheduling conflicts (tenant-scoped)

CREATE TABLE crew_assignments (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL,
  event_name VARCHAR(255) NOT NULL DEFAULT '',
  personnel_id UUID NOT NULL,
  personnel_name VARCHAR(255) NOT NULL DEFAULT '',
  role VARCHAR(100) NOT NULL,
  department_id UUID,
  department_name VARCHAR(255),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time VARCHAR(5),
  end_time VARCHAR(5),
  day_rate_override NUMERIC(14, 4),
  per_diem_override NUMERIC(14, 4),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'tentative',
  has_conflicts BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_ca_dates CHECK (start_date <= end_date),
  CONSTRAINT chk_ca_status CHECK (status IN ('tentative', 'confirmed', 'cancelled'))
);

CREATE INDEX idx_ca_tenant ON crew_assignments (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ca_personnel_dates ON crew_assignments (tenant_id, personnel_id, start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_ca_event ON crew_assignments (tenant_id, event_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ca_dept ON crew_assignments (tenant_id, department_id) WHERE deleted_at IS NULL AND department_id IS NOT NULL;

CREATE TABLE scheduling_conflicts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  resource_type VARCHAR(20) NOT NULL,
  resource_id UUID NOT NULL,
  resource_name TEXT NOT NULL DEFAULT '',
  severity VARCHAR(10) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  overlap_start DATE NOT NULL,
  overlap_end DATE NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  assignments JSONB NOT NULL DEFAULT '[]',
  event_id_1 UUID,
  event_id_2 UUID,
  CONSTRAINT chk_sc_resource CHECK (resource_type IN ('personnel', 'truck')),
  CONSTRAINT chk_sc_severity CHECK (severity IN ('hard', 'soft')),
  CONSTRAINT chk_sc_status CHECK (status IN ('active', 'resolved', 'dismissed')),
  CONSTRAINT chk_sc_overlap CHECK (overlap_start <= overlap_end)
);

CREATE INDEX idx_sc_tenant_status ON scheduling_conflicts (tenant_id, status) WHERE status = 'active';
CREATE INDEX idx_sc_tenant_resource ON scheduling_conflicts (tenant_id, resource_type, resource_id);
CREATE INDEX idx_sc_event1 ON scheduling_conflicts (tenant_id, event_id_1) WHERE status = 'active';
CREATE INDEX idx_sc_event2 ON scheduling_conflicts (tenant_id, event_id_2) WHERE status = 'active';

CREATE TABLE scheduling_conflict_participants (
  conflict_id UUID NOT NULL REFERENCES scheduling_conflicts (id) ON DELETE CASCADE,
  assignment_type VARCHAR(10) NOT NULL,
  assignment_id UUID NOT NULL,
  PRIMARY KEY (conflict_id, assignment_type, assignment_id),
  CONSTRAINT chk_scp_type CHECK (assignment_type IN ('crew', 'truck'))
);

CREATE INDEX idx_scp_assignment ON scheduling_conflict_participants (assignment_id, assignment_type);
CREATE INDEX idx_scp_conflict ON scheduling_conflict_participants (conflict_id);
