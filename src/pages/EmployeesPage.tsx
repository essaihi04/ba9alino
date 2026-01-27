import { useEffect, useState, useMemo } from 'react'
import { Search, Plus, Trash2, Edit2, Users, CheckCircle, AlertCircle, DollarSign } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Employee {
  id: string
  name: string
  phone: string
  email?: string
  address?: string
  national_id?: string
  salary?: number
  monthly_salary?: number
  advance_limit?: number
  hire_date?: string
  role: 'admin' | 'commercial' | 'stock' | 'truck_driver' | 'delivery_driver' | 'custom'
  custom_role?: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

interface EmployeeTransaction {
  id: string
  employee_id: string
  transaction_date: string
  transaction_type: 'advance' | 'repayment' | 'salary_payment' | 'salary_deduction'
  amount: number
  payment_method: 'cash' | 'transfer' | 'check' | 'card' | 'other'
  notes?: string
  created_at: string
}

const ROLES = {
  admin: 'مسؤول',
  commercial: 'تجاري',
  stock: 'مسؤول المخزن',
  truck_driver: 'سائق شاحنة',
  delivery_driver: 'سائق توصيل',
  custom: 'دور مخصص'
}

const ROLE_COLORS = {
  admin: 'bg-purple-100 text-purple-800',
  commercial: 'bg-green-100 text-green-800',
  stock: 'bg-orange-100 text-orange-800',
  truck_driver: 'bg-blue-100 text-blue-800',
  delivery_driver: 'bg-cyan-100 text-cyan-800',
  custom: 'bg-gray-100 text-gray-800'
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [transactions, setTransactions] = useState<EmployeeTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [includeRepaymentsInNetSalary, setIncludeRepaymentsInNetSalary] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [showTxnModal, setShowTxnModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    national_id: '',
    monthly_salary: '',
    advance_limit: '',
    hire_date: new Date().toISOString().split('T')[0],
    role: 'delivery_driver' as 'admin' | 'commercial' | 'stock' | 'truck_driver' | 'delivery_driver' | 'custom',
    customRole: '',
    status: 'active' as 'active' | 'inactive'
  })

  const [txnForm, setTxnForm] = useState({
    transaction_type: 'advance' as 'advance' | 'repayment' | 'salary_payment' | 'salary_deduction',
    transaction_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_method: 'cash' as 'cash' | 'transfer' | 'check' | 'card' | 'other',
    notes: ''
  })

  useEffect(() => {
    loadEmployees()
    loadTransactions()
  }, [])

  const loadEmployees = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setEmployees(data || [])
    } catch (error) {
      console.error('Error loading employees:', error)
    } finally {
      setLoading(false)
    }

  }

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('employee_transactions')
        .select('*')
        .order('transaction_date', { ascending: false })

      if (error) throw error
      setTransactions(data || [])
    } catch (error) {
      console.error('Error loading employee transactions:', error)
    }
  }

  const advanceBalances = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of transactions) {
      if (!map[t.employee_id]) map[t.employee_id] = 0
      if (t.transaction_type === 'advance') map[t.employee_id] += t.amount || 0
      if (t.transaction_type === 'repayment') map[t.employee_id] -= t.amount || 0
      if (t.transaction_type === 'salary_deduction') map[t.employee_id] -= t.amount || 0
    }
    return map
  }, [transactions])

  const monthlySummaries = useMemo(() => {
    const monthPrefix = `${selectedMonth}-`
    const byEmployee: Record<string, {
      advances: number
      repayments: number
      salary_deductions: number
      salary_payments: number
    }> = {}

    for (const t of transactions) {
      if (!t.transaction_date?.startsWith(monthPrefix)) continue
      if (!byEmployee[t.employee_id]) {
        byEmployee[t.employee_id] = { advances: 0, repayments: 0, salary_deductions: 0, salary_payments: 0 }
      }

      if (t.transaction_type === 'advance') byEmployee[t.employee_id].advances += t.amount || 0
      if (t.transaction_type === 'repayment') byEmployee[t.employee_id].repayments += t.amount || 0
      if (t.transaction_type === 'salary_deduction') byEmployee[t.employee_id].salary_deductions += t.amount || 0
      if (t.transaction_type === 'salary_payment') byEmployee[t.employee_id].salary_payments += t.amount || 0
    }

    const result: Record<string, {
      advances: number
      repayments: number
      salary_deductions: number
      salary_payments: number
      net_salary: number
    }> = {}

    for (const emp of employees) {
      const s = byEmployee[emp.id] || { advances: 0, repayments: 0, salary_deductions: 0, salary_payments: 0 }
      const baseSalary = emp.monthly_salary || 0
      const net_salary = baseSalary - s.salary_deductions - s.repayments - s.advances
      result[emp.id] = { ...s, net_salary }
    }

    return result
  }, [employees, transactions, selectedMonth])


  const filteredEmployees = useMemo(() => {
    let filtered = employees

    // Search filter
    const s = searchTerm.trim().toLowerCase()
    if (s) {
      filtered = filtered.filter(emp =>
        emp.name.toLowerCase().includes(s) ||
        emp.phone.toLowerCase().includes(s)
      )
    }

    // Role filter
    if (filterRole !== 'all') {
      filtered = filtered.filter(emp => emp.role === filterRole)
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(emp => emp.status === filterStatus)
    }

    return filtered
  }, [employees, searchTerm, filterRole, filterStatus])

  const stats = useMemo(() => {
    const total = employees.length
    const active = employees.filter(e => e.status === 'active').length
    const admins = employees.filter(e => e.role === 'admin').length
    const inactive = employees.filter(e => e.status === 'inactive').length

    return { total, active, admins, inactive }
  }, [employees])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.phone || (formData.role === 'custom' && !formData.customRole)) {
      alert('يرجى ملء جميع الحقول المطلوبة')
      return
    }

    try {
      const employeeData: any = {
        name: formData.name,
        phone: formData.phone,
        address: formData.address || null,
        national_id: formData.national_id || null,
        monthly_salary: formData.monthly_salary ? parseFloat(formData.monthly_salary) : null,
        advance_limit: formData.advance_limit ? parseFloat(formData.advance_limit) : null,
        hire_date: formData.hire_date || null,
        role: formData.role,
        status: formData.status,
        updated_at: new Date().toISOString()
      }

      // Ajouter le rôle personnalisé si sélectionné
      if (formData.role === 'custom') {
        employeeData.custom_role = formData.customRole
      }

      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', editingEmployee.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('employees')
          .insert({
            ...employeeData,
            created_at: new Date().toISOString()
          })

        if (error) throw error
      }

      setShowAddModal(false)
      setEditingEmployee(null)
      resetForm()
      await loadEmployees()
      alert('✅ تم حفظ الموظف بنجاح')
    } catch (error) {
      console.error('Error saving employee:', error)
      alert('❌ حدث خطأ أثناء حفظ الموظف')
    }
  }

  const handleTxnSubmit = async () => {
    if (!selectedEmployee || !txnForm.amount) {
      alert('يرجى إدخال مبلغ صحيح')
      return
    }

    const amount = parseFloat(txnForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('يرجى إدخال مبلغ صحيح')
      return
    }

    const currentBalance = advanceBalances[selectedEmployee.id] || 0
    const limit = selectedEmployee.advance_limit || 0
    const nextBalance = (() => {
      if (txnForm.transaction_type === 'advance') return currentBalance + amount
      if (txnForm.transaction_type === 'repayment') return currentBalance - amount
      if (txnForm.transaction_type === 'salary_deduction') return currentBalance - amount
      return currentBalance
    })()

    if (txnForm.transaction_type === 'advance' && limit > 0 && nextBalance > limit) {
      alert('⚠️ تم تجاوز سقف السلفة لهذا الموظف')
    }

    try {
      const { error } = await supabase
        .from('employee_transactions')
        .insert({
          employee_id: selectedEmployee.id,
          transaction_date: txnForm.transaction_date,
          transaction_type: txnForm.transaction_type,
          amount,
          payment_method: txnForm.payment_method,
          notes: txnForm.notes || null,
        })

      if (error) throw error

      setShowTxnModal(false)
      setSelectedEmployee(null)
      setTxnForm({
        transaction_type: 'advance',
        transaction_date: new Date().toISOString().split('T')[0],
        amount: '',
        payment_method: 'cash',
        notes: ''
      })
      await loadTransactions()
      alert('✅ تم تسجيل العملية بنجاح')
    } catch (error) {
      console.error('Error saving employee transaction:', error)
      alert('❌ حدث خطأ أثناء تسجيل العملية')
    }
  }

  const handleDelete = async (employee: Employee) => {
    if (!confirm(`هل تريد حذف الموظف: ${employee.name}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employee.id)

      if (error) throw error
      await loadEmployees()
      alert('✅ تم حذف الموظف بنجاح')
    } catch (error) {
      console.error('Error deleting employee:', error)
      alert('❌ حدث خطأ أثناء حذف الموظف')
    }
  }

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee)
    setFormData({
      name: employee.name,
      phone: employee.phone,
      address: employee.address || '',
      national_id: employee.national_id || '',
      monthly_salary: employee.monthly_salary?.toString() || '',
      advance_limit: employee.advance_limit?.toString() || '',
      hire_date: employee.hire_date || new Date().toISOString().split('T')[0],
      role: employee.role,
      customRole: employee.role === 'custom' ? employee.custom_role || '' : '',
      status: employee.status
    })
    setShowAddModal(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      address: '',
      national_id: '',
      monthly_salary: '',
      advance_limit: '',
      hire_date: new Date().toISOString().split('T')[0],
      role: 'delivery_driver' as 'admin' | 'commercial' | 'stock' | 'truck_driver' | 'delivery_driver' | 'custom',
      customRole: '',
      status: 'active' as 'active' | 'inactive'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Users className="text-white" size={36} />
            إدارة الموظفين
          </h1>
          <p className="text-white mt-2">إدارة فريق العمل والصلاحيات</p>
        </div>
        <button
          onClick={() => {
            setEditingEmployee(null)
            resetForm()
            setShowAddModal(true)
          }}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700"
        >
          <Plus className="w-5 h-5" />
          موظف جديد
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">إجمالي الموظفين</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <Users className="w-8 h-8 text-purple-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">الموظفين النشطين</p>
              <p className="text-2xl font-bold">{stats.active}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">المسؤولين</p>
              <p className="text-2xl font-bold">{stats.admins}</p>
            </div>
            <Users className="w-8 h-8 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">الموظفين غير النشطين</p>
              <p className="text-2xl font-bold">{stats.inactive}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-200" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="البحث عن موظف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">جميع الأدوار</option>
            {Object.entries(ROLES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">جميع الحالات</option>
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
          </select>
          <button
            onClick={() => {
              setSearchTerm('')
              setFilterRole('all')
              setFilterStatus('all')
            }}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            مسح الفلاتر
          </button>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">ملخص الشهر (المستحقات والسلف)</h3>
            <p className="text-sm text-gray-600">صافي الراتب = الأجر الشهري - الاقتطاعات - سلف الشهر</p>
          </div>
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <div>
              <label className="block text-sm font-medium mb-1">الشهر</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => {
            const s = monthlySummaries[emp.id]
            const balance = advanceBalances[emp.id] || 0
            const limit = emp.advance_limit || 0
            const isOver = limit > 0 && balance > limit
            return (
              <div key={emp.id} className="border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold">{emp.name}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${isOver ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                    {isOver ? 'تجاوز السقف' : 'ضمن السقف'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600">الأجر الشهري</div>
                  <div className="font-bold text-gray-800">{(emp.monthly_salary || 0).toFixed(2)}</div>

                  <div className="text-gray-600">سلف الشهر</div>
                  <div className="font-bold text-gray-800">{(s?.advances || 0).toFixed(2)}</div>

                  <div className="text-gray-600">اقتطاعات الشهر</div>
                  <div className="font-bold text-gray-800">{(s?.salary_deductions || 0).toFixed(2)}</div>

                  <div className="text-gray-600">صافي الراتب</div>
                  <div className="font-bold text-green-700">{(s?.net_salary || 0).toFixed(2)}</div>

                  <div className="text-gray-600">رصيد السلفة الحالي</div>
                  <div className={`font-bold ${isOver ? 'text-red-600' : 'text-gray-800'}`}>{balance.toFixed(2)}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">الاسم</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">الهاتف</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">الدور</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">سقف السلفة</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">رصيد السلفة</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">تاريخ الإنشاء</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    لا يوجد موظفين
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <p className="font-medium">{employee.name}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-gray-600">{employee.phone}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${ROLE_COLORS[employee.role]}`}>
                        {employee.role === 'custom' ? employee.custom_role || 'دور مخصص' : ROLES[employee.role]}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-700">
                        {(employee.advance_limit || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {(() => {
                        const balance = advanceBalances[employee.id] || 0
                        const limit = employee.advance_limit || 0
                        const isOver = limit > 0 && balance > limit
                        return (
                          <span className={`text-sm font-bold ${isOver ? 'text-red-600' : 'text-gray-700'}`}>
                            {balance.toFixed(2)}
                            {isOver ? ' ⚠️' : ''}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        employee.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {employee.status === 'active' ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-gray-600">
                        {new Date(employee.created_at).toLocaleDateString('ar-DZ')}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedEmployee(employee)
                            setShowTxnModal(true)
                          }}
                          className="text-amber-600 hover:text-amber-800"
                          title="سلف / تسديد / راتب"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(employee)}
                          className="text-blue-600 hover:text-blue-800"
                          title="تعديل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(employee)}
                          className="text-red-600 hover:text-red-800"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showTxnModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-3">سلف الموظف / التسديد / الراتب</h2>
            <div className="mb-3">
              <p className="text-xs text-gray-600">الموظف: <span className="font-bold">{selectedEmployee.name}</span></p>
              <p className="text-xs text-gray-600">رصيد السلفة الحالي: <span className="font-bold">{(advanceBalances[selectedEmployee.id] || 0).toFixed(2)}</span></p>
              <p className="text-xs text-gray-600">سقف السلفة: <span className="font-bold">{(selectedEmployee.advance_limit || 0).toFixed(2)}</span></p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">نوع العملية *</label>
                <select
                  value={txnForm.transaction_type}
                  onChange={(e) => setTxnForm({ ...txnForm, transaction_type: e.target.value as any })}
                  className="w-full px-2 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="advance">سلفة</option>
                  <option value="repayment">تسديد</option>
                  <option value="salary_payment">دفع الراتب</option>
                  <option value="salary_deduction">اقتطاع من الراتب</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">التاريخ *</label>
                <input
                  type="date"
                  required
                  value={txnForm.transaction_date}
                  onChange={(e) => setTxnForm({ ...txnForm, transaction_date: e.target.value })}
                  className="w-full px-2 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">المبلغ *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={txnForm.amount}
                  onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })}
                  className="w-full px-2 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">طريقة الدفع *</label>
                <select
                  value={txnForm.payment_method}
                  onChange={(e) => setTxnForm({ ...txnForm, payment_method: e.target.value as any })}
                  className="w-full px-2 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="cash">نقدي</option>
                  <option value="transfer">تحويل بنكي</option>
                  <option value="check">شيك</option>
                  <option value="card">بطاقة</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">ملاحظات</label>
                <textarea
                  value={txnForm.notes}
                  onChange={(e) => setTxnForm({ ...txnForm, notes: e.target.value })}
                  className="w-full px-2 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  rows={2}
                  placeholder="ملاحظات اختيارية..."
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => {
                  setShowTxnModal(false)
                  setSelectedEmployee(null)
                }}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                إلغاء
              </button>
              <button
                onClick={handleTxnSubmit}
                className="bg-amber-600 text-white px-3 py-2 text-sm rounded-lg hover:bg-amber-700"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingEmployee ? 'تعديل الموظف' : 'موظف جديد'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">الاسم *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="اسم الموظف الكامل"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">الهاتف *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="06xxxxxxxx"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">العنوان</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="العنوان (اختياري)"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">الأجر الشهري (MAD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.monthly_salary}
                    onChange={(e) => setFormData({...formData, monthly_salary: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">سقف السلفة (MAD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.advance_limit}
                    onChange={(e) => setFormData({...formData, advance_limit: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">رقم البطاقة الوطنية</label>
                  <input
                    type="text"
                    value={formData.national_id}
                    onChange={(e) => setFormData({...formData, national_id: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="XXXXXXXXXX"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">تاريخ التوظيف</label>
                  <input
                    type="date"
                    value={formData.hire_date}
                    onChange={(e) => setFormData({...formData, hire_date: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">الدور *</label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {Object.entries(ROLES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">الحالة *</label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="active">نشط</option>
                    <option value="inactive">غير نشط</option>
                  </select>
                </div>
              </div>

              {formData.role === 'custom' && (
                <div>
                  <label className="block text-sm font-medium mb-1">اسم الدور المخصص *</label>
                  <input
                    type="text"
                    required
                    value={formData.customRole}
                    onChange={(e) => setFormData({...formData, customRole: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="أدخل اسم الدور المخصص"
                  />
                </div>
              )}

              <div className="flex gap-4 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingEmployee(null)
                    resetForm()
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                >
                  {editingEmployee ? 'تحديث' : 'حفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
