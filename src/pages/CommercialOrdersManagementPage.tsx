import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Clock, CheckCircle, XCircle, Eye, User, Package, DollarSign, Calendar } from 'lucide-react'

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
    subscription_tier: string
  }
  employees?: {
    name: string
    phone: string
  }
}

interface OrderItem {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  total: number
  products?: {
    name_ar: string
    sku: string
  }
}

export default function CommercialOrdersManagementPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('pending')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  useEffect(() => {
    loadOrders()
  }, [])

  const loadOrders = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          clients (
            company_name_ar,
            subscription_tier
          ),
          employees (
            name,
            phone
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadOrderItems = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          *,
          products (
            name_ar,
            sku
          )
        `)
        .eq('order_id', orderId)

      if (error) throw error
      setOrderItems(data || [])
    } catch (error) {
      console.error('Error loading order items:', error)
    }
  }

  const handleViewDetails = async (order: Order) => {
    setSelectedOrder(order)
    await loadOrderItems(order.id)
    setShowDetailsModal(true)
  }

  const handleUpdateStatus = async (orderId: string, newStatus: 'confirmed' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)

      if (error) throw error

      alert(newStatus === 'confirmed' ? '✅ تم تأكيد الطلب' : '❌ تم رفض الطلب')
      setShowDetailsModal(false)
      loadOrders()
    } catch (error) {
      console.error('Error updating order status:', error)
      alert('حدث خطأ أثناء تحديث حالة الطلب')
    }
  }

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true
    return order.status === filter
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          icon: <Clock size={16} />,
          text: 'قيد الانتظار',
          className: 'bg-yellow-100 text-yellow-700 border-yellow-300'
        }
      case 'confirmed':
        return {
          icon: <CheckCircle size={16} />,
          text: 'مؤكد',
          className: 'bg-green-100 text-green-700 border-green-300'
        }
      case 'rejected':
        return {
          icon: <XCircle size={16} />,
          text: 'مرفوض',
          className: 'bg-red-100 text-red-700 border-red-300'
        }
      default:
        return {
          icon: <Clock size={16} />,
          text: status,
          className: 'bg-gray-100 text-gray-700 border-gray-300'
        }
    }
  }

  const pendingCount = orders.filter(o => o.status === 'pending').length

  return (
    <div className="p-6" dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Package className="text-white" size={36} />
              إدارة طلبات التجار
            </h1>
            <p className="text-gray-300 mt-1">
              مراجعة وتأكيد طلبات التجار
            </p>
          </div>
          {pendingCount > 0 && (
            <div className="bg-yellow-500 text-white px-6 py-3 rounded-lg font-bold text-lg">
              {pendingCount} طلب جديد
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('pending')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              filter === 'pending'
                ? 'bg-yellow-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            قيد الانتظار ({orders.filter(o => o.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilter('confirmed')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              filter === 'confirmed'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            مؤكد ({orders.filter(o => o.status === 'confirmed').length})
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              filter === 'rejected'
                ? 'bg-red-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            مرفوض ({orders.filter(o => o.status === 'rejected').length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            الكل ({orders.length})
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            جاري التحميل...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            لا توجد طلبات
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">رقم الطلب</th>
                  <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">التاجر</th>
                  <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">العميل</th>
                  <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">التاريخ</th>
                  <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">المبلغ</th>
                  <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">الحالة</th>
                  <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredOrders.map((order) => {
                  const statusBadge = getStatusBadge(order.status)
                  return (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-800">#{order.order_number}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-800">{order.employees?.name || 'غير محدد'}</p>
                            <p className="text-xs text-gray-500">{order.employees?.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-800">{order.clients?.company_name_ar || 'غير محدد'}</p>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {order.clients?.subscription_tier}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar size={16} />
                          <span className="text-sm">{new Date(order.order_date).toLocaleDateString('ar-MA')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <DollarSign size={16} className="text-green-600" />
                          <span className="font-bold text-green-600 text-lg">
                            {order.total_amount.toFixed(2)} MAD
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${statusBadge.className}`}>
                          {statusBadge.icon}
                          <span>{statusBadge.text}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleViewDetails(order)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                          <Eye size={16} />
                          عرض التفاصيل
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {showDetailsModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-1">تفاصيل الطلب #{selectedOrder.order_number}</h2>
                  <p className="text-blue-100">
                    {new Date(selectedOrder.order_date).toLocaleDateString('ar-MA')}
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-lg font-bold ${
                  selectedOrder.status === 'pending' ? 'bg-yellow-500' :
                  selectedOrder.status === 'confirmed' ? 'bg-green-500' :
                  'bg-red-500'
                }`}>
                  {getStatusBadge(selectedOrder.status).text}
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <User size={20} />
                    معلومات التاجر
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-600">الاسم:</span> <span className="font-medium">{selectedOrder.employees?.name}</span></p>
                    <p><span className="text-gray-600">الهاتف:</span> <span className="font-medium">{selectedOrder.employees?.phone}</span></p>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <Package size={20} />
                    معلومات العميل
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-600">الشركة:</span> <span className="font-medium">{selectedOrder.clients?.company_name_ar}</span></p>
                    <p><span className="text-gray-600">الفئة:</span> <span className="font-medium">{selectedOrder.clients?.subscription_tier}</span></p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="mb-6">
                <h3 className="font-bold text-gray-800 mb-3 text-lg">المنتجات</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">المنتج</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">SKU</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">الكمية</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">السعر</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">المجموع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {orderItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium">{item.products?.name_ar}</td>
                          <td className="px-4 py-3 text-gray-600 text-sm">{item.products?.sku}</td>
                          <td className="px-4 py-3 text-center font-bold">{item.quantity}</td>
                          <td className="px-4 py-3 text-gray-700">{item.unit_price.toFixed(2)} MAD</td>
                          <td className="px-4 py-3 font-bold text-green-600">{item.total.toFixed(2)} MAD</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right font-bold text-gray-800">المجموع الإجمالي:</td>
                        <td className="px-4 py-3 font-bold text-green-600 text-xl">
                          {selectedOrder.total_amount.toFixed(2)} MAD
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t p-6 bg-gray-50">
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors"
                >
                  إغلاق
                </button>
                {selectedOrder.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'rejected')}
                      className="px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                      <XCircle size={20} />
                      رفض الطلب
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'confirmed')}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      <CheckCircle size={20} />
                      تأكيد الطلب
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
