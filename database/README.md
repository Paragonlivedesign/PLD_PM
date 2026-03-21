# Database

- `migrations/` — ordered SQL or tool-specific migrations (Foundation Agent owns sequencing).
  - `001_init_events_clients_venues.sql` — core tenant tables
  - `002_personnel_departments_invitations.sql` — personnel, departments, invitations
  - (see folder for financial, documents, scheduling, auth, etc.)
  - `005_auth_module.sql` — `tenants` (aligned with tenancy module), `users`, `roles`, refresh tokens, auth invitations, password reset, field visibility rules (empty)
- `seeds/` — development seed data.

Run Postgres locally via root `docker compose up -d`.

### Native Windows PostgreSQL (no Docker)

After [EnterpriseDB](https://www.postgresql.org/download/windows/) install, the service is usually `postgresql-x64-17` on port **5432**.

1. **Create app user + database** (password for user `postgres` is the one you set in the installer):

   ```powershell
   cd "C:\Users\codya\Desktop\PLD_PM"
   $env:PGPASSWORD = "YOUR_POSTGRES_SUPERUSER_PASSWORD"
   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -f database/bootstrap-windows-pld.sql
   ```

   If `CREATE ROLE` fails because `pld` already exists, run only the `CREATE DATABASE` line manually (or create `pld_dev` in pgAdmin).

2. **Apply migrations** (from repo root):

   ```powershell
   $env:DATABASE_URL = "postgresql://pld:pld@localhost:5432/pld_dev"
   npm run db:migrate
   ```

Adjust the `psql.exe` path if you installed a different major version than 17.

Apply migrations:

```bash
npm run db:migrate
```

Migrations are recorded in `schema_migrations`; running `db:migrate` again only applies **new** `.sql` files. If your database was created before that tracker existed and already has tables, the first run **baselines** all current migration filenames (no duplicate `CREATE TABLE` errors). For a truly empty database, use a fresh `pld_dev` (drop/create) if you prefer a clean slate.

Or with `psql` (individual files):

```bash
psql "$DATABASE_URL" -f database/migrations/001_init_events_clients_venues.sql
psql "$DATABASE_URL" -f database/migrations/002_custom_fields.sql
```
