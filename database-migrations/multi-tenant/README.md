# Multi-Tenant Migration (organization_id + RLS)

This folder contains the SQL migrations that turn Ba9alino into a multi-organization SaaS.

## Order of execution

Run in your Supabase SQL Editor **in order**, one file at a time. Verify the result of each step before moving to the next.

1. `001_create_organizations.sql` — creates `organizations`, `super_admins`, `organization_members`
2. `002_create_default_organization.sql` — inserts the default `Ba9alino` organization
3. `003_add_organization_id_to_tables.sql` — adds `organization_id UUID` (nullable) on all tenant tables
4. `004_backfill_default_organization.sql` — sets every existing row's `organization_id` to the Ba9alino default
5. `005_set_organization_id_not_null.sql` — sets `organization_id NOT NULL` + indexes
6. `006_rls_helpers.sql` — `current_org_id()`, `is_super_admin()`, `is_org_member()`
7. `007_rls_policies.sql` — enables RLS and creates policies on all tenant tables
8. `008_seed_super_admin.sql` — seeds the SuperAdmin (`zouhair` / `1989Gr@04`)
9. `009_link_existing_users_to_ba9alino.sql` — populates `organization_members` for existing `user_accounts`
10. `010_superadmin_rpcs.sql` — the SuperAdmin RPC functions used by the frontend

## Rollback

A `rollback.sql` file is provided. It disables RLS, drops the new tables and the `organization_id` columns. Use only on a non-production database.

## Notes

- The SuperAdmin password is hashed with bcrypt via `pgcrypto.crypt()` and stored in `super_admins.password_hash`. Change it after first login by updating that row.
- The SuperAdmin login does NOT go through Supabase Auth — it's a custom RPC `superadmin_login(username, password)` that returns a session token.
- Existing data is safe: it's all reassigned to the `Ba9alino` organization on step 4.
