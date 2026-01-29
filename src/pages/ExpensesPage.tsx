import { useEffect, useState, useMemo } from 'react'
import { Search, Plus, Trash2, Edit2, DollarSign, TrendingDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useInputPad } from '../components/useInputPad'

interface Expense {
  id: string
  date: string
  category: 'rent' | 'electricity' | 'water' | 'internet' | 'transport' | 'salary' | 'other'
  description: string
  amount: number
  payment_method: 'cash' | 'transfer' | 'check' | 'card' | 'other'
  employee_id?: string
  created_at: string
  updated_at: string
}

const CATEGORIES = {
  rent: 'الإيجار',
  electricity: 'الكهرباء',
  water: 'الماء',
  internet: 'الإنترنت',
  transport: 'النقل',
  salary: 'الراتب',
  other: 'أخرى'
}

const PAYMENT_METHODS = {
  cash: 'نقدي',
  transfer: 'تحويل بنكي',
  check: 'شيك',
  card: 'بطاقة',
  other: 'أخرى'
}

export default function ExpensesPage() {
  const inputPad = useInputPad()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'other' as 'rent' | 'electricity' | 'water' | 'internet' | 'transport' | 'salary' | 'other',
    description: '',
    amount: '',
    payment_method: 'cash' as 'cash' | 'transfer' | 'check' | 'card' | 'other',
    employee_id: ''
  })

  useEffect(() => {
    loadExpenses()
  }, [])

  const loadExpenses = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false })

      if (error) throw error
      setExpenses(data || [])
    } catch (error) {
      console.error('Error loading expenses:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredExpenses = useMemo(() => {
    let filtered = expenses

    // Search filter
    const s = searchTerm.trim().toLowerCase()
    if (s) {
      filtered = filtered.filter(expense =>
        expense.description.toLowerCase().includes(s) ||
        CATEGORIES[expense.category].toLowerCase().includes(s)
      )
    }

    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(expense => expense.category === filterCategory)
    }

    return filtered
  }, [expenses, searchTerm, filterCategory])

  const stats = useMemo(() => {
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
    const byCategory = Object.keys(CATEGORIES).reduce((acc, cat) => {
      acc[cat] = filteredExpenses
        .filter(e => e.category === cat)
        .reduce((sum, e) => sum + (e.amount || 0), 0)
      return acc
    }, {} as Record<string, number>)

    return { totalExpenses, byCategory }
  }, [filteredExpenses])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.date || !formData.description || !formData.amount) {
      alert('يرجى ملء جميع الحقول المطلوبة')
      return
    }

    try {
      const expenseData = {
        date: formData.date,
        category: formData.category,
        description: formData.description,
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method,
        employee_id: formData.employee_id || null,
        updated_at: new Date().toISOString()
      }

      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', editingExpense.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert({
            ...expenseData,
            created_at: new Date().toISOString()
          })

        if (error) throw error
      }

      setShowAddModal(false)
      setEditingExpense(null)
      resetForm()
      await loadExpenses()
      alert('✅ تم حفظ المصروف بنجاح')
    } catch (error) {
      console.error('Error saving expense:', error)
      alert('❌ حدث خطأ أثناء حفظ المصروف')
    }
  }

  const handleDelete = async (expense: Expense) => {
    if (!confirm(`هل تريد حذف المصروف: ${expense.description}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expense.id)

      if (error) throw error
      await loadExpenses()
      alert('✅ تم حذف المصروف بنجاح')
    } catch (error) {
      console.error('Error deleting expense:', error)
      alert('❌ حدث خطأ أثناء حذف المصروف')
    }
  }

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense)
    setFormData({
      date: expense.date,
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      payment_method: expense.payment_method,
      employee_id: expense.employee_id || ''
    })
    setShowAddModal(true)
  }

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      category: 'other' as 'rent' | 'electricity' | 'water' | 'internet' | 'transport' | 'salary' | 'other',
      description: '',
      amount: '',
      payment_method: 'cash' as 'cash' | 'transfer' | 'check' | 'card' | 'other',
      employee_id: ''
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <TrendingDown className="text-white" size={36} />
            المصروفات العامة
          </h1>
          <p className="text-white mt-2">إدارة جميع المصروفات غير المتعلقة بالمشتريات</p>
        </div>
        <button
          onClick={() => {
            setEditingExpense(null)
            resetForm()
            setShowAddModal(true)
          }}
          className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700"
        >
          <Plus className="w-5 h-5" />
          مصروف جديد
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">إجمالي المصروفات</p>
              <p className="text-2xl font-bold">{stats.totalExpenses.toFixed(2)} MAD</p>
            </div>
            <DollarSign className="w-8 h-8 text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">الرواتب</p>
              <p className="text-2xl font-bold">{stats.byCategory.salary.toFixed(2)} MAD</p>
            </div>
            <DollarSign className="w-8 h-8 text-orange-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm">الإيجار</p>
              <p className="text-2xl font-bold">{stats.byCategory.rent.toFixed(2)} MAD</p>
            </div>
            <DollarSign className="w-8 h-8 text-yellow-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-pink-500 to-pink-600 text-white p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-pink-100 text-sm">المرافق</p>
              <p className="text-2xl font-bold">
                {(stats.byCategory.electricity + stats.byCategory.water + stats.byCategory.internet).toFixed(2)} MAD
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-pink-200" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="البحث عن مصروف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">جميع الفئات</option>
            {Object.entries(CATEGORIES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button
            onClick={() => {
              setSearchTerm('')
              setFilterCategory('all')
            }}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            مسح الفلاتر
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">التاريخ</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">الفئة</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">الوصف</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">المبلغ</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">طريقة الدفع</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    لا توجد مصروفات
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <span className="font-medium">
                        {new Date(expense.date).toLocaleDateString('ar-DZ')}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-block px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                        {CATEGORIES[expense.category]}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium">{expense.description}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-bold text-red-600">
                        {expense.amount.toFixed(2)} MAD
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">
                        {PAYMENT_METHODS[expense.payment_method]}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(expense)}
                          className="text-blue-600 hover:text-blue-800"
                          title="تعديل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense)}
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

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingExpense ? 'تعديل المصروف' : 'مصروف جديد'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">التاريخ *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">الفئة *</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value as any})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {Object.entries(CATEGORIES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">الوصف *</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={3}
                  placeholder="وصف المصروف..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">المبلغ *</label>
                <button
                  type="button"
                  onClick={() =>
                    inputPad.open({
                      title: 'المبلغ *',
                      mode: 'decimal',
                      dir: 'ltr',
                      initialValue: formData.amount || '0',
                      min: 0.01,
                      onConfirm: (v) => setFormData({...formData, amount: v}),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-left"
                >
                  {formData.amount || '0.00'}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">طريقة الدفع *</label>
                <select
                  required
                  value={formData.payment_method}
                  onChange={(e) => setFormData({...formData, payment_method: e.target.value as any})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingExpense(null)
                    resetForm()
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                >
                  {editingExpense ? 'تحديث' : 'حفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {inputPad.Modal}
    </div>
  )
}
