import { useEffect, useState } from 'react'
import { ShoppingCart, DollarSign, AlertCircle, TrendingUp, Package } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    todaySales: 0,
    todayProfit: 0,
    totalCredits: 0,
    lowStockProducts: 0,
    todaySalesCount: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()

    const handlePaymentUpdate = () => {
      fetchDashboardData()
    }

    window.addEventListener('payment-updated', handlePaymentUpdate as EventListener)
    window.addEventListener('order-payment-updated', handlePaymentUpdate as EventListener)

    return () => {
      window.removeEventListener('payment-updated', handlePaymentUpdate as EventListener)
      window.removeEventListener('order-payment-updated', handlePaymentUpdate as EventListener)
    }
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]

      // 1. Ventes du jour et nombre de ventes
      const { data: todayInvoices } = await supabase
        .from('invoices')
        .select('total_amount, created_at')
        .eq('created_at::date', today)

      const todaySales = todayInvoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0
      const todaySalesCount = todayInvoices?.length || 0

      // 2. Bénéfice du jour (estimation simple)
      const todayProfit = todaySales * 0.3 // 30% de marge estimée

      // 3. Montant non payé (crédits clients)
      const { data: credits } = await supabase
        .from('invoices')
        .select('total_amount, paid_amount')
        .in('payment_status', ['partial', 'credit'])

      const totalCredits = credits?.reduce((sum, inv) => 
        sum + ((inv.total_amount || 0) - (inv.paid_amount || 0)), 0
      ) || 0

      // 4. Produits en rupture ou stock faible
      const { data: lowStock } = await supabase
        .from('products')
        .select('id')
        .lt('stock', 10)
        .eq('is_archived', false)

      const lowStockProducts = lowStock?.length || 0

      setStats({
        todaySales,
        todayProfit,
        totalCredits,
        lowStockProducts,
        todaySalesCount,
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const cards = [
    {
      title: 'المبيعات اليوم',
      value: `${stats.todaySales.toFixed(2)} د.ج`,
      icon: ShoppingCart,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
    },
    {
      title: 'الربح اليوم',
      value: `${stats.todayProfit.toFixed(2)} د.ج`,
      icon: TrendingUp,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
    },
    {
      title: 'الديون غير المسددة',
      value: `${stats.totalCredits.toFixed(2)} د.ج`,
      icon: DollarSign,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
    },
    {
      title: 'منتجات منخفضة المخزون',
      value: stats.lowStockProducts.toString(),
      icon: AlertCircle,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700',
    },
    {
      title: 'عدد المبيعات اليوم',
      value: stats.todaySalesCount.toString(),
      icon: Package,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">لوحة التحكم</h1>
        <div className="text-sm text-gray-600">
          {new Date().toLocaleDateString('ar-DZ', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* 5 indicateurs clés en grandes cartes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, index) => {
          const Icon = card.icon
          return (
            <div
              key={index}
              className={`bg-gradient-to-br ${card.color} text-white rounded-2xl p-8 shadow-xl transform transition-all duration-300 hover:scale-105 hover:shadow-2xl`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-white/80 text-lg mb-2">{card.title}</p>
                  <p className="text-4xl font-bold mb-1">{card.value}</p>
                </div>
                <div className="bg-white/20 p-4 rounded-2xl">
                  <Icon size={48} className="text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Actions rapides */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">إجراءات سريعة</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => window.location.href = '/pos'}
            className="bg-green-100 hover:bg-green-200 text-green-700 p-4 rounded-xl font-bold transition-all duration-200 transform hover:scale-105 flex flex-col items-center gap-2"
          >
            <ShoppingCart size={32} />
            فتح الكاشير
          </button>
          <button
            onClick={() => window.location.href = '/invoices'}
            className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-4 rounded-xl font-bold transition-all duration-200 transform hover:scale-105 flex flex-col items-center gap-2"
          >
            <Package size={32} />
            المبيعات
          </button>
          <button
            onClick={() => window.location.href = '/credits'}
            className="bg-red-100 hover:bg-red-200 text-red-700 p-4 rounded-xl font-bold transition-all duration-200 transform hover:scale-105 flex flex-col items-center gap-2"
          >
            <DollarSign size={32} />
            متابعة الديون
          </button>
          <button
            onClick={() => window.location.href = '/products'}
            className="bg-purple-100 hover:bg-purple-200 text-purple-700 p-4 rounded-xl font-bold transition-all duration-200 transform hover:scale-105 flex flex-col items-center gap-2"
          >
            <Package size={32} />
            المنتجات
          </button>
        </div>
      </div>

      {/* Alertes importantes */}
      {stats.lowStockProducts > 0 && (
        <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-orange-600" size={24} />
            <div>
              <p className="font-bold text-orange-800">تنبيه المخزون</p>
              <p className="text-orange-700">
                لديك {stats.lowStockProducts} منتجات منخفضة المخزون (أقل من 10 وحدات)
              </p>
            </div>
          </div>
        </div>
      )}

      {stats.totalCredits > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="text-red-600" size={24} />
            <div>
              <p className="font-bold text-red-800">الديون المستحقة</p>
              <p className="text-red-700">
                المبلغ الإجمالي غير المسدد: {stats.totalCredits.toFixed(2)} د.ج
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
                const dt = new Date(inv.invoice_date)
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
        revenueSums[key] = (revenueSums[key] || 0) + Number(inv.total_amount || 0)
      })

      // Calculate COGS for each month
      const profitData = []
      for (const month of months) {
        const monthStart = new Date(parseInt(month.key.split('-')[0]), parseInt(month.key.split('-')[1]) - 1, 1)
        const monthEnd = new Date(parseInt(month.key.split('-')[0]), parseInt(month.key.split('-')[1]), 0)
        const monthStartIso = monthStart.toISOString().split('T')[0]
        const monthEndIso = monthEnd.toISOString().split('T')[0]

        const monthRevenue = revenueSums[month.key] || 0
        const monthCogs = await calculateCostOfGoodsSold(monthStartIso, monthEndIso)
        const monthProfit = monthRevenue - monthCogs

        profitData.push({
          month: month.label,
          revenue: monthRevenue,
          profit: monthProfit,
          cogs: monthCogs,
        })
      }

      setRevenueData(profitData)
      setProfitabilityData(profitData)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const StatCard = ({ icon: Icon, label, value, color, subtext }: any) => (
    <div className="bg-white rounded-xl shadow-md p-6 border-r-4" style={{ borderColor: color }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{value}</p>
          {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
        </div>
        <div className="p-3 rounded-lg" style={{ backgroundColor: `${color}20` }}>
          <Icon size={28} style={{ color }} />
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center space-x-4 space-x-reverse">
        <img 
          src="/ba9alino_logo.jpeg" 
          alt="بقالينو" 
          className="h-12 w-auto object-contain"
        />
        <div>
          <h1 className="text-3xl font-bold text-gray-800">لوحة التحكم</h1>
          <p className="text-gray-600 mt-2">مرحباً بك في بقالينو</p>
        </div>
      </div>

      {/* Primary KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={DollarSign}
          label="الإيرادات (هذا الشهر)"
          value={`${(stats.billedRevenue / 1000).toFixed(1)}K`}
          color="#3b82f6"
          subtext={`${stats.billedRevenue.toFixed(2)} MAD`}
        />
        <StatCard
          icon={TrendingUp}
          label="الربح الإجمالي (هذا الشهر)"
          value={`${(stats.grossProfit / 1000).toFixed(1)}K`}
          color="#10b981"
          subtext={`${stats.grossProfit.toFixed(2)} MAD`}
        />
        <StatCard
          icon={Percent}
          label="نسبة الربح (%)"
          value={`${stats.profitMargin.toFixed(1)}%`}
          color="#8b5cf6"
          subtext={stats.profitMargin > 0 ? 'هامش ربح صحي' : 'يحتاج مراجعة'}
        />
        <StatCard
          icon={ShoppingCart}
          label="الطلبات المسلمة"
          value={stats.deliveredOrders}
          color="#f59e0b"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm font-medium">الإيرادات المحصلة (هذا الشهر)</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{stats.collectedRevenue.toFixed(2)} د.م.</p>
          <p className="text-xs text-gray-500 mt-1">نسبة التحصيل: {stats.billedRevenue > 0 ? ((stats.collectedRevenue / stats.billedRevenue) * 100).toFixed(1) : 0}%</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500">
          <p className="text-gray-600 text-sm font-medium">إجمالي المتأخرات</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{stats.outstandingAmount.toFixed(2)} د.م.</p>
          <p className="text-xs text-gray-500 mt-1">نسبة المتأخرات: {stats.billedRevenue > 0 ? ((stats.outstandingAmount / stats.billedRevenue) * 100).toFixed(1) : 0}%</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-amber-500">
          <p className="text-gray-600 text-sm font-medium">الطلبات قيد المعالجة</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{stats.processingOrders}</p>
          <p className="text-xs text-gray-500 mt-1">إجمالي العملاء: {stats.totalClients}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue vs Profit Chart */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">الإيرادات مقابل الربح (آخر 6 أشهر)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={profitabilityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value) => `${value.toFixed(2)} د.م.`}
                contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
              />
              <Legend />
              <Bar dataKey="revenue" fill="#3b82f6" name="الإيرادات" />
              <Bar dataKey="profit" fill="#10b981" name="الربح" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Order Status Pie Chart */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">توزيع حالات الطلبات</h2>
          <div className="flex items-center justify-between">
            <ResponsiveContainer width="60%" height={300}>
              <PieChart>
                <Pie
                  data={orderStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {orderStatusData.map((entry: any, index: any) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-40">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">الحالات</h3>
              <div className="space-y-2">
                {orderStatusData.map((item: any, index: number) => (
                  <div key={index} className="flex items-center space-x-2 space-x-reverse">
                    <div 
                      className="w-4 h-4 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-sm text-gray-700">{item.name}</span>
                    <span className="text-sm font-medium text-gray-900 mr-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profitability Metrics Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-md p-6 border-l-4 border-indigo-500">
        <h2 className="text-xl font-bold text-gray-800 mb-4">ملخص مؤشرات الربحية (هذا الشهر)</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600 font-medium">إجمالي الإيرادات</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.billedRevenue.toFixed(2)} MAD</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 font-medium">تكلفة البضائع المباعة</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{stats.costOfGoodsSold.toFixed(2)} MAD</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 font-medium">الربح الإجمالي</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.grossProfit.toFixed(2)} MAD</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 font-medium">هامش الربح</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">{stats.profitMargin.toFixed(2)}%</p>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6">آخر الطلبات</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-right py-3 px-4 font-semibold text-gray-700">رقم الطلب</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">العميل</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">المبلغ</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">الحالة</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o: any) => {
                const statusLabels: Record<string, string> = {
                  pending: 'معلقة',
                  confirmed: 'مؤكدة',
                  processing: 'قيد التجهيز',
                  shipped: 'تم الشحن',
                  delivered: 'تم التسليم',
                  cancelled: 'ملغاة',
                  returned: 'مرتجعة'
                }
                return (
                  <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-800">{o.order_number}</td>
                    <td className="py-3 px-4 text-gray-800">{o.company_name_ar}</td>
                    <td className="py-3 px-4 text-gray-800">{Number(o.total_amount || 0).toFixed(2)} د.م.</td>
                    <td className="py-3 px-4">
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        {statusLabels[o.status] || o.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{new Date(o.order_date).toLocaleDateString('ar-MA', { year: 'numeric', month: '2-digit', day: '2-digit' })}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low Stock Alert */}
      {stats.lowStockProducts > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-red-600" size={24} />
            <div>
              <h3 className="text-lg font-bold text-red-800">تنبيه: منتجات بمخزون منخفض</h3>
              <p className="text-red-700 mt-1">هناك {stats.lowStockProducts} منتج بمخزون منخفض يحتاج إلى إعادة طلب فوري</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
