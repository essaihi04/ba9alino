import { useEffect, useState, useMemo } from 'react'
import { Search, DollarSign, CreditCard, CheckCircle, Clock, AlertCircle, Plus, FileText, ArrowUpDown, Calendar, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useInputPad } from '../components/useInputPad'

interface Invoice {
  id: string
  invoice_number: string
  invoice_date: string
  client_id: string | null
  client_name: string | null
  client_phone: string | null
  client_address: string | null
  company_name_ar: string | null
  order_id: string | null
  order_number: string | null
  subtotal: number | null
  tax_rate: number | null
  tax_amount: number | null
  discount_amount: number | null
  total_amount: number | null
  paid_amount: number | null
  remaining_amount: number | null
  currency: string | null
  status: string | null
  payment_status: string | null
  payment_method?: string | null
  notes?: string
  created_at: string
}

export default function PaymentsPage() {
  const inputPad = useInputPad()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('unpaid')
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('all')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('date_desc')
  const [showFilters, setShowFilters] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  
  // Champs pour les informations du chèque
  const [checkNumber, setCheckNumber] = useState('')
  const [checkBank, setCheckBank] = useState('')
  const [checkDepositDate, setCheckDepositDate] = useState('')
  
  // Champs pour les informations du virement bancaire
  const [transferBank, setTransferBank] = useState('')
  const [transferReference, setTransferReference] = useState('')
  const [transferDate, setTransferDate] = useState('')
  
  // Liste des banques marocaines
  const banks = [
    'Attijariwafa Bank',
    'Banque Populaire',
    'BMCE Bank',
    'CIH Bank',
    'Crédit Agricole',
    'Crédit du Maroc',
    'Société Générale',
    'BMCI',
    'Al Barid Bank',
    'Autre'
  ]

  useEffect(() => {
    loadInvoices()
  }, [])

  const loadInvoices = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          payments (
            amount,
            payment_method,
            status,
            payment_date,
            created_at
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      const processedData = (data || []).map((invoice: any) => {
        const payments = Array.isArray(invoice.payments) ? invoice.payments : []

        const completedPaymentsTotal = payments
          .filter((p: any) => p?.status === 'completed')
          .reduce((sum: number, p: any) => sum + Number(p?.amount || 0), 0)

        const paidAmountFromInvoice = Number(invoice.paid_amount || 0)
        const totalAmount = Number(invoice.total_amount || 0)

        // Use invoice.paid_amount if present (>0) otherwise fallback to sum(payments)
        const computedPaidAmount = paidAmountFromInvoice > 0 ? paidAmountFromInvoice : completedPaymentsTotal
        const computedRemaining = Math.max(0, totalAmount - computedPaidAmount)

        const latestPayment = payments
          .slice()
          .sort((a: any, b: any) => {
            const da = new Date(a?.created_at || a?.payment_date || 0).getTime()
            const db = new Date(b?.created_at || b?.payment_date || 0).getTime()
            return db - da
          })[0]

        return {
          ...invoice,
          paid_amount: computedPaidAmount,
          remaining_amount: computedRemaining,
          payment_method: latestPayment?.payment_method || null,
          status: computedRemaining === 0 ? 'paid' : (computedPaidAmount > 0 ? 'partial' : (invoice.status || 'sent'))
        }
      })
      
      setInvoices(processedData)
    } catch (error) {
      console.error('Error loading invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredInvoices = useMemo(() => {
    let result = invoices.filter(invoice => {
      const matchesSearch = (invoice.client_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (invoice.company_name_ar || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (invoice.invoice_number || '').toLowerCase().includes(searchTerm.toLowerCase())
      
      let matchesStatus = true
      if (filterStatus === 'unpaid') {
        matchesStatus = (invoice.remaining_amount || 0) > 0 && (invoice.paid_amount || 0) === 0
      } else if (filterStatus === 'paid') {
        matchesStatus = (invoice.remaining_amount || 0) === 0
      } else if (filterStatus === 'partial') {
        matchesStatus = (invoice.paid_amount || 0) > 0 && (invoice.remaining_amount || 0) > 0
      } else if (filterStatus === 'has_debt') {
        matchesStatus = (invoice.remaining_amount || 0) > 0
      }

      let matchesPaymentMethod = true
      if (filterPaymentMethod !== 'all') {
        matchesPaymentMethod = invoice.payment_method === filterPaymentMethod
      }

      let matchesDate = true
      const invDate = invoice.invoice_date || invoice.created_at?.slice(0, 10) || ''
      if (filterDateFrom && invDate < filterDateFrom) matchesDate = false
      if (filterDateTo && invDate > filterDateTo) matchesDate = false
      
      return matchesSearch && matchesStatus && matchesPaymentMethod && matchesDate
    })

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date_desc': return new Date(b.invoice_date || b.created_at).getTime() - new Date(a.invoice_date || a.created_at).getTime()
        case 'date_asc': return new Date(a.invoice_date || a.created_at).getTime() - new Date(b.invoice_date || b.created_at).getTime()
        case 'amount_desc': return (b.total_amount || 0) - (a.total_amount || 0)
        case 'amount_asc': return (a.total_amount || 0) - (b.total_amount || 0)
        case 'remaining_desc': return (b.remaining_amount || 0) - (a.remaining_amount || 0)
        case 'remaining_asc': return (a.remaining_amount || 0) - (b.remaining_amount || 0)
        default: return 0
      }
    })

    return result
  }, [invoices, searchTerm, filterStatus, filterPaymentMethod, filterDateFrom, filterDateTo, sortBy])

  const getStatusBadge = (remaining: number, paidAmount: number) => {
    if (remaining === 0) {
      return (
        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1">
          <CheckCircle size={14} />
          مدفوعة بالكامل
        </span>
      )
    } else if (paidAmount > 0 && remaining > 0) {
      return (
        <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1">
          <Clock size={14} />
          مدفوع جزئياً
        </span>
      )
    } else {
      return (
        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1">
          <AlertCircle size={14} />
          غير مدفوع
        </span>
      )
    }
  }

  const handlePayment = async () => {
    if (!selectedInvoice || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      alert('يرجى إدخال مبلغ صحيح')
      return
    }

    const amount = parseFloat(paymentAmount)
    if (amount > (selectedInvoice.remaining_amount || 0)) {
      alert('المبلغ يتجاوز الباقي المستحق')
      return
    }
    try {
      if (!selectedInvoice || !paymentAmount || parseFloat(paymentAmount) <= 0) {
        alert('يرجى إدخال مبلغ صحيح')
        return
      }

      // Validation spécifique pour le chèque
      if (paymentMethod === 'check') {
        if (!checkNumber.trim()) {
          alert('يرجى إدخال رقم الشيك')
          return
        }
        if (!checkBank) {
          alert('يرجى اختيار البنك')
          return
        }
        if (!checkDepositDate) {
          alert('يرجى تحديد تاريخ الإيداع')
          return
        }
      }

      // Validation spécifique pour le virement bancaire
      if (paymentMethod === 'bank_transfer') {
        if (!transferBank) {
          alert('يرجى اختيار البنك')
          return
        }
        if (!transferReference.trim()) {
          alert('يرجى إدخال رقم المرجع')
          return
        }
        if (!transferDate) {
          alert('يرجى تحديد تاريخ التحويل')
          return
        }
      }

      const amount = parseFloat(paymentAmount)
      const currentPaid = selectedInvoice.paid_amount || 0
      const newPaidAmount = currentPaid + amount
      const totalAmount = selectedInvoice.total_amount || 0
      const newStatus = newPaidAmount >= totalAmount ? 'paid' : 'partial'

      // Use payment method as-is (already normalized)
      const normalizedPaymentMethod = paymentMethod

      // 1. Mettre à jour la facture
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          paid_amount: newPaidAmount
        })
        .eq('id', selectedInvoice.id)

      if (updateError) throw updateError

      // 2. Enregistrer le paiement avec les informations du chèque si applicable
      const paymentData: any = {
        invoice_id: selectedInvoice.id,
        order_id: selectedInvoice.order_id || null,
        payment_number: `PAY-${Date.now()}`,
        client_id: selectedInvoice.client_id,
        amount: amount,
        payment_method: normalizedPaymentMethod,
        payment_date: new Date().toISOString().split('T')[0],
        status: 'completed'
      }

      // Ajouter les informations du chèque si la méthode est chèque
      if (paymentMethod === 'check') {
        paymentData.check_number = checkNumber
        paymentData.check_bank = checkBank
        paymentData.check_deposit_date = checkDepositDate
      }

      // Ajouter les informations du virement bancaire si la méthode est virement
      if (paymentMethod === 'bank_transfer') {
        paymentData.transfer_bank = transferBank
        paymentData.transfer_reference = transferReference
        paymentData.transfer_date = transferDate
      }

      const { error: paymentError } = await supabase
        .from('payments')
        .insert(paymentData)

      if (paymentError) {
        console.warn('Could not save payment details:', paymentError)
      }

      // 2.b Update related order payment fields so OrdersPage reflects the payment
      try {
        const orderPaymentStatus = newPaidAmount >= totalAmount ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'pending')
        const orderId = selectedInvoice.order_id

        if (orderId) {
          await supabase
            .from('orders')
            .update({
              payment_status: orderPaymentStatus,
              payment_method: normalizedPaymentMethod
            })
            .eq('id', orderId)
        } else if (selectedInvoice.order_number) {
          const { data: orderByNumber } = await supabase
            .from('orders')
            .select('id')
            .eq('order_number', selectedInvoice.order_number)
            .maybeSingle()

          if (orderByNumber?.id) {
            await supabase
              .from('orders')
              .update({
                payment_status: orderPaymentStatus,
                payment_method: normalizedPaymentMethod
              })
              .eq('id', orderByNumber.id)
          }
        }
      } catch (e) {
        console.warn('Could not update order payment status from invoice payment:', e)
      }

      // 3. Recharger les données
      await loadInvoices()
      setShowPaymentModal(false)
      setSelectedInvoice(null)
      setPaymentAmount('')
      setPaymentMethod('cash')
      
      // Réinitialiser les champs du chèque
      setCheckNumber('')
      setCheckBank('')
      setCheckDepositDate('')
      
      // Réinitialiser les champs du virement bancaire
      setTransferBank('')
      setTransferReference('')
      setTransferDate('')

      alert('✅ تم تسجيل الدفعة بنجاح')
      
      // Notifier le dashboard
      window.dispatchEvent(new CustomEvent('payment-updated', { detail: { invoiceId: selectedInvoice.id } }))
    } catch (error) {
      console.error('Error processing payment:', error)
      alert('❌ حدث خطأ')
    }
  }

  const totalUnpaid = invoices.reduce((sum, inv) => sum + (inv.remaining_amount || 0), 0)
  const unpaidCount = invoices.filter(inv => (inv.remaining_amount || 0) > 0).length
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0)

  const getPaymentTypeDisplay = (paymentMethod: string | null | undefined) => {
    if (!paymentMethod) return '-'
    
    switch (paymentMethod) {
      case 'cash':
        return (
          <span className="flex items-center gap-1 text-green-700 font-semibold">
            <DollarSign size={16} />
            نقدي
          </span>
        )
      case 'check':
        return (
          <span className="flex items-center gap-1 text-blue-700 font-semibold">
            <FileText size={16} />
            شيك
          </span>
        )
      case 'card':
        return (
          <span className="flex items-center gap-1 text-purple-700 font-semibold">
            <CreditCard size={16} />
            بطاقة
          </span>
        )
      case 'bank_transfer':
        return (
          <span className="flex items-center gap-1 text-indigo-700 font-semibold">
            <FileText size={16} />
            تحويل بنكي
          </span>
        )
      case 'credit':
        return (
          <span className="flex items-center gap-1 text-orange-700 font-semibold">
            <Clock size={16} />
            دين
          </span>
        )
      case 'mobile_payment':
        return (
          <span className="flex items-center gap-1 text-teal-700 font-semibold">
            <DollarSign size={16} />
            دفع محمول
          </span>
        )
      default:
        return paymentMethod
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <CreditCard className="text-white" size={36} />
          المدفوعات
        </h1>
        <button
          onClick={() => window.location.href = '/pos'}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
        >
          <Plus size={20} />
          بيع جديد
        </button>
      </div>

      {/* شريط الإحصائيات المختصر */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-green-600" />
            <span className="text-gray-600">المدفوع:</span>
            <span className="font-bold text-green-700">{totalPaid.toFixed(0)} MAD</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-red-600" />
            <span className="text-gray-600">الديون:</span>
            <span className="font-bold text-red-700">{totalUnpaid.toFixed(0)} MAD</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-yellow-600" />
            <span className="text-gray-600">غير مدفوعة:</span>
            <span className="font-bold text-yellow-700">{unpaidCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-blue-600" />
            <span className="text-gray-600">الفواتير:</span>
            <span className="font-bold text-blue-700">{filteredInvoices.length}</span>
          </div>
        </div>
      </div>

      {/* البحث والفلاتر */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* بحث */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-3 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="ابحث عن فاتورة أو عميل..."
              className="w-full pr-10 pl-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* حالة الدفع */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none text-sm"
          >
            <option value="has_debt">عليها دين</option>
            <option value="unpaid">غير مدفوع</option>
            <option value="partial">مدفوع جزئياً</option>
            <option value="paid">مدفوع بالكامل</option>
            <option value="all">كل الحالات</option>
          </select>

          {/* طريقة الدفع */}
          <select
            value={filterPaymentMethod}
            onChange={(e) => setFilterPaymentMethod(e.target.value)}
            className="px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none text-sm"
          >
            <option value="all">كل طرق الدفع</option>
            <option value="cash">نقدي</option>
            <option value="card">بطاقة</option>
            <option value="bank_transfer">تحويل بنكي</option>
            <option value="check">شيك</option>
            <option value="credit">دين</option>
          </select>

          {/* ترتيب */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none text-sm"
          >
            <option value="date_desc">الأحدث أولاً</option>
            <option value="date_asc">الأقدم أولاً</option>
            <option value="amount_desc">المبلغ ↓</option>
            <option value="amount_asc">المبلغ ↑</option>
            <option value="remaining_desc">الباقي ↓</option>
            <option value="remaining_asc">الباقي ↑</option>
          </select>

          {/* زر فلاتر التاريخ */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2.5 border-2 rounded-lg text-sm flex items-center gap-1 ${showFilters ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <Calendar size={16} />
            تاريخ
          </button>

          {/* عداد النتائج */}
          <span className="text-xs text-gray-500">
            {filteredInvoices.length} / {invoices.length}
          </span>
        </div>

        {/* فلاتر التاريخ */}
        {showFilters && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">من:</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">إلى:</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm"
              />
            </div>
            <button
              onClick={() => { setFilterDateFrom(''); setFilterDateTo('') }}
              className="text-xs text-red-600 hover:text-red-800"
            >
              مسح التاريخ
            </button>
          </div>
        )}
      </div>

      {/* Tableau des factures */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            جاري التحميل...
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            لا توجد فواتير
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-green-600 to-green-700 text-white">
                <tr>
                  <th className="px-6 py-4 text-right font-bold">رقم الفاتورة</th>
                  <th className="px-6 py-4 text-right font-bold">العميل</th>
                  <th className="px-6 py-4 text-right font-bold">التاريخ</th>
                  <th className="px-6 py-4 text-right font-bold">المجموع</th>
                  <th className="px-6 py-4 text-right font-bold">المدفوع</th>
                  <th className="px-6 py-4 text-right font-bold">الباقي</th>
                  <th className="px-6 py-4 text-right font-bold">نوع الدفع</th>
                  <th className="px-6 py-4 text-right font-bold">الحالة</th>
                  <th className="px-6 py-4 text-right font-bold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b hover:bg-green-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-800">
                        #{invoice.invoice_number || invoice.id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-700">
                        {invoice.client_name || invoice.company_name_ar || 'عميل عام'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
                      {new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString('ar-MA')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-800">
                        {(invoice.total_amount || 0).toFixed(2)} MAD
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-green-600">
                        {(invoice.paid_amount || 0).toFixed(2)} MAD
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-bold text-lg ${
                        (invoice.remaining_amount || 0) > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {(invoice.remaining_amount || 0).toFixed(2)} MAD
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getPaymentTypeDisplay(invoice.payment_method)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(invoice.remaining_amount || 0, invoice.paid_amount || 0)}
                    </td>
                    <td className="px-6 py-4">
                      {(invoice.remaining_amount || 0) > 0 && (
                        <button
                          onClick={() => {
                            setSelectedInvoice(invoice)
                            setPaymentAmount((invoice.remaining_amount || 0).toString())
                            setShowPaymentModal(true)
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold transition-colors"
                        >
                          تسديد
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal تسديد الدفعة */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white rounded-xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">تسديد دفعة</h3>
            
            <div className="mb-4">
              <p className="text-gray-600">فاتورة: {selectedInvoice.invoice_number}</p>
              <p className="text-gray-600">العميل: {selectedInvoice.client_name || selectedInvoice.company_name_ar || 'عميل عام'}</p>
              <p className="text-sm text-gray-500">الباقي المستحق: {(selectedInvoice.remaining_amount || 0).toFixed(2)} MAD</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">المبلغ</label>
                <button
                  type="button"
                  onClick={() =>
                    inputPad.open({
                      title: 'المبلغ',
                      mode: 'decimal',
                      dir: 'ltr',
                      initialValue: paymentAmount || '0',
                      min: 0.01,
                      max: selectedInvoice.remaining_amount || 0,
                      onConfirm: (v) => setPaymentAmount(v),
                    })
                  }
                  className="w-full p-3 border-2 border-gray-200 rounded-lg text-left"
                >
                  {paymentAmount || '0'}
                </button>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">طريقة الدفع</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                >
                  <option value="cash">نقدي</option>
                  <option value="card">بطاقة</option>
                  <option value="bank_transfer">تحويل بنكي</option>
                  <option value="check">شيك</option>
                </select>
              </div>

              {/* Champs supplémentaires pour le chèque */}
              {paymentMethod === 'check' && (
                <div className="space-y-3 border-t pt-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">رقم الشيك</label>
                    <input
                      type="text"
                      value={checkNumber}
                      onChange={(e) => setCheckNumber(e.target.value)}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg"
                      placeholder="أدخل رقم الشيك"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">البنك</label>
                    <select
                      value={checkBank}
                      onChange={(e) => setCheckBank(e.target.value)}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg"
                      required
                    >
                      <option value="">اختر البنك</option>
                      {banks.map((bank) => (
                        <option key={bank} value={bank}>
                          {bank}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الإيداع</label>
                    <input
                      type="date"
                      value={checkDepositDate}
                      onChange={(e) => setCheckDepositDate(e.target.value)}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Champs supplémentaires pour le virement bancaire */}
              {paymentMethod === 'bank_transfer' && (
                <div className="space-y-3 border-t pt-3">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">البنك</label>
                    <select
                      value={transferBank}
                      onChange={(e) => setTransferBank(e.target.value)}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg"
                      required
                    >
                      <option value="">اختر البنك</option>
                      {banks.map((bank) => (
                        <option key={bank} value={bank}>
                          {bank}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">رقم المرجع</label>
                    <input
                      type="text"
                      value={transferReference}
                      onChange={(e) => setTransferReference(e.target.value)}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg"
                      placeholder="أدخل رقم المرجع للتحويل"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ التحويل</label>
                    <input
                      type="date"
                      value={transferDate}
                      onChange={(e) => setTransferDate(e.target.value)}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg"
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handlePayment}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold"
              >
                تسديد الدفعة
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      {inputPad.Modal}
    </div>
  )
}
