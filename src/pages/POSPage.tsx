import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useInputPad } from '../components/useInputPad'
import { getCategoryLabelArabic } from '../utils/categoryLabels'
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  X, 
  Trash2, 
  CreditCard, 
  DollarSign,
  FileText,
  Clock,
  Check,
  Printer,
  Receipt,
  ClipboardList,
  ArrowRight,
  Play,
  Trash
} from 'lucide-react'

interface CompanyInfo {
  company_name_ar: string
  company_name: string
  ice: string
  address_ar: string
  address: string
  phone: string
  email: string
}

interface Product {
  id: string
  primary_variant_id: string
  name_ar: string
  price_a: number
  price_b: number
  price_c: number
  price_d: number
  price_e: number
  stock: number
  barcode?: string
  category_id?: string
  image_url?: string
}

interface Category {
  id: string
  name_ar: string
  name_en?: string
}

interface CartItem {
  id: string
  primary_variant_id: string
  name_ar: string
  price_a: number
  price_b: number
  price_c: number
  price_d: number
  price_e: number
  stock: number
  quantity: number
  unit_type?: string
  quantity_contained?: number
  deleted?: boolean
  customPrice?: number
  is_gift?: boolean
  discount_percent?: number
  original_unit_price?: number
}

interface InvoiceLine {
  id: string
  product_id: string
  primary_variant_id: string
  product_name_ar: string
  quantity: number
  unit_price: number
  total: number
  unit_type?: string
  pricing_tier?: string
  customPrice?: number
  deleted?: boolean
  image_url?: string
  is_gift?: boolean
  discount_percent?: number
  original_unit_price?: number
}

interface PackagingVariant {
  id: string
  product_id: string
  primary_variant_id: string
  unit_type: string
  quantity_contained: number
  barcode?: string
  price_a: number
  price_b: number
  price_c: number
  price_d: number
  price_e: number
}

interface Invoice {
  id: string
  invoice_number: string
  client_id: string | null
  client_name: string
  status: 'draft' | 'on_hold' | 'paid' | 'partial' | 'credit'
  lines: InvoiceLine[]
  subtotal: number
  total_amount: number
  discount_percent?: number
  discount_amount?: number
  paid_amount: number
  remaining_amount: number
  created_at: string
  validated_at?: string
  enable_tva?: boolean
  tva_rate?: number
  total_with_tva?: number
  tva_amount?: number
  payment_method?: string
}

interface Draft {
  id: string
  client_id: string | null
  client_name: string | null
  items: CartItem[]
  total: number
  created_at: string
}

interface Employee {
  id: string
  name: string
  status: 'active' | 'inactive'
}

interface Warehouse {
  id: string
  name: string
}

interface CashSession {
  id: string
  employee_id: string
  warehouse_id: string
  opening_cash: number
  opened_at: string
  closed_at: string | null
  closing_cash_declared: number | null
  closing_note: string | null
}

 type POSPageMode = 'admin' | 'employee'

 interface POSPageProps {
   mode?: POSPageMode
 }

