import { useEffect, useState } from 'react'
import { Search, Eye, Edit2, Trash2, Plus, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Coupon {
  id: string
  code: string
  description_ar?: string
  description_en?: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  max_uses: number | null
  current_uses: number
  usage_limit_per_client: number
  min_order_amount: number | null
  max_discount_amount: number | null
  valid_from: string
  valid_until: string
  is_active: boolean
  created_at: string
  usage_count?: number
}

interface FormData {
  code: string
  description_ar: string
  description_en: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  max_uses: number | null
  usage_limit_per_client: number
  min_order_amount: number | null
  max_discount_amount: number | null
  valid_from: string
  valid_until: string
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>({
    code: '',
    description_ar: '',
    description_en: '',
    discount_type: 'percentage',
    discount_value: 0,
    max_uses: null,
    usage_limit_per_client: 1,
    min_order_amount: null,
    max_discount_amount: null,
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  })

  useEffect(() => {
    fetchCoupons()
  }, [])

  const fetchCoupons = async () => {
    try {
      setLoading(true)
      const { data: coupons, error: couponsError } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (couponsError) throw couponsError
      
      // Fetch usage count for each coupon from coupon_usage table
      const couponsWithUsage = await Promise.all(
        (coupons || []).map(async (coupon) => {
          const { count, error: countError } = await supabase
            .from('coupon_usage')
            .select('id', { count: 'exact', head: true })
            .eq('coupon_id', coupon.id)
          
          return {
            ...coupon,
            usage_count: countError ? coupon.current_uses || 0 : count || 0
          }
        })
      )
      
      setCoupons(couponsWithUsage)
    } catch (error) {
      console.error('Error fetching coupons:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('coupons')
        .insert([{
          ...formData,
          discount_value: parseFloat(formData.discount_value.toString()),
          max_uses: formData.max_uses ? parseInt(formData.max_uses.toString()) : null,
          usage_limit_per_client: formData.usage_limit_per_client ? parseInt(formData.usage_limit_per_client.toString()) : null,
          min_order_amount: formData.min_order_amount ? parseFloat(formData.min_order_amount.toString()) : null,
          max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount.toString()) : null,
          valid_from: new Date(formData.valid_from).toISOString(),
          valid_until: new Date(formData.valid_until).toISOString(),
        }])
      
      if (error) throw error
      
      setFormData({
        code: '',
        description_ar: '',
        description_en: '',
        discount_type: 'percentage',
        discount_value: 0,
        max_uses: null,
        usage_limit_per_client: 1,
        min_order_amount: null,
        max_discount_amount: null,
        valid_from: new Date().toISOString().split('T')[0],
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      })
      setShowModal(false)
      fetchCoupons()
    } catch (error) {
      console.error('Error adding coupon:', error)
    }
  }

  const handleDeleteCoupon = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الكوبون؟')) return
    
    try {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      fetchCoupons()
    } catch (error) {
      console.error('Error deleting coupon:', error)
    }
  }

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const filteredCoupons = coupons.filter(coupon =>
    coupon.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    coupon.description_ar?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getDiscountDisplay = (coupon: Coupon) => {
    if (coupon.discount_type === 'percentage') {
      return `${coupon.discount_value.toLocaleString('fr-FR')}%`
    }
    return `${coupon.discount_value.toLocaleString('fr-FR')} MAD`
  }

  const isExpired = (coupon: Coupon) => {
    return new Date(coupon.valid_until) < new Date()
  }

  const isActive = (coupon: Coupon) => {
    return coupon.is_active && !isExpired(coupon)
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">إدارة الكوبونات</h1>
          <p className="text-gray-600 mt-2">إنشاء وإدارة كوبونات الخصم</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition"
        >
          <Plus size={20} />
          <span>كوبون جديد</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex items-center space-x-3 bg-gray-50 rounded-lg px-4 py-3">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="ابحث عن كوبون..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent outline-none text-gray-800"
          />
        </div>
      </div>

      {/* Coupons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">جاري التحميل...</p>
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="col-span-full p-8 text-center text-gray-500">
            لا توجد كوبونات
          </div>
        ) : (
          filteredCoupons.map((coupon) => (
            <div
              key={coupon.id}
              className={`bg-white rounded-xl shadow-md p-6 border-r-4 transition ${
                isActive(coupon)
                  ? 'border-green-500'
                  : 'border-gray-300 opacity-75'
              }`}
            >
              {/* Code */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <p className="text-sm text-gray-600">رمز الكوبون</p>
                  <p className="text-lg font-bold text-gray-800">{coupon.code}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(coupon.code)}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                >
                  {copiedCode === coupon.code ? (
                    <Check size={20} />
                  ) : (
                    <Copy size={20} />
                  )}
                </button>
              </div>

              {/* Description */}
              {coupon.description_ar && (
                <p className="text-sm text-gray-600 mb-4">{coupon.description_ar}</p>
              )}

              {/* Discount */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600">قيمة الخصم</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {getDiscountDisplay(coupon)}
                </p>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">الاستخدامات:</span>
                  <span className="font-medium">
                    {coupon.usage_count || 0}/{coupon.max_uses || '∞'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">صالح حتى:</span>
                  <span className="font-medium">
                    {new Date(coupon.valid_until).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">صالح من:</span>
                  <span className="font-medium">
                    {new Date(coupon.valid_from).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                {coupon.min_order_amount && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">الحد الأدنى:</span>
                    <span className="font-medium">{coupon.min_order_amount.toLocaleString('fr-FR')} MAD</span>
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <div className="mb-4">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    isActive(coupon)
                      ? 'bg-green-100 text-green-800'
                      : isExpired(coupon)
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {isActive(coupon)
                    ? 'نشط'
                    : isExpired(coupon)
                    ? 'منتهي الصلاحية'
                    : 'غير نشط'}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-3">
                <button className="flex-1 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition">
                  <Eye size={18} />
                </button>
                <button className="flex-1 p-2 text-green-600 hover:bg-green-50 rounded-lg transition">
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDeleteCoupon(coupon.id)}
                  className="flex-1 p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Coupon Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">إنشاء كوبون جديد</h2>
            <form onSubmit={handleAddCoupon} className="space-y-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">رمز الكوبون *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                  placeholder="مثال: SUMMER2024"
                  required
                />
              </div>

              {/* Description AR */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">الوصف (عربي)</label>
                <textarea
                  value={formData.description_ar}
                  onChange={(e) => setFormData({ ...formData, description_ar: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                  placeholder="وصف الكوبون"
                  rows={2}
                />
              </div>

              {/* Description EN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (English)</label>
                <textarea
                  value={formData.description_en}
                  onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                  placeholder="Coupon description"
                  rows={2}
                />
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">نوع الخصم *</label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as 'percentage' | 'fixed' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                  >
                    <option value="percentage">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت (ر.س)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">قيمة الخصم *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Max Uses & Per Client */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الحد الأقصى للاستخدام</label>
                  <input
                    type="number"
                    value={formData.max_uses || ''}
                    onChange={(e) => setFormData({ ...formData, max_uses: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                    placeholder="بدون حد"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الاستخدام لكل عميل</label>
                  <input
                    type="number"
                    value={formData.usage_limit_per_client || ''}
                    onChange={(e) => setFormData({ ...formData, usage_limit_per_client: e.target.value ? parseInt(e.target.value) : 1 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                  />
                </div>
              </div>

              {/* Min Order & Max Discount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الحد الأدنى للطلب</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.min_order_amount || ''}
                    onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                    placeholder="بدون حد"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الحد الأقصى للخصم</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.max_discount_amount || ''}
                    onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                    placeholder="بدون حد"
                  />
                </div>
              </div>

              {/* Valid Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">تاريخ البداية *</label>
                  <input
                    type="date"
                    value={formData.valid_from}
                    onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">تاريخ النهاية *</label>
                  <input
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-6">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition font-medium"
                >
                  إنشاء الكوبون
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
