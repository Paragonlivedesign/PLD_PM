-- CP2: distinguish overlap vs drive-time conflicts for API/tests (integration-checkpoints 2.E.*).
ALTER TABLE scheduling_conflicts
  ADD COLUMN IF NOT EXISTS conflict_kind VARCHAR(40) NOT NULL DEFAULT 'double_booking';