export default function POSPage({ mode = 'admin' }: POSPageProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isEmployeeMode = mode === 'employee'
  const employeeIdFromAuth = isEmployeeMode ? localStorage.getItem('employee_id') : null
  const employeeNameFromAuth = isEmployeeMode ? localStorage.getItem('employee_name') : null

  const inputPad = useInputPad()

  const CASH_SESSION_KEY = isEmployeeMode ? 'employee_pos_cash_session_id' : 'pos_cash_session_id'
  const EMPLOYEE_KEY = isEmployeeMode ? 'employee_pos_employee_id' : 'pos_employee_id'
  const WAREHOUSE_KEY = isEmployeeMode ? 'employee_pos_warehouse_id' : 'pos_warehouse_id'

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [clients, setClients] = useState<any[]>([])
  const [showClientModal, setShowClientModal] = useState(false)
  const [showAddClientModal, setShowAddClientModal] = useState(false)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showPrintTypeModal, setShowPrintTypeModal] = useState(false)
  const [confirmedInvoice, setConfirmedInvoice] = useState<Invoice | null>(null)
  const [printTicket, setPrintTicket] = useState(true)
  const [printFormat, setPrintFormat] = useState<'ticket' | 'a4'>('ticket')
  const [enableTVA, setEnableTVA] = useState(false)
  const [tvaRate, setTvaRate] = useState<7 | 10 | 20>(20)
  const [clientFormData, setClientFormData] = useState({
    company_name_ar: '',
    company_name_en: '',
    contact_person_name: '',
    contact_person_email: '',
    contact_person_phone: '',
    address: '',
    subscription_tier: 'E',
  })
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'partial' | 'credit'>('paid')
  const [paidAmount, setPaidAmount] = useState(0)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [showDraftsModal, setShowDraftsModal] = useState(false)
  const [showEditItemModal, setShowEditItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<CartItem | null>(null)
  const [editQuantity, setEditQuantity] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [showEditInvoiceLineModal, setShowEditInvoiceLineModal] = useState(false)
  const [editingInvoiceLine, setEditingInvoiceLine] = useState<InvoiceLine | null>(null)
  const [editLineQuantity, setEditLineQuantity] = useState('')
  const [editLinePrice, setEditLinePrice] = useState('')
  const [editLineUnitType, setEditLineUnitType] = useState('unit')
  const [editLinePricingTier, setEditLinePricingTier] = useState<'auto' | 'A' | 'B' | 'C' | 'D' | 'E'>('auto')

  const [packagingVariantsByPrimaryId, setPackagingVariantsByPrimaryId] = useState<Record<string, PackagingVariant[]>>({})
  const [packagingVariantsFlat, setPackagingVariantsFlat] = useState<PackagingVariant[]>([])
  
  // États pour popup type de paiement
  const [showPaymentTypeModal, setShowPaymentTypeModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'check' | 'debt'>('cash')
  const [paymentDetails, setPaymentDetails] = useState({
    bank_name_ar: '',
    check_number: '',
    check_date: '',
    debt_due_date: ''
  })
  
  // Nouvelle facture en cours
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [onHoldInvoices, setOnHoldInvoices] = useState<Invoice[]>([])
  
  // Informations de l'entreprise pour les factures
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    company_name_ar: '',
    company_name: '',
    ice: '',
    address_ar: '',
    address: '',
    phone: '',
    email: ''
  })

  const [employees, setEmployees] = useState<Employee[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])

  const [cashSession, setCashSession] = useState<CashSession | null>(null)
  const [cashSessionSummary, setCashSessionSummary] = useState({
    totalSales: 0,
    totalCash: 0,
    totalCard: 0,
    totalTransfer: 0,
    totalCredit: 0,
    expectedCash: 0,
  })

  const [showSessionDashboard, setShowSessionDashboard] = useState(false)

  const [showOpenCashModal, setShowOpenCashModal] = useState(false)
  const [openEmployeeId, setOpenEmployeeId] = useState('')
  const [openWarehouseId, setOpenWarehouseId] = useState('')
  const [openingCashInput, setOpeningCashInput] = useState('')

  const [showCloseCashModal, setShowCloseCashModal] = useState(false)
  const [closingCashInput, setClosingCashInput] = useState('')
  const [closingNoteInput, setClosingNoteInput] = useState('')

  const searchInputRef = useRef<HTMLInputElement>(null)
  const invoicePanelRef = useRef<HTMLDivElement>(null)

  const focusSearchInput = () => {
    requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
  }

  const focusInvoicePanel = () => {
    requestAnimationFrame(() => {
      if (invoicePanelRef.current) {
        invoicePanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        invoicePanelRef.current.focus()
      }
    })
  }

  useEffect(() => {
    // Désactivé temporairement car on utilise virtual_accounts IDs comme fallback
    // Nettoyer les anciennes données potentiellement corrompues en mode employé
    // if (isEmployeeMode) {
    //   const storedEmployeeId = localStorage.getItem('employee_id')
    //   if (storedEmployeeId && storedEmployeeId.startsWith('682df66a')) {
    //     console.log('Cleaning corrupted employee data from localStorage')
    //     localStorage.removeItem('employee_id')
    //     localStorage.removeItem('employee_name')
    //     localStorage.removeItem('employee_role')
    //     localStorage.removeItem('employee_phone')
    //     localStorage.removeItem('virtual_account_id')
    //     navigate('/login')
    //     return
    //   }
    // }

    if (isEmployeeMode) {
      if (!employeeIdFromAuth) {
        navigate('/login')
        return
      }
      setOpenEmployeeId(employeeIdFromAuth)
    }

    loadProducts()
    loadCategories()
    loadClients()
    loadOnHoldInvoices()
    if (!isEmployeeMode) {
      loadEmployees()
    }
    loadWarehouses()
    loadActiveCashSessionFromStorage()
    
    // Charger les informations de l'entreprise depuis localStorage
    const savedCompanyInfo = localStorage.getItem('companyInfo')
    if (savedCompanyInfo) {
      try {
        const info = JSON.parse(savedCompanyInfo)
        setCompanyInfo(info)
      } catch (error) {
        console.error('Error loading company info:', error)
      }
    }
  }, [])

  useEffect(() => {
    if (!isEmployeeMode) return
    const addClient = searchParams.get('addClient')
    if (addClient === '1' || addClient === 'true') {
      setShowClientModal(false)
      setShowAddClientModal(true)
    }
  }, [isEmployeeMode, searchParams])

  useEffect(() => {
    if (cashSession?.id) {
      refreshCashSessionSummary(cashSession.id)
    }
  }, [cashSession?.id])

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, status')
        .eq('status', 'active')
        .order('name')

      if (error) throw error
      setEmployees((data || []) as Employee[])
    } catch (error) {
      console.error('Error loading employees:', error)
    }
  }

  const loadWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setWarehouses((data || []) as Warehouse[])
    } catch (error) {
      console.error('Error loading warehouses:', error)
    }
  }

  const loadActiveCashSessionFromStorage = async () => {
    try {
      const savedSessionId = localStorage.getItem(CASH_SESSION_KEY)
      const savedEmployeeId = isEmployeeMode ? employeeIdFromAuth : localStorage.getItem(EMPLOYEE_KEY)
      const savedWarehouseId = localStorage.getItem(WAREHOUSE_KEY)

      if (!savedSessionId || !savedEmployeeId || !savedWarehouseId) {
        // Check if there's any open session for this employee
        await checkForOpenSession()
        return
      }

      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('id', savedSessionId)
        .maybeSingle()

      if (error) throw error

      if (!data || data.closed_at) {
        localStorage.removeItem(CASH_SESSION_KEY)
        localStorage.removeItem(EMPLOYEE_KEY)
        localStorage.removeItem(WAREHOUSE_KEY)
        // Check if there's any open session for this employee
        await checkForOpenSession()
        return
      }

      setCashSession(data as CashSession)
    } catch (error) {
      console.error('Error loading cash session:', error)
      // Check if there's any open session for this employee
      await checkForOpenSession()
    }
  }

  useEffect(() => {
    focusSearchInput()
  }, [])

  const checkForOpenSession = async () => {
    try {
      // In employee mode, only show sessions for the connected employee
      const baseQuery = supabase
        .from('cash_sessions')
        .select(`
          *,
          employees!cash_sessions_employee_id_fkey (
            id,
            name
          ),
          warehouses!cash_sessions_warehouse_id_fkey (
            id,
            name
          )
        `)
        .is('closed_at', null)

      const { data: openSessions, error: sessionsError } = await (isEmployeeMode && employeeIdFromAuth
        ? baseQuery.eq('employee_id', employeeIdFromAuth).order('opened_at', { ascending: false })
        : baseQuery.order('opened_at', { ascending: false }))

      if (sessionsError) throw sessionsError

      if (openSessions && openSessions.length > 0) {
        if (isEmployeeMode) {
          const latestSession = openSessions[0]
          localStorage.setItem(CASH_SESSION_KEY, latestSession.id)
          localStorage.setItem(EMPLOYEE_KEY, latestSession.employee_id)
          localStorage.setItem(WAREHOUSE_KEY, latestSession.warehouse_id)
          setCashSession(latestSession as CashSession)
          return
        }

        // Show existing open sessions
        const sessionList = openSessions.map(session => 
          `• ${session.employees?.name || 'غير معروف'} - ${session.warehouses?.name || 'غير معروف'} (مفتوح: ${new Date(session.opened_at).toLocaleTimeString('ar-MA')})`
        ).join('\n')
        
        const result = confirm(
          '📋 توجد جلسات نقدية مفتوحة:\n\n' + sessionList + '\n\n' +
          'هل تريد استخدام أحدث جلسة؟\n\n' +
          'اضغط "موافق" لاستخدام أحدث جلسة\n' +
          'اضغط "إلغاء" لفتح جلسة جديدة'
        )

        if (result) {
          // Use the most recent open session
          const latestSession = openSessions[0]
          localStorage.setItem(CASH_SESSION_KEY, latestSession.id)
          localStorage.setItem(EMPLOYEE_KEY, latestSession.employee_id)
          localStorage.setItem(WAREHOUSE_KEY, latestSession.warehouse_id)

          setCashSession(latestSession as CashSession)
          return
        }
      }

      // No open sessions or user chose to create new one
      setShowOpenCashModal(true)
    } catch (error) {
      console.error('Error checking for open sessions:', error)
      setShowOpenCashModal(true)
    }
  }

  const refreshCashSessionSummary = async (sessionId: string) => {
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('cash_sessions')
        .select('opening_cash')
        .eq('id', sessionId)
        .single()

      if (sessionError) throw sessionError

      const openingCash = Number(sessionData?.opening_cash || 0)

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('amount, payment_method, status')
        .eq('cash_session_id', sessionId)
        .eq('status', 'completed')

      if (paymentsError) throw paymentsError

      const totalCash = (paymentsData || [])
        .filter((p: any) => p.payment_method === 'cash')
        .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)

      const totalCard = (paymentsData || [])
        .filter((p: any) => p.payment_method === 'card')
        .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)

      const totalTransfer = (paymentsData || [])
        .filter((p: any) => p.payment_method === 'bank_transfer')
        .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)

      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('total_amount, amount_paid, paid_amount')
        .eq('cash_session_id', sessionId)

      if (invoicesError) throw invoicesError

      const totalSales = (invoicesData || []).reduce((sum: number, inv: any) => sum + Number(inv.total_amount || 0), 0)
      const totalPaid = (invoicesData || []).reduce((sum: number, inv: any) => sum + Number(inv.amount_paid ?? inv.paid_amount ?? 0), 0)
      const totalCredit = Math.max(0, totalSales - totalPaid)

      const expectedCash = openingCash + totalCash

      setCashSessionSummary({
        totalSales,
        totalCash,
        totalCard,
        totalTransfer,
        totalCredit,
        expectedCash,
      })
    } catch (error) {
      console.error('Error loading cash session summary:', error)
    }
  }

  const handleOpenCashSession = async () => {
    const effectiveEmployeeId = isEmployeeMode ? employeeIdFromAuth : openEmployeeId

    if (isEmployeeMode && employeeIdFromAuth && openEmployeeId !== employeeIdFromAuth) {
      setOpenEmployeeId(employeeIdFromAuth)
    }

    if (!effectiveEmployeeId || !openWarehouseId) {
      alert('❌ يرجى اختيار اسم الموظف و المخزن')
      return
    }

    const openingCash = Number(openingCashInput || 0)
    if (Number.isNaN(openingCash) || openingCash < 0) {
      alert('❌ مبلغ غير صالح')
      return
    }

    try {
      // Validate that employee exists (employees table ou virtual_accounts comme fallback)
      console.log('Validating employee ID:', effectiveEmployeeId, 'Mode:', isEmployeeMode ? 'employee' : 'admin')
      
      let employeeData = null
      let employeeError = null
      let actualEmployeeId = effectiveEmployeeId // Variable mutable
      
      // D'abord essayer dans la table employees
      const result = await supabase
        .from('employees')
        .select('id')
        .eq('id', effectiveEmployeeId)
        .single()
      employeeData = result.data
      employeeError = result.error
      
      // Si pas trouvé dans employees, essayer virtual_accounts (fallback)
      if (employeeError && isEmployeeMode) {
        console.log('Not found in employees, checking virtual_accounts...')
        const vaResult = await supabase
          .from('virtual_accounts')
          .select('id, employee_id')
          .eq('id', effectiveEmployeeId)
          .eq('is_active', true)
          .single()
        
        if (!vaResult.error && vaResult.data) {
          console.log('Found in virtual_accounts, using as valid employee')
          employeeData = vaResult.data
          employeeError = null
          
          // Utiliser le vrai employee_id pour la création de session
          if (vaResult.data.employee_id) {
            actualEmployeeId = vaResult.data.employee_id
            console.log('Using real employee_id for cash session:', actualEmployeeId)
          }
        }
      }

      console.log('Employee validation result:', { data: employeeData, error: employeeError })

      if (employeeError || !employeeData) {
        console.log('Employee not found, cleaning localStorage and redirecting...')
        alert('❌ بيانات الموظف غير صحيحة. سيتم إعادة توجيهك لصفحة تسجيل الدخول.')
        
        // Nettoyer complètement le localStorage
        localStorage.removeItem('employee_id')
        localStorage.removeItem('employee_name')
        localStorage.removeItem('employee_role')
        localStorage.removeItem('employee_phone')
        localStorage.removeItem('virtual_account_id')
        
        // Rediriger vers la page de login principale
        window.location.href = '/login'
        return
      }

      // First check if employee already has an open session
      const { data: existingSession, error: checkError } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('employee_id', actualEmployeeId)
        .eq('warehouse_id', openWarehouseId)
        .is('closed_at', null)
        .maybeSingle()

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError
      }

      if (existingSession) {
        // Employee already has an open session, use it
        localStorage.setItem(EMPLOYEE_KEY, effectiveEmployeeId)
        localStorage.setItem(WAREHOUSE_KEY, openWarehouseId)

        setCashSession(existingSession as CashSession)
        setShowOpenCashModal(false)
        setOpeningCashInput('')
        if (!isEmployeeMode) {
          setOpenEmployeeId('')
        }
        setOpenWarehouseId('')
        
        alert('✅ تم العثور على جلسة نقدية مفتوحة')
        return
      }

      // Create new session
      const { data, error } = await supabase
        .from('cash_sessions')
        .insert({
          employee_id: actualEmployeeId,
          warehouse_id: openWarehouseId,
          opening_cash: openingCash,
          opened_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      localStorage.setItem(CASH_SESSION_KEY, data.id)
      localStorage.setItem(EMPLOYEE_KEY, effectiveEmployeeId)
      localStorage.setItem(WAREHOUSE_KEY, openWarehouseId)

      setCashSession(data as CashSession)
      setShowOpenCashModal(false)
      setOpeningCashInput('')
      if (!isEmployeeMode) {
        setOpenEmployeeId('')
      }
      setOpenWarehouseId('')
    } catch (error: any) {
      console.error('Error opening cash session:', error)
      if (error?.code === '23505') {
        alert('❌ هذا الموظف لديه جلسة مفتوحة بالفعل')
        return
      }
      alert('❌ حدث خطأ: ' + (error?.message || 'خطأ غير معروف'))
    }
  }

  const handleCloseCashSession = async () => {
    if (!cashSession) return

    const declaredCash = Number(closingCashInput || 0)
    if (Number.isNaN(declaredCash) || declaredCash < 0) {
      alert('❌ مبلغ غير صالح')
      return
    }

    const difference = declaredCash - cashSessionSummary.expectedCash
    if (difference !== 0 && !closingNoteInput.trim()) {
      alert('❌ يجب إضافة ملاحظة إذا كان هناك فرق')
      return
    }

    try {
      const { error: closeError } = await supabase
        .from('cash_sessions')
        .update({
          closed_at: new Date().toISOString(),
          closing_cash_declared: declaredCash,
          closing_note: closingNoteInput.trim() || null,
        })
        .eq('id', cashSession.id)

      if (closeError) throw closeError

      const { error: reportError } = await supabase
        .from('cash_session_reports')
        .insert({
          session_id: cashSession.id,
          total_sales: cashSessionSummary.totalSales,
          total_cash: cashSessionSummary.totalCash,
          total_card: cashSessionSummary.totalCard,
          total_transfer: cashSessionSummary.totalTransfer,
          total_credit: cashSessionSummary.totalCredit,
          expected_cash: cashSessionSummary.expectedCash,
          declared_cash: declaredCash,
          difference,
        })

      if (reportError) throw reportError

      localStorage.removeItem(CASH_SESSION_KEY)
      localStorage.removeItem(EMPLOYEE_KEY)
      localStorage.removeItem(WAREHOUSE_KEY)

      setCashSession(null)
      setShowCloseCashModal(false)
      setClosingCashInput('')
      setClosingNoteInput('')
      setShowOpenCashModal(true)
    } catch (error) {
      console.error('Error closing cash session:', error)
      alert('❌ حدث خطأ')
    }
  }

  const loadProducts = async () => {
    try {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name_ar, sku, category_id, image_url')
        .eq('is_active', true)
        .order('name_ar')

      if (productsError) throw productsError

      const productIds = (products || []).map(p => p.id)
      if (productIds.length === 0) {
        setProducts([])
        setPackagingVariantsByPrimaryId({})
        setPackagingVariantsFlat([])
        return
      }

      const { data: primaryVariants, error: primaryError } = await supabase
        .from('product_primary_variants')
        .select('id, product_id, variant_name, barcode, price_a, price_b, price_c, price_d, price_e, is_active')
        .eq('is_active', true)
        .in('product_id', productIds)

      if (primaryError) throw primaryError

      // No secondary variants loaded - POS will only show primary variants
      setPackagingVariantsByPrimaryId({})
      setPackagingVariantsFlat([])

      const warehouseId = cashSession?.warehouse_id
      let stockQuery = supabase
        .from('stock')
        .select('product_id, primary_variant_id, quantity_in_stock')
        .in('product_id', productIds)

      if (warehouseId) {
        stockQuery = stockQuery.eq('warehouse_id', warehouseId)
      }

      const { data: stockRows, error: stockError } = await stockQuery
      if (stockError) {
        console.warn('Error loading stock for POS (will default to 0):', stockError)
      }

      const stockMap = new Map<string, number>()
      ;(stockRows || []).forEach((row: any) => {
        const key = `${row.product_id}:${row.primary_variant_id}`
        const qty = Number(row.quantity_in_stock || 0) || 0
        stockMap.set(key, (stockMap.get(key) || 0) + qty)
      })

      const productsById = new Map<string, any>()
      ;(products || []).forEach(p => productsById.set(p.id, p))

      const dedupedPrimaryVariants = Array.from(
        new Map(
          (primaryVariants || []).map((pv: any) => {
            const normalizedVariant = String(pv.variant_name || '').trim().toLowerCase()
            const normalizedBarcode = String(pv.barcode || '').trim()
            return [`${String(pv.product_id)}:${normalizedVariant}:${normalizedBarcode}`, pv]
          })
        ).values()
      )

      const enrichedProducts: Product[] = dedupedPrimaryVariants.map((pv: any) => {
        const base = productsById.get(pv.product_id)
        const suffix = pv.variant_name && pv.variant_name !== 'افتراضي' ? ` - ${pv.variant_name}` : ''
        const name = `${base?.name_ar || ''}${suffix}`
        const stockKey = `${pv.product_id}:${pv.id}`
        return {
          id: pv.product_id,
          primary_variant_id: pv.id,
          name_ar: name,
          price_a: Number(pv.price_a || 0),
          price_b: Number(pv.price_b || 0),
          price_c: Number(pv.price_c || 0),
          price_d: Number(pv.price_d || 0),
          price_e: Number(pv.price_e || 0),
          stock: Math.max(0, Number(stockMap.get(stockKey) || 0)),
          barcode: pv.barcode || undefined,
          category_id: base?.category_id,
          image_url: base?.image_url,
        }
      })

      setProducts(enrichedProducts)
    } catch (error) {
      console.error('Error loading products:', error)
      setProducts([])
    }
  }

  const loadCategories = async () => {
    try {
      let data: any[] | null = null
      let error: any = null

      const attempt = await supabase
        .from('product_categories')
        .select('id, name_ar')
        .eq('is_active', true)
        .order('name_ar')

      data = attempt.data as any[]
      error = attempt.error

      if (error) {
        const msg = String((error as any)?.message || '')
        const code = String((error as any)?.code || '')
        const missingIsActive = code === '42703' || msg.toLowerCase().includes('is_active')
        if (!missingIsActive) throw error

        const fallback = await supabase
          .from('product_categories')
          .select('id, name_ar')
          .order('name_ar')

        data = fallback.data as any[]
        error = fallback.error
      }

      if (error) throw error
      setCategories((data || []) as Category[])
    } catch (error) {
      console.error('Error loading categories:', error)
      setCategories([])
    }
  }

  const loadClients = async () => {
    try {
      console.log('🔍 Chargement des clients...')
      const { data, error } = await supabase
        .from('clients')
        .select('*')

      console.log('📊 Réponse clients:', { data, error })
      
      if (error) {
        console.warn('❌ Error loading clients:', error)
      } else {
        console.log(`✅ ${data?.length || 0} clients chargés`)
        console.log('📋 Structure du premier client:', JSON.stringify(data?.[0], null, 2))
        setClients(data || [])
      }
    } catch (error) {
      console.error('❌ Exception loading clients:', error)
      // Set empty clients array to prevent crashes
      setClients([])
    }
  }

  const handleSelectClient = (client: any) => {
    setSelectedClient(client)

    // Si une facture est déjà en cours, synchroniser le client dessus
    setCurrentInvoice((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        client_id: client.id,
        client_name: client.company_name_ar || client.company_name_en || client.name || 'زبون'
      }
    })

    setShowClientModal(false)
  }

  const loadOnHoldInvoices = async () => {
    try {
      console.log('🔍 Chargement des factures en attente...')
      const baseQuery = supabase
        .from('invoices')
        .select('*')

      const { data, error } = await (isEmployeeMode && employeeIdFromAuth
        ? baseQuery.eq('employee_id', employeeIdFromAuth).order('created_at', { ascending: false }).limit(10)
        : baseQuery.order('created_at', { ascending: false }).limit(10)) // Limit to recent invoices

      if (error) {
        console.error('Error loading on hold invoices:', error)
        return
      }
      
      // Convert items from JSON to InvoiceLine format
      const processedData = (data || []).map(invoice => ({
        ...invoice,
        lines: (invoice.items || []).map((item: any, index: number) => ({
          id: `line-${index}-${Date.now()}`,
          product_id: item.product_id,
          primary_variant_id: item.primary_variant_id || '',
          product_name_ar: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          unit_type: item.unit_type || 'unit',
          pricing_tier: item.pricing_tier || undefined,
          deleted: false,
          image_url: undefined
        }))
      }))
      
      console.log('📋 Factures en attente récupérées:', processedData?.length || 0)
      console.log('📦 Détails produits:', processedData.map(inv => ({
        id: inv.id,
        client: inv.client_name,
        items: inv.items?.length || 0,
        lines: inv.lines?.length || 0,
        total: inv.total_amount
      })))
      
      setOnHoldInvoices(processedData)
    } catch (error) {
      console.error('❌ Exception loading on hold invoices:', error)
      setOnHoldInvoices([])
    }
  }

  const handleBarcodeSearch = () => {
    if (!searchQuery.trim()) return

    const normalizedSearch = searchQuery.trim().replace(/[\s-]/g, '') // Remove spaces and dashes
    console.log('🔍 Recherche pour:', searchQuery.trim(), '→ normalisé:', normalizedSearch)
    console.log('📦 Produits disponibles:', products.map(p => ({
      name: p.name_ar,
      barcode: p.barcode,
      hasBarcode: !!p.barcode
    })))
    
    const exactPrimaryBarcodeMatch = products.find(p => {
      if (!p.barcode) return false
      const normalizedBarcode = p.barcode.replace(/[\s-]/g, '')
      return normalizedBarcode === normalizedSearch
    })

    const exactPackagingBarcodeMatch = packagingVariantsFlat.find(v => {
      if (!v.barcode) return false
      const normalizedBarcode = String(v.barcode).replace(/[\s-]/g, '')
      return normalizedBarcode === normalizedSearch
    })
    console.log('🎯 Exact barcode match:', exactPrimaryBarcodeMatch?.name_ar)

    if (exactPrimaryBarcodeMatch) {
      addToInvoice(exactPrimaryBarcodeMatch, { unitType: 'unit' })
      setSearchQuery('')
      focusSearchInput()
      return
    }

    if (exactPackagingBarcodeMatch) {
      const p = products.find(x => x.primary_variant_id === exactPackagingBarcodeMatch.primary_variant_id)
      if (p) {
        addToInvoice(p, { unitType: exactPackagingBarcodeMatch.unit_type })
        setSearchQuery('')
        focusSearchInput()
        return
      }
    }

    // If no exact match, search for partial barcode match (normalized)
    const partialPrimaryBarcodeMatch = products.find(p => {
      if (!p.barcode) return false
      const normalizedBarcode = p.barcode.replace(/[\s-]/g, '')
      return normalizedBarcode.includes(normalizedSearch) || normalizedSearch.includes(normalizedBarcode)
    })
    console.log('🔍 Partial barcode match:', partialPrimaryBarcodeMatch?.name_ar)

    const partialPackagingBarcodeMatch = packagingVariantsFlat.find(v => {
      if (!v.barcode) return false
      const normalizedBarcode = String(v.barcode).replace(/[\s-]/g, '')
      return normalizedBarcode.includes(normalizedSearch) || normalizedSearch.includes(normalizedBarcode)
    })

    if (partialPrimaryBarcodeMatch) {
      addToInvoice(partialPrimaryBarcodeMatch, { unitType: 'unit' })
      setSearchQuery('') // Clear search after adding
      focusSearchInput()
      return
    }

    if (partialPackagingBarcodeMatch) {
      const p = products.find(x => x.primary_variant_id === partialPackagingBarcodeMatch.primary_variant_id)
      if (p) {
        addToInvoice(p, { unitType: partialPackagingBarcodeMatch.unit_type })
        setSearchQuery('')
        focusSearchInput()
        return
      }
    }
    
    // If no barcode match, search by name (case-insensitive)
    const nameMatch = products.find(p => 
      p.name_ar?.toLowerCase() === searchQuery.trim().toLowerCase()
    )
    console.log('📝 Name match:', nameMatch?.name_ar)
    
    if (nameMatch) {
      addToInvoice(nameMatch)
      setSearchQuery('') // Clear search after adding
      focusSearchInput()
      return
    }
    
    // If only one product matches the search query, add it
    const matchingProducts = products.filter(p => {
      const nameMatch = p.name_ar?.toLowerCase().includes(searchQuery.toLowerCase())
      const barcodeMatch = p.barcode ? p.barcode.replace(/[\s-]/g, '').includes(normalizedSearch) : false
      return nameMatch || barcodeMatch
    })
    console.log('📋 Matching products count:', matchingProducts.length)
    
    if (matchingProducts.length === 1) {
      addToInvoice(matchingProducts[0])
      setSearchQuery('') // Clear search after adding
      focusSearchInput()
      return
    }
    
    // If multiple matches or no match, keep search query for manual selection
    console.log('🔍 Multiple matches or no match found, showing results for manual selection')
    focusSearchInput()
  }

  const filteredProducts = products.filter(p =>
    p.name_ar?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode?.includes(searchQuery)
  ).filter(p => {
    if (selectedCategory === 'no-category') {
      // Show only products without categories
      return !p.category_id || p.category_id === ''
    }
    if (selectedCategory && p.category_id !== selectedCategory) return false
    return true
  })

  useEffect(() => {
    if (!searchQuery.trim()) return

    const normalizedSearch = searchQuery.trim().replace(/[\s-]/g, '')

    const exactPrimaryBarcodeMatch = products.find(p => {
      if (!p.barcode) return false
      const normalizedBarcode = p.barcode.replace(/[\s-]/g, '')
      return normalizedBarcode === normalizedSearch
    })

    if (exactPrimaryBarcodeMatch) {
      addToInvoice(exactPrimaryBarcodeMatch, { unitType: 'unit' })
      setSearchQuery('')
      focusSearchInput()
      return
    }

    const exactPackagingBarcodeMatch = packagingVariantsFlat.find(v => {
      if (!v.barcode) return false
      const normalizedBarcode = String(v.barcode).replace(/[\s-]/g, '')
      return normalizedBarcode === normalizedSearch
    })

    if (exactPackagingBarcodeMatch) {
      const p = products.find(x => x.primary_variant_id === exactPackagingBarcodeMatch.primary_variant_id)
      if (p) {
        addToInvoice(p, { unitType: exactPackagingBarcodeMatch.unit_type })
        setSearchQuery('')
        focusSearchInput()
        return
      }
    }

    if (filteredProducts.length === 1) {
      addToInvoice(filteredProducts[0])
      setSearchQuery('')
      focusSearchInput()
    }
  }, [searchQuery, products, filteredProducts.length])

  const getProductPrice = (item: Product | CartItem) => {
    // Si c'est un CartItem et a un prix personnalisé, l'utiliser
    if ('customPrice' in item && item.customPrice) {
      return item.customPrice
    }

    // Helper: obtenir le premier prix non nul parmi les tiers
    const getFirstNonZeroPrice = (prices: number[]) => {
      for (const price of prices) {
        if (price && price > 0) return price
      }
      return null
    }

    // Si aucun client n'est sélectionné, utiliser price_e (ou fallback)
    if (!selectedClient) {
      console.log('🔴 Aucun client sélectionné, prix E:', item.price_e, 'fallback prix A:', item.price_a)
      const fallback = getFirstNonZeroPrice([item.price_e, item.price_a, item.price_b, item.price_c, item.price_d])
      if (fallback) {
        console.log('✅ Fallback trouvé:', fallback)
        return fallback
      }
      console.log('⚠️ Tous les prix sont à 0, prix par défaut: 10.00')
      return 10.00 // Prix par défaut si tout est à 0
    }
    
    // Déterminer le prix selon la catégorie du client
    const clientCategory = selectedClient.subscription_tier || selectedClient.subscription_tier_old
    console.log('🔍 Catégorie client:', {
      selectedClient: selectedClient.id,
      subscription_tier: selectedClient.subscription_tier,
      subscription_tier_old: selectedClient.subscription_tier_old,
      clientCategory: clientCategory,
      type: typeof clientCategory
    })
    
    if (!clientCategory) {
      console.log('🔴 Pas de catégorie, prix E:', item.price_e, 'fallback prix A:', item.price_a)
      const fallback = getFirstNonZeroPrice([item.price_e, item.price_a, item.price_b, item.price_c, item.price_d])
      if (fallback) {
        console.log('✅ Fallback trouvé:', fallback)
        return fallback
      }
      console.log('⚠️ Tous les prix sont à 0, prix par défaut: 10.00')
      return 10.00
    }
    
    // Les catégories sont : A, B, C, D, E, basic
    let price = 0
    switch (clientCategory) {
      case 'A':
        price = getFirstNonZeroPrice([item.price_a, item.price_b, item.price_c, item.price_d, item.price_e]) || 10.00
        console.log('✅ Catégorie A, prix:', price)
        break
      case 'B':
        price = getFirstNonZeroPrice([item.price_b, item.price_a, item.price_c, item.price_d, item.price_e]) || 10.00
        console.log('✅ Catégorie B, prix:', price)
        break
      case 'C':
        price = getFirstNonZeroPrice([item.price_c, item.price_a, item.price_b, item.price_d, item.price_e]) || 10.00
        console.log('✅ Catégorie C, prix:', price)
        break
      case 'D':
        price = getFirstNonZeroPrice([item.price_d, item.price_a, item.price_b, item.price_c, item.price_e]) || 10.00
        console.log('✅ Catégorie D, prix:', price)
        break
      case 'E':
        price = getFirstNonZeroPrice([item.price_e, item.price_a, item.price_b, item.price_c, item.price_d]) || 10.00
        console.log('✅ Catégorie E, prix:', price)
        break
      case 'basic':
        price = getFirstNonZeroPrice([item.price_a, item.price_b, item.price_c, item.price_d, item.price_e]) || 10.00
        console.log('✅ Catégorie basic, prix:', price)
        break
      default:
        console.log('⚠️ Catégorie inconnue:', clientCategory, ', prix E par défaut:', item.price_e, 'fallback prix A:', item.price_a)
        price = getFirstNonZeroPrice([item.price_e, item.price_a, item.price_b, item.price_c, item.price_d]) || 10.00
    }
    
    return price
  }

  const getPricingForPrimaryAndUnitType = (primaryVariantId: string, unitType: string) => {
    const vs = packagingVariantsByPrimaryId[primaryVariantId] || []
    const match = vs.find(v => v.unit_type === unitType)
    if (match) {
      const hasAny = [match.price_a, match.price_b, match.price_c, match.price_d, match.price_e].some(
        x => Number(x || 0) > 0
      )
      if (hasAny) {
        return match
      }
    }

    const base = products.find(p => p.primary_variant_id === primaryVariantId)
    return {
      price_a: base?.price_a || 0,
      price_b: base?.price_b || 0,
      price_c: base?.price_c || 0,
      price_d: base?.price_d || 0,
      price_e: base?.price_e || 0,
    }
  }

  const getAvailableUnitTypes = (primaryVariantId: string) => {
    const types = Array.from(
      new Set((packagingVariantsByPrimaryId[primaryVariantId] || []).map(v => v.unit_type))
    )
    return (types.length ? types : ['unit']).includes('unit')
      ? (types.length ? types : ['unit'])
      : ['unit', ...types]
  }

  const getProductPriceForTier = (item: Product | CartItem, tier: 'A' | 'B' | 'C' | 'D' | 'E') => {
    const getFirstNonZeroPrice = (prices: number[]) => {
      for (const price of prices) {
        if (price && price > 0) return price
      }
      return null
    }

    const prices = {
      A: item.price_a,
      B: item.price_b,
      C: item.price_c,
      D: item.price_d,
      E: item.price_e,
    }

    const primary = Number(prices[tier] || 0)
    if (primary > 0) return primary
    return getFirstNonZeroPrice([item.price_e, item.price_a, item.price_b, item.price_c, item.price_d]) || 10.0
  }

  const getProductPriceWithTierOverride = (
    item: Product | CartItem,
    tier: 'auto' | 'A' | 'B' | 'C' | 'D' | 'E'
  ) => {
    if (tier === 'auto') return getProductPrice(item)
    return getProductPriceForTier(item, tier)
  }

  const clampPercent = (value: number) => Math.min(100, Math.max(0, value || 0))

  const calculateLineTotal = (line: InvoiceLine) => {
    if (line.deleted) return 0
    if (line.is_gift) return 0
    const discountPercent = clampPercent(Number(line.discount_percent || 0))
    const base = Number(line.unit_price || 0) * Number(line.quantity || 0)
    return base * (1 - discountPercent / 100)
  }

  const recalcInvoiceTotals = (invoice: Invoice) => {
    const subtotal = (invoice.lines || []).reduce((sum, line) => sum + calculateLineTotal(line), 0)
    const discountPercent = clampPercent(Number(invoice.discount_percent || 0))
    const discountAmount = subtotal * (discountPercent / 100)
    const total = Math.max(0, subtotal - discountAmount)

    invoice.subtotal = subtotal
    invoice.discount_amount = discountAmount
    invoice.total_amount = total

    if (invoice.status === 'paid') {
      invoice.paid_amount = total
    }
    invoice.remaining_amount = total - invoice.paid_amount
  }

  // Générer numéro de facture unique
  const generateInvoiceNumber = () => {
    const date = new Date()
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '')
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `INV-${dateStr}-${timeStr}-${random}`
  }

  // Créer une nouvelle facture en cours
  const createNewInvoice = () => {
    const newInvoiceNumber = generateInvoiceNumber()
    setInvoiceNumber(newInvoiceNumber)
    
    const newInvoice: Invoice = {
      id: `draft-${Date.now()}`,
      invoice_number: newInvoiceNumber,
      client_id: selectedClient?.id || null,
      client_name: selectedClient?.company_name_ar || 'زبون نقدي',
      status: 'paid', // Par défaut : payé
      lines: [],
      subtotal: 0,
      total_amount: 0,
      discount_percent: 0,
      discount_amount: 0,
      paid_amount: 0,
      remaining_amount: 0,
      created_at: new Date().toISOString()
    }
    
    setCurrentInvoice(newInvoice)
    return newInvoice
  }

  // Ajouter un produit à la facture en cours
  const addToInvoice = (product: Product, opts?: { unitType?: string }) => {
    // Créer une facture si elle n'existe pas
    let invoice = currentInvoice
    if (!invoice) {
      invoice = createNewInvoice()
    }

    const chosenUnitType = opts?.unitType || 'unit'
    const pricing = getPricingForPrimaryAndUnitType(product.primary_variant_id, chosenUnitType)
    const unitPrice = getProductPrice({
      ...product,
      ...pricing,
    } as any)

    const existingLine = invoice.lines.find(line =>
      line.product_id === product.id &&
      line.primary_variant_id === product.primary_variant_id &&
      (line.unit_type || 'unit') === chosenUnitType
    )

    if (existingLine) {
      // Si la ligne était supprimée, la restaurer
      if (existingLine.deleted) {
        existingLine.deleted = false
        existingLine.quantity = 1
      } else {
        // Augmenter la quantité
        existingLine.quantity += 1
      }
      existingLine.total = calculateLineTotal(existingLine)
    } else {
      // Ajouter une nouvelle ligne
      const newLine: InvoiceLine = {
        id: `line-${Date.now()}-${Math.random()}`,
        product_id: product.id,
        primary_variant_id: product.primary_variant_id,
        product_name_ar: product.name_ar,
        quantity: 1,
        unit_price: unitPrice,
        total: unitPrice,
        unit_type: chosenUnitType,
        deleted: false,
        image_url: product.image_url,
        is_gift: false,
        discount_percent: 0,
        original_unit_price: unitPrice
      }
      invoice.lines.push(newLine)
    }

    // Recalculer les totaux
    recalcInvoiceTotals(invoice)
    
    // Auto-sync paid amount with total for resumed invoices
    invoice.paid_amount = invoice.total_amount
    invoice.remaining_amount = invoice.total_amount - invoice.paid_amount

    setCurrentInvoice({ ...invoice })
    // Sync paidAmount state with the new total
    setPaidAmount(invoice.paid_amount)
  }

  // Mettre à jour la quantité d'une ligne
  const updateInvoiceLineQuantity = (lineId: string, quantity: number) => {
    if (!currentInvoice) return

    const line = currentInvoice.lines?.find(l => l.id === lineId)
    if (line && !line.deleted && quantity > 0) {
      line.quantity = quantity
      line.total = calculateLineTotal(line)

      // Recalculer les totaux
      recalcInvoiceTotals(currentInvoice)
      
      // Auto-sync paid amount with total for resumed invoices
      currentInvoice.paid_amount = currentInvoice.total_amount
      currentInvoice.remaining_amount = currentInvoice.total_amount - currentInvoice.paid_amount

      setCurrentInvoice({ ...currentInvoice })
      // Sync paidAmount state with the new total
      setPaidAmount(currentInvoice.paid_amount)
    }
  }

  // Supprimer une ligne de la facture
  const removeInvoiceLine = (lineId: string) => {
    if (!currentInvoice) return

    const line = currentInvoice.lines?.find(l => l.id === lineId)
    if (!line) return

    // Soft delete: garder la ligne mais la barrer
    line.deleted = true
    line.quantity = 0
    line.total = 0

    // Recalculer les totaux
    recalcInvoiceTotals(currentInvoice)
    
    // Auto-sync paid amount with total for resumed invoices
    currentInvoice.paid_amount = currentInvoice.total_amount
    currentInvoice.remaining_amount = currentInvoice.total_amount - currentInvoice.paid_amount

    setCurrentInvoice({ ...currentInvoice })
    // Sync paidAmount state with the new total
    setPaidAmount(currentInvoice.paid_amount)
  }

  const restoreInvoiceLine = (lineId: string) => {
    if (!currentInvoice) return

    const line = currentInvoice.lines?.find(l => l.id === lineId)
    if (!line) return

    line.deleted = false
    line.quantity = 1
    line.total = calculateLineTotal(line)
    recalcInvoiceTotals(currentInvoice)
    
    // Auto-sync paid amount with total for resumed invoices
    currentInvoice.paid_amount = currentInvoice.total_amount
    currentInvoice.remaining_amount = currentInvoice.total_amount - currentInvoice.paid_amount

    setCurrentInvoice({ ...currentInvoice })
    // Sync paidAmount state with the new total
    setPaidAmount(currentInvoice.paid_amount)
  }

  // Mettre à jour le montant payé et calculer le statut
  const updatePaidAmount = (amount: number) => {
    if (!currentInvoice) return

    currentInvoice.paid_amount = amount
    currentInvoice.remaining_amount = currentInvoice.total_amount - amount

    // Déterminer le statut automatiquement
    if (amount === 0) {
      currentInvoice.status = 'credit'
    } else if (amount < currentInvoice.total_amount) {
      currentInvoice.status = 'partial'
    } else {
      currentInvoice.status = 'paid'
    }

    setCurrentInvoice({ ...currentInvoice })
    setPaidAmount(amount)
  }

  // Calculer le montant avec TVA
  const calculateWithTVA = (amount: number) => {
    if (!enableTVA) return amount
    return amount * (1 + tvaRate / 100)
  }

  // Calculer le montant de TVA
  const calculateTVA = (amount: number) => {
    if (!enableTVA) return 0
    return amount * (tvaRate / 100)
  }

  // Mettre à jour automatiquement le montant payé avec le total
  useEffect(() => {
    if (currentInvoice && currentInvoice.status === 'paid') {
      updatePaidAmount(currentInvoice.total_amount)
    }
  }, [currentInvoice?.total_amount, currentInvoice?.status])

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.id === product.id && !item.deleted)
    if (existing) {
      setCart(cart.map(item =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ))
    } else {
      setCart([...cart, { ...product, quantity: 1, deleted: false }])
    }
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === productId) {
        const newQty = item.quantity + delta
        return newQty > 0 ? { ...item, quantity: newQty } : item
      }
      return item
    }).filter(item => item.quantity > 0))
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.map(item =>
      item.id === productId ? { ...item, deleted: true } : item
    ))
  }

  const restoreFromCart = (productId: string) => {
    setCart(cart.map(item =>
      item.id === productId ? { ...item, deleted: false } : item
    ))
  }

  const clearCart = () => {
    if (cart.length === 0) return
    if (confirm('هل تريد بالتأكيد تفريغ السلة؟')) {
      setCart([])
      setSelectedClient(null)
      setPaidAmount(0)
    }
  }

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (
      !clientFormData.company_name_ar.trim() ||
      !clientFormData.contact_person_name.trim() ||
      !clientFormData.contact_person_email.trim() ||
      !clientFormData.contact_person_phone.trim()
    ) {
      alert('الرجاء إدخال اسم الشركة واسم جهة الاتصال والبريد الإلكتروني والهاتف')
      return
    }

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([clientFormData])
        .select()
        .single()

      if (error) throw error

      // Sélectionner le nouveau client
      setSelectedClient(data)
      setShowAddClientModal(false)
      setShowClientModal(false)
      
      // Réinitialiser le formulaire
      setClientFormData({
        company_name_ar: '',
        company_name_en: '',
        contact_person_name: '',
        contact_person_email: '',
        contact_person_phone: '',
        address: '',
        subscription_tier: 'E',
      })
      
      // Recharger les clients
      await loadClients()
      
      alert('✅ تم إضافة العميل بنجاح')
    } catch (error) {
      console.error('Error adding client:', error)
      alert('❌ حدث خطأ أثناء إضافة العميل')
    }
  }

  const total = cart.reduce((sum, item) => {
    if (item.deleted) return sum
    return sum + (getProductPrice(item) * item.quantity)
  }, 0)
  const remaining = total - paidAmount

  useEffect(() => {
    // Mettre à jour le montant payé par défaut avec le total
    if (paymentStatus === 'paid') {
      setPaidAmount(total)
    }
  }, [total, paymentStatus])

  const putOnHold = async () => {
    if (cart.length === 0) return

    const draft: Draft = {
      id: crypto.randomUUID(),
      client_id: selectedClient?.id || null,
      client_name: selectedClient?.company_name_ar || selectedClient?.client_name || null,
      items: [...cart],
      total: total,
      created_at: new Date().toISOString()
    }

    const updatedDrafts = [draft, ...drafts]
    setDrafts(updatedDrafts)
    localStorage.setItem('pos_drafts', JSON.stringify(updatedDrafts))

    // Clear cart
    setCart([])
    setSelectedClient(null)
    setPaidAmount(0)

    alert('Vente mise en attente avec succès!')
  }

  const resumeDraft = (draft: Draft) => {
    setCart(draft.items || [])
    setSelectedClient(clients.find(c => c.id === draft.client_id) || null)
    setPaidAmount(0)
    setShowDraftsModal(false)

    // Remove from drafts
    const updatedDrafts = drafts.filter(d => d.id !== draft.id)
    setDrafts(updatedDrafts)
    localStorage.setItem('pos_drafts', JSON.stringify(updatedDrafts))
  }

  const resumeInvoice = (invoice: Invoice) => {
    // Set current invoice from on hold invoice
    setCurrentInvoice(invoice)
    setInvoiceNumber(invoice.invoice_number)
    
    // Convert Invoice lines to Cart items
    const cartItems = (invoice.lines || []).map(line => ({
      id: line.product_id,
      name_ar: line.product_name_ar,
      price_a: line.unit_price,
      price_b: line.unit_price,
      price_c: line.unit_price,
      price_d: line.unit_price,
      price_e: line.unit_price,
      stock: 0, // Will be updated when product is loaded
      quantity: line.quantity,
      customPrice: line.customPrice,
      image_url: line.image_url,
      is_gift: line.is_gift,
      discount_percent: line.discount_percent,
      original_unit_price: line.original_unit_price
    }))
    
    setCart(cartItems)
    setSelectedClient(clients.find(c => c.id === invoice.client_id) || null)
    // Set paid amount to the invoice's paid amount, not 0
    setPaidAmount(invoice.paid_amount || 0)
    setShowDraftsModal(false)

    // Remove from on hold invoices
    const updatedInvoices = onHoldInvoices.filter(inv => inv.id !== invoice.id)
    setOnHoldInvoices(updatedInvoices)
  }

  const deleteDraft = (draftId: string) => {
    const updatedDrafts = drafts.filter(d => d.id !== draftId)
    setDrafts(updatedDrafts)
    localStorage.setItem('pos_drafts', JSON.stringify(updatedDrafts))
  }

  const deleteInvoice = (invoiceId: string) => {
    const updatedInvoices = onHoldInvoices.filter(inv => inv.id !== invoiceId)
    setOnHoldInvoices(updatedInvoices)
  }

  useEffect(() => {
    const savedDrafts = localStorage.getItem('pos_drafts')
    if (savedDrafts) {
      setDrafts(JSON.parse(savedDrafts))
    }
  }, [])

  const handleEditItemConfirm = () => {
    if (!editingItem) return

    const newQty = parseInt(editQuantity)
    const newPrice = parseFloat(editPrice)

    if (newQty > 0 && !isNaN(newQty) && newPrice > 0 && !isNaN(newPrice)) {
      setCart(cart.map(item =>
        item.id === editingItem.id ? { ...item, quantity: newQty, customPrice: newPrice } : item
      ))
      setShowEditItemModal(false)
      setEditingItem(null)
      setEditQuantity('')
      setEditPrice('')
    }
  }

  const handleEditItemCancel = () => {
    setShowEditItemModal(false)
    setEditingItem(null)
    setEditQuantity('')
    setEditPrice('')
  }

  const handleEditInvoiceLineConfirm = () => {
    if (!currentInvoice || !editingInvoiceLine) return

    const newQty = parseInt(editLineQuantity)
    const newPrice = parseFloat(editLinePrice)

    if (newQty > 0 && !isNaN(newQty) && newPrice >= 0 && !isNaN(newPrice)) {
      const line = currentInvoice.lines.find(l => l.id === editingInvoiceLine.id)
      if (!line) return

      line.quantity = newQty
      if (!line.is_gift) {
        line.unit_price = newPrice
        line.original_unit_price = newPrice
      } else {
        line.unit_price = 0
      }
      line.unit_type = editLineUnitType || line.unit_type || 'unit'
      line.pricing_tier = editLinePricingTier !== 'auto' ? editLinePricingTier : undefined
      line.total = calculateLineTotal(line)

      // Recalculer les totaux
      recalcInvoiceTotals(currentInvoice)

      setCurrentInvoice({ ...currentInvoice })
      setShowEditInvoiceLineModal(false)
      setEditingInvoiceLine(null)
      setEditLineQuantity('')
      setEditLinePrice('')
      setEditLineUnitType('unit')
      setEditLinePricingTier('auto')
    }
  }

  const handleEditInvoiceLineCancel = () => {
    setShowEditInvoiceLineModal(false)
    setEditingInvoiceLine(null)
    setEditLineQuantity('')
    setEditLinePrice('')
    setEditLineUnitType('unit')
    setEditLinePricingTier('auto')
  }

  const openEditInvoiceLineModal = (line: InvoiceLine) => {
    setEditingInvoiceLine(line)
    setEditLineQuantity(line.quantity.toString())
    setEditLinePrice(line.unit_price.toFixed(2))
    setEditLineUnitType(line.unit_type || 'unit')
    setEditLinePricingTier((line.pricing_tier as any) || 'auto')
    setShowEditInvoiceLineModal(true)
  }

  const openEditItemModal = (item: CartItem) => {
    setEditingItem(item)
    setEditQuantity(item.quantity.toString())
    setEditPrice((item.customPrice || getProductPrice(item)).toFixed(2))
    setShowEditItemModal(true)
  }

  const toggleGiftLine = (lineId: string) => {
    if (!currentInvoice) return
    const line = currentInvoice.lines?.find(l => l.id === lineId)
    if (!line || line.deleted) return

    if (!line.is_gift) {
      line.original_unit_price = line.original_unit_price ?? line.unit_price
      line.unit_price = 0
      line.is_gift = true
      line.discount_percent = 0
    } else {
      line.is_gift = false
      line.unit_price = line.original_unit_price ?? line.unit_price
    }

    line.total = calculateLineTotal(line)
    recalcInvoiceTotals(currentInvoice)
    setCurrentInvoice({ ...currentInvoice })
    setPaidAmount(currentInvoice.paid_amount)
  }

  const applyLineDiscount = (lineId: string, percent: number) => {
    if (!currentInvoice) return
    const line = currentInvoice.lines?.find(l => l.id === lineId)
    if (!line || line.deleted) return

    line.discount_percent = clampPercent(percent)
    line.total = calculateLineTotal(line)
    recalcInvoiceTotals(currentInvoice)
    setCurrentInvoice({ ...currentInvoice })
    setPaidAmount(currentInvoice.paid_amount)
  }

  const applyInvoiceDiscount = (percent: number) => {
    if (!currentInvoice) return
    currentInvoice.discount_percent = clampPercent(percent)
    recalcInvoiceTotals(currentInvoice)
    setCurrentInvoice({ ...currentInvoice })
    setPaidAmount(currentInvoice.paid_amount)
  }

  // Ouvrir le modal de confirmation
  const handleCheckout = () => {
    if (!cashSession) {
      setShowOpenCashModal(true)
      alert('❌ يجب فتح النقدية قبل البيع')
      return
    }

    if (!currentInvoice || !currentInvoice.lines || currentInvoice.lines.length === 0) return

    // Afficher la facture NON confirmée (avec option TVA)
    setShowConfirmationModal(true)
  }

  // Confirmer et traiter la vente
  const confirmSale = async () => {
    if (!currentInvoice) return
    
    // Afficher le modal de confirmation avec TVA au lieu de confirmer directement
    setShowConfirmationModal(true)
  }

  // Traiter la vente après confirmation TVA
  const processSaleAfterTVA = async () => {
    if (!currentInvoice) return

    if (!cashSession) {
      setShowOpenCashModal(true)
      alert('❌ يجب فتح النقدية قبل البيع')
      return
    }

    try {
      // Déterminer le client
      let clientId = selectedClient?.id
      if (!clientId) {
        const { data: generalClient } = await supabase
          .from('clients')
          .select('id')
          .eq('company_name_ar', 'عميل عام')
          .maybeSingle()
        
        if (generalClient) {
          clientId = generalClient.id
        } else {
          const { data: newClient } = await supabase
            .from('clients')
            .insert({
              company_name_ar: 'عميل عام',
              company_name_en: 'General Client'
            })
            .select()
            .single()
          clientId = newClient?.id
        }
      }

      // Créer la facture directement (sans créer de commande pour les ventes en caisse)
      let invoiceNumber = currentInvoice.invoice_number

      const buildInvoiceInsert = (num: string, includeDiscounts = true) => ({
        invoice_number: num,
        order_id: null, // Pas de commande pour les ventes directes en caisse
        client_id: clientId,
        invoice_date: new Date().toISOString(),
        due_date: new Date().toISOString(),
        subtotal: currentInvoice.subtotal,
        total_amount: currentInvoice.total_amount,
        ...(includeDiscounts
          ? {
              discount_percent: currentInvoice.discount_percent || 0,
              discount_amount: currentInvoice.discount_amount || 0,
            }
          : {}),
        paid_amount: currentInvoice.paid_amount,
        cash_session_id: cashSession.id,
        employee_id: cashSession.employee_id,
        warehouse_id: cashSession.warehouse_id,
        status: currentInvoice.status === 'credit' ? 'draft' :
                currentInvoice.status === 'partial' ? 'sent' :
                currentInvoice.status === 'paid' ? 'paid' : 'draft',
        items: currentInvoice.lines?.filter(line => !line.deleted).map(line => ({
          product_id: line.product_id,
          primary_variant_id: (line as any).primary_variant_id,
          unit_type: (line as any).unit_type || 'unit',
          pricing_tier: (line as any).pricing_tier || null,
          product_name: line.product_name_ar,
          quantity: line.quantity,
          unit_price: line.unit_price,
          total: line.total,
          discount_percent: line.discount_percent || 0,
          is_gift: !!line.is_gift,
          original_unit_price: line.original_unit_price || line.unit_price
        }))
      })

      let { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert(buildInvoiceInsert(invoiceNumber, true))
        .select()
        .single()

      if (invoiceError && String(invoiceError?.message || '').toLowerCase().includes('discount')) {
        const retryNoDiscounts = await supabase
          .from('invoices')
          .insert(buildInvoiceInsert(invoiceNumber, false))
          .select()
          .single()
        invoice = retryNoDiscounts.data
        invoiceError = retryNoDiscounts.error
      }

      if (invoiceError && (invoiceError as any).code === '23505') {
        invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`

        const retry = await supabase
          .from('invoices')
          .insert(buildInvoiceInsert(invoiceNumber, !String(invoiceError?.message || '').toLowerCase().includes('discount')))
          .select()
          .single()

        invoice = retry.data
        invoiceError = retry.error
      }

      if (invoiceError) throw invoiceError

      // Temporairement désactivé à cause de la politique RLS (42501)
      // Les données sont déjà sauvegardées dans invoices.items (JSON)
      /*
      // Créer les lignes de facture
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(
          currentInvoice.lines?.filter(line => !line.deleted).map(line => ({
            invoice_id: invoice.id,
            description_ar: line.product_name_ar,
            quantity: line.quantity,
            unit_price: line.unit_price,
            tax_rate: 0,
            tax_amount: 0,
            line_total: line.total
          }))
        )

      if (itemsError) throw itemsError
      */

      // Créer l'enregistrement de paiement si payé
      // Unified payment method values: cash, check, card, bank_transfer, credit
      const normalizedPaymentMethod = paymentMethod === 'cash'
        ? 'cash'
        : paymentMethod === 'check'
          ? 'check'
          : 'credit'

      if (currentInvoice.paid_amount > 0) {

        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            invoice_id: invoice.id,
            client_id: clientId,
            payment_number: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            amount: currentInvoice.paid_amount,
            payment_method: normalizedPaymentMethod,
            payment_date: new Date().toISOString(),
            status: 'completed',
            order_id: null, // Pas de commande pour les ventes directes en caisse
            cash_session_id: cashSession.id,
            collected_by: cashSession.employee_id,
          })

        if (paymentError) throw paymentError
      }

      // Mettre à jour le stock
      for (const line of currentInvoice.lines?.filter(line => !line.deleted) || []) {
        const saleQty = Number(line.quantity) || 0
        if (saleQty <= 0) continue

        const primaryVariantId = String((line as any).primary_variant_id || '')
        const unitType = String((line as any).unit_type || 'unit')

        const { data: variants } = await supabase
          .from('product_variants')
          .select('id, unit_type, quantity_contained, stock, primary_variant_id')
          .eq('product_id', line.product_id)

        const scopedVariants = primaryVariantId
          ? (variants || []).filter(v => String((v as any).primary_variant_id || '') === primaryVariantId)
          : (variants || [])

        const unitVariant = scopedVariants.find(v => v.unit_type === 'unit')
        const cartonVariant = scopedVariants.find(v => v.unit_type === 'carton')
        const kiloVariant = scopedVariants.find(v => v.unit_type === 'kilo')
        const unitsPerCarton = cartonVariant?.quantity_contained ? Number(cartonVariant.quantity_contained) : 0

        if (unitType === 'carton') {
          const cartonQty = saleQty
          const pieces = unitsPerCarton > 0 ? cartonQty * unitsPerCarton : cartonQty

          if (cartonVariant?.id) {
            await supabase
              .from('product_variants')
              .update({ stock: Math.max(0, Number(cartonVariant.stock || 0) - cartonQty) })
              .eq('id', cartonVariant.id)
          }
          if (unitVariant?.id) {
            await supabase
              .from('product_variants')
              .update({ stock: Math.max(0, Number(unitVariant.stock || 0) - pieces) })
              .eq('id', unitVariant.id)
          }
        } else if (unitType === 'kilo') {
          if (kiloVariant?.id) {
            await supabase
              .from('product_variants')
              .update({ stock: Math.max(0, Number(kiloVariant.stock || 0) - saleQty) })
              .eq('id', kiloVariant.id)
          }
        } else {
          // unit
          if (unitVariant?.id) {
            const nextUnitStock = Math.max(0, Number(unitVariant.stock || 0) - saleQty)
            await supabase
              .from('product_variants')
              .update({ stock: nextUnitStock })
              .eq('id', unitVariant.id)
          }

          if (cartonVariant?.id && unitsPerCarton > 0) {
            const cartonDelta = saleQty / unitsPerCarton
            const nextCartonStock = Math.max(0, Number(cartonVariant.stock || 0) - cartonDelta)
            await supabase
              .from('product_variants')
              .update({ stock: nextCartonStock })
              .eq('id', cartonVariant.id)
          }
        }

        const warehouseId = cashSession?.warehouse_id
        if (warehouseId) {
          let stockRow: any = null
          let stockErr: any = null

          {
            const res = await supabase
              .from('stock')
              .select('id, quantity_in_stock')
              .eq('product_id', line.product_id)
              .eq('primary_variant_id', primaryVariantId)
              .eq('warehouse_id', warehouseId)
              .maybeSingle()
            stockRow = res.data
            stockErr = res.error
          }

          if (stockErr && String(stockErr?.message || '').includes('warehouse_id')) {
            const res2 = await supabase
              .from('stock')
              .select('id, quantity_in_stock')
              .eq('product_id', line.product_id)
              .eq('primary_variant_id', primaryVariantId)
              .maybeSingle()
            stockRow = res2.data
            stockErr = res2.error
          }

          if (!stockErr && stockRow?.id) {
            const currentInStock = Number(stockRow.quantity_in_stock || 0) || 0
            const baseDelta = unitType === 'carton'
              ? (unitsPerCarton > 0 ? saleQty * unitsPerCarton : saleQty)
              : saleQty
            const nextInStock = Math.max(0, currentInStock - baseDelta)
            await supabase
              .from('stock')
              .update({ quantity_in_stock: nextInStock })
              .eq('id', stockRow.id)
          }
        }
      }

      // Créer la facture finale avec TVA
      const finalInvoice = {
        ...currentInvoice,
        id: invoice.id,
        invoice_number: invoiceNumber,
        total_with_tva: calculateWithTVA(currentInvoice.total_amount),
        tva_amount: calculateTVA(currentInvoice.total_amount),
        enable_tva: enableTVA,
        tva_rate: tvaRate,
        payment_method: currentInvoice.paid_amount > 0 ? normalizedPaymentMethod : 'credit'
      }

      // Afficher la facture et la popup d'impression
      setConfirmedInvoice(finalInvoice)
      setShowConfirmationModal(false)
      setShowInvoiceModal(true)
      setShowPrintTypeModal(true)
      
      // Réinitialiser pour la prochaine vente
      setCurrentInvoice(null)
      setInvoiceNumber('')
      setSelectedClient(null)
      setPaidAmount(0)
      await loadProducts()
      await refreshCashSessionSummary(cashSession.id)
    } catch (error) {
      console.error('Error:', error)
      alert('❌ حدث خطأ')
    }
  }

  // Fonction d'impression adaptée selon le type
  const handlePrint = (type: 'invoice' | 'ticket' | 'order') => {
    if (!confirmedInvoice) return

    // Créer le contenu HTML selon le type
    let printContent = ''
    
    if (type === 'invoice') {
      // Facture A4 - Format complet
      printContent = `
        <div style="direction: rtl; font-family: Arial, sans-serif; color: black; max-width: 210mm; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid black; padding-bottom: 20px;">
            <h1 style="font-size: 28px; margin: 0; color: black;">${companyInfo.company_name_ar || companyInfo.company_name || 'BA9ALINO'}</h1>
            ${companyInfo.ice ? `<p style="margin: 5px 0; color: black;">ICE: ${companyInfo.ice}</p>` : ''}
            ${companyInfo.address_ar ? `<p style="margin: 5px 0; color: black;">${companyInfo.address_ar}</p>` : '<p style="margin: 5px 0; color: black;">المغرب - الدار البيضاء</p>'}
            ${companyInfo.phone ? `<p style="margin: 5px 0; color: black;">الهاتف: ${companyInfo.phone}</p>` : '<p style="margin: 5px 0; color: black;">الهاتف: 0123456789</p>'}
            ${companyInfo.email ? `<p style="margin: 5px 0; color: black;">البريد الإلكتروني: ${companyInfo.email}</p>` : '<p style="margin: 5px 0; color: black;">البريد الإلكتروني: info@ba9alino.ma</p>'}
          </div>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
            <div style="text-align: right;">
              <p style="margin: 5px 0; color: black;"><strong>رقم الفاتورة:</strong> ${confirmedInvoice.invoice_number}</p>
              <p style="margin: 5px 0; color: black;"><strong>التاريخ:</strong> ${new Date(confirmedInvoice.created_at).toLocaleDateString('ar-DZ')}</p>
            </div>
            <div style="text-align: left;">
              <p style="margin: 5px 0; color: black;"><strong>العميل:</strong> ${confirmedInvoice.client_name}</p>
            </div>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background: #f0f0f0; border: 1px solid black;">
                <th style="border: 1px solid black; padding: 10px; text-align: center;">الكمية</th>
                <th style="border: 1px solid black; padding: 10px; text-align: center;">الوحدة</th>
                <th style="border: 1px solid black; padding: 10px; text-align: right;">السلعة</th>
                <th style="border: 1px solid black; padding: 10px; text-align: left;">الثمن</th>
                <th style="border: 1px solid black; padding: 10px; text-align: left;">المجموع</th>
              </tr>
            </thead>
            <tbody>
              ${confirmedInvoice.lines.filter(l => !l.deleted).map(line => `
                <tr style="border: 1px solid black;">
                  <td style="border: 1px solid black; padding: 8px; text-align: center;">${line.quantity}</td>
                  <td style="border: 1px solid black; padding: 8px; text-align: center;">وحدة</td>
                  <td style="border: 1px solid black; padding: 8px; text-align: right;">${line.product_name_ar}</td>
                  <td style="border: 1px solid black; padding: 8px; text-align: left;">${line.unit_price.toFixed(2)} MAD</td>
                  <td style="border: 1px solid black; padding: 8px; text-align: left; font-weight: bold;">${line.total.toFixed(2)} MAD</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="text-align: left; width: 50%; margin-left: auto;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border: 1px solid black;">
                <td style="border: 1px solid black; padding: 8px; text-align: right;">الإجمالي:</td>
                <td style="border: 1px solid black; padding: 8px; text-align: left; font-weight: bold;">${confirmedInvoice.subtotal.toFixed(2)} MAD</td>
              </tr>
              ${confirmedInvoice.enable_tva ? `
                <tr style="border: 1px solid black;">
                  <td style="border: 1px solid black; padding: 8px; text-align: right;">ضريبة القيمة المضافة (${confirmedInvoice.tva_rate}%):</td>
                  <td style="border: 1px solid black; padding: 8px; text-align: left; font-weight: bold;">${confirmedInvoice.tva_amount.toFixed(2)} MAD</td>
                </tr>
              ` : ''}
              <tr style="border: 1px solid black; background: #f0f0f0;">
                <td style="border: 1px solid black; padding: 10px; text-align: right; font-weight: bold;">${confirmedInvoice.enable_tva ? 'المجموع مع الضريبة:' : 'المجموع:'}</td>
                <td style="border: 1px solid black; padding: 10px; text-align: left; font-weight: bold; font-size: 16px;">${confirmedInvoice.total_with_tva.toFixed(2)} MAD</td>
              </tr>
              <tr style="border: 1px solid black;">
                <td style="border: 1px solid black; padding: 8px; text-align: right;">الدفع:</td>
                <td style="border: 1px solid black; padding: 8px; text-align: left; font-weight: bold;">${confirmedInvoice.paid_amount.toFixed(2)} MAD</td>
              </tr>
              <tr style="border: 1px solid black;">
                <td style="border: 1px solid black; padding: 8px; text-align: right;">الباقي:</td>
                <td style="border: 1px solid black; padding: 8px; text-align: left; font-weight: bold; color: ${confirmedInvoice.total_with_tva - confirmedInvoice.paid_amount > 0 ? 'red' : 'green'};">${(confirmedInvoice.total_with_tva - confirmedInvoice.paid_amount).toFixed(2)} MAD</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid black;">
            <p style="margin: 5px 0; color: black;">شكرا لثقتكم بنا</p>
          </div>
        </div>
      `
    } else if (type === 'ticket') {
      // Ticket 80mm - Format compact (model-like)
      const ticketDate = new Date(confirmedInvoice.created_at)
      const ticketDateStr = ticketDate.toLocaleDateString('fr-FR')
      const ticketTimeStr = ticketDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      const totalQty = confirmedInvoice.lines.filter(l => !l.deleted).reduce((sum, l) => sum + (Number(l.quantity) || 0), 0)
      const totalWithTva = confirmedInvoice.total_with_tva ?? confirmedInvoice.total_amount
      const remaining = (totalWithTva - (confirmedInvoice.paid_amount || 0))
      const debtAmount = remaining > 0 ? remaining : 0

      printContent = `
        <div style="direction: rtl; font-family: monospace; color: #000; width: 80mm; margin: 0 auto; padding: 6px; font-size: 12px; line-height: 1.25;">
          <div style="text-align: center; margin-bottom: 6px;">
            <div style="font-size: 14px; font-weight: bold;">${companyInfo.company_name_ar || companyInfo.company_name || ''}</div>
            ${companyInfo.address_ar ? `<div style=\"font-size: 10px;\">${companyInfo.address_ar}</div>` : ''}
            ${companyInfo.phone ? `<div style=\"font-size: 10px;\">${companyInfo.phone}</div>` : ''}
          </div>

          <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin: 6px 0;">
            <div style="display: flex; justify-content: space-between;">
              <div style="font-weight: bold;">رقم الطلب :</div>
              <div style="font-weight: bold;">${confirmedInvoice.invoice_number}</div>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <div>التاريخ :</div>
              <div>${ticketDateStr} - ${ticketTimeStr}</div>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <div>caisse :</div>
              <div>${warehouseName || ''}</div>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <div>البائع :</div>
              <div>${cashierName || ''}</div>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <div>الزبون :</div>
              <div style="max-width: 46mm; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${confirmedInvoice.client_name || ''}</div>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #000;">
            <thead>
              <tr style="background: #f9f9f9;">
                <th style="text-align: right; padding: 3px 2px; border: 1px solid #000;">الكمية</th>
                <th style="text-align: right; padding: 3px 2px; border: 1px solid #000;">الوحدة</th>
                <th style="text-align: right; padding: 3px 2px; border: 1px solid #000;">الثمن</th>
                <th style="text-align: right; padding: 3px 2px; border: 1px solid #000;">الاسم</th>
                <th style="text-align: left; padding: 3px 2px; border: 1px solid #000;">المجموع</th>
              </tr>
            </thead>
            <tbody>
              ${confirmedInvoice.lines.filter(l => !l.deleted).map(line => `
                <tr>
                  <td style=\"padding: 3px 2px; text-align: right; white-space: nowrap; border: 1px solid #000;\">${line.quantity}</td>
                  <td style=\"padding: 3px 2px; text-align: right; white-space: nowrap; border: 1px solid #000;\">وحدة</td>
                  <td style=\"padding: 3px 2px; text-align: right; white-space: nowrap; border: 1px solid #000;\">${line.unit_price.toFixed(2)}</td>
                  <td style=\"padding: 3px 2px; text-align: right; border: 1px solid #000;\">${line.product_name_ar}</td>
                  <td style=\"padding: 3px 2px; text-align: left; white-space: nowrap; border: 1px solid #000;\">${line.total.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="border-top: 1px dashed #000; margin-top: 6px; padding-top: 6px;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
              <div>المجموع</div>
              <div>${Number(totalWithTva || 0).toFixed(2)} DH</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 6px;">
              <div>مجموع المواد</div>
              <div>${totalQty}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 4px;">
              <div>الوزن الإجمالي (كليو)</div>
              <div>0.000</div>
            </div>
          </div>

          <div style="margin-top: 6px;">
            <div style="font-weight: bold; margin-bottom: 4px;">الدفع :</div>
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
              <div style="width: 35mm;">الدفع</div>
              <div style="width: 35mm; text-align: left;">${Number(confirmedInvoice.paid_amount || 0).toFixed(2)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 2px;">
              <div style="width: 35mm;">الدين</div>
              <div style="width: 35mm; text-align: left;">${debtAmount.toFixed(2)}</div>
            </div>
          </div>

          <div style="margin-top: 6px; border-top: 1px dashed #000; padding-top: 6px;">
            <div style="display: flex; justify-content: space-between;">
              <div style="width: 35mm;">حساب قديم</div>
              <div style="width: 35mm; text-align: left;">0.00</div>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <div style="width: 35mm;">مجموع الديون</div>
              <div style="width: 35mm; text-align: left;">${debtAmount.toFixed(2)}</div>
            </div>
          </div>

          <div style="text-align: center; margin-top: 10px; border-top: 1px dashed #000; padding-top: 8px; font-size: 10px;">
            شكرا لثقتكم بنا
          </div>
        </div>
      `
    } else if (type === 'order') {
      // Commande - Format simplifié
      printContent = `
        <div style="direction: rtl; font-family: Arial, sans-serif; color: black; max-width: 80mm; margin: 0 auto; padding: 15px;">
          <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid black; padding-bottom: 10px;">
            <h1 style="font-size: 20px; margin: 0; color: black;">طلب شراء</h1>
            <p style="margin: 5px 0; color: black;">${companyInfo.company_name_ar || companyInfo.company_name || 'BA9ALINO'}</p>
          </div>
          
          <div style="margin-bottom: 15px;">
            <p style="margin: 3px 0; color: black;"><strong>رقم الطلب:</strong> ${confirmedInvoice.invoice_number}</p>
            <p style="margin: 3px 0; color: black;"><strong>التاريخ:</strong> ${new Date(confirmedInvoice.created_at).toLocaleDateString('ar-DZ')}</p>
            <p style="margin: 3px 0; color: black;"><strong>العميل:</strong> ${confirmedInvoice.client_name}</p>
          </div>
          
          <div style="margin-bottom: 15px;">
            <h3 style="margin: 5px 0; color: black; text-decoration: underline;">المنتجات:</h3>
            ${confirmedInvoice.lines.filter(l => !l.deleted).map((line, index) => `
              <div style="margin-bottom: 8px; padding: 5px; border-bottom: 1px dotted black;">
                <div style="color: black; font-weight: bold;">${index + 1}. ${line.product_name_ar}</div>
                <div style="color: black; font-size: 12px;">الكمية: ${line.quantity} | الثمن: ${line.unit_price.toFixed(2)} MAD | الإجمالي: ${line.total.toFixed(2)} MAD</div>
              </div>
            `).join('')}
          </div>
          
          <div style="border-top: 2px solid black; padding-top: 10px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span style="color: black;">الإجمالي:</span>
              <span style="color: black;">${confirmedInvoice.subtotal.toFixed(2)} MAD</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span style="color: black;">الدفع:</span>
              <span style="color: black;">${confirmedInvoice.paid_amount.toFixed(2)} MAD</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 16px;">
              <span style="color: black;">الباقي:</span>
              <span style="color: black;">${(confirmedInvoice.total_with_tva - confirmedInvoice.paid_amount).toFixed(2)} MAD</span>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px;">
            <p style="margin: 5px 0; color: black;">_________________________</p>
            <p style="margin: 5px 0; color: black; font-size: 12px;">توقيع العميل</p>
          </div>
        </div>
      `
    }

    // Créer une fenêtre d'impression
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${type === 'invoice' ? 'فاتورة' : type === 'ticket' ? 'تذكرة' : 'طلب'}</title>
          <style>
            @media print {
              body { margin: 0; }
              @page { ${type === 'invoice' ? 'margin: 10mm;' : 'margin: 5mm;'} }
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.focus()
      
      // Attendre que le contenu soit chargé avant d'imprimer
      setTimeout(() => {
        printWindow.print()
        // Ne pas fermer automatiquement la popup de choix d'impression
        // L'utilisateur la fermera manuellement avec le bouton "غلق"
      }, 500)
    }
  }

  const cashierName = cashSession
    ? (employees.find(e => e.id === cashSession.employee_id)?.name || '')
    : ''
  const warehouseName = cashSession
    ? (warehouses.find(w => w.id === cashSession.warehouse_id)?.name || '')
    : ''

  return (
    <div className="h-screen flex gap-4 overflow-hidden relative" dir="rtl">
      {cashSession && showSessionDashboard && (
        <div className="absolute top-3 left-3 z-50 bg-white rounded-xl shadow-lg p-4 w-[360px]">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-bold text-gray-800">👤 {cashierName}</div>
            <div className="text-sm font-bold text-gray-800">🏬 {warehouseName}</div>
          </div>
          <button
            onClick={() => setShowSessionDashboard(false)}
            className="w-full mb-3 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded-lg font-bold text-sm"
          >
            إخفاء لوحة الجلسة
          </button>
          <div className="text-xs text-gray-500 mb-3">
            🟢 مفتوحة منذ: {new Date(cashSession.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-green-50 rounded-lg p-2">
              <div className="text-xs text-gray-500">نقدي</div>
              <div className="font-bold text-green-700">{cashSessionSummary.totalCash.toFixed(2)} MAD</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-2">
              <div className="text-xs text-gray-500">كارت</div>
              <div className="font-bold text-blue-700">{cashSessionSummary.totalCard.toFixed(2)} MAD</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-2">
              <div className="text-xs text-gray-500">تحويل</div>
              <div className="font-bold text-purple-700">{cashSessionSummary.totalTransfer.toFixed(2)} MAD</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-2">
              <div className="text-xs text-gray-500">ديون</div>
              <div className="font-bold text-orange-700">{cashSessionSummary.totalCredit.toFixed(2)} MAD</div>
            </div>
          </div>
          <div className="mt-3 bg-gray-900 text-white rounded-lg p-3">
            <div className="text-xs text-gray-200 mb-1">💵 النقدي النظري</div>
            <div className="text-lg font-bold">{cashSessionSummary.expectedCash.toFixed(2)} MAD</div>
          </div>
          <button
            onClick={() => setShowCloseCashModal(true)}
            className="w-full mt-3 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-bold"
          >
            🔒 إغلاق النقدية
          </button>
        </div>
      )}

      {cashSession && !showSessionDashboard && (
        <button
          onClick={() => setShowSessionDashboard(true)}
          className="absolute top-3 left-3 z-50 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl shadow-lg px-4 py-3 font-bold"
        >
          📊 إظهار لوحة الجلسة
        </button>
      )}

      {showOpenCashModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]" onClick={() => setShowOpenCashModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-w-[92vw] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <span className="inline-block bg-gray-200 text-gray-800 font-bold px-4 py-2 rounded-md">
                فتح النقدية
              </span>
              <button
                onClick={() => setShowOpenCashModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">اسم الموظف</label>
                {isEmployeeMode ? (
                  <div className="w-full p-3 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-800 font-bold">
                    {employeeNameFromAuth || 'موظف'}
                  </div>
                ) : (
                  <select
                    value={openEmployeeId}
                    onChange={(e) => setOpenEmployeeId(e.target.value)}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none"
                  >
                    <option value="">اختر الموظف</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">المخزن</label>
                <select
                  value={openWarehouseId}
                  onChange={(e) => setOpenWarehouseId(e.target.value)}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none"
                >
                  <option value="">اختر المخزن</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Fond de caisse initial</label>
                <button
                  type="button"
                  onClick={() =>
                    inputPad.open({
                      title: 'Fond de caisse initial',
                      mode: 'decimal',
                      dir: 'ltr',
                      initialValue: openingCashInput || '0',
                      min: 0,
                      onConfirm: (v) => setOpeningCashInput(v),
                    })
                  }
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none bg-white text-left font-bold"
                >
                  {openingCashInput || '0'}
                </button>
              </div>

              <button
                onClick={handleOpenCashSession}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-lg font-bold text-lg"
              >
                Ouvrir la caisse
              </button>
            </div>
          </div>
        </div>
      )}

      {showCloseCashModal && cashSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]" onClick={() => setShowCloseCashModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-w-[92vw] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <span className="inline-block bg-gray-200 text-gray-800 font-bold px-4 py-2 rounded-md">
                إغلاق النقدية
              </span>
              <button
                onClick={() => setShowCloseCashModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Fond initial</span>
                <span className="font-bold">{Number(cashSession.opening_cash || 0).toFixed(2)} MAD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Espèces encaissées</span>
                <span className="font-bold">{cashSessionSummary.totalCash.toFixed(2)} MAD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">💰 Cash théorique</span>
                <span className="font-bold">{cashSessionSummary.expectedCash.toFixed(2)} MAD</span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Cash réel compté</label>
                <button
                  type="button"
                  onClick={() =>
                    inputPad.open({
                      title: 'Cash réel compté',
                      mode: 'decimal',
                      dir: 'ltr',
                      initialValue: closingCashInput || '0',
                      min: 0,
                      onConfirm: (v) => setClosingCashInput(v),
                    })
                  }
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:outline-none bg-white text-left font-bold"
                >
                  {closingCashInput || '0'}
                </button>
                {closingCashInput !== '' && (
                  <div className="text-xs text-gray-600 mt-1">
                    Écart: {(Number(closingCashInput || 0) - cashSessionSummary.expectedCash).toFixed(2)} MAD
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">ملاحظة (إجباري إذا كان هناك فرق)</label>
                <button
                  type="button"
                  onClick={() =>
                    inputPad.open({
                      title: 'ملاحظة',
                      mode: 'text',
                      initialValue: closingNoteInput || '',
                      onConfirm: (v) => setClosingNoteInput(v),
                    })
                  }
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:outline-none bg-white text-right font-bold whitespace-pre-wrap min-h-[92px]"
                >
                  {closingNoteInput || 'اضغط لإدخال ملاحظة...'}
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCloseCashSession}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold"
                >
                  Fermer
                </button>
                <button
                  onClick={() => setShowCloseCashModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-bold"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Liste des produits */}
      <div className="flex-1 bg-white rounded-xl shadow-lg p-4 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate(isEmployeeMode ? '/employee/dashboard' : '/')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
          >
            <ArrowRight size={20} className="text-gray-600" />
            <span className="text-gray-600">العودة</span>
          </button>
          <div className="relative flex-1">
            <Search className="absolute right-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="ابحث عن منتج أو امسح الباركود..."
              className="w-full pr-10 pl-4 py-2 border-2 border-gray-200 rounded-lg text-lg focus:border-green-500 focus:outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleBarcodeSearch()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setSearchQuery('')
                  focusInvoicePanel()
                }
              }}
              ref={searchInputRef}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Catégories */}
        <div className="mb-2 max-h-24 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition-colors ${
                !selectedCategory
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setSelectedCategory('no-category')}
              className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition-colors ${
                selectedCategory === 'no-category'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              بدون عائلة
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                title={category.name_ar}
                className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition-colors max-w-[120px] truncate ${
                  selectedCategory === category.id
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.name_ar}
              </button>
            ))}
          </div>
        </div>

        {/* Liste des produits */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map((product) => {
              const stockColor = product.stock > 10
                ? 'text-green-600'
                : product.stock > 0
                  ? 'text-orange-600'
                  : 'text-red-600'
              const stockText = product.stock === 0 ? 'نفذ المخزون' : product.stock < 10 ? 'منخفض' : 'متوفر'
              const unitTypes = getAvailableUnitTypes(product.primary_variant_id)
              return (
                <div
                  key={`${product.id}-${product.primary_variant_id}`}
                  className="p-3 rounded-xl border-2 bg-white border-gray-200 hover:border-green-500 hover:shadow-lg transition-all"
                >
                  <button
                    type="button"
                    onClick={() => addToInvoice(product)}
                    className="w-full text-left"
                  >
                    {/* Image du produit */}
                    <div className="w-full h-24 mb-2 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name_ar}
                          className="w-full h-full object-cover rounded-lg"
                          onError={(e) => {
                            // Fallback si l'image ne charge pas
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.parentElement?.classList.add('bg-gray-100')
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
                          <ShoppingCart size={32} className="text-gray-400" />
                        </div>
                      )}
                    </div>
                    
                    {/* Informations du produit */}
                    <div className="text-sm font-bold text-gray-800 mb-1 line-clamp-2">
                      {product.name_ar}
                    </div>
                    <div className="text-lg font-bold text-green-600">
                      {getProductPrice(product).toFixed(2)} MAD
                    </div>
                    <div className={`text-xs font-bold mt-1 ${stockColor}`}>
                      {stockText}
                    </div>
                  </button>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {unitTypes.map((t) => (
                      <button
                        key={`${product.id}-${product.primary_variant_id}-${t}`}
                        type="button"
                        onClick={() => addToInvoice(product, { unitType: t })}
                        className={`px-2 py-1 rounded text-[10px] font-bold border ${
                          t === 'unit'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        {t === 'unit' ? 'وحدة' : t === 'carton' ? 'كرتون' : t === 'kilo' ? 'كيلو' : t === 'litre' ? 'لتر' : t}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 🧾 FACTURE EN COURS - Nouvelle Interface Professionnelle */}
      <div
        ref={invoicePanelRef}
        tabIndex={-1}
        className="w-96 bg-white rounded-xl shadow-lg p-4 flex flex-col overflow-auto"
      >
        {/* EN-TÊTE FACTURE */}
        {currentInvoice ? (
          <>
            {/* Numéro et Statut */}
            <div className="mb-3 pb-3 border-b-2 border-gray-200">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-xs text-gray-500">رقم الفاتورة</p>
                  <p className="font-bold text-sm text-gray-800 break-all leading-5">{currentInvoice.invoice_number}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
                  currentInvoice.status === 'paid' ? 'bg-green-600' :
                  currentInvoice.status === 'partial' ? 'bg-yellow-600' :
                  currentInvoice.status === 'credit' ? 'bg-red-600' :
                  'bg-blue-600'
                }`}>
                  {currentInvoice.status === 'paid' ? 'مدفوعة' :
                   currentInvoice.status === 'partial' ? 'جزئية' :
                   currentInvoice.status === 'credit' ? 'دين' :
                   'مسودة'}
                </div>
              </div>
              <p className="text-[11px] text-gray-500 leading-4">
                {new Date(currentInvoice.created_at).toLocaleString('ar-DZ')}
              </p>
            </div>

            {/* العميل */}
            <button
              onClick={() => setShowClientModal(true)}
              className="mb-3 p-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 transition-colors text-right text-sm w-full"
            >
              <p className="text-xs text-gray-500">العميل</p>
              <p className="font-bold text-gray-800">{currentInvoice.client_name}</p>
            </button>

            {/* LIGNES FACTURE - TABLEAU PROFESSIONNEL */}
            <div className="flex-1 overflow-y-auto mb-3 border-b-2 border-gray-200 pb-3 min-h-[150px] max-h-[250px]">
              {!currentInvoice.lines || currentInvoice.lines.length === 0 ? (
                <div className="text-center text-gray-400 py-8 text-sm">
                  لا توجد منتجات
                </div>
              ) : (
                <div className="text-xs">
                  {/* En-tête du tableau */}
                  <div className="grid grid-cols-12 gap-1 mb-2 pb-2 border-b border-gray-300 font-bold text-gray-700">
                    <div className="col-span-5">المنتج</div>
                    <div className="col-span-2 text-center">الثمن</div>
                    <div className="col-span-2 text-center">الكمية</div>
                    <div className="col-span-2 text-left">المجموع</div>
                    <div className="col-span-1 text-center">حذف</div>
                  </div>
                  
                  {/* Lignes du tableau */}
                  <div className="space-y-1">
                    {currentInvoice.lines?.map((line) => (
                      <div
                        key={line.id}
                        className={`grid grid-cols-12 gap-1 p-1 bg-gray-50 rounded border border-gray-200 transition-colors items-center ${
                          line.deleted ? 'opacity-60' : 'hover:border-green-500 hover:bg-green-50'
                        }`}
                      >
                        {/* Produit */}
                        <div className="col-span-5 flex items-center gap-2">
                          {/* Vignette image */}
                          {line.image_url ? (
                            <img
                              src={line.image_url}
                              alt={line.product_name_ar}
                              className="w-8 h-8 object-cover rounded border border-gray-300"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          ) : (
                            <div className="w-8 h-8 bg-gray-100 rounded border border-gray-300 flex items-center justify-center">
                              <ShoppingCart size={14} className="text-gray-400" />
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => {
                                if (!line.deleted) openEditInvoiceLineModal(line)
                              }}
                              className={`w-full font-semibold truncate text-left ${line.deleted ? 'text-gray-500 line-through cursor-not-allowed' : 'text-gray-800 hover:text-green-700 hover:underline'}`}
                              type="button"
                            >
                              {line.product_name_ar}
                            </button>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <button
                                type="button"
                                onClick={() => !line.deleted && toggleGiftLine(line.id)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  line.deleted
                                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                    : line.is_gift
                                      ? 'bg-amber-500 text-white border-amber-600'
                                      : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                }`}
                                disabled={!!line.deleted}
                              >
                                هدية
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (line.deleted) return
                                  inputPad.open({
                                    title: 'خصم المنتج (%)',
                                    mode: 'number',
                                    min: 0,
                                    max: 100,
                                    initialValue: String(line.discount_percent || 0),
                                    onConfirm: (v) => applyLineDiscount(line.id, parseFloat(v) || 0),
                                  })
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  line.deleted
                                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                }`}
                                disabled={!!line.deleted}
                              >
                                خصم
                              </button>
                              {(line.discount_percent || 0) > 0 && !line.is_gift && (
                                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
                                  -{line.discount_percent}%
                                </span>
                              )}
                              {line.is_gift && (
                                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                                  هدية مجانية
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Prix unitaire */}
                        <button
                          onClick={() => {
                            if (!line.deleted) openEditInvoiceLineModal(line)
                          }}
                          className={`col-span-2 text-center ${line.deleted ? 'text-gray-500 line-through cursor-not-allowed' : 'text-gray-600 hover:text-green-700 hover:underline'}`}
                          type="button"
                          disabled={!!line.deleted}
                        >
                          {line.deleted ? '0.00' : line.unit_price.toFixed(2)}
                        </button>
                        
                        {/* Quantité avec boutons */}
                        <div className="col-span-2 flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => {
                              if (!line.deleted) updateInvoiceLineQuantity(line.id, line.quantity - 1)
                            }}
                            className={`w-5 h-5 rounded text-xs font-bold ${
                              line.deleted ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'
                            }`}
                            disabled={!!line.deleted}
                          >
                            −
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (line.deleted) return
                              inputPad.open({
                                title: 'الكمية',
                                mode: 'number',
                                initialValue: String(line.quantity || 1),
                                min: 1,
                                onConfirm: (v) => updateInvoiceLineQuantity(line.id, parseInt(v) || 1),
                              })
                            }}
                            className={`w-10 text-center text-xs font-bold border border-gray-200 rounded py-1 ${
                              line.deleted ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-50'
                            }`}
                            disabled={!!line.deleted}
                          >
                            {line.deleted ? 0 : line.quantity}
                          </button>
                          <button
                            onClick={() => {
                              if (!line.deleted) updateInvoiceLineQuantity(line.id, line.quantity + 1)
                            }}
                            className={`w-5 h-5 rounded text-xs font-bold ${
                              line.deleted ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                            disabled={!!line.deleted}
                          >
                            +
                          </button>
                        </div>
                        
                        {/* Total ligne */}
                        <div className={`col-span-2 text-left font-bold ${line.deleted ? 'text-gray-500 line-through' : 'text-green-600'}`}>
                          {(line.deleted ? 0 : line.total).toFixed(2)}
                        </div>
                        
                        {/* Bouton supprimer */}
                        <div className="col-span-1 flex justify-center">
                          <button
                            onClick={() => (line.deleted ? restoreInvoiceLine(line.id) : removeInvoiceLine(line.id))}
                            className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                              line.deleted ? 'bg-gray-500 hover:bg-gray-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                            }`}
                          >
                            {line.deleted ? '↺' : '✕'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {/* RÉSUMÉ FINANCIER */}
              <div className="p-3 rounded-xl border border-gray-200 bg-gray-50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">الإجمالي:</span>
                  <span className="font-bold text-gray-800">{currentInvoice.subtotal.toFixed(2)} MAD</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">خصم الفاتورة:</span>
                  <button
                    type="button"
                    onClick={() =>
                      inputPad.open({
                        title: 'خصم الفاتورة (%)',
                        mode: 'number',
                        min: 0,
                        max: 100,
                        initialValue: String(currentInvoice.discount_percent || 0),
                        onConfirm: (v) => applyInvoiceDiscount(parseFloat(v) || 0),
                      })
                    }
                    className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1 hover:bg-blue-100"
                  >
                    {currentInvoice.discount_percent || 0}%
                  </button>
                </div>
                {(currentInvoice.discount_amount || 0) > 0 && (
                  <div className="flex justify-between text-sm text-blue-700">
                    <span>قيمة الخصم:</span>
                    <span>-{(currentInvoice.discount_amount || 0).toFixed(2)} MAD</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-green-600">
                  <span>المجموع:</span>
                  <span>{currentInvoice.total_amount.toFixed(2)} MAD</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-gray-700">
                  <span>المبلغ المدفوع:</span>
                  <span>{(paidAmount ?? 0).toFixed(2)} MAD</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-gray-700">
                  <span>الباقي:</span>
                  <span className={currentInvoice.remaining_amount > 0 ? 'text-red-600' : 'text-green-600'}>
                    {currentInvoice.remaining_amount.toFixed(2)} MAD
                  </span>
                </div>
              </div>

              {/* ZONE PAIEMENT */}
              <div className="p-3 rounded-xl border border-gray-200 bg-white space-y-2">
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">المبلغ المدفوع:</label>
                  <button
                    type="button"
                    onClick={() =>
                      inputPad.open({
                        title: 'المبلغ المدفوع',
                        mode: 'decimal',
                        dir: 'ltr',
                        initialValue: String(paidAmount ?? 0),
                        min: 0,
                        onConfirm: (v) => updatePaidAmount(parseFloat(v) || 0),
                      })
                    }
                    className="w-full p-2 border-2 border-gray-200 rounded-lg font-bold text-base focus:border-green-500 focus:outline-none bg-gray-50 text-left"
                  >
                    {(paidAmount ?? 0).toFixed(2)}
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-gray-100">
                  <span className="text-sm font-bold text-gray-600">الباقي:</span>
                  <span className={`text-lg font-extrabold ${currentInvoice.remaining_amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {currentInvoice.remaining_amount.toFixed(2)} MAD
                  </span>
                </div>
              </div>
            </div>

            {/* BOUTONS ACTIONS */}
            <div className="mt-4 space-y-2 sticky bottom-0 bg-white pt-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setCurrentInvoice(null)
                    setInvoiceNumber('')
                  }}
                  className="bg-gray-500 hover:bg-gray-600 text-white py-1 rounded font-bold text-xs transition-all"
                >
                  جديدة
                </button>
                <button
                  onClick={async () => {
                    if (currentInvoice.lines && currentInvoice.lines.length > 0) {
                    try {
                      // Get or create general client
                      let clientId = selectedClient?.id
                      if (!clientId) {
                        const { data: generalClient } = await supabase
                          .from('clients')
                          .select('id')
                          .eq('company_name_ar', 'عميل عام')
                          .maybeSingle()
                        
                        if (generalClient) {
                          clientId = generalClient.id
                        } else {
                          // Create general client if it doesn't exist
                          const { data: newClient } = await supabase
                            .from('clients')
                            .insert({
                              company_name_ar: 'عميل عام',
                              company_name_en: 'General Client'
                            })
                            .select()
                            .single()
                          clientId = newClient?.id
                        }
                      }

                      // Generate new invoice number to avoid conflicts
                      const newInvoiceNumber = generateInvoiceNumber()
                      
                      // Save to database first
                      const { data, error } = await supabase
                        .from('invoices')
                        .insert({
                          invoice_number: newInvoiceNumber,
                          client_id: clientId,
                          status: 'draft',
                          subtotal: currentInvoice.subtotal,
                          total_amount: currentInvoice.total_amount,
                          paid_amount: currentInvoice.paid_amount,
                          invoice_date: new Date().toISOString(),
                          due_date: new Date().toISOString(),
                          items: currentInvoice.lines?.filter(line => !line.deleted).map(line => ({
                            product_id: line.product_id,
                            primary_variant_id: (line as any).primary_variant_id,
                            unit_type: (line as any).unit_type || 'unit',
                            product_name: line.product_name_ar,
                            quantity: line.quantity,
                            unit_price: line.unit_price,
                            total: line.total
                          }))
                        })
                        .select()
                        .single()

                      if (error) throw error

                      // Update local state - new invoice should be at the top
                      setOnHoldInvoices([{ ...currentInvoice, status: 'draft', id: data.id, invoice_number: newInvoiceNumber }, ...onHoldInvoices])
                      setCurrentInvoice(null)
                      setInvoiceNumber('')
                      setSelectedClient(null)
                      setPaidAmount(0)
                    } catch (error) {
                      console.error('Error putting invoice on hold:', error)
                      alert('❌ حدث خطأ أثناء حفظ الفاتورة في الانتظار')
                    }
                  }
                }}
                disabled={!currentInvoice.lines || currentInvoice.lines.length === 0}
                className="bg-orange-500 hover:bg-orange-600 text-white py-1 rounded font-bold text-xs disabled:opacity-50 transition-all"
              >
                  انتظار
                </button>
              </div>
              <button
                onClick={() => setShowDraftsModal(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white py-2 rounded font-bold text-xs transition-all w-full"
              >
                قائمة الانتظار ({onHoldInvoices.length})
              </button>
              <button
                onClick={handleCheckout}
                disabled={!currentInvoice.lines || currentInvoice.lines.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold text-sm disabled:opacity-50 transition-all w-full"
              >
                تأكيد البيع
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-gray-400 text-sm mb-4">لا توجد فاتورة في الانتظار</p>
            <button
              onClick={() => createNewInvoice()}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold"
            >
              إنشاء فاتورة جديدة
            </button>
          </div>
        )}
      </div>

      {/* Modal sélection client */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowClientModal(false)}>
          <div className="bg-white rounded-xl p-6 w-96 max-h-96 overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">اختر عميل</h3>
              <button
                onClick={() => {
                  setShowClientModal(false)
                  setShowAddClientModal(true)
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
              >
                إضافة عميل جديد
              </button>
            </div>
            <div className="space-y-2">
              {clients.map(client => (
                <button
                  key={client.id}
                  onClick={() => handleSelectClient(client)}
                  className="w-full text-right p-3 hover:bg-green-100 rounded-lg transition-colors text-gray-800 font-medium border-2 border-gray-200"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex-1 truncate">{client.company_name_ar || client.company_name_en || client.name_ar || client.name || 'عميل بدون اسم'}</span>
                    {client.subscription_tier && (
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 border">{getCategoryLabelArabic(client.subscription_tier)}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal d'édition ligne facture */}
      {showEditInvoiceLineModal && editingInvoiceLine && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => handleEditInvoiceLineCancel()}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] sm:w-[450px] max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">{editingInvoiceLine.product_name_ar}</h3>
              <button onClick={handleEditInvoiceLineCancel} className="text-gray-500 hover:text-gray-700 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">الكمية</label>
                  <button
                    type="button"
                    onClick={() =>
                      inputPad.open({
                        title: 'الكمية',
                        mode: 'number',
                        initialValue: editLineQuantity || '1',
                        min: 1,
                        onConfirm: (v) => setEditLineQuantity(String(parseInt(v) || 1)),
                      })
                    }
                    className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-green-500 focus:border-green-500 focus:outline-none transition-colors text-left bg-gray-50"
                  >
                    <span className="text-lg font-semibold text-gray-800">{editLineQuantity || '1'}</span>
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">الثمن (MAD)</label>
                  <button
                    type="button"
                    onClick={() =>
                      inputPad.open({
                        title: 'الثمن (MAD)',
                        mode: 'decimal',
                        dir: 'ltr',
                        initialValue: editLinePrice || '0',
                        min: 0,
                        onConfirm: (v) => setEditLinePrice((parseFloat(v) || 0).toFixed(2)),
                      })
                    }
                    className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-green-500 focus:border-green-500 focus:outline-none transition-colors text-left bg-gray-50"
                  >
                    <span className="text-lg font-semibold text-gray-800">{editLinePrice || '0.00'}</span>
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">نوع البيع</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(() => {
                      const pid = (editingInvoiceLine as any).primary_variant_id
                      const types = Array.from(
                        new Set((packagingVariantsByPrimaryId[pid] || []).map(v => v.unit_type))
                      )
                      const available = (types.length ? types : ['unit']).includes('unit') ? (types.length ? types : ['unit']) : ['unit', ...types]

                      return available.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            setEditLineUnitType(t)
                            const base = products.find(p => p.primary_variant_id === pid)
                            if (base) {
                              const pricing = getPricingForPrimaryAndUnitType(pid, t)
                              const nextPrice = getProductPriceWithTierOverride({ ...base, ...pricing } as any, editLinePricingTier)
                              setEditLinePrice(Number(nextPrice || 0).toFixed(2))
                            }
                          }}
                          className={`${editLineUnitType === t ? 'bg-green-600 text-white border-green-600' : 'bg-gray-50 text-gray-800 border-gray-200 hover:border-green-500'} border-2 rounded-xl py-3 font-bold transition-colors`}
                        >
                          {t === 'unit' ? 'وحدة' : t === 'carton' ? 'كرتون' : t === 'kilo' ? 'كيلو' : t}
                        </button>
                      ))
                    })()}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">نوع الزبون</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['auto', 'A', 'B', 'C', 'D', 'E'] as const).map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => {
                          setEditLinePricingTier(tier)
                          const pid = (editingInvoiceLine as any).primary_variant_id
                          const base = products.find(p => p.primary_variant_id === pid)
                          if (base) {
                            const pricing = getPricingForPrimaryAndUnitType(pid, editLineUnitType)
                            const nextPrice = getProductPriceWithTierOverride({ ...base, ...pricing } as any, tier)
                            setEditLinePrice(Number(nextPrice || 0).toFixed(2))
                          }
                        }}
                        className={`${editLinePricingTier === tier ? 'bg-green-600 text-white border-green-600' : 'bg-gray-50 text-gray-800 border-gray-200 hover:border-green-500'} border-2 rounded-xl py-3 font-bold transition-colors`}
                      >
                        {tier === 'auto' ? 'تلقائي' : getCategoryLabelArabic(tier)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-gray-200 bg-white flex gap-3">
              <button
                onClick={handleEditInvoiceLineConfirm}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-xl font-bold transition-colors shadow-lg"
              >
                تأكيد
              </button>
              <button
                onClick={handleEditInvoiceLineCancel}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-4 rounded-xl font-bold transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajout Client */}
      {showAddClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddClientModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 lg:p-8 max-w-md sm:max-w-lg w-full max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                إضافة عميل جديد
              </h2>
              <button
                type="button"
                onClick={() => setShowAddClientModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleAddClient} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">اسم الشركة (عربي)</label>
                <button
                  type="button"
                  onClick={() => {
                    inputPad.open({
                      title: 'اسم الشركة (عربي)',
                      mode: 'text',
                      initialValue: clientFormData.company_name_ar || '',
                      onConfirm: (v) => setClientFormData({ ...clientFormData, company_name_ar: v }),
                    })
                  }}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm sm:text-base bg-white text-right font-bold"
                >
                  {clientFormData.company_name_ar || 'أدخل اسم الشركة بالعربي...'}
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">اسم الشركة (English)</label>
                <button
                  type="button"
                  onClick={() => {
                    inputPad.open({
                      title: 'Company name (English)',
                      mode: 'alphanumeric',
                      dir: 'ltr',
                      initialValue: clientFormData.company_name_en || '',
                      onConfirm: (v) => setClientFormData({ ...clientFormData, company_name_en: v }),
                    })
                  }}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm sm:text-base bg-white text-left font-bold"
                >
                  {clientFormData.company_name_en || 'Enter company name in English...'}
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">اسم جهة الاتصال</label>
                <button
                  type="button"
                  onClick={() => {
                    inputPad.open({
                      title: 'اسم جهة الاتصال',
                      mode: 'text',
                      initialValue: clientFormData.contact_person_name || '',
                      onConfirm: (v) => setClientFormData({ ...clientFormData, contact_person_name: v }),
                    })
                  }}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm sm:text-base bg-white text-right font-bold"
                >
                  {clientFormData.contact_person_name || 'أدخل اسم جهة الاتصال...'}
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">البريد الإلكتروني</label>
                <button
                  type="button"
                  onClick={() => {
                    inputPad.open({
                      title: 'Email',
                      mode: 'alphanumeric',
                      dir: 'ltr',
                      initialValue: clientFormData.contact_person_email || '',
                      onConfirm: (v) => setClientFormData({ ...clientFormData, contact_person_email: v }),
                    })
                  }}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm sm:text-base bg-white text-left font-bold"
                >
                  {clientFormData.contact_person_email || 'example@email.com'}
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">الهاتف</label>
                <button
                  type="button"
                  onClick={() => {
                    inputPad.open({
                      title: 'الهاتف',
                      mode: 'alphanumeric',
                      dir: 'ltr',
                      initialValue: clientFormData.contact_person_phone || '',
                      onConfirm: (v) => setClientFormData({ ...clientFormData, contact_person_phone: v }),
                    })
                  }}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm sm:text-base bg-white text-left font-bold"
                >
                  {clientFormData.contact_person_phone || '06xxxxxxxx ou 07xxxxxxxx'}
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">العنوان</label>
                <button
                  type="button"
                  onClick={() => {
                    inputPad.open({
                      title: 'العنوان',
                      mode: 'text',
                      initialValue: clientFormData.address || '',
                      onConfirm: (v) => setClientFormData({ ...clientFormData, address: v }),
                    })
                  }}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm sm:text-base bg-white text-right font-bold whitespace-pre-wrap min-h-[80px]"
                >
                  {clientFormData.address || 'أدخل العنوان الكامل...'}
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">الفئة</label>
                <select
                  value={clientFormData.subscription_tier}
                  onChange={(e) => setClientFormData({ ...clientFormData, subscription_tier: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm sm:text-base"
                >
                  <option value="A">{getCategoryLabelArabic('A')}</option>
                  <option value="B">{getCategoryLabelArabic('B')}</option>
                  <option value="C">{getCategoryLabelArabic('C')}</option>
                  <option value="D">{getCategoryLabelArabic('D')}</option>
                  <option value="E">{getCategoryLabelArabic('E')}</option>
                </select>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white py-2 px-3 sm:px-4 rounded-lg hover:bg-indigo-700 transition font-medium text-sm sm:text-base"
                >
                  إضافة
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddClientModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 px-3 sm:px-4 rounded-lg hover:bg-gray-300 transition font-medium text-sm sm:text-base"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Liste d'attente */}
      {showDraftsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDraftsModal(false)}>
          <div className="bg-white rounded-xl p-6 w-[500px] max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Clock className="text-blue-600" />
                قائمة الانتظار ({onHoldInvoices.length})
              </h3>
              <button onClick={() => setShowDraftsModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            
            {onHoldInvoices.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <Clock size={48} className="mx-auto mb-2" />
                <p>لا توجد مبيعات في الانتظار</p>
              </div>
            ) : (
              <div className="space-y-3">
                {onHoldInvoices.map(invoice => (
                  <div key={invoice.id} className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-gray-800">{invoice.client_name || 'عميل عام'}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(invoice.created_at).toLocaleString('fr-FR')}
                        </p>
                        <p className="text-sm text-gray-600">
                          {invoice.lines?.length || 0} منتج/منتجات
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">{invoice.total_amount?.toFixed(2) || '0.00'} MAD</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => resumeInvoice(invoice)}
                        className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Play size={18} />
                        استئناف
                      </button>
                      <button
                        onClick={() => deleteInvoice(invoice.id)}
                        className="bg-red-500 text-white py-2 px-4 rounded-lg font-bold hover:bg-red-600 transition-colors"
                      >
                        <Trash size={18} />
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal d'édition de produit */}
      {showEditItemModal && editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => handleEditItemCancel()}>
          <div className="bg-white rounded-xl p-6 w-[400px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">{editingItem.name_ar}</h3>
              <button onClick={handleEditItemCancel} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الكمية</label>
                <button
                  type="button"
                  onClick={() =>
                    inputPad.open({
                      title: 'الكمية',
                      mode: 'number',
                      initialValue: editQuantity || '1',
                      min: 1,
                      onConfirm: (v) => setEditQuantity(String(parseInt(v) || 1)),
                    })
                  }
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none bg-white text-left font-bold"
                >
                  {editQuantity || '1'}
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الثمن (MAD)</label>
                <button
                  type="button"
                  onClick={() =>
                    inputPad.open({
                      title: 'الثمن (MAD)',
                      mode: 'decimal',
                      dir: 'ltr',
                      initialValue: editPrice || '0',
                      min: 0,
                      onConfirm: (v) => setEditPrice((parseFloat(v) || 0).toFixed(2)),
                    })
                  }
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none bg-white text-left font-bold"
                >
                  {editPrice || '0.00'}
                </button>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={handleEditItemConfirm}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-bold transition-colors"
                >
                  تأكيد
                </button>
                <button
                  onClick={handleEditItemCancel}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg font-bold transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation de vente - Affichage comme facture BA9ALINO */}
      {showConfirmationModal && currentInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowConfirmationModal(false)}>
          <div className="bg-white shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* En-tête de la facture - Style BA9ALINO */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="text-right">
                  <h1 className="text-4xl font-bold mb-2">{companyInfo.company_name_ar || companyInfo.company_name || 'BA9ALINO'}</h1>
                  {companyInfo.ice && <p className="text-blue-100 text-sm">ICE: {companyInfo.ice}</p>}
                  {companyInfo.address_ar && <p className="text-blue-100 text-sm">{companyInfo.address_ar}</p>}
                  {companyInfo.phone && <p className="text-blue-100 text-sm">الهاتف: {companyInfo.phone}</p>}
                  {companyInfo.email && <p className="text-blue-100 text-sm">البريد الإلكتروني: {companyInfo.email}</p>}
                </div>
                <div className="text-left">
                  <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg">
                    <p className="text-xs text-blue-100">رقم الفاتورة</p>
                    <p className="text-xl font-bold">{currentInvoice.invoice_number}</p>
                  </div>
                  <p className="text-sm text-blue-100 mt-2">{new Date(currentInvoice.created_at).toLocaleDateString('ar-DZ')}</p>
                </div>
              </div>
              
              {/* Option TVA dans l'en-tête */}
              <div className="mt-4 flex justify-center">
                <label className="flex items-center gap-2 cursor-pointer bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                  <input
                    type="checkbox"
                    checked={enableTVA}
                    onChange={(e) => setEnableTVA(e.target.checked)}
                    className="w-4 h-4 text-green-600 border-white rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-white">إضافة ضريبة القيمة المضافة (TVA)</span>
                </label>
              </div>
              
              {enableTVA && (
                <div className="mt-2 flex justify-center gap-4">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="tvaRate"
                      checked={tvaRate === 7}
                      onChange={() => setTvaRate(7)}
                      className="w-3 h-3 text-white border-white focus:ring-green-500"
                    />
                    <span className="text-xs text-white">7%</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="tvaRate"
                      checked={tvaRate === 10}
                      onChange={() => setTvaRate(10)}
                      className="w-3 h-3 text-white border-white focus:ring-green-500"
                    />
                    <span className="text-xs text-white">10%</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="tvaRate"
                      checked={tvaRate === 20}
                      onChange={() => setTvaRate(20)}
                      className="w-3 h-3 text-white border-white focus:ring-green-500"
                    />
                    <span className="text-xs text-white">20%</span>
                  </label>
                </div>
              )}
            </div>

            {/* Contenu de la facture */}
            <div className="flex-1 overflow-y-auto p-8">
              {/* Informations client */}
              <div className="mb-6 text-right">
                <p className="text-sm text-gray-600 mb-1">العميل:</p>
                <p className="text-lg font-bold text-gray-800">{currentInvoice.client_name}</p>
              </div>

              {/* Tableau des articles - Style facture */}
              <div className="mb-6">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-2 border-gray-800">
                      <th className="border border-gray-800 py-3 px-4 text-center font-bold text-gray-800">الكمية</th>
                      <th className="border border-gray-800 py-3 px-4 text-center font-bold text-gray-800">الوحدة</th>
                      <th className="border border-gray-800 py-3 px-4 text-right font-bold text-gray-800">السلعة</th>
                      <th className="border border-gray-800 py-3 px-4 text-left font-bold text-gray-800">الثمن</th>
                      <th className="border border-gray-800 py-3 px-4 text-left font-bold text-gray-800">المجموع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentInvoice.lines?.map((line, index) => (
                      <tr key={line.id} className="border border-gray-800">
                        <td className="border border-gray-800 py-3 px-4 text-center text-gray-700">{line.quantity}</td>
                        <td className="border border-gray-800 py-3 px-4 text-center text-gray-700">وحدة</td>
                        <td className="border border-gray-800 py-3 px-4 text-right font-medium text-gray-800">{line.product_name_ar}</td>
                        <td className="border border-gray-800 py-3 px-4 text-left text-gray-700">{line.unit_price.toFixed(2)} MAD</td>
                        <td className="border border-gray-800 py-3 px-4 text-left font-bold text-gray-800">{line.total.toFixed(2)} MAD</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Résumé financier */}
              <div className="flex justify-end mb-6">
                <div className="w-1/2">
                  <table className="w-full border-collapse">
                    <tbody>
                      <tr>
                        <td className="border border-gray-800 py-2 px-4 text-right text-gray-600">الإجمالي:</td>
                        <td className="border border-gray-800 py-2 px-4 text-left font-bold text-gray-800">{currentInvoice.subtotal.toFixed(2)} MAD</td>
                      </tr>
                      {enableTVA && (
                        <tr>
                          <td className="border border-gray-800 py-2 px-4 text-right text-gray-600">ضريبة القيمة المضافة ({tvaRate}%):</td>
                          <td className="border border-gray-800 py-2 px-4 text-left font-bold text-blue-600">{calculateTVA(currentInvoice.subtotal).toFixed(2)} MAD</td>
                        </tr>
                      )}
                      <tr>
                        <td className="border border-gray-800 py-2 px-4 text-right text-gray-600">المبلغ المدفوع:</td>
                        <td className="border border-gray-800 py-2 px-4 text-left font-bold text-green-600">{currentInvoice.paid_amount.toFixed(2)} MAD</td>
                      </tr>
                      <tr className="bg-gray-100">
                        <td className="border border-gray-800 py-3 px-4 text-right font-bold text-gray-800">
                          {enableTVA ? 'المجموع مع الضريبة:' : 'المجموع:'}
                        </td>
                        <td className="border border-gray-800 py-3 px-4 text-left font-bold text-lg text-blue-700">
                          {calculateWithTVA(currentInvoice.total_amount).toFixed(2)} MAD
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-800 py-2 px-4 text-right text-gray-600">الباقي:</td>
                        <td className={`border border-gray-800 py-2 px-4 text-left font-bold ${
                          calculateWithTVA(currentInvoice.total_amount) - currentInvoice.paid_amount > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {(calculateWithTVA(currentInvoice.total_amount) - currentInvoice.paid_amount).toFixed(2)} MAD
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Statut du paiement */}
              <div className="flex justify-center mb-6">
                <span className={`px-6 py-3 rounded-full text-lg font-bold text-white ${
                  currentInvoice.status === 'paid' ? 'bg-green-600' :
                  currentInvoice.status === 'partial' ? 'bg-yellow-600' :
                  currentInvoice.status === 'credit' ? 'bg-red-600' :
                  'bg-blue-600'
                }`}>
                  {currentInvoice.status === 'paid' ? 'مدفوعة' :
                   currentInvoice.status === 'partial' ? 'جزئية' :
                   currentInvoice.status === 'credit' ? 'دين' :
                   'مسودة'}
                </span>
              </div>
            </div>

            {/* Pied du modal - Boutons d'action */}
            <div className="bg-gray-100 p-4 border-t flex gap-2">
              <button
                onClick={() => setShowConfirmationModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 px-4 rounded-lg font-bold transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={() => {
                  setShowConfirmationModal(false)
                  setShowPaymentTypeModal(true)
                }}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Check size={16} />
                تأكيد البيع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de facture professionnelle après confirmation */}
      {showInvoiceModal && confirmedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowInvoiceModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* En-tête du modal */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-1">فاتورة مؤكدة</h2>
                  <p className="text-blue-100">تم تأكيد البيع بنجاح</p>
                </div>
                <div className="text-left">
                  <p className="text-sm text-blue-100">رقم الفاتورة</p>
                  <p className="text-xl font-bold">{confirmedInvoice.invoice_number}</p>
                </div>
              </div>
            </div>

            {/* Contenu de la facture */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* En-tête de l'entreprise */}
              <div className="text-center mb-6 border-b pb-4">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">{companyInfo.company_name_ar || companyInfo.company_name || 'BA9ALINO'}</h1>
                {companyInfo.ice && <p className="text-gray-600">ICE: {companyInfo.ice}</p>}
                {companyInfo.address_ar && <p className="text-gray-600">{companyInfo.address_ar}</p>}
                {companyInfo.phone && <p className="text-gray-600">الهاتف: {companyInfo.phone}</p>}
                {companyInfo.email && <p className="text-gray-600">البريد الإلكتروني: {companyInfo.email}</p>}
              </div>

              {/* Informations client et facture */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-bold text-gray-800 mb-2">معلومات الفاتورة</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">رقم الفاتورة:</span>
                      <span className="font-semibold">{confirmedInvoice.invoice_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">التاريخ:</span>
                      <span className="font-semibold">{new Date(confirmedInvoice.created_at).toLocaleDateString('ar-DZ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">الوقت:</span>
                      <span className="font-semibold">{new Date(confirmedInvoice.created_at).toLocaleTimeString('ar-DZ')}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-bold text-gray-800 mb-2">معلومات العميل</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">اسم العميل:</span>
                      <span className="font-semibold">{confirmedInvoice.client_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">حالة الدفع:</span>
                      <span className={`font-semibold px-2 py-1 rounded text-xs text-white ${
                        confirmedInvoice.status === 'paid' ? 'bg-green-600' :
                        confirmedInvoice.status === 'partial' ? 'bg-yellow-600' :
                        'bg-red-600'
                      }`}>
                        {confirmedInvoice.status === 'paid' ? 'مدفوعة' :
                         confirmedInvoice.status === 'partial' ? 'جزئية' : 'دين'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tableau des articles */}
              <div className="mb-6">
                <h3 className="font-bold text-gray-800 mb-3">تفاصيل المنتجات</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="text-center py-3 px-4 font-semibold text-gray-800">الكمية</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-800">الوحدة</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-800">السلعة</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-800">الثمن</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-800">المجموع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {confirmedInvoice.lines.map((line, index) => (
                        <tr key={line.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 text-center text-gray-700">{line.quantity}</td>
                          <td className="py-3 px-4 text-center text-gray-700">وحدة</td>
                          <td className="py-3 px-4 font-medium text-gray-800">{line.product_name_ar}</td>
                          <td className="py-3 px-4 text-left text-gray-700">{line.unit_price.toFixed(2)} MAD</td>
                          <td className="py-3 px-4 text-left font-semibold text-gray-800">{line.total.toFixed(2)} MAD</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Résumé financier */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-bold text-gray-800 mb-3">الملخص المالي</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">الإجمالي:</span>
                    <span className="font-semibold">{(confirmedInvoice.subtotal || 0).toFixed(2)} MAD</span>
                  </div>
                  {confirmedInvoice.enable_tva && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">ضريبة القيمة المضافة ({confirmedInvoice.tva_rate}%):</span>
                      <span className="font-semibold text-blue-600">{(confirmedInvoice.tva_amount || 0).toFixed(2)} MAD</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">المبلغ المدفوع:</span>
                    <span className="font-semibold text-green-600">{(confirmedInvoice.paid_amount || 0).toFixed(2)} MAD</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="font-bold text-gray-800">
                        {confirmedInvoice.enable_tva ? 'المجموع مع الضريبة:' : 'المجموع:'}
                      </span>
                      <span className="font-bold text-lg text-blue-700">
                        {(confirmedInvoice.total_with_tva || confirmedInvoice.total_amount || 0).toFixed(2)} MAD
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">الباقي:</span>
                      <span className={`font-semibold ${
                        (confirmedInvoice.total_with_tva || confirmedInvoice.total_amount || 0) - (confirmedInvoice.paid_amount || 0) > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {((confirmedInvoice.total_with_tva || confirmedInvoice.total_amount || 0) - (confirmedInvoice.paid_amount || 0)).toFixed(2)} MAD
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pied du modal */}
            <div className="bg-gray-50 p-4 border-t">
              {/* Options d'impression */}
              <div className="mb-4 p-4 bg-white rounded-lg border">
                <div className="mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={printTicket}
                      onChange={(e) => setPrintTicket(e.target.checked)}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="text-sm font-medium text-gray-700">طباعة الفاتورة</span>
                  </label>
                </div>
                
                {printTicket && (
                  <div className="mr-6 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="printFormat"
                        checked={printFormat === 'ticket'}
                        onChange={() => setPrintFormat('ticket')}
                        className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-600">Ticket (10/10)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="printFormat"
                        checked={printFormat === 'a4'}
                        onChange={() => setPrintFormat('a4')}
                        className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-600">A4</span>
                    </label>
                  </div>
                )}
              </div>
              
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  <p>شكرا لثقتكم بنا</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowInvoiceModal(false)
                      setShowConfirmationModal(true)
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
                  >
                    <DollarSign size={16} />
                    نوع الأداء
                  </button>
                  <button
                    onClick={() => {
                      setShowPrintTypeModal(true)
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
                  >
                    <Printer size={16} />
                    طباعة الفاتورة
                  </button>
                  <button
                    onClick={() => setShowInvoiceModal(false)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup "اختر نوع الطباعة" au-dessus de la facture */}
      {showPrintTypeModal && confirmedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]" onClick={() => {
          setShowPrintTypeModal(false)
          setShowInvoiceModal(false)
        }}>
          <div className="bg-white rounded-2xl shadow-2xl w-[420px] max-w-[92vw] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <span className="inline-block bg-gray-200 text-gray-800 font-bold px-4 py-2 rounded-md">
                اختر نوع الطباعة
              </span>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => {
                  handlePrint('invoice')
                  // Ne pas fermer la popup automatiquement
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-3"
              >
                <FileText size={20} />
                طباعة الفاتورة
              </button>
              <button
                onClick={() => {
                  handlePrint('ticket')
                  // Ne pas fermer la popup automatiquement
                }}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-3"
              >
                <Receipt size={20} />
                طباعة التذكرة
              </button>
              <button
                onClick={() => {
                  handlePrint('order')
                  // Ne pas fermer la popup automatiquement
                }}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-3"
              >
                <ClipboardList size={20} />
                طباعة الطلب
              </button>
              <button
                onClick={() => {
                  setShowPrintTypeModal(false)
                  setShowInvoiceModal(false)
                }}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-3"
              >
                <X size={20} />
                غلق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup نوع الأداء */}
      {showPaymentTypeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]" onClick={() => setShowPaymentTypeModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[420px] max-w-[92vw] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <span className="inline-block bg-gray-200 text-gray-800 font-bold px-4 py-2 rounded-md">
                نوع الأداء
              </span>
            </div>

            <div className="space-y-4 mb-6">
              <button
                onClick={() => {
                  setPaymentMethod('cash')
                  setPaymentDetails({ bank_name_ar: '', check_number: '', check_date: '', debt_due_date: '' })
                  // Mettre à jour le statut de la facture pour cash
                  if (currentInvoice) {
                    setCurrentInvoice({
                      ...currentInvoice,
                      status: 'paid',
                      paid_amount: currentInvoice.total_amount
                    })
                    setPaidAmount(currentInvoice.total_amount)
                  }
                }}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-3 ${
                  paymentMethod === 'cash' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                <DollarSign size={20} />
                نقدي
              </button>
              <button
                onClick={() => {
                  setPaymentMethod('check')
                  setPaymentDetails({ bank_name_ar: '', check_number: '', check_date: '', debt_due_date: '' })
                  // Mettre à jour le statut de la facture pour chèque (payé)
                  if (currentInvoice) {
                    setCurrentInvoice({
                      ...currentInvoice,
                      status: 'paid',
                      paid_amount: currentInvoice.total_amount
                    })
                    setPaidAmount(currentInvoice.total_amount)
                  }
                }}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-3 ${
                  paymentMethod === 'check' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                <FileText size={20} />
                شيك
              </button>
              <button
                onClick={() => {
                  setPaymentMethod('debt')
                  setPaymentDetails({ bank_name_ar: '', check_number: '', check_date: '', debt_due_date: '' })
                  // Mettre à jour le statut de la facture pour dette (crédit)
                  if (currentInvoice) {
                    setCurrentInvoice({
                      ...currentInvoice,
                      status: 'credit',
                      paid_amount: 0
                    })
                    setPaidAmount(0)
                  }
                }}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-3 ${
                  paymentMethod === 'debt' 
                    ? 'bg-orange-600 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                <Clock size={20} />
                دين (سلف)
              </button>
            </div>

            {/* Formulaire conditionnel */}
            {paymentMethod === 'check' && (
              <div className="space-y-4 mb-6 p-4 bg-blue-50 rounded-lg">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">البنك</label>
                  <select
                    value={paymentDetails.bank_name_ar}
                    onChange={(e) => setPaymentDetails({...paymentDetails, bank_name_ar: e.target.value})}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">اختر البنك</option>
                    <option value="البنك الشعبي">البنك الشعبي</option>
                    <option value="البنك الوطني للتجارة">البنك الوطني للتجارة</option>
                    <option value="التجاري وفا بنك">التجاري وفا بنك</option>
                    <option value="البركة">البركة</option>
                    <option value="الإفريقيا">الإفريقيا</option>
                    <option value="القرض الفلاحي">القرض الفلاحي</option>
                    <option value="سوسيتي جنرال">سوسيتي جنرال</option>
                    <option value="البنك المغربي للتجارة الخارجية">البنك المغربي للتجارة الخارجية</option>
                    <option value="البنك الأوروبي">البنك الأوروبي</option>
                    <option value="البنك الزراعي">البنك الزراعي</option>
                    <option value="الكريدي أغريكول">الكريدي أغريكول</option>
                    <option value="HSBC">HSBC</option>
                    <option value="BMCE">BMCE</option>
                    <option value="CIH">CIH</option>
                    <option value="اتصالات المغرب">اتصالات المغرب</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">رقم الشيك</label>
                  <button
                    type="button"
                    onClick={() =>
                      inputPad.open({
                        title: 'رقم الشيك',
                        mode: 'alphanumeric',
                        dir: 'ltr',
                        initialValue: paymentDetails.check_number || '',
                        onConfirm: (v) => setPaymentDetails({ ...paymentDetails, check_number: v }),
                      })
                    }
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none bg-white text-left font-bold"
                  >
                    {paymentDetails.check_number || 'أدخل رقم الشيك'}
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الشيك</label>
                  <input
                    type="date"
                    value={paymentDetails.check_date}
                    onChange={(e) => setPaymentDetails({...paymentDetails, check_date: e.target.value})}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {paymentMethod === 'debt' && (
              <div className="space-y-4 mb-6 p-4 bg-orange-50 rounded-lg">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الدين</label>
                  <input
                    type="date"
                    value={paymentDetails.debt_due_date}
                    onChange={(e) => setPaymentDetails({...paymentDetails, debt_due_date: e.target.value})}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  // Validation
                  if (paymentMethod === 'check' && (!paymentDetails.bank_name_ar || !paymentDetails.check_number || !paymentDetails.check_date)) {
                    alert('يرجى ملء جميع حقول الشيك')
                    return
                  }
                  if (paymentMethod === 'debt' && !paymentDetails.debt_due_date) {
                    alert('يرجى تحديد تاريخ الدين')
                    return
                  }
                  
                  setShowPaymentTypeModal(false)
                  processSaleAfterTVA()
                }}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-3"
              >
                <Check size={20} />
                تأكيد البيع
              </button>
              <button
                onClick={() => setShowPaymentTypeModal(false)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-3"
              >
                <X size={20} />
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
