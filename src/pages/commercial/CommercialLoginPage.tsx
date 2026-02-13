import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { User, Lock, AlertCircle } from 'lucide-react'

export default function CommercialLoginPage() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const username = String(phone || '').trim()
      if (!username) {
        setError('يرجى إدخال رقم الهاتف')
        setLoading(false)
        return
      }

      // Resolve email from user_accounts
      const { data: ua, error: uaErr } = await supabase
        .from('user_accounts')
        .select('email, role, employee_id, full_name, is_active')
        .eq('username', username)
        .limit(1)
        .maybeSingle()

      if (uaErr || !ua || !ua.email) {
        setError('رقم الهاتف أو كلمة المرور غير صحيحة')
        setLoading(false)
        return
      }

      if (!ua.is_active || ua.role !== 'commercial') {
        setError('هذا الحساب غير مفعل أو ليس حساب تجاري')
        setLoading(false)
        return
      }

      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: ua.email,
        password
      })

      if (signInErr || !signInData.user) {
        setError('رقم الهاتف أو كلمة المرور غير صحيحة')
        setLoading(false)
        return
      }

      if (ua.employee_id) {
        localStorage.setItem('commercial_id', ua.employee_id)

        // Fetch allowed price tiers from employee record
        const { data: empData } = await supabase
          .from('employees')
          .select('allowed_price_tiers')
          .eq('id', ua.employee_id)
          .maybeSingle()

        if (empData?.allowed_price_tiers && empData.allowed_price_tiers.length > 0) {
          localStorage.setItem('commercial_allowed_price_tiers', JSON.stringify(empData.allowed_price_tiers))
        } else {
          localStorage.removeItem('commercial_allowed_price_tiers')
        }
      }
      localStorage.setItem('commercial_name', ua.full_name || 'تاجر')
      localStorage.setItem('commercial_role', 'commercial')

      navigate('/commercial/dashboard')
    } catch (error) {
      console.error('Login error:', error)
      setError('حدث خطأ أثناء تسجيل الدخول')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo et titre */}
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="text-blue-600" size={40} />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Ba9alino</h1>
          <p className="text-gray-600">تسجيل دخول التجار</p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="text-red-600" size={20} />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              رقم الهاتف
            </label>
            <div className="relative">
              <User className="absolute right-3 top-3 text-gray-400" size={20} />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-right"
                placeholder="06xxxxxxxx"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              كلمة المرور
            </label>
            <div className="relative">
              <Lock className="absolute right-3 top-3 text-gray-400" size={20} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none text-right"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'جاري التحميل...' : 'تسجيل الدخول'}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Ba9alino © 2026
          </p>
        </div>
      </div>
    </div>
  )
}
