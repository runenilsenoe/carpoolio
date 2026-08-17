#!/bin/bash
# Applies every SQL file in supabase/migrations (alphabetical = chronological)
# on first database boot. Runs only when the data volume is empty.
set -euo pipefail

shopt -s nullglob
files=(/supabase-migrations/*.sql)

if [ ${#files[@]} -eq 0 ]; then
  echo "[carpoolio] no migrations found in /supabase-migrations"
  exit 0
fi

for f in "${files[@]}"; do
  echo "[carpoolio] applying migration $(basename "$f")"
  psql -v ON_ERROR_STOP=1 --username postgres --dbname "${POSTGRES_DB:-postgres}" -f "$f"
done

echo "[carpoolio] all migrations applied"
