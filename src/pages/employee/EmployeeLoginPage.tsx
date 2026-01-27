import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { LogIn, AlertCircle } from 'lucide-react'

export default function EmployeeLoginPage() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Nettoyer le localStorage au chargement pour éviter les anciens IDs invalides
  useEffect(() => {
    localStorage.removeItem('employee_id')
    localStorage.removeItem('employee_name')
    localStorage.removeItem('employee_role')
    localStorage.removeItem('employee_phone')
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data, error: queryError } = await supabase
        .from('employees')
        .select('id, name, phone, role, status')
        .eq('phone', phone)
        .eq('password_hash', password)
        .in('role', ['stock', 'admin', 'commercial'])
        .eq('status', 'active')
        .single()

      if (queryError || !data) {
        setError('رقم الهاتف أو كلمة المرور غير صحيحة')
        setLoading(false)
        return
      }

      localStorage.setItem('employee_id', data.id)
      localStorage.setItem('employee_name', data.name)
      localStorage.setItem('employee_role', data.role)
      localStorage.setItem('employee_phone', data.phone)

      navigate('/employee/dashboard')
    } catch (err) {
      setError('حدث خطأ أثناء تسجيل الدخول')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogIn className="text-blue-600" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Ba9alino</h1>
          <p className="text-gray-600 mt-2">تسجيل دخول الموظف (مخزن/كاشير)</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
            <div className="flex items-center gap-2">
              <AlertCircle className="text-red-600" size={20} />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              رقم الهاتف
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              placeholder="0612345678"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              كلمة المرور
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors disabled:bg-gray-400"
          >
            {loading ? 'جاري التحميل...' : 'دخول'}
          </button>
        </form>

        <p className="text-center text-gray-600 text-sm mt-6">
          نسخة الموظف - مخزن وكاشير
        </p>
      </div>
    </div>
  )
}
