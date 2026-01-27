import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, TrendingUp, Package, AlertCircle, CheckCircle, Clock, Filter, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Client {
  id: string
  company_name_ar: string
  company_name_en?: string
  contact_person_email: string
  contact_person_phone: string
  address: string
  city: string
  subscription_tier: string
  is_active: boolean
  created_at: string
}

interface Order {
  id: string
  order_number: string
  order_date: string
  total_amount: number
  final_amount?: number
  payment_status: 'pending' | 'partial' | 'paid' | 'refunded' | 'credit'
  status: string
  items: OrderItem[]
  order_items?: OrderItem[]
  payments: Payment[]
}

interface OrderItem {
  id: string
  product_id: string
  product_name_ar: string
  product_sku: string
  quantity: number
  unit_price: number
  line_total: number
  product?: {
    id: string
    name_ar: string
    sku: string
    image_url?: string
  }
}

interface Payment {
  id: string
  amount: number
  payment_method: string
  payment_date: string
}

interface ClientStats {
  totalOrders: number
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  totalProducts: number
  averageOrderValue: number
  firstOrderDate: string
  lastOrderDate: string
  creditOrders: number
  paidOrders: number
  partialOrders: number
}

export default function ClientTrackingPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const navigate = useNavigate()
  
  const [client, setClient] = useState<Client | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<ClientStats>({
    totalOrders: 0,
    totalAmount: 0,
    paidAmount: 0,
    remainingAmount: 0,
    totalProducts: 0,
    averageOrderValue: 0,
    firstOrderDate: '',
    lastOrderDate: '',
    creditOrders: 0,
    paidOrders: 0,
    partialOrders: 0
  })
  
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    if (clientId) {
      fetchClientData()
    }
  }, [clientId])

  const fetchClientData = async () => {
    try {
      setLoading(true)
      
      // Fetch client info
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()
      
      if (clientError) throw clientError
      setClient(clientData)
      
      // Fetch orders with items and payments
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          items,
          order_items:order_items(
            id,
            product_id,
            product_name_ar,
            product_sku,
            quantity,
            unit_price,
            line_total
          ),
          payments:payments(
            id,
            amount,
            payment_method,
            payment_date
          )
        `)
        .eq('client_id', clientId)
        .order('order_date', { ascending: false })
      
      if (ordersError) throw ordersError
      
      const orders = (ordersData || []).map((order: any) => {
        const relItems = Array.isArray(order.order_items) ? order.order_items : []
        const jsonItems = Array.isArray(order.items) ? order.items : []

        const merged = (relItems.length > 0 ? relItems : jsonItems).map((it: any) => ({
          id: it.id || `${order.id}-${it.product_id || it.product_sku || Math.random()}`,
          product_id: it.product_id,
          product_name_ar: it.product_name_ar || it.product?.name_ar || it.name_ar || it.product_name || 'منتج بدون اسم',
          product_sku: it.product_sku || it.product?.sku || it.sku || '',
          quantity: Number(it.quantity || 0),
          unit_price: Number(it.unit_price || 0),
          line_total: Number(it.line_total || (Number(it.quantity || 0) * Number(it.unit_price || 0)) || 0),
          product: it.product
        }))

        return {
          ...order,
          items: merged,
          order_items: relItems
        }
      })

      setOrders(orders as any)
      
      // Calculate statistics
      calculateStats(orders)
      
    } catch (error) {
      console.error('Error fetching client data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (ordersData: Order[]) => {
    const totalOrders = ordersData.length
    const totalAmount = ordersData.reduce((sum, order) => sum + (order.final_amount || order.total_amount || 0), 0)
    const paidAmount = ordersData.reduce((sum, order) => {
      const orderPayments = order.payments || []
      return sum + orderPayments.reduce((paymentSum, payment) => paymentSum + (payment.amount || 0), 0)
    }, 0)
    const remainingAmount = totalAmount - paidAmount
    const totalProducts = ordersData.reduce((sum, order) => {
      const orderItems = order.items || []
      return sum + orderItems.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0)
    }, 0)
    const averageOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0
    
    const orderDates = ordersData.map(order => order.order_date).filter(Boolean)
    const firstOrderDate = orderDates.length > 0 ? orderDates[0] : ''
    const lastOrderDate = orderDates.length > 0 ? orderDates[orderDates.length - 1] : ''
    
    const creditOrders = ordersData.filter(order => order.payment_status === 'pending' || order.payment_status === 'credit').length
    const paidOrders = ordersData.filter(order => order.payment_status === 'paid').length
    const partialOrders = ordersData.filter(order => order.payment_status === 'partial').length
    
    setStats({
      totalOrders,
      totalAmount,
      paidAmount,
      remainingAmount,
      totalProducts,
      averageOrderValue,
      firstOrderDate,
      lastOrderDate,
      creditOrders,
      paidOrders,
      partialOrders
    })
  }

  const filteredOrders = orders.filter(order => {
    const matchesSearch = (order.order_number || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    let matchesDate = true
    if (dateFilter === 'custom' && startDate && endDate) {
      const orderDate = new Date(order.order_date)
      const start = new Date(startDate)
      const end = new Date(endDate)
      // Normalize dates to ignore time by setting to start/end of day
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      matchesDate = orderDate >= start && orderDate <= end
    } else if (dateFilter === 'today') {
      const today = new Date()
      const orderDate = new Date(order.order_date)
      matchesDate = orderDate.toDateString() === today.toDateString()
    } else if (dateFilter === 'week') {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const orderDate = new Date(order.order_date)
      matchesDate = orderDate >= weekAgo
    } else if (dateFilter === 'month') {
      const monthAgo = new Date()
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      const orderDate = new Date(order.order_date)
      matchesDate = orderDate >= monthAgo
    }
    
    return matchesSearch && matchesDate
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
            <CheckCircle size={12} />
            مدفوعة
          </span>
        )
      case 'partial':
        return (
          <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
            <Clock size={12} />
            جزئية
          </span>
        )
      case 'pending':
      case 'credit':
        return (
          <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
            <AlertCircle size={12} />
            دين
          </span>
        )
      default:
        return (
          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-medium">
            {status}
          </span>
        )
    }
  }

  const exportData = () => {
    const csvContent = [
      ['رقم الطلب', 'التاريخ', 'المبلغ الإجمالي', 'المبلغ المدفوع', 'المبلغ المتبقي', 'الحالة', 'عدد المنتجات'],
      ...filteredOrders.map(order => [
        order.order_number,
        new Date(order.order_date).toLocaleDateString('ar-MA'),
        (order.final_amount || order.total_amount || 0).toFixed(2),
        (order.payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0).toFixed(2),
        ((order.final_amount || order.total_amount || 0) - (order.payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0)).toFixed(2),
        order.payment_status,
        (order.items?.length || 0)
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `client_${client?.company_name_ar}_report.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">العميل غير موجود</p>
        <button
          onClick={() => navigate('/invoices')}
          className="mt-4 text-blue-600 hover:text-blue-800"
        >
          العودة إلى قائمة العملاء
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/invoices')}
            className="p-2 text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">متابعة العميل</h1>
            <p className="text-gray-600">{client.company_name_ar}</p>
          </div>
        </div>
        <button
          onClick={exportData}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <Download size={16} />
          تصدير البيانات
        </button>
      </div>

      {/* Client Info */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">معلومات العميل</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">الاسم</p>
            <p className="font-medium">{client.company_name_ar}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">الهاتف</p>
            <p className="font-medium">{client.contact_person_phone}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">البريد الإلكتروني</p>
            <p className="font-medium">{client.contact_person_email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">العنوان</p>
            <p className="font-medium">{client.address}, {client.city}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">فئة الاشتراك</p>
            <p className="font-medium">{client.subscription_tier}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">تاريخ الإنشاء</p>
            <p className="font-medium">{new Date(client.created_at).toLocaleDateString('ar-MA')}</p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">إجمالي الطلبات</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalOrders}</p>
            </div>
            <Package className="text-blue-600" size={24} />
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">إجمالي المشتريات</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalAmount.toFixed(2)} MAD</p>
            </div>
            <TrendingUp className="text-green-600" size={24} />
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">المدفوع</p>
              <p className="text-2xl font-bold text-green-600">{stats.paidAmount.toFixed(2)} MAD</p>
            </div>
            <CheckCircle className="text-green-600" size={24} />
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">المتبقي</p>
              <p className="text-2xl font-bold text-red-600">{stats.remainingAmount.toFixed(2)} MAD</p>
            </div>
            <AlertCircle className="text-red-600" size={24} />
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">متوسط قيمة الطلب</p>
          <p className="text-xl font-bold text-gray-800">{stats.averageOrderValue.toFixed(2)} MAD</p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">إجمالي المنتجات</p>
          <p className="text-xl font-bold text-gray-800">{stats.totalProducts}</p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">آخر طلب</p>
          <p className="text-sm font-medium text-gray-800">
            {stats.firstOrderDate ? new Date(stats.firstOrderDate).toLocaleDateString('ar-MA') : 'N/A'}
          </p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">أول طلب</p>
          <p className="text-sm font-medium text-gray-800">
            {stats.lastOrderDate ? new Date(stats.lastOrderDate).toLocaleDateString('ar-MA') : 'N/A'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">الطلبات</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
          >
            <Filter size={16} />
            فلاتر
          </button>
        </div>
        
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="relative">
              <Search className="absolute right-3 top-3 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="بحث عن طلب..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">كل الفترات</option>
              <option value="today">اليوم</option>
              <option value="week">آخر 7 أيام</option>
              <option value="month">آخر 30 يوم</option>
              <option value="custom">فترة مخصصة</option>
            </select>
            
            {dateFilter === 'custom' && (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">رقم الطلب</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">التاريخ</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">المنتجات</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">المبلغ الإجمالي</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">المدفوع</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">المتبقي</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    لا توجد طلبات مطابقة للفلاتر
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const orderTotal = order.final_amount || order.total_amount || 0
                  const paidAmount = (order.payments || []).reduce((sum, payment) => sum + (payment.amount || 0), 0)
                  const remainingAmount = orderTotal - paidAmount
                  
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium">{order.order_number}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{new Date(order.order_date).toLocaleDateString('ar-MA')}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-xs">
                          {order.items && order.items.length > 0 ? (
                            <div>
                              {order.items.slice(0, 2).map((item, index) => (
                                <p key={index} className="text-sm text-gray-700 truncate">
                                  {item.product_name_ar || item.product?.name_ar || 'منتج بدون اسم'}
                                  {item.quantity > 1 && <span className="text-gray-500"> x{item.quantity}</span>}
                                </p>
                              ))}
                              {order.items.length > 2 && (
                                <p className="text-xs text-blue-600">
                                  +{order.items.length - 2} أخرى
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-gray-500">لا توجد منتجات</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{orderTotal.toFixed(2)} MAD</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-green-600">{paidAmount.toFixed(2)} MAD</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className={`font-medium ${remainingAmount > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                          {remainingAmount.toFixed(2)} MAD
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(order.payment_status || '')}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
