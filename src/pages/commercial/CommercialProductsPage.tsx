import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Search, Package, ArrowLeft } from 'lucide-react'
import { getCategoryLabelArabic } from '../../utils/categoryLabels'

interface Product {
  id: string
  name_ar: string
  sku: string
  price_a: number
  price_b: number
  price_c: number
  price_d: number
  price_e: number
  stock: number
  category_id?: string
  image_url?: string
  is_active_for_commercial?: boolean
}

const BATCH_SIZE = 300

interface Category {
  id: string
  name_ar: string
}

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
}

export default function CommercialProductsPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [allowedTiers, setAllowedTiers] = useState<string[]>([])
  const loadingRef = useRef(false)

  const loadAll = async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      // 0) Fetch employee's allowed_price_tiers
      const commercialId = localStorage.getItem('commercial_id')
      if (commercialId) {
        let tiers: string[] = []

        // Try 1: direct lookup by id
        const { data: empData } = await supabase
          .from('employees')
          .select('id, name, phone, allowed_price_tiers')
          .eq('id', commercialId)
          .single()

        if (empData?.allowed_price_tiers) {
          tiers = empData.allowed_price_tiers
        } else {
          // Try 2: find via auth session → user_accounts → employee by phone
          const { data: { user } } = await supabase.auth.getUser()
          if (user?.email) {
            const { data: ua } = await supabase
              .from('user_accounts')
              .select('full_name, username')
              .eq('email', user.email)
              .single()
            if (ua?.username) {
              // username is the phone number, find employee by phone
              const { data: empByPhone } = await supabase
                .from('employees')
                .select('id, name, phone, allowed_price_tiers')
                .eq('phone', ua.username)
                .single()
              if (empByPhone?.allowed_price_tiers) {
                tiers = empByPhone.allowed_price_tiers
              }
            }
          }
        }

        setAllowedTiers(tiers)
        if (tiers.length > 0) {
          localStorage.setItem('commercial_allowed_price_tiers', JSON.stringify(tiers))
        } else {
          localStorage.removeItem('commercial_allowed_price_tiers')
        }
        console.log('Employee allowed_price_tiers:', tiers)
      }

      // 1) Fetch products, variants, categories, promotions ALL in parallel
      const fetchAllPages = async (table: string, select: string, filters?: { col: string, val: any }[]) => {
        let allData: any[] = []
        let from = 0
        const pageSize = 1000
        while (true) {
          let query = supabase.from(table).select(select).range(from, from + pageSize - 1)
          if (filters) for (const f of filters) query = query.eq(f.col, f.val)
          const { data: page, error } = await query
          if (error) throw error
          if (!page || page.length === 0) break
          allData = allData.concat(page)
          if (page.length < pageSize) break
          from += pageSize
        }
        return allData
      }

      const [allProducts, allVariants, catRes, promoRes] = await Promise.all([
        fetchAllPages('products', 'id, name_ar, sku, stock, category_id, image_url, is_active_for_commercial', [{ col: 'is_active', val: true }]),
        fetchAllPages('product_variants', 'product_id, price_a, price_b, price_c, price_d, price_e, stock, unit_type', [{ col: 'is_active', val: true }]),
        supabase.from('product_categories').select('id, name_ar').order('name_ar'),
        supabase.from('promotions').select('*').eq('is_active', true).order('created_at', { ascending: false })
      ])

      // Build variant lookup map
      const variantMap = new Map<string, any>()
      for (const v of allVariants) {
        if (!variantMap.has(v.product_id)) variantMap.set(v.product_id, v)
      }

      const visibleProducts = allProducts.filter((p: any) => p.is_active_for_commercial !== false)

      // Enrich products with variant prices
      const enriched = visibleProducts.map((p: any) => {
        const v = variantMap.get(p.id)
        return {
          ...p,
          price_a: v?.price_a || p.price_a || 0,
          price_b: v?.price_b || p.price_b || 0,
          price_c: v?.price_c || p.price_c || 0,
          price_d: v?.price_d || p.price_d || 0,
          price_e: v?.price_e || p.price_e || 0,
          stock: v?.stock ?? p.stock ?? 0,
        }
      })

      setProducts(enriched)
      setCategories((catRes.data || []) as Category[])
      setPromotions((promoRes.data || []) as Promotion[])
      console.log('CommercialProducts loaded:', enriched.length, 'products')
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  useEffect(() => {
    const commercialId = localStorage.getItem('commercial_id')
    if (!commercialId) {
      navigate('/commercial/login')
      return
    }
    loadAll()
  }, [navigate])

  // Reload on tab focus (debounced via loadingRef)
  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) loadAll() }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || product.category_id === selectedCategory
    return matchesSearch && matchesCategory
  })

  const shortCategoryLabel = (tier: string) =>
    getCategoryLabelArabic(tier).split('/')[0].trim() || tier

  const activePromotions = promotions.filter((promo) => {
    if (!promo.is_active) return false
    const now = new Date()
    if (promo.starts_at && new Date(promo.starts_at) > now) return false
    if (promo.ends_at && new Date(promo.ends_at) < now) return false
    return true
  })

  const getProductPromotions = (productId: string) =>
    activePromotions.filter(
      (promo) => promo.scope === 'global' || promo.product_id === productId
    )

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/commercial/dashboard')}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold">المنتجات</h1>
            <p className="text-purple-100 text-sm">عرض المنتجات والأسعار</p>
          </div>
          <button
            onClick={() => navigate('/commercial/orders/new')}
            className="mr-auto bg-white text-purple-700 px-4 py-2 rounded-lg font-bold hover:bg-purple-50 transition-colors"
          >
            إنشاء طلب
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-3 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300"
            placeholder="ابحث عن منتج..."
          />
        </div>
      </div>

      {/* Categories Filter */}
      <div className="bg-white p-4 shadow-sm overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              !selectedCategory
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            الكل ({products.length})
          </button>
          {categories.map((category) => {
            const count = products.filter(p => p.category_id === category.id).length
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.name_ar} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Products Grid - Card View */}
      <div className="p-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            جاري التحميل...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">لا توجد منتجات</p>
            <button
              onClick={() => navigate('/commercial/orders/new')}
              className="mt-4 bg-purple-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-purple-700 transition-colors"
            >
              ابدأ التسوق
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map((product) => {
              const productPromotions = getProductPromotions(product.id)
              return (
              <div
                key={product.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Product Image */}
                <div className="bg-gray-100 h-20 flex items-center justify-center overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name_ar}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package size={24} className="text-gray-400" />
                  )}
                </div>

                {/* Product Info */}
                <div className="p-2">
                  <h3 className="font-bold text-gray-800 text-xs mb-1 line-clamp-2">
                    {product.name_ar}
                  </h3>
                  <p className="text-xs text-gray-500 mb-2">
                    SKU: {product.sku || 'N/A'}
                  </p>

                  {/* Stock Badge */}
                  <div className={`text-xs font-medium px-2 py-1 rounded mb-2 inline-block ${
                    product.stock > 10
                      ? 'bg-green-100 text-green-700'
                      : product.stock > 0
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    المخزون: {product.stock}
                  </div>

                  {/* Prices Grid - Compact (filtered by allowed tiers) */}
                  <div className={`grid gap-1 bg-gray-50 rounded p-2 text-xs ${(() => {
                    const count = allowedTiers.length > 0 ? allowedTiers.length : 4
                    return count <= 2 ? 'grid-cols-2' : count === 3 ? 'grid-cols-3' : 'grid-cols-2'
                  })()}`}>
                    {(allowedTiers.length === 0 || allowedTiers.includes('A')) && (
                      <div className="text-center">
                        <p className="text-gray-500 text-xs">{shortCategoryLabel('A')}</p>
                        <p className="font-bold text-blue-600">{(product.price_a || 0).toFixed(0)}</p>
                      </div>
                    )}
                    {(allowedTiers.length === 0 || allowedTiers.includes('B')) && (
                      <div className="text-center">
                        <p className="text-gray-500 text-xs">{shortCategoryLabel('B')}</p>
                        <p className="font-bold text-green-600">{(product.price_b || 0).toFixed(0)}</p>
                      </div>
                    )}
                    {(allowedTiers.length === 0 || allowedTiers.includes('C')) && (
                      <div className="text-center">
                        <p className="text-gray-500 text-xs">{shortCategoryLabel('C')}</p>
                        <p className="font-bold text-orange-600">{(product.price_c || 0).toFixed(0)}</p>
                      </div>
                    )}
                    {(allowedTiers.length === 0 || allowedTiers.includes('D')) && (
                      <div className="text-center">
                        <p className="text-gray-500 text-xs">{shortCategoryLabel('D')}</p>
                        <p className="font-bold text-purple-600">{(product.price_d || 0).toFixed(0)}</p>
                      </div>
                    )}
                    {(allowedTiers.length === 0 || allowedTiers.includes('E')) && (
                      <div className="text-center">
                        <p className="text-gray-500 text-xs">{shortCategoryLabel('E')}</p>
                        <p className="font-bold text-red-600">{(product.price_e || 0).toFixed(0)}</p>
                      </div>
                    )}
                  </div>
                  {productPromotions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {productPromotions.map((promo) => (
                        <div
                          key={promo.id}
                          className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1"
                        >
                          <span className="font-semibold">{promo.title}</span>
                          <span className="mx-1">•</span>
                          {promo.type === 'discount'
                            ? `خصم ${promo.discount_percent || 0}% عند ${promo.min_quantity} ${promo.unit_type || ''}`
                            : `هدية عند ${promo.min_quantity} ${promo.unit_type || ''}`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  )
}
