import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, TrendingUp, DollarSign, ShoppingCart, Users, Calendar } from 'lucide-react'

interface PerformanceStats {
  totalOrders: number
  totalRevenue: number
  totalClients: number
  averageOrderValue: number
  monthlyOrders: number
  monthlyRevenue: number
  pendingOrders: number
  confirmedOrders: number
}

interface MonthlyData {
  month: string
  orders: number
  revenue: number
}

export default function CommercialPerformancePage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<PerformanceStats>({
    totalOrders: 0,
    totalRevenue: 0,
    totalClients: 0,
    averageOrderValue: 0,
    monthlyOrders: 0,
    monthlyRevenue: 0,
    pendingOrders: 0,
    confirmedOrders: 0
  })
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [loading, setLoading] = useState(true)
  const [commercialName, setCommercialName] = useState('')

  useEffect(() => {
    const commercialId = localStorage.getItem('commercial_id')
    const name = localStorage.getItem('commercial_name')
    
    if (!commercialId) {
      navigate('/commercial/login')
      return
    }

    setCommercialName(name || 'تاجر')
    loadPerformanceData(commercialId)
  }, [navigate])

  const loadPerformanceData = async (commercialId: string) => {
    setLoading(true)
    try {
      const currentMonth = new Date().toISOString().slice(0, 7)

      const [ordersRes, clientsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('total_amount, status, created_at')
          .eq('created_by', commercialId),
        supabase
          .from('clients')
          .select('id')
          .eq('commercial_id', commercialId)
      ])

      if (ordersRes.error) throw ordersRes.error
      if (clientsRes.error) throw clientsRes.error

      const orders = ordersRes.data || []
      const clients = clientsRes.data || []

      const monthlyOrders = orders.filter(o => o.created_at.startsWith(currentMonth))
      const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
      const monthlyRevenue = monthlyOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)

      setStats({
        totalOrders: orders.length,
        totalRevenue,
        totalClients: clients.length,
        averageOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
        monthlyOrders: monthlyOrders.length,
        monthlyRevenue,
        pendingOrders: orders.filter(o => o.status === 'pending').length,
        confirmedOrders: orders.filter(o => o.status === 'confirmed').length
      })

      const monthlyMap: Record<string, { orders: number; revenue: number }> = {}
      orders.forEach(order => {
        const month = order.created_at.slice(0, 7)
        if (!monthlyMap[month]) {
          monthlyMap[month] = { orders: 0, revenue: 0 }
        }
        monthlyMap[month].orders++
        monthlyMap[month].revenue += order.total_amount || 0
      })

      const monthlyArray = Object.entries(monthlyMap)
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, 6)

      setMonthlyData(monthlyArray)
    } catch (error) {
      console.error('Error loading performance data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/commercial/dashboard')}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">أدائي التجاري</h1>
            <p className="text-indigo-100 text-sm">{commercialName}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">جاري التحميل...</div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Overall Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-4 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <ShoppingCart size={24} />
                <span className="text-3xl font-bold">{stats.totalOrders}</span>
              </div>
              <p className="text-blue-100 text-sm">إجمالي الطلبات</p>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-4 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <DollarSign size={24} />
                <span className="text-2xl font-bold">{(stats.totalRevenue / 1000).toFixed(1)}K</span>
              </div>
              <p className="text-green-100 text-sm">إجمالي المبيعات</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-4 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <Users size={24} />
                <span className="text-3xl font-bold">{stats.totalClients}</span>
              </div>
              <p className="text-purple-100 text-sm">عدد العملاء</p>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-4 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp size={24} />
                <span className="text-2xl font-bold">{stats.averageOrderValue.toFixed(0)}</span>
              </div>
              <p className="text-orange-100 text-sm">متوسط الطلب</p>
            </div>
          </div>

          {/* This Month */}
          <div className="bg-white rounded-xl shadow-lg p-4">
            <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar size={20} />
              أداء هذا الشهر
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">الطلبات</p>
                <p className="text-3xl font-bold text-blue-600">{stats.monthlyOrders}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">المبيعات</p>
                <p className="text-2xl font-bold text-green-600">
                  {(stats.monthlyRevenue / 1000).toFixed(1)}K MAD
                </p>
              </div>
            </div>
          </div>

          {/* Order Status */}
          <div className="bg-white rounded-xl shadow-lg p-4">
            <h2 className="font-bold text-gray-800 mb-4">حالة الطلبات</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <span className="text-gray-700">قيد الانتظار</span>
                <span className="font-bold text-yellow-600 text-xl">{stats.pendingOrders}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <span className="text-gray-700">مؤكد</span>
                <span className="font-bold text-green-600 text-xl">{stats.confirmedOrders}</span>
              </div>
            </div>
          </div>

          {/* Monthly Trend */}
          <div className="bg-white rounded-xl shadow-lg p-4">
            <h2 className="font-bold text-gray-800 mb-4">الأداء الشهري</h2>
            <div className="space-y-3">
              {monthlyData.map((data) => (
                <div key={data.month} className="border-b pb-3 last:border-b-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-700">
                      {new Date(data.month + '-01').toLocaleDateString('ar-MA', { year: 'numeric', month: 'long' })}
                    </span>
                    <span className="text-sm text-gray-500">{data.orders} طلب</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full"
                        style={{ width: `${Math.min((data.revenue / stats.totalRevenue) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="font-bold text-green-600 text-sm">
                      {(data.revenue / 1000).toFixed(1)}K
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
