-- One seeded HTML template for the default dev tenant (matches X-Tenant-Id in pld-api.js).
-- Placeholders: {{ event_name }}, {{ event_start_date }}, {{ event_end_date }}, {{ event_phase }},
-- {{ event_status }}, {{ personnel_table }}, {{ custom_fields_list }}, {{ schedule_section }}, etc.
-- See backend/src/modules/documents/generate-html.ts (buildGenerationContext).

INSERT INTO document_templates (
  id,
  tenant_id,
  name,
  description,
  category,
  content,
  format,
  variables,
  default_output_format,
  is_active
)
VALUES (
  'f0000001-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Crew pack (seed)',
  'Seeded for local dev — use Documents → Generate with any event in this tenant.',
  'crew_pack',
  $pldseed$<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Crew pack</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;max-width:720px;">
  <h1 style="margin-top:0;">Crew pack — {{ event_name }}</h1>
  <p><strong>Dates:</strong> {{ event_start_date }} → {{ event_end_date }}</p>
  <p><strong>Phase:</strong> {{ event_phase }} · <strong>Status:</strong> {{ event_status }}</p>
  <p>{{ event_description }}</p>
  <h2>Personnel</h2>
  {{ personnel_table }}
  <h2>Custom fields</h2>
  {{ custom_fields_list }}
  <h2>Schedule</h2>
  {{ schedule_section }}
  <h2>Travel</h2>
  {{ travel_section }}
  <h2>Financial</h2>
  {{ financial_section }}
</body></html>
$pldseed$,
  'html',
  '[]'::jsonb,
  'pdf',
  TRUE
)
ON CONFLICT (id) DO NOTHING;
