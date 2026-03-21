-- Unified CRM contact persons + membership link on contacts

CREATE TABLE IF NOT EXISTS contact_persons (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  display_name VARCHAR(255) NOT NULL,
  emails JSONB NOT NULL DEFAULT '[]',
  phones JSONB NOT NULL DEFAULT '[]',
  primary_email_normalized VARCHAR(320),
  personnel_id UUID REFERENCES personnel (id) ON DELETE SET NULL,
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_persons_tenant
  ON contact_persons (tenant_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contact_persons_tenant_personnel
  ON contact_persons (tenant_id, personnel_id)
  WHERE deleted_at IS NULL AND personnel_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_persons_tenant_user
  ON contact_persons (tenant_id, user_id)
  WHERE deleted_at IS NULL AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_persons_tenant_primary_email
  ON contact_persons (tenant_id, lower(primary_email_normalized))
  WHERE deleted_at IS NULL AND primary_email_normalized IS NOT NULL;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES contact_persons (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_person
  ON contacts (tenant_id, person_id)
  WHERE deleted_at IS NULL AND person_id IS NOT NULL;

-- Backfill: one contact_person per distinct (tenant, normalized email) when email present;
-- otherwise one person per contact. Multiple contacts (memberships) can share one person_id.
DO $pld_cp_bf$
BEGIN
  IF to_regclass('public.contacts') IS NULL OR to_regclass('public.contact_persons') IS NULL THEN
    RETURN;
  END IF;

  -- Backfill only memberships that do not already point to a person.
  -- ::text keeps normalization consistent with uq_contact_persons_tenant_primary_email.
  CREATE TEMP TABLE _pld_base ON COMMIT DROP AS
  SELECT
    c.id AS contact_id,
    c.tenant_id,
    c.name AS display_name,
    c.email,
    c.phone,
    c.personnel_id,
    c.metadata,
    c.created_at,
    c.updated_at,
    CASE
      WHEN c.email IS NOT NULL AND trim(c.email::text) <> '' THEN lower(trim(c.email::text))
      ELSE NULL
    END AS norm_email
  FROM contacts c
  WHERE c.deleted_at IS NULL
    AND c.person_id IS NULL;

  -- One row per (tenant, lower(norm)) matching uq_contact_persons_tenant_primary_email exactly.
  CREATE TEMP TABLE _pld_eg ON COMMIT DROP AS
  SELECT
    k.tenant_id,
    k.norm_email_key,
    ep.id AS existing_person_id,
    COALESCE(ep.id, gen_random_uuid()) AS person_id
  FROM (
    SELECT
      b.tenant_id,
      lower(b.norm_email::text) AS norm_email_key
    FROM _pld_base b
    WHERE b.norm_email IS NOT NULL
    GROUP BY b.tenant_id, lower(b.norm_email::text)
  ) k
  LEFT JOIN LATERAL (
    SELECT cp.id
    FROM contact_persons cp
    WHERE cp.tenant_id = k.tenant_id
      AND cp.deleted_at IS NULL
      AND lower(cp.primary_email_normalized::text) = k.norm_email_key
    ORDER BY cp.created_at, cp.id
    LIMIT 1
  ) ep ON TRUE;

  ALTER TABLE _pld_base ADD COLUMN person_id UUID;

  UPDATE _pld_base b
  SET person_id = eg.person_id
  FROM _pld_eg eg
  WHERE b.norm_email IS NOT NULL
    AND b.tenant_id = eg.tenant_id
    AND lower(b.norm_email::text) = eg.norm_email_key;

  UPDATE _pld_base
  SET person_id = gen_random_uuid()
  WHERE norm_email IS NULL;

  INSERT INTO contact_persons (
    id, tenant_id, display_name, emails, phones, primary_email_normalized,
    personnel_id, metadata, created_at, updated_at
  )
  SELECT
    eg.person_id,
    eg.tenant_id,
    fc.display_name,
    CASE
      WHEN fc.email IS NOT NULL AND trim(fc.email::text) <> '' THEN
        jsonb_build_array(
          jsonb_build_object(
            'address', trim(fc.email::text),
            'normalized', lower(trim(fc.email::text)),
            'is_primary', true
          )
        )
      ELSE '[]'::jsonb
    END,
    CASE
      WHEN fc.phone IS NOT NULL AND trim(fc.phone::text) <> '' THEN
        jsonb_build_array(
          jsonb_build_object(
            'address', trim(fc.phone::text),
            'e164', NULL,
            'is_primary', true
          )
        )
      ELSE '[]'::jsonb
    END,
    eg.norm_email_key,
    fc.personnel_id,
    COALESCE(fc.metadata, '{}'::jsonb),
    fc.created_at,
    fc.updated_at
  FROM _pld_eg eg
  INNER JOIN LATERAL (
    SELECT *
    FROM _pld_base b
    WHERE b.tenant_id = eg.tenant_id
      AND lower(b.norm_email::text) = eg.norm_email_key
    ORDER BY b.created_at, b.contact_id
    LIMIT 1
  ) fc ON TRUE
  WHERE eg.existing_person_id IS NULL;

  INSERT INTO contact_persons (
    id, tenant_id, display_name, emails, phones, primary_email_normalized,
    personnel_id, metadata, created_at, updated_at
  )
  SELECT
    b.person_id,
    b.tenant_id,
    b.display_name,
    CASE
      WHEN b.email IS NOT NULL AND trim(b.email::text) <> '' THEN
        jsonb_build_array(
          jsonb_build_object(
            'address', trim(b.email::text),
            'normalized', lower(trim(b.email::text)),
            'is_primary', true
          )
        )
      ELSE '[]'::jsonb
    END,
    CASE
      WHEN b.phone IS NOT NULL AND trim(b.phone::text) <> '' THEN
        jsonb_build_array(
          jsonb_build_object(
            'address', trim(b.phone::text),
            'e164', NULL,
            'is_primary', true
          )
        )
      ELSE '[]'::jsonb
    END,
    NULL,
    b.personnel_id,
    COALESCE(b.metadata, '{}'::jsonb),
    b.created_at,
    b.updated_at
  FROM _pld_base b
  WHERE b.norm_email IS NULL;

  UPDATE contacts co
  SET person_id = b.person_id
  FROM _pld_base b
  WHERE co.id = b.contact_id
    AND co.person_id IS NULL;
END
$pld_cp_bf$;
