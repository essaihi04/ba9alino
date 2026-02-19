import { useEffect, useMemo, useState, useRef } from 'react'
import { Search, Plus, Trash2, Edit2, Package, X, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Promotion {
  id: string
  title: string
  type: 'gift' | 'discount'
  scope: 'global' | 'product'
  product_id: string | null
  min_quantity: number
  unit_type: string | null
  discount_percent: number | null
  gift_product_id: string | null
  gift_quantity: number | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  created_at: string
}

interface ProductOption {
  id: string
  name_ar: string
  image_url?: string | null
  sku?: string | null
  category_id?: string | null
}

interface Category {
  id: string
  name_ar: string
}

interface PromotionFormData {
  title: string
  type: 'gift' | 'discount'
  scope: 'global' | 'product'
  product_id: string
  min_quantity: string
  unit_type: string
  discount_percent: string
  gift_product_id: string
  gift_quantity: string
  is_active: boolean
  starts_at: string
  ends_at: string
}

const unitTypeOptions = [
  { value: '', label: 'غير محدد' },
  { value: 'kilo', label: 'كيلو' },
  { value: 'litre', label: 'لتر' },
  { value: 'carton', label: 'كرتون' },
  { value: 'paquet', label: 'باكيت' },
  { value: 'sac', label: 'كيس' },
  { value: 'unit', label: 'وحدة' },
]

const formatDate = (value?: string | null) => {
  if (!value) return ''
  return new Date(value).toISOString().split('T')[0]
}

function ProductPicker({
  value,
  onChange,
  products,
  categories,
  placeholder,
}: {
  value: string
  onChange: (id: string) => void
  products: ProductOption[]
  categories: Category[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name_ar.toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase())
    const matchCat = !catFilter || p.category_id === catFilter
    return matchSearch && matchCat
  })

  const selected = products.find(p => p.id === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white hover:border-indigo-400 transition text-right"
      >
        {selected ? (
          <>
            {selected.image_url ? (
              <img src={selected.image_url} className="w-8 h-8 rounded object-contain bg-gray-50 flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Package size={14} className="text-gray-400" />
              </div>
            )}
            <span className="flex-1 text-gray-800 text-sm truncate">{selected.name_ar}</span>
            <button type="button" onClick={e => { e.stopPropagation(); onChange('') }} className="text-gray-400 hover:text-red-500">
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-gray-400 text-sm">{placeholder}</span>
            <ChevronDown size={16} className="text-gray-400" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl">
          <div className="p-2 border-b border-gray-100 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute right-2 top-2.5 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ابحث..."
                className="w-full pr-7 pl-2 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-indigo-400"
              />
            </div>
            {categories.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => setCatFilter('')}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition ${
                    !catFilter ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  الكل
                </button>
                {categories.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCatFilter(c.id)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium transition ${
                      catFilter === c.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {c.name_ar}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-4">لا توجد نتائج</p>
            ) : (
              filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { onChange(p.id); setOpen(false); setSearch('') }}
                  className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 transition text-right ${
                    value === p.id ? 'bg-indigo-50' : ''
                  }`}
                >
                  {p.image_url ? (
                    <img src={p.image_url} className="w-9 h-9 rounded object-contain bg-gray-50 flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Package size={16} className="text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{p.name_ar}</p>
                    {p.sku && <p className="text-xs text-gray-400">{p.sku}</p>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  const [formData, setFormData] = useState<PromotionFormData>({
    title: '',
    type: 'gift',
    scope: 'product',
    product_id: '',
    min_quantity: '1',
    unit_type: '',
    discount_percent: '',
    gift_product_id: '',
    gift_quantity: '1',
    is_active: true,
    starts_at: '',
    ends_at: '',
  })

  useEffect(() => {
    fetchPromotions()
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        supabase.from('products').select('id, name_ar, image_url, sku, category_id').eq('is_active', true).order('name_ar'),
        supabase.from('product_categories').select('id, name_ar').eq('is_active', true).order('name_ar'),
      ])
      if (prodRes.error) throw prodRes.error
      setProducts((prodRes.data || []) as ProductOption[])
      setCategories((catRes.data || []) as Category[])
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  const fetchPromotions = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPromotions((data || []) as Promotion[])
    } catch (error) {
      console.error('Error loading promotions:', error)
    } finally {
      setLoading(false)
    }
  }

  const productMap = useMemo(() => {
    const map = new Map<string, string>()
    products.forEach((p) => map.set(p.id, p.name_ar))
    return map
  }, [products])

  const filteredPromotions = promotions.filter((promo) =>
    promo.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const resetForm = () => {
    setFormData({
      title: '',
      type: 'gift',
      scope: 'product',
      product_id: '',
      min_quantity: '1',
      unit_type: '',
      discount_percent: '',
      gift_product_id: '',
      gift_quantity: '1',
      is_active: true,
      starts_at: '',
      ends_at: '',
    })
    setEditingPromotion(null)
  }

  const openEditPromotion = (promo: Promotion) => {
    setEditingPromotion(promo)
    setFormData({
      title: promo.title || '',
      type: promo.type,
      scope: promo.scope,
      product_id: promo.product_id || '',
      min_quantity: String(promo.min_quantity ?? 1),
      unit_type: promo.unit_type || '',
      discount_percent: promo.discount_percent ? String(promo.discount_percent) : '',
      gift_product_id: promo.gift_product_id || '',
      gift_quantity: promo.gift_quantity ? String(promo.gift_quantity) : '1',
      is_active: promo.is_active,
      starts_at: formatDate(promo.starts_at),
      ends_at: formatDate(promo.ends_at),
    })
    setShowModal(true)
  }

  const handleAddPromotion = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      alert('يرجى إدخال عنوان العرض')
      return
    }

    if (formData.scope === 'product' && !formData.product_id) {
      alert('يرجى اختيار المنتج المستهدف')
      return
    }

    if (formData.type === 'discount' && (!formData.discount_percent || Number(formData.discount_percent) <= 0)) {
      alert('يرجى إدخال نسبة خصم صحيحة')
      return
    }

    if (formData.type === 'gift') {
      if (!formData.gift_product_id) {
        alert('يرجى اختيار المنتج الهدية')
        return
      }
      if (!formData.gift_quantity || Number(formData.gift_quantity) <= 0) {
        alert('يرجى إدخال كمية الهدية')
        return
      }
    }

    try {
      const payload = {
        title: formData.title.trim(),
        type: formData.type,
        scope: formData.scope,
        product_id: formData.scope === 'product' ? formData.product_id || null : null,
        min_quantity: Number(formData.min_quantity) || 1,
        unit_type: formData.unit_type || null,
        discount_percent: formData.type === 'discount' ? Number(formData.discount_percent) || 0 : null,
        gift_product_id: formData.type === 'gift' ? formData.gift_product_id || null : null,
        gift_quantity: formData.type === 'gift' ? Number(formData.gift_quantity) || 1 : null,
        is_active: formData.is_active,
        starts_at: formData.starts_at ? new Date(formData.starts_at).toISOString() : null,
        ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null,
      }

      const { error } = editingPromotion
        ? await supabase.from('promotions').update(payload).eq('id', editingPromotion.id)
        : await supabase.from('promotions').insert([payload])
      if (error) throw error

      resetForm()
      setShowModal(false)
      fetchPromotions()
    } catch (error) {
      console.error('Error adding promotion:', error)
      alert('حدث خطأ أثناء إضافة العرض')
    }
  }

  const handleDeletePromotion = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا العرض؟')) return
    try {
      const { error } = await supabase.from('promotions').delete().eq('id', id)
      if (error) throw error
      fetchPromotions()
    } catch (error) {
      console.error('Error deleting promotion:', error)
      alert('حدث خطأ أثناء حذف العرض')
    }
  }

  const renderScope = (promo: Promotion) => {
    if (promo.scope === 'global') return 'عرض عام'
    const name = promo.product_id ? productMap.get(promo.product_id) : ''
    return name ? `منتج: ${name}` : 'منتج محدد'
  }

  const renderBenefit = (promo: Promotion) => {
    if (promo.type === 'discount') {
      return `خصم ${promo.discount_percent || 0}%`
    }
    const giftName = promo.gift_product_id ? productMap.get(promo.gift_product_id) : ''
    return `هدية: ${giftName || 'منتج'} × ${promo.gift_quantity || 1}`
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">إدارة العروض</h1>
          <p className="text-gray-500 mt-1">إنشاء عروض حسب الكمية والهدايا</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus size={18} />
          إضافة عرض
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="ابحث عن عرض..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent outline-none text-gray-800"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">جاري التحميل...</div>
        ) : filteredPromotions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">لا توجد عروض</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">العرض</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">النطاق</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">الشرط</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">الفائدة</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">الحالة</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredPromotions.map((promo) => (
                  <tr key={promo.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-6 text-gray-800 font-medium">{promo.title}</td>
                    <td className="py-4 px-6 text-gray-600">{renderScope(promo)}</td>
                    <td className="py-4 px-6 text-gray-600">
                      {promo.min_quantity} {promo.unit_type || ''}
                    </td>
                    <td className="py-4 px-6 text-gray-600">{renderBenefit(promo)}</td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${promo.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {promo.is_active ? 'مفعل' : 'غير مفعل'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditPromotion(promo)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeletePromotion(promo.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 size={18} />
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

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {editingPromotion ? 'تعديل العرض' : 'إضافة عرض جديد'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setShowModal(false)
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPromotion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">عنوان العرض</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نوع العرض</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as PromotionFormData['type'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="gift">هدية</option>
                    <option value="discount">خصم</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نطاق العرض</label>
                  <select
                    value={formData.scope}
                    onChange={(e) => setFormData({ ...formData, scope: e.target.value as PromotionFormData['scope'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="product">منتج محدد</option>
                    <option value="global">عام لكل المنتجات</option>
                  </select>
                </div>
              </div>

              {formData.scope === 'product' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المنتج المستهدف</label>
                  <ProductPicker
                    value={formData.product_id}
                    onChange={(id) => setFormData({ ...formData, product_id: id })}
                    products={products}
                    categories={categories}
                    placeholder="اختر المنتج المستهدف..."
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأدنى للكمية</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.min_quantity}
                    onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">وحدة القياس</label>
                  <select
                    value={formData.unit_type}
                    onChange={(e) => setFormData({ ...formData, unit_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {unitTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    مفعل
                  </label>
                </div>
              </div>

              {formData.type === 'discount' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نسبة الخصم %</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.discount_percent}
                    onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              )}

              {formData.type === 'gift' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">منتج الهدية</label>
                    <ProductPicker
                      value={formData.gift_product_id}
                      onChange={(id) => setFormData({ ...formData, gift_product_id: id })}
                      products={products}
                      categories={categories}
                      placeholder="اختر منتج الهدية..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">كمية الهدية</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.gift_quantity}
                      onChange={(e) => setFormData({ ...formData, gift_quantity: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ البداية</label>
                  <input
                    type="date"
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ النهاية</label>
                  <input
                    type="date"
                    value={formData.ends_at}
                    onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition"
                >
                  حفظ العرض
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm()
                    setShowModal(false)
                  }}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition"
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
