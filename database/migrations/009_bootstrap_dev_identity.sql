-- Dev bootstrap: test tenant + lab user (password dev-only: pld, bcrypt $2b$12$...)
-- Owner email is inserted by scripts/seed-postgres.mjs using OWNER_EMAIL / PLD_DEV_OWNER_EMAIL.

INSERT INTO tenants (id, slug, name, status, settings)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  'test',
  'Test Tenant',
  'active',
  '{}'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO roles (id, tenant_id, name, is_system)
VALUES (
  '10000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000010',
  'admin',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission)
VALUES (
  '20000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000011',
  '*'
)
ON CONFLICT (role_id, permission) DO NOTHING;

INSERT INTO users (
  id,
  tenant_id,
  email,
  password_hash,
  role_id,
  first_name,
  last_name,
  is_active
)
SELECT
  '00000000-0000-0000-0000-000000000013',
  '00000000-0000-0000-0000-000000000010',
  'testtenant@testtenant.com',
  '$2b$12$7zbywjby2mQvBBlSxE7.gOw5jVUQOV4QZVot/Nx8PjDobit0vyuQC',
  '10000000-0000-0000-0000-000000000011',
  'Test',
  'Tenant',
  TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM users u
  WHERE u.tenant_id = '00000000-0000-0000-0000-000000000010'
    AND lower(u.email) = lower('testtenant@testtenant.com')
    AND u.deleted_at IS NULL
);
