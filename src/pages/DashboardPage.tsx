import { useEffect, useState } from 'react'
import { ShoppingCart, DollarSign, AlertCircle, TrendingUp, Package, Users, TrendingDown, CreditCard, FileText, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    todaySales: 0,
    todayProfit: 0,
    totalCredits: 0,
    lowStockProducts: 0,
    totalStock: 0,
    todaySalesCount: 0,
    supplierDebts: 0,
    monthlyExpenses: 0,
    activeEmployees: 0,
    chequesCount: 0,
    chequesTotal: 0,
    overdueClients: [] as Array<{name: string, debt: number, daysOverdue: number}>,
    chequesList: [] as Array<{
      invoiceNumber: string,
      clientName: string,
      checkNumber: string,
      checkBank: string,
      totalAmount: number,
      paidAmount: number,
      remainingAmount: number
    }>,
    supplierPaymentReminders: [] as Array<{
      purchaseNumber: string
      supplierName: string
      paymentType: 'check' | 'credit'
      amount: number
      dueDate: string
      checkNumber?: string
      bankName?: string
      daysOverdue: number
    }>,
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
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
      const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().split('T')[0]

      console.log('Dashboard fetch - Today:', todayStr, 'Month start:', monthStart)

      // 1. Ventes du jour
      const { data: todayInvoices, error: err1 } = await supabase
        .from('invoices')
        .select('total_amount')
        .gte('created_at', todayStr)
        .lt('created_at', tomorrowStr)

      if (err1) console.error('❌ Invoices error:', err1)
      else console.log('✅ Invoices fetched:', todayInvoices?.length)

      const todaySales = todayInvoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0
      const todaySalesCount = todayInvoices?.length || 0

      // 2. Bénéfice du jour
      const todayProfit = todaySales * 0.3

      // 3. Crédits clients
      const { data: allInvoices, error: err2 } = await supabase
        .from('invoices')
        .select('total_amount, paid_amount, status')

      if (err2) console.error('❌ All invoices error:', err2)
      else console.log('✅ All invoices fetched:', allInvoices?.length)

      const totalCredits = allInvoices?.reduce((sum, inv) => {
        if (inv.status === 'sent' || inv.status === 'partial') {
          return sum + ((inv.total_amount || 0) - (inv.paid_amount || 0))
        }
        return sum
      }, 0) || 0

      // 4. Stock faible
      const { data: allProducts, error: err3 } = await supabase
        .from('products')
        .select('id, stock')

      if (err3) console.error('❌ Products error:', err3)
      else console.log('✅ Products fetched:', allProducts?.length)

      const lowStockProducts = allProducts?.filter(p => (p.stock || 0) < 10).length || 0
      const totalStock = allProducts?.reduce((sum, p) => sum + (p.stock || 0), 0) || 0

      // 5. Dettes fournisseurs
      const { data: purchases, error: err4 } = await supabase
        .from('purchases')
        .select('total_amount')

      if (err4) console.error('❌ Purchases error:', err4)
      else console.log('✅ Purchases fetched:', purchases?.length)

      const { data: payments, error: err5 } = await supabase
        .from('supplier_payments')
        .select('amount')

      if (err5) console.error('❌ Payments error:', err5)
      else console.log('✅ Payments fetched:', payments?.length)

      const totalPurchases = purchases?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0
      const totalPayments = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
      const supplierDebts = Math.max(0, totalPurchases - totalPayments)

      // 6. Dépenses du mois
      const { data: monthExpenses, error: err6 } = await supabase
        .from('expenses')
        .select('amount')
        .gte('date', monthStart)
        .lte('date', todayStr)

      if (err6) console.error('❌ Expenses error:', err6)
      else console.log('✅ Expenses fetched:', monthExpenses?.length)

      const monthlyExpenses = monthExpenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0

      // 7. Employés actifs
      const { data: employees, error: err7 } = await supabase
        .from('employees')
        .select('id')
        .eq('status', 'active')

      if (err7) console.error('❌ Employees error:', err7)
      else console.log('✅ Employees fetched:', employees?.length)

      const activeEmployees = employees?.length || 0

      // 8. Rappels achats (chèques/dettes) - اليوم أو متأخر
      const { data: reminderPurchases, error: err8a } = await supabase
        .from('purchases')
        .select(`
          purchase_number,
          total_amount,
          payment_type,
          check_number,
          bank_name,
          check_deposit_date,
          credit_due_date,
          supplier:suppliers(name_ar)
        `)
        .in('payment_type', ['check', 'credit'])
        .order('purchase_date', { ascending: false })
        .limit(200)

      if (err8a) console.error('❌ Purchases reminders error:', err8a)

      const supplierPaymentReminders = (reminderPurchases || [])
        .map((p: any) => {
          const dueDate = p.payment_type === 'check' ? p.check_deposit_date : p.credit_due_date
          if (!dueDate) return null
          const daysOverdue = Math.floor((new Date(todayStr).getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24))
          if (daysOverdue < 0) return null
          return {
            purchaseNumber: p.purchase_number,
            supplierName: p.supplier?.name_ar || 'غير محدد',
            paymentType: p.payment_type,
            amount: Number(p.total_amount || 0),
            dueDate,
            checkNumber: p.check_number || undefined,
            bankName: p.bank_name || undefined,
            daysOverdue,
          }
        })
        .filter(Boolean)
        .sort((a: any, b: any) => (b.daysOverdue - a.daysOverdue) || (b.amount - a.amount))
        .slice(0, 8) as Array<{
          purchaseNumber: string
          supplierName: string
          paymentType: 'check' | 'credit'
          amount: number
          dueDate: string
          checkNumber?: string
          bankName?: string
          daysOverdue: number
        }>

      // 9. Chèques (même source que "الفواتير المدفوعة بشيك" في صفحة Credits)
      // Important: inclure les factures où payment_method peut être sur invoice OU sur payments[0].
      const { data: chequeInvoicesRaw, error: err8 } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          created_at,
          total_amount,
          paid_amount,
          payment_method,
          bank_name,
          bank_name_ar,
          check_number,
          check_date,
          check_deposit_date,
          client:clients(company_name_ar),
          payments(payment_method)
        `)
        .order('created_at', { ascending: false })
        .limit(200)

      if (err8) console.error('❌ Cheque invoices error:', err8)

      const chequeInvoices = (chequeInvoicesRaw || []).filter((inv: any) => {
        const method = inv.payment_method || inv.payments?.[0]?.payment_method
        return method === 'check' || method === 'cheque'
      })

      const chequesCount = chequeInvoices.length
      const chequesTotal = chequeInvoices.reduce((sum: number, inv: any) => sum + Number(inv.total_amount || 0), 0)

      // 9. Clients avec dettes en retard (plus de 30 jours)
      const { data: overdueInvoices, error: err9 } = await supabase
        .from('invoices')
        .select(`
          total_amount,
          paid_amount,
          created_at,
          client:clients(id, company_name_ar)
        `)
        .in('status', ['partial', 'credit'])
        .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

      if (err9) console.error('❌ Overdue invoices error:', err9)
      else console.log('✅ Overdue invoices fetched:', overdueInvoices?.length)

      // Grouper par client et calculer les dettes en retard
      const clientDebts = new Map<string, {name: string, debt: number, daysOverdue: number}>()
      
      overdueInvoices?.forEach((invoice: any) => {
        const client = invoice.client as any
        const clientId = client?.id
        const clientName = client?.company_name_ar || 'عميل غير معروف'
        const remaining = (invoice.total_amount || 0) - (invoice.paid_amount || 0)
        
        if (remaining > 0 && clientId) {
          const daysOverdue = Math.floor((Date.now() - new Date(invoice.created_at).getTime()) / (1000 * 60 * 60 * 24))
          
          if (clientDebts.has(clientId)) {
            const existing = clientDebts.get(clientId)!
            existing.debt += remaining
            existing.daysOverdue = Math.max(existing.daysOverdue, daysOverdue)
          } else {
            clientDebts.set(clientId, {
              name: clientName,
              debt: remaining,
              daysOverdue: daysOverdue
            })
          }
        }
      })
      
      const overdueClients = Array.from(clientDebts.values()).sort((a, b) => b.debt - a.debt).slice(0, 5) // Top 5

      // Préparer la liste détaillée des chèques (récent)
      const chequesList = chequeInvoices.slice(0, 8).map((inv: any) => {
        const clientName = inv?.client?.company_name_ar || 'عميل غير معروف'
        const totalAmount = Number(inv?.total_amount ?? 0)
        const paidAmount = Number(inv?.paid_amount ?? 0)
        const remainingAmount = Math.max(0, totalAmount - paidAmount)
        return {
          invoiceNumber: inv?.invoice_number || 'غير محدد',
          clientName,
          checkNumber: inv?.check_number || 'غير محدد',
          checkBank: inv?.bank_name_ar || inv?.bank_name || 'غير محدد',
          checkDepositDate: inv?.check_deposit_date || null,
          totalAmount,
          paidAmount,
          remainingAmount
        }
      })

      console.log('📊 Dashboard stats:', {
        todaySales,
        totalCredits,
        lowStockProducts,
        totalStock,
        supplierDebts,
        monthlyExpenses,
        activeEmployees,
        supplierPaymentReminders,
        chequesCount,
        chequesTotal,
        overdueClients
      })

      setStats({
        todaySales,
        todayProfit,
        totalCredits,
        lowStockProducts,
        totalStock,
        todaySalesCount,
        supplierDebts,
        monthlyExpenses,
        activeEmployees,
        supplierPaymentReminders,
        chequesCount,
        chequesTotal,
        overdueClients,
        chequesList,
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
      value: `${stats.todaySales.toFixed(2)} MAD`,
      icon: ShoppingCart,
      color: 'from-green-500 to-green-600',
    },
    {
      title: 'الربح اليوم',
      value: `${stats.todayProfit.toFixed(2)} MAD`,
      icon: TrendingUp,
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'المخزون الكلي',
      value: stats.totalStock.toString(),
      icon: Package,
      color: 'from-teal-500 to-teal-600',
    },
    {
      title: 'الديون غير المسددة',
      value: `${stats.totalCredits.toFixed(2)} MAD`,
      icon: DollarSign,
      color: 'from-red-500 to-red-600',
    },
    {
      title: 'منتجات منخفضة المخزون',
      value: stats.lowStockProducts.toString(),
      icon: AlertCircle,
      color: 'from-orange-500 to-orange-600',
    },
    {
      title: 'عدد المبيعات اليوم',
      value: stats.todaySalesCount.toString(),
      icon: ShoppingCart,
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: 'دين الموردين',
      value: `${stats.supplierDebts.toFixed(2)} MAD`,
      icon: CreditCard,
      color: 'from-indigo-500 to-indigo-600',
    },
    {
      title: 'المصروفات هذا الشهر',
      value: `${stats.monthlyExpenses.toFixed(2)} MAD`,
      icon: TrendingDown,
      color: 'from-pink-500 to-pink-600',
    },
    {
      title: 'الموظفين النشطين',
      value: stats.activeEmployees.toString(),
      icon: Users,
      color: 'from-cyan-500 to-cyan-600',
    },
    {
      title: 'الشيكات',
      value: stats.chequesCount.toString(),
      icon: Calendar,
      color: 'from-amber-500 to-amber-600',
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
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="text-white" size={28} />
          لوحة التحكم
        </h1>
        <div className="text-xs md:text-sm text-white">
          {new Date().toLocaleDateString('ar-MA', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* 5 indicateurs clés en grandes cartes */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {cards.map((card, index) => {
          const Icon = card.icon
          return (
            <div
              key={index}
              className={`bg-gradient-to-br ${card.color} text-white rounded-xl p-4 shadow-lg`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-white/80 text-sm mb-1">{card.title}</p>
                  <p className="text-2xl font-bold">{card.value}</p>
                </div>
                <div className="bg-white/15 p-2 rounded-lg">
                  <Icon size={28} className="text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Actions rapides */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <h2 className="text-lg font-bold text-gray-800 mb-3">إجراءات سريعة</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <button
            onClick={() => window.location.href = '/pos'}
            className="bg-green-100 hover:bg-green-200 text-green-700 p-3 rounded-lg font-bold transition-all duration-200 flex flex-col items-center gap-1"
          >
            <ShoppingCart size={24} />
            فتح الكايس
          </button>
          <button
            onClick={() => window.location.href = '/invoices'}
            className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-3 rounded-lg font-bold transition-all duration-200 flex flex-col items-center gap-1"
          >
            <Package size={24} />
            المبيعات
          </button>
          <button
            onClick={() => window.location.href = '/orders'}
            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 p-3 rounded-lg font-bold transition-all duration-200 flex flex-col items-center gap-1"
          >
            <FileText size={24} />
            الطلبات
          </button>
          <button
            onClick={() => window.location.href = '/credits'}
            className="bg-red-100 hover:bg-red-200 text-red-700 p-3 rounded-lg font-bold transition-all duration-200 flex flex-col items-center gap-1"
          >
            <DollarSign size={24} />
            متابعة الديون
          </button>
          <button
            onClick={() => window.location.href = '/products'}
            className="bg-purple-100 hover:bg-purple-200 text-purple-700 p-3 rounded-lg font-bold transition-all duration-200 flex flex-col items-center gap-1"
          >
            <Package size={24} />
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
                المبلغ الإجمالي غير المسدد: {stats.totalCredits.toFixed(2)} MAD
              </p>
            </div>
          </div>
        </div>
      )}

      {stats.overdueClients.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 mt-1" size={24} />
            <div className="flex-1">
              <p className="font-bold text-red-800">⚠️ عملاء متأخرون في السداد (أكثر من 30 يوم)</p>
              <div className="mt-2 space-y-1">
                {stats.overdueClients.map((client, index) => (
                  <div key={index} className="flex justify-between items-center text-red-700">
                    <span className="font-medium">{client.name}</span>
                    <span className="text-sm">
                      {client.debt.toFixed(2)} MAD • {client.daysOverdue} يوم
                    </span>
                  </div>
                ))}
              </div>
              {stats.overdueClients.length >= 5 && (
                <p className="text-xs text-red-600 mt-2">+ عملاء آخرون...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {stats.supplierPaymentReminders.length > 0 && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-blue-600 mt-1" size={24} />
            <div className="flex-1">
              <p className="font-bold text-blue-800">⏰ تذكير: شيكات/ديون الموردين المستحقة</p>
              <div className="mt-2 space-y-2">
                {stats.supplierPaymentReminders.map((r, index) => (
                  <div key={index} className="bg-blue-100 rounded-lg p-3 border border-blue-200">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-blue-900">{r.supplierName}</p>
                        <p className="text-sm text-blue-700">{r.purchaseNumber}</p>
                        <p className="text-xs text-blue-600">
                          {r.paymentType === 'check' ? 'شيك' : 'دين'} • {new Date(r.dueDate).toLocaleDateString('ar-MA')}
                          {r.daysOverdue > 0 ? ` • متأخر ${r.daysOverdue} يوم` : ''}
                        </p>
                        {r.paymentType === 'check' && r.checkNumber && (
                          <p className="text-xs text-blue-600">
                            شيك #{r.checkNumber}{r.bankName ? ` - ${r.bankName}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-blue-900">{r.amount.toFixed(2)} MAD</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {stats.chequesCount > 0 && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Calendar className="text-amber-600 mt-1" size={24} />
            <div className="flex-1">
              <p className="font-bold text-amber-800">شيكات (الفواتير المدفوعة بشيك)</p>
              <div className="mt-2 space-y-2">
                {stats.chequesList.map((cheque, index) => (
                  <div key={index} className="bg-amber-100 rounded-lg p-3 border border-amber-200">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-amber-900">{cheque.clientName}</p>
                        <p className="text-sm text-amber-700">فاتورة #{cheque.invoiceNumber}</p>
                        <p className="text-xs text-amber-600">
                          شيك #{cheque.checkNumber} - {cheque.checkBank}
                        </p>
                        {cheque.checkDepositDate && (
                          <p className="text-xs text-blue-600">
                            تاريخ الإيداع: {new Date(cheque.checkDepositDate).toLocaleDateString('ar-MA')}
                          </p>
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-sm text-amber-700">المبلغ: {cheque.totalAmount.toFixed(2)} MAD</p>
                        <p className="text-sm text-green-700">المدفوع: {cheque.paidAmount.toFixed(2)} MAD</p>
                        <p className="text-sm font-bold text-red-700">المتبقي: {cheque.remainingAmount.toFixed(2)} MAD</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
