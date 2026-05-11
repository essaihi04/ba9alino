-- ============================================================================
-- 001 — Core multi-tenant tables
-- Creates: organizations, super_admins, organization_members
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  plan            TEXT NOT NULL DEFAULT 'free',
  contact_email   TEXT,
  contact_phone   TEXT,
  address         TEXT,
  settings        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug      ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations(is_active);

-- Only one default org allowed
CREATE UNIQUE INDEX IF NOT EXISTS uniq_organizations_one_default
  ON organizations((is_default))
  WHERE is_default = TRUE;

-- ---------------------------------------------------------------------------
-- super_admins (global, not tied to any organization)
-- Stores its own bcrypt password (custom auth, NOT Supabase auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS super_admins (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username       TEXT NOT NULL UNIQUE,
  full_name      TEXT,
  password_hash  TEXT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_super_admins_username ON super_admins(username);

-- ---------------------------------------------------------------------------
-- organization_members
-- Links a Supabase auth user (or a virtual_account / user_account) to an org,
-- with a role inside that org.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID,                  -- auth.users.id when available
  user_account_id UUID,                  -- user_accounts.id (legacy/non-auth)
  username        TEXT,                  -- denormalized for fast lookup
  role            TEXT NOT NULL CHECK (role IN ('admin', 'employee', 'commercial', 'stock')),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id          ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id         ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_account_id ON organization_members(user_account_id);
CREATE INDEX IF NOT EXISTS idx_org_members_username        ON organization_members(LOWER(username));

-- Prevent duplicate membership (same user, same org)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_org_members_user_org
  ON organization_members(organization_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_org_members_account_org
  ON organization_members(organization_id, user_account_id)
  WHERE user_account_id IS NOT NULL;
