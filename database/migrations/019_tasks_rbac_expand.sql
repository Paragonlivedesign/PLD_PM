-- Extend tasks RBAC beyond demo manager (017): coordinator + viewer on demo;
-- full tasks bundle on test-tenant manager; read-only on test-tenant viewer.
-- Admin role keeps wildcard (*) from 005.

-- Demo coordinator: operational work — create/update tasks, no delete
INSERT INTO role_permissions (id, role_id, permission)
SELECT gen_random_uuid(), p.role_id, p.perm
FROM (VALUES
  ('10000000-0000-0000-0000-000000000003'::uuid, 'tasks:read'),
  ('10000000-0000-0000-0000-000000000003'::uuid, 'tasks:create'),
  ('10000000-0000-0000-0000-000000000003'::uuid, 'tasks:update')
) AS p(role_id, perm)
JOIN roles r ON r.id = p.role_id AND r.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role_id = p.role_id AND rp.permission = p.perm
);

-- Demo viewer: list/read only
INSERT INTO role_permissions (id, role_id, permission)
SELECT gen_random_uuid(), '10000000-0000-0000-0000-000000000004'::uuid, 'tasks:read'
WHERE EXISTS (SELECT 1 FROM roles r WHERE r.id = '10000000-0000-0000-0000-000000000004'::uuid AND r.deleted_at IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = '10000000-0000-0000-0000-000000000004'::uuid AND rp.permission = 'tasks:read'
  );

-- Test tenant manager: same tasks scope as demo manager (017)
INSERT INTO role_permissions (id, role_id, permission)
SELECT gen_random_uuid(), p.role_id, p.perm
FROM (VALUES
  ('10000000-0000-0000-0000-000000000012'::uuid, 'tasks:read'),
  ('10000000-0000-0000-0000-000000000012'::uuid, 'tasks:create'),
  ('10000000-0000-0000-0000-000000000012'::uuid, 'tasks:update'),
  ('10000000-0000-0000-0000-000000000012'::uuid, 'tasks:delete')
) AS p(role_id, perm)
JOIN roles r ON r.id = p.role_id AND r.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role_id = p.role_id AND rp.permission = p.perm
);

-- Test tenant viewer: read only
INSERT INTO role_permissions (id, role_id, permission)
SELECT gen_random_uuid(), '10000000-0000-0000-0000-000000000013'::uuid, 'tasks:read'
WHERE EXISTS (SELECT 1 FROM roles r WHERE r.id = '10000000-0000-0000-0000-000000000013'::uuid AND r.deleted_at IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = '10000000-0000-0000-0000-000000000013'::uuid AND rp.permission = 'tasks:read'
  );
