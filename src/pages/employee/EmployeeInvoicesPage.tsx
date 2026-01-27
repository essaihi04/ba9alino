import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Plus, Eye, Printer, Search } from 'lucide-react'

interface Invoice {
  id: string
  invoice_number: string
  order_id: string
  client_id: string
  invoice_date: string
  due_date?: string
  status?: string
  subtotal: number
  tax_amount: number
  total_amount: number
  paid_amount?: number
  remaining_amount?: number
  payment_status?: string
  payment_method?: string | null
  payments?: {
    amount?: number
    payment_method?: string
    status?: string
    payment_date?: string
    created_at?: string
  }[]
  created_at: string
  clients?: {
    company_name_ar: string
  }
}

export default function EmployeeInvoicesPage() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid' | 'credit'>('all')

  useEffect(() => {
    const employeeId = localStorage.getItem('employee_id')

    // Nettoyer les anciennes données corrompues
    if (employeeId && employeeId.startsWith('682df66a')) {
      console.log('Cleaning corrupted employee data from invoices page')
      localStorage.removeItem('employee_id')
      localStorage.removeItem('employee_name')
      localStorage.removeItem('employee_role')
      localStorage.removeItem('employee_phone')
      navigate('/login')
      return
    }

    if (!employeeId) {
      navigate('/login')
      return
    }
    loadInvoices()
  }, [navigate])

  const loadInvoices = async () => {
    setLoading(true)
    try {
      const employeeId = localStorage.getItem('employee_id')
      if (!employeeId) {
        navigate('/employee/login')
        return
      }

      console.log('Loading invoices for employee:', employeeId)
      
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          clients (
            company_name_ar
          ),
          payments (
            amount,
            payment_method,
            status,
            payment_date,
            created_at
          )
        `)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })

      if (error) throw error
      console.log('Employee invoices loaded:', data?.length, 'invoices')

      const enrichedInvoices = (data || []).map((invoice: any) => {
        const payments = Array.isArray(invoice.payments) ? invoice.payments : []
        const completedPaymentsTotal = payments
          .filter((p: any) => p?.status === 'completed')
          .reduce((sum: number, p: any) => sum + Number(p?.amount || 0), 0)

        const totalAmount = Number(invoice.total_amount || 0)
        const paidAmountFromInvoice = Number(invoice.paid_amount || 0)
        const computedPaidAmount = paidAmountFromInvoice > 0 ? paidAmountFromInvoice : completedPaymentsTotal
        const computedRemaining = Math.max(0, totalAmount - computedPaidAmount)

        const latestPayment = payments
          .slice()
          .sort((a: any, b: any) => {
            const da = new Date(a?.created_at || a?.payment_date || 0).getTime()
            const db = new Date(b?.created_at || b?.payment_date || 0).getTime()
            return db - da
          })[0]

        const computedPaymentStatus = computedRemaining === 0
          ? 'paid'
          : (computedPaidAmount > 0 ? 'partial' : 'unpaid')

        const finalPaymentStatus = (invoice.payment_status === 'credit')
          ? 'credit'
          : computedPaymentStatus

        return {
          ...invoice,
          paid_amount: computedPaidAmount,
          remaining_amount: computedRemaining,
          payment_method: latestPayment?.payment_method || null,
          payment_status: finalPaymentStatus,
        }
      })

      setInvoices(enrichedInvoices)
    } catch (error) {
      console.error('Error loading invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.invoice_number.includes(searchQuery) ||
      invoice.clients?.company_name_ar.includes(searchQuery)
    const matchesFilter = filter === 'all' || (invoice.payment_status || '') === filter
    return matchesSearch && matchesFilter
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return { text: 'مدفوعة', className: 'bg-green-100 text-green-700' }
      case 'partial':
        return { text: 'جزئية', className: 'bg-yellow-100 text-yellow-700' }
      case 'unpaid':
        return { text: 'غير مدفوعة', className: 'bg-red-100 text-red-700' }
      case 'credit':
        return { text: 'دين', className: 'bg-purple-100 text-purple-700' }
      default:
        return { text: status, className: 'bg-gray-100 text-gray-700' }
    }
  }

  return (
    <div className="min-h-screen bg-gray-100" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/employee/dashboard')}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-bold">الفواتير</h1>
              <p className="text-purple-100">إدارة الفواتير والدفع</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/employee/invoices/new')}
            className="bg-white text-purple-600 px-6 py-3 rounded-lg font-bold hover:bg-purple-50 transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            فاتورة جديدة
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
                className="w-full pr-10 pl-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                placeholder="ابحث عن رقم الفاتورة أو اسم العميل..."
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {['all', 'paid', 'partial', 'unpaid', 'credit'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status as any)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === status
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {status === 'all' && 'الكل'}
                {status === 'paid' && 'مدفوعة'}
                {status === 'partial' && 'جزئية'}
                {status === 'unpaid' && 'غير مدفوعة'}
                {status === 'credit' && 'دين'}
              </button>
            ))}
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-500">جاري التحميل...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-gray-500">لا توجد فواتير</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">رقم الفاتورة</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">العميل</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">التاريخ</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">المبلغ</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">المدفوع</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">المتبقي</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">الحالة</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-gray-700">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredInvoices.map((invoice) => {
                    const statusBadge = getStatusBadge(String(invoice.payment_status || 'unpaid'))
                    const paid = Number(invoice.paid_amount || 0)
                    const remaining = Number(invoice.remaining_amount || 0)
                    return (
                      <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-800">#{invoice.invoice_number}</td>
                        <td className="px-6 py-4 text-gray-700">{invoice.clients?.company_name_ar || 'غير محدد'}</td>
                        <td className="px-6 py-4 text-gray-600">{new Date(invoice.invoice_date).toLocaleDateString('ar-MA')}</td>
                        <td className="px-6 py-4 font-bold text-gray-800">{invoice.total_amount.toFixed(2)} MAD</td>
                        <td className="px-6 py-4 text-green-600 font-bold">{paid.toFixed(2)} MAD</td>
                        <td className="px-6 py-4 text-orange-600 font-bold">{remaining.toFixed(2)} MAD</td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusBadge.className}`}>
                            {statusBadge.text}
                          </span>
                        </td>
                        <td className="px-6 py-4 flex gap-2">
                          <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-1">
                            <Eye size={16} />
                            عرض
                          </button>
                          <button className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-1">
                            <Printer size={16} />
                            طباعة
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
    </div>
  )
}
