/**
 * Idempotent demo catalog for a tenant — comprehensive operational sample data.
 * Used by `npm run db:seed` and POST /api/v1/tenant/seed-demo.
 *
 * Keep behavior aligned with `contracts/tenancy.contract.md` (seed-demo).
 *
 * @param {import("pg").Pool | import("pg").PoolClient} db
 * @param {string} tenantId UUID
 */
import { seedDocumentTemplates } from "./seed-document-templates.mjs";

const P = "PLD Demo — ";

export async function seedDemoCatalog(db, tenantId) {
  await seedDocumentTemplates(db, tenantId);

  const clients = [
    ["Aurora Festival Co.", "National touring festivals.", "Jordan Blake", "jordan@aurora.example.com"],
    ["Metro Convention Group", "Corporate keynotes and trade floors.", "Sam Rivera", "sam@metroconv.example.com"],
    ["Gulf Coast Sports Network", "Broadcast and OB trucks.", "Chris Ng", "cng@gcsn.example.com"],
    ["Lone Star Corporate Events", "Internal meetings and galas.", "Taylor Kim", "tkim@lonestar.example.com"],
    ["Riverwalk Amphitheater Authority", "City-owned outdoor venue operator.", "Pat O’Neil", "poneil@riverwalk.example.com"],
    ["Highland University", "Commencement and donor weekends.", "Dr. Priya Shah", "pshah@highland.edu"],
    ["Summit Medical Congress", "Medical association annual meetings.", "Alex Moore", "amoore@summitmed.example.com"],
    ["Bluebonnet Fairgrounds", "County fair and rodeo infrastructure.", "Jamie Ford", "jford@bluebonnet.example.com"],
    ["Stellar Nonprofit Alliance", "Fundraising galas.", "Morgan Ellis", "mellis@stellar-np.example.com"],
    ["Capitol Media Partners", "Hybrid broadcast + live audience.", "Riley Chen", "rchen@capitolmedia.example.com"],
    ["Desert Ridge Casino Resort", "Entertainment and hospitality.", "Casey Lopez", "clopez@desertridge.example.com"],
    ["Harborfront Arts Collective", "Performing arts non-profit.", "Nina Park", "npark@harborfront.example.com"],
  ];

  for (const [name, notes, cn, ce] of clients) {
    const full = `${P}Client: ${name}`;
    await db.query(
      `INSERT INTO clients (id, tenant_id, name, contact_name, contact_email, notes, metadata)
       SELECT gen_random_uuid(), $1::uuid, $2::varchar, $3::varchar, $4::varchar, $5::varchar, '{}'::jsonb
       WHERE NOT EXISTS (
         SELECT 1 FROM clients c WHERE c.tenant_id = $1::uuid AND c.name = $2::varchar AND c.deleted_at IS NULL
       )`,
      [tenantId, full, cn, ce, notes],
    );
  }

  const venues = [
    ["Austin Convention Center", "Austin", "500 E Cesar Chavez St"],
    ["Dallas Fair Park", "Dallas", "3809 Grand Ave"],
    ["Houston NRG Arena", "Houston", "1 NRG Park"],
    ["San Antonio Riverwalk Plaza", "San Antonio", "200 S Alamo St"],
    ["Fort Worth Stockyards Hall", "Fort Worth", "131 E Exchange Ave"],
    ["El Paso County Coliseum", "El Paso", "4100 E Paisano Dr"],
    ["Corpus Christi Bayfront", "Corpus Christi", "900 N Shoreline Blvd"],
    ["Lubbock United Arena", "Lubbock", "1610 Mac Davis Lane"],
    ["McAllen Convention Center", "McAllen", "700 Convention Center Blvd"],
    ["Tyler Rose Complex", "Tyler", "105 E Line St"],
  ];

  for (const [name, city, addr] of venues) {
    const full = `${P}Venue: ${name}`;
    await db.query(
      `INSERT INTO venues (id, tenant_id, name, city, address, metadata)
       SELECT gen_random_uuid(), $1::uuid, $2::varchar, $3::varchar, $4::varchar, '{}'::jsonb
       WHERE NOT EXISTS (
         SELECT 1 FROM venues v WHERE v.tenant_id = $1::uuid AND v.name = $2::varchar AND v.deleted_at IS NULL
       )`,
      [tenantId, full, city, addr],
    );
  }

  await db.query(
    `INSERT INTO vendors (id, tenant_id, name, contact_name, contact_email, notes, metadata, linked_client_id)
     SELECT gen_random_uuid(), $1::uuid,
       $2::varchar, 'Vendor Contact', 'vendor@example.com', 'Linked to Aurora for consolidated billing.', '{}'::jsonb,
       (SELECT c.id FROM clients c WHERE c.tenant_id = $1::uuid AND c.name = $3::varchar AND c.deleted_at IS NULL LIMIT 1)
     WHERE NOT EXISTS (
       SELECT 1 FROM vendors v WHERE v.tenant_id = $1::uuid AND v.name = $2::varchar AND v.deleted_at IS NULL
     )`,
    [tenantId, `${P}Vendor: Aurora Staging LLC`, `${P}Client: Aurora Festival Co.`],
  );

  const vendorsFree = [
    "Gulf AV Wholesale",
    "Lone Star Trucking Co.",
    "Capitol Rigging & Steel",
    "Harborfront Catering Group",
    "Desert Power & Generator",
    "Summit Stagehands Union Referral",
    "Bluebonnet Tent & Floor",
    "Stellar Security Services",
    "Tyler Fiber Network Install",
    "Metro Scenic & Props",
  ];
  for (const vn of vendorsFree) {
    const full = `${P}Vendor: ${vn}`;
    await db.query(
      `INSERT INTO vendors (id, tenant_id, name, contact_name, metadata)
       SELECT gen_random_uuid(), $1::uuid, $2::varchar, 'Sales', '{}'::jsonb
       WHERE NOT EXISTS (
         SELECT 1 FROM vendors v WHERE v.tenant_id = $1::uuid AND v.name = $2::varchar AND v.deleted_at IS NULL
       )`,
      [tenantId, full],
    );
  }

  const deptRows = [
    ["Audio", "Demo department", "#3b82f6", 0],
    ["Video", "Demo department", "#8b5cf6", 1],
    ["Lighting", "Demo department", "#f59e0b", 2],
    ["Staging", "Demo department", "#22c55e", 3],
    ["Production", "Demo department", "#ef4444", 4],
  ];
  for (const [name, desc, color, sort] of deptRows) {
    await db.query(
      `INSERT INTO departments (id, tenant_id, name, description, head_id, color, sort_order, is_active)
       SELECT gen_random_uuid(), $1::uuid, $2::varchar, $3::varchar, NULL, $4::varchar, $5::int, TRUE
       WHERE NOT EXISTS (
         SELECT 1 FROM departments d
         WHERE d.tenant_id = $1::uuid AND lower(d.name) = lower($2::varchar) AND d.deleted_at IS NULL
       )`,
      [tenantId, name, desc, color, sort],
    );
  }

  const cfDefs = [
    ["event", "power_demand_kw", "Power demand (kW)", "number", 10, true],
    ["event", "broadcast_network", "Broadcast network", "text", 20, true],
    ["event", "rigging_points", "Rigging points", "number", 30, false],
    ["event", "load_in_notes", "Load-in notes", "text", 40, true],
  ];
  for (const [entityType, fieldKey, label, fieldType, displayOrder, searchable] of cfDefs) {
    await db.query(
      `INSERT INTO custom_field_definitions (
         id, tenant_id, entity_type, field_key, label, description, field_type,
         validation_rules, default_value, options, is_required, is_searchable, display_order, visibility, version
       )
       SELECT gen_random_uuid(), $1::uuid, $2::varchar, $3::varchar, $4::varchar, NULL, $5::varchar,
         NULL, NULL, NULL, FALSE, $6::boolean, $7::int, 'all', 1
       WHERE NOT EXISTS (
         SELECT 1 FROM custom_field_definitions d
         WHERE d.tenant_id = $1::uuid AND d.entity_type = $2::varchar AND d.field_key = $3::varchar AND d.deleted_at IS NULL
       )`,
      [tenantId, entityType, fieldKey, label, fieldType, searchable, displayOrder],
    );
  }

  const personnelSpec = [
    ["Morgan", "Reeves", "Audio", "FOH Engineer", "contractor", 650, 75, ["Midas", "RF", "Dante"], "pld.demo.morgan.reeves@example.com"],
    ["Casey", "Nguyen", "Audio", "Monitor Engineer", "contractor", 600, 75, ["Waves", "RF"], "pld.demo.casey.nguyen@example.com"],
    ["Jordan", "Ellis", "Video", "Director", "full_time", 720, 80, ["Switchers", "NDI"], "pld.demo.jordan.ellis@example.com"],
    ["Riley", "Patel", "Video", "Shader", "contractor", 580, 70, ["Resolume"], "pld.demo.riley.patel@example.com"],
    ["Sam", "Okonkwo", "Lighting", "LD", "contractor", 700, 85, ["MA3", "Art-Net"], "pld.demo.sam.okonkwo@example.com"],
    ["Alex", "Stone", "Lighting", "Electrician", "contractor", 450, 60, ["Lift", "Distro"], "pld.demo.alex.stone@example.com"],
    ["Taylor", "Brooks", "Staging", "Rigger", "contractor", 550, 70, ["ETCP", "Arena"], "pld.demo.taylor.brooks@example.com"],
    ["Jamie", "Fox", "Staging", "Carpenter", "full_time", 520, 65, ["CNC", "Scenic"], "pld.demo.jamie.fox@example.com"],
    ["Chris", "Vega", "Production", "PM", "full_time", 900, 100, ["Budget", "Schedules"], "pld.demo.chris.vega@example.com"],
    ["Rene", "Silva", "Production", "Stage Manager", "contractor", 680, 80, ["Showcaller"], "pld.demo.rene.silva@example.com"],
    ["Dana", "Cho", "Audio", "RF Tech", "contractor", 500, 70, ["RF", "Shure"], "pld.demo.dana.cho@example.com"],
    ["Quinn", "Harper", "Video", "Camera Lead", "contractor", 620, 75, ["Sony", "Canon"], "pld.demo.quinn.harper@example.com"],
    ["Skyler", "James", "Lighting", "Dimmer Tech", "contractor", 480, 60, ["Dimmer", "Power"], "pld.demo.skyler.james@example.com"],
    ["Parker", "Lee", "Staging", "Loader", "part_time", 380, 50, ["Forklift"], "pld.demo.parker.lee@example.com"],
    ["Emery", "Wright", "Production", "Production Coordinator", "full_time", 560, 70, ["Excel", "Slack"], "pld.demo.emery.wright@example.com"],
    ["Blake", "Young", "Audio", "A2", "contractor", 420, 55, ["Stage patch"], "pld.demo.blake.young@example.com"],
    ["Cameron", "Diaz", "Video", "Playback", "contractor", 540, 65, ["QLab"], "pld.demo.cameron.diaz@example.com"],
    ["Logan", "Gray", "Lighting", "Spot Op", "contractor", 400, 50, ["Followspot"], "pld.demo.logan.gray@example.com"],
    ["Rowan", "Kim", "Staging", "Lead", "full_time", 640, 75, ["Load-in"], "pld.demo.rowan.kim@example.com"],
    ["Sage", "Morales", "Production", "Advancing", "contractor", 520, 65, ["Advances"], "pld.demo.sage.morales@example.com"],
    ["Finley", "Austin", "Audio", "System Tech", "contractor", 590, 72, ["PA", "Line array"], "pld.demo.finley.austin@example.com"],
    ["Hayden", "Cruz", "Video", "Tech", "contractor", 510, 68, ["Projection"], "pld.demo.hayden.cruz@example.com"],
    ["Reese", "Bell", "Lighting", "Programmer", "contractor", 630, 78, ["MA3"], "pld.demo.reese.bell@example.com"],
    ["Kendall", "Rivera", "Production", "Site Lead", "contractor", 750, 90, ["Site"], "pld.demo.kendall.rivera@example.com"],
  ];

  for (const [fn, ln, dept, role, et, dayRate, perDiem, skills, email] of personnelSpec) {
    await db.query(
      `INSERT INTO personnel (
         id, tenant_id, user_id, first_name, last_name, email, phone, department_id,
         role, employment_type, skills, day_rate_amount, day_rate_currency,
         per_diem_amount, per_diem_currency, status, emergency_contact, metadata, custom_fields
       )
       SELECT
         gen_random_uuid(), $1::uuid, NULL, $2::varchar, $3::varchar, $4::varchar, '555-0100',
         (SELECT d.id FROM departments d WHERE d.tenant_id = $1::uuid AND d.name = $5::varchar AND d.deleted_at IS NULL LIMIT 1),
         $6::varchar, $7::varchar, $8::text[], $9::numeric, 'USD', $10::numeric, 'USD', 'active', NULL, '{}'::jsonb, '{}'::jsonb
       WHERE NOT EXISTS (
         SELECT 1 FROM personnel p WHERE p.tenant_id = $1::uuid AND lower(p.email) = lower($4::varchar) AND p.deleted_at IS NULL
       )
       AND EXISTS (SELECT 1 FROM departments d WHERE d.tenant_id = $1::uuid AND d.name = $5::varchar AND d.deleted_at IS NULL)`,
      [tenantId, fn, ln, email, dept, role, et, skills, dayRate, perDiem],
    );
  }

  const trucks = [
    ["Alpha Box 26", "box_truck", "available", "Austin Yard"],
    ["Sprinter Comm 01", "sprinter_van", "in_use", "Austin Yard"],
    ["Flatbed Scenic 12", "flatbed", "available", "Dallas Yard"],
    ["Semi LED Wall", "semi_trailer", "maintenance", "Dallas Yard"],
    ["Reefer Cable Store", "refrigerated", "available", "Houston Yard"],
    ["Van RF Kit 03", "sprinter_van", "available", "Houston Yard"],
  ];
  for (const [name, type, status, home] of trucks) {
    const full = `${P}Truck: ${name}`;
    await db.query(
      `INSERT INTO trucks (id, tenant_id, name, type, status, home_base, notes, metadata)
       SELECT gen_random_uuid(), $1::uuid, $2::varchar, $3::varchar, $4::varchar, $5::varchar, 'Demo fleet unit.', '{}'::jsonb
       WHERE NOT EXISTS (
         SELECT 1 FROM trucks tr WHERE tr.tenant_id = $1::uuid AND tr.name = $2::varchar AND tr.deleted_at IS NULL
       )`,
      [tenantId, full, type, status, home],
    );
  }

  const eventRows = [
    [
      "Metro Audio Summit 2026",
      `${P}Client: Metro Convention Group`,
      `${P}Venue: Austin Convention Center`,
      -30,
      -28,
      "confirmed",
      "production",
      ["summit", "corporate", "audio"],
      -32,
      -27,
      "Flagship multi-day corporate summit with national keynote and breakout tracks.",
      '{"power_demand_kw":240,"broadcast_network":"Metro News 14","rigging_points":42,"load_in_notes":"Dock B — 6am start; union steward on site."}',
    ],
    [
      "Gulf Coast Rally 2025",
      `${P}Client: Gulf Coast Sports Network`,
      `${P}Venue: Houston NRG Arena`,
      -120,
      -118,
      "completed",
      "closed",
      ["broadcast", "sports"],
      -122,
      -118,
      "Regional sports broadcast + floor show — strike completed.",
      '{"power_demand_kw":180,"broadcast_network":"GCSN Regional","rigging_points":28,"load_in_notes":"Compound behind loading dock 3."}',
    ],
    [
      "Riverwalk Jazz & Lights",
      `${P}Client: Riverwalk Amphitheater Authority`,
      `${P}Venue: San Antonio Riverwalk Plaza`,
      14,
      15,
      "confirmed",
      "pre_production",
      ["outdoor", "music"],
      12,
      15,
      "Two-night outdoor series — weather contingency in metadata.",
      '{"power_demand_kw":95,"broadcast_network":null,"rigging_points":12,"load_in_notes":"Barge load — check tide window."}',
    ],
    [
      "Highland Commencement Weekend",
      `${P}Client: Highland University`,
      `${P}Venue: Lubbock United Arena`,
      45,
      47,
      "confirmed",
      "planning",
      ["education", "broadcast"],
      43,
      47,
      "Ceremony + donor dinner; separate holds for academic regalia storage.",
      '{"power_demand_kw":120,"broadcast_network":"Highland Edu Channel","rigging_points":18,"load_in_notes":"Arena floor protection required."}',
    ],
    [
      "Summit Medical Plenary",
      `${P}Client: Summit Medical Congress`,
      `${P}Venue: Dallas Fair Park`,
      60,
      63,
      "draft",
      "planning",
      ["medical", "hybrid"],
      58,
      63,
      "Hybrid CME — remote presenters with in-room Q&A.",
      '{"power_demand_kw":85,"broadcast_network":"MedStream Live","rigging_points":10,"load_in_notes":"Ballroom A+B combined."}',
    ],
    [
      "Bluebonnet Rodeo Finals",
      `${P}Client: Bluebonnet Fairgrounds`,
      `${P}Venue: Fort Worth Stockyards Hall`,
      -200,
      -198,
      "completed",
      "closed",
      ["rodeo", "live"],
      -202,
      -198,
      "Annual finals — dirt load and cleanup tracked in ops.",
      '{"power_demand_kw":200,"broadcast_network":"Rural TV","rigging_points":22,"load_in_notes":"Dirt delivery gate 7."}',
    ],
    [
      "Stellar Gala Under the Stars",
      `${P}Client: Stellar Nonprofit Alliance`,
      `${P}Venue: Corpus Christi Bayfront`,
      90,
      90,
      "confirmed",
      "pre_production",
      ["gala", "nonprofit"],
      89,
      90,
      "Single-evening fundraising gala with auction and live band.",
      '{"power_demand_kw":70,"broadcast_network":null,"rigging_points":8,"load_in_notes":"Tent weights — wind plan attached."}',
    ],
    [
      "Capitol Hybrid Broadcast Week",
      `${P}Client: Capitol Media Partners`,
      `${P}Venue: Austin Convention Center`,
      7,
      11,
      "in_progress",
      "production",
      ["hybrid", "broadcast"],
      5,
      11,
      "Multi-day hybrid: control room + exhibit floor.",
      '{"power_demand_kw":310,"broadcast_network":"Capitol One HD","rigging_points":55,"load_in_notes":"Fiber backbone via Hall 4."}',
    ],
    [
      "Desert Ridge Casino Residency Load-in",
      `${P}Client: Desert Ridge Casino Resort`,
      `${P}Venue: El Paso County Coliseum`,
      100,
      105,
      "draft",
      "planning",
      ["casino", "residency"],
      98,
      105,
      "Long-run residency — phased truck rolls.",
      '{"power_demand_kw":260,"broadcast_network":null,"rigging_points":30,"load_in_notes":"Casino dock curfew 2am."}',
    ],
    [
      "Harborfront Symphony Broadcast",
      `${P}Client: Harborfront Arts Collective`,
      `${P}Venue: Corpus Christi Bayfront`,
      -45,
      -45,
      "cancelled",
      "post_production",
      ["orchestra", "broadcast"],
      -46,
      -45,
      "Cancelled — hurricane watch; retain budget rows for reconciliation testing.",
      '{"power_demand_kw":60,"broadcast_network":"Arts PBS","rigging_points":6,"load_in_notes":"Cancelled event — do not crew."}',
    ],
    [
      "Tyler Rose Festival Stage",
      `${P}Client: Bluebonnet Fairgrounds`,
      `${P}Venue: Tyler Rose Complex`,
      120,
      122,
      "confirmed",
      "planning",
      ["festival", "outdoor"],
      118,
      122,
      "Outdoor stage build with broadcast flypack.",
      '{"power_demand_kw":140,"broadcast_network":"East Texas TV","rigging_points":20,"load_in_notes":"Generator refuel window Sunday 6am."}',
    ],
    [
      "McAllen Winter Conference",
      `${P}Client: Metro Convention Group`,
      `${P}Venue: McAllen Convention Center`,
      150,
      152,
      "confirmed",
      "planning",
      ["corporate", "winter"],
      148,
      152,
      "Bilingual sessions — AV split across two ballrooms.",
      '{"power_demand_kw":150,"broadcast_network":null,"rigging_points":16,"load_in_notes":"Spanish/English split comms."}',
    ],
    [
      "El Paso Border Tech Expo",
      `${P}Client: Capitol Media Partners`,
      `${P}Venue: El Paso County Coliseum`,
      180,
      182,
      "draft",
      "planning",
      ["expo", "tech"],
      178,
      182,
      "Regional expo — lead retrieval and stage demos.",
      '{"power_demand_kw":175,"broadcast_network":null,"rigging_points":14,"load_in_notes":"Customs paperwork for MX gear."}',
    ],
    [
      "Lone Star Leadership Retreat",
      `${P}Client: Lone Star Corporate Events`,
      `${P}Venue: Tyler Rose Complex`,
      -60,
      -58,
      "completed",
      "closed",
      ["corporate", "retreat"],
      -62,
      -58,
      "Leadership offsite — team building and keynote.",
      '{"power_demand_kw":40,"broadcast_network":null,"rigging_points":4,"load_in_notes":"Breakout rooms B-C."}',
    ],
    [
      "Aurora Spring Kickoff",
      `${P}Client: Aurora Festival Co.`,
      `${P}Venue: Dallas Fair Park`,
      200,
      202,
      "confirmed",
      "planning",
      ["festival", "tour"],
      198,
      202,
      "Tour routing kickoff — truck pack lists in travel module.",
      '{"power_demand_kw":400,"broadcast_network":"Aurora Live","rigging_points":60,"load_in_notes":"Multi-truck convoy — see assignments."}',
    ],
    [
      "San Antonio City Council Forum",
      `${P}Client: Riverwalk Amphitheater Authority`,
      `${P}Venue: San Antonio Riverwalk Plaza`,
      3,
      3,
      "confirmed",
      "production",
      ["civic", "broadcast"],
      2,
      3,
      "Televised forum — tight turnaround same-day strike.",
      '{"power_demand_kw":55,"broadcast_network":"SA Gov TV","rigging_points":9,"load_in_notes":"Secret service sweep 4pm."}',
    ],
    [
      "Houston Corporate Town Hall",
      `${P}Client: Lone Star Corporate Events`,
      `${P}Venue: Houston NRG Arena`,
      -15,
      -15,
      "completed",
      "closed",
      ["corporate", "town_hall"],
      -16,
      -15,
      "Internal town hall — minimal scenic.",
      '{"power_demand_kw":45,"broadcast_network":null,"rigging_points":5,"load_in_notes":"Arena bowl only — no floor build."}',
    ],
    [
      "Fort Worth Stock Show Opener",
      `${P}Client: Bluebonnet Fairgrounds`,
      `${P}Venue: Fort Worth Stockyards Hall`,
      -90,
      -88,
      "completed",
      "closed",
      ["rodeo", "live"],
      -92,
      -88,
      "Opener night — pyro hold in ops notes.",
      '{"power_demand_kw":220,"broadcast_network":"Stock Show Net","rigging_points":24,"load_in_notes":"Pyro licensed vendor only."}',
    ],
  ];

  for (const [
    title,
    clientName,
    venueName,
    startOff,
    endOff,
    status,
    phase,
    tags,
    loadInOff,
    loadOutOff,
    desc,
    customFieldsJson,
  ] of eventRows) {
    const evName = `${P}Event: ${title}`;
    await db.query(
      `INSERT INTO events (
         id, tenant_id, name, client_id, venue_id,
         start_date, end_date, load_in_date, load_out_date,
         status, phase, description, tags, metadata, custom_fields
       )
       SELECT gen_random_uuid(), $1::uuid, $2::varchar,
         (SELECT c.id FROM clients c WHERE c.tenant_id = $1::uuid AND c.name = $3::varchar AND c.deleted_at IS NULL LIMIT 1),
         (SELECT v.id FROM venues v WHERE v.tenant_id = $1::uuid AND v.name = $4::varchar AND v.deleted_at IS NULL LIMIT 1),
         (CURRENT_DATE + $5::int)::date,
         (CURRENT_DATE + $6::int)::date,
         (CURRENT_DATE + $7::int)::date,
         (CURRENT_DATE + $8::int)::date,
         $9::varchar, $10::varchar, $11::text, $12::jsonb, '{}'::jsonb, $13::jsonb
       WHERE NOT EXISTS (
         SELECT 1 FROM events e WHERE e.tenant_id = $1::uuid AND e.name = $2::varchar AND e.deleted_at IS NULL
       )
       AND EXISTS (SELECT 1 FROM clients c WHERE c.tenant_id = $1::uuid AND c.name = $3::varchar AND c.deleted_at IS NULL)
       AND EXISTS (SELECT 1 FROM venues v WHERE v.tenant_id = $1::uuid AND v.name = $4::varchar AND v.deleted_at IS NULL)`,
      [
        tenantId,
        evName,
        clientName,
        venueName,
        startOff,
        endOff,
        loadInOff,
        loadOutOff,
        status,
        phase,
        desc,
        JSON.stringify(tags),
        customFieldsJson,
      ],
    );
  }

  const contactSpecs = [
    ["client_organization", `${P}Client: Aurora Festival Co.`, "Avery Quinn", "avery@aurora.example.com", true],
    ["client_organization", `${P}Client: Metro Convention Group`, "Blair Hunt", "bhunt@metroconv.example.com", true],
    ["venue", `${P}Venue: Austin Convention Center`, "Facilities Desk", "facilities@austincc.example.com", true],
    ["venue", `${P}Venue: Houston NRG Arena`, "Dock Lead", "dock@nrg.example.com", true],
    ["vendor_organization", `${P}Vendor: Gulf AV Wholesale`, "Sales Desk", "sales@gulfav.example.com", true],
    ["vendor_organization", `${P}Vendor: Lone Star Trucking Co.`, "Dispatch", "dispatch@lonestartruck.example.com", true],
  ];

  for (const [parentType, parentName, cname, email, isPrimary] of contactSpecs) {
    await db.query(
      `INSERT INTO contacts (id, tenant_id, parent_type, parent_id, personnel_id, name, email, phone, title, is_primary, metadata)
       SELECT gen_random_uuid(), $1::uuid, $2::varchar,
         (SELECT x.id FROM clients x WHERE $2::varchar = 'client_organization' AND x.tenant_id = $1::uuid AND x.name = $3::varchar AND x.deleted_at IS NULL LIMIT 1),
         NULL, $4::varchar, $5::varchar, '555-0200', 'Primary', $6::boolean, '{}'::jsonb
       WHERE $2::varchar = 'client_organization'
         AND EXISTS (SELECT 1 FROM clients x WHERE x.tenant_id = $1::uuid AND x.name = $3::varchar AND x.deleted_at IS NULL)
         AND NOT EXISTS (
           SELECT 1 FROM contacts co
           WHERE co.tenant_id = $1::uuid AND co.parent_type = $2::varchar
             AND co.parent_id = (SELECT x.id FROM clients x WHERE x.tenant_id = $1::uuid AND x.name = $3::varchar AND x.deleted_at IS NULL LIMIT 1)
             AND lower(co.email) = lower($5::varchar) AND co.deleted_at IS NULL
         )`,
      [tenantId, parentType, parentName, cname, email, isPrimary],
    );
    await db.query(
      `INSERT INTO contacts (id, tenant_id, parent_type, parent_id, personnel_id, name, email, phone, title, is_primary, metadata)
       SELECT gen_random_uuid(), $1::uuid, $2::varchar,
         (SELECT x.id FROM venues x WHERE $2::varchar = 'venue' AND x.tenant_id = $1::uuid AND x.name = $3::varchar AND x.deleted_at IS NULL LIMIT 1),
         NULL, $4::varchar, $5::varchar, '555-0200', 'Venue', $6::boolean, '{}'::jsonb
       WHERE $2::varchar = 'venue'
         AND EXISTS (SELECT 1 FROM venues x WHERE x.tenant_id = $1::uuid AND x.name = $3::varchar AND x.deleted_at IS NULL)
         AND NOT EXISTS (
           SELECT 1 FROM contacts co
           WHERE co.tenant_id = $1::uuid AND co.parent_type = $2::varchar
             AND co.parent_id = (SELECT x.id FROM venues x WHERE x.tenant_id = $1::uuid AND x.name = $3::varchar AND x.deleted_at IS NULL LIMIT 1)
             AND lower(co.email) = lower($5::varchar) AND co.deleted_at IS NULL
         )`,
      [tenantId, parentType, parentName, cname, email, isPrimary],
    );
    await db.query(
      `INSERT INTO contacts (id, tenant_id, parent_type, parent_id, personnel_id, name, email, phone, title, is_primary, metadata)
       SELECT gen_random_uuid(), $1::uuid, $2::varchar,
         (SELECT x.id FROM vendors x WHERE $2::varchar = 'vendor_organization' AND x.tenant_id = $1::uuid AND x.name = $3::varchar AND x.deleted_at IS NULL LIMIT 1),
         NULL, $4::varchar, $5::varchar, '555-0200', 'Vendor', $6::boolean, '{}'::jsonb
       WHERE $2::varchar = 'vendor_organization'
         AND EXISTS (SELECT 1 FROM vendors x WHERE x.tenant_id = $1::uuid AND x.name = $3::varchar AND x.deleted_at IS NULL)
         AND NOT EXISTS (
           SELECT 1 FROM contacts co
           WHERE co.tenant_id = $1::uuid AND co.parent_type = $2::varchar
             AND co.parent_id = (SELECT x.id FROM vendors x WHERE x.tenant_id = $1::uuid AND x.name = $3::varchar AND x.deleted_at IS NULL LIMIT 1)
             AND lower(co.email) = lower($5::varchar) AND co.deleted_at IS NULL
         )`,
      [tenantId, parentType, parentName, cname, email, isPrimary],
    );
  }

  await db.query(
    `UPDATE events e SET primary_contact_id = c.id
     FROM contacts c
     WHERE e.tenant_id = $1::uuid AND c.tenant_id = $1::uuid
       AND e.name = $2::varchar AND e.deleted_at IS NULL AND c.deleted_at IS NULL
       AND c.parent_type = 'client_organization'
       AND c.parent_id = e.client_id
       AND c.is_primary = TRUE`,
    [tenantId, `${P}Event: Metro Audio Summit 2026`],
  );

  async function crew(evTitle, email, role, st) {
    const evName = `${P}Event: ${evTitle}`;
    await db.query(
      `INSERT INTO crew_assignments (
         id, tenant_id, event_id, event_name, personnel_id, personnel_name, role,
         department_id, department_name, start_date, end_date, status, notes
       )
       SELECT gen_random_uuid(), $1::uuid, e.id, e.name, p.id,
         trim(p.first_name || ' ' || p.last_name), $4::varchar,
         p.department_id, d.name, e.start_date, e.end_date, $5::varchar,
         'pld_demo_seed'
       FROM events e
       JOIN personnel p ON p.tenant_id = $1::uuid AND lower(p.email) = lower($3::varchar) AND p.deleted_at IS NULL
       LEFT JOIN departments d ON d.id = p.department_id
       WHERE e.tenant_id = $1::uuid AND e.name = $2::varchar AND e.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM crew_assignments ca
         WHERE ca.tenant_id = $1::uuid AND ca.event_id = e.id AND ca.personnel_id = p.id AND ca.role = $4::varchar AND ca.notes = 'pld_demo_seed'
       )`,
      [tenantId, evName, email, role, st],
    );
  }

  await crew("Metro Audio Summit 2026", "pld.demo.chris.vega@example.com", "Production Manager", "confirmed");
  await crew("Metro Audio Summit 2026", "pld.demo.morgan.reeves@example.com", "FOH Engineer", "confirmed");
  await crew("Metro Audio Summit 2026", "pld.demo.casey.nguyen@example.com", "Monitor Engineer", "confirmed");
  await crew("Metro Audio Summit 2026", "pld.demo.jordan.ellis@example.com", "Video Director", "confirmed");
  await crew("Metro Audio Summit 2026", "pld.demo.sam.okonkwo@example.com", "LD", "confirmed");
  await crew("Metro Audio Summit 2026", "pld.demo.taylor.brooks@example.com", "Rigger", "tentative");
  await crew("Gulf Coast Rally 2025", "pld.demo.chris.vega@example.com", "Production Manager", "confirmed");
  await crew("Gulf Coast Rally 2025", "pld.demo.quinn.harper@example.com", "Camera Lead", "confirmed");
  await crew("Gulf Coast Rally 2025", "pld.demo.dana.cho@example.com", "RF Tech", "confirmed");
  await crew("Riverwalk Jazz & Lights", "pld.demo.rene.silva@example.com", "Stage Manager", "confirmed");
  await crew("Riverwalk Jazz & Lights", "pld.demo.sam.okonkwo@example.com", "LD", "tentative");
  await crew("Capitol Hybrid Broadcast Week", "pld.demo.chris.vega@example.com", "Production Manager", "confirmed");
  await crew("Capitol Hybrid Broadcast Week", "pld.demo.morgan.reeves@example.com", "FOH Engineer", "confirmed");
  await crew("Capitol Hybrid Broadcast Week", "pld.demo.jordan.ellis@example.com", "Video Director", "confirmed");
  await crew("Aurora Spring Kickoff", "pld.demo.kendall.rivera@example.com", "Site Lead", "confirmed");
  await crew("Aurora Spring Kickoff", "pld.demo.taylor.brooks@example.com", "Rigger", "confirmed");
  await crew("Aurora Spring Kickoff", "pld.demo.jamie.fox@example.com", "Carpenter", "confirmed");
  await crew("Harborfront Symphony Broadcast", "pld.demo.sage.morales@example.com", "Advancing", "cancelled");
  await crew("Tyler Rose Festival Stage", "pld.demo.alex.stone@example.com", "Electrician", "confirmed");
  await crew("McAllen Winter Conference", "pld.demo.emery.wright@example.com", "Production Coordinator", "tentative");

  async function truckAssign(evTitle, truckSuffix, st) {
    const evName = `${P}Event: ${evTitle}`;
    const truckName = `${P}Truck: ${truckSuffix}`;
    await db.query(
      `INSERT INTO truck_assignments (
         id, tenant_id, event_id, truck_id, purpose, start_date, end_date, status, notes
       )
       SELECT gen_random_uuid(), $1::uuid, e.id, t.id, 'Production freight', e.start_date, e.end_date, $4::varchar, 'pld_demo_seed'
       FROM events e
       JOIN trucks t ON t.tenant_id = $1::uuid AND t.name = $3::varchar AND t.deleted_at IS NULL
       WHERE e.tenant_id = $1::uuid AND e.name = $2::varchar AND e.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM truck_assignments ta
         WHERE ta.tenant_id = $1::uuid AND ta.event_id = e.id AND ta.truck_id = t.id AND ta.notes = 'pld_demo_seed'
       )`,
      [tenantId, evName, truckName, st],
    );
  }

  await truckAssign("Metro Audio Summit 2026", "Alpha Box 26", "confirmed");
  await truckAssign("Metro Audio Summit 2026", "Sprinter Comm 01", "confirmed");
  await truckAssign("Aurora Spring Kickoff", "Flatbed Scenic 12", "confirmed");
  await truckAssign("Aurora Spring Kickoff", "Semi LED Wall", "tentative");
  await truckAssign("Capitol Hybrid Broadcast Week", "Alpha Box 26", "confirmed");
  await truckAssign("Gulf Coast Rally 2025", "Sprinter Comm 01", "confirmed");

  await db.query(
    `INSERT INTO truck_routes (
       id, tenant_id, event_id, truck_id, assignment_id, origin, destination, waypoints,
       departure_datetime, estimated_arrival, distance_miles, estimated_fuel_cost, cargo_description, status, notes
     )
     SELECT gen_random_uuid(), $1::uuid, e.id, t.id, ta.id,
       'Austin Yard', 'Austin Convention Center', '[]'::jsonb,
       (e.start_date::timestamp AT TIME ZONE 'UTC') - interval '3 hours',
       (e.start_date::timestamp AT TIME ZONE 'UTC') + interval '2 hours',
       12.5, 45.0000, 'FOH cases + comm racks', 'completed', 'pld_demo_seed'
     FROM events e
     JOIN trucks t ON t.tenant_id = $1::uuid AND t.name = $3::varchar AND t.deleted_at IS NULL
     JOIN truck_assignments ta ON ta.tenant_id = $1::uuid AND ta.event_id = e.id AND ta.truck_id = t.id AND ta.notes = 'pld_demo_seed'
     WHERE e.tenant_id = $1::uuid AND e.name = $2::varchar AND e.deleted_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM truck_routes tr
       WHERE tr.tenant_id = $1::uuid AND tr.event_id = e.id AND tr.truck_id = t.id AND tr.notes = 'pld_demo_seed'
     )
     LIMIT 1`,
    [tenantId, `${P}Event: Metro Audio Summit 2026`, `${P}Truck: Alpha Box 26`],
  );

  await db.query(
    `INSERT INTO truck_routes (
       id, tenant_id, event_id, truck_id, assignment_id, origin, destination, waypoints,
       departure_datetime, estimated_arrival, distance_miles, estimated_fuel_cost, cargo_description, status, notes
     )
     SELECT gen_random_uuid(), $1::uuid, e.id, t.id, ta.id,
       'Dallas Yard', 'Dallas Fair Park', '[]'::jsonb,
       (e.load_in_date::timestamp AT TIME ZONE 'UTC') + interval '6 hours',
       (e.load_in_date::timestamp AT TIME ZONE 'UTC') + interval '14 hours',
       32.00, 120.0000, 'LED tiles + motors', 'in_transit', 'pld_demo_seed'
     FROM events e
     JOIN trucks t ON t.tenant_id = $1::uuid AND t.name = $3::varchar AND t.deleted_at IS NULL
     JOIN truck_assignments ta ON ta.tenant_id = $1::uuid AND ta.event_id = e.id AND ta.truck_id = t.id AND ta.notes = 'pld_demo_seed'
     WHERE e.tenant_id = $1::uuid AND e.name = $2::varchar AND e.deleted_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM truck_routes tr
       WHERE tr.tenant_id = $1::uuid AND tr.event_id = e.id AND tr.truck_id = t.id AND tr.notes = 'pld_demo_seed' AND tr.status = 'in_transit'
     )
     LIMIT 1`,
    [tenantId, `${P}Event: Aurora Spring Kickoff`, `${P}Truck: Flatbed Scenic 12`],
  );

  async function travel(evTitle, email, type, direction, dep, arr, cost, st) {
    const evName = `${P}Event: ${evTitle}`;
    await db.query(
      `INSERT INTO travel_records (
         id, tenant_id, event_id, personnel_id, travel_type, direction,
         departure_location, arrival_location, departure_datetime, arrival_datetime,
         carrier, booking_reference, cost, currency, status, notes, metadata, custom_fields
       )
       SELECT gen_random_uuid(), $1::uuid, e.id, p.id, $4::varchar, $5::varchar,
         'AUS', 'AUS Convention',
         $6::timestamptz, $7::timestamptz,
         'Demo Air', 'PLD-DEMO-001', $8::numeric, 'USD', $9::varchar, 'pld_demo_seed', '{}'::jsonb, '{}'::jsonb
       FROM events e
       JOIN personnel p ON p.tenant_id = $1::uuid AND lower(p.email) = lower($3::varchar) AND p.deleted_at IS NULL
       WHERE e.tenant_id = $1::uuid AND e.name = $2::varchar AND e.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM travel_records tr
         WHERE tr.tenant_id = $1::uuid AND tr.event_id = e.id AND tr.personnel_id = p.id AND tr.notes = 'pld_demo_seed' AND tr.direction = $5::varchar
       )`,
      [tenantId, evName, email, type, direction, dep, arr, cost, st],
    );
  }

  const t0 = new Date();
  const iso = (d) => d.toISOString();
  await travel(
    "Metro Audio Summit 2026",
    "pld.demo.chris.vega@example.com",
    "flight",
    "outbound",
    iso(t0),
    iso(new Date(t0.getTime() + 3 * 3600 * 1000)),
    425,
    "booked",
  );
  await travel(
    "Metro Audio Summit 2026",
    "pld.demo.chris.vega@example.com",
    "flight",
    "return",
    iso(new Date(t0.getTime() + 4 * 24 * 3600 * 1000)),
    iso(new Date(t0.getTime() + 4 * 24 * 3600 * 1000 + 3 * 3600 * 1000)),
    410,
    "booked",
  );
  await travel(
    "Gulf Coast Rally 2025",
    "pld.demo.quinn.harper@example.com",
    "car_rental",
    "outbound",
    iso(new Date(t0.getTime() - 86400000 * 200)),
    iso(new Date(t0.getTime() - 86400000 * 200 + 2 * 3600 * 1000)),
    120,
    "confirmed",
  );
  await travel(
    "Aurora Spring Kickoff",
    "pld.demo.kendall.rivera@example.com",
    "personal_vehicle",
    "inter_venue",
    iso(new Date(t0.getTime() + 86400000 * 5)),
    iso(new Date(t0.getTime() + 86400000 * 5 + 3600 * 1000)),
    null,
    "planned",
  );

  async function fin(evTitle, category, type, desc, amount, status, recordDate) {
    const evName = `${P}Event: ${evTitle}`;
    await db.query(
      `INSERT INTO financial_records (
         id, tenant_id, event_id, category, type, description, amount, currency,
         quantity, unit_price, record_date, source, status, notes, metadata
       )
       SELECT gen_random_uuid(), $1::uuid, e.id, $3::varchar, $4::varchar, $5::varchar, $6::numeric, 'USD',
         NULL, NULL, $7::date, 'manual', $8::varchar, 'pld_demo_seed', '{}'::jsonb
       FROM events e
       WHERE e.tenant_id = $1::uuid AND e.name = $2::varchar AND e.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM financial_records fr
         WHERE fr.tenant_id = $1::uuid AND fr.event_id = e.id AND fr.description = $5::varchar AND fr.notes = 'pld_demo_seed'
       )`,
      [tenantId, evName, category, type, desc, amount, recordDate, status],
    );
  }

  const today = new Date();
  const isoDate = (d) => d.toISOString().slice(0, 10);
  await fin("Metro Audio Summit 2026", "labor", "cost", "Audio crew — advance week", 18500, "approved", isoDate(today));
  await fin("Metro Audio Summit 2026", "equipment", "cost", "Subrent — line array package", 22000, "actual", isoDate(today));
  await fin("Metro Audio Summit 2026", "travel", "cost", "Airfare batch — production staff", 8400, "actual", isoDate(today));
  await fin("Metro Audio Summit 2026", "venue", "cost", "Facility fees — Hall 4-6", 31000, "estimated", isoDate(today));
  await fin("Metro Audio Summit 2026", "revenue", "revenue", "Client production fee — milestone 2", 95000, "actual", isoDate(today));
  await fin("Gulf Coast Rally 2025", "labor", "cost", "Camera crew — show days", 12000, "approved", isoDate(today));
  await fin("Gulf Coast Rally 2025", "transport", "cost", "Truck fuel — OB compound", 2800, "actual", isoDate(today));
  await fin("Gulf Coast Rally 2025", "revenue", "revenue", "Broadcast rights — regional", 45000, "actual", isoDate(today));
  await fin("Harborfront Symphony Broadcast", "miscellaneous", "cost", "Cancellation fee — venue hold", 1500, "estimated", isoDate(today));

  await db.query(
    `INSERT INTO invoices (
       id, tenant_id, event_id, client_id, invoice_number, status, tax_rate, discount, discount_type,
       subtotal, tax_amount, total, currency, due_date, paid_date, paid_amount, notes, payment_terms
     )
     SELECT gen_random_uuid(), $1::uuid, e.id, c.id,
       'PLD-DEMO-INV-2026-001', 'sent', 0.0825, 0, 'fixed',
       95000, 7837.5, 102837.5, 'USD',
       (CURRENT_DATE + 30)::date, NULL, NULL,
       'pld_demo_seed', 'Net 30'
     FROM events e
     JOIN clients c ON c.id = e.client_id AND c.tenant_id = e.tenant_id
     WHERE e.tenant_id = $1::uuid AND e.name = $2::varchar AND e.deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.tenant_id = $1::uuid AND i.invoice_number = 'PLD-DEMO-INV-2026-001')`,
    [tenantId, `${P}Event: Metro Audio Summit 2026`],
  );

  await db.query(
    `INSERT INTO invoice_line_items (id, invoice_id, tenant_id, description, quantity, unit_price, amount, financial_record_id, sort_order)
     SELECT gen_random_uuid(), i.id, $1::uuid, 'Production fee — milestone 2', 1, 95000, 95000, NULL, 0
     FROM invoices i
     WHERE i.tenant_id = $1::uuid AND i.invoice_number = 'PLD-DEMO-INV-2026-001'
     AND NOT EXISTS (SELECT 1 FROM invoice_line_items li WHERE li.invoice_id = i.id AND li.description = 'Production fee — milestone 2')`,
    [tenantId],
  );

  await db.query(
    `INSERT INTO invoices (
       id, tenant_id, event_id, client_id, invoice_number, status, tax_rate, discount, discount_type,
       subtotal, tax_amount, total, currency, due_date, paid_date, paid_amount, notes, payment_terms
     )
     SELECT gen_random_uuid(), $1::uuid, e.id, c.id,
       'PLD-DEMO-INV-2025-GULF', 'paid', 0.0825, 500, 'fixed',
       45000, 3671.25, 48171.25, 'USD',
       (CURRENT_DATE - 40)::date, (CURRENT_DATE - 35)::date, 48171.25,
       'pld_demo_seed', 'Net 15'
     FROM events e
     JOIN clients c ON c.id = e.client_id AND c.tenant_id = e.tenant_id
     WHERE e.tenant_id = $1::uuid AND e.name = $2::varchar AND e.deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.tenant_id = $1::uuid AND i.invoice_number = 'PLD-DEMO-INV-2025-GULF')`,
    [tenantId, `${P}Event: Gulf Coast Rally 2025`],
  );

  await db.query(
    `INSERT INTO invoice_line_items (id, invoice_id, tenant_id, description, quantity, unit_price, amount, financial_record_id, sort_order)
     SELECT gen_random_uuid(), i.id, $1::uuid, 'Broadcast rights — regional', 1, 45000, 45000, NULL, 0
     FROM invoices i
     WHERE i.tenant_id = $1::uuid AND i.invoice_number = 'PLD-DEMO-INV-2025-GULF'
     AND NOT EXISTS (SELECT 1 FROM invoice_line_items li WHERE li.invoice_id = i.id AND li.description = 'Broadcast rights — regional')`,
    [tenantId],
  );

  await db.query(
    `INSERT INTO invoices (
       id, tenant_id, event_id, client_id, invoice_number, status, tax_rate, discount, discount_type,
       subtotal, tax_amount, total, currency, due_date, paid_date, paid_amount, notes, payment_terms
     )
     SELECT gen_random_uuid(), $1::uuid, e.id, c.id,
       'PLD-DEMO-INV-DRAFT-MCALLEN', 'draft', 0.0825, 0, 'fixed',
       28000, 2310, 30310, 'USD',
       (CURRENT_DATE + 45)::date, NULL, NULL,
       'pld_demo_seed', 'Net 30'
     FROM events e
     JOIN clients c ON c.id = e.client_id AND c.tenant_id = e.tenant_id
     WHERE e.tenant_id = $1::uuid AND e.name = $2::varchar AND e.deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.tenant_id = $1::uuid AND i.invoice_number = 'PLD-DEMO-INV-DRAFT-MCALLEN')`,
    [tenantId, `${P}Event: McAllen Winter Conference`],
  );

  await db.query(
    `INSERT INTO invoice_line_items (id, invoice_id, tenant_id, description, quantity, unit_price, amount, financial_record_id, sort_order)
     SELECT gen_random_uuid(), i.id, $1::uuid, 'AV package — deposit', 1, 28000, 28000, NULL, 0
     FROM invoices i
     WHERE i.tenant_id = $1::uuid AND i.invoice_number = 'PLD-DEMO-INV-DRAFT-MCALLEN'
     AND NOT EXISTS (SELECT 1 FROM invoice_line_items li WHERE li.invoice_id = i.id AND li.description = 'AV package — deposit')`,
    [tenantId],
  );

  await db.query(
    `INSERT INTO tasks (id, tenant_id, title, description, status, priority, task_type, event_id, assignee_personnel_id, tags, sort_order, metadata)
     SELECT gen_random_uuid(), $1::uuid, 'Advance venue power walkthrough', 'Confirm tie-in locations with facilities.', 'in_progress', 'high', 'task',
       e.id, p.id, '["ops","advance"]'::jsonb, 0, '{}'::jsonb
     FROM events e, personnel p
     WHERE e.tenant_id = $1::uuid AND e.name = $2::varchar AND e.deleted_at IS NULL
       AND p.tenant_id = $1::uuid AND lower(p.email) = lower('pld.demo.chris.vega@example.com') AND p.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.tenant_id = $1::uuid AND t.title = 'Advance venue power walkthrough' AND t.event_id = e.id)`,
    [tenantId, `${P}Event: Metro Audio Summit 2026`],
  );

  await db.query(
    `INSERT INTO tasks (id, tenant_id, title, description, status, priority, task_type, event_id, assignee_personnel_id, tags, sort_order, metadata)
     SELECT gen_random_uuid(), $1::uuid, 'RF frequency coordination', 'Submit consolidated list to venue IT.', 'open', 'urgent', 'task',
       e.id, p.id, '["rf","compliance"]'::jsonb, 1, '{}'::jsonb
     FROM events e, personnel p
     WHERE e.tenant_id = $1::uuid AND e.name = $2::varchar AND e.deleted_at IS NULL
       AND p.tenant_id = $1::uuid AND lower(p.email) = lower('pld.demo.dana.cho@example.com') AND p.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.tenant_id = $1::uuid AND t.title = 'RF frequency coordination' AND t.event_id = e.id)`,
    [tenantId, `${P}Event: Metro Audio Summit 2026`],
  );

  await db.query(
    `INSERT INTO tasks (id, tenant_id, title, description, status, priority, task_type, event_id, assignee_personnel_id, parent_task_id, tags, sort_order, metadata)
     SELECT gen_random_uuid(), $1::uuid, 'Load-in milestone', 'Trucks on dock; verify manifest.', 'open', 'normal', 'milestone',
       e.id, NULL, NULL, '["load_in"]'::jsonb, 0, '{}'::jsonb
     FROM events e
     WHERE e.tenant_id = $1::uuid AND e.name = $2::varchar AND e.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.tenant_id = $1::uuid AND t.title = 'Load-in milestone' AND t.event_id = e.id)`,
    [tenantId, `${P}Event: Aurora Spring Kickoff`],
  );

  await db.query(
    `INSERT INTO tasks (id, tenant_id, title, description, status, priority, task_type, tags, sort_order, metadata)
     SELECT gen_random_uuid(), $1::uuid, 'Fleet inspection — Q2', 'DOT paperwork renewals for box trucks.', 'done', 'low', 'task',
       '["fleet"]'::jsonb, 0, '{}'::jsonb
     WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.tenant_id = $1::uuid AND t.title = 'Fleet inspection — Q2')`,
    [tenantId],
  );

  await db.query(
    `INSERT INTO time_entries (id, tenant_id, personnel_id, event_id, started_at, ended_at, status, notes, metadata)
     SELECT gen_random_uuid(), $1::uuid, p.id, e.id,
       (CURRENT_TIMESTAMP - interval '9 hours'), CURRENT_TIMESTAMP - interval '1 hour', 'closed', 'pld_demo_seed', '{}'::jsonb
     FROM personnel p, events e
     WHERE p.tenant_id = $1::uuid AND lower(p.email) = lower('pld.demo.morgan.reeves@example.com') AND p.deleted_at IS NULL
       AND e.tenant_id = $1::uuid AND e.name = $2::varchar AND e.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM time_entries te
         WHERE te.tenant_id = $1::uuid AND te.personnel_id = p.id AND te.event_id = e.id AND te.notes = 'pld_demo_seed'
       )`,
    [tenantId, `${P}Event: Metro Audio Summit 2026`],
  );

  await db.query(
    `INSERT INTO time_entries (id, tenant_id, personnel_id, event_id, started_at, ended_at, status, notes, metadata)
     SELECT gen_random_uuid(), $1::uuid, p.id, e.id,
       (CURRENT_TIMESTAMP - interval '48 hours'), CURRENT_TIMESTAMP - interval '40 hours', 'closed', 'pld_demo_seed', '{}'::jsonb
     FROM personnel p, events e
     WHERE p.tenant_id = $1::uuid AND lower(p.email) = lower('pld.demo.jordan.ellis@example.com') AND p.deleted_at IS NULL
       AND e.tenant_id = $1::uuid AND e.name = $2::varchar AND e.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM time_entries te
         WHERE te.tenant_id = $1::uuid AND te.personnel_id = p.id AND te.event_id = e.id AND te.notes = 'pld_demo_seed'
       )`,
    [tenantId, `${P}Event: Capitol Hybrid Broadcast Week`],
  );

  await db.query(
    `INSERT INTO pay_periods (id, tenant_id, period_start, period_end, pay_date, status, metadata)
     SELECT gen_random_uuid(), $1::uuid,
       (date_trunc('month', CURRENT_DATE) - interval '1 month')::date,
       (date_trunc('month', CURRENT_DATE) - interval '1 day')::date,
       (date_trunc('month', CURRENT_DATE) + interval '14 days')::date,
       'approved', '{}'::jsonb
     WHERE NOT EXISTS (
       SELECT 1 FROM pay_periods pp
       WHERE pp.tenant_id = $1::uuid
         AND pp.period_start = (date_trunc('month', CURRENT_DATE) - interval '1 month')::date
         AND pp.deleted_at IS NULL
     )`,
    [tenantId],
  );

  await db.query(
    `INSERT INTO pay_statements (id, tenant_id, pay_period_id, personnel_id, currency, gross_amount, net_amount, status, lines, metadata)
     SELECT gen_random_uuid(), $1::uuid, pp.id, p.id, 'USD', 5200.00, 4800.00, 'draft',
       '[{"type":"hourly","hours":40,"rate":130}]'::jsonb, '{}'::jsonb
     FROM pay_periods pp
     CROSS JOIN personnel p
     WHERE pp.tenant_id = $1::uuid AND pp.deleted_at IS NULL
       AND p.tenant_id = $1::uuid AND lower(p.email) = lower('pld.demo.morgan.reeves@example.com') AND p.deleted_at IS NULL
       AND pp.period_start = (date_trunc('month', CURRENT_DATE) - interval '1 month')::date
       AND NOT EXISTS (
         SELECT 1 FROM pay_statements ps
         WHERE ps.tenant_id = $1::uuid AND ps.pay_period_id = pp.id AND ps.personnel_id = p.id AND ps.deleted_at IS NULL
       )`,
    [tenantId],
  );

  await db.query(
    `INSERT INTO pay_statements (id, tenant_id, pay_period_id, personnel_id, currency, gross_amount, net_amount, status, lines, metadata)
     SELECT gen_random_uuid(), $1::uuid, pp.id, p.id, 'USD', 4100.00, 3800.00, 'draft',
       '[{"type":"hourly","hours":32,"rate":128.125}]'::jsonb, '{}'::jsonb
     FROM pay_periods pp
     CROSS JOIN personnel p
     WHERE pp.tenant_id = $1::uuid AND pp.deleted_at IS NULL
       AND p.tenant_id = $1::uuid AND lower(p.email) = lower('pld.demo.jordan.ellis@example.com') AND p.deleted_at IS NULL
       AND pp.period_start = (date_trunc('month', CURRENT_DATE) - interval '1 month')::date
       AND NOT EXISTS (
         SELECT 1 FROM pay_statements ps
         WHERE ps.tenant_id = $1::uuid AND ps.pay_period_id = pp.id AND ps.personnel_id = p.id AND ps.deleted_at IS NULL
       )`,
    [tenantId],
  );

  await db.query(
    `INSERT INTO scheduling_conflicts (
       id, tenant_id, resource_type, resource_id, resource_name, severity, status,
       overlap_start, overlap_end, assignments, event_id_1, event_id_2, conflict_kind
     )
     SELECT gen_random_uuid(), $1::uuid, 'personnel', p.id,
       trim(p.first_name || ' ' || p.last_name), 'soft', 'active',
       (CURRENT_DATE + 7)::date, (CURRENT_DATE + 10)::date,
       '[]'::jsonb,
       e1.id, e2.id, 'double_booking'
     FROM personnel p
     JOIN events e1 ON e1.tenant_id = $1::uuid AND e1.name = $2::varchar AND e1.deleted_at IS NULL
     JOIN events e2 ON e2.tenant_id = $1::uuid AND e2.name = $3::varchar AND e2.deleted_at IS NULL
     WHERE p.tenant_id = $1::uuid AND lower(p.email) = lower('pld.demo.chris.vega@example.com') AND p.deleted_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM scheduling_conflicts sc
       WHERE sc.tenant_id = $1::uuid AND sc.resource_id = p.id AND sc.resource_type = 'personnel' AND sc.conflict_kind = 'double_booking'
         AND sc.overlap_start = (CURRENT_DATE + 7)::date
     )`,
    [
      tenantId,
      `${P}Event: Capitol Hybrid Broadcast Week`,
      `${P}Event: McAllen Winter Conference`,
    ],
  );

  await db.query(
    `INSERT INTO financial_line_items (id, tenant_id, custom_fields)
     SELECT gen_random_uuid(), $1::uuid, '{"pld_demo":"fl-1","note":"Stub FLI for custom field testing"}'::jsonb
     WHERE NOT EXISTS (
       SELECT 1 FROM financial_line_items f WHERE f.tenant_id = $1::uuid AND f.custom_fields->>'pld_demo' = 'fl-1'
     )`,
    [tenantId],
  );

  await db.query(
    `INSERT INTO financial_line_items (id, tenant_id, custom_fields)
     SELECT gen_random_uuid(), $1::uuid, '{"pld_demo":"fl-2","note":"Second stub"}'::jsonb
     WHERE NOT EXISTS (
       SELECT 1 FROM financial_line_items f WHERE f.tenant_id = $1::uuid AND f.custom_fields->>'pld_demo' = 'fl-2'
     )`,
    [tenantId],
  );

  await db.query(
    `INSERT INTO custom_field_index (id, tenant_id, entity_type, entity_id, field_key, value_text, value_numeric, value_date, value_boolean, updated_at)
     SELECT gen_random_uuid(), $1::uuid, 'event', e.id, 'power_demand_kw', NULL,
       (e.custom_fields->>'power_demand_kw')::double precision, NULL, NULL, NOW()
     FROM events e
     WHERE e.tenant_id = $1::uuid AND e.deleted_at IS NULL AND e.custom_fields ? 'power_demand_kw'
     ON CONFLICT (tenant_id, entity_type, entity_id, field_key)
     DO UPDATE SET value_numeric = EXCLUDED.value_numeric, updated_at = NOW()`,
    [tenantId],
  );

  await db.query(
    `INSERT INTO custom_field_index (id, tenant_id, entity_type, entity_id, field_key, value_text, value_numeric, value_date, value_boolean, updated_at)
     SELECT gen_random_uuid(), $1::uuid, 'event', e.id, 'broadcast_network', e.custom_fields->>'broadcast_network',
       NULL, NULL, NULL, NOW()
     FROM events e
     WHERE e.tenant_id = $1::uuid AND e.deleted_at IS NULL AND e.custom_fields->>'broadcast_network' IS NOT NULL AND e.custom_fields->>'broadcast_network' <> ''
     ON CONFLICT (tenant_id, entity_type, entity_id, field_key)
     DO UPDATE SET value_text = EXCLUDED.value_text, updated_at = NOW()`,
    [tenantId],
  );
}
