#!/bin/bash
# Apply multi-tenant migrations to the local ba9alino Postgres database.
# Run as a user that has access (e.g. ba9alino_admin or postgres).
#
# Usage on the production server:
#   cd /path/to/database-migrations/multi-tenant
#   bash install.sh
#
# It executes 001 -> 010 except 005 and 007 (kept manual — see README).

set -euo pipefail

DB_NAME="${DB_NAME:-ba9alino}"
DB_USER="${DB_USER:-ba9alino_admin}"
PGPASSWORD="${PGPASSWORD:-Ba9alinoAdmin2024!}"
export PGPASSWORD

PSQL="psql -h localhost -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Initial install: skip 005 (NOT NULL) and 007 (RLS enable) — those require
# the application code to be updated first. Run them manually afterwards.
FILES=(
  "001_create_organizations.sql"
  "002_create_default_organization.sql"
  "003_add_organization_id_to_tables.sql"
  "004_backfill_default_organization.sql"
  "006_rls_helpers.sql"
  "008_seed_super_admin.sql"
  "009_link_existing_users_to_ba9alino.sql"
  "010_superadmin_rpcs.sql"
)

for f in "${FILES[@]}"; do
  echo
  echo "============================================================"
  echo "Applying $f"
  echo "============================================================"
  $PSQL -f "$DIR/$f"
done

echo
echo "============================================================"
echo "Reloading PostgREST schema cache"
echo "============================================================"
$PSQL -c "NOTIFY pgrst, 'reload schema';" || true

echo
echo "✅ Multi-tenant install OK"
echo "   - SuperAdmin: zouhair / 1989Gr@04"
echo "   - Default org: Ba9alino (existing data preserved)"
echo
echo "When you're ready to enforce isolation:"
echo "  1) Update inserts in the app to include organization_id (use withOrg helper)"
echo "  2) Run: psql ... -f 005_set_organization_id_not_null.sql"
echo "  3) Run: psql ... -f 007_rls_policies.sql"
