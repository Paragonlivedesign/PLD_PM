/**
 * Restores migration-aligned HTML document templates for a tenant (after reset-data
 * wipes `document_templates`). Same IDs as `010_seed_document_template.sql` and
 * `011_seed_scheduling_show_templates.sql`.
 *
 * @param {import("pg").Pool | import("pg").PoolClient} db
 * @param {string} tenantId
 */
export async function seedDocumentTemplates(db, tenantId) {
  const rows = [
    {
      id: "f0000001-0000-4000-8000-000000000001",
      name: "Crew pack (seed)",
      description: "Seeded for local dev — use Documents → Generate with any event in this tenant.",
      category: "crew_pack",
      content: `<!DOCTYPE html>
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
</body></html>`,
    },
    {
      id: "f0000002-0000-4000-8000-000000000002",
      name: "Production schedule overview",
      description:
        "High-level production calendar framing — uses system schedule block when available.",
      category: "production_schedule",
      content: `<!DOCTYPE html>
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
</body></html>`,
    },
    {
      id: "f0000003-0000-4000-8000-000000000003",
      name: "Run of show",
      description: "Show-day rundown: system schedule plus crew reference for calls and departments.",
      category: "production_schedule",
      content: `<!DOCTYPE html>
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
</body></html>`,
    },
    {
      id: "f0000004-0000-4000-8000-000000000004",
      name: "Day sheet (calls & schedule)",
      description: "Single-day orientation: calls, schedule block, and crew table.",
      category: "day_sheet",
      content: `<!DOCTYPE html>
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
</body></html>`,
    },
    {
      id: "f0000005-0000-4000-8000-000000000005",
      name: "Stage plot & tech timeline",
      description: "Stage/audio/video block — schedule stub plus crew for tech positions.",
      category: "stage_plot",
      content: `<!DOCTYPE html>
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
</body></html>`,
    },
    {
      id: "f0000006-0000-4000-8000-000000000006",
      name: "Show rundown (summary)",
      description: "One-page rundown: event summary, schedule excerpt, crew, travel, finance stubs.",
      category: "report",
      content: `<!DOCTYPE html>
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
</body></html>`,
    },
    {
      id: "f0000007-0000-4000-8000-000000000007",
      name: "Tech specification sheet",
      description:
        "Technical overview for {{ event_name }} — pair with custom fields for power, network, and broadcast notes.",
      category: "tech_spec",
      content: `<!DOCTYPE html>
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
</body></html>`,
    },
  ];

  for (const r of rows) {
    await db.query(
      `INSERT INTO document_templates (
         id, tenant_id, name, description, category, content, format, variables, default_output_format, is_active
       ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, 'html', '[]'::jsonb, 'pdf', TRUE)
       ON CONFLICT (id) DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         content = EXCLUDED.content,
         format = EXCLUDED.format,
         variables = EXCLUDED.variables,
         default_output_format = EXCLUDED.default_output_format,
         is_active = EXCLUDED.is_active,
         updated_at = NOW()`,
      [r.id, tenantId, r.name, r.description, r.category, r.content],
    );
  }
}
