-- Additional seeded document templates: scheduling, run of show, day-of, stage, rundown.
-- Tenant: default dev (matches pld-api.js PLD_TENANT_ID).
-- Placeholders: see buildGenerationContext in backend/src/modules/documents/generate-html.ts

-- Production week / master schedule framing (schedule_section fills in when wired)
INSERT INTO document_templates (
  id, tenant_id, name, description, category, content, format, variables, default_output_format, is_active
)
VALUES (
  'f0000002-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Production schedule overview',
  'High-level production calendar framing — uses system schedule block when available.',
  'production_schedule',
  $t2$<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Production schedule</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;max-width:800px;">
  <h1 style="margin-top:0;">Production schedule — {{ event_name }}</h1>
  <p><strong>Run:</strong> {{ event_start_date }} → {{ event_end_date }} · <strong>Phase:</strong> {{ event_phase }} · <strong>Status:</strong> {{ event_status }}</p>
  <p>{{ event_description }}</p>
  <h2>Master timeline</h2>
  <p style="color:#555;font-size:14px;">Below is the live scheduling slice from the system (load-in, rehearsals, show days, strike). Edit the HTML template to add static milestones if needed.</p>
  {{ schedule_section }}
  <h2>Key contacts &amp; crew</h2>
  {{ personnel_table }}
  <h2>Notes &amp; custom fields</h2>
  {{ custom_fields_list }}
  <h2>Travel window</h2>
  {{ travel_section }}
</body></html>
$t2$,
  'html', '[]'::jsonb, 'pdf', TRUE
)
ON CONFLICT (id) DO NOTHING;

-- Run of show — day-of timing grid
INSERT INTO document_templates (
  id, tenant_id, name, description, category, content, format, variables, default_output_format, is_active
)
VALUES (
  'f0000003-0000-4000-8000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'Run of show',
  'Show-day rundown: system schedule plus crew reference for calls and departments.',
  'production_schedule',
  $t3$<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Run of show</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;max-width:820px;">
  <h1 style="margin-top:0;letter-spacing:0.02em;">RUN OF SHOW</h1>
  <h2 style="margin-top:0;font-size:20px;">{{ event_name }}</h2>
  <p style="font-size:15px;"><strong>Show date focus:</strong> {{ event_start_date }} <span style="color:#666;">(multi-day: through {{ event_end_date }})</span></p>
  <p><strong>Phase / status:</strong> {{ event_phase }} · {{ event_status }}</p>
  <hr style="border:none;border-top:1px solid #ccc;margin:20px 0;"/>
  <h3>Timing &amp; sequence</h3>
  <p style="color:#555;">Populated from scheduling when integrated. Use this block for official times, holds, and broadcast offsets.</p>
  {{ schedule_section }}
  <h3>Department snapshot</h3>
  <p style="color:#555;">Crew directory for quick lookups during show.</p>
  {{ personnel_table }}
  <h3>Travel &amp; logistics</h3>
  {{ travel_section }}
  <h3>Financial / buyouts (reference)</h3>
  {{ financial_section }}
  <h3>Event custom fields</h3>
  {{ custom_fields_list }}
</body></html>
$t3$,
  'html', '[]'::jsonb, 'pdf', TRUE
)
ON CONFLICT (id) DO NOTHING;

-- Day sheet — calls and day-of focus
INSERT INTO document_templates (
  id, tenant_id, name, description, category, content, format, variables, default_output_format, is_active
)
VALUES (
  'f0000004-0000-4000-8000-000000000004',
  '00000000-0000-0000-0000-000000000001',
  'Day sheet (calls & schedule)',
  'Single-day orientation: calls, schedule block, and crew table.',
  'day_sheet',
  $t4$<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Day sheet</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;max-width:720px;">
  <h1 style="margin-top:0;">Day sheet</h1>
  <p style="font-size:18px;font-weight:600;">{{ event_name }}</p>
  <p><strong>Date span:</strong> {{ event_start_date }} → {{ event_end_date }}</p>
  <p><strong>Phase:</strong> {{ event_phase }}</p>
  <h2>Today&apos;s schedule</h2>
  {{ schedule_section }}
  <h2>Call &amp; crew</h2>
  {{ personnel_table }}
  <h2>Briefing notes</h2>
  <p>{{ event_description }}</p>
  {{ custom_fields_list }}
</body></html>
$t4$,
  'html', '[]'::jsonb, 'pdf', TRUE
)
ON CONFLICT (id) DO NOTHING;

