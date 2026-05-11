/**
 * Multi-tenant helpers: read the current user's organization_id from
 * localStorage and inject it into Supabase insert payloads.
 *
 * The login flow stores `organization_id` in localStorage after a successful
 * sign-in. RLS still enforces isolation server-side, but adding it explicitly
 * to inserts is required (NOT NULL column).
 */

const ORG_KEY = 'organization_id'
const ORG_NAME_KEY = 'organization_name'
const ORG_ROLE_KEY = 'organization_role'

export function getCurrentOrgId(): string | null {
  try {
    const v = localStorage.getItem(ORG_KEY)
    return v && v.length > 0 ? v : null
  } catch {
    return null
  }
}

export function getCurrentOrgName(): string | null {
  try {
    return localStorage.getItem(ORG_NAME_KEY)
  } catch {
    return null
  }
}

export function getCurrentOrgRole(): string | null {
  try {
    return localStorage.getItem(ORG_ROLE_KEY)
  } catch {
    return null
  }
}

export function setCurrentOrg(opts: { id: string; name?: string; role?: string }) {
  try {
    localStorage.setItem(ORG_KEY, opts.id)
    if (opts.name !== undefined) localStorage.setItem(ORG_NAME_KEY, opts.name)
    if (opts.role !== undefined) localStorage.setItem(ORG_ROLE_KEY, opts.role)
  } catch {}
}

export function clearCurrentOrg() {
  try {
    localStorage.removeItem(ORG_KEY)
    localStorage.removeItem(ORG_NAME_KEY)
    localStorage.removeItem(ORG_ROLE_KEY)
  } catch {}
}

/**
 * Inject organization_id into an insert payload.
 * Usage:
 *   await supabase.from('products').insert(withOrg({ name: 'X' }))
 */
export function withOrg<T extends Record<string, any>>(payload: T): T & { organization_id: string } {
  const orgId = getCurrentOrgId()
  if (!orgId) {
    throw new Error('withOrg: no organization_id in localStorage. User must be logged in.')
  }
  return { ...payload, organization_id: orgId }
}

/**
 * Same as withOrg but for an array (bulk insert).
 */
export function withOrgAll<T extends Record<string, any>>(payloads: T[]): (T & { organization_id: string })[] {
  const orgId = getCurrentOrgId()
  if (!orgId) {
    throw new Error('withOrgAll: no organization_id in localStorage. User must be logged in.')
  }
  return payloads.map(p => ({ ...p, organization_id: orgId }))
}
