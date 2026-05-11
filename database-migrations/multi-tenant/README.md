# Multi-Tenant Migration (organization_id + RLS)

This folder contains the SQL migrations that turn Ba9alino into a multi-organization SaaS. **Designed for the self-hosted Postgres + PostgREST + custom auth-service stack** (NOT Supabase Cloud).

## Quick install (recommended)

On the server where the `ba9alino` Postgres database runs:

```bash
cd /path/to/admin-app/database-migrations/multi-tenant
bash install.sh
```

The script applies migrations `001-004`, `006`, `008-010` (skips `005` and `007` — see "Enforcing isolation" below). It also reloads the PostgREST schema cache via `NOTIFY pgrst, 'reload schema';`.

## Manual install

Run with `psql -h localhost -U ba9alino_admin -d ba9alino -f <file>.sql` in this order:

1. `001_create_organizations.sql` — creates `organizations`, `super_admins`, `organization_members`
2. `002_create_default_organization.sql` — inserts the default `Ba9alino` organization
3. `003_add_organization_id_to_tables.sql` — adds `organization_id UUID` (nullable) on all tenant tables
4. `004_backfill_default_organization.sql` — sets every existing row's `organization_id` to the Ba9alino default
5. `006_rls_helpers.sql` — `current_org_id()`, `is_super_admin()`, `is_org_member()`, `set_app_organization_id(uuid)`
6. `008_seed_super_admin.sql` — seeds the SuperAdmin (`zouhair` / `1989Gr@04`)
7. `009_link_existing_users_to_ba9alino.sql` — populates `organization_members` for existing `user_accounts` / `virtual_accounts`
8. `010_superadmin_rpcs.sql` — the SuperAdmin RPC functions used by the frontend

After running them, **reload PostgREST**:
```sql
NOTIFY pgrst, 'reload schema';
```
(Or restart the PostgREST service.)

## Enforcing isolation (later step)

Once the application code has been updated to inject `organization_id` in all inserts:

- `005_set_organization_id_not_null.sql` — locks `organization_id NOT NULL` + adds indexes
- `007_rls_policies.sql` — enables Row-Level Security and tenant isolation policies

⚠️ Do **NOT** run these two until the app code injects `organization_id` everywhere, otherwise inserts will start failing.

## How RLS context is set

This stack uses **PostgREST** with a custom auth-service JWT (not Supabase GoTrue). RLS reads the organization from two possible sources:

1. Session GUC `app.organization_id` — set explicitly by the frontend via the RPC `set_app_organization_id(uuid)` before queries
2. PostgREST JWT claim `request.jwt.claims->>'sub'` → lookup in `organization_members.user_id` / `user_account_id`

The frontend's `localStorage.organization_id` (set in `withOrg.ts`) is the source of truth client-side. To propagate it server-side under RLS, call `set_app_organization_id` at the start of each session — or include it in the JWT payload of the auth-service.

## Rollback

```bash
psql -h localhost -U ba9alino_admin -d ba9alino -f rollback.sql
```

⚠️ Drops the new tables and the `organization_id` columns. Non-reversible.

## Notes

- The SuperAdmin password is hashed with bcrypt via `pgcrypto.crypt()` and stored in `super_admins.password_hash`. Change it later with:
  ```sql
  UPDATE super_admins SET password_hash = crypt('NEW_PASSWORD', gen_salt('bf', 12)) WHERE username = 'zouhair';
  ```
- Existing data is safe: every row is reassigned to the `Ba9alino` organization in step 4.
- All RPCs are granted to `PUBLIC` (no Supabase roles like `authenticated`/`anon` in this stack).
