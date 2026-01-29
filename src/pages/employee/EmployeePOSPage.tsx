import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Plus, Minus, ShoppingCart, X, Check } from 'lucide-react'
import { useInputPad } from '../../components/useInputPad'

interface Product {
  id: string
  sku: string
  name_ar: string
  price: number
}

interface CartItem extends Product {
  quantity: number
}

interface Client {
  id: string
  company_name_ar: string
}

export default function EmployeePOSPage() {
  const navigate = useNavigate()
  const inputPad = useInputPad()
  const [products, setProducts] = useState<Product[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showClientModal, setShowClientModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'check' | 'transfer'>('cash')

  useEffect(() => {
    const employeeId = localStorage.getItem('employee_id')
    if (!employeeId) {
      navigate('/employee/login')
      return
    }
    loadData()
  }, [navigate])

  const loadData = async () => {
    setLoading(true)
    try {
      const [productsRes, clientsRes] = await Promise.all([
        supabase.from('products').select('id, sku, name_ar, price').eq('is_active', true).order('name_ar'),
        supabase.from('clients').select('id, company_name_ar').order('company_name_ar')
      ])

      if (productsRes.error) throw productsRes.error
      if (clientsRes.error) throw clientsRes.error

      setProducts(productsRes.data || [])
      setClients(clientsRes.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.id === product.id)
    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, { ...product, quantity: 1 }])
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

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.id !== productId))
  }

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0)
  }

  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('الرجاء إضافة منتجات')
      return
    }

    try {
      const orderNumber = `POS-${Date.now()}`
      const total = calculateTotal()

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          client_id: selectedClient?.id || null,
          order_date: new Date().toISOString(),
          status: 'completed',
          total_amount: total,
          source: 'pos'
        })
        .select()
        .single()

      if (orderError) throw orderError

      const orderItems = cart.map(item => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price || 0,
        total: (item.price || 0) * item.quantity
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) throw itemsError

      alert(`✅ تم إتمام البيع بنجاح!\nالرقم: ${orderNumber}\nالمبلغ: ${total.toFixed(2)} MAD`)
      setCart([])
      setSelectedClient(null)
    } catch (error) {
      console.error('Error checkout:', error)
      alert('❌ حدث خطأ أثناء إتمام البيع')
    }
  }

  const filteredProducts = products.filter(p =>
    p.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-100" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-800 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/employee/dashboard')}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-bold">نقطة البيع (POS)</h1>
              <p className="text-red-100">نظام الكايس السريع</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto p-6 grid grid-cols-3 gap-6 h-[calc(100vh-120px)]">
        {/* Products Section */}
        <div className="col-span-2 flex flex-col">
          <div className="bg-white rounded-xl shadow-md p-4 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none"
              placeholder="ابحث عن منتج..."
            />
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 flex-1 overflow-y-auto">
            {loading ? (
              <div className="text-center py-12 text-gray-500">جاري التحميل...</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-2 border-blue-300 rounded-lg p-4 text-right transition-all duration-200 transform hover:scale-105"
                  >
                    <h3 className="font-bold text-gray-800 text-sm mb-1">{product.name_ar}</h3>
                    <p className="text-xs text-gray-600 mb-2">SKU: {product.sku}</p>
                    <p className="text-lg font-bold text-green-600">{(product.price || 0).toFixed(2)} MAD</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart Section */}
        <div className="flex flex-col">
          {/* Client Selection */}
          <div className="bg-white rounded-xl shadow-md p-4 mb-4">
            <button
              onClick={() => setShowClientModal(true)}
              className="w-full bg-blue-50 border-2 border-blue-300 rounded-lg p-3 text-right hover:bg-blue-100 transition-colors"
            >
              <p className="text-xs text-gray-600">العميل</p>
              <p className="font-bold text-gray-800">
                {selectedClient ? selectedClient.company_name_ar : 'بدون عميل'}
              </p>
            </button>
          </div>

          {/* Cart Items */}
          <div className="bg-white rounded-xl shadow-md p-4 flex-1 overflow-y-auto mb-4">
            <h3 className="font-bold text-gray-800 mb-3">السلة ({cart.length})</h3>
            {cart.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart size={32} className="mx-auto mb-2 opacity-50" />
                <p>السلة فارغة</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-bold text-sm text-gray-800">{item.name_ar}</p>
                        <p className="text-xs text-gray-500">{(item.price || 0).toFixed(2)} MAD</p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="bg-red-100 text-red-600 p-1 rounded hover:bg-red-200"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="flex-1 text-center font-bold text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="bg-green-100 text-green-600 p-1 rounded hover:bg-green-200"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <p className="text-right text-sm font-bold text-green-600 mt-2">
                      {((item.price || 0) * item.quantity).toFixed(2)} MAD
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals and Checkout */}
          <div className="bg-white rounded-xl shadow-md p-4">
            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-gray-700">
                <span>المجموع:</span>
                <span className="font-bold text-2xl text-green-600">{calculateTotal().toFixed(2)}</span>
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-2">طريقة الدفع:</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-sm"
                >
                  <option value="cash">نقدي</option>
                  <option value="card">بطاقة</option>
                  <option value="check">شيك</option>
                  <option value="transfer">تحويل</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              <Check size={20} />
              إتمام البيع
            </button>
          </div>
        </div>
      </div>

      {/* Client Modal */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
              <h2 className="text-xl font-bold">اختر العميل</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <button
                onClick={() => {
                  setSelectedClient(null)
                  setShowClientModal(false)
                }}
                className="w-full bg-gray-100 hover:bg-gray-200 border-2 border-gray-300 rounded-lg p-4 text-right transition-colors font-medium"
              >
                بدون عميل (بيع عام)
              </button>
              {clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => {
                    setSelectedClient(client)
                    setShowClientModal(false)
                  }}
                  className="w-full bg-blue-50 hover:bg-blue-100 border-2 border-blue-300 rounded-lg p-4 text-right transition-colors"
                >
                  <p className="font-bold text-gray-800">{client.company_name_ar}</p>
                </button>
              ))}
            </div>
            <div className="p-4 border-t">
              <button
                onClick={() => setShowClientModal(false)}
                className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {inputPad.Modal}
    </div>
  )
}
