-- Grant personnel edit + document upload to non-admin roles that already manage roster/scheduling.
-- Fixes: PUT /personnel/:id required personnel:update but only admin (*) had it in seed 005.

INSERT INTO role_permissions (id, role_id, permission)
VALUES
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', 'personnel:update'),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', 'personnel:delete'),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', 'documents:upload'),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000003', 'personnel:update'),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000003', 'documents:upload')
ON CONFLICT (role_id, permission) DO NOTHING;
