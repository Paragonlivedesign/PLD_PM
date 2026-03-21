-- Truck custom field definitions + JSONB on trucks

ALTER TABLE custom_field_definitions DROP CONSTRAINT IF EXISTS custom_field_definitions_entity_type_check;
ALTER TABLE custom_field_definitions ADD CONSTRAINT custom_field_definitions_entity_type_check
  CHECK (entity_type IN (
    'event', 'personnel', 'travel_record', 'financial_line_item', 'department', 'truck'
  ));

ALTER TABLE trucks ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_trucks_custom_fields ON trucks USING GIN (custom_fields);
