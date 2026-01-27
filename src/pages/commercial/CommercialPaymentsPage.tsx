import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, DollarSign, CheckCircle } from 'lucide-react'

interface Client {
  id: string
  company_name_ar: string
  contact_person_name: string
  credit_limit?: number
}

interface Invoice {
  id: string
  invoice_number: string
  client_id: string
  total_amount: number
  amount_paid: number
  amount_due: number
  status: string
  clients?: Client
}

export default function CommercialPaymentsPage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'cash' as 'cash' | 'transfer' | 'check' | 'card' | 'other',
    payment_date: new Date().toISOString().split('T')[0],
    notes: ''
  })

  useEffect(() => {
    const commercialId = localStorage.getItem('commercial_id')
    if (!commercialId) {
      navigate('/commercial/login')
      return
    }

    loadClients(commercialId)
  }, [navigate])

  const loadClients = async (commercialId: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('created_by', commercialId)
        .order('company_name_ar')

      if (error) throw error
      console.log('Clients loaded for payments:', data?.length, 'clients')
      setClients(data || [])
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadClientInvoices = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          clients (
            company_name_ar,
            contact_person_name,
            credit_limit
          )
        `)
        .eq('client_id', clientId)
        .neq('status', 'paid')
        .order('created_at', { ascending: false })

      if (error) throw error
      setInvoices(data || [])
    } catch (error) {
      console.error('Error loading invoices:', error)
    }
  }

  const handleSelectClient = async (client: Client) => {
    setSelectedClient(client)
    await loadClientInvoices(client.id)
  }

  const handlePaymentSubmit = async () => {
    if (!selectedInvoice || !paymentForm.amount) {
      alert('الرجاء إدخال المبلغ')
      return
    }

    const amount = parseFloat(paymentForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('الرجاء إدخال مبلغ صحيح')
      return
    }

    if (amount > selectedInvoice.amount_due) {
      alert('⚠️ المبلغ المدخل أكبر من المبلغ المستحق')
      return
    }

    const commercialId = localStorage.getItem('commercial_id')
    if (!commercialId) return

    try {
      // Générer un numéro de paiement
      const { data: lastPayment } = await supabase
        .from('payments')
        .select('payment_number')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      let paymentNumber = 'PAY-0001'
      if (lastPayment?.payment_number) {
        const lastNum = parseInt(lastPayment.payment_number.split('-')[1])
        paymentNumber = `PAY-${String(lastNum + 1).padStart(4, '0')}`
      }

      // Créer le paiement
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          payment_number: paymentNumber,
          invoice_id: selectedInvoice.id,
          client_id: selectedInvoice.client_id,
          amount: amount,
          payment_method: paymentForm.payment_method,
          payment_date: paymentForm.payment_date,
          notes: paymentForm.notes || null,
          collected_by: commercialId,
          payment_source: 'commercial'
        })

      if (paymentError) throw paymentError

      // Mettre à jour la facture
      const newAmountPaid = selectedInvoice.amount_paid + amount
      const newAmountDue = selectedInvoice.total_amount - newAmountPaid
      const newStatus = newAmountDue <= 0 ? 'paid' : 'partial'

      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          amount_due: newAmountDue,
          status: newStatus
        })
        .eq('id', selectedInvoice.id)

      if (invoiceError) throw invoiceError

      alert('✅ تم تسجيل الدفع بنجاح')
      setShowPaymentModal(false)
      setPaymentForm({
        amount: '',
        payment_method: 'cash',
        payment_date: new Date().toISOString().split('T')[0],
        notes: ''
      })
      
      if (selectedClient) {
        await loadClientInvoices(selectedClient.id)
      }
    } catch (error) {
      console.error('Error saving payment:', error)
      alert('❌ حدث خطأ أثناء تسجيل الدفع')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/commercial/dashboard')}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">تحصيل المدفوعات</h1>
            <p className="text-green-100 text-sm">
              {selectedClient ? selectedClient.company_name_ar : 'اختر العميل'}
            </p>
          </div>
        </div>
      </div>

      {/* Client Selection */}
      {!selectedClient ? (
        <div className="p-4 space-y-3">
          <h2 className="font-bold text-gray-800 mb-3">اختر العميل</h2>
          {loading ? (
            <div className="text-center py-12 text-gray-500">جاري التحميل...</div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12 text-gray-500">لا يوجد عملاء</div>
          ) : (
            clients.map((client) => (
              <button
                key={client.id}
                onClick={() => handleSelectClient(client)}
                className="w-full bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-shadow text-right"
              >
                <h3 className="font-bold text-gray-800 text-lg">{client.company_name_ar}</h3>
                <p className="text-sm text-gray-600">{client.contact_person_name}</p>
                {client.credit_limit && (
                  <p className="text-xs text-blue-600 mt-1">
                    سقف الدين: {client.credit_limit.toFixed(2)} MAD
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {/* Back to clients */}
          <button
            onClick={() => {
              setSelectedClient(null)
              setInvoices([])
            }}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            ← العودة لقائمة العملاء
          </button>

          {/* Unpaid Invoices */}
          <h2 className="font-bold text-gray-800 mb-3">الفواتير غير المدفوعة</h2>
          
          {invoices.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
              <CheckCircle className="mx-auto text-green-600 mb-3" size={48} />
              <p className="text-green-700 font-medium">لا توجد فواتير معلقة</p>
              <p className="text-green-600 text-sm mt-1">جميع الفواتير مدفوعة</p>
            </div>
          ) : (
            invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-800">#{invoice.invoice_number}</h3>
                    <p className="text-sm text-gray-600">
                      المبلغ الإجمالي: {invoice.total_amount.toFixed(2)} MAD
                    </p>
                    <p className="text-sm text-gray-600">
                      المدفوع: {invoice.amount_paid.toFixed(2)} MAD
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-gray-500 mb-1">المتبقي</p>
                    <p className="text-2xl font-bold text-red-600">
                      {invoice.amount_due.toFixed(2)} MAD
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedInvoice(invoice)
                    setPaymentForm(prev => ({ ...prev, amount: invoice.amount_due.toString() }))
                    setShowPaymentModal(true)
                  }}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <DollarSign size={20} />
                  تسجيل دفع
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 rounded-t-xl">
              <h2 className="text-xl font-bold">تسجيل دفع</h2>
              <p className="text-green-100 text-sm">#{selectedInvoice.invoice_number}</p>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">المبلغ المستحق</p>
                <p className="text-2xl font-bold text-red-600">
                  {selectedInvoice.amount_due.toFixed(2)} MAD
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">المبلغ المدفوع *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">طريقة الدفع *</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value as any })}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none"
                >
                  <option value="cash">نقدي</option>
                  <option value="transfer">تحويل بنكي</option>
                  <option value="check">شيك</option>
                  <option value="card">بطاقة</option>
                  <option value="other">أخرى</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">تاريخ الدفع *</label>
                <input
                  type="date"
                  required
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">ملاحظات</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none"
                  rows={3}
                  placeholder="ملاحظات اختيارية..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300"
                >
                  إلغاء
                </button>
                <button
                  onClick={handlePaymentSubmit}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700"
                >
                  تأكيد الدفع
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
