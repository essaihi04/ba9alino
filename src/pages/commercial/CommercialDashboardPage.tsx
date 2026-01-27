import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { 
  ShoppingCart, 
  Users, 
  Package, 
  DollarSign, 
  LogOut,
  Plus,
  TrendingUp,
  Clock,
  MapPin,
  Camera,
  BarChart3
} from 'lucide-react'

interface DashboardStats {
  todayOrders: number
  pendingOrders: number
  todayRevenue: number
  myClients: number
}

export default function CommercialDashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats>({
    todayOrders: 0,
    pendingOrders: 0,
    todayRevenue: 0,
    myClients: 0
  })
  const [loading, setLoading] = useState(true)
  const [commercialName, setCommercialName] = useState('')

  useEffect(() => {
    // Vérifier l'authentification
    const commercialId = localStorage.getItem('commercial_id')
    const name = localStorage.getItem('commercial_name')
    
    if (!commercialId) {
      navigate('/commercial/login')
      return
    }

    setCommercialName(name || 'تاجر')
    loadDashboardData(commercialId)
  }, [navigate])

  const loadDashboardData = async (commercialId: string) => {
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]

      // Commandes du jour
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('created_by', commercialId)
        .gte('created_at', today)

      // Commandes en attente
      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('created_by', commercialId)
        .eq('status', 'pending')

      // Clients du commercial
      const { data: myClients } = await supabase
        .from('clients')
        .select('id')
        .eq('created_by', commercialId)

      setStats({
        todayOrders: todayOrders?.length || 0,
        pendingOrders: pendingOrders?.length || 0,
        todayRevenue: todayOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
        myClients: myClients?.length || 0
      })
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('commercial_id')
    localStorage.removeItem('commercial_name')
    localStorage.removeItem('commercial_role')
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">مرحبا، {commercialName}</h1>
            <p className="text-blue-100 text-sm">لوحة التحكم التجارية</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-white/20 hover:bg-white/30 p-3 rounded-lg transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <ShoppingCart size={24} />
              <span className="text-2xl font-bold">{stats.todayOrders}</span>
            </div>
            <p className="text-green-100 text-sm">طلبات اليوم</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Clock size={24} />
              <span className="text-2xl font-bold">{stats.pendingOrders}</span>
            </div>
            <p className="text-orange-100 text-sm">طلبات معلقة</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <DollarSign size={24} />
              <span className="text-2xl font-bold">{stats.todayRevenue.toFixed(0)}</span>
            </div>
            <p className="text-blue-100 text-sm">مبيعات اليوم (MAD)</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Users size={24} />
              <span className="text-2xl font-bold">{stats.myClients}</span>
            </div>
            <p className="text-purple-100 text-sm">عملائي</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">إجراءات سريعة</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/commercial/orders/new')}
              className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex flex-col items-center gap-2"
            >
              <Plus size={24} />
              <span className="text-sm">طلب جديد</span>
            </button>

            <button
              onClick={() => navigate('/commercial/map')}
              className="bg-teal-600 hover:bg-teal-700 text-white p-4 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex flex-col items-center gap-2"
            >
              <MapPin size={24} />
              <span className="text-sm">خريطة العملاء</span>
            </button>

            <button
              onClick={() => navigate('/commercial/payments')}
              className="bg-amber-600 hover:bg-amber-700 text-white p-4 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex flex-col items-center gap-2"
            >
              <DollarSign size={24} />
              <span className="text-sm">التحصيل</span>
            </button>

            <button
              onClick={() => navigate('/commercial/clients')}
              className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex flex-col items-center gap-2"
            >
              <Users size={24} />
              <span className="text-sm">عملائي</span>
            </button>

            <button
              onClick={() => navigate('/commercial/products')}
              className="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex flex-col items-center gap-2"
            >
              <Package size={24} />
              <span className="text-sm">المنتجات</span>
            </button>

            <button
              onClick={() => navigate('/commercial/orders')}
              className="bg-orange-600 hover:bg-orange-700 text-white p-4 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex flex-col items-center gap-2"
            >
              <TrendingUp size={24} />
              <span className="text-sm">طلباتي</span>
            </button>

            <button
              onClick={() => navigate('/commercial/performance')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex flex-col items-center gap-2"
            >
              <BarChart3 size={24} />
              <span className="text-sm">أدائي</span>
            </button>

            <button
              onClick={() => navigate('/commercial/visits/new')}
              className="bg-pink-600 hover:bg-pink-700 text-white p-4 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex flex-col items-center gap-2"
            >
              <Camera size={24} />
              <span className="text-sm">زيارة جديدة</span>
            </button>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">آخر الطلبات</h2>
          <div className="text-center text-gray-500 py-8">
            قريبا...
          </div>
        </div>
      </div>
    </div>
  )
}
