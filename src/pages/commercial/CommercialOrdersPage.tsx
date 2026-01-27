import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Plus, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

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

export default function CommercialOrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('all')

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
              <div
                key={order.id}
                className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-shadow"
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
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
