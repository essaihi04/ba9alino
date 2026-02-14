import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Plus, Clock, CheckCircle, XCircle, AlertCircle, Package, Edit2, X, Save, Trash2 } from 'lucide-react'

interface Order {
  id: string
  order_number: string
  client_id: string
  order_date: string
  status: 'pending' | 'confirmed' | 'rejected' | 'completed'
  total_amount: number
  created_by?: string
  created_at: string
  clients?: {
    company_name_ar: string
  }
}

interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  line_total: number
  products?: {
    name_ar: string
    image_url?: string
  }
}

export default function CommercialOrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [loadingItems, setLoadingItems] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedItems, setEditedItems] = useState<OrderItem[]>([])

  useEffect(() => {
    const commercialId = localStorage.getItem('commercial_id')
    if (!commercialId) {
      navigate('/commercial/login')
      return
    }

    loadOrders(commercialId)
  }, [navigate])

  const loadOrders = async (commercialId: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          clients (
            company_name_ar
          )
        `)
        .eq('created_by', commercialId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true
    return order.status === filter
  })

  const loadOrderItems = async (orderId: string) => {
    setLoadingItems(true)
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          *,
          products (
            name_ar,
            image_url
          )
        `)
        .eq('order_id', orderId)

      if (error) throw error
      setOrderItems(data || [])
      setEditedItems(data || [])
    } catch (error) {
      console.error('Error loading order items:', error)
    } finally {
      setLoadingItems(false)
    }
  }

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order)
    setShowOrderModal(true)
    setIsEditing(false)
    loadOrderItems(order.id)
  }

  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return
    setEditedItems(items => items.map(item => 
      item.id === itemId 
        ? { ...item, quantity: newQuantity, line_total: item.unit_price * newQuantity }
        : item
    ))
  }

  const saveOrderChanges = async () => {
    if (!selectedOrder) return
    
    try {
      // Update each item
      for (const item of editedItems) {
        await supabase
          .from('order_items')
          .update({ 
            quantity: item.quantity,
            line_total: item.line_total
          })
          .eq('id', item.id)
      }

      // Update order total
      const newTotal = editedItems.reduce((sum, item) => sum + item.line_total, 0)
      await supabase
        .from('orders')
        .update({ total_amount: newTotal })
        .eq('id', selectedOrder.id)

      // Refresh orders list
      const commercialId = localStorage.getItem('commercial_id')
      if (commercialId) loadOrders(commercialId)

      setIsEditing(false)
      setOrderItems(editedItems)
      alert('✅ تم تحديث الطلب بنجاح')
    } catch (error) {
      console.error('Error saving order:', error)
      alert('❌ حدث خطأ أثناء تحديث الطلب')
    }
  }

  const deleteOrder = async () => {
    if (!selectedOrder) return
    if (!confirm('هل أنت متأكد من حذف هذا الطلب؟')) return

    try {
      await supabase.from('order_items').delete().eq('order_id', selectedOrder.id)
      await supabase.from('orders').delete().eq('id', selectedOrder.id)
      
      const commercialId = localStorage.getItem('commercial_id')
      if (commercialId) loadOrders(commercialId)
      
      setShowOrderModal(false)
      alert('✅ تم حذف الطلب بنجاح')
    } catch (error) {
      console.error('Error deleting order:', error)
      alert('❌ حدث خطأ أثناء حذف الطلب')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          icon: <Clock size={16} />,
          text: 'قيد الانتظار',
          className: 'bg-yellow-100 text-yellow-700'
        }
      case 'confirmed':
        return {
          icon: <CheckCircle size={16} />,
          text: 'مؤكد',
          className: 'bg-green-100 text-green-700'
        }
      case 'rejected':
        return {
          icon: <XCircle size={16} />,
          text: 'مرفوض',
          className: 'bg-red-100 text-red-700'
        }
      case 'completed':
        return {
          icon: <CheckCircle size={16} />,
          text: 'مكتمل',
          className: 'bg-blue-100 text-blue-700'
        }
      default:
        return {
          icon: <AlertCircle size={16} />,
          text: status,
          className: 'bg-gray-100 text-gray-700'
        }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/commercial/dashboard')}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">طلباتي</h1>
            <p className="text-orange-100 text-sm">{orders.length} طلب</p>
          </div>
          <button
            onClick={() => navigate('/commercial/orders/new')}
            className="bg-white text-orange-600 p-3 rounded-lg font-bold hover:bg-orange-50 transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filter === 'all'
                ? 'bg-white text-orange-600'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            الكل ({orders.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filter === 'pending'
                ? 'bg-white text-orange-600'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            قيد الانتظار ({orders.filter(o => o.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilter('confirmed')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filter === 'confirmed'
                ? 'bg-white text-orange-600'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            مؤكد ({orders.filter(o => o.status === 'confirmed').length})
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filter === 'rejected'
                ? 'bg-white text-orange-600'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            مرفوض ({orders.filter(o => o.status === 'rejected').length})
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            جاري التحميل...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500 mb-4">لا توجد طلبات</p>
            <button
              onClick={() => navigate('/commercial/orders/new')}
              className="bg-orange-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-orange-700 transition-colors"
            >
              إنشاء طلب جديد
            </button>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const statusBadge = getStatusBadge(order.status)
            return (
              <button
                key={order.id}
                onClick={() => handleOrderClick(order)}
                className="w-full bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-shadow text-right"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-gray-800 text-lg">
                        #{order.order_number}
                      </h3>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusBadge.className}`}>
                        {statusBadge.icon}
                        <span>{statusBadge.text}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">
                      {order.clients?.company_name_ar || 'عميل غير محدد'}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-xl font-bold text-green-600">
                      {order.total_amount.toFixed(2)} MAD
                    </p>
                  </div>
                </div>

                <div className="text-sm text-gray-500">
                  <p>التاريخ: {new Date(order.order_date).toLocaleDateString('ar-MA')}</p>
                </div>

                {order.status === 'pending' && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                      <Clock className="text-yellow-600 flex-shrink-0 mt-0.5" size={16} />
                      <p className="text-xs text-yellow-800">
                        في انتظار موافقة المسؤول
                      </p>
                    </div>
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Order Details Modal */}
      {showOrderModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">طلب #{selectedOrder.order_number}</h2>
                <button 
                  onClick={() => setShowOrderModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg"
                >
                  <X size={24} />
                </button>
              </div>
              <p className="text-orange-100 text-sm mt-1">
                {selectedOrder.clients?.company_name_ar}
              </p>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Status Badge */}
              <div className="mb-4">
                {(() => {
                  const badge = getStatusBadge(selectedOrder.status)
                  return (
                    <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.className}`}>
                      {badge.icon}
                      <span>{badge.text}</span>
                    </div>
                  )
                })()}
              </div>

              {/* Order Items */}
              <h3 className="font-bold text-gray-800 mb-3">منتجات الطلب</h3>
              {loadingItems ? (
                <div className="text-center py-4 text-gray-500">جاري التحميل...</div>
              ) : (
                <div className="space-y-3">
                  {(isEditing ? editedItems : orderItems).map((item) => (
                    <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                      {/* Product Image */}
                      <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border">
                        {item.products?.image_url ? (
                          <img src={item.products.image_url} alt={item.products.name_ar} className="w-full h-full object-contain" />
                        ) : (
                          <Package size={20} className="text-gray-300" />
                        )}
                      </div>
                      
                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-800 truncate">{item.products?.name_ar || 'منتج'}</p>
                        <p className="text-xs text-gray-500">{item.unit_price.toFixed(2)} MAD / وحدة</p>
                      </div>
                      
                      {/* Quantity Controls (if editing) */}
                      {isEditing && selectedOrder.status === 'pending' ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                            className="w-7 h-7 bg-red-100 text-red-600 rounded hover:bg-red-200 flex items-center justify-center text-sm font-bold"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                          <button
                            onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                            className="w-7 h-7 bg-green-100 text-green-600 rounded hover:bg-green-200 flex items-center justify-center text-sm font-bold"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <div className="text-left">
                          <p className="font-bold text-sm">× {item.quantity}</p>
                          <p className="text-xs text-green-600">{item.line_total.toFixed(0)} DH</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Total */}
              <div className="border-t mt-4 pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-800">المجموع</span>
                  <span className="text-2xl font-bold text-green-600">
                    {(isEditing ? editedItems : orderItems).reduce((sum, item) => sum + item.line_total, 0).toFixed(2)} MAD
                  </span>
                </div>
              </div>

              {/* Dates */}
              <div className="text-sm text-gray-500 mt-4 pt-4 border-t">
                <p>تاريخ الطلب: {new Date(selectedOrder.order_date).toLocaleDateString('ar-MA')}</p>
                <p>تاريخ الإنشاء: {new Date(selectedOrder.created_at).toLocaleDateString('ar-MA')}</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t flex gap-2">
              {selectedOrder.status === 'pending' && (
                <>
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => {
                          setIsEditing(false)
                          setEditedItems(orderItems)
                        }}
                        className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300"
                      >
                        إلغاء
                      </button>
                      <button
                        onClick={saveOrderChanges}
                        className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 flex items-center justify-center gap-2"
                      >
                        <Save size={18} />
                        حفظ
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={deleteOrder}
                        className="bg-red-100 text-red-600 px-4 py-3 rounded-lg font-bold hover:bg-red-200"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex-1 bg-orange-600 text-white py-3 rounded-lg font-bold hover:bg-orange-700 flex items-center justify-center gap-2"
                      >
                        <Edit2 size={18} />
                        تعديل
                      </button>
                    </>
                  )}
                </>
              )}
              <button
                onClick={() => setShowOrderModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-200"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
