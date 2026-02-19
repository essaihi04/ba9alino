import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import CommercialLayout, { CommercialSecondaryNav } from '../../components/commercial/CommercialLayout'
import { 
  ShoppingCart, 
  Users, 
  DollarSign, 
  Clock,
  MapPin,
  Camera,
  Gift,
  ChevronLeft
} from 'lucide-react'

interface DashboardStats {
  todayOrders: number
  pendingOrders: number
  todayRevenue: number
  myClients: number
}

interface RecentOrder {
  id: string
  order_number: string
  status: 'pending' | 'confirmed' | 'rejected' | 'completed'
  total_amount: number
  created_at: string
  clients?: {
    company_name_ar: string
  } | {
    company_name_ar: string
  }[]
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
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])

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
      const { data: todayOrders, error: todayError } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('created_by', commercialId)
        .gte('created_at', today)

      if (todayError) {
        console.error('Error fetching today orders:', todayError)
      }

      // Commandes en attente
      const { data: pendingOrders, error: pendingError } = await supabase
        .from('orders')
        .select('id')
        .eq('created_by', commercialId)
        .eq('status', 'pending')

      if (pendingError) {
        console.error('Error fetching pending orders:', pendingError)
      }

      // Clients du commercial
      const { data: myClients, error: clientsError } = await supabase
        .from('clients')
        .select('id')
        .eq('created_by', commercialId)

      if (clientsError) {
        console.error('Error fetching clients:', clientsError)
      }

      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total_amount,
          created_at,
          clients (
            company_name_ar
          )
        `)
        .eq('created_by', commercialId)
        .order('created_at', { ascending: false })
        .limit(5)

      if (ordersError) {
        console.error('Error fetching orders:', ordersError)
        throw ordersError
      }

      setStats({
        todayOrders: todayOrders?.length || 0,
        pendingOrders: pendingOrders?.length || 0,
        todayRevenue: todayOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
        myClients: myClients?.length || 0
      })
      
      // Safely transform orders data
      const safeOrders = (orders || []).map((order: any) => ({
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        total_amount: order.total_amount,
        created_at: order.created_at,
        clients: order.clients && !Array.isArray(order.clients) 
          ? [{ company_name_ar: order.clients.company_name_ar }]
          : Array.isArray(order.clients) 
            ? order.clients 
            : []
      })) as RecentOrder[]
      
      setRecentOrders(safeOrders)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      // Reset stats on error so page still displays
      setStats({
        todayOrders: 0,
        pendingOrders: 0,
        todayRevenue: 0,
        myClients: 0
      })
      setRecentOrders([])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <CommercialLayout title={`مرحبا، ${commercialName}`} subtitle="لوحة التحكم التجارية">
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </CommercialLayout>
    )
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      confirmed: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      completed: 'bg-blue-100 text-blue-700',
    }
    const labels: Record<string, string> = {
      pending: 'معلق', confirmed: 'مؤكد', rejected: 'مرفوض', completed: 'مكتمل',
    }
    return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[status] || ''}`}>{labels[status] || status}</span>
  }

  return (
    <CommercialLayout title={`مرحبا، ${commercialName}`} subtitle="لوحة التحكم التجارية">
      <div className="space-y-3">

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl p-4 shadow-md">
            <ShoppingCart size={20} className="mb-2 opacity-80" />
            <p className="text-3xl font-bold">{stats.todayOrders}</p>
            <p className="text-emerald-100 text-xs mt-1">طلبات اليوم</p>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-2xl p-4 shadow-md">
            <Clock size={20} className="mb-2 opacity-80" />
            <p className="text-3xl font-bold">{stats.pendingOrders}</p>
            <p className="text-orange-100 text-xs mt-1">طلبات معلقة</p>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-4 shadow-md">
            <DollarSign size={20} className="mb-2 opacity-80" />
            <p className="text-3xl font-bold">{stats.todayRevenue.toFixed(0)}</p>
            <p className="text-blue-100 text-xs mt-1">مبيعات اليوم (MAD)</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl p-4 shadow-md">
            <Users size={20} className="mb-2 opacity-80" />
            <p className="text-3xl font-bold">{stats.myClients}</p>
            <p className="text-purple-100 text-xs mt-1">عملائي</p>
          </div>
        </div>

        {/* Secondary nav pills */}
        <CommercialSecondaryNav />

        {/* Quick actions */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-sm font-bold text-gray-500 mb-3">إجراءات سريعة</p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: MapPin, label: 'الخريطة', path: '/commercial/map', color: 'bg-teal-50 text-teal-600' },
              { icon: DollarSign, label: 'التحصيل', path: '/commercial/payments', color: 'bg-amber-50 text-amber-600' },
              { icon: Gift, label: 'العروض', path: '/commercial/promotions', color: 'bg-pink-50 text-pink-600' },
              { icon: Camera, label: 'زيارة', path: '/commercial/visits/new', color: 'bg-blue-50 text-blue-600' },
            ].map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl ${item.color} active:scale-95 transition-transform`}
              >
                <item.icon size={22} />
                <span className="text-[10px] font-semibold">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent orders */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-700">آخر الطلبات</p>
            <button onClick={() => navigate('/commercial/orders')} className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              عرض الكل <ChevronLeft size={14} />
            </button>
          </div>
          {recentOrders.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-sm">لا توجد طلبات بعد</div>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((order) => {
                const clientName = (() => {
                  if (!order.clients) return 'عميل'
                  if (Array.isArray(order.clients)) return order.clients[0]?.company_name_ar || 'عميل'
                  return order.clients.company_name_ar || 'عميل'
                })()
                return (
                  <button
                    key={order.id}
                    onClick={() => navigate('/commercial/orders')}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl active:bg-gray-100 transition-colors"
                  >
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-800">{order.order_number}</p>
                      <p className="text-xs text-gray-500">{clientName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className="text-sm font-bold text-emerald-600">{Number(order.total_amount || 0).toFixed(2)} MAD</p>
                      {statusBadge(order.status)}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </CommercialLayout>
  )
}
