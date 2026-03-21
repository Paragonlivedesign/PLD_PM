-- GET /api/v1/tenant returns full settings only with tenancy.settings.view (or *).
-- PUT /api/v1/tenant requires tenancy.settings.edit.

INSERT INTO role_permissions (id, role_id, permission)
VALUES
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', 'tenancy.settings.view'),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', 'tenancy.settings.edit'),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000003', 'tenancy.settings.view'),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000004', 'tenancy.settings.view')
ON CONFLICT (role_id, permission) DO NOTHING;
