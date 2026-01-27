import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  ShoppingCart,
  Package,
  DollarSign,
  Users,
  TrendingUp,
  LogOut,
  Plus,
  Eye,
  FileText,
  Zap
} from 'lucide-react'

interface DashboardStats {
  totalOrders: number
  totalSales: number
  totalItemsSold: number
  totalRevenue: number
  totalCredit: number
  pendingOrders: number
}

export default function EmployeeDashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    totalSales: 0,
    totalItemsSold: 0,
    totalRevenue: 0,
    totalCredit: 0,
    pendingOrders: 0
  })
  const [loading, setLoading] = useState(true)
  const [employeeName, setEmployeeName] = useState('')

  useEffect(() => {
    const employeeId = localStorage.getItem('employee_id')
    const name = localStorage.getItem('employee_name')

    // Désactivé temporairement car on utilise virtual_accounts IDs comme fallback
    // Nettoyer les anciennes données corrompues
    // if (employeeId && employeeId.startsWith('682df66a')) {
    //   console.log('Cleaning corrupted employee data from dashboard')
    //   localStorage.removeItem('employee_id')
    //   localStorage.removeItem('employee_name')
    //   localStorage.removeItem('employee_role')
    //   localStorage.removeItem('employee_phone')
    //   navigate('/login')
    //   return
    // }

    if (!employeeId) {
      navigate('/login')
      return
    }

    setEmployeeName(name || 'موظف')
    console.log('Loading stats for employee:', employeeId)
    loadDashboardStats(employeeId)
  }, [navigate])

  const loadDashboardStats = async (employeeId: string) => {
    setLoading(true)
    try {
      console.log('Loading stats for employee:', employeeId)
      
      // Commandes de l'employé uniquement
      const { data: employeeOrders } = await supabase
        .from('orders')
        .select('id, total_amount, status')
        .eq('created_by', employeeId)

      // Commandes en attente de l'employé
      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('status', 'pending')
        .eq('created_by', employeeId)

      // Items vendus par l'employé (via ses commandes)
      const { data: employeeOrderItems } = await supabase
        .from('order_items')
        .select('quantity, line_total')
        .in('order_id', employeeOrders?.map(o => o.id) || [])

      // Ventes POS de l'employé (les ventes en caisse créent des invoices)
      const { data: employeeInvoices } = await supabase
        .from('invoices')
        .select('total_amount, paid_amount, employee_id')
        .eq('employee_id', employeeId)

      // Clients créés par l'employé pour le calcul du crédit
      const { data: employeeClients } = await supabase
        .from('clients')
        .select('credit_limit')
        .eq('created_by', employeeId)

      const ordersRevenue = employeeOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0
      const invoicesRevenue = employeeInvoices?.reduce((sum, inv: any) => sum + Number(inv?.total_amount || 0), 0) || 0

      const totalOrders = (employeeOrders?.length || 0) + (employeeInvoices?.length || 0)
      const totalRevenue = ordersRevenue + invoicesRevenue

      const totalItemsSold = employeeOrderItems?.reduce((sum, item: any) => sum + (item.quantity || 0), 0) || 0
      const totalCredit = employeeClients?.reduce((sum, c) => sum + (c.credit_limit || 0), 0) || 0
      const totalSales = totalOrders

      console.log('Employee stats calculated:', {
        totalOrders,
        totalRevenue,
        totalItemsSold,
        totalCredit,
        totalSales,
        pendingOrders: pendingOrders?.length || 0
      })

      setStats({
        totalOrders,
        totalSales,
        totalItemsSold,
        totalRevenue,
        totalCredit,
        pendingOrders: pendingOrders?.length || 0
      })
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('employee_id')
    localStorage.removeItem('employee_name')
    localStorage.removeItem('employee_role')
    localStorage.removeItem('employee_phone')
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600 text-lg">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">مرحبا، {employeeName}</h1>
            <p className="text-blue-100 mt-1">لوحة التحكم - مخزن وكاشير</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <LogOut size={20} />
            تسجيل خروج
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Total Orders */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-600 font-medium">إجمالي الطلبات</h3>
              <ShoppingCart className="text-blue-500" size={28} />
            </div>
            <p className="text-4xl font-bold text-gray-800">{stats.totalOrders}</p>
            <p className="text-sm text-gray-500 mt-2">طلب</p>
          </div>

          {/* Pending Orders */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-600 font-medium">طلبات معلقة</h3>
              <Zap className="text-yellow-500" size={28} />
            </div>
            <p className="text-4xl font-bold text-gray-800">{stats.pendingOrders}</p>
            <p className="text-sm text-gray-500 mt-2">في الانتظار</p>
          </div>

          {/* Total Sales */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-600 font-medium">عدد المبيعات</h3>
              <TrendingUp className="text-green-500" size={28} />
            </div>
            <p className="text-4xl font-bold text-gray-800">{stats.totalSales}</p>
            <p className="text-sm text-gray-500 mt-2">عملية بيع</p>
          </div>

          {/* Items Sold */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-600 font-medium">عدد المنتجات المباعة</h3>
              <Package className="text-purple-500" size={28} />
            </div>
            <p className="text-4xl font-bold text-gray-800">{stats.totalItemsSold}</p>
            <p className="text-sm text-gray-500 mt-2">منتج</p>
          </div>

          {/* Total Revenue */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-emerald-500">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-600 font-medium">إجمالي الإيرادات</h3>
              <DollarSign className="text-emerald-500" size={28} />
            </div>
            <p className="text-4xl font-bold text-gray-800">{stats.totalRevenue.toFixed(0)}</p>
            <p className="text-sm text-gray-500 mt-2">MAD</p>
          </div>

          {/* Total Credit */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-600 font-medium">إجمالي الائتمان</h3>
              <Users className="text-orange-500" size={28} />
            </div>
            <p className="text-4xl font-bold text-gray-800">{stats.totalCredit.toFixed(0)}</p>
            <p className="text-sm text-gray-500 mt-2">MAD</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">الإجراءات السريعة</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => navigate('/employee/orders/new')}
              className="bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-6 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex flex-col items-center gap-3"
            >
              <Plus size={32} />
              <span>طلب جديد</span>
            </button>

            <button
              onClick={() => navigate('/employee/orders')}
              className="bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white p-6 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex flex-col items-center gap-3"
            >
              <Eye size={32} />
              <span>الطلبات</span>
            </button>

            <button
              onClick={() => navigate('/employee/invoices')}
              className="bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white p-6 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex flex-col items-center gap-3"
            >
              <FileText size={32} />
              <span>الفواتير</span>
            </button>

            <button
              onClick={() => navigate('/employee/products')}
              className="bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white p-6 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex flex-col items-center gap-3"
            >
              <Package size={32} />
              <span>المنتجات</span>
            </button>

            <button
              onClick={() => navigate('/employee/pos')}
              className="bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white p-6 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex flex-col items-center gap-3"
            >
              <ShoppingCart size={32} />
              <span>كايس</span>
            </button>

            <button
              onClick={() => navigate('/employee/clients')}
              className="bg-gradient-to-br from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white p-6 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex flex-col items-center gap-3"
            >
              <Users size={32} />
              <span>العملاء</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
