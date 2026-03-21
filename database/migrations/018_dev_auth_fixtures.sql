-- Dev-only fixtures: standardize demo admin password to `pld`; add multi-role users on demo;
-- add manager + viewer roles on test tenant with users (see docs/bootstrap-dev-identity.md).
-- Password hash matches scripts/seed-postgres.mjs (bcrypt for `pld`).

-- Same bcrypt as migration 009 / seed-postgres — password `pld`
UPDATE users
SET
  password_hash = '$2b$12$7zbywjby2mQvBBlSxE7.gOw5jVUQOV4QZVot/Nx8PjDobit0vyuQC',
  updated_at = NOW()
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND lower(email) = lower('admin@demo.local')
  AND deleted_at IS NULL;

-- Demo tenant: manager / coordinator / viewer users (roles from 005_auth_module)
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
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000001',
  'manager@demo.local',
  '$2b$12$7zbywjby2mQvBBlSxE7.gOw5jVUQOV4QZVot/Nx8PjDobit0vyuQC',
  '10000000-0000-0000-0000-000000000002',
  'Demo',
  'Manager',
  TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM users u
  WHERE u.tenant_id = '00000000-0000-0000-0000-000000000001'
    AND lower(u.email) = lower('manager@demo.local')
    AND u.deleted_at IS NULL
);

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
  '00000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000001',
  'coordinator@demo.local',
  '$2b$12$7zbywjby2mQvBBlSxE7.gOw5jVUQOV4QZVot/Nx8PjDobit0vyuQC',
  '10000000-0000-0000-0000-000000000003',
  'Demo',
  'Coordinator',
  TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM users u
  WHERE u.tenant_id = '00000000-0000-0000-0000-000000000001'
    AND lower(u.email) = lower('coordinator@demo.local')
    AND u.deleted_at IS NULL
);

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
  '00000000-0000-0000-0000-000000000022',
  '00000000-0000-0000-0000-000000000001',
  'viewer@demo.local',
  '$2b$12$7zbywjby2mQvBBlSxE7.gOw5jVUQOV4QZVot/Nx8PjDobit0vyuQC',
  '10000000-0000-0000-0000-000000000004',
  'Demo',
  'Viewer',
  TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM users u
  WHERE u.tenant_id = '00000000-0000-0000-0000-000000000001'
    AND lower(u.email) = lower('viewer@demo.local')
    AND u.deleted_at IS NULL
);

-- Test tenant: manager + viewer roles (mirror demo manager/viewer permissions)
INSERT INTO roles (id, tenant_id, name, is_system)
VALUES (
  '10000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000010',
  'manager',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO roles (id, tenant_id, name, is_system)
VALUES (
  '10000000-0000-0000-0000-000000000013',
  '00000000-0000-0000-0000-000000000010',
  'viewer',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission)
VALUES
  ('20000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000012', 'personnel:create'),
  ('20000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000012', 'personnel:read'),
  ('20000000-0000-0000-0000-000000000023', '10000000-0000-0000-0000-000000000012', 'events:read'),
  ('20000000-0000-0000-0000-000000000024', '10000000-0000-0000-0000-000000000012', 'trucks:create'),
  ('20000000-0000-0000-0000-000000000025', '10000000-0000-0000-0000-000000000012', 'scheduling:create'),
  ('20000000-0000-0000-0000-000000000026', '10000000-0000-0000-0000-000000000012', 'auth.invitations.manage')
ON CONFLICT (role_id, permission) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission)
VALUES
  ('20000000-0000-0000-0000-000000000031', '10000000-0000-0000-0000-000000000013', 'personnel:read'),
  ('20000000-0000-0000-0000-000000000032', '10000000-0000-0000-0000-000000000013', 'events:read')
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
  '00000000-0000-0000-0000-000000000023',
  '00000000-0000-0000-0000-000000000010',
  'manager@testtenant.com',
  '$2b$12$7zbywjby2mQvBBlSxE7.gOw5jVUQOV4QZVot/Nx8PjDobit0vyuQC',
  '10000000-0000-0000-0000-000000000012',
  'Test',
  'Manager',
  TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM users u
  WHERE u.tenant_id = '00000000-0000-0000-0000-000000000010'
    AND lower(u.email) = lower('manager@testtenant.com')
    AND u.deleted_at IS NULL
);

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
  '00000000-0000-0000-0000-000000000024',
  '00000000-0000-0000-0000-000000000010',
  'viewer@testtenant.com',
  '$2b$12$7zbywjby2mQvBBlSxE7.gOw5jVUQOV4QZVot/Nx8PjDobit0vyuQC',
  '10000000-0000-0000-0000-000000000013',
  'Test',
  'Viewer',
  TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM users u
  WHERE u.tenant_id = '00000000-0000-0000-0000-000000000010'
    AND lower(u.email) = lower('viewer@testtenant.com')
    AND u.deleted_at IS NULL
);
