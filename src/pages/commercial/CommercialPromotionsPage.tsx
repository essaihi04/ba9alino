import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ShoppingCart, Plus, Minus, Package, Flame, Users, ChevronDown, X } from 'lucide-react'
import CommercialLayout from '../../components/commercial/CommercialLayout'

interface Client {
  id: string
  company_name_ar: string
  subscription_tier: string
  is_active: boolean
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

interface Product {
  id: string
  name_ar: string
  image_url: string | null
  price_a: number
  price_b: number
  price_c: number
  price_d: number
  price_e: number
  stock: number
  sku: string | null
  unit_type: string | null
}

interface CartItem extends Product {
  quantity: number
  promoPrice: number
  promoLabel: string
}

export default function CommercialPromotionsPage() {
  const navigate = useNavigate()
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const clientDropdownRef = useRef<HTMLDivElement>(null)

  const subscriptionTier = useMemo(() => {
    // Use selected client's tier or default to E
    return selectedClient?.subscription_tier || 'E'
  }, [selectedClient])

  useEffect(() => {
    const commercialId = localStorage.getItem('commercial_id')
    if (!commercialId) {
      navigate('/commercial/login')
      return
    }
    fetchData()
    loadClients()
  }, [navigate])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadClients = async () => {
    try {
      const commercialId = localStorage.getItem('commercial_id')
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name_ar, subscription_tier, is_active')
        .eq('commercial_id', commercialId)
        .eq('is_active', true)
        .order('company_name_ar')
      if (error) throw error
      setClients((data || []) as Client[])
    } catch (error) {
      console.error('Error loading clients:', error)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const [promoRes, productsRes] = await Promise.all([
        supabase.from('promotions').select('*').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('products').select('id, name_ar, image_url, sku, stock, price_a, price_b, price_c, price_d, price_e').eq('is_active', true).order('name_ar')
      ])
      if (promoRes.error) console.error('Promo error:', promoRes.error)
      if (productsRes.error) console.error('Products error:', productsRes.error)
      console.log('Products data:', productsRes.data?.slice(0, 3))

      const enriched = (productsRes.data || []).map((p: any) => ({
        ...p,
        price_a: p.price_a ?? 10.0,
        price_b: p.price_b ?? 10.0,
        price_c: p.price_c ?? 10.0,
        price_d: p.price_d ?? 10.0,
        price_e: p.price_e ?? 10.0,
        stock: p.stock ?? 0,
        unit_type: null,
      }))

      setPromotions((promoRes.data || []) as Promotion[])
      setProducts(enriched as Product[])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getBasePrice = (product: Product): number => {
    const tier = subscriptionTier.toUpperCase()
    if (tier === 'A') return product.price_a
    if (tier === 'B') return product.price_b
    if (tier === 'C') return product.price_c
    if (tier === 'D') return product.price_d
    return product.price_e
  }

  // Build a map: product_id -> best promo (discount or gift)
  const promoMap = useMemo(() => {
    const map = new Map<string, { promo: Promotion; discountedPrice: number; label: string }>()
    promotions.forEach((promo) => {
      const applyToProduct = (pid: string) => {
        const product = products.find(p => p.id === pid)
        if (!product) return
        const base = getBasePrice(product)
        let discounted = base
        let label = ''
        if (promo.type === 'discount' && promo.discount_percent) {
          discounted = base * (1 - promo.discount_percent / 100)
          label = `-${promo.discount_percent}%`
        } else if (promo.type === 'gift') {
          discounted = base
          label = promo.title || 'هدية'
        } else {
          return
        }
        const existing = map.get(pid)
        if (!existing || discounted < existing.discountedPrice) {
          map.set(pid, { promo, discountedPrice: discounted, label })
        }
      }
      if (promo.scope === 'global') {
        products.forEach(p => applyToProduct(p.id))
      } else if (promo.product_id) {
        applyToProduct(promo.product_id)
      }
    })
    return map
  }, [promotions, products, subscriptionTier])

  // Only show products that have a promo
  const promoProducts = useMemo(() => {
    return products.filter(p => promoMap.has(p.id))
  }, [products, promoMap])

  const addToCart = (product: Product) => {
    const promoInfo = promoMap.get(product.id)
    const promoPrice = promoInfo ? promoInfo.discountedPrice : getBasePrice(product)
    const promoLabel = promoInfo ? promoInfo.label : ''
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id)
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { ...product, quantity: 1, promoPrice, promoLabel }]
    })
  }

  const updateQty = (id: string, delta: number) => {
    setCart(prev => {
      const next = prev
        .map(i => (i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i))
      return next
    })
  }

  const setQty = (id: string, rawValue: string | number) => {
    const parsed = typeof rawValue === 'number' ? rawValue : parseInt(rawValue, 10)
    const safeValue = Number.isFinite(parsed) && parsed > 0 ? parsed : 1
    setCart(prev => prev.map(i => (i.id === id ? { ...i, quantity: safeValue } : i)))
  }

  const cartTotal = cart.reduce((sum, i) => sum + i.promoPrice * i.quantity, 0)
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)

  const filteredClients = clients.filter(c => 
    c.company_name_ar.toLowerCase().includes(clientSearch.toLowerCase())
  )

  return (
    <CommercialLayout
      title="العروض الحصرية"
      subtitle={`${promoProducts.length} منتج بعرض خاص`}
      headerRight={
        cartCount > 0 ? (
          <button
            onClick={() => setShowCart(true)}
            className="relative bg-white/20 p-2 rounded-xl active:bg-white/30"
          >
            <ShoppingCart size={20} />
            <span className="absolute -top-1 -left-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {cartCount}
            </span>
          </button>
        ) : undefined
      }
    >
      {/* Client Selector */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Users size={18} className="text-indigo-600" />
          <span className="text-sm font-medium text-gray-700">العميل</span>
        </div>
        <div ref={clientDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setShowClientDropdown(!showClientDropdown)}
            className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white hover:border-indigo-400 transition text-right"
          >
            {selectedClient ? (
              <>
                <span className="flex-1 text-gray-800 text-sm">{selectedClient.company_name_ar}</span>
                <span 
                  onClick={(e) => { e.stopPropagation(); setSelectedClient(null); }} 
                  className="text-gray-400 hover:text-red-500 cursor-pointer"
                >
                  <X size={14} />
                </span>
              </>
            ) : (
              <>
                <span className="flex-1 text-gray-400 text-sm">اختر العميل...</span>
                <ChevronDown size={16} className="text-gray-400" />
              </>
            )}
          </button>

          {showClientDropdown && (
            <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl">
              <div className="p-2 border-b border-gray-100">
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="ابحث عن عميل..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-indigo-400"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredClients.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-4">لا توجد عملاء</p>
                ) : (
                  filteredClients.map(client => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => {
                        setSelectedClient(client)
                        setShowClientDropdown(false)
                        setClientSearch('')
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 transition text-right ${
                        selectedClient?.id === client.id ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <span className="flex-1 text-sm text-gray-800">{client.company_name_ar}</span>
                      <span className="text-xs text-gray-400">{client.subscription_tier}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        {!selectedClient && (
          <p className="text-xs text-amber-600 mt-2">يرجى اختيار العميل لتفعيل إضافة المنتجات للسلة</p>
        )}
      </div>

      {/* Product List */}
      <div className="pb-32">
        {loading ? (
          <div className="text-center py-16 text-gray-500">جاري التحميل...</div>
        ) : promoProducts.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Package size={48} className="mx-auto mb-3 text-gray-300" />
            <p>لا توجد عروض حالياً</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {promoProducts.map((product) => {
              const promoInfo = promoMap.get(product.id)!
              const basePrice = getBasePrice(product)
              const promoPrice = promoInfo.discountedPrice
              const inCart = cart.find(i => i.id === product.id)

              return (
                <div key={product.id} className="bg-white flex items-center gap-3 p-4">
                  {/* Product Image */}
                  <div className="w-20 h-20 flex-shrink-0 bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name_ar} className="w-full h-full object-contain p-1" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={28} className="text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {/* Promo badge */}
                    <div className="flex items-center gap-1 mb-1">
                      <Flame size={14} className="text-orange-500" />
                      <span className="text-xs font-bold text-orange-500">
                        بالروميز {promoPrice.toFixed(2)} د.م{product.unit_type ? ` / ${product.unit_type}` : ''}
                      </span>
                    </div>

                    {/* Normal price */}
                    <p className="text-lg font-bold text-gray-800">{basePrice.toFixed(2)} د.م</p>

                    {/* Product name */}
                    <p className="text-sm text-gray-600 truncate">{product.name_ar}</p>

                    {/* Unit type */}
                    {product.sku && (
                      <p className="text-xs text-gray-400 mt-0.5">{product.sku}</p>
                    )}
                  </div>

                  {/* Add to cart */}
                  <div className="flex-shrink-0">
                    {inCart ? (
                      <div className="flex items-center gap-2 bg-emerald-50 rounded-xl p-1">
                        <button
                          onClick={() => updateQty(product.id, -1)}
                          className="w-8 h-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-200"
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          min={1}
                          inputMode="numeric"
                          value={inCart.quantity}
                          onChange={e => setQty(product.id, e.target.value)}
                          className="w-12 text-center text-sm font-bold border border-gray-200 rounded-lg py-1"
                        />
                        <button
                          onClick={() => updateQty(product.id, 1)}
                          className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center hover:bg-emerald-200"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          console.log('Add to cart clicked:', { 
                            selectedClient: selectedClient?.company_name_ar, 
                            productId: product.id, 
                            productName: product.name_ar,
                            basePrice: getBasePrice(product),
                            priceA: product.price_a,
                            priceB: product.price_b,
                            priceC: product.price_c,
                            priceD: product.price_d,
                            priceE: product.price_e
                          })
                          addToCart(product)
                        }}
                        disabled={!selectedClient}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        أضف للسلة
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-4 right-4 left-4 z-30 bg-emerald-600 text-white rounded-2xl shadow-2xl p-4 flex items-center justify-between hover:bg-emerald-700 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ShoppingCart size={22} />
            <span className="font-bold">{cartCount} منتج</span>
          </div>
          <span className="text-xl font-bold">{cartTotal.toFixed(2)} د.م</span>
        </button>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-end" onClick={() => setShowCart(false)}>
          <div className="bg-white w-full rounded-t-3xl max-h-[80vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">السلة</h2>
              <button onClick={() => setShowCart(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">×</button>
            </div>
            <div className="space-y-3 mb-4">
              {cart.map(item => (
                <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{item.name_ar}</p>
                    <p className="text-xs text-emerald-600">{item.promoPrice.toFixed(2)} د.م × {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={item.quantity}
                      onChange={e => setQty(item.id, e.target.value)}
                      className="w-12 text-center text-sm font-bold border border-gray-200 rounded-lg py-1"
                    />
                    <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                      <Plus size={12} />
                    </button>
                  </div>
                  <p className="font-bold text-gray-800 min-w-[60px] text-left">{(item.promoPrice * item.quantity).toFixed(2)}</p>
                </div>
              ))}
            </div>
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-bold text-gray-800">المجموع</span>
                <span className="text-2xl font-bold text-emerald-600">{cartTotal.toFixed(2)} د.م</span>
              </div>
              <button
                onClick={() => {
                  const normalizedCart = cart.map(item => {
                    const promoInfo = promoMap.get(item.id)
                    const promoPrice = promoInfo ? promoInfo.discountedPrice : getBasePrice(item)
                    return {
                      ...item,
                      selectedPrice: promoPrice,
                      promoPrice, // keep reference for later if needed
                    }
                  })
                  sessionStorage.setItem('preloadedCart', JSON.stringify(normalizedCart))
                  if (selectedClient) {
                    sessionStorage.setItem('preloadedClient', JSON.stringify(selectedClient))
                  }
                  navigate('/commercial/orders/new')
                }}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700"
              >
                تأكيد الطلب
              </button>
            </div>
          </div>
        </div>
      )}
    </CommercialLayout>
  )
}
