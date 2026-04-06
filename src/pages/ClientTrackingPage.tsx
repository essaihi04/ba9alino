import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, TrendingUp, Package, AlertCircle, CheckCircle, Clock, Filter, Search, DollarSign, X } from 'lucide-react'
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

interface Invoice {
  id: string
  invoice_number: string
  invoice_date?: string | null
  created_at: string
  total_amount: number
  order_number: string
  order_date: string
  final_amount?: number
  paid_amount?: number | null
  remaining_amount?: number | null
  payment_status: 'pending' | 'partial' | 'paid' | 'refunded' | 'credit'
  items?: OrderItem[]
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
  const [orders, setOrders] = useState<Invoice[]>([])
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
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentLoading, setPaymentLoading] = useState(false)

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
      
      // Fetch invoices with items and payments
      const { data: ordersData, error: ordersError } = await supabase
        .from('invoices')
        .select(`
          *,
          payments:payments(
            id,
            amount,
            payment_method,
            payment_date
          )
        `)
        .eq('client_id', clientId)
        .order('invoice_date', { ascending: false })
      
      if (ordersError) throw ordersError
      
      const orders = (ordersData || []).map((invoice: any) => {
        const jsonItems = Array.isArray(invoice.items) ? invoice.items : []

        const merged = jsonItems.map((it: any) => ({
          id: it.id || `${invoice.id}-${it.product_id || it.product_sku || Math.random()}`,
          product_id: it.product_id,
          product_name_ar: it.product_name_ar || it.product?.name_ar || it.name_ar || it.product_name || 'منتج بدون اسم',
          product_sku: it.product_sku || it.product?.sku || it.sku || '',
          quantity: Number(it.quantity || 0),
          unit_price: Number(it.unit_price || 0),
          line_total: Number(it.line_total || (Number(it.quantity || 0) * Number(it.unit_price || 0)) || 0),
          product: it.product
        }))

        return {
          ...invoice,
          order_number: invoice.invoice_number,
          order_date: invoice.invoice_date || invoice.created_at,
          final_amount: invoice.total_amount,
          items: merged,
          paid_amount: Number(invoice.paid_amount || 0),
          remaining_amount: Number(invoice.remaining_amount || Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0)))
        }
      })

      setOrders(orders as Invoice[])
      
      // Calculate statistics
      calculateStats(orders as any)
      
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
      const directPaidAmount = Number((order as any).paid_amount || 0)
      if (directPaidAmount > 0) return sum + directPaidAmount
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
          onClick={() => navigate('/credits')}
          className="mt-4 text-blue-600 hover:text-blue-800"
        >
          العودة إلى قائمة العملاء
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/credits')}
            className="p-1 text-gray-600 hover:text-gray-800 rounded hover:bg-gray-100"
          >
            <ArrowLeft size={16} />
          </button>
        </div>
      </div>

      {/* Client Info */}
      <div className="bg-white border border-gray-200 rounded p-2">
        <h2 className="text-sm font-semibold mb-1">معلومات العميل</h2>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] text-gray-500">الاسم</p>
            <p className="font-medium text-xs">{client.company_name_ar}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500">الهاتف</p>
            <p className="font-medium text-xs">{client.contact_person_phone}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500">البريد الإلكتروني</p>
            <p className="font-medium text-xs">{client.contact_person_email}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500">العنوان</p>
            <p className="font-medium text-xs">{client.address}, {client.city}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500">فئة الاشتراك</p>
            <p className="font-medium text-xs">{client.subscription_tier}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500">تاريخ الإنشاء</p>
            <p className="font-medium text-xs">{new Date(client.created_at).toLocaleDateString('ar-MA')}</p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white border border-gray-200 rounded p-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500">إجمالي الطلبات</p>
              <p className="text-sm font-bold text-gray-800">{stats.totalOrders}</p>
            </div>
            <Package className="text-blue-600" size={16} />
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded p-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500">إجمالي المشتريات</p>
              <p className="text-sm font-bold text-gray-800">{stats.totalAmount.toFixed(2)} MAD</p>
            </div>
            <TrendingUp className="text-green-600" size={16} />
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded p-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500">المدفوع</p>
              <p className="text-sm font-bold text-green-600">{stats.paidAmount.toFixed(2)} MAD</p>
            </div>
            <CheckCircle className="text-green-600" size={16} />
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded p-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500">المتبقي</p>
              <p className="text-sm font-bold text-red-600">{stats.remainingAmount.toFixed(2)} MAD</p>
            </div>
            <AlertCircle className="text-red-600" size={16} />
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white border border-gray-200 rounded p-2">
          <p className="text-[10px] text-gray-500">متوسط قيمة الطلب</p>
          <p className="text-sm font-bold text-gray-800">{stats.averageOrderValue.toFixed(2)} MAD</p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded p-2">
          <p className="text-[10px] text-gray-500">إجمالي المنتجات</p>
          <p className="text-sm font-bold text-gray-800">{stats.totalProducts}</p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded p-2">
          <p className="text-[10px] text-gray-500">آخر طلب</p>
          <p className="text-xs font-medium text-gray-800">
            {stats.firstOrderDate ? new Date(stats.firstOrderDate).toLocaleDateString('ar-MA') : 'N/A'}
          </p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded p-2">
          <p className="text-[10px] text-gray-500">أول طلب</p>
          <p className="text-xs font-medium text-gray-800">
            {stats.lastOrderDate ? new Date(stats.lastOrderDate).toLocaleDateString('ar-MA') : 'N/A'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded p-2">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold">الفواتير</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
          >
            <Filter size={16} />
            فلاتر
          </button>
        </div>
        
        {showFilters && (
          <div className="grid grid-cols-4 gap-2 mb-2">
            <div className="relative">
              <Search className="absolute right-3 top-3 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="بحث عن فاتورة..."
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

      {/* Invoices Table */}
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1.5 text-right font-medium text-gray-700">رقم الفاتورة</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-700">التاريخ</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-700">المنتجات</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-700">المبلغ الإجمالي</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-700">المدفوع</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-700">المتبقي</th>
                <th className="px-2 py-1.5 text-right font-medium text-gray-700">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    لا توجد فواتير مطابقة للفلاتر
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const orderTotal = order.final_amount || order.total_amount || 0
                  const paidAmount = Number((order as any).paid_amount || (order.payments || []).reduce((sum, payment) => sum + (payment.amount || 0), 0))
                  const remainingAmount = Number((order as any).remaining_amount ?? (orderTotal - paidAmount))
                  
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5">
                        <p className="font-medium">{order.order_number}</p>
                      </td>
                      <td className="px-2 py-1.5">
                        <p>{new Date(order.order_date).toLocaleDateString('ar-MA')}</p>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="max-w-xs">
                          {order.items && order.items.length > 0 ? (
                            <div>
                              {order.items.slice(0, 2).map((item, index) => (
                                <p key={index} className="text-gray-700 truncate">
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
                      <td className="px-2 py-1.5">
                        <p className="font-medium">{orderTotal.toFixed(2)} MAD</p>
                      </td>
                      <td className="px-2 py-1.5">
                        <p className="text-green-600">{paidAmount.toFixed(2)} MAD</p>
                      </td>
                      <td className="px-2 py-1.5">
                        <p className={`font-medium ${remainingAmount > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                          {remainingAmount.toFixed(2)} MAD
                        </p>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          {getStatusBadge(order.payment_status || '')}
                          {remainingAmount > 0 && (
                            <button
                              onClick={() => {
                                setPaymentInvoice(order)
                                setPaymentAmount('')
                                setPaymentMethod('cash')
                                setShowPaymentModal(true)
                              }}
                              className="text-purple-600 hover:text-purple-800 p-0.5 rounded hover:bg-purple-50"
                              title="إضافة دفعة"
                            >
                              <DollarSign size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal إضافة دفعة */}
      {showPaymentModal && paymentInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <DollarSign className="text-purple-600" size={20} />
                إضافة دفعة
              </h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="text-gray-600">فاتورة: <span className="font-bold">{paymentInvoice.order_number}</span></p>
                <p className="text-gray-600">المبلغ الإجمالي: <span className="font-bold">{(paymentInvoice.final_amount || paymentInvoice.total_amount || 0).toFixed(2)} MAD</span></p>
                <p className="text-red-600 font-bold">المتبقي: {((paymentInvoice.final_amount || paymentInvoice.total_amount || 0) - (paymentInvoice.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0)).toFixed(2)} MAD</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">المبلغ المدفوع *</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="أدخل المبلغ"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">طريقة الدفع</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="cash">نقدي</option>
                  <option value="check">شيك</option>
                  <option value="bank_transfer">تحويل بنكي</option>
                  <option value="card">بطاقة</option>
                </select>
              </div>

              <button
                onClick={async () => {
                  if (!paymentAmount || Number(paymentAmount) <= 0) {
                    alert('يرجى إدخال مبلغ صحيح')
                    return
                  }
                  setPaymentLoading(true)
                  try {
                    const invoiceId = paymentInvoice.id
                    const amount = Number(paymentAmount)

                    // Generate payment number
                    const paymentNumber = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
                    
                    // Insert payment
                    const { error: paymentError } = await supabase
                      .from('payments')
                      .insert({
                        payment_number: paymentNumber,
                        invoice_id: invoiceId,
                        amount: amount,
                        payment_method: paymentMethod,
                        payment_date: new Date().toISOString(),
                        status: 'completed'
                      })

                    if (paymentError) throw paymentError

                    // Update invoice paid_amount and remaining_amount
                    const totalAmount = paymentInvoice.final_amount || paymentInvoice.total_amount || 0
                    const currentPaid = Number((paymentInvoice as any).paid_amount || (paymentInvoice.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0))
                    const newPaid = currentPaid + amount
                    const newRemaining = Math.max(0, totalAmount - newPaid)

                    const { error: updateError } = await supabase
                      .from('invoices')
                      .update({
                        paid_amount: newPaid,
                        remaining_amount: newRemaining,
                        payment_status: newRemaining <= 0 ? 'paid' : 'partial'
                      })
                      .eq('id', invoiceId)

                    if (updateError) throw updateError

                    setShowPaymentModal(false)
                    alert('تم إضافة الدفعة بنجاح')
                    fetchClientData()
                  } catch (error) {
                    console.error('Error adding payment:', error)
                    alert('حدث خطأ أثناء إضافة الدفعة')
                  } finally {
                    setPaymentLoading(false)
                  }
                }}
                disabled={paymentLoading}
                className="w-full bg-purple-600 text-white py-2 rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50"
              >
                {paymentLoading ? 'جاري الإضافة...' : 'إضافة الدفعة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
