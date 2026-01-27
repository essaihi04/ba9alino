import { create } from 'zustand'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: any | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,

  login: async (email: string, password: string) => {
    set({ loading: true, error: null })
    try {
      let loginEmail = String(email || '').trim()

      // Allow login with username/phone by resolving it to an email from user_accounts
      if (loginEmail && !loginEmail.includes('@')) {
        const { data: ua, error: uaError } = await supabase
          .from('user_accounts')
          .select('email')
          .eq('username', loginEmail)
          .limit(1)
          .maybeSingle()

        if (!uaError && ua?.email) {
          loginEmail = ua.email
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      })
      if (error) throw error
      set({ user: data.user, loading: false })
    } catch (error: any) {
      set({ error: error.message, loading: false })
      throw error
    }
  },

  logout: async () => {
    set({ loading: true })
    try {
      await supabase.auth.signOut()
      set({ user: null, loading: false })
    } catch (error: any) {
      set({ error: error.message, loading: false })
    }
  },

  checkAuth: async () => {
    set({ loading: true })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      set({ user: session?.user || null, loading: false })
    } catch (error: any) {
      set({ error: error.message, loading: false })
    }
  },
}))
