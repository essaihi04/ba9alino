import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCategoryLabelArabic } from '../../utils/categoryLabels'
import { ArrowLeft, Plus, Minus, ShoppingCart, User, Check, Package } from 'lucide-react'
import { useInputPad } from '../../components/useInputPad'

const PAGE_SIZE = 60

interface ProductVariant {
  price_a: number
  price_b: number
  price_c: number
  price_d: number
  price_e: number
  purchase_price: number
  stock: number
  unit_type: string
  quantity_contained: number
}

interface Product {
  id: string
  name_ar: string
  sku: string
  price: number
  price_a: number
  price_b: number
  price_c: number
  price_d: number
  price_e: number
  stock: number
  category_id?: string
  image_url?: string
  is_active_for_commercial?: boolean
  product_variants?: ProductVariant[]
}

interface Category {
  id: string
  name_ar: string
}

interface Client {
  id: string
  company_name_ar: string
  subscription_tier: string
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

interface CartItem extends Product {
  quantity: number
  selectedPrice: number
  is_gift?: boolean
  promotion_id?: string | null
}

interface NewClientForm {
  company_name_ar: string
  company_name_en: string
  contact_person_name: string
  contact_person_phone: string
  contact_person_email: string
  address: string
  city: string
  subscription_tier: string
  credit_limit: string
}

export default function CommercialNewOrderPage() {
  const navigate = useNavigate()
  const inputPad = useInputPad()
  const [searchParams] = useSearchParams()
  const preselectedClientId = searchParams.get('client')

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showClientModal, setShowClientModal] = useState(false)
  const [showCreateClientModal, setShowCreateClientModal] = useState(false)
  const [allowedTiers, setAllowedTiers] = useState<string[]>([])
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [showCartSummary, setShowCartSummary] = useState(false)
  const [clientForm, setClientForm] = useState<NewClientForm>({
    company_name_ar: '',
    company_name_en: '',
    contact_person_name: '',
    contact_person_phone: '',
    contact_person_email: '',
    address: '',
    city: '',
    subscription_tier: 'E',
    credit_limit: ''
  })

  useEffect(() => {
    const commercialId = localStorage.getItem('commercial_id')
    if (!commercialId) {
      navigate('/commercial/login')
      return
    }

    loadData(commercialId)
  }, [navigate])

  useEffect(() => {
    if (preselectedClientId && clients.length > 0) {
      const client = clients.find(c => c.id === preselectedClientId)
      if (client) setSelectedClient(client)
    }
  }, [preselectedClientId, clients])

  const loadingRef = useRef(false)

  // Reload on tab focus (debounced via loadingRef)
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        const cid = localStorage.getItem('commercial_id')
        if (cid) loadData(cid)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const loadData = async (commercialId: string) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      // 0) Fetch employee's allowed_price_tiers
      const commercialName = localStorage.getItem('commercial_name') || ''
      let tiers: string[] = []

      // Fetch all employees that have allowed_price_tiers configured
      const { data: empsWithTiers } = await supabase
        .from('employees')
        .select('id, name, phone, allowed_price_tiers')
        .not('allowed_price_tiers', 'is', null)

