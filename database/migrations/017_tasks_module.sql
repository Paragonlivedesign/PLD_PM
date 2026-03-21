-- Tenant-scoped tasks (roadmap / todo); optional link to events and personnel assignee.

CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  priority VARCHAR(16) NOT NULL DEFAULT 'normal',
  task_type VARCHAR(32) NOT NULL DEFAULT 'task',
  event_id UUID REFERENCES events (id) ON DELETE SET NULL,
  assignee_personnel_id UUID REFERENCES personnel (id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES tasks (id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  completion_percent SMALLINT,
  tags JSONB NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_tasks_status CHECK (status IN ('open', 'in_progress', 'blocked', 'done', 'cancelled')),
  CONSTRAINT chk_tasks_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT chk_tasks_type CHECK (task_type IN ('task', 'milestone', 'checklist')),
  CONSTRAINT chk_tasks_completion CHECK (
    completion_percent IS NULL OR (completion_percent >= 0 AND completion_percent <= 100)
  )
);

CREATE INDEX idx_tasks_tenant ON tasks (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_tenant_status ON tasks (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_tenant_due ON tasks (tenant_id, due_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_event ON tasks (tenant_id, event_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_assignee ON tasks (tenant_id, assignee_personnel_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_parent ON tasks (tenant_id, parent_task_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_tags ON tasks USING GIN (tags);
CREATE INDEX idx_tasks_metadata ON tasks USING GIN (metadata);

-- RBAC: tenant admin role — full tasks permissions (same pattern as vendors 016)
INSERT INTO role_permissions (id, role_id, permission)
SELECT gen_random_uuid(), p.role_id, p.perm
FROM (VALUES
  ('10000000-0000-0000-0000-000000000002'::uuid, 'tasks:read'),
  ('10000000-0000-0000-0000-000000000002', 'tasks:create'),
  ('10000000-0000-0000-0000-000000000002', 'tasks:update'),
  ('10000000-0000-0000-0000-000000000002', 'tasks:delete')
) AS p(role_id, perm)
JOIN roles role_row ON role_row.id = p.role_id AND role_row.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  WHERE rp.role_id = p.role_id AND rp.permission = p.perm
);
