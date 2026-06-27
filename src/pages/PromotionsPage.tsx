import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Trash2, Edit2, Package, X, Gift } from 'lucide-react'
import { supabase } from '../lib/supabase'
import SubmitButton from '../components/SubmitButton'
import { normalizeSearch } from '../utils/searchNormalize'

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
  price_a?: number | null
  price_b?: number | null
  price_c?: number | null
  price_d?: number | null
  price_e?: number | null
  cost_price?: number | null
}

const firstNonZero = (values: Array<number | null | undefined>) => {
  for (const v of values) {
    const n = Number(v || 0)
    if (n > 0) return n
  }
  return 0
}

// Prix affiche facon caisse : premier prix non nul (E par defaut puis A..D)
const getDisplayPrice = (p: ProductOption) =>
  firstNonZero([p.price_e, p.price_a, p.price_b, p.price_c, p.price_d])

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

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  // Filtres de la grille de produits DANS la fenetre d'ajout de promotion
  const [modalSearch, setModalSearch] = useState('')
  const [modalCat, setModalCat] = useState('')
  const [showModal, setShowModal] = useState(false)
  // Sélection multiple des produits cibles (façon caisse)
  const [targetProductIds, setTargetProductIds] = useState<string[]>([])
  // Ce que sélectionne un clic dans la grille : produit cible ou produit cadeau
  const [gridMode, setGridMode] = useState<'target' | 'gift'>('target')
  // Pagination de la grille (30 produits par page pour ne pas ralentir)
  const [modalPage, setModalPage] = useState(1)
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
        supabase.from('products').select('id, name_ar, image_url, sku, category_id, price_a, price_b, price_c, price_d, price_e, cost_price').eq('is_active', true).order('name_ar'),
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

  // Produits filtres pour la grille de la fenetre d'ajout de promotion
  const modalProducts = useMemo(() => {
    const q = normalizeSearch(modalSearch)
    return products.filter((p) => {
      const matchSearch = !q || normalizeSearch(p.name_ar).includes(q) || normalizeSearch(p.sku).includes(q)
      const matchCat = !modalCat || p.category_id === modalCat
      return matchSearch && matchCat
    })
  }, [products, modalSearch, modalCat])

  // Pagination : on n'affiche que 30 produits par page
  const MODAL_PAGE_SIZE = 30
  const modalTotalPages = Math.max(1, Math.ceil(modalProducts.length / MODAL_PAGE_SIZE))
  const pagedModalProducts = useMemo(
    () => modalProducts.slice((modalPage - 1) * MODAL_PAGE_SIZE, modalPage * MODAL_PAGE_SIZE),
    [modalProducts, modalPage],
  )

  // Revenir à la première page quand la recherche/filtre change
  useEffect(() => {
    setModalPage(1)
  }, [modalSearch, modalCat])

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
    setModalSearch('')
    setModalCat('')
    setTargetProductIds([])
    setGridMode('target')
    setModalPage(1)
  }

  const openEditPromotion = (promo: Promotion) => {
    setEditingPromotion(promo)
    setModalSearch('')
    setModalCat('')
    setTargetProductIds(promo.product_id ? [promo.product_id] : [])
    setGridMode('target')
    setModalPage(1)
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

    if (formData.scope === 'product' && targetProductIds.length === 0) {
      alert('يرجى اختيار منتج واحد على الأقل')
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

    if (saving) return
    setSaving(true)
    try {
      const buildPayload = (productId: string | null) => ({
        title: formData.title.trim(),
        type: formData.type,
        scope: formData.scope,
        product_id: formData.scope === 'product' ? productId : null,
        min_quantity: Number(formData.min_quantity) || 1,
        unit_type: formData.unit_type || null,
        discount_percent: formData.type === 'discount' ? Number(formData.discount_percent) || 0 : null,
        gift_product_id: formData.type === 'gift' ? formData.gift_product_id || null : null,
        gift_quantity: formData.type === 'gift' ? Number(formData.gift_quantity) || 1 : null,
        is_active: formData.is_active,
        starts_at: formData.starts_at ? new Date(formData.starts_at).toISOString() : null,
        ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null,
      })

      if (formData.scope === 'global') {
        const payload = buildPayload(null)
        const { error } = editingPromotion
          ? await supabase.from('promotions').update(payload).eq('id', editingPromotion.id)
          : await supabase.from('promotions').insert([payload])
        if (error) throw error
      } else {
        const targets = Array.from(new Set(targetProductIds))
        if (editingPromotion) {
          // On met à jour la promo existante avec le 1er produit et on crée
          // une promo supplémentaire pour chaque produit ajouté.
          const [first, ...rest] = targets
          const { error: upErr } = await supabase
            .from('promotions')
            .update(buildPayload(first))
            .eq('id', editingPromotion.id)
          if (upErr) throw upErr
          if (rest.length > 0) {
            const { error: insErr } = await supabase
              .from('promotions')
              .insert(rest.map((id) => buildPayload(id)))
            if (insErr) throw insErr
          }
        } else {
          // Création : une promo par produit sélectionné
          const { error } = await supabase
            .from('promotions')
            .insert(targets.map((id) => buildPayload(id)))
          if (error) throw error
        }
      }

      resetForm()
      setShowModal(false)
      fetchPromotions()
    } catch (error) {
      console.error('Error adding promotion:', error)
      alert('حدث خطأ أثناء إضافة العرض')
    } finally {
      setSaving(false)
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
          onClick={() => { resetForm(); setShowModal(true) }}
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* En-tête */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
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

            <form onSubmit={handleAddPromotion} className="flex flex-col md:flex-row flex-1 min-h-0">
              {/* DROITE (RTL = en premier) : sélection du produit façon caisse */}
              <div className="md:w-1/2 flex flex-col min-h-0 border-b md:border-b-0 md:border-l border-gray-200 bg-gray-50/50">
                <div className="p-4 space-y-2 border-b border-gray-100">
                  {formData.type === 'gift' && (
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                      <button
                        type="button"
                        onClick={() => setGridMode('target')}
                        className={`flex-1 text-xs font-bold py-1.5 rounded-md transition ${
                          gridMode === 'target' ? 'bg-white text-indigo-700 shadow' : 'text-gray-500'
                        }`}
                      >
                        المنتجات المستهدفة ({targetProductIds.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setGridMode('gift')}
                        className={`flex-1 text-xs font-bold py-1.5 rounded-md transition ${
                          gridMode === 'gift' ? 'bg-white text-pink-700 shadow' : 'text-gray-500'
                        }`}
                      >
                        منتج الهدية {formData.gift_product_id ? '✓' : ''}
                      </button>
                    </div>
                  )}
                  <label className="block text-sm font-bold text-gray-700">
                    {gridMode === 'gift' ? 'اختر منتج الهدية' : 'اختر المنتجات المستهدفة (اختيار متعدد)'}
                  </label>
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                    <Search size={18} className="text-gray-400" />
                    <input
                      type="text"
                      placeholder="ابحث عن منتج..."
                      value={modalSearch}
                      onChange={(e) => setModalSearch(e.target.value)}
                      className="flex-1 bg-transparent outline-none text-gray-800 text-sm"
                    />
                  </div>
                  <select
                    value={modalCat}
                    onChange={(e) => setModalCat(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">كل العائلات ({products.length})</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_ar}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                  {formData.scope === 'global' && gridMode === 'target' ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 gap-2 py-10">
                      <Package size={32} className="text-gray-300" />
                      <p className="text-sm">العرض عام لكل المنتجات</p>
                      <p className="text-xs text-gray-400">اختر «منتج محدد» في النطاق لتحديد منتجات</p>
                    </div>
                  ) : modalProducts.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-10">لا توجد منتجات</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {pagedModalProducts.map((product) => {
                          const isSelected =
                            gridMode === 'gift'
                              ? formData.gift_product_id === product.id
                              : targetProductIds.includes(product.id)
                          const accent = gridMode === 'gift' ? 'pink' : 'indigo'
                          const onClick = () => {
                            if (gridMode === 'gift') {
                              setFormData((prev) => ({ ...prev, gift_product_id: product.id }))
                            } else {
                              setFormData((prev) => ({ ...prev, scope: 'product' }))
                              setTargetProductIds((prev) =>
                                prev.includes(product.id)
                                  ? prev.filter((id) => id !== product.id)
                                  : [...prev, product.id],
                              )
                            }
                          }
                          return (
                            <button
                              key={product.id}
                              type="button"
                              onClick={onClick}
                              className={`relative p-1.5 rounded border bg-white transition-all text-right hover:shadow ${
                                isSelected
                                  ? accent === 'pink'
                                    ? 'border-pink-600 ring-2 ring-pink-300'
                                    : 'border-indigo-600 ring-2 ring-indigo-300'
                                  : 'border-gray-200 hover:border-indigo-400'
                              }`}
                            >
                              {isSelected && (
                                <span className={`absolute top-1 right-1 z-10 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                  accent === 'pink' ? 'bg-pink-600' : 'bg-indigo-600'
                                }`}>
                                  ✓
                                </span>
                              )}
                              <div className="w-full h-20 mb-1 flex items-center justify-center bg-gray-50 rounded overflow-hidden">
                                {product.image_url ? (
                                  <img
                                    src={product.image_url}
                                    alt={product.name_ar}
                                    className="w-full h-full object-contain rounded"
                                    loading="lazy"
                                    decoding="async"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none'
                                      e.currentTarget.parentElement?.classList.add('bg-gray-100')
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded">
                                    <Package size={16} className="text-gray-400" />
                                  </div>
                                )}
                              </div>
                              <div className="text-[11px] font-bold text-gray-800 leading-tight line-clamp-2 min-h-[28px]">
                                {product.name_ar}
                              </div>
                              <div className="text-[12px] font-bold text-green-600">
                                {getDisplayPrice(product).toFixed(2)}
                              </div>
                            </button>
                          )
                        })}
                      </div>

                      {modalTotalPages > 1 && (
                        <div className="mt-3 flex items-center justify-center gap-2 pb-1">
                          <button
                            type="button"
                            onClick={() => setModalPage((p) => Math.max(1, p - 1))}
                            disabled={modalPage <= 1}
                            className="px-3 py-1.5 text-xs rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            السابق
                          </button>
                          <span className="text-xs font-semibold text-gray-700">
                            {modalPage} / {modalTotalPages}
                          </span>
                          <button
                            type="button"
                            onClick={() => setModalPage((p) => Math.min(modalTotalPages, p + 1))}
                            disabled={modalPage >= modalTotalPages}
                            className="px-3 py-1.5 text-xs rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            التالي
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* GAUCHE : détails de la promotion */}
              <div className="md:w-1/2 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
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
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                  <div className="text-sm text-gray-500 mb-1">
                    المنتجات المختارة ({targetProductIds.length})
                  </div>
                  {targetProductIds.length === 0 ? (
                    <p className="text-xs text-gray-400">لم يتم اختيار منتجات بعد ← اختر من القائمة</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {targetProductIds.map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 bg-white border border-indigo-200 text-indigo-700 text-xs font-medium px-2 py-1 rounded-full"
                        >
                          {productMap.get(id) || 'منتج'}
                          <button
                            type="button"
                            onClick={() => setTargetProductIds((prev) => prev.filter((x) => x !== id))}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
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
                    <button
                      type="button"
                      onClick={() => setGridMode('gift')}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 border rounded-lg text-right transition ${
                        gridMode === 'gift' ? 'border-pink-400 bg-pink-50' : 'border-gray-300 bg-white hover:border-pink-300'
                      }`}
                    >
                      <span className={formData.gift_product_id ? 'text-pink-700 font-bold text-sm' : 'text-gray-400 text-sm'}>
                        {formData.gift_product_id ? (productMap.get(formData.gift_product_id) || 'منتج') : 'اختر منتج الهدية من القائمة ←'}
                      </span>
                      <Gift size={16} className="text-pink-500 flex-shrink-0" />
                    </button>
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

                </div>

                <div className="flex gap-3 p-4 border-t border-gray-200">
                  <SubmitButton
                    type="submit"
                    loading={saving}
                    className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition"
                  >
                    حفظ العرض
                  </SubmitButton>
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
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
