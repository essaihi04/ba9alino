import { useEffect, useMemo, useState } from 'react'
import { Search, Eye, CreditCard, DollarSign, CheckCircle, Clock, XCircle, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Payment {
  id: string
  order_id?: string | null
  invoice_id: string | null
  client_id?: string | null
  invoice?: {
    id: string
    invoice_number: string
    client: {
      company_name_ar: string
      contact_person_email: string
    }
  }
  order?: {
    id: string
    order_number: string
    total_amount?: number
    payment_status?: 'pending' | 'partial' | 'paid' | 'refunded'
    client: {
      company_name_ar: string
      contact_person_email: string
    }
  }
  client?: {
    company_name_ar: string
    contact_person_email: string
  }
  amount: number
  payment_method: 'cash' | 'card' | 'bank_transfer' | 'check' | 'other'
  payment_date: string
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  transaction_id?: string
  reference_number?: string
  notes?: string
  created_at: string
  updated_at?: string
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterClient, setFilterClient] = useState<string>('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [clients, setClients] = useState<any[]>([])
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundAmount, setRefundAmount] = useState(0)
  const [refundReason, setRefundReason] = useState('')
  const [refundMaxAmount, setRefundMaxAmount] = useState<number>(0)

  useEffect(() => {
    fetchPayments()
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name_ar')
        .eq('is_active', true)
        .order('company_name_ar')
      
      if (error) throw error
      setClients(data || [])
    } catch (error) {
      console.error('Error fetching clients:', error)
    }
  }

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          invoice:invoices(
            id,
            invoice_number,
            client:clients(company_name_ar, contact_person_email)
          ),
          order:orders(
            id,
            order_number,
            total_amount,
            payment_status,
            client:clients(company_name_ar, contact_person_email)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Process payments to get client info from order if no invoice
      const processedData = (data || []).map(payment => {
        let clientInfo = payment.invoice?.client
        
        // If no client info from invoice, try to get from order
        if (!clientInfo && payment.order?.client) {
          clientInfo = payment.order.client
        }
        
        return {
          ...payment,
          client: clientInfo
        }
      })
      
      setPayments(processedData)
    } catch (error) {
      console.error('Error fetching payments:', error)
    } finally {
      setLoading(false)
    }
  }

  const getNetPaidForOrder = async (orderId: string): Promise<{ totalPaid: number; totalRefunded: number; netPaid: number }> => {
    const { data } = await supabase
      .from('payments')
      .select('amount, status')
      .eq('order_id', orderId)
      .in('status', ['completed', 'refunded'])

    const rows = data || []
    const totalPaid = rows.filter((p: any) => p.status === 'completed').reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
    const totalRefunded = rows.filter((p: any) => p.status === 'refunded').reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
    const netPaid = Math.max(0, totalPaid - totalRefunded)
    return { totalPaid, totalRefunded, netPaid }
  }

  const getNetPaidForInvoice = async (invoiceId: string): Promise<{ totalPaid: number; totalRefunded: number; netPaid: number }> => {
    const { data } = await supabase
      .from('payments')
      .select('amount, status')
      .eq('invoice_id', invoiceId)
      .in('status', ['completed', 'refunded'])

    const rows = data || []
    const totalPaid = rows.filter((p: any) => p.status === 'completed').reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
    const totalRefunded = rows.filter((p: any) => p.status === 'refunded').reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
    const netPaid = Math.max(0, totalPaid - totalRefunded)
    return { totalPaid, totalRefunded, netPaid }
  }

  const openRefundModal = async (payment: Payment) => {
    setSelectedPayment(payment)
    setRefundReason('')

    const orderId = payment.order_id || payment.order?.id
    let maxAmount = payment.amount

    try {
      if (orderId) {
        const { netPaid } = await getNetPaidForOrder(orderId)
        maxAmount = Math.min(maxAmount, netPaid)
      } else if (payment.invoice_id) {
        const { netPaid } = await getNetPaidForInvoice(payment.invoice_id)
        maxAmount = Math.min(maxAmount, netPaid)
      }
    } catch (e) {
      // ignore and fallback to payment amount
    }

    setRefundMaxAmount(Number(maxAmount || 0))
    setRefundAmount(Number(maxAmount || 0))
    setShowRefundModal(true)
  }

  const processRefund = async () => {
    if (!selectedPayment || refundAmount <= 0) return

    try {
      const maxAllowed = refundMaxAmount > 0 ? refundMaxAmount : selectedPayment.amount
      if (refundAmount > maxAllowed) {
        alert(`لا يمكن استرداد مبلغ أكبر من المتاح (${maxAllowed.toFixed(2)} MAD)`)
        return
      }

      const orderId = selectedPayment.order_id || selectedPayment.order?.id || null

      const refundPayload: any = {
        payment_number: `REF-${Date.now()}`,
        invoice_id: selectedPayment.invoice_id || null,
        order_id: orderId,
        client_id: selectedPayment.client_id || null,
        payment_date: new Date().toISOString().split('T')[0],
        amount: refundAmount,
        payment_method: selectedPayment.payment_method,
        status: 'refunded',
        reference_number: selectedPayment.reference_number || selectedPayment.transaction_id || null,
        notes: refundReason || null,
      }

      const { error: refundInsertError } = await supabase
        .from('payments')
        .insert(refundPayload)

      if (refundInsertError) throw refundInsertError

      if (selectedPayment.invoice_id) {
        const { data: invoice } = await supabase
          .from('invoices')
          .select('id, total_amount')
          .eq('id', selectedPayment.invoice_id)
          .single()

        if (invoice) {
          const { netPaid } = await getNetPaidForInvoice(selectedPayment.invoice_id)
          const totalAmount = Number(invoice.total_amount || 0)
          const newPaidAmount = Math.min(totalAmount, Math.max(0, netPaid))
          const newRemainingAmount = Math.max(0, totalAmount - newPaidAmount)
          const newStatus = newPaidAmount >= totalAmount ? 'paid' : newPaidAmount > 0 ? 'sent' : 'draft'

          await supabase
            .from('invoices')
            .update({
              paid_amount: newPaidAmount,
              remaining_amount: newRemainingAmount,
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', selectedPayment.invoice_id)
        }
      }

      if (orderId) {
        const { data: orderRow } = await supabase
          .from('orders')
          .select('id, total_amount')
          .eq('id', orderId)
          .single()

        if (orderRow) {
          const { totalPaid, totalRefunded, netPaid } = await getNetPaidForOrder(orderId)
          const orderTotal = Number(orderRow.total_amount || 0)

          let newPaymentStatus: 'pending' | 'partial' | 'paid' | 'refunded' = 'pending'
          if (netPaid >= orderTotal && orderTotal > 0) newPaymentStatus = 'paid'
          else if (netPaid > 0) newPaymentStatus = 'partial'
          else if (totalRefunded > 0 && totalPaid > 0) newPaymentStatus = 'refunded'

          await supabase
            .from('orders')
            .update({ payment_status: newPaymentStatus, updated_at: new Date().toISOString() })
            .eq('id', orderId)
        }
      }

      setShowRefundModal(false)
      setSelectedPayment(null)
      setRefundAmount(0)
      setRefundReason('')
      setRefundMaxAmount(0)
      fetchPayments()

      window.dispatchEvent(new CustomEvent('payment-updated', { detail: { type: 'refund' } }))
      window.dispatchEvent(new CustomEvent('order-payment-updated', { detail: { type: 'refund' } }))
    } catch (error) {
      console.error('Error processing refund:', error)
      alert('Erreur lors du traitement du remboursement')
    }
  }

  const filteredPayments = useMemo(() => {
    let filtered = payments

    // Search filter
    const s = searchTerm.trim().toLowerCase()
    if (s) {
      filtered = filtered.filter(payment => {
        const transactionId = String(payment.transaction_id || '').toLowerCase()
        const reference = String(payment.reference_number || '').toLowerCase()
        const invoiceNumber = String(payment.invoice?.invoice_number || '').toLowerCase()
        const orderNumber = String(payment.order?.order_number || '').toLowerCase()
        const clientName = String(payment.client?.company_name_ar || '').toLowerCase()
        return transactionId.includes(s) || reference.includes(s) || 
               invoiceNumber.includes(s) || orderNumber.includes(s) || clientName.includes(s)
      })
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(payment => payment.status === filterStatus)
    }

    // Client filter
    if (filterClient !== 'all') {
      filtered = filtered.filter(payment => 
        payment.client?.company_name_ar === filterClient
      )
    }

    // Date range filter
    if (dateRange.start) {
      filtered = filtered.filter(payment => 
        new Date(payment.payment_date) >= new Date(dateRange.start)
      )
    }
    if (dateRange.end) {
      filtered = filtered.filter(payment => 
        new Date(payment.payment_date) <= new Date(dateRange.end + 'T23:59:59')
      )
    }

    return filtered
  }, [payments, searchTerm, filterStatus, filterClient, dateRange])

  const stats = useMemo(() => {
    const total = payments.length
    const completed = payments.filter(p => p.status === 'completed').length
    const pending = payments.filter(p => p.status === 'pending').length
    const failed = payments.filter(p => p.status === 'failed').length
    const refunded = payments.filter(p => p.status === 'refunded').length
    const totalAmount = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0)
    const refundedAmount = payments
      .filter(p => p.status === 'refunded')
      .reduce((sum, p) => sum + p.amount, 0)

    return { total, completed, pending, failed, refunded, totalAmount, refundedAmount }
  }, [payments])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'refunded': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'failed': return <XCircle className="w-4 h-4" />
      case 'refunded': return <RefreshCw className="w-4 h-4" />
      default: return null
    }
  }

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'cash': return <DollarSign className="w-4 h-4" />
      case 'card': return <CreditCard className="w-4 h-4" />
      case 'bank_transfer': return <DollarSign className="w-4 h-4" />
      case 'check': return <DollarSign className="w-4 h-4" />
      default: return <DollarSign className="w-4 h-4" />
    }
  }

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'نقدي'
      case 'card': return 'بطاقة'
      case 'bank_transfer': return 'تحويل بنكي'
      case 'check': return 'شيك'
      case 'other': return 'أخرى'
      default: return method
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">المدفوعات</h1>
          <p className="text-gray-600 mt-2">إدارة وتتبع جميع المدفوعات</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-md border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">إجمالي المدفوعات</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-md border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">مكتملة</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-md border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">في الانتظار</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-md border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">فشلت</p>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-md border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">المبلغ الإجمالي</p>
              <p className="text-2xl font-bold">{stats.totalAmount.toFixed(2)} MAD</p>
            </div>
            <DollarSign className="w-8 h-8 text-emerald-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-md border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">المبلغ المسترد</p>
              <p className="text-2xl font-bold text-gray-600">{stats.refundedAmount.toFixed(2)} MAD</p>
            </div>
            <RefreshCw className="w-8 h-8 text-gray-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">فلاتر البحث</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="البحث عن دفعة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">جميع الحالات</option>
            <option value="pending">في الانتظار</option>
            <option value="completed">مكتملة</option>
            <option value="failed">فشلت</option>
            <option value="refunded">مستردة</option>
          </select>
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">جميع العملاء</option>
            {clients.map((client) => (
              <option key={client.id} value={client.company_name_ar}>
                {client.company_name_ar}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="من تاريخ"
          />
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="إلى تاريخ"
          />
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">رقم المعاملة</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">الفاتورة</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">العميل</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">التاريخ</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">الطريقة</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">المبلغ</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">حالة الدفعة</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">حالة الأمر</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    لا توجد مدفوعات
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <p className="font-medium">{payment.transaction_id || payment.reference_number || '-'}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium">
                          {payment.invoice?.invoice_number || payment.order?.order_number || '-'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {payment.invoice?.invoice_number ? 'فاتورة' : payment.order?.order_number ? 'أمر' : '-'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium">{payment.client?.company_name_ar || '-'}</p>
                        <p className="text-sm text-gray-500">{payment.client?.contact_person_email || '-'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium">{new Date(payment.payment_date).toLocaleDateString('ar-MA')}</p>
                      <p className="text-sm text-gray-500">{new Date(payment.payment_date).toLocaleTimeString('ar-MA')}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="flex items-center gap-1">
                        {getMethodIcon(payment.payment_method)}
                        {getMethodLabel(payment.payment_method)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`font-bold ${payment.status === 'completed' ? 'text-green-600' : payment.status === 'refunded' ? 'text-gray-600' : ''}`}>
                        {payment.amount.toFixed(2)} MAD
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 w-fit ${getStatusColor(payment.status)}`}>
                        {getStatusIcon(payment.status)}
                        {payment.status === 'pending' ? 'في الانتظار' :
                         payment.status === 'completed' ? 'مكتملة' :
                         payment.status === 'failed' ? 'فشلت' :
                         payment.status === 'refunded' ? 'مستردة' : payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {payment.order && (
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          payment.order.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          payment.order.payment_status === 'partial' ? 'bg-orange-100 text-orange-800' :
                          payment.order.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                          payment.order.payment_status === 'refunded' ? 'bg-gray-100 text-gray-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {payment.order.payment_status === 'pending' ? 'لم يدفع' :
                           payment.order.payment_status === 'partial' ? 'مدفوع جزئياً' :
                           payment.order.payment_status === 'paid' ? 'مدفوع بالكامل' :
                           payment.order.payment_status === 'refunded' ? 'مسترد' : payment.order.payment_status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedPayment(payment)
                            setShowDetailsModal(true)
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {payment.status === 'completed' && (
                          <button
                            onClick={() => {
                              openRefundModal(payment)
                            }}
                            className="text-orange-600 hover:text-orange-800"
                            title="استرداد"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Details Modal */}
      {showDetailsModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">تفاصيل الدفعة</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">رقم المعاملة:</span>
                <span className="font-medium">{selectedPayment.transaction_id || selectedPayment.reference_number || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">الفاتورة/الأمر:</span>
                <span className="font-medium">
                  {selectedPayment.invoice?.invoice_number || selectedPayment.order?.order_number || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">العميل:</span>
                <span className="font-medium">{selectedPayment.client?.company_name_ar || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">التاريخ:</span>
                <span className="font-medium">{new Date(selectedPayment.payment_date).toLocaleString('ar-MA')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">الطريقة:</span>
                <span className="font-medium flex items-center gap-1">
                  {getMethodIcon(selectedPayment.payment_method)}
                  {getMethodLabel(selectedPayment.payment_method)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">المبلغ:</span>
                <span className="font-bold text-lg">{selectedPayment.amount.toFixed(2)} MAD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">الحالة:</span>
                <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${getStatusColor(selectedPayment.status)}`}>
                  {getStatusIcon(selectedPayment.status)}
                  {selectedPayment.status === 'pending' ? 'في الانتظار' :
                   selectedPayment.status === 'completed' ? 'مكتملة' :
                   selectedPayment.status === 'failed' ? 'فشلت' :
                   selectedPayment.status === 'refunded' ? 'مستردة' : selectedPayment.status}
                </span>
              </div>
              {selectedPayment.notes && (
                <div>
                  <span className="text-gray-500">ملاحظات:</span>
                  <p className="mt-1">{selectedPayment.notes}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowDetailsModal(false)
                  setSelectedPayment(null)
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">استرداد الدفعة</h2>
            <div className="mb-4">
              <p className="text-gray-600">المبلغ الأصلي: {selectedPayment.amount.toFixed(2)} MAD</p>
              <p className="text-gray-600">الحد الأقصى للاسترداد: {refundMaxAmount.toFixed(2)} MAD</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); processRefund(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">مبلغ الاسترداد *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={refundMaxAmount || selectedPayment.amount}
                  required
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">سبب الاسترداد *</label>
                <textarea
                  required
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="أدخل سبب الاسترداد..."
                />
              </div>
              <div className="flex gap-4 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowRefundModal(false)
                    setSelectedPayment(null)
                    setRefundAmount(0)
                    setRefundReason('')
                    setRefundMaxAmount(0)
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
                >
                  استرداد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
