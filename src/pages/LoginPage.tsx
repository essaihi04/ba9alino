import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const ADMIN_NAME = 'admin'
  const ADMIN_PASSWORD = 'admin123'

  const handleVirtualLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const normalizedName = String(name || '').trim().toLowerCase()
    const normalizedPassword = String(password || '')

    if (!normalizedName || !normalizedPassword) {
      setError('يرجى إدخال الاسم وكلمة المرور')
      return
    }

    if (normalizedName === ADMIN_NAME) {
      if (normalizedPassword !== ADMIN_PASSWORD) {
        setError('كلمة المرور غير صحيحة')
        return
      }

      useAuthStore.setState({ user: { id: 'virtual-admin', email: 'admin@local', user_metadata: { role: 'admin', name: 'admin' } }, loading: false })
      navigate('/')
      return
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('virtual_login', {
        p_name: normalizedName,
        p_password: normalizedPassword,
      })
      if (rpcError) throw rpcError

      const row = Array.isArray(data) ? data[0] : null
      if (!row) {
        setError('الاسم أو كلمة المرور غير صحيحة')
        return
      }

      const role = String((row as any)?.role || '').toLowerCase()
      const displayName = String((row as any)?.name || normalizedName)
      const id = String((row as any)?.id || '')

      console.log('Login result:', { role, displayName, id, row })

      useAuthStore.setState({ user: { id, email: `${displayName}@local`, user_metadata: { role, name: displayName } }, loading: false })

      if (role === 'commercial') {
        localStorage.setItem('commercial_id', id)
        localStorage.setItem('commercial_name', displayName)
        localStorage.setItem('commercial_role', 'commercial')
        navigate('/commercial/dashboard')
        return
      }

      if (role === 'employee') {
        // Récupérer le vrai employee_id depuis la table employees
        try {
          let employeeData = null
          let employeeError = null
          
          // Essayer d'abord par téléphone si displayName ressemble à un numéro
          if (displayName.match(/^\d+$/)) {
            const result = await supabase
              .from('employees')
              .select('id, name, phone')
              .eq('phone', displayName)
              .eq('status', 'active')
              .single()
            employeeData = result.data
            employeeError = result.error
          }
          
          // Si ça ne marche pas, essayer par nom
          if (employeeError || !employeeData) {
            const result = await supabase
              .from('employees')
              .select('id, name, phone')
              .eq('name', displayName)
              .eq('status', 'active')
              .single()
            employeeData = result.data
            employeeError = result.error
          }
          
          console.log('Employee lookup result:', { employeeData, employeeError, displayName })
          
          if (!employeeError && employeeData) {
            localStorage.setItem('employee_id', employeeData.id)
            localStorage.setItem('employee_name', employeeData.name)
            localStorage.setItem('employee_role', 'employee')
            localStorage.setItem('employee_phone', employeeData.phone || displayName)
            navigate('/employee/dashboard')
            return
          } else {
            // Si l'employé n'existe pas dans employees, utiliser virtual_account_id
            console.log('Employee not found in employees table, using virtual_account_id as fallback')
            localStorage.setItem('employee_id', id) // id est virtual_account_id
            localStorage.setItem('employee_name', displayName)
            localStorage.setItem('employee_role', 'employee')
            localStorage.setItem('employee_phone', displayName)
            navigate('/employee/dashboard')
            return
          }
        } catch (err) {
          console.error('Error fetching employee data:', err)
          // Fallback si la recherche échoue
          localStorage.setItem('employee_id', id)
          localStorage.setItem('employee_name', displayName)
          localStorage.setItem('employee_role', 'employee')
          navigate('/employee/dashboard')
          return
        }
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
