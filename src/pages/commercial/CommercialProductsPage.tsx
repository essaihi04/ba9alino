import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Search, Package, ArrowLeft } from 'lucide-react'
import { getCategoryLabelArabic } from '../../utils/categoryLabels'

const PAGE_SIZE = 60

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const loadingRef = useRef(false)

  const loadAll = async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      // 0) Fetch employee's allowed_price_tiers
      const commercialId = localStorage.getItem('commercial_id')
      const commercialName = localStorage.getItem('commercial_name') || ''
      let tiers: string[] = []

      // Fetch all employees that have allowed_price_tiers configured
      const { data: empsWithTiers } = await supabase
        .from('employees')
        .select('id, name, phone, allowed_price_tiers')
        .not('allowed_price_tiers', 'is', null)

      if (empsWithTiers && empsWithTiers.length > 0) {
        // Try match by id
        let match = empsWithTiers.find(e => e.id === commercialId)
        // Try match by exact name
        if (!match) match = empsWithTiers.find(e => e.name === commercialName)
        // Try match by partial name (either direction)
        if (!match) match = empsWithTiers.find(e =>
          e.name?.toLowerCase().includes(commercialName.toLowerCase()) ||
          commercialName.toLowerCase().includes(e.name?.toLowerCase() || '')
        )
        // Try match by phone via user_accounts
        if (!match) {
          const { data: { user } } = await supabase.auth.getUser()
          if (user?.email) {
            const { data: ua } = await supabase
              .from('user_accounts')
              .select('username')
              .eq('email', user.email)
              .maybeSingle()
            if (ua?.username) {
              match = empsWithTiers.find(e => e.phone === ua.username)
            }
          }
        }
        if (match?.allowed_price_tiers && match.allowed_price_tiers.length > 0) {
          tiers = match.allowed_price_tiers
          console.log('[TIERS] matched employee:', match.name, tiers)
        }
      }

      setAllowedTiers(tiers)
      if (tiers.length > 0) {
        localStorage.setItem('commercial_allowed_price_tiers', JSON.stringify(tiers))
      } else {
        localStorage.removeItem('commercial_allowed_price_tiers')
      }
      console.log('[TIERS] final:', tiers)

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
        supabase.from('product_categories').select('id, name_ar').eq('is_active', true).order('name_ar'),
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

  const filteredProducts = useMemo(() => products.filter(product => {
    const matchesSearch = product.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || product.category_id === selectedCategory
    return matchesSearch && matchesCategory
  }), [products, searchQuery, selectedCategory])

  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [searchQuery, selectedCategory])

  const displayedProducts = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount])
  const hasMore = visibleCount < filteredProducts.length

  const loadMore = useCallback(() => {
    setVisibleCount(prev => prev + PAGE_SIZE)
  }, [])

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

      {/* Categories Filter - max 3 rows, scrollable */}
      <div className="bg-white p-3 shadow-sm overflow-y-auto" style={{ maxHeight: '140px' }}>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
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
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
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
          <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayedProducts.map((product) => {
              const productPromotions = getProductPromotions(product.id)
              // Get the appropriate price based on allowed tiers
              const getDisplayPrice = () => {
                if (allowedTiers.length === 1) {
                  const tier = allowedTiers[0]
                  switch(tier) {
                    case 'A': return product.price_a || 0
                    case 'B': return product.price_b || 0
                    case 'C': return product.price_c || 0
                    case 'D': return product.price_d || 0
                    case 'E': return product.price_e || 0
                    default: return product.price_a || 0
                  }
                }
                return product.price_a || 0
              }
              return (
              <div
                key={product.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow border border-gray-100"
              >
                {/* Product Image - Large */}
                <div className="bg-gray-50 aspect-square flex items-center justify-center overflow-hidden relative">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name_ar}
                      className="w-full h-full object-contain p-2"
                      loading="lazy"
                    />
                  ) : (
                    <Package size={48} className="text-gray-300" />
                  )}
                  {/* Stock indicator */}
                  <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${
                    product.stock > 10 ? 'bg-green-500' : product.stock > 0 ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                </div>

                {/* Product Info - Minimal */}
                <div className="p-3">
                  <h3 className="font-semibold text-gray-800 text-sm mb-2 line-clamp-2 text-center">
                    {product.name_ar}
                  </h3>
                  
                  {/* Single Price Display */}
                  <div className="text-center">
                    <p className="text-lg font-bold text-purple-600">
                      {getDisplayPrice().toFixed(0)} DH
                    </p>
                  </div>
                  
                  {productPromotions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {productPromotions.map((promo) => (
                        <div
                          key={promo.id}
                          className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 text-center"
                        >
                          {promo.type === 'discount'
                            ? `خصم ${promo.discount_percent || 0}%`
                            : `هدية`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )})}
          </div>
          {hasMore && (
            <div className="text-center mt-6 mb-4">
              <button
                onClick={loadMore}
                className="bg-purple-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-purple-700 transition-colors"
              >
                عرض المزيد ({filteredProducts.length - visibleCount} متبقي)
              </button>
            </div>
          )}
          {!hasMore && filteredProducts.length > PAGE_SIZE && (
            <p className="text-center text-gray-400 text-sm mt-4">تم عرض جميع المنتجات ({filteredProducts.length})</p>
          )}
          </>
        )}
      </div>
    </div>
  )
}
