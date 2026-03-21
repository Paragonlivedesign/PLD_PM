-- RBAC: vendors:create and vendors:delete for tenant admin role (matches clients:* pattern on role 000002)

INSERT INTO role_permissions (id, role_id, permission)
SELECT gen_random_uuid(), p.role_id, p.perm
FROM (VALUES
  ('10000000-0000-0000-0000-000000000002'::uuid, 'vendors:create'),
  ('10000000-0000-0000-0000-000000000002', 'vendors:delete')
) AS p(role_id, perm)
JOIN roles role_row ON role_row.id = p.role_id AND role_row.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  WHERE rp.role_id = p.role_id AND rp.permission = p.perm
);