-- Stage / tech run-of-show framing
INSERT INTO document_templates (
  id, tenant_id, name, description, category, content, format, variables, default_output_format, is_active
)
VALUES (
  'f0000005-0000-4000-8000-000000000005',
  '00000000-0000-0000-0000-000000000001',
  'Stage plot & tech timeline',
  'Stage/audio/video block — schedule stub plus crew for tech positions.',
  'stage_plot',
  $t5$<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Stage &amp; tech</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;max-width:800px;">
  <h1 style="margin-top:0;">Stage / tech — {{ event_name }}</h1>
  <p>{{ event_start_date }} → {{ event_end_date }} · {{ event_phase }}</p>
  <h2>Tech timing &amp; cues</h2>
  <p style="color:#555;">Line check, walk-in, artist changeovers — ties to master schedule when data is available.</p>
  {{ schedule_section }}
  <h2>Tech &amp; stage crew</h2>
  {{ personnel_table }}
  <h2>Specifications &amp; notes</h2>
  {{ custom_fields_list }}
  <h2>Travel / freight</h2>
  {{ travel_section }}
</body></html>
$t5$,
  'html', '[]'::jsonb, 'pdf', TRUE
)
ON CONFLICT (id) DO NOTHING;

-- Show rundown / executive one-pager
INSERT INTO document_templates (
  id, tenant_id, name, description, category, content, format, variables, default_output_format, is_active
)
VALUES (
  'f0000006-0000-4000-8000-000000000006',
  '00000000-0000-0000-0000-000000000001',
  'Show rundown (summary)',
  'One-page rundown: event summary, schedule excerpt, crew, travel, finance stubs.',
  'report',
  $t6$<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Show rundown</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;max-width:780px;">
  <h1 style="margin-top:0;">Show rundown</h1>
  <h2 style="font-size:22px;margin:0 0 8px 0;">{{ event_name }}</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
    <tr><td style="padding:6px 0;border-bottom:1px solid #eee;width:160px;"><strong>Dates</strong></td><td style="padding:6px 0;border-bottom:1px solid #eee;">{{ event_start_date }} → {{ event_end_date }}</td></tr>
    <tr><td style="padding:6px 0;border-bottom:1px solid #eee;"><strong>Phase</strong></td><td style="padding:6px 0;border-bottom:1px solid #eee;">{{ event_phase }}</td></tr>
    <tr><td style="padding:6px 0;border-bottom:1px solid #eee;"><strong>Status</strong></td><td style="padding:6px 0;border-bottom:1px solid #eee;">{{ event_status }}</td></tr>
  </table>
  <p style="line-height:1.5;">{{ event_description }}</p>
  <h3>Schedule excerpt</h3>
  {{ schedule_section }}
  <h3>Core team</h3>
  {{ personnel_table }}
  <h3>Travel</h3>
  {{ travel_section }}
  <h3>Budget snapshot</h3>
  {{ financial_section }}
  <h3>Custom data</h3>
  {{ custom_fields_list }}
</body></html>
$t6$,
  'html', '[]'::jsonb, 'pdf', TRUE
)
ON CONFLICT (id) DO NOTHING;

-- Tech spec one-pager (input lists, power, comms — narrative + placeholders)
INSERT INTO document_templates (
  id, tenant_id, name, description, category, content, format, variables, default_output_format, is_active
)
VALUES (
  'f0000007-0000-4000-8000-000000000007',
  '00000000-0000-0000-0000-000000000001',
  'Tech specification sheet',
  'Technical overview for {{ event_name }} — pair with custom fields for power, network, and broadcast notes.',
  'tech_spec',
  $t7$<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Tech spec</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;max-width:800px;">
  <h1 style="margin-top:0;">Technical specification</h1>
  <p style="font-size:17px;font-weight:600;">{{ event_name }}</p>
  <p>{{ event_start_date }} → {{ event_end_date }} · {{ event_phase }}</p>
  <h2>Overview</h2>
  <p>{{ event_description }}</p>
  <h2>Structured notes (custom fields)</h2>
  <p style="color:#555;">Use tenant event custom fields for amperage, fiber paths, comms matrix, etc.</p>
  {{ custom_fields_list }}
  <h2>Load / rehearsal / show timing</h2>
  {{ schedule_section }}
  <h2>Technical leadership &amp; crew</h2>
  {{ personnel_table }}
</body></html>
$t7$,
  'html', '[]'::jsonb, 'pdf', TRUE
)
ON CONFLICT (id) DO NOTHING;
