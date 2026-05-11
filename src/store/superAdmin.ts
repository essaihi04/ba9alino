import { create } from 'zustand'
import { supabase } from '../lib/supabase'

interface SuperAdminState {
  superAdminId: string | null
  username: string | null
  fullName: string | null
  password: string | null  // kept in memory + sessionStorage to authorize subsequent RPC calls
  loading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  hydrate: () => void
}

const SS_KEY = 'superadmin_session'

export const useSuperAdminStore = create<SuperAdminState>((set) => ({
  superAdminId: null,
  username: null,
  fullName: null,
  password: null,
  loading: false,
  error: null,

  login: async (username: string, password: string) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase.rpc('superadmin_login', {
        p_username: username,
        p_password: password,
      })
      if (error) throw error
      const ok = Boolean((data as any)?.success)
      if (!ok) {
        set({ loading: false, error: 'invalid_credentials' })
        return false
      }
      const session = {
        superAdminId: String((data as any).super_admin_id),
        username: String((data as any).username),
        fullName: String((data as any).full_name || ''),
        password,
      }
      try { sessionStorage.setItem(SS_KEY, JSON.stringify(session)) } catch {}
      set({ ...session, loading: false, error: null })
      return true
    } catch (e: any) {
      set({ loading: false, error: e?.message || 'login_failed' })
      return false
    }
  },

  logout: () => {
    try { sessionStorage.removeItem(SS_KEY) } catch {}
    set({ superAdminId: null, username: null, fullName: null, password: null, error: null })
  },

  hydrate: () => {
    try {
      const raw = sessionStorage.getItem(SS_KEY)
      if (!raw) return
      const s = JSON.parse(raw)
      if (s?.superAdminId && s?.username && s?.password) {
        set({
          superAdminId: s.superAdminId,
          username: s.username,
          fullName: s.fullName || '',
          password: s.password,
        })
      }
    } catch {}
  },
}))

// Helper to grab current SuperAdmin credentials for RPC calls.
export const getSuperAdminCreds = (): { p_username: string; p_password: string } | null => {
  const s = useSuperAdminStore.getState()
  if (!s.username || !s.password) return null
  return { p_username: s.username, p_password: s.password }
}
