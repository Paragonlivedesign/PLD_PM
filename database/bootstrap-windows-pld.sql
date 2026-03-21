-- One-time setup for native Windows PostgreSQL (matches docker-compose / .env.example).
-- Run as the superuser you created during install (usually "postgres"):
--
--   $env:PGPASSWORD = "YOUR_POSTGRES_SUPERUSER_PASSWORD"
--   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -f database/bootstrap-windows-pld.sql
--
-- If "pld_dev" already exists, the second statement errors — safe to ignore or run only the DO block.

DO $outer$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pld') THEN
    CREATE ROLE pld WITH LOGIN PASSWORD 'pld' CREATEDB;
  END IF;
END
$outer$;

CREATE DATABASE pld_dev OWNER pld;
