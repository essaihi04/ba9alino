import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { useSuperAdminStore } from '../store/superAdmin'
import { setCurrentOrg, clearCurrentOrg } from '../lib/withOrg'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleVirtualLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const normalizedName = String(name || '').trim().toLowerCase()
    const normalizedPassword = String(password || '')

    if (!normalizedName || !normalizedPassword) {
      setError('يرجى إدخال الاسم وكلمة المرور')
      return
    }

    // 0) SuperAdmin: try via superadmin_login RPC first
    try {
      const ok = await useSuperAdminStore.getState().login(normalizedName, normalizedPassword)
      if (ok) {
        clearCurrentOrg()
        navigate('/superadmin')
        return
      }
    } catch (_) {}

    try {
      // 1) Authenticate via auth service — single signInWithPassword call.
      //    The auth service internally tries virtual_login, then user_accounts.
      //    It returns a JWT with organization_id embedded so PostgREST RLS works.
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: `${normalizedName}@local`,
        password: normalizedPassword,
      })

      if (signInErr || !signInData?.user) {
        setError('الاسم أو كلمة المرور غير صحيحة')
        return
      }

      const user = signInData.user
      const meta = user.user_metadata || {}
      const role = String(meta.role || '').toLowerCase()
      const displayName = String(meta.name || normalizedName)
      const id = String(user.id || '')
      const employeeId = String(meta.employee_id || id)
      const orgId = String(meta.organization_id || '')

      console.log('Login result:', { role, displayName, id, employeeId, orgId })

      useAuthStore.setState({
        user: { id, email: user.email || `${displayName}@local`, user_metadata: meta },
        loading: false,
      })

      // Store org context in localStorage (used by inserts to inject organization_id)
      if (orgId) {
        try {
          const { data: orgRow } = await supabase
            .rpc('resolve_organization_for_user', { p_username: normalizedName })
          const r0 = Array.isArray(orgRow) ? orgRow[0] : orgRow
          setCurrentOrg({
            id: orgId,
            name: String(r0?.organization_name || ''),
            role,
          })
        } catch (_) {
          setCurrentOrg({ id: orgId, name: '', role })
        }
      }

      if (role === 'commercial') {
        localStorage.setItem('commercial_id', employeeId)
        localStorage.setItem('commercial_name', displayName)
        localStorage.setItem('commercial_role', 'commercial')
        navigate('/commercial/dashboard')
        return
      }

      if (role === 'employee') {
        // Prefer employee_id from JWT metadata; fallback to name/phone lookup
        try {
          let empData: any = null

          if (meta.employee_id) {
            const r = await supabase
              .from('employees')
              .select('id, name, phone')
              .eq('id', meta.employee_id)
              .maybeSingle()
            empData = r.data
          }

          if (!empData) {
            if (displayName.match(/^\d+$/)) {
              const r = await supabase.from('employees').select('id, name, phone').eq('phone', displayName).eq('status', 'active').single()
              empData = r.data
            }
            if (!empData) {
              const r = await supabase.from('employees').select('id, name, phone').eq('name', displayName).eq('status', 'active').single()
              empData = r.data
            }
          }

          const finalId = empData?.id || employeeId
          localStorage.setItem('employee_id', finalId)
          localStorage.setItem('employee_name', empData?.name || displayName)
          localStorage.setItem('employee_role', 'employee')
          localStorage.setItem('employee_phone', empData?.phone || displayName)
        } catch (_) {
          localStorage.setItem('employee_id', employeeId)
          localStorage.setItem('employee_name', displayName)
          localStorage.setItem('employee_role', 'employee')
          localStorage.setItem('employee_phone', displayName)
        }
        navigate('/employee/dashboard')
        return
      }

      navigate('/pos')
    } catch (err: any) {
      setError(err?.message || 'فشل تسجيل الدخول')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-2xl">
        {/* Role Selection Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full mb-4">
              <LogIn className="text-white" size={40} />
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Ba9alino</h1>
            <p className="text-gray-500">تسجيل الدخول (اسم + كلمة المرور)</p>
          </div>

          <form onSubmit={handleVirtualLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">الاسم</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition"
                placeholder="أدخل الاسم"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition"
                placeholder="••••••••"
                style={{ direction: 'ltr', textAlign: 'right' }}
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 rounded-lg hover:shadow-lg transition"
            >
              تسجيل الدخول
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
