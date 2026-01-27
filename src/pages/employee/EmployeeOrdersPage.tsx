import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Plus, Eye, Clock, CheckCircle, XCircle, Search, Package, Truck } from 'lucide-react'

interface Order {
  id: string
  order_number: string
  client_id: string
  order_date: string
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  total_amount: number
  created_at: string
  clients?: {
    company_name_ar: string
  }
}

interface OrderItem {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  line_total: number
  products?: {
    name_ar: string
    sku: string
  }
}

export default function EmployeeOrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<
    'all' | 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  >('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  useEffect(() => {
    const employeeId = localStorage.getItem('employee_id')
    if (!employeeId) {
      navigate('/employee/login')
      return
    }
    loadOrders()
  }, [navigate])

  const loadOrders = async () => {
    setLoading(true)
    try {
      const employeeId = localStorage.getItem('employee_id')
      if (!employeeId) {
        navigate('/employee/login')
        return
      }

      console.log('Loading orders for employee:', employeeId)
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          clients (
            company_name_ar
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      console.log('Employee orders loaded:', data?.length, 'orders')
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

  const handleUpdateStatus = async (
    orderId: string,
    newStatus: 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  ) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)

      if (error) throw error
      alert('✅ تم تحديث حالة الطلب')
      setShowDetailsModal(false)
      loadOrders()
    } catch (error) {
      console.error('Error updating order:', error)
      alert('❌ حدث خطأ')
    }
  }

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number.includes(searchQuery) ||
      order.clients?.company_name_ar.includes(searchQuery)
    const matchesFilter = filter === 'all' || order.status === filter
    return matchesSearch && matchesFilter
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { icon: <Clock size={16} />, text: 'قيد الانتظار', className: 'bg-yellow-100 text-yellow-700' }
      case 'confirmed':
        return { icon: <CheckCircle size={16} />, text: 'مؤكد', className: 'bg-green-100 text-green-700' }
      case 'processing':
        return { icon: <Package size={16} />, text: 'قيد التحضير', className: 'bg-blue-100 text-blue-700' }
      case 'shipped':
        return { icon: <Truck size={16} />, text: 'تم الشحن', className: 'bg-indigo-100 text-indigo-700' }
      case 'delivered':
        return { icon: <CheckCircle size={16} />, text: 'تم التسليم', className: 'bg-emerald-100 text-emerald-700' }
      case 'cancelled':
        return { icon: <XCircle size={16} />, text: 'ملغي', className: 'bg-red-100 text-red-700' }
      default:
        return { icon: null, text: status, className: 'bg-gray-100 text-gray-700' }
    }
  }

  return (
    <div className="min-h-screen bg-gray-100" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-800 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/employee/dashboard')}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-bold">الطلبات</h1>
              <p className="text-green-100">إدارة الطلبات والتحديثات</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/employee/orders/new')}
            className="bg-white text-green-600 px-6 py-3 rounded-lg font-bold hover:bg-green-50 transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            طلب جديد
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Search and Filter */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                placeholder="ابحث عن رقم الطلب أو اسم العميل..."
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {['all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status as any)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === status
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {status === 'all' && 'الكل'}
                {status === 'pending' && 'قيد الانتظار'}
                {status === 'confirmed' && 'مؤكد'}
                {status === 'processing' && 'قيد التحضير'}
                {status === 'shipped' && 'تم الشحن'}
                {status === 'delivered' && 'تم التسليم'}
                {status === 'cancelled' && 'ملغي'}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-500">جاري التحميل...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">لا توجد طلبات</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">رقم الطلب</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">العميل</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">التاريخ</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">المبلغ</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">الحالة</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredOrders.map((order) => {
                    const statusBadge = getStatusBadge(order.status)
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-800">#{order.order_number}</td>
                        <td className="px-6 py-4 text-gray-700">{order.clients?.company_name_ar || 'غير محدد'}</td>
                        <td className="px-6 py-4 text-gray-600">{new Date(order.order_date).toLocaleDateString('ar-MA')}</td>
                        <td className="px-6 py-4 font-bold text-green-600">{order.total_amount.toFixed(2)} MAD</td>
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${statusBadge.className}`}>
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
                            عرض
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
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
              <h2 className="text-2xl font-bold">الطلب #{selectedOrder.order_number}</h2>
              <p className="text-blue-100">{new Date(selectedOrder.order_date).toLocaleDateString('ar-MA')}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-bold text-gray-800 mb-3">معلومات الطلب</h3>
                  <p className="text-sm text-gray-600">العميل: <span className="font-medium">{selectedOrder.clients?.company_name_ar}</span></p>
                  <p className="text-sm text-gray-600 mt-2">المبلغ: <span className="font-bold text-green-600">{selectedOrder.total_amount.toFixed(2)} MAD</span></p>
                </div>
              </div>

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
                        <td className="px-4 py-3 font-bold text-green-600">{(item.line_total || 0).toFixed(2)} MAD</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

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
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'cancelled')}
                      className="px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'confirmed')}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors"
                    >
                      تأكيد
                    </button>
                  </>
                )}
                {selectedOrder.status === 'confirmed' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'processing')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                  >
                    تحضير
                  </button>
                )}
                {selectedOrder.status === 'processing' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'shipped')}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                  >
                    شحن
                  </button>
                )}
                {selectedOrder.status === 'shipped' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'delivered')}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors"
                  >
                    تسليم
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
