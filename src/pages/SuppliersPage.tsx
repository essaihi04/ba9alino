import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Eye, Edit2, Trash2, Phone, Mail, MapPin, Building, DollarSign } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Supplier {
  id: string
  name_ar: string
  name_en?: string
  contact_person?: string
  contact_person_name?: string
  contact_person_email?: string
  contact_person_phone?: string
  email?: string
  phone?: string
  address?: string
  address_ar?: string
  address_en?: string
  city?: string
  postal_code?: string
  country?: string
  payment_terms_ar?: string
  payment_terms_en?: string
  is_active: boolean
  created_at: string
  updated_at?: string
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [formData, setFormData] = useState({
    name_ar: '',
    name_en: '',
    contact_person_name: '',
    contact_person_email: '',
    contact_person_phone: '',
    email: '',
    phone: '',
    address_ar: '',
    address_en: '',
    city: '',
    payment_terms_ar: '',
    payment_terms_en: '',
    is_active: true
  })
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash' as const,
    notes: ''
  })

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSuppliers(data || [])
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const supplierData = {
        ...formData,
        updated_at: new Date().toISOString()
      }

      if (editingSupplier) {
        // Update existing supplier
        const { error } = await supabase
          .from('suppliers')
          .update(supplierData)
          .eq('id', editingSupplier.id)

        if (error) throw error
      } else {
        // Create new supplier
        const { error } = await supabase
          .from('suppliers')
          .insert({
            ...supplierData,
            created_at: new Date().toISOString()
          })

        if (error) throw error
      }

      setShowFormModal(false)
      setEditingSupplier(null)
      resetForm()
      fetchSuppliers()
    } catch (error) {
      console.error('Error saving supplier:', error)
      alert('Erreur lors de la sauvegarde du fournisseur')
    }
  }

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le fournisseur ${supplier.name_ar}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplier.id)

      if (error) throw error
      fetchSuppliers()
    } catch (error) {
      console.error('Error deleting supplier:', error)
      alert('Erreur lors de la suppression du fournisseur')
    }
  }

  const handlePayment = async () => {
    if (!selectedSupplier || !paymentForm.amount) {
      alert('يرجى إدخال مبلغ الدفع')
      return
    }

    try {
      const { error } = await supabase
        .from('supplier_payments')
        .insert({
          supplier_id: selectedSupplier.id,
          amount: parseFloat(paymentForm.amount),
          payment_date: paymentForm.payment_date,
          payment_method: paymentForm.payment_method,
          notes: paymentForm.notes
        })

      if (error) throw error

      setShowPaymentModal(false)
      setSelectedSupplier(null)
      setPaymentForm({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        notes: ''
      })
      
      alert('✅ تم تسجيل الدفع بنجاح')
    } catch (error) {
      console.error('Error recording payment:', error)
      alert('❌ حدث خطأ أثناء تسجيل الدفع')
    }
  }

  const resetForm = () => {
    setFormData({
      name_ar: '',
      name_en: '',
      contact_person_name: '',
      contact_person_email: '',
      contact_person_phone: '',
      email: '',
      phone: '',
      address_ar: '',
      address_en: '',
      city: '',
      payment_terms_ar: '',
      payment_terms_en: '',
      is_active: true
    })
  }

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setFormData({
      name_ar: supplier.name_ar,
      name_en: supplier.name_en || '',
      contact_person_name: supplier.contact_person_name || supplier.contact_person || '',
      contact_person_email: supplier.contact_person_email || supplier.email || '',
      contact_person_phone: supplier.contact_person_phone || supplier.phone || '',
      email: supplier.email || supplier.contact_person_email || '',
      phone: supplier.phone || supplier.contact_person_phone || '',
      address_ar: supplier.address_ar || '',
      address_en: supplier.address_en || '',
      city: supplier.city || '',
      payment_terms_ar: supplier.payment_terms_ar || '',
      payment_terms_en: supplier.payment_terms_en || '',
      is_active: supplier.is_active
    })
    setShowFormModal(true)
  }

  const filteredSuppliers = useMemo(() => {
    let filtered = suppliers

    // Search filter
    const s = searchTerm.trim().toLowerCase()
    if (s) {
      filtered = filtered.filter(supplier => {
        const name = String(supplier.name_ar || '').toLowerCase()
        const contact = String(supplier.contact_person_name || supplier.contact_person || '').toLowerCase()
        const email = String(supplier.contact_person_email || supplier.email || '').toLowerCase()
        const phone = String(supplier.contact_person_phone || supplier.phone || '').toLowerCase()
        return name.includes(s) || contact.includes(s) || 
               email.includes(s) || phone.includes(s)
      })
    }

    // Status filter
    if (filterStatus === 'active') {
      filtered = filtered.filter(supplier => supplier.is_active)
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter(supplier => !supplier.is_active)
    }

    return filtered
  }, [suppliers, searchTerm, filterStatus])

  const stats = useMemo(() => {
    const total = suppliers.length
    const active = suppliers.filter(s => s.is_active).length
    const inactive = suppliers.filter(s => !s.is_active).length
    return { total, active, inactive }
  }, [suppliers])

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">الموردون</h1>
          <p className="text-white mt-2">إدارة معلومات الموردين</p>
        </div>
        <button 
          onClick={() => {
            setEditingSupplier(null)
            resetForm()
            setShowFormModal(true)
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          مورد جديد
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-md border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">إجمالي الموردين</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <Building className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-md border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">نشطون</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <Building className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-md border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">غير نشطين</p>
              <p className="text-2xl font-bold text-gray-600">{stats.inactive}</p>
            </div>
            <Building className="w-8 h-8 text-gray-500" />
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
              placeholder="البحث عن مورد..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">جميع الحالات</option>
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
          </select>
          <button
            onClick={() => {
              setSearchTerm('')
              setFilterStatus('all')
            }}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            مسح الفلاتر
          </button>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">اسم المورد</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">شخص الاتصال</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">معلومات الاتصال</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">العنوان</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    لا يوجد موردون
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium">{supplier.name_ar}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium">{supplier.contact_person_name || supplier.contact_person || '-'}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span>{supplier.contact_person_email || supplier.email || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{supplier.contact_person_phone || supplier.phone || '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div className="text-sm">
                          <p>{supplier.address_ar || supplier.address_en || supplier.address || '-'}</p>
                          <p>{supplier.city || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        supplier.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {supplier.is_active ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedSupplier(supplier)
                            setShowDetailsModal(true)
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedSupplier(supplier)
                            setShowPaymentModal(true)
                          }}
                          className="text-green-600 hover:text-green-800"
                          title="تسجيل دفع"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(supplier)}
                          className="text-green-600 hover:text-green-800"
                          title="تعديل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(supplier)}
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

      {/* Supplier Details Modal */}
      {showDetailsModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">تفاصيل المورد</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">معلومات أساسية</h3>
                <div className="space-y-2">
                  <p><span className="text-gray-500">الاسم:</span> {selectedSupplier.name_ar}</p>
                  <p><span className="text-gray-500">شخص الاتصال:</span> {selectedSupplier.contact_person_name || selectedSupplier.contact_person || '-'}</p>
                  <p><span className="text-gray-500">البريد الإلكتروني:</span> {selectedSupplier.contact_person_email || selectedSupplier.email || '-'}</p>
                  <p><span className="text-gray-500">الهاتف:</span> {selectedSupplier.contact_person_phone || selectedSupplier.phone || '-'}</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">العنوان</h3>
                <div className="space-y-2">
                  <p><span className="text-gray-500">العنوان:</span> {selectedSupplier.address_ar || selectedSupplier.address_en || selectedSupplier.address || '-'}</p>
                  <p><span className="text-gray-500">المدينة:</span> {selectedSupplier.city || '-'}</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">معلومات مالية</h3>
                <div className="space-y-2">
                  <p><span className="text-gray-500">شروط الدفع:</span> {selectedSupplier.payment_terms_ar}</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">الحالة</h3>
                <div className="space-y-2">
                  <p><span className="text-gray-500">الحالة:</span> 
                    <span className={`mr-2 px-2 py-1 text-xs rounded-full ${
                      selectedSupplier.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedSupplier.is_active ? 'نشط' : 'غير نشط'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowDetailsModal(false)
                  setSelectedSupplier(null)
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingSupplier ? 'تعديل المورد' : 'مورد جديد'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">اسم المورد (عربي) *</label>
                  <input
                    type="text"
                    required
                    value={formData.name_ar}
                    onChange={(e) => setFormData({...formData, name_ar: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">اسم المورد (English)</label>
                  <input
                    type="text"
                    value={formData.name_en}
                    onChange={(e) => setFormData({...formData, name_en: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">شخص الاتصال</label>
                  <input
                    type="text"
                    value={formData.contact_person_name}
                    onChange={(e) => setFormData({...formData, contact_person_name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">الهاتف</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">شروط الدفع (عربي)</label>
                  <input
                    type="text"
                    value={formData.payment_terms_ar}
                    onChange={(e) => setFormData({...formData, payment_terms_ar: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">شروط الدفع (English)</label>
                  <input
                    type="text"
                    value={formData.payment_terms_en}
                    onChange={(e) => setFormData({...formData, payment_terms_en: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">العنوان (عربي)</label>
                  <input
                    type="text"
                    value={formData.address_ar}
                    onChange={(e) => setFormData({...formData, address_ar: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">العنوان (English)</label>
                  <input
                    type="text"
                    value={formData.address_en}
                    onChange={(e) => setFormData({...formData, address_en: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">المدينة</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="ml-2"
                />
                <label htmlFor="is_active" className="text-sm font-medium">
                  نشط
                </label>
              </div>
              <div className="flex gap-4 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowFormModal(false)
                    setEditingSupplier(null)
                    resetForm()
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  {editingSupplier ? 'تحديث' : 'حفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">تسجيل دفع للمورد</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600">المورد: <span className="font-bold">{selectedSupplier.name_ar}</span></p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">المبلغ *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">تاريخ الدفع *</label>
                <input
                  type="date"
                  required
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({...paymentForm, payment_date: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">طريقة الدفع *</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({...paymentForm, payment_method: e.target.value as any})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="cash">نقدي</option>
                  <option value="transfer">تحويل بنكي</option>
                  <option value="check">شيك</option>
                  <option value="card">بطاقة</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ملاحظات</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows={3}
                  placeholder="ملاحظات اختيارية..."
                />
              </div>
            </div>
            <div className="flex gap-4 justify-end mt-6">
              <button
                onClick={() => {
                  setShowPaymentModal(false)
                  setSelectedSupplier(null)
                  setPaymentForm({
                    amount: '',
                    payment_date: new Date().toISOString().split('T')[0],
                    payment_method: 'cash',
                    notes: ''
                  })
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={handlePayment}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                تسجيل الدفع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
