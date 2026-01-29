import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2, Eye, EyeOff, Key, User, Users, Briefcase } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface UserAccount {
  id: string
  username: string
  email: string
  full_name: string
  role: 'admin' | 'employee' | 'commercial'
  employee_id?: string
  is_active: boolean
  created_at?: string
  last_login?: string
}

export default function UserAccountsPage() {
  const [users, setUsers] = useState<UserAccount[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [virtualAccounts, setVirtualAccounts] = useState<Array<{ id: string; name: string; role: 'employee' | 'commercial'; is_active: boolean; created_at: string; employee_id?: string }>>([])
  const [virtualForm, setVirtualForm] = useState<{ name: string; password: string; role: 'employee' | 'commercial'; employee_id?: string }>({
    name: '',
    password: '',
    role: 'employee',
    employee_id: ''
  })
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'employee' as 'admin' | 'employee' | 'commercial',
    employee_id: '',
    is_active: true
  })

  const generateSimplePassword = (source?: string) => {
    const s = String(source || '').replace(/\D/g, '')
    if (s.length >= 6) return s.slice(-6)
    const rnd = Math.floor(100000 + Math.random() * 900000)
    return String(rnd)
  }

  const makeSystemEmail = (username: string) => {
    const u = String(username || '').trim().toLowerCase()
    if (!u) return ''
    if (u.includes('@')) return u
    // Use custom domain that Supabase accepts
    return `${u}@ba9alino.app`
  }

  useEffect(() => {
    fetchUsers()
    fetchEmployees()
    fetchVirtualAccounts()
  }, [])

  const ADMIN_PASSWORD = 'admin123'

  const fetchVirtualAccounts = async () => {
    try {
      const { data, error } = await supabase.rpc('virtual_list_accounts', { p_admin_password: ADMIN_PASSWORD })
      if (error) throw error
      setVirtualAccounts(Array.isArray(data) ? (data as any) : [])
    } catch (e) {
      console.error('Error fetching virtual accounts:', e)
      setVirtualAccounts([])
    }
  }

  const createVirtualAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = String(virtualForm.name || '').trim()
    const p = String(virtualForm.password || '')
    if (!n || !p) {
      alert('يرجى إدخال الاسم وكلمة المرور')
      return
    }

    try {
      const { data, error } = await supabase.rpc('virtual_create_account', {
        p_admin_password: ADMIN_PASSWORD,
        p_name: n,
        p_password: p,
        p_role: virtualForm.role,
        p_employee_id: virtualForm.employee_id || null,
      })
      if (error) throw error

      const ok = Boolean((data as any)?.success)
      if (!ok) {
        const msg = String((data as any)?.error || 'failed')
        if (msg === 'name_exists') {
          alert('هذا الاسم موجود بالفعل')
          return
        }
        alert('Erreur: ' + msg)
        return
      }

      setVirtualForm({ name: '', password: '', role: 'employee' })
      await fetchVirtualAccounts()
      alert('تم إنشاء الحساب بنجاح')
    } catch (e: any) {
      alert('Erreur: ' + (e?.message || 'failed'))
    }
  }

  const deleteVirtualAccount = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الحساب؟')) return
    try {
      const { data, error } = await supabase.rpc('virtual_delete_account', { p_admin_password: ADMIN_PASSWORD, p_id: id })
      if (error) throw error
      const ok = Boolean((data as any)?.success)
      if (!ok) {
        alert('Erreur: ' + String((data as any)?.error || 'failed'))
        return
      }
      await fetchVirtualAccounts()
    } catch (e: any) {
      alert('Erreur: ' + (e?.message || 'failed'))
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('user_accounts')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!showModal) return
    if (editingUser) return

    if (formData.role !== 'admin' && formData.employee_id) {
      const emp = employees.find((e) => e.id === formData.employee_id)
      if (!emp) return

      setFormData((prev) => {
        const nextUsername = prev.username || String(emp.phone || '').trim()
        const nextEmail = prev.email || makeSystemEmail(nextUsername)
        const nextFullName = prev.full_name || String(emp.name || '').trim()
        const nextPassword = prev.password || generateSimplePassword(nextUsername)
        return {
          ...prev,
          username: nextUsername,
          email: nextEmail,
          full_name: nextFullName,
          password: nextPassword,
        }
      })
    }
  }, [employees, formData.employee_id, formData.role, editingUser, showModal])

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, phone')
        .eq('status', 'active')
        .order('name')
      
      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingUser) {
        // Update existing user
        const userData = {
          username: formData.username,
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          employee_id: formData.role !== 'admin' && formData.employee_id ? formData.employee_id : null,
          is_active: formData.is_active
        }

        const { error } = await supabase
          .from('user_accounts')
          .update(userData)
          .eq('id', editingUser)
        
        if (error) throw error
        
        // Update password if provided
        if (formData.password) {
          alert('تم تحديث بيانات المستخدم. يجب تحديث كلمة المرور يدوياً من خلال الإعدادات.')
        }
        
        alert('تم تحديث المستخدم بنجاح')
      } else {
        if (formData.role !== 'admin' && !formData.employee_id) {
          alert('يرجى اختيار الموظف المرتبط')
          return
        }

        const email = makeSystemEmail(formData.email || formData.username)
        const password = formData.password || generateSimplePassword(formData.username)

        // Use RPC instead of Supabase Auth API
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          'create_user_account_fallback',
          {
            p_email: email,
            p_password: password,
            p_username: formData.username,
            p_full_name: formData.full_name,
            p_role: formData.role,
            p_employee_id: formData.role !== 'admin' ? (formData.employee_id || null) : null,
            p_is_active: formData.is_active
          }
        )

        if (rpcError) {
          throw new Error(rpcError.message || 'Failed to create user')
        }

        const ok = Boolean((rpcData as any)?.success)
        if (!ok) {
          const msg = String((rpcData as any)?.error || (rpcData as any)?.message || 'Failed to create user')
          throw new Error(msg)
        }

        alert(`✅ تم إنشاء الحساب بنجاح\n\nاسم المستخدم: ${formData.username}\nكلمة المرور: ${password}`)
      }
      
      fetchUsers()
      resetForm()
      setShowModal(false)
    } catch (error) {
      console.error('Error saving user:', error)
      alert('Erreur lors de la sauvegarde de l\'utilisateur: ' + (error as Error).message)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
      try {
        // Delete from user_accounts first
        const { error } = await supabase
          .from('user_accounts')
          .delete()
          .eq('id', userId)
        
        if (error) throw error
        
        // Note: The auth user will remain but won't be able to access the app
        // In a production environment, you might want to implement a proper user deletion flow
        alert('تم حذف حساب المستخدم. قد يبقى المستخدم في نظام المصادقة.')
        fetchUsers()
      } catch (error) {
        console.error('Error deleting user:', error)
        alert('Erreur lors de la suppression de l\'utilisateur')
      }
    }
  }

  const handleEdit = (user: UserAccount) => {
    setFormData({
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      password: '',
      role: user.role,
      employee_id: user.employee_id || '',
      is_active: user.is_active
    })
    setEditingUser(user.id)
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      full_name: '',
      password: '',
      role: 'employee',
      employee_id: '',
      is_active: true
    })
    setEditingUser(null)
    setShowPassword(false)
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Key className="w-4 h-4" />
      case 'commercial':
        return <Briefcase className="w-4 h-4" />
      default:
        return <User className="w-4 h-4" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'commercial':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-green-100 text-green-800'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'مدير'
      case 'commercial':
        return 'تجاري'
      default:
        return 'موظف'
    }
  }

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">إدارة الحسابات</h1>
          <p className="text-white mt-2">قائمة بجميع حسابات المستخدمين</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex items-center space-x-3 bg-gray-50 rounded-lg px-4 py-3">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="ابحث عن مستخدم..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent outline-none text-gray-800"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <form onSubmit={createVirtualAccount} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الاسم</label>
            <input
              type="text"
              value={virtualForm.name}
              onChange={(e) => setVirtualForm({ ...virtualForm, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="مثال: ahmed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
            <input
              type="text"
              value={virtualForm.password}
              onChange={(e) => setVirtualForm({ ...virtualForm, password: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="مثال: 1234"
              style={{ direction: 'ltr', textAlign: 'right' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الدور</label>
            <select
              value={virtualForm.role}
              onChange={(e) => setVirtualForm({ ...virtualForm, role: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="employee">موظف</option>
              <option value="commercial">تجاري</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الموظف المرتبط</label>
            <select
              value={virtualForm.employee_id || ''}
              onChange={(e) => setVirtualForm({ ...virtualForm, employee_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">اختر موظفاً</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} - {employee.phone}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4 flex items-center justify-between gap-3">
            <div className="text-sm text-gray-600">
              admin / admin123
            </div>
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              إنشاء حساب
            </button>
          </div>
        </form>

        {virtualAccounts.length === 0 ? (
          <div className="text-gray-500 text-sm">لا توجد حسابات بسيطة بعد</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الاسم</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الدور</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الموظف المرتبط</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {virtualAccounts.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{a.name}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${a.role === 'commercial' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                        {a.role === 'commercial' ? 'تجاري' : 'موظف'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {a.employee_id ? (() => {
                        const emp = employees.find(e => e.id === a.employee_id)
                        return emp ? `${emp.name} - ${emp.phone}` : 'غير معروف'
                      })() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => deleteVirtualAccount(a.id)}
                        className="text-red-600 hover:text-red-800"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">جاري التحميل...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>لا يوجد مستخدمون</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    المستخدم
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    البريد الإلكتروني
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الدور
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الحالة
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    آخر تسجيل دخول
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    إجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <User className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div className="mr-4">
                          <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                          <div className="text-sm text-gray-500">@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                        {getRoleIcon(user.role)}
                        <span className="mr-1">{getRoleLabel(user.role)}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.is_active ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.last_login ? new Date(user.last_login).toLocaleDateString('ar-MA') : 'لم يسجل دخوله'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-blue-600 hover:text-blue-800"
                          title="تعديل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-800"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                {editingUser ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setShowModal(false)
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">اسم المستخدم *</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="أدخل اسم المستخدم"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="أدخل الاسم الكامل"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">البريد الإلكتروني *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="أدخل البريد الإلكتروني"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">كلمة المرور {editingUser && '(اتركها فارغة للحفظ على الحالية)'}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={editingUser ? 'أدخل كلمة مرور جديدة' : 'أدخل كلمة المرور'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">الدور *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="admin">مدير</option>
                  <option value="employee">موظف</option>
                  <option value="commercial">تجاري</option>
                </select>
              </div>

              {formData.role !== 'admin' && (
                <div>
                  <label className="block text-sm font-medium mb-1">الموظف المرتبط</label>
                  <select
                    value={formData.employee_id}
                    onChange={(e) => setFormData({...formData, employee_id: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">اختر موظفاً</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} - {employee.phone}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="mr-2"
                />
                <label htmlFor="is_active" className="text-sm font-medium">حساب نشط</label>
              </div>

              <div className="flex gap-4 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => {
                    resetForm()
                    setShowModal(false)
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                >
                  {editingUser ? 'تحديث' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
