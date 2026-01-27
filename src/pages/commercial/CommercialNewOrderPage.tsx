import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Plus, Minus, ShoppingCart, User, Check, Package, Phone, MapPin } from 'lucide-react'

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

interface CartItem extends Product {
  quantity: number
  selectedPrice: number
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
  const [searchParams] = useSearchParams()
  const preselectedClientId = searchParams.get('client')

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showClientModal, setShowClientModal] = useState(false)
  const [showCreateClientModal, setShowCreateClientModal] = useState(false)
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

  const loadData = async (commercialId: string) => {
    setLoading(true)
    try {
      // Récupérer les produits avec leurs prix depuis la table des variables
      const { data: productsWithPrices, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          product_variants (
            price_a,
            price_b,
            price_c,
            price_d,
            price_e,
            purchase_price,
            stock,
            unit_type,
            quantity_contained
          )
        `)
        .order('name_ar')

      const [categoriesRes, clientsRes] = await Promise.all([
        supabase.from('product_categories').select('*').order('name_ar'),
        supabase.from('clients').select('*').eq('created_by', commercialId).order('company_name_ar')
      ])

      if (productsError) throw productsError
      if (categoriesRes.error) throw categoriesRes.error
      if (clientsRes.error) throw clientsRes.error

      console.log('Products with variants from DB:', productsWithPrices?.slice(0, 1)) // Debug
      
      const rawProducts = (productsWithPrices || []) as any[]
      console.log('Raw products from DB (keys):', rawProducts.length > 0 ? Object.keys(rawProducts[0]) : []) // Debug all field names
      
      const visibleProducts = rawProducts.filter(p => p.is_active_for_commercial !== false)
      console.log('Visible products:', visibleProducts.slice(0, 3)) // Debug filtered products

      setProducts(visibleProducts)
      setCategories((categoriesRes.data || []) as Category[])
      setClients(clientsRes.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
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
    console.log('addToCart called', { product: product.name_ar, selectedClient, stock: product.stock })
    
    if (!selectedClient) {
      alert('الرجاء اختيار العميل أولاً')
      return
    }

    if (product.stock === 0) {
      alert('المنتج غير متوفر في المخزون')
      return
    }

    const price = getPriceForTier(product, selectedClient.subscription_tier)
    console.log('Price calculated', { tier: selectedClient.subscription_tier, price })
    
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
    
    console.log('Cart updated', cart)
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

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.selectedPrice * item.quantity), 0)
  }

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

      const { data, error } = await supabase
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
      const totalAmount = calculateTotal()
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          client_id: selectedClient.id,
          order_date: new Date().toISOString(),
          status: 'pending',
          subtotal: totalAmount,
          tax_amount: 0,
          total_amount: totalAmount,
          created_by: commercialId,
          source: 'commercial'
        })
        .select()
        .single()

      if (orderError) throw orderError

      // Créer les lignes de commande
      const orderItems = cart.map(item => ({
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

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || p.category_id === selectedCategory
    return matchesSearch && matchesCategory
  })

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

      {/* Categories Filter */}
      <div className="bg-white border-b p-4 shadow-sm overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
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
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
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

      {/* Products Grid - Card View */}
      <div className="p-4 pb-32">
        {loading ? (
          <div className="text-center py-12 text-gray-500">جاري التحميل...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">لا توجد منتجات</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((product) => {
              const price = selectedClient ? getPriceForTier(product, selectedClient.subscription_tier) : product.price_e
              const inCart = cart.find(item => item.id === product.id)
              
              // Debug log for first product only
              if (filteredProducts.indexOf(product) === 0) {
                const variant = product.product_variants && product.product_variants.length > 0 ? product.product_variants[0] : null
                console.log('First product data:', {
                  name: product.name_ar,
                  has_variant: !!variant,
                  price: product.price,
                  price_a: variant?.price_a || product.price_a,
                  price_b: variant?.price_b || product.price_b,
                  price_c: variant?.price_c || product.price_c,
                  price_d: variant?.price_d || product.price_d,
                  price_e: variant?.price_e || product.price_e,
                  calculated_price: price,
                  selected_client: selectedClient?.subscription_tier
                })
              }
              
              return (
                <div key={product.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Product Image */}
                  <div className="relative bg-gray-100 h-24 flex items-center justify-center overflow-hidden">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name_ar}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package size={32} className="text-gray-400" />
                    )}
                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">نفذ المخزون</span>
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-3">
                    <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-2">{product.name_ar}</h3>
                    <p className="text-xs text-gray-500 mb-2">SKU: {product.sku}</p>
                    
                    {/* Prices Grid - All Tiers */}
                    <div className="bg-gray-50 rounded-lg p-2 mb-3">
                      {(() => {
                        const variant = product.product_variants && product.product_variants.length > 0 ? product.product_variants[0] : null
                        return (
                          <div className="grid grid-cols-5 gap-1 text-xs">
                            <div className="text-center">
                              <p className="text-gray-500 text-xs font-medium">A</p>
                              <p className="font-bold text-blue-600">{(variant?.price_a || product.price_a || product.price || 0).toFixed(0)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-gray-500 text-xs font-medium">B</p>
                              <p className="font-bold text-green-600">{(variant?.price_b || product.price_b || product.price || 0).toFixed(0)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-gray-500 text-xs font-medium">C</p>
                              <p className="font-bold text-orange-600">{(variant?.price_c || product.price_c || product.price || 0).toFixed(0)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-gray-500 text-xs font-medium">D</p>
                              <p className="font-bold text-purple-600">{(variant?.price_d || product.price_d || product.price || 0).toFixed(0)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-gray-500 text-xs font-medium">E</p>
                              <p className="font-bold text-red-600">{(variant?.price_e || product.price_e || product.price || 0).toFixed(0)}</p>
                            </div>
                          </div>
                        )
                      })()}
                      {selectedClient && (
                        <div className="text-center mt-2 pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-500">سعر العميل ({selectedClient.subscription_tier})</p>
                          <p className="text-lg font-bold text-green-700">{(price || 0).toFixed(2)} MAD</p>
                        </div>
                      )}
                    </div>

                    {/* Stock Badge */}
                    <div className={`text-xs font-medium px-2 py-1 rounded mb-3 inline-block ${
                      product.stock > 10 ? 'bg-green-100 text-green-700' : 
                      product.stock > 0 ? 'bg-orange-100 text-orange-700' : 
                      'bg-red-100 text-red-700'
                    }`}>
                      {product.stock} متوفر
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
                        onClick={() => addToCart(product)}
                        disabled={!selectedClient || product.stock === 0}
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
        )}
      </div>

      {/* Cart Summary - Fixed Bottom */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 p-4 shadow-lg" dir="rtl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="text-green-600" size={24} />
              <span className="font-bold text-gray-800">{cart.length} منتج</span>
            </div>
            <div className="text-left">
              <p className="text-sm text-gray-600">المجموع</p>
              <p className="text-2xl font-bold text-green-600">{calculateTotal().toFixed(2)} MAD</p>
            </div>
          </div>
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
                <input
                  type="tel"
                  required
                  value={clientForm.contact_person_phone}
                  onChange={(e) => setClientForm({ ...clientForm, contact_person_phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="06xxxxxxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={clientForm.contact_person_email}
                  onChange={(e) => setClientForm({ ...clientForm, contact_person_email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">العنوان</label>
                <input
                  type="text"
                  value={clientForm.address}
                  onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="العنوان الكامل..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">المدينة</label>
                <input
                  type="text"
                  value={clientForm.city}
                  onChange={(e) => setClientForm({ ...clientForm, city: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="المدينة..."
                />
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
                <input
                  type="number"
                  step="0.01"
                  value={clientForm.credit_limit}
                  onChange={(e) => setClientForm({ ...clientForm, credit_limit: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
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
    </div>
  )
}
