#!/bin/bash
# Creates (or repairs) the Supabase service roles and gives them the shared
# POSTGRES_PASSWORD. The supabase/postgres image already ships most of these;
# this script is idempotent and only guarantees they exist with a password.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "postgres" --dbname "${POSTGRES_DB:-postgres}" <<-EOSQL
  DO \$\$
  DECLARE
    r text;
    pw text := '${POSTGRES_PASSWORD}';
  BEGIN
    FOREACH r IN ARRAY ARRAY[
      'anon','authenticated','service_role','authenticator',
      'supabase_admin','supabase_auth_admin','supabase_storage_admin',
      'supabase_realtime_admin','dashboard_user'
    ] LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
        EXECUTE format('CREATE ROLE %I NOLOGIN NOINHERIT', r);
      END IF;
    END LOOP;

    -- Login roles need the password.
    FOREACH r IN ARRAY ARRAY[
      'authenticator','supabase_admin','supabase_auth_admin',
      'supabase_storage_admin','supabase_realtime_admin'
    ] LOOP
      EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', r, pw);
    END LOOP;

    EXECUTE 'ALTER ROLE supabase_admin WITH SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS';
    EXECUTE 'ALTER ROLE supabase_auth_admin WITH CREATEROLE NOINHERIT';
    EXECUTE 'ALTER ROLE supabase_storage_admin WITH CREATEROLE NOINHERIT';
    EXECUTE 'ALTER ROLE supabase_realtime_admin WITH NOINHERIT';
    EXECUTE 'ALTER ROLE authenticator WITH NOINHERIT';
    EXECUTE 'GRANT anon, authenticated, service_role TO authenticator';
    EXECUTE 'GRANT supabase_admin TO postgres';
  END
  \$\$;

  ALTER DATABASE ${POSTGRES_DB:-postgres} SET "app.settings.jwt_secret" TO '${JWT_SECRET}';
  ALTER DATABASE ${POSTGRES_DB:-postgres} SET "app.settings.jwt_exp" TO 3600;
EOSQL
