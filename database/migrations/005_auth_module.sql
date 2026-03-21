-- Wave 0: Auth — tenants registry, users, tokens, RBAC, field visibility

-- Aligned with tenancy module (status, settings)
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  slug VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_tenants_slug ON tenants (lower(slug));

CREATE TABLE roles (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name VARCHAR(64) NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_roles_tenant_name
  ON roles (tenant_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX idx_roles_tenant ON roles (tenant_id) WHERE deleted_at IS NULL;

CREATE TABLE role_permissions (
  id UUID PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  permission VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_role_permission UNIQUE (role_id, permission)
);

CREATE INDEX idx_role_permissions_role ON role_permissions (role_id);

CREATE TABLE users (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES roles (id),
  personnel_id UUID REFERENCES personnel (id) ON DELETE SET NULL,
  first_name VARCHAR(100) NOT NULL DEFAULT '',
  last_name VARCHAR(100) NOT NULL DEFAULT '',
  phone VARCHAR(50),
  preferences JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_users_tenant_email
  ON users (tenant_id, lower(email))
  WHERE deleted_at IS NULL;

CREATE INDEX idx_users_tenant ON users (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_personnel ON users (personnel_id) WHERE deleted_at IS NULL;

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  family_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash)
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id);

CREATE TABLE auth_invitations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role_id UUID NOT NULL REFERENCES roles (id),
  invited_by UUID NOT NULL REFERENCES users (id),
  personnel_id UUID REFERENCES personnel (id) ON DELETE SET NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_auth_invitations_token UNIQUE (token_hash)
);

CREATE INDEX idx_auth_invitations_tenant_email
  ON auth_invitations (tenant_id, lower(email));
CREATE INDEX idx_auth_invitations_tenant_status ON auth_invitations (tenant_id, status);

CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_password_reset_token_hash UNIQUE (token_hash)
);

CREATE INDEX idx_password_reset_user ON password_reset_tokens (user_id);

CREATE TABLE field_visibility_rules (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  entity_type VARCHAR(100) NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  min_role VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_field_visibility_tenant_entity
  ON field_visibility_rules (tenant_id, entity_type);

-- Seed default tenant (matches dev headers in middleware/context.ts)
INSERT INTO tenants (id, slug, name, status, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo',
  'Demo Tenant',
  'active',
  '{}'
);

-- System roles for demo tenant (IDs deterministic for seeds / tests)
INSERT INTO roles (id, tenant_id, name, is_system)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin', TRUE),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'manager', TRUE),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'coordinator', TRUE),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'viewer', TRUE);

-- Permissions: admin = wildcard; others get module-style strings used by requirePermission
INSERT INTO role_permissions (id, role_id, permission)
VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '*');

INSERT INTO role_permissions (id, role_id, permission)
VALUES
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', 'personnel:create'),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', 'personnel:read'),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', 'events:read'),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', 'trucks:create'),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', 'scheduling:create'),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', 'auth.invitations.manage');

INSERT INTO role_permissions (id, role_id, permission)
VALUES
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000003', 'personnel:read'),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000003', 'events:read'),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000003', 'scheduling:create');

INSERT INTO role_permissions (id, role_id, permission)
VALUES
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000004', 'personnel:read'),
  (gen_random_uuid(), '10000000-0000-0000-0000-000000000004', 'events:read');

-- Dev user: password "password" (bcrypt) — only for local/testing; rotate in real deploys
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
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'admin@demo.local',
  '$2b$12$JsaixFG/Bwrvx1Y8W9GK/ePieEEGvY93rOqA82jMTBqf73O/UKENm', -- "password"
  '10000000-0000-0000-0000-000000000001',
  'Dev',
  'Admin',
  TRUE
);