      if (empsWithTiers && empsWithTiers.length > 0) {
        let match = empsWithTiers.find(e => e.id === commercialId)
        if (!match) match = empsWithTiers.find(e => e.name === commercialName)
        if (!match) match = empsWithTiers.find(e =>
          e.name?.toLowerCase().includes(commercialName.toLowerCase()) ||
          commercialName.toLowerCase().includes(e.name?.toLowerCase() || '')
        )
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

      // 1) Fetch products, variants, categories, clients, promotions ALL in parallel
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

      const [allProducts, allVariants, catRes, clientsRes, promotionsRes] = await Promise.all([
        fetchAllPages('products', 'id, name_ar, sku, price, price_a, price_b, price_c, price_d, price_e, stock, category_id, image_url, is_active_for_commercial', [{ col: 'is_active', val: true }]),
        fetchAllPages('product_variants', 'product_id, price_a, price_b, price_c, price_d, price_e, purchase_price, stock, unit_type, quantity_contained', [{ col: 'is_active', val: true }]),
        supabase.from('product_categories').select('id, name_ar').eq('is_active', true).order('name_ar'),
        supabase.from('clients').select('*').eq('created_by', commercialId).order('company_name_ar'),
        supabase.from('promotions').select('*').eq('is_active', true).order('created_at', { ascending: false })
      ])

      // Build variant lookup map
      const variantMap = new Map<string, any[]>()
      for (const v of allVariants) {
        const existing = variantMap.get(v.product_id)
        if (!existing) variantMap.set(v.product_id, [v])
        else existing.push(v)
      }

      const visibleProducts = allProducts.filter((p: any) => p.is_active_for_commercial !== false)

      // Enrich products with variant data
      const enriched = visibleProducts.map((p: any) => {
        const vs = variantMap.get(p.id) || []
        return {
          ...p,
          product_variants: vs,
          price_a: vs[0]?.price_a || p.price_a || 0,
          price_b: vs[0]?.price_b || p.price_b || 0,
          price_c: vs[0]?.price_c || p.price_c || 0,
          price_d: vs[0]?.price_d || p.price_d || 0,
          price_e: vs[0]?.price_e || p.price_e || 0,
          stock: vs[0]?.stock ?? p.stock ?? 0,
        }
      })

      setProducts(enriched)
      setCategories((catRes.data || []) as Category[])
      setClients(clientsRes.data || [])
      setPromotions((promotionsRes.data || []) as Promotion[])
      console.log('NewOrder loaded:', enriched.length, 'products')
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  const getPriceForTier = (product: Product, tier: string): number => {
    // Utiliser les prix depuis product_variants si disponibles, sinon depuis le produit directement
    const variant = product.product_variants && product.product_variants.length > 0 ? product.product_variants[0] : null
    
    if (variant) {
      // Utiliser les prix du variant
      switch (tier) {
        case 'A': return variant.price_a > 0 ? variant.price_a : variant.price_a
        case 'B': return variant.price_b > 0 ? variant.price_b : variant.price_b
        case 'C': return variant.price_c > 0 ? variant.price_c : variant.price_c
        case 'D': return variant.price_d > 0 ? variant.price_d : variant.price_d
        case 'E': return variant.price_e > 0 ? variant.price_e : variant.price_e
        default: return variant.price_e > 0 ? variant.price_e : variant.price_e
      }
    } else {
      // Fallback vers les prix du produit
      const fallbackPrice = product.price || 0
      switch (tier) {
        case 'A': return (product.price_a || 0) > 0 ? (product.price_a || 0) : fallbackPrice
        case 'B': return (product.price_b || 0) > 0 ? (product.price_b || 0) : fallbackPrice
        case 'C': return (product.price_c || 0) > 0 ? (product.price_c || 0) : fallbackPrice
        case 'D': return (product.price_d || 0) > 0 ? (product.price_d || 0) : fallbackPrice
        case 'E': return (product.price_e || 0) > 0 ? (product.price_e || 0) : fallbackPrice
        default: return (product.price_e || 0) > 0 ? (product.price_e || 0) : fallbackPrice
      }
    }
  }

  const addToCart = (product: Product) => {
    if (!selectedClient) {
      alert('الرجاء اختيار العميل أولاً')
      return
    }

    if (product.stock === 0) {
      alert('المنتج غير متوفر في المخزون')
      return
    }

    const price = getPriceForTier(product, selectedClient.subscription_tier)
    const existingItem = cart.find(item => item.id === product.id)

    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, { ...product, quantity: 1, selectedPrice: price }])
    }
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === productId) {
        const newQuantity = item.quantity + delta
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item
      }
      return item
    }).filter(item => item.quantity > 0))
  }

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.selectedPrice * item.quantity), 0)
  }

  const activePromotions = promotions.filter((promo) => {
    if (!promo.is_active) return false
    const now = new Date()
    if (promo.starts_at && new Date(promo.starts_at) > now) return false
    if (promo.ends_at && new Date(promo.ends_at) < now) return false
    return true
  })

  const promotionSummary = (() => {
    const subtotal = calculateSubtotal()
    let discountTotal = 0
    const giftItems: CartItem[] = []

    const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0)

    activePromotions.forEach((promo) => {
      const eligibleQuantity = promo.scope === 'global'
        ? totalQuantity
        : cart.find((item) => item.id === promo.product_id)?.quantity || 0

      if (eligibleQuantity < (promo.min_quantity || 1)) return

      if (promo.type === 'discount') {
        const baseAmount = promo.scope === 'global'
          ? subtotal
          : cart
              .filter((item) => item.id === promo.product_id)
              .reduce((sum, item) => sum + item.selectedPrice * item.quantity, 0)
        const percent = Number(promo.discount_percent || 0)
        if (percent > 0) discountTotal += baseAmount * (percent / 100)
      }

      if (promo.type === 'gift' && promo.gift_product_id) {
        const giftProduct = products.find((p) => p.id === promo.gift_product_id)
        if (!giftProduct) return
        giftItems.push({
          ...giftProduct,
          quantity: Number(promo.gift_quantity || 1),
          selectedPrice: 0,
          is_gift: true,
          promotion_id: promo.id,
        })
      }
    })

    return {
      subtotal,
      discountTotal,
      finalTotal: Math.max(0, subtotal - discountTotal),
      giftItems,
    }
  })()

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // Récupérer l'ID de l'employé depuis localStorage ou le créer si nécessaire
      const commercialId = localStorage.getItem('commercial_id')
      if (!commercialId) {
        throw new Error('Commercial ID not found')
      }

      // Vérifier si l'employé existe dans la table employees
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('id')
        .eq('id', commercialId)
        .single()

      if (employeeError || !employee) {
        // Créer l'employé s'il n'existe pas
        const { data: newEmployee, error: createEmployeeError } = await supabase
          .from('employees')
          .insert({
            id: commercialId,
            name: 'Commercial User',
            email: `commercial-${commercialId}@ba9alino.com`,
            phone: '0000000000', // Téléphone par défaut obligatoire
            role: 'commercial'
          })
          .select()
          .single()

        if (createEmployeeError) throw createEmployeeError
        console.log('Employee created:', newEmployee)
      }

      const { error } = await supabase
        .from('clients')
        .insert({
          company_name_ar: clientForm.company_name_ar,
          company_name_en: clientForm.company_name_en || clientForm.company_name_ar,
          contact_person_name: clientForm.contact_person_name,
          contact_person_phone: clientForm.contact_person_phone,
          contact_person_email: clientForm.contact_person_email || null,
          address: clientForm.address || null,
          city: clientForm.city || null,
          subscription_tier: clientForm.subscription_tier,
          credit_limit: clientForm.credit_limit ? parseFloat(clientForm.credit_limit) : 0,
          created_by: commercialId
        })
        .select()
        .single()

      if (error) throw error
      
      alert('✅ تم إضافة العميل بنجاح')
      setShowCreateClientModal(false)
      setClientForm({
        company_name_ar: '',
        company_name_en: '',
        contact_person_name: '',
        contact_person_phone: '',
        contact_person_email: '',
        address: '',
        city: '',
        subscription_tier: 'E',
        credit_limit: ''
      })
      await loadData(commercialId)
    } catch (error) {
      console.error('Error adding client:', error)
      alert('❌ حدث خطأ أثناء إضافة العميل')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitOrder = async () => {
    if (!selectedClient) {
      alert('الرجاء اختيار العميل')
      return
    }

    if (cart.length === 0) {
      alert('الرجاء إضافة منتجات للطلب')
      return
    }

    const commercialId = localStorage.getItem('commercial_id')
    if (!commercialId) return

    try {
      // Générer un numéro de commande
      const { data: lastOrder } = await supabase
        .from('orders')
        .select('order_number')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      let orderNumber = 'ORD-0001'
      if (lastOrder?.order_number) {
        const lastNum = parseInt(lastOrder.order_number.split('-')[1])
        orderNumber = `ORD-${String(lastNum + 1).padStart(4, '0')}`
      }

      // Créer la commande
      const totalAmount = promotionSummary.finalTotal
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          client_id: selectedClient.id,
          order_date: new Date().toISOString(),
          status: 'pending',
          subtotal: promotionSummary.subtotal,
          tax_amount: 0,
          total_amount: totalAmount,
          created_by: commercialId,
          source: 'commercial'
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Créer les lignes de commande
      const orderItems = [...cart, ...promotionSummary.giftItems].map(item => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.selectedPrice,
        line_total: item.selectedPrice * item.quantity
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) throw itemsError

      alert('✅ تم إنشاء الطلب بنجاح! في انتظار موافقة المسؤول.')
      navigate('/commercial/orders')
    } catch (error) {
      console.error('Error creating order:', error)
      alert('❌ حدث خطأ أثناء إنشاء الطلب')
    }
  }

  const filteredProducts = useMemo(() => products.filter(p => {
    const matchesSearch =
      p.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || p.category_id === selectedCategory
    return matchesSearch && matchesCategory
  }), [products, searchQuery, selectedCategory])

  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [searchQuery, selectedCategory])

  const displayedProducts = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount])
  const hasMore = visibleCount < filteredProducts.length
  const loadMore = useCallback(() => setVisibleCount(prev => prev + PAGE_SIZE), [])

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/commercial/orders')}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">طلب جديد</h1>
            <p className="text-green-100 text-sm">
              {selectedClient ? selectedClient.company_name_ar : 'اختر العميل'}
            </p>
          </div>
        </div>
      </div>

      {/* Client Selection */}
      <div className="bg-white border-b p-4">
        <div className="flex gap-3">
          <button
            onClick={() => setShowClientModal(true)}
            className="flex-1 bg-blue-50 border-2 border-blue-200 rounded-lg p-4 flex items-center justify-between hover:bg-blue-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <User className="text-blue-600" size={24} />
              <div className="text-right">
                <p className="text-sm text-gray-600">العميل</p>
                <p className="font-bold text-gray-800">
                  {selectedClient ? selectedClient.company_name_ar : 'اختر العميل'}
                </p>
              </div>
            </div>
            {selectedClient && (
              <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                {selectedClient.subscription_tier}
              </div>
            )}
          </button>
          
          <button
            onClick={() => setShowCreateClientModal(true)}
            className="bg-green-600 text-white border-2 border-green-600 rounded-lg p-4 hover:bg-green-700 transition-colors flex items-center justify-center"
            title="إضافة عميل جديد"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      {/* Products Search */}
      <div className="bg-white border-b p-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none"
          placeholder="ابحث عن منتج..."
        />
      </div>

      {/* Categories Filter - max 3 rows, scrollable */}
      <div className="bg-white border-b p-3 shadow-sm overflow-y-auto" style={{ maxHeight: '140px' }}>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              !selectedCategory
                ? 'bg-green-600 text-white'
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
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.name_ar} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Active Promotions Banner */}
      {selectedClient && activePromotions.length > 0 && (
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-3 shadow-md">
          <p className="text-sm font-bold mb-3">🎁 العروض النشطة - اضغط للإضافة التلقائية</p>
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {activePromotions.map((promo) => {
              const giftProduct = promo.type === 'gift' && promo.gift_product_id 
                ? products.find((p) => p.id === promo.gift_product_id) 
                : null
              const targetProduct = promo.scope === 'product' && promo.product_id
                ? products.find((p) => p.id === promo.product_id)
                : null
              
              return (
                <button
                  key={promo.id}
                  onClick={() => {
                    if (promo.type === 'gift' && giftProduct) {
                      const existingItem = cart.find(item => item.id === giftProduct.id)
                      if (existingItem) {
                        setCart(cart.map(item =>
                          item.id === giftProduct.id
                            ? { ...item, quantity: item.quantity + (promo.gift_quantity || 1), is_gift: true, promotion_id: promo.id }
                            : item
                        ))
                      } else {
                        setCart([...cart, { 
                          ...giftProduct, 
                          quantity: promo.gift_quantity || 1, 
                          selectedPrice: 0, 
                          is_gift: true, 
                          promotion_id: promo.id 
                        }])
                      }
                      alert(`✅ تم إضافة ${promo.gift_quantity || 1} ${giftProduct.name_ar} كهدية`)
                    } else if (promo.type === 'discount') {
                      alert(`💰 خصم ${promo.discount_percent}% عند شراء ${promo.min_quantity} ${promo.unit_type || 'وحدة'}`)
                    }
                  }}
                  className="w-full bg-white/20 hover:bg-white/30 p-3 rounded-xl text-right transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Gift Product Image */}
                    <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {promo.type === 'gift' && giftProduct?.image_url ? (
                        <img src={giftProduct.image_url} alt={giftProduct.name_ar} className="w-full h-full object-contain p-1" />
                      ) : promo.type === 'gift' ? (
                        <Package size={32} className="text-orange-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-green-100 rounded-lg">
                          <span className="text-2xl font-bold text-green-600">%</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Promotion Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{promo.type === 'gift' ? '🎁' : '💰'}</span>
                        <p className="font-bold text-sm truncate">{promo.title}</p>
                      </div>
                      
                      {/* Condition */}
                      <p className="text-xs text-white/90 mb-1">
                        {promo.scope === 'global' 
                          ? `على إجمالي الطلب ≥ ${promo.min_quantity} ${promo.unit_type || 'وحدة'}`
                          : `عند شراء ${promo.min_quantity} ${promo.unit_type || targetProduct?.name_ar || 'وحدة'}`
                        }
                      </p>
                      
                      {/* Gift or Discount Details */}
                      {promo.type === 'gift' && giftProduct && (
                        <p className="text-xs text-yellow-200 font-semibold">
                          هدية: {giftProduct.name_ar} × {promo.gift_quantity || 1}
                        </p>
                      )}
                      {promo.type === 'discount' && (
                        <p className="text-xs text-green-200 font-semibold">
                          خصم: {promo.discount_percent}% على {promo.scope === 'global' ? 'المجموع' : targetProduct?.name_ar || 'المنتج'}
                        </p>
                      )}
                    </div>
                    
                    {/* Action Arrow */}
                    <div className="text-white/60">
                      <Plus size={24} />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Products Grid - Card View */}
      <div className="p-4 pb-32">
        {loading ? (
          <div className="text-center py-12 text-gray-500">جاري التحميل...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">لا توجد منتجات</div>
        ) : (
          <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayedProducts.map((product) => {
              const price = selectedClient ? getPriceForTier(product, selectedClient.subscription_tier) : product.price_e
              const inCart = cart.find(item => item.id === product.id)
              return (
                <div key={product.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow border border-gray-100">
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
                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">نفذ المخزون</span>
                      </div>
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
                    <div className="text-center mb-3">
                      <p className="text-lg font-bold text-green-600">
                        {price.toFixed(2)} MAD
                      </p>
                    </div>

                    {/* Add to Cart Button */}
                    {inCart ? (
                      <div className="flex items-center gap-1 bg-green-50 rounded-lg p-2">
                        <button
                          onClick={() => updateQuantity(product.id, -1)}
                          className="flex-1 bg-red-100 text-red-600 p-1 rounded hover:bg-red-200 text-sm font-bold"
                        >
                          <Minus size={16} className="mx-auto" />
                        </button>
                        <span className="flex-1 text-center font-bold text-sm">{inCart.quantity}</span>
                        <button
                          onClick={() => updateQuantity(product.id, 1)}
                          className="flex-1 bg-green-100 text-green-600 p-1 rounded hover:bg-green-200 text-sm font-bold"
                        >
                          <Plus size={16} className="mx-auto" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          if (!selectedClient) {
                            alert('الرجاء اختيار العميل أولاً')
                            setShowClientModal(true)
                            return
                          }
                          if (product.stock === 0) {
                            alert('المنتج غير متوفر في المخزون')
                            return
                          }
                          addToCart(product)
                        }}
                        disabled={product.stock === 0}
                        className="w-full bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
                      >
                        إضافة للطلب
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {hasMore && (
            <div className="text-center mt-6 mb-4">
              <button
                onClick={loadMore}
                className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 transition-colors"
              >
                عرض المزيد ({filteredProducts.length - visibleCount} متبقي)
              </button>
            </div>
          )}
          </>
        )}
      </div>

      {/* Floating Cart Button - Clickable to toggle cart */}
      {cart.length > 0 && (
        <button
          onClick={() => setShowCartSummary(!showCartSummary)}
          className="fixed bottom-4 right-4 z-50 bg-green-600 text-white rounded-full shadow-xl p-4 flex items-center gap-2 hover:bg-green-700 transition-colors"
        >
          <ShoppingCart size={24} />
          <div className="flex flex-col items-start">
            <span className="text-xs font-medium">{cart.reduce((sum, item) => sum + item.quantity, 0)} منتج</span>
            <span className="font-bold">{promotionSummary.finalTotal.toFixed(0)} DH</span>
          </div>
        </button>
      )}

      {/* Cart Summary - Expandable from floating button */}
      {showCartSummary && cart.length > 0 && (
        <div className="fixed bottom-20 right-4 left-4 md:left-auto md:w-[28rem] bg-white border-2 border-green-200 rounded-xl p-4 shadow-2xl z-40 max-h-[70vh] overflow-y-auto" dir="rtl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-green-600" size={24} />
              <span className="font-bold text-gray-800">{cart.length} منتج</span>
            </div>
            <div className="text-left">
              <p className="text-sm text-gray-600">المجموع</p>
              <p className="text-2xl font-bold text-green-600">{promotionSummary.finalTotal.toFixed(2)} MAD</p>
            </div>
          </div>

          {/* Cart Items List */}
          <div className="border-t border-b border-gray-200 py-3 mb-3 space-y-3 max-h-[35vh] overflow-y-auto">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2">
                {/* Product Image */}
                <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-200">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name_ar} className="w-full h-full object-contain" />
                  ) : (
                    <Package size={24} className="text-gray-300" />
                  )}
                </div>
                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">{item.name_ar}</p>
                  <p className="text-xs text-gray-500">{item.selectedPrice.toFixed(2)} MAD / وحدة</p>
                  {item.is_gift && <span className="text-xs text-orange-600 font-medium">🎁 هدية</span>}
                </div>
                {/* Quantity Controls */}
                <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="w-7 h-7 bg-red-100 text-red-600 rounded hover:bg-red-200 flex items-center justify-center text-sm font-bold"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="w-7 h-7 bg-green-100 text-green-600 rounded hover:bg-green-200 flex items-center justify-center text-sm font-bold"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {/* Total */}
                <div className="text-left min-w-[60px]">
                  <p className="font-bold text-green-600 text-sm">{(item.selectedPrice * item.quantity).toFixed(0)} DH</p>
                </div>
              </div>
            ))}
          </div>

          {(promotionSummary.discountTotal > 0 || promotionSummary.giftItems.length > 0) && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-3 text-sm text-emerald-800 space-y-1">
              {promotionSummary.discountTotal > 0 && (
                <div className="flex items-center justify-between">
                  <span>خصم العروض</span>
                  <span className="font-semibold">- {promotionSummary.discountTotal.toFixed(2)} MAD</span>
                </div>
              )}
              {promotionSummary.giftItems.length > 0 && (
                <div>
                  <span className="font-semibold">هدايا:</span>
                  <div className="text-emerald-700">
                    {promotionSummary.giftItems.map((gift, idx) => (
                      <div key={`${gift.id}-${idx}`}>• {gift.name_ar} × {gift.quantity}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleSubmitOrder}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            <Check size={20} />
            تأكيد الطلب
          </button>
        </div>
      )}

      {/* Client Selection Modal */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
              <h2 className="text-xl font-bold">اختر العميل</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => {
                    setSelectedClient(client)
                    setShowClientModal(false)
                    setCart([]) // Reset cart when changing client
                  }}
                  className="w-full bg-gray-50 hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-300 rounded-lg p-4 text-right transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-gray-800">{client.company_name_ar}</p>
                    <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                      {client.subscription_tier}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-4 border-t flex gap-2">
              <button
                onClick={() => setShowCreateClientModal(true)}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                عميل جديد
              </button>
              <button
                onClick={() => setShowClientModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-300"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Client Modal */}
      {showCreateClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-xl">
              <h2 className="text-xl font-bold">إضافة عميل جديد</h2>
            </div>
            
            <form onSubmit={handleCreateClient} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">اسم الشركة (عربي) *</label>
                <input
                  type="text"
                  required
                  value={clientForm.company_name_ar}
                  onChange={(e) => setClientForm({ ...clientForm, company_name_ar: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="أدخل اسم الشركة..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">اسم الشركة (English)</label>
                <input
                  type="text"
                  value={clientForm.company_name_en}
                  onChange={(e) => setClientForm({ ...clientForm, company_name_en: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Company name..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">اسم جهة الاتصال *</label>
                <input
                  type="text"
                  required
                  value={clientForm.contact_person_name}
                  onChange={(e) => setClientForm({ ...clientForm, contact_person_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="أدخل اسم جهة الاتصال..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">رقم الهاتف *</label>
                <button
                  type="button"
                  onClick={() =>
                    inputPad.open({
                      title: 'رقم الهاتف *',
                      mode: 'alphanumeric',
                      dir: 'ltr',
                      initialValue: clientForm.contact_person_phone || '',
                      onConfirm: (v) => setClientForm({ ...clientForm, contact_person_phone: v }),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
                >
                  {clientForm.contact_person_phone || '06xxxxxxxx'}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
                <button
                  type="button"
                  onClick={() =>
                    inputPad.open({
                      title: 'البريد الإلكتروني',
                      mode: 'alphanumeric',
                      dir: 'ltr',
                      initialValue: clientForm.contact_person_email || '',
                      onConfirm: (v) => setClientForm({ ...clientForm, contact_person_email: v }),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
                >
                  {clientForm.contact_person_email || 'email@example.com'}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">العنوان</label>
                <button
                  type="button"
                  onClick={() =>
                    inputPad.open({
                      title: 'العنوان',
                      mode: 'text',
                      initialValue: clientForm.address || '',
                      onConfirm: (v) => setClientForm({ ...clientForm, address: v }),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                >
                  {clientForm.address || 'العنوان الكامل...'}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">المدينة</label>
                <button
                  type="button"
                  onClick={() =>
                    inputPad.open({
                      title: 'المدينة',
                      mode: 'text',
                      initialValue: clientForm.city || '',
                      onConfirm: (v) => setClientForm({ ...clientForm, city: v }),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                >
                  {clientForm.city || 'المدينة...'}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">فئة الاشتراك</label>
                <select
                  value={clientForm.subscription_tier}
                  onChange={(e) => setClientForm({ ...clientForm, subscription_tier: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="A">A - سعر أ</option>
                  <option value="B">B - سعر ب</option>
                  <option value="C">C - سعر ج</option>
                  <option value="D">D - سعر د</option>
                  <option value="E">E - سعر هـ</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">حد الائتمان</label>
                <button
                  type="button"
                  onClick={() =>
                    inputPad.open({
                      title: 'حد الائتمان',
                      mode: 'decimal',
                      dir: 'ltr',
                      initialValue: clientForm.credit_limit || '0',
                      min: 0,
                      onConfirm: (v) => setClientForm({ ...clientForm, credit_limit: v }),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
                >
                  {clientForm.credit_limit || '0.00'}
                </button>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateClientModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors"
                >
                  حفظ
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
