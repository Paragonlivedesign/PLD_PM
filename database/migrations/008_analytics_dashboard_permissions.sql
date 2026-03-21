-- Grant operations dashboard read to tenant roles that do not already have '*' or this permission.

INSERT INTO role_permissions (id, role_id, permission)
SELECT gen_random_uuid(), r.id, 'analytics:dashboard:read'
FROM roles r
WHERE r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND (rp.permission = '*' OR rp.permission = 'analytics:dashboard:read')
  );
