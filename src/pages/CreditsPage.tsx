import { useState, useEffect } from 'react'
import { AlertCircle, Clock, DollarSign, User, Calendar, TrendingUp, FileText, CreditCard, Eye, ArrowRight, CheckCircle, Search, Filter, ShoppingCart, Wallet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const toInputDateValue = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().split('T')[0]
}

interface ClientCredit {
  client_id: string
  client_name: string
  client_phone?: string
  total_debt: number
  total_paid: number
  remaining: number
  oldest_debt_date: string
  days_overdue: number
  invoices_count: number
}

interface InvoiceWithPayments {
  id: string
  invoice_number: string
  created_at: string
  total_amount: number
  paid_amount: number
  remaining: number
  payment_method?: string | null
  bank_name?: string | null
  check_number?: string | null
  check_date?: string | null
  check_deposit_date?: string | null
  payment_status?: string | null
  client_id?: string | null
  invoice_date?: string | null
  client_name?: string | null
  client?: {
    id?: string | null
    company_name_ar?: string | null
  } | null
  items?: any[]
  payments: Payment[]
}

interface Payment {
  id: string
  amount: number
  payment_method: string
  payment_date: string
  status: string
}

export default function CreditsPage() {
  const navigate = useNavigate()
  const [credits, setCredits] = useState<ClientCredit[]>([])
  const [chequePaidInvoices, setChequePaidInvoices] = useState<InvoiceWithPayments[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientCredit | null>(null)
  const [clientInvoices, setClientInvoices] = useState<InvoiceWithPayments[]>([])
  const [creditInvoices, setCreditInvoices] = useState<InvoiceWithPayments[]>([])
  const [loading, setLoading] = useState(true)
  const [showPaymentHistory, setShowPaymentHistory] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithPayments | null>(null)
  const [showChequePaymentModal, setShowChequePaymentModal] = useState(false)
  const [selectedChequeInvoice, setSelectedChequeInvoice] = useState<InvoiceWithPayments | null>(null)

  // Enregistrement d'une dette (paiement réparti sur les factures les plus anciennes)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentClient, setPaymentClient] = useState<ClientCredit | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)

  // Filtres de la liste des factures dans le détail client
  const [invStatusFilter, setInvStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all')
  const [invPeriodFilter, setInvPeriodFilter] = useState<'all' | 'today' | '7days' | '30days' | 'month' | 'custom'>('all')
  const [invDateFrom, setInvDateFrom] = useState('')
  const [invDateTo, setInvDateTo] = useState('')

  // Filtres
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAmount, setFilterAmount] = useState<'all' | 'low' | 'medium' | 'high'>('all')
  const [filterDays, setFilterDays] = useState<'all' | 'recent' | 'medium' | 'overdue'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all')
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | '7days' | '30days' | 'month' | 'custom'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    loadCredits()
  }, [])

  const loadCredits = async () => {
    setLoading(true)
    try {
      console.log('🔄 Loading credits...')
      // Récupérer toutes les factures avec leurs paiements
      // Corriger la requête pour utiliser les bons noms de colonnes
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients(id, company_name_ar),
          payments (*)
        `)
        .order('created_at', { ascending: true })

      console.log('📊 Raw credits data:', invoices?.length, 'invoices')
      console.log('❌ Credits Error:', error)

      if (error) {
        console.error('Supabase credits error:', error)
        return
      }

      if (invoices) {
        console.log('🔍 Processing', invoices.length, 'invoices for credits')
        
        // Séparer les factures payées par chèque des autres
        const chequePaid = invoices.filter(invoice => {
          const method = invoice.payment_method || invoice.payments?.[0]?.payment_method
          return method === 'check' || method === 'cheque'
        })
        
        // Filtrer les factures non soldées côté client (dettes)
        const unpaidInvoices = invoices.filter(invoice => {
          const remaining = (invoice.total_amount || 0) - (invoice.paid_amount || 0)
          const method = invoice.payment_method || invoice.payments?.[0]?.payment_method
          const isUnpaid = invoice.payment_status === 'partial' || 
                         invoice.payment_status === 'credit' || 
                         remaining > 0
          
          console.log(`💳 Invoice ${invoice.invoice_number}: status=${invoice.payment_status}, remaining=${remaining}, isUnpaid=${isUnpaid}`)
          
          return isUnpaid && method !== 'check' && method !== 'cheque'
        })

        const unpaidInvoicesWithDetails = unpaidInvoices.map(invoice => ({
          ...invoice,
          remaining: (invoice.total_amount || 0) - (invoice.paid_amount || 0),
          payment_method: invoice.payment_method || invoice.payments?.[0]?.payment_method || null
        }))
        setCreditInvoices(unpaidInvoicesWithDetails)
        
        // Traiter les factures payées par chèque
        const chequePaidWithDetails = chequePaid.map(invoice => ({
          ...invoice,
          remaining: invoice.remaining || 0, // Garder la valeur existante ou 0
          payment_method: invoice.payment_method || invoice.payments?.[0]?.payment_method || 'check',
          payment_status: invoice.payment_status || 'pending', // Par défaut non payé
          paid_amount: invoice.paid_amount || 0 // Par défaut 0
        }))
        setChequePaidInvoices(chequePaidWithDetails)
        
        // Grouper par client pour les dettes uniquement
        const clientsMap = new Map<string, ClientCredit>()

        unpaidInvoices.forEach(invoice => {
          const clientId = invoice.client_id
          const clientName = invoice.client?.company_name_ar || 'عميل غير معروف'
          const remaining = (invoice.total_amount || 0) - (invoice.paid_amount || 0)
          
          if (!clientsMap.has(clientId)) {
            clientsMap.set(clientId, {
              client_id: clientId,
              client_name: clientName,
              client_phone: undefined, // Pas de téléphone dans la table clients
              total_debt: 0,
              total_paid: 0,
              remaining: 0,
              invoices_count: 0,
              oldest_debt_date: invoice.created_at || invoice.invoice_date,
              days_overdue: 0
            })
          }

          const client = clientsMap.get(clientId)!
          client.total_debt += invoice.total_amount || 0
          client.total_paid += invoice.paid_amount || 0
          client.remaining += remaining
          client.invoices_count += 1

          // Calculer les jours de retard
          const oldestDate = new Date(client.oldest_debt_date)
          const now = new Date()
          client.days_overdue = Math.floor((now.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
        })

        const finalCredits = Array.from(clientsMap.values()).sort((a, b) => b.remaining - a.remaining)
        console.log('✅ Final credits processed:', finalCredits.length, 'clients')
        console.log('💰 Total debt amount:', finalCredits.reduce((sum, c) => sum + c.remaining, 0))
        
        setCredits(finalCredits)
      }
    } catch (error) {
      console.error('Error loading credits:', error)
    } finally {
      setLoading(false)
    }
  }

  // Charge TOUTES les factures du client (payées, partielles, non payées) pour
  // l'historique complet, des plus anciennes aux plus récentes.
  const loadClientInvoices = async (clientId: string) => {
    const { data } = await supabase
      .from('invoices')
      .select(`
        *,
        client:clients(id, company_name_ar),
        payments (*)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })

    if (data) {
      const invoicesWithPayments = data.map(invoice => ({
        ...invoice,
        remaining: (invoice.total_amount || 0) - (invoice.paid_amount || 0),
        payment_method: invoice.payment_method || invoice.payments?.[0]?.payment_method || null
      }))
      setClientInvoices(invoicesWithPayments)
    }
  }

  // Statut de paiement d'une facture : 'paid' (vert), 'partial' (orange), 'unpaid' (rouge)
  const getInvoiceStatus = (invoice: InvoiceWithPayments): 'paid' | 'partial' | 'unpaid' => {
    const total = invoice.total_amount || 0
    const paid = invoice.paid_amount || 0
    if (total > 0 && paid >= total - 0.009) return 'paid'
    if (paid > 0.009) return 'partial'
    return 'unpaid'
  }

  const statusStyles: Record<'paid' | 'partial' | 'unpaid', { border: string; badge: string; label: string }> = {
    paid: { border: 'border-green-400 bg-green-50', badge: 'bg-green-100 text-green-700', label: 'مدفوع' },
    partial: { border: 'border-orange-400 bg-orange-50', badge: 'bg-orange-100 text-orange-700', label: 'مدفوع جزئياً' },
    unpaid: { border: 'border-red-400 bg-red-50', badge: 'bg-red-100 text-red-700', label: 'غير مدفوع' },
  }

  // Insère un enregistrement de paiement. Essaie plusieurs payloads (du plus
  // complet au plus minimal) pour s'adapter au schéma déployé. Renvoie le
  // message d'erreur si TOUTES les tentatives échouent, sinon null.
  const insertPayment = async (
    invoiceId: string,
    clientId: string | null,
    amount: number,
    dateIso: string
  ): Promise<string | null> => {
    const base: any = {
      invoice_id: invoiceId,
      client_id: clientId,
      amount,
      payment_method: 'cash',
      payment_date: dateIso,
      status: 'completed',
    }
    const attempts: any[] = [
      { ...base, payment_number: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`, notes: 'دفعة من متابعة الديون' },
      base,
      { invoice_id: invoiceId, client_id: clientId, amount, payment_method: 'cash', payment_date: dateIso },
      { invoice_id: invoiceId, amount, payment_date: dateIso },
    ]
    let lastError = ''
    for (const payload of attempts) {
      const { error } = await supabase.from('payments').insert(payload)
      if (!error) return null
      lastError = `${error.code || ''} ${error.message || ''}`.trim()
      console.error('Payment insert attempt failed:', error)
    }
    return lastError || 'unknown error'
  }

  // Enregistre un paiement et le répartit sur les factures les plus anciennes
  // d'abord (FIFO). Ex: 1500 DH sur 5 factures de 1000 -> facture 1 soldée,
  // facture 2 partielle (500 restant), les autres inchangées.
  const handleRecordPayment = async () => {
    if (!paymentClient) return
    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0) {
      alert('يرجى إدخال مبلغ صحيح')
      return
    }
    if (amount > paymentClient.remaining + 0.01) {
      alert(`المبلغ أكبر من إجمالي الدين (${paymentClient.remaining.toFixed(2)} MAD)`)
      return
    }

    setIsSubmittingPayment(true)
    try {
      // Récupérer les factures non soldées, des plus anciennes aux plus récentes
      const { data: invs, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('client_id', paymentClient.client_id)
        .order('created_at', { ascending: true })

      if (error) throw error

      const unpaid = (invs || []).filter(inv => {
        const remaining = (inv.total_amount || 0) - (inv.paid_amount || 0)
        const method = inv.payment_method
        return remaining > 0.009 && method !== 'check' && method !== 'cheque'
      })

      const clientId = paymentClient.client_id
      let leftover = amount
      const todayIso = new Date().toISOString()
      let paymentRecordFailures = 0
      let firstPaymentError = ''
      let stillUnpaidCount = 0

      for (const inv of unpaid) {
        const total = inv.total_amount || 0
        const alreadyPaid = inv.paid_amount || 0
        const invRemaining = total - alreadyPaid
        const applied = leftover > 0.009 ? Math.min(invRemaining, leftover) : 0
        const newPaid = alreadyPaid + applied
        const newRemaining = Math.max(0, total - newPaid)
        const newStatus = newRemaining <= 0.009 ? 'paid' : 'partial'

        if (newRemaining > 0.009) stillUnpaidCount += 1

        if (applied <= 0.009) continue

        // Mise à jour progressive : certaines installations n'ont pas toutes
        // les colonnes (payment_status / remaining_amount). On tente du payload
        // le plus complet au plus minimal.
        const updateAttempts: any[] = [
          { paid_amount: newPaid, remaining_amount: newRemaining, payment_status: newStatus },
          { paid_amount: newPaid, remaining_amount: newRemaining },
          { paid_amount: newPaid },
        ]
        let updErr: any = null
        for (const payload of updateAttempts) {
          const res = await supabase.from('invoices').update(payload).eq('id', inv.id)
          if (!res.error) { updErr = null; break }
          updErr = res.error
          // Si l'erreur ne concerne pas une colonne manquante, inutile de réessayer
          const msg = String(res.error.message || '')
          if (!msg.includes('column') && res.error.code !== 'PGRST204') break
        }
        if (updErr) throw updErr

        const payErr = await insertPayment(inv.id, clientId, applied, todayIso)
        if (payErr) {
          paymentRecordFailures += 1
          if (!firstPaymentError) firstPaymentError = payErr
        }
        leftover -= applied
      }

      const appliedTotal = amount - leftover

      // Mise à jour en place du résumé du client (montant payé, restant, nb factures)
      setSelectedClient(prev => {
        if (!prev || prev.client_id !== clientId) return prev
        return {
          ...prev,
          total_paid: prev.total_paid + appliedTotal,
          remaining: Math.max(0, prev.remaining - appliedTotal),
          invoices_count: stillUnpaidCount,
        }
      })

      // Rafraîchir les listes
      await loadCredits()
      await loadAllInvoices()
      if (selectedClient && selectedClient.client_id === clientId) {
        await loadClientInvoices(clientId)
      }

      setShowPaymentModal(false)
      setPaymentAmount('')
      setPaymentClient(null)

      if (paymentRecordFailures > 0) {
        alert(`⚠️ تم خصم ${appliedTotal.toFixed(2)} MAD من الدين، لكن تعذّر حفظ ${paymentRecordFailures} سجل دفع.\nالسبب: ${firstPaymentError}`)
      } else {
        alert(`✅ تم تسجيل دفعة ${appliedTotal.toFixed(2)} MAD وتوزيعها على الفواتير بنجاح`)
      }
    } catch (e) {
      console.error('Error recording payment:', e)
      alert(`❌ حدث خطأ أثناء تسجيل الدفعة: ${e instanceof Error ? e.message : ''}`)
    } finally {
      setIsSubmittingPayment(false)
    }
  }

  const getPaymentTypeDisplay = (paymentMethod: string | null | undefined) => {
    if (!paymentMethod) return '-'
    
    switch (paymentMethod) {
      case 'cash':
        return (
          <span className="flex items-center gap-1 text-green-700 font-semibold">
            <DollarSign size={14} />
            نقدي
          </span>
        )
      case 'check':
        return (
          <span className="flex items-center gap-1 text-blue-700 font-semibold">
            <FileText size={14} />
            شيك
          </span>
        )
      case 'debt':
        return (
          <span className="flex items-center gap-1 text-orange-700 font-semibold">
            <Clock size={14} />
            دين
          </span>
        )
      default:
        return paymentMethod
    }
  }

  const handleClientClick = (client: ClientCredit) => {
    setSelectedClient(client)
    setClientInvoices([])
    setInvStatusFilter('all')
    setInvPeriodFilter('all')
    setInvDateFrom('')
    setInvDateTo('')

    if (client.client_id) {
      // Charger l'historique complet (factures payées + non payées)
      loadClientInvoices(client.client_id)
      return
    }

    // Repli : pas d'id client, on filtre localement les factures non soldées
    const localClientInvoices = creditInvoices.filter(invoice =>
      (invoice.client?.company_name_ar || 'عميل غير معروف') === client.client_name
    )
    setClientInvoices(localClientInvoices)
  }

  const openPaymentModal = (client: ClientCredit) => {
    setPaymentClient(client)
    setPaymentAmount('')
    setShowPaymentModal(true)
  }

  const handleInvoiceClick = (invoice: InvoiceWithPayments) => {
    setSelectedInvoice(invoice)
    setShowPaymentHistory(true)
  }

  const openInvoiceInPOS = (invoice: InvoiceWithPayments) => {
    const rawItems: any[] = Array.isArray(invoice.items) ? invoice.items : []
    const posItems = rawItems.map((item: any) => ({
      id: item.product_id || `item-${Math.random()}`,
      product_id: item.product_id || null,
      primary_variant_id: item.primary_variant_id || '',
      name_ar: item.product_name || item.product_name_ar || item.name_ar || item.description || 'منتج',
      unit_price: Number(item.unit_price || item.unitPrice || 0),
      price_a: Number(item.unit_price || item.unitPrice || 0),
      price_b: Number(item.unit_price || item.unitPrice || 0),
      price_c: Number(item.unit_price || item.unitPrice || 0),
      price_d: Number(item.unit_price || item.unitPrice || 0),
      price_e: Number(item.unit_price || item.unitPrice || 0),
      quantity: Number(item.quantity || 1),
      stock: 999,
      customPrice: Number(item.unit_price || item.unitPrice || 0),
      image_url: item.image_url || undefined,
      total: Number(item.total || item.line_total || 0)
    }))

    const posData = {
      invoiceId: invoice.id,
      invoice_number: invoice.invoice_number,
      client_id: invoice.client_id || null,
      client_name: invoice.client?.company_name_ar || invoice.client_name || '',
      total_amount: invoice.total_amount,
      paid_amount: invoice.paid_amount || 0,
      discount_percent: 0,
      discount_amount: 0,
      payment_method: invoice.payment_method || 'cash',
      created_at: invoice.invoice_date || invoice.created_at || new Date().toISOString(),
      is_credit: true,
      items: posItems
    }

    sessionStorage.setItem('posInvoiceData', JSON.stringify(posData))
    navigate('/pos')
  }

  const updateChequeStatus = async (invoiceId: string, status: 'paid' | 'partial' | 'unpaid', paidAmount?: number) => {
    try {
      const invoice = chequePaidInvoices.find(inv => inv.id === invoiceId)
      if (!invoice) return

      const totalAmount = invoice.total_amount || 0
      const actualPaidAmount = paidAmount || 0
      const remainingAmount = Math.max(0, totalAmount - actualPaidAmount)

      // Mettre à jour la facture avec seulement les colonnes existantes
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          paid_amount: actualPaidAmount,
          remaining_amount: remainingAmount
        })
        .eq('id', invoiceId)

      if (updateError) {
        console.error('Error updating invoice status:', updateError)
        alert('حدث خطأ أثناء تحديث الحالة')
        return
      }

      // Mettre à jour l'état local
      setChequePaidInvoices(prev => 
        prev.map(inv => 
          inv.id === invoiceId 
            ? { 
                ...inv, 
                payment_status: status === 'unpaid' ? 'pending' : status, 
                paid_amount: actualPaidAmount, 
                remaining: remainingAmount 
              }
            : inv
        )
      )

      setShowChequePaymentModal(false)
      alert('تم تحديث حالة الشيك بنجاح')
    } catch (error) {
      console.error('Error updating cheque status:', error)
      alert('حدث خطأ أثناء تحديث الحالة')
    }
  }

  const totalDebt = credits.reduce((sum, c) => sum + c.remaining, 0)

  // Calculer les dettes non échues (moins de 30 jours)
  // Nous allons créer une fonction pour récupérer toutes les factures non échues
  const [allInvoices, setAllInvoices] = useState<any[]>([])

  useEffect(() => {
    loadAllInvoices()
  }, [])

  const loadAllInvoices = async () => {
    try {
      console.log('🔄 Loading all invoices...')
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients(id, company_name_ar),
          payments (*)
        `)
        .order('created_at', { ascending: false })

      console.log('📊 Raw invoices data:', invoices?.length, 'invoices')
      console.log('❌ Error:', error)

      if (error) {
        console.error('Supabase error:', error)
        return
      }

      if (invoices) {
        console.log('🔍 Processing', invoices.length, 'invoices')
        
        // Filtrer les factures non échues (moins de 30 jours)
        const nonDueInvoices = invoices.filter(invoice => {
          const remaining = (invoice.total_amount || 0) - (invoice.paid_amount || 0)
          const invoiceDate = new Date(invoice.created_at || invoice.invoice_date)
          const daysSinceInvoice = Math.floor((new Date().getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
          
          console.log(`📋 Invoice ${invoice.invoice_number}: remaining=${remaining}, days=${daysSinceInvoice}`)
          
          return remaining > 0 && daysSinceInvoice <= 30
        }).map(invoice => ({
          ...invoice,
          remaining: (invoice.total_amount || 0) - (invoice.paid_amount || 0),
          daysSinceInvoice: Math.floor((new Date().getTime() - new Date(invoice.created_at || invoice.invoice_date).getTime()) / (1000 * 60 * 60 * 24))
        }))
        
        console.log('✅ Non-due invoices found:', nonDueInvoices.length)
        console.log('💰 Total non-due amount:', nonDueInvoices.reduce((sum, inv) => sum + inv.remaining, 0))
        
        setAllInvoices(nonDueInvoices)
      }
    } catch (error) {
      console.error('Error loading all invoices:', error)
    }
  }

  const totalNonDue = allInvoices.reduce((sum, inv) => sum + inv.remaining, 0)
  const nonDueCount = allInvoices.length

  // Filtrer les crédits selon les critères
  const filteredCredits = credits.filter(client => {
    const clientDateValue = toInputDateValue(client.oldest_debt_date)
    const today = new Date()
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const clientDate = clientDateValue ? new Date(clientDateValue) : null

    // Filtre par recherche (nom du client)
    if (searchTerm && !client.client_name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }

    // Filtre par montant
    if (filterAmount !== 'all') {
      if (filterAmount === 'low' && client.remaining >= 1000) return false
      if (filterAmount === 'medium' && (client.remaining < 1000 || client.remaining >= 5000)) return false
      if (filterAmount === 'high' && client.remaining < 5000) return false
    }

    // Filtre par durée de retard
    if (filterDays !== 'all') {
      if (filterDays === 'recent' && client.days_overdue > 15) return false
      if (filterDays === 'medium' && (client.days_overdue <= 15 || client.days_overdue > 30)) return false
      if (filterDays === 'overdue' && client.days_overdue <= 30) return false
    }

    // Filtre par statut de paiement/retard
    if (filterStatus !== 'all') {
      if (filterStatus === 'paid') return false
      if (filterStatus === 'partial' && client.total_paid <= 0) return false
      if (filterStatus === 'unpaid' && client.total_paid > 0) return false
    }

    // Filtre par période rapide
    if (periodFilter !== 'all' && clientDate) {
      const diffDays = Math.floor((startOfToday.getTime() - clientDate.getTime()) / (1000 * 60 * 60 * 24))
      const isSameMonth = clientDate.getFullYear() === today.getFullYear() && clientDate.getMonth() === today.getMonth()

      if (periodFilter === 'today' && diffDays !== 0) return false
      if (periodFilter === '7days' && (diffDays < 0 || diffDays > 7)) return false
      if (periodFilter === '30days' && (diffDays < 0 || diffDays > 30)) return false
      if (periodFilter === 'month' && !isSameMonth) return false
    }

    // Filtre par dates personnalisées
    if (clientDateValue && dateFrom && clientDateValue < dateFrom) {
      return false
    }

    if (clientDateValue && dateTo && clientDateValue > dateTo) {
      return false
    }

    return true
  })

  return (
    <div className="space-y-2" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <AlertCircle className="text-white" size={20} />
          متابعة الديون
        </h1>
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg p-3 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-[10px] mb-0.5">إجمالي الديون</p>
              <p className="text-sm md:text-base font-bold">{totalDebt.toFixed(0)} MAD</p>
            </div>
            <DollarSign size={20} className="text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-3 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-[10px] mb-0.5">الديون الغير مستحقة</p>
              <p className="text-sm md:text-base font-bold">{totalNonDue.toFixed(0)} MAD</p>
            </div>
            <Clock size={20} className="text-purple-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-3 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-[10px] mb-0.5">عدد العملاء</p>
              <p className="text-sm md:text-base font-bold">{filteredCredits.length}</p>
            </div>
            <User size={20} className="text-orange-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-lg p-3 shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-[10px] mb-0.5">متوسط الدين</p>
              <p className="text-sm md:text-base font-bold">
                {filteredCredits.length > 0 ? (filteredCredits.reduce((sum, c) => sum + c.remaining, 0) / filteredCredits.length).toFixed(0) : '0'} MAD
              </p>
            </div>
            <TrendingUp size={20} className="text-yellow-200" />
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-2">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-2">
          <div className="relative md:col-span-2">
            <Search className="absolute right-2 top-2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="ابحث عن عميل..."
              className="w-full pr-7 pl-3 py-1.5 text-xs border border-gray-200 rounded focus:border-blue-500 focus:outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={filterAmount}
            onChange={(e) => setFilterAmount(e.target.value as any)}
            className="px-2 py-1.5 text-xs border border-gray-200 rounded focus:border-blue-500 focus:outline-none"
          >
            <option value="all">كل المبالغ</option>
            <option value="low">&lt; 1000 MAD</option>
            <option value="medium">1000 - 5000</option>
            <option value="high">&gt; 5000 MAD</option>
          </select>
          <select
            value={filterDays}
            onChange={(e) => setFilterDays(e.target.value as any)}
            className="px-2 py-1.5 text-xs border border-gray-200 rounded focus:border-blue-500 focus:outline-none"
          >
            <option value="all">كل المدد</option>
            <option value="recent">&lt; 15 يوم</option>
            <option value="medium">15 - 30 يوم</option>
            <option value="overdue">&gt; 30 يوم</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-2 py-1.5 text-xs border border-gray-200 rounded focus:border-blue-500 focus:outline-none"
          >
            <option value="all">كل الحالات</option>
            <option value="partial">مدفوع جزئياً</option>
            <option value="unpaid">غير مدفوع</option>
          </select>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as any)}
            className="px-2 py-1.5 text-xs border border-gray-200 rounded focus:border-blue-500 focus:outline-none"
          >
            <option value="all">كل الفترات</option>
            <option value="today">اليوم</option>
            <option value="7days">7 أيام</option>
            <option value="30days">30 يوم</option>
            <option value="month">هذا الشهر</option>
            <option value="custom">فترة مخصصة</option>
          </select>
          <input
            type="date"
            className="px-2 py-1.5 text-xs border border-gray-200 rounded focus:border-blue-500 focus:outline-none"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <input
            type="date"
            className="px-2 py-1.5 text-xs border border-gray-200 rounded focus:border-blue-500 focus:outline-none"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <Filter size={12} />
            <span>{filteredCredits.length} عميل</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('')
              setFilterAmount('all')
              setFilterDays('all')
              setFilterStatus('all')
              setPeriodFilter('all')
              setDateFrom('')
              setDateTo('')
            }}
            className="text-blue-600 hover:text-blue-700 font-semibold"
          >
            إعادة التصفية
          </button>
        </div>
      </div>

      {/* Liste des clients avec dettes */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 text-black">
              <tr>
                <th className="px-4 py-3 text-right font-bold text-sm">العميل</th>
                <th className="px-4 py-3 text-right font-bold text-sm">إجمالي الدين</th>
                <th className="px-4 py-3 text-right font-bold text-sm">المدفوع</th>
                <th className="px-4 py-3 text-right font-bold text-sm">المتبقي</th>
                <th className="px-4 py-3 text-right font-bold text-sm">عدد الفواتير</th>
                <th className="px-4 py-3 text-right font-bold text-sm">مدة الدين</th>
                <th className="px-4 py-3 text-right font-bold text-sm">الحالة</th>
                <th className="px-4 py-3 text-right font-bold text-sm">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    جاري التحميل...
                  </td>
                </tr>
              ) : filteredCredits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    لا توجد ديون مسجلة
                  </td>
                </tr>
              ) : (
                filteredCredits.map((client) => (
                  <tr
                    key={client.client_id}
                    className="border-b hover:bg-red-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="text-gray-400" size={20} />
                        <div>
                          <span className="font-semibold">{client.client_name}</span>
                          {client.client_phone && (
                            <p className="text-xs text-gray-500">{client.client_phone}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-700">
                      {client.total_debt.toFixed(2)} MAD
                    </td>
                    <td className="px-6 py-4 font-bold text-green-600">
                      {client.total_paid.toFixed(2)} MAD
                    </td>
                    <td className="px-6 py-4 font-bold text-red-600 text-lg">
                      {client.remaining.toFixed(2)} MAD
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-gray-100 px-3 py-1 rounded-full font-semibold">
                        {client.invoices_count}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Clock className="text-orange-500" size={18} />
                        <span className="font-semibold">{client.days_overdue} يوم</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full font-bold text-sm ${
                        client.days_overdue > 30
                          ? 'bg-red-100 text-red-700'
                          : client.days_overdue > 15
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {client.days_overdue > 30 ? 'متأخر جداً' : client.days_overdue > 15 ? 'متأخر' : 'حديث'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openPaymentModal(client)}
                          className="bg-green-100 hover:bg-green-200 text-green-700 p-2 rounded-lg transition-colors"
                          title="تسجيل دفعة"
                        >
                          <Wallet size={18} />
                        </button>
                        <button
                          onClick={() => handleClientClick(client)}
                          className="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-lg transition-colors"
                          title="عرض التفاصيل"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => navigate(`/client-tracking/${client.client_id}`)}
                          className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-2 rounded-lg transition-colors"
                          title="متابعة العميل"
                        >
                          <ArrowRight size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && filteredCredits.length > 0 && (
              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                <tr>
                  <td className="px-6 py-3 font-bold text-gray-800">المجموع</td>
                  <td className="px-6 py-3 font-bold text-gray-700">
                    {filteredCredits.reduce((s, c) => s + c.total_debt, 0).toFixed(2)} MAD
                  </td>
                  <td className="px-6 py-3 font-bold text-green-600">
                    {filteredCredits.reduce((s, c) => s + c.total_paid, 0).toFixed(2)} MAD
                  </td>
                  <td className="px-6 py-3 font-bold text-red-600 text-lg">
                    {filteredCredits.reduce((s, c) => s + c.remaining, 0).toFixed(2)} MAD
                  </td>
                  <td className="px-6 py-3 font-bold text-gray-700">
                    {filteredCredits.reduce((s, c) => s + c.invoices_count, 0)}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Sections en deux colonnes */}
      {(allInvoices.length > 0 || chequePaidInvoices.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section الفواتير المدفوعة بشيك - Gauche */}
          {chequePaidInvoices.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-6">
                <h2 className="text-xl font-bold flex items-center gap-3">
                  <FileText size={24} />
                  الفواتير المدفوعة بشيك
                  <span className="bg-orange-800 px-3 py-1 rounded-full text-sm">
                    {chequePaidInvoices.length} فواتير • {chequePaidInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0).toFixed(2)} MAD
                  </span>
                </h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-orange-50">
                    <tr>
                      <th className="px-4 py-3 text-right font-bold text-orange-900 text-sm">رقم الفاتورة</th>
                      <th className="px-4 py-3 text-right font-bold text-orange-900 text-sm">العميل</th>
                      <th className="px-4 py-3 text-right font-bold text-orange-900 text-sm">المبلغ</th>
                      <th className="px-4 py-3 text-right font-bold text-orange-900 text-sm">نوع الدفع</th>
                      <th className="px-4 py-3 text-right font-bold text-orange-900 text-sm">حالة الشيك</th>
                      <th className="px-4 py-3 text-right font-bold text-orange-900 text-sm">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chequePaidInvoices.slice(0, 10).map((invoice) => (
                      <tr key={invoice.id} className="border-b hover:bg-orange-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-orange-700 text-sm">
                          {invoice.invoice_number || invoice.id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold text-sm">{invoice.client?.company_name_ar || 'عميل غير معروف'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-sm">
                          {(invoice.total_amount || 0).toFixed(2)} MAD
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            <div className="flex items-center gap-1 text-orange-700 font-semibold mb-1">
                              <FileText size={12} />
                              شيك
                            </div>
                            {invoice.bank_name && (
                              <p className="text-gray-600 text-xs">البنك: {invoice.bank_name}</p>
                            )}
                            {invoice.check_number && (
                              <p className="text-gray-600 text-xs">رقم: {invoice.check_number}</p>
                            )}
                            {invoice.check_date && (
                              <p className="text-gray-600 text-xs">تاريخ الشيك: {new Date(invoice.check_date).toLocaleDateString('ar-DZ')}</p>
                            )}
                            {invoice.check_deposit_date && (
                              <p className="text-gray-600 text-xs">تاريخ الإيداع: {new Date(invoice.check_deposit_date).toLocaleDateString('ar-DZ')}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              (invoice.paid_amount || 0) >= (invoice.total_amount || 0)
                                ? 'bg-green-100 text-green-700' 
                                : (invoice.paid_amount || 0) > 0
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {(invoice.paid_amount || 0) >= (invoice.total_amount || 0) ? 'مدفوع' : 
                               (invoice.paid_amount || 0) > 0 ? 'مدفوع جزئياً' : 'غير مدفوع'}
                            </span>
                            {(invoice.paid_amount || 0) > 0 && (invoice.paid_amount || 0) < (invoice.total_amount || 0) && (
                              <span className="text-xs text-gray-600">
                                المتبقي: {((invoice.total_amount || 0) - (invoice.paid_amount || 0)).toFixed(2)} MAD
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                setSelectedInvoice(invoice)
                                setShowPaymentHistory(true)
                              }}
                              className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-1 rounded transition-colors"
                              title="عرض التفاصيل"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedChequeInvoice(invoice)
                                setShowChequePaymentModal(true)
                              }}
                              className="bg-orange-600 hover:bg-orange-700 text-white px-2 py-1 rounded text-xs font-bold transition-colors"
                            >
                              تحديث الحالة
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {chequePaidInvoices.length > 10 && (
                  <div className="p-3 text-center text-sm text-gray-500 border-t">
                    عرض أول 10 فواتير من {chequePaidInvoices.length}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section الديون الغير مستحقة - Droite */}
          {allInvoices.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6">
                <h2 className="text-xl font-bold flex items-center gap-3">
                  <Clock size={24} />
                  الديون الغير مستحقة (أقل من 30 يوم)
                  <span className="bg-purple-800 px-3 py-1 rounded-full text-sm">
                    {nonDueCount} فواتير • {totalNonDue.toFixed(2)} MAD
                  </span>
                </h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-purple-50">
                    <tr>
                      <th className="px-4 py-3 text-right font-bold text-purple-900 text-sm">رقم الفاتورة</th>
                      <th className="px-4 py-3 text-right font-bold text-purple-900 text-sm">العميل</th>
                      <th className="px-4 py-3 text-right font-bold text-purple-900 text-sm">المبلغ</th>
                      <th className="px-4 py-3 text-right font-bold text-purple-900 text-sm">الباقي</th>
                      <th className="px-4 py-3 text-right font-bold text-purple-900 text-sm">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allInvoices.slice(0, 10).map((invoice) => (
                      <tr key={invoice.id} className="border-b hover:bg-purple-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-purple-700 text-sm">
                          {invoice.invoice_number || invoice.id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold text-sm">{invoice.client?.company_name_ar || 'عميل غير معروف'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-sm">
                          {(invoice.total_amount || 0).toFixed(2)} MAD
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-purple-600 text-sm">
                            {invoice.remaining.toFixed(2)} MAD
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                setSelectedInvoice(invoice)
                                setShowPaymentHistory(true)
                              }}
                              className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-1 rounded transition-colors"
                              title="عرض التفاصيل"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedInvoice(invoice)
                                setShowPaymentHistory(true)
                              }}
                              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg font-bold text-xs transition-colors"
                            >
                              تفاصيل
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {allInvoices.length > 10 && (
                  <div className="p-3 text-center text-sm text-gray-500 border-t">
                    عرض أول 10 فواتير من {allInvoices.length}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal détails client */}
      {selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedClient(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <User className="text-red-600" />
                تفاصيل ديون: {selectedClient.client_name}
              </h2>
              <button
                onClick={() => setSelectedClient(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Résumé du crédit + bouton de paiement */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-gray-500">إجمالي الدين: </span>
                  <span className="font-bold text-gray-800">{selectedClient.total_debt.toFixed(2)} MAD</span>
                </div>
                <div>
                  <span className="text-gray-500">المدفوع: </span>
                  <span className="font-bold text-green-600">{selectedClient.total_paid.toFixed(2)} MAD</span>
                </div>
                <div>
                  <span className="text-gray-500">المتبقي: </span>
                  <span className="font-bold text-red-600">{selectedClient.remaining.toFixed(2)} MAD</span>
                </div>
              </div>
              <button
                onClick={() => openPaymentModal(selectedClient)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
              >
                <Wallet size={16} />
                تسجيل دفعة
              </button>
            </div>

            {/* Filtres de la liste */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <select
                value={invStatusFilter}
                onChange={(e) => setInvStatusFilter(e.target.value as any)}
                className="px-2 py-1.5 text-xs border border-gray-200 rounded focus:border-blue-500 focus:outline-none"
              >
                <option value="all">كل الحالات</option>
                <option value="paid">مدفوع</option>
                <option value="partial">مدفوع جزئياً</option>
                <option value="unpaid">غير مدفوع</option>
              </select>
              <select
                value={invPeriodFilter}
                onChange={(e) => setInvPeriodFilter(e.target.value as any)}
                className="px-2 py-1.5 text-xs border border-gray-200 rounded focus:border-blue-500 focus:outline-none"
              >
                <option value="all">كل الفترات</option>
                <option value="today">اليوم</option>
                <option value="7days">7 أيام</option>
                <option value="30days">30 يوم</option>
                <option value="month">هذا الشهر</option>
                <option value="custom">فترة مخصصة</option>
              </select>
              <input
                type="date"
                value={invDateFrom}
                onChange={(e) => { setInvDateFrom(e.target.value); setInvPeriodFilter('custom') }}
                className="px-2 py-1.5 text-xs border border-gray-200 rounded focus:border-blue-500 focus:outline-none"
              />
              <input
                type="date"
                value={invDateTo}
                onChange={(e) => { setInvDateTo(e.target.value); setInvPeriodFilter('custom') }}
                className="px-2 py-1.5 text-xs border border-gray-200 rounded focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Légende + compteur */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
              <div className="flex flex-wrap gap-3">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400 inline-block" /> مدفوع</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> مدفوع جزئياً</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> غير مدفوع</span>
              </div>
              <button
                type="button"
                onClick={() => { setInvStatusFilter('all'); setInvPeriodFilter('all'); setInvDateFrom(''); setInvDateTo('') }}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                إعادة التصفية
              </button>
            </div>

            {(() => {
              const today = new Date()
              const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
              const filtered = clientInvoices.filter(invoice => {
                const status = getInvoiceStatus(invoice)
                if (invStatusFilter !== 'all' && status !== invStatusFilter) return false

                const dateValue = toInputDateValue(invoice.invoice_date || invoice.created_at)
                const d = dateValue ? new Date(dateValue) : null
                if (invPeriodFilter !== 'all' && invPeriodFilter !== 'custom' && d) {
                  const diffDays = Math.floor((startOfToday.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
                  const isSameMonth = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()
                  if (invPeriodFilter === 'today' && diffDays !== 0) return false
                  if (invPeriodFilter === '7days' && (diffDays < 0 || diffDays > 7)) return false
                  if (invPeriodFilter === '30days' && (diffDays < 0 || diffDays > 30)) return false
                  if (invPeriodFilter === 'month' && !isSameMonth) return false
                }
                if (invDateFrom && dateValue && dateValue < invDateFrom) return false
                if (invDateTo && dateValue && dateValue > invDateTo) return false
                return true
              })

              if (clientInvoices.length === 0) {
                return <div className="text-center py-8 text-gray-500">لا توجد فواتير لهذا العميل</div>
              }
              if (filtered.length === 0) {
                return <div className="text-center py-8 text-gray-500">لا توجد فواتير مطابقة للتصفية</div>
              }

              return (
                <>
                  <p className="text-xs text-gray-500 mb-2">{filtered.length} فاتورة</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {filtered.map(invoice => {
                      const status = getInvoiceStatus(invoice)
                      const style = statusStyles[status]
                      const sortedPayments = [...(invoice.payments || [])].sort(
                        (a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime()
                      )
                      const lastPayment = sortedPayments[sortedPayments.length - 1]
                      return (
                        <div
                          key={invoice.id}
                          onClick={() => handleInvoiceClick(invoice)}
                          className={`border rounded-lg p-2 transition-shadow cursor-pointer hover:shadow-md ${style.border}`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-bold text-gray-800 text-xs truncate">#{invoice.invoice_number || invoice.id.slice(0, 8)}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${style.badge}`}>{style.label}</span>
                          </div>
                          <div className="text-[11px] text-gray-600 flex items-center gap-1 mb-1">
                            <Calendar size={11} />
                            {new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString('ar-DZ')}
                          </div>
                          <div className="grid grid-cols-2 gap-x-1 text-[11px] mb-1">
                            <span className="text-gray-500">المجموع</span>
                            <span className="text-left font-semibold text-gray-700">{(invoice.total_amount || 0).toFixed(2)}</span>
                            <span className="text-gray-500">المدفوع</span>
                            <span className="text-left font-semibold text-green-600">{(invoice.paid_amount || 0).toFixed(2)}</span>
                            <span className="text-gray-500">الباقي</span>
                            <span className={`text-left font-bold ${status === 'paid' ? 'text-green-600' : 'text-red-600'}`}>{Math.max(0, invoice.remaining).toFixed(2)}</span>
                          </div>
                          {lastPayment && (
                            <div className="text-[10px] text-blue-600 flex items-center gap-1 mb-1 truncate">
                              <CheckCircle size={10} />
                              آخر دفعة: {new Date(lastPayment.payment_date).toLocaleDateString('ar-DZ')}
                            </div>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); openInvoiceInPOS(invoice) }}
                            className="mt-1 flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-[10px] font-bold transition-colors w-full justify-center"
                            title="تعديل في الكايس"
                          >
                            <ShoppingCart size={11} />
                            تعديل في الكايس
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Modal d'enregistrement d'une dette (paiement réparti FIFO) */}
      {showPaymentModal && paymentClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={() => !isSubmittingPayment && setShowPaymentModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Wallet className="text-green-600" />
                تسجيل دفعة
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                disabled={isSubmittingPayment}
                className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-1">
              <p className="text-sm text-gray-600">العميل: <span className="font-bold text-gray-800">{paymentClient.client_name}</span></p>
              <p className="text-sm text-gray-600">إجمالي الدين المتبقي: <span className="font-bold text-red-600">{paymentClient.remaining.toFixed(2)} MAD</span></p>
              <p className="text-sm text-gray-600">عدد الفواتير غير المسددة: <span className="font-bold">{paymentClient.invoices_count}</span></p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-1">المبلغ المدفوع (MAD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                autoFocus
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !isSubmittingPayment) handleRecordPayment() }}
                placeholder="0.00"
                className="w-full p-3 border border-gray-300 rounded-lg text-lg font-bold focus:border-green-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                سيتم توزيع المبلغ على الفواتير الأقدم أولاً (الأقدم تُسدّد بالكامل قبل التالية).
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRecordPayment}
                disabled={isSubmittingPayment}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSubmittingPayment ? 'جاري الحفظ...' : (<><CheckCircle size={18} /> تأكيد الدفع</>)}
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                disabled={isSubmittingPayment}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-bold transition-colors disabled:opacity-60"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pour modifier le statut du chèque */}
      {showChequePaymentModal && selectedChequeInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowChequePaymentModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <FileText className="text-orange-600" />
                تحديث حالة الشيك
              </h3>
              <button
                onClick={() => setShowChequePaymentModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">فاتورة: <span className="font-bold">{selectedChequeInvoice.invoice_number}</span></p>
              <p className="text-sm text-gray-600 mb-2">المبلغ الإجمالي: <span className="font-bold">{selectedChequeInvoice.total_amount?.toFixed(2)} MAD</span></p>
              {selectedChequeInvoice.check_number && (
                <p className="text-sm text-gray-600 mb-2">رقم الشيك: <span className="font-bold">{selectedChequeInvoice.check_number}</span></p>
              )}
              {selectedChequeInvoice.check_date && (
                <p className="text-sm text-gray-600 mb-2">تاريخ الشيك: <span className="font-bold">{new Date(selectedChequeInvoice.check_date).toLocaleDateString('ar-DZ')}</span></p>
              )}
              {selectedChequeInvoice.check_deposit_date && (
                <p className="text-sm text-gray-600">تاريخ الإيداع: <span className="font-bold">{new Date(selectedChequeInvoice.check_deposit_date).toLocaleDateString('ar-DZ')}</span></p>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => updateChequeStatus(selectedChequeInvoice.id, 'paid', selectedChequeInvoice.total_amount)}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle size={18} />
                مدفوع بالكامل
              </button>
              
              <button
                onClick={() => {
                  const amount = prompt('أدخل المبلغ المدفوع:', selectedChequeInvoice.total_amount?.toString())
                  if (amount && !isNaN(Number(amount))) {
                    const paidAmount = Math.min(Number(amount), selectedChequeInvoice.total_amount || 0)
                    updateChequeStatus(selectedChequeInvoice.id, 'partial', paidAmount)
                  }
                }}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Clock size={18} />
                مدفوع جزئياً
              </button>
              
              <button
                onClick={() => updateChequeStatus(selectedChequeInvoice.id, 'unpaid', 0)}
                className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                <AlertCircle size={18} />
                غير مدفوع
              </button>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowChequePaymentModal(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-bold transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal historique des paiements */}
      {showPaymentHistory && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowPaymentHistory(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <CreditCard className="text-blue-600" />
                تاريخ الدفعات: فاتورة #{selectedInvoice.invoice_number || selectedInvoice.id.slice(0, 8)}
              </h3>
              <button
                onClick={() => setShowPaymentHistory(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {(() => {
              const total = Number(selectedInvoice.total_amount || 0)
              const isChequePaid = selectedInvoice.payment_method === 'check' || selectedInvoice.payment_method === 'cheque'
              const paid = isChequePaid ? total : Number(selectedInvoice.paid_amount || 0)
              const remaining = Math.max(0, total - paid)

              return (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">المجموع:</span>
                      <span className="font-bold mr-2">{total.toFixed(2)} MAD</span>
                    </div>
                    <div>
                      <span className="text-gray-600">المدفوع:</span>
                      <span className="font-bold text-green-600 mr-2">{paid.toFixed(2)} MAD</span>
                    </div>
                    <div>
                      <span className="text-gray-600">المتبقي:</span>
                      <span className="font-bold text-red-600 mr-2">{remaining.toFixed(2)} MAD</span>
                    </div>
                    <div>
                      <span className="text-gray-600">طريقة الدفع:</span>
                      <span className="mr-2">{getPaymentTypeDisplay(selectedInvoice.payment_method)}</span>
                    </div>
                  </div>
                </div>
              )
            })()}

            {selectedInvoice.payments && selectedInvoice.payments.length > 0 ? (
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-700 mb-3">عمليات الدفع المسجلة:</h4>
                {selectedInvoice.payments.map((payment, index) => (
                  <div key={payment.id} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">الدفعة #{index + 1}</span>
                          {getPaymentTypeDisplay(payment.payment_method)}
                        </div>
                        <p className="text-sm text-gray-600">
                          {new Date(payment.payment_date).toLocaleDateString('ar-DZ', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-lg text-green-600">
                          {payment.amount.toFixed(2)} MAD
                        </p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          payment.status === 'completed' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {payment.status === 'completed' ? 'مكتمل' : 'قيد المعالجة'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Clock size={48} className="mx-auto mb-3 text-gray-300" />
                <p>لا توجد عمليات دفع مسجلة لهذه الفاتورة</p>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowPaymentHistory(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-bold transition-colors"
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
