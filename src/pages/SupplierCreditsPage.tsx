import { useEffect, useState, useMemo } from 'react'
import { Search, CreditCard, DollarSign, AlertCircle, CheckCircle, Clock, Plus, Eye, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Supplier {
  id: string
  name_ar: string
  name_en?: string
  contact_person_name?: string
  contact_person_email?: string
  contact_person_phone?: string
  is_active: boolean
}

interface Purchase {
  id: string
  purchase_number: string
  supplier_id: string
  total_amount: number
  payment_type: 'cash' | 'credit' | 'transfer' | 'check'
  status: 'pending' | 'received' | 'cancelled'
  purchase_date: string
  bank_name?: string
  check_number?: string
  check_date?: string
  check_deposit_date?: string
  payment_status?: 'pending' | 'paid' | 'partial'
  paid_amount?: number
  remaining_amount?: number
}

interface SupplierPayment {
  id: string
  supplier_id: string
  amount: number
  payment_date: string
  payment_method: 'cash' | 'transfer' | 'check' | 'card' | 'other'
  notes?: string
  created_at: string
}

interface SupplierCredit {
  supplier: Supplier
  totalPurchases: number
  totalPaid: number
  remainingAmount: number
  status: 'debt' | 'partial' | 'paid' | 'no-debt'
  purchaseCount: number
  lastPaymentDate?: string
}

export default function SupplierCreditsPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [payments, setPayments] = useState<SupplierPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showChequePaymentModal, setShowChequePaymentModal] = useState(false)
  const [selectedChequePurchase, setSelectedChequePurchase] = useState<Purchase | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash' as const,
    notes: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load suppliers
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('*')
        .order('name_ar')

      // Load purchases
      const { data: purchasesData } = await supabase
        .from('purchases')
        .select('*')
        .eq('status', 'received')
        .order('purchase_date', { ascending: false })

      // Load payments
      const { data: paymentsData } = await supabase
        .from('supplier_payments')
        .select('*')
        .order('payment_date', { ascending: false })

      setSuppliers(suppliersData || [])
      setPurchases(purchasesData || [])
      setPayments(paymentsData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const supplierCredits = useMemo(() => {
    return suppliers.map(supplier => {
      const supplierPurchases = purchases.filter(p => p.supplier_id === supplier.id)
      const supplierPayments = payments.filter(p => p.supplier_id === supplier.id)
      
      const totalPurchases = supplierPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0)
      const totalPaid = supplierPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
      const remainingAmount = totalPurchases - totalPaid
      
      let status: 'debt' | 'partial' | 'paid' | 'no-debt' = 'no-debt'
      if (totalPurchases > 0) {
        if (totalPaid === 0) {
          status = 'debt'
        } else if (totalPaid < totalPurchases) {
          status = 'partial'
        } else if (totalPaid >= totalPurchases) {
          status = 'paid'
        }
      }

      const lastPayment = supplierPayments.sort((a, b) => 
        new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
      )[0]

      return {
        supplier,
        totalPurchases,
        totalPaid,
        remainingAmount,
        status,
        purchaseCount: supplierPurchases.length,
        lastPaymentDate: lastPayment?.payment_date
      }
    }).filter(credit => credit.totalPurchases > 0 || credit.totalPaid > 0)
  }, [suppliers, purchases, payments])

  const filteredCredits = useMemo(() => {
    if (!searchTerm) return supplierCredits
    
    return supplierCredits.filter(credit =>
      credit.supplier.name_ar.toLowerCase().includes(searchTerm.toLowerCase()) ||
      credit.supplier.name_en?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [supplierCredits, searchTerm])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'debt':
        return (
          <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1">
            <AlertCircle size={14} />
            دين
          </span>
        )
      case 'partial':
        return (
          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1">
            <Clock size={14} />
            دين جزئي
          </span>
        )
      case 'paid':
        return (
          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1">
            <CheckCircle size={14} />
            مسدد
          </span>
        )
      default:
        return (
          <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full font-bold text-sm">
            لا يوجد دين
          </span>
        )
    }
  }

  const handlePayment = async () => {
    if (!selectedSupplier || !paymentForm.amount) {
      alert('يرجى إدخال مبلغ الدفع')
      return
    }

    try {
      const { error } = await supabase
        .from('supplier_payments')
        .insert({
          supplier_id: selectedSupplier.id,
          amount: parseFloat(paymentForm.amount),
          payment_date: paymentForm.payment_date,
          payment_method: paymentForm.payment_method,
          notes: paymentForm.notes
        })

      if (error) throw error

      setShowPaymentModal(false)
      setSelectedSupplier(null)
      setPaymentForm({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        notes: ''
      })
      
      await loadData()
      alert('✅ تم تسجيل الدفع بنجاح')
    } catch (error) {
      console.error('Error recording payment:', error)
      alert('❌ حدث خطأ أثناء تسجيل الدفع')
    }
  }

  const updateChequeStatus = async (purchaseId: string, status: 'paid' | 'partial' | 'unpaid', paidAmount?: number) => {
    try {
      const purchase = purchases.find(p => p.id === purchaseId)
      if (!purchase) return

      const totalAmount = purchase.total_amount || 0
      const actualPaidAmount = paidAmount || 0
      const remainingAmount = Math.max(0, totalAmount - actualPaidAmount)

      // Mettre à jour l'achat avec seulement les colonnes existantes
      const { error: updateError } = await supabase
        .from('purchases')
        .update({
          paid_amount: actualPaidAmount,
          remaining_amount: remainingAmount
        })
        .eq('id', purchaseId)

      if (updateError) {
        console.error('Error updating purchase status:', updateError)
        alert('حدث خطأ أثناء تحديث الحالة')
        return
      }

      // Si paiement > 0, créer un enregistrement supplier_payments
      if (actualPaidAmount > 0) {
        const { error: paymentErr } = await supabase
          .from('supplier_payments')
          .insert({
            supplier_id: purchase.supplier_id,
            amount: actualPaidAmount,
            payment_date: new Date().toISOString().split('T')[0],
            payment_method: 'check',
            notes: `Purchase ${purchase.purchase_number} - Cheque payment`
          })

        if (paymentErr) throw paymentErr
      }

      // Mettre à jour l'état local
      setPurchases(prev => 
        prev.map(p => 
          p.id === purchaseId 
            ? { 
                ...p, 
                payment_status: status === 'unpaid' ? 'pending' : status, 
                paid_amount: actualPaidAmount, 
                remaining_amount: remainingAmount 
              }
            : p
        )
      )

      setShowChequePaymentModal(false)
      await loadData()
      alert('تم تحديث حالة الشيك بنجاح')
    } catch (error) {
      console.error('Error updating cheque status:', error)
      alert('حدث خطأ أثناء تحديث الحالة')
    }
  }

  const stats = useMemo(() => {
    const totalDebt = filteredCredits.reduce((sum, credit) => 
      credit.status === 'debt' || credit.status === 'partial' ? sum + credit.remainingAmount : sum, 0
    )
    const totalPaid = filteredCredits.reduce((sum, credit) => sum + credit.totalPaid, 0)
    const debtSuppliers = filteredCredits.filter(credit => 
      credit.status === 'debt' || credit.status === 'partial'
    ).length
    const paidSuppliers = filteredCredits.filter(credit => credit.status === 'paid').length

    return { totalDebt, totalPaid, debtSuppliers, paidSuppliers }
  }, [filteredCredits])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <CreditCard className="text-white" size={36} />
            أرصدة الموردين
          </h1>
          <p className="text-white mt-2">متابعة دفعات الموردين والديون المستحقة</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">إجمالي الدين المستحق</p>
              <p className="text-2xl font-bold">{stats.totalDebt.toFixed(2)} MAD</p>
            </div>
            <DollarSign className="w-8 h-8 text-red-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">إجمالي المدفوع</p>
              <p className="text-2xl font-bold">{stats.totalPaid.toFixed(2)} MAD</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm">الموردين المدينين</p>
              <p className="text-2xl font-bold">{stats.debtSuppliers}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-yellow-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">الموردين المسددين</p>
              <p className="text-2xl font-bold">{stats.paidSuppliers}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-blue-200" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="relative">
          <Search className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="البحث عن مورد..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Credits Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">المورد</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجمالي المشتريات</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">المدفوع</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">المتبقي</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">آخر دفع</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredCredits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    لا توجد أرصدة للموردين
                  </td>
                </tr>
              ) : (
                filteredCredits.map((credit) => (
                  <tr key={credit.supplier.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium">{credit.supplier.name_ar}</p>
                        <p className="text-sm text-gray-500">{credit.purchaseCount} مشتريات</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-bold text-blue-600">
                        {credit.totalPurchases.toFixed(2)} MAD
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-bold text-green-600">
                        {credit.totalPaid.toFixed(2)} MAD
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`font-bold ${
                        credit.remainingAmount > 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {credit.remainingAmount.toFixed(2)} MAD
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {getStatusBadge(credit.status)}
                    </td>
                    <td className="px-4 py-4 text-gray-600">
                      {credit.lastPaymentDate 
                        ? new Date(credit.lastPaymentDate).toLocaleDateString('ar-DZ')
                        : 'لا يوجد'
                      }
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedSupplier(credit.supplier)
                            setShowDetailsModal(true)
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(credit.status === 'debt' || credit.status === 'partial') && (
                          <button
                            onClick={() => {
                              setSelectedSupplier(credit.supplier)
                              setShowPaymentModal(true)
                            }}
                            className="text-green-600 hover:text-green-800"
                            title="تسجيل دفع"
                          >
                            <DollarSign className="w-4 h-4" />
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

      {/* Section: المشتريات المدفوعة بشيك */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <FileText size={24} />
          المشتريات المدفوعة بشيك
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(() => {
            const chequePurchases = purchases.filter(p => p.payment_type === 'check' && p.status === 'received')
            const totalChequeAmount = chequePurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0)
            const paidChequeAmount = chequePurchases.reduce((sum, p) => sum + (p.paid_amount || 0), 0)
            const remainingChequeAmount = totalChequeAmount - paidChequeAmount

            return (
              <>
                <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                  <p className="text-orange-100 text-sm mb-1">إجمالي المشتريات بشيك</p>
                  <p className="text-2xl font-bold">{totalChequeAmount.toFixed(2)} MAD</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                  <p className="text-orange-100 text-sm mb-1">المتبقي للشيكات</p>
                  <p className="text-2xl font-bold">{remainingChequeAmount.toFixed(2)} MAD</p>
                </div>
              </>
            )
          })()}
        </div>
      </div>

      {/* Tableau des achats payés par chèque */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white px-6 py-4">
          <h3 className="text-lg font-bold">تفاصيل المشتريات المدفوعة بشيك</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">رقم الشراء</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">المورد</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">المبلغ</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">نوع الدفع</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">حالة الشيك</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(() => {
                const chequePurchases = purchases.filter(p => p.payment_type === 'check' && p.status === 'received')
                if (chequePurchases.length === 0) {
                  return (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        لا توجد مشتريات مدفوعة بشيك
                      </td>
                    </tr>
                  )
                }
                return chequePurchases.map((purchase) => {
                  const supplier = suppliers.find(s => s.id === purchase.supplier_id)
                  return (
                    <tr key={purchase.id} className="hover:bg-orange-50">
                      <td className="px-4 py-3">
                        <span className="font-bold text-gray-800">{purchase.purchase_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-700">{supplier?.name_ar || 'غير محدد'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-orange-600">
                          {(purchase.total_amount || 0).toFixed(2)} MAD
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <div className="flex items-center gap-1 text-orange-700 font-semibold mb-1">
                            <FileText size={12} />
                            شيك
                          </div>
                          {purchase.bank_name && (
                            <p className="text-gray-600 text-xs">البنك: {purchase.bank_name}</p>
                          )}
                          {purchase.check_number && (
                            <p className="text-gray-600 text-xs">رقم: {purchase.check_number}</p>
                          )}
                          {purchase.check_date && (
                            <p className="text-gray-600 text-xs">تاريخ الشيك: {new Date(purchase.check_date).toLocaleDateString('ar-DZ')}</p>
                          )}
                          {purchase.check_deposit_date && (
                            <p className="text-gray-600 text-xs">تاريخ الإيداع: {new Date(purchase.check_deposit_date).toLocaleDateString('ar-DZ')}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            (purchase.paid_amount || 0) >= (purchase.total_amount || 0)
                              ? 'bg-green-100 text-green-700' 
                              : (purchase.paid_amount || 0) > 0
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {(purchase.paid_amount || 0) >= (purchase.total_amount || 0) ? 'مدفوع' : 
                             (purchase.paid_amount || 0) > 0 ? 'مدفوع جزئياً' : 'غير مدفوع'}
                          </span>
                          {(purchase.paid_amount || 0) > 0 && (purchase.paid_amount || 0) < (purchase.total_amount || 0) && (
                            <span className="text-xs text-gray-600">
                              المتبقي: {((purchase.total_amount || 0) - (purchase.paid_amount || 0)).toFixed(2)} MAD
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setSelectedChequePurchase(purchase)
                              setShowChequePaymentModal(true)
                            }}
                            className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-xs font-bold transition-colors"
                          >
                            تحديث الحالة
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">تسجيل دفع للمورد</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600">المورد: <span className="font-bold">{selectedSupplier.name_ar}</span></p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">المبلغ *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">تاريخ الدفع *</label>
                <input
                  type="date"
                  required
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({...paymentForm, payment_date: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">طريقة الدفع *</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({...paymentForm, payment_method: e.target.value as any})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="cash">نقدي</option>
                  <option value="transfer">تحويل بنكي</option>
                  <option value="check">شيك</option>
                  <option value="card">بطاقة</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ملاحظات</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows={3}
                  placeholder="ملاحظات اختيارية..."
                />
              </div>
            </div>
            <div className="flex gap-4 justify-end mt-6">
              <button
                onClick={() => {
                  setShowPaymentModal(false)
                  setSelectedSupplier(null)
                  setPaymentForm({
                    amount: '',
                    payment_date: new Date().toISOString().split('T')[0],
                    payment_method: 'cash',
                    notes: ''
                  })
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={handlePayment}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                تسجيل الدفع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cheque Payment Status Update Modal */}
      {showChequePaymentModal && selectedChequePurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">تحديث حالة الشيك</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600">رقم الشراء: <span className="font-bold">{selectedChequePurchase.purchase_number}</span></p>
              <p className="text-sm text-gray-600">المبلغ: <span className="font-bold">{selectedChequePurchase.total_amount} MAD</span></p>
              {selectedChequePurchase.check_number && (
                <p className="text-sm text-gray-600">رقم الشيك: <span className="font-bold">{selectedChequePurchase.check_number}</span></p>
              )}
              {selectedChequePurchase.check_date && (
                <p className="text-sm text-gray-600">تاريخ الشيك: <span className="font-bold">{new Date(selectedChequePurchase.check_date).toLocaleDateString('ar-DZ')}</span></p>
              )}
              {selectedChequePurchase.check_deposit_date && (
                <p className="text-sm text-gray-600">تاريخ الإيداع: <span className="font-bold">{new Date(selectedChequePurchase.check_deposit_date).toLocaleDateString('ar-DZ')}</span></p>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">حالة الشيك *</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  defaultValue={(selectedChequePurchase.paid_amount || 0) >= (selectedChequePurchase.total_amount || 0) ? 'paid' : (selectedChequePurchase.paid_amount || 0) > 0 ? 'partial' : 'unpaid'}
                >
                  <option value="unpaid">غير مدفوع</option>
                  <option value="partial">مدفوع جزئياً</option>
                  <option value="paid">مدفوع بالكامل</option>
                </select>
              </div>
              <div id="partial-payment-fields" style={{ display: ((selectedChequePurchase.paid_amount || 0) >= (selectedChequePurchase.total_amount || 0) || (selectedChequePurchase.paid_amount || 0) > 0) ? 'block' : 'none' }}>
                <label className="block text-sm font-medium mb-1">المبلغ المدفوع *</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="0.00"
                  defaultValue={selectedChequePurchase.paid_amount || 0}
                  min="0"
                  max={selectedChequePurchase.total_amount || 0}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">تاريخ الإيداع</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  defaultValue={selectedChequePurchase.check_deposit_date || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            <div className="flex gap-4 justify-end mt-6">
              <button
                onClick={() => {
                  setShowChequePaymentModal(false)
                  setSelectedChequePurchase(null)
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  const statusSelect = document.querySelector('select') as HTMLSelectElement
                  const paidAmountInput = document.querySelector('input[type="number"]') as HTMLInputElement
                  const depositDateInput = document.querySelectorAll('input[type="date"]')[1] as HTMLInputElement
                  const status = statusSelect?.value as 'paid' | 'partial' | 'unpaid'
                  const paidAmount = status === 'unpaid' ? 0 : parseFloat(paidAmountInput?.value || '0')
                  const depositDate = depositDateInput?.value
                  
                  if (!['paid', 'partial', 'unpaid'].includes(status)) {
                    alert('يرجى اختيار حالة الشيك')
                    return
                  }
                  if (status !== 'unpaid' && (!paidAmount || paidAmount <= 0)) {
                    alert('يرجى إدخال المبلغ المدفوع')
                    return
                  }
                  
                  updateChequeStatus(selectedChequePurchase.id, status, paidAmount)
                }}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
              >
                تحديث الحالة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">تفاصيل ديون المورد</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">معلومات المورد</h3>
                <p><span className="text-gray-500">الاسم:</span> {selectedSupplier.name_ar}</p>
                <p><span className="text-gray-500">شخص الاتصال:</span> {selectedSupplier.contact_person_name}</p>
                <p><span className="text-gray-500">الهاتف:</span> {selectedSupplier.contact_person_phone}</p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">ملخص المديونية</h3>
                {(() => {
                  const credit = supplierCredits.find(c => c.supplier.id === selectedSupplier.id)
                  return credit ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-3 rounded">
                        <p className="text-sm text-gray-600">إجمالي المشتريات</p>
                        <p className="font-bold text-blue-600">{credit.totalPurchases.toFixed(2)} MAD</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded">
                        <p className="text-sm text-gray-600">المدفوع</p>
                        <p className="font-bold text-green-600">{credit.totalPaid.toFixed(2)} MAD</p>
                      </div>
                      <div className="bg-red-50 p-3 rounded">
                        <p className="text-sm text-gray-600">المتبقي</p>
                        <p className="font-bold text-red-600">{credit.remainingAmount.toFixed(2)} MAD</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-sm text-gray-600">الحالة</p>
                        <div>{getStatusBadge(credit.status)}</div>
                      </div>
                    </div>
                  ) : null
                })()}
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowDetailsModal(false)
                  setSelectedSupplier(null)
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
