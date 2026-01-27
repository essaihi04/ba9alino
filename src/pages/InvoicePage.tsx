import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Edit3, Printer, ArrowLeft, Save, Download, DollarSign, FileText, Clock, Check, X } from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { supabase } from '../lib/supabase'

interface OrderItem {
  id: string
  product_id: string
  product: {
    name_ar: string
    sku: string
  }
  quantity: number
  unit_price: number
  line_total: number
}

interface Order {
  id: string
  order_number: string
  client_id: string
  client: {
    id: string
    company_name_ar: string
    company_name_en?: string
    contact_person_email: string
    contact_person_phone: string
  }
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  order_date: string
  delivery_date?: string
  total_amount: number
  discount_amount: number
  tax_amount: number
  tva_rate?: number
  final_amount?: number
  payment_status: 'pending' | 'partial' | 'paid' | 'refunded'
  payment_method?: string
  shipping_address: {
    street: string
    city: string
    postal_code: string
    country: string
  }
  notes?: string
  items: OrderItem[]
}

interface InvoiceData {
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  clientInfo: {
    name: string
    phone: string
    address: string
  }
  items: InvoiceItem[]
  subtotal: number
  taxRate: number
  taxAmount: number
  discountAmount: number
  totalAmount: number
  notes: string
}

interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

interface InvoiceRecord {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  client_id: string | null
  client_name: string | null
  client_phone: string | null
  client_address: string | null
  company_name: string | null
  company_name_ar: string | null
  company_address: string | null
  company_address_ar: string | null
  company_phone: string | null
  company_email: string | null
  company_website: string | null
  company_ice: string | null
  company_tax_id: string | null
  company_logo_url: string | null
  order_id: string | null
  order_number: string | null
  subtotal: number | null
  tax_rate: number | null
  tax_amount: number | null
  discount_amount: number | null
  total_amount: number | null
  currency: string | null
  items: any[] | null
  notes: string | null
  status: string | null
  paid_amount: number | null
  remaining_amount: number | null
}

export default function InvoicePage() {
  const navigate = useNavigate()
  const { id: invoiceId } = useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'cheque' | 'credit'>('cash')
  const [companyInfo, setCompanyInfo] = useState<any>(null)
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null)
  const [loadedInvoice, setLoadedInvoice] = useState<InvoiceRecord | null>(null)
  
  // États pour la popup نوع الأداء
  const [showPaymentTypeModal, setShowPaymentTypeModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'check' | 'credit'>('cash')
  const [paymentDetails, setPaymentDetails] = useState({
    bank_name_ar: '',
    check_number: '',
    check_date: '',
    credit_due_date: ''
  })
  
  // États pour la popup des détails du produit
  const [showProductDetailsModal, setShowProductDetailsModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<InvoiceItem | null>(null)
  
  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    clientInfo: {
      name: '',
      phone: '',
      address: ''
    },
    items: [],
    subtotal: 0,
    taxRate: 0, // 0% par défaut, l'utilisateur peut choisir
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
    notes: ''
  })

  useEffect(() => {
    fetchCompanyInfo()
    if (invoiceId) {
      setEditingInvoiceId(invoiceId)
      loadInvoiceById(invoiceId)
      return
    }
    loadOrderData()
  }, [])

  const isLocked = Boolean(order && order.status === 'delivered' && order.payment_status === 'paid')

  useEffect(() => {
    if (isLocked && isEditing) {
      setIsEditing(false)
    }
  }, [isLocked, isEditing])

  const loadInvoiceById = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      const inv = data as InvoiceRecord
      setLoadedInvoice(inv)

      if (inv.company_name || inv.company_name_ar) {
        setCompanyInfo({
          company_name: inv.company_name,
          company_name_ar: inv.company_name_ar,
          address: inv.company_address,
          address_ar: inv.company_address_ar,
          phone: inv.company_phone,
          email: inv.company_email,
          website: inv.company_website,
          ice: inv.company_ice,
          tax_id: inv.company_tax_id,
          logo_url: inv.company_logo_url,
        })
      }

      const itemsRaw = Array.isArray(inv.items) ? inv.items : []
      const items: InvoiceItem[] = itemsRaw.map((it: any) => ({
        description: String(it.description ?? it.description_ar ?? ''),
        quantity: Number(it.quantity ?? 0),
        unitPrice: Number(it.unitPrice ?? it.unit_price ?? 0),
        total: Number(it.total ?? it.line_total ?? 0),
      }))

      setInvoiceData(prev => ({
        ...prev,
        invoiceNumber: inv.invoice_number || '',
        invoiceDate: inv.invoice_date || prev.invoiceDate,
        dueDate: inv.due_date || prev.dueDate,
        clientInfo: {
          name: inv.client_name || '',
          phone: inv.client_phone || '',
          address: inv.client_address || '',
        },
        items,
        subtotal: Number(inv.subtotal ?? 0),
        taxRate: Number(inv.tax_rate ?? prev.taxRate),
        taxAmount: Number(inv.tax_amount ?? 0),
        discountAmount: Number(inv.discount_amount ?? 0),
        totalAmount: Number(inv.total_amount ?? 0),
        notes: inv.notes || '',
      }))

      // If invoice is linked to an order, load order status/payment to decide if invoice is locked
      if (inv.order_id) {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('id, order_number, client_id, status, payment_status, payment_method, order_date, total_amount, discount_amount, tax_amount')
          .eq('id', inv.order_id)
          .maybeSingle()

        if (orderError) {
          console.error('Error loading order for invoice lock:', orderError)
        } else if (orderData) {
          setOrder(orderData as any)
        }
      }
    } catch (error) {
      console.error('Error loading invoice:', error)
      alert('فشل تحميل الفاتورة')
      navigate('/invoices')
    }
  }

  const fetchCompanyInfo = async () => {
    try {
      // Supabase first (source of truth)
      const { data, error } = await supabase
        .from('company_info')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data && !error) {
        setCompanyInfo(data)
        localStorage.setItem('companyInfo', JSON.stringify(data))
        return
      }

      // Fallback: localStorage (do NOT inject defaults)
      const localData = localStorage.getItem('companyInfo')
      if (localData) {
        setCompanyInfo(JSON.parse(localData))
      } else {
        setCompanyInfo(null)
      }
    } catch (error) {
      console.error('Error fetching company info:', error)
    }
  }

  const loadOrderData = async () => {
    // Load order data from sessionStorage
    const storedOrderData = sessionStorage.getItem('invoiceOrderData')
    
    if (storedOrderData) {
      let orderData = JSON.parse(storedOrderData)

      // If client relation is missing, fetch client details from database
      if (!orderData.client && (orderData.client_id || orderData.client?.id)) {
        const clientId = orderData.client_id || orderData.client?.id
        try {
          const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('id, company_name_ar, company_name_en, contact_person_phone, address, city')
            .eq('id', clientId)
            .maybeSingle()

          if (clientError) {
            console.error('Error fetching client for invoice:', clientError)
          } else if (clientData) {
            orderData.client = clientData
          }
        } catch (e) {
          console.error('Unexpected error fetching client for invoice:', e)
        }
      }
      
      // If order items are not loaded, fetch them from the database
      if (!orderData.items || orderData.items.length === 0) {
        try {
          const { data: orderItems, error: itemsError } = await supabase
            .from('order_items')
            .select(`
              id,
              product_id,
              product_name_ar,
              product_sku,
              quantity,
              unit_price,
              line_total,
              product:products(id, name_ar, sku, image_url)
            `)
            .eq('order_id', orderData.id)
          
          if (itemsError) {
            console.error('Error fetching order items:', itemsError)
          } else {
            orderData.items = orderItems || []
          }
        } catch (error) {
          console.error('Error fetching order items:', error)
        }
      }
      
      setOrder(orderData)
      
      // Initialize invoice data with order data
      const items: InvoiceItem[] = orderData.items?.map((item: any) => ({
        description: item.product?.name_ar || item.product_name_ar || item.name_ar || item.description || 'Produit sans nom',
        quantity: item.quantity,
        unitPrice: item.unit_price,
        total: item.line_total
      })) || []

      const subtotal = items.reduce((sum, item) => sum + item.total, 0)
      // Use TVA rate and tax amount from order data first, then calculate if needed
      const orderTvaRate = order?.tva_rate || 0
      const taxAmount = order?.tax_amount || (subtotal * (orderTvaRate / 100))
      const totalAmount = order?.final_amount || (subtotal + taxAmount - (order?.discount_amount || 0))

      // Build address from client address (default) or fallback to shipping_address
      let address = ''
      if (orderData.client?.address) {
        address = orderData.client.address
        if (orderData.client?.city) {
          address = `${address}, ${orderData.client.city}`
        }
      } else if (orderData.shipping_address) {
        const parts = [
          orderData.shipping_address.street,
          orderData.shipping_address.city,
          orderData.shipping_address.postal_code,
          orderData.shipping_address.country
        ].filter(part => part && part.trim() !== '')
        address = parts.join(', ')
        
        // If still empty, try to get from delivery_address field
        if (!address && orderData.delivery_address) {
          address = orderData.delivery_address
        }
      } else if (orderData.delivery_address) {
        address = orderData.delivery_address
      }

      setInvoiceData(prev => ({
        ...prev,
        invoiceNumber: `FAC-${orderData.order_number}`,
        clientInfo: {
          name: orderData.client?.company_name_ar || orderData.client?.company_name_en || '',
          phone: orderData.client?.contact_person_phone || orderData.phone || '',
          address: address
        },
        items,
        subtotal,
        taxAmount,
        taxRate: orderTvaRate, // Update taxRate to match order's TVA
        discountAmount: order?.discount_amount || 0,
        totalAmount,
        notes: order?.notes || ''
      }))
    }
  }

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const updatedItems = [...invoiceData.items]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    
    // Recalculate totals
    const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0)
    const taxAmount = subtotal * (invoiceData.taxRate / 100)
    const totalAmount = subtotal + taxAmount - invoiceData.discountAmount

    setInvoiceData(prev => ({
      ...prev,
      items: updatedItems,
      subtotal,
      taxAmount,
      totalAmount
    }))
  }

  const addItem = () => {
    const newItem: InvoiceItem = {
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
    }
    
    const updatedItems = [...invoiceData.items, newItem]
    setInvoiceData(prev => ({
      ...prev,
      items: updatedItems
    }))
  }

  const removeItem = (index: number) => {
    const updatedItems = invoiceData.items.filter((_, i) => i !== index)
    
    // Recalculate totals
    const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0)
    const taxAmount = subtotal * (invoiceData.taxRate / 100)
    const totalAmount = subtotal + taxAmount - invoiceData.discountAmount

    setInvoiceData(prev => ({
      ...prev,
      items: updatedItems,
      subtotal,
      taxAmount,
      totalAmount
    }))
  }

  const updateTaxRate = (newTaxRate: number) => {
    const taxAmount = invoiceData.subtotal * (newTaxRate / 100)
    const totalAmount = invoiceData.subtotal + taxAmount - invoiceData.discountAmount
    
    setInvoiceData(prev => ({
      ...prev,
      taxRate: newTaxRate,
      taxAmount,
      totalAmount
    }))
  }

  const handlePrint = () => {
    // Create print styles with adjusted positioning
    const printStyles = `
      @media print {
        @page {
          size: portrait;
          margin: 3mm;
        }
        body * {
          visibility: hidden;
        }
        #invoice-content, #invoice-content * {
          visibility: visible;
        }
        #invoice-content {
          position: absolute;
          right: 3mm;
          top: 3mm;
          bottom: auto;
          width: calc(100% - 6mm);
        }
      }
    `
    
    // Create and append style element
    const styleElement = document.createElement('style')
    styleElement.innerHTML = printStyles
    document.head.appendChild(styleElement)
    
    // Trigger print
    window.print()
    
    // Remove styles after print
    setTimeout(() => {
      document.head.removeChild(styleElement)
    }, 1000)
  }

  const handleDownloadPDF = async () => {
    const element = document.getElementById('invoice-content')
    if (!element) return

    try {
      // Adjust positioning for top alignment
      const originalStyle = element.style.cssText
      element.style.cssText = `
        transform: scale(1.45);
        transform-origin: top right;
        width: calc(100% + 40px);
        max-width: 235mm;
        margin: 0 auto;
        padding: 1mm;
        box-sizing: border-box;
        background: white;
        position: relative;
        left: 50px;
        top: 0;
        right: 0;
        bottom: auto;
        transform-origin: top right;
      `

      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        width: 834,  // Reduced by 10px (844 - 10)
        height: 1123, // A4 portrait height in pixels at 96 DPI
        windowWidth: 834,
        windowHeight: 1123,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0
      })
      
      // Restore original style
      element.style.cssText = originalStyle
      
      const imgData = canvas.toDataURL('image/png', 1.0)
      const pdf = new jsPDF('p', 'mm', 'a4') // 'p' for portrait
      
      // Page dimensions
      const pdfWidth = pdf.internal.pageSize.getWidth()   // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight() // 297mm
      
      // Image dimensions
      const imgWidth = pdfWidth + 10.6   // Original width + adjustment
      const imgHeight = pdfHeight * 0.95  // 95% of page height
      const x = pdfWidth - imgWidth + 13.3 // Right edge adjustment
      const y = 10 // Position at top with 10mm margin
      
      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight, '', 'FAST')
      pdf.save(`facture_${invoiceData.invoiceNumber}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('حدث خطأ أثناء إنشاء الملف PDF')
    }
  }

  const handleSaveInvoice = async () => {
    if (isLocked) {
      alert('هذه الفاتورة مقفلة لأن الطلب تم تسليمه وتم دفعه')
      return
    }
    if (!companyInfo) {
      alert('يرجى ملء معلومات الشركة أولاً')
      return
    }
    let resolvedClientName = invoiceData.clientInfo.name || ''
    if (!resolvedClientName) {
      const fromOrder = order?.client?.company_name_ar || order?.client?.company_name_en
      resolvedClientName = fromOrder || ''

      if (!resolvedClientName) {
        const clientId = order?.client_id || order?.client?.id
        if (clientId) {
          try {
            const { data: clientData } = await supabase
              .from('clients')
              .select('company_name_ar, company_name_en')
              .eq('id', clientId)
              .maybeSingle()
            resolvedClientName = clientData?.company_name_ar || clientData?.company_name_en || ''
          } catch {
          }
        }
      }

      if (resolvedClientName) {
        setInvoiceData((prev) => ({
          ...prev,
          clientInfo: {
            ...prev.clientInfo,
            name: resolvedClientName,
          },
        }))
      } else {
        alert('يرجى ملء اسم العميل')
        return
      }
    }
    if (invoiceData.items.length === 0 || invoiceData.items.every(item => !item.description)) {
      alert('يرجى إضافة منتجات للفاتورة')
      return
    }
    
    try {
      const isEditMode = Boolean(editingInvoiceId)
      let paidAmount = isEditMode ? Number(loadedInvoice?.paid_amount ?? 0) : 0
      const currency = isEditMode ? (loadedInvoice?.currency || 'MAD') : 'MAD'
      const clientId = isEditMode
        ? (loadedInvoice?.client_id || order?.client_id || order?.client?.id || '00000000-0000-0000-0000-000000000000')
        : (order?.client_id || order?.client?.id || '00000000-0000-0000-0000-000000000000')

      // Check for existing payments if this is a new invoice linked to an order
      if (!isEditMode && order?.id) {
        const { data: existingPayments } = await supabase
          .from('payments')
          .select('amount')
          .eq('order_id', order.id)
          .eq('status', 'completed')

        if (existingPayments && existingPayments.length > 0) {
          paidAmount = existingPayments.reduce((sum, p) => sum + p.amount, 0)
        }
      }

      const invoicePayload = {
        invoice_number: invoiceData.invoiceNumber,
        invoice_date: invoiceData.invoiceDate,
        due_date: invoiceData.dueDate,
        client_id: clientId,
        client_name: resolvedClientName,
        client_phone: invoiceData.clientInfo.phone,
        client_address: invoiceData.clientInfo.address,
        company_name: companyInfo.company_name,
        company_name_ar: companyInfo.company_name_ar,
        company_address: companyInfo.address,
        company_address_ar: companyInfo.address_ar,
        company_phone: companyInfo.phone,
        company_email: companyInfo.email,
        company_website: companyInfo.website,
        company_ice: companyInfo.ice,
        company_tax_id: companyInfo.tax_id,
        company_logo_url: companyInfo.logo_url,
        order_id: (isEditMode ? (loadedInvoice?.order_id || null) : (order?.id || null)),
        order_number: (isEditMode ? (loadedInvoice?.order_number || null) : (order?.order_number || null)),
        subtotal: invoiceData.subtotal,
        tax_rate: invoiceData.taxRate,
        tax_amount: invoiceData.taxAmount,
        discount_amount: invoiceData.discountAmount,
        total_amount: invoiceData.totalAmount,
        currency,
        items: invoiceData.items,
        notes: invoiceData.notes,
        status: paidAmount >= invoiceData.totalAmount ? 'paid' : (isEditMode ? (loadedInvoice?.status || 'draft') : 'sent'),
        paid_amount: paidAmount,
        remaining_amount: Math.max(0, invoiceData.totalAmount - paidAmount)
      }

      const { error } = isEditMode
        ? await supabase.from('invoices').update(invoicePayload).eq('id', editingInvoiceId as string)
        : await supabase.from('invoices').insert([invoicePayload])
      if (error) throw error
      
      alert('تم حفظ الفاتورة بنجاح')
      navigate('/invoices')
    } catch (error: any) {
      console.error('Error saving invoice:', error)
      alert('فشل حفظ الفاتورة: ' + (error.message || 'خطأ غير معروف'))
    }
  }

  // Handle product click to show details
  const handleProductClick = (item: InvoiceItem) => {
    setSelectedProduct(item)
    setShowProductDetailsModal(true)
  }

  const confirmSale = async () => {
    if (isLocked) {
      alert('تم تسليم الطلب ودفعه، لا يمكن تأكيد البيع أو تعديل الفاتورة')
      return
    }
    try {
      if (!companyInfo) {
        alert('يرجى ملء معلومات الشركة أولاً')
        return
      }
      let resolvedClientName = invoiceData.clientInfo.name || ''
      if (!resolvedClientName) {
        const fromOrder = order?.client?.company_name_ar || order?.client?.company_name_en
        resolvedClientName = fromOrder || ''

        if (!resolvedClientName) {
          const clientId = order?.client_id || order?.client?.id
          if (clientId) {
            try {
              const { data: clientData } = await supabase
                .from('clients')
                .select('company_name_ar, company_name_en')
                .eq('id', clientId)
                .maybeSingle()
              resolvedClientName = clientData?.company_name_ar || clientData?.company_name_en || ''
            } catch {
            }
          }
        }

        if (resolvedClientName) {
          setInvoiceData((prev) => ({
            ...prev,
            clientInfo: {
              ...prev.clientInfo,
              name: resolvedClientName,
            },
          }))
        } else {
          alert('يرجى ملء اسم العميل')
          return
        }
      }
      if (invoiceData.items.length === 0 || invoiceData.items.every(item => !item.description)) {
        alert('يرجى إضافة منتجات للفاتورة')
        return
      }

      const isEditMode = Boolean(editingInvoiceId)
      const currency = isEditMode ? (loadedInvoice?.currency || 'MAD') : 'MAD'
      const clientId = isEditMode
        ? (loadedInvoice?.client_id || order?.client_id || order?.client?.id || '00000000-0000-0000-0000-000000000000')
        : (order?.client_id || order?.client?.id || '00000000-0000-0000-0000-000000000000')

      // Unified payment method handling
      const paymentMethodDB = paymentMethod // Use as-is (cash, check, credit)
      const orderPaymentStatus = paymentMethod === 'credit' ? 'unpaid' : 'paid'
      const invoiceStatus = paymentMethod === 'credit' ? 'sent' : 'paid'

      const invoicePayloadBase: any = {
        invoice_number: invoiceData.invoiceNumber,
        invoice_date: invoiceData.invoiceDate,
        due_date: invoiceData.dueDate,
        client_id: clientId,
        client_name: resolvedClientName,
        client_phone: invoiceData.clientInfo.phone,
        client_address: invoiceData.clientInfo.address,
        company_name: companyInfo.company_name,
        company_name_ar: companyInfo.company_name_ar,
        company_address: companyInfo.address,
        company_address_ar: companyInfo.address_ar,
        company_phone: companyInfo.phone,
        company_email: companyInfo.email,
      }

      const invoiceToSave: any = {
        invoice_number: invoiceData.invoiceNumber,
        invoice_date: invoiceData.invoiceDate,
        due_date: invoiceData.dueDate,
        client_id: clientId,
        client_name: resolvedClientName || null,
        client_phone: invoiceData.clientInfo.phone,
        client_address: invoiceData.clientInfo.address,
        subtotal: invoiceData.subtotal,
        tax_rate: invoiceData.taxRate,
        tax_amount: invoiceData.taxAmount,
        discount_amount: invoiceData.discountAmount,
        total_amount: invoiceData.totalAmount,
        notes: invoiceData.notes,
        status: invoiceStatus,
        payment_method: paymentMethodDB,
        items: invoiceData.items,
        created_at: new Date().toISOString()
      }

      if (order?.id) {
        invoiceToSave.order_id = order.id
        invoiceToSave.order_number = order.order_number
      }

      if (paymentMethod === 'check') {
        invoiceToSave.bank_name = paymentDetails.bank_name_ar
        invoiceToSave.check_number = paymentDetails.check_number
        invoiceToSave.check_date = paymentDetails.check_date
      }

      if (paymentMethod === 'credit') {
        invoiceToSave.credit_due_date = paymentDetails.credit_due_date
      }

      const tryInsertInvoice = async (payload: any) => {
        return await supabase
          .from('invoices')
          .insert(payload)
          .select()
          .single()
      }

      let { data: savedInvoice, error: invoiceError } = await tryInsertInvoice(invoiceToSave)

      if (invoiceError) {
        const msg = String((invoiceError as any)?.message || '')
        const code = String((invoiceError as any)?.code || '')
        const missingCols = code === 'PGRST204' || code === '42703' || msg.includes("Could not find the '")

        if (missingCols) {
          const stripped: any = { ...invoiceToSave }
          delete stripped.items
          delete stripped.payment_method
          delete stripped.discount_amount
          delete stripped.created_at
          delete stripped.bank_name
          delete stripped.check_number
          delete stripped.check_date
          delete stripped.credit_due_date
          ;({ data: savedInvoice, error: invoiceError } = await tryInsertInvoice(stripped))
        }
      }

      if (invoiceError) {
        console.error('Error saving invoice:', invoiceError)
        throw invoiceError
      }

      // Ensure invoice payment fields are consistent with selected payment method
      if (savedInvoice?.id) {
        try {
          const isPaidNow = paymentMethod === 'cash' || paymentMethod === 'check'
          const invoicePaymentUpdate: any = isPaidNow
            ? {
                paid_amount: invoiceData.totalAmount,
                remaining_amount: 0,
                payment_status: 'paid'
              }
            : {
                paid_amount: 0,
                remaining_amount: invoiceData.totalAmount,
                payment_status: 'credit'
              }

          const tryUpdateInvoice = async (payload: any) => {
            return await supabase
              .from('invoices')
              .update(payload)
              .eq('id', savedInvoice.id)
          }

          let { error: invoiceUpdateError } = await tryUpdateInvoice(invoicePaymentUpdate)
          if (invoiceUpdateError) {
            const msg = String((invoiceUpdateError as any)?.message || '')
            const code = String((invoiceUpdateError as any)?.code || '')
            const missingCols = code === 'PGRST204' || code === '42703' || msg.includes("Could not find the '")

            if (missingCols) {
              const stripped: any = { ...invoicePaymentUpdate }
              delete stripped.paid_amount
              delete stripped.remaining_amount
              delete stripped.payment_status
              ;({ error: invoiceUpdateError } = await tryUpdateInvoice(stripped))
            }
          }

          if (invoiceUpdateError) {
            console.warn('Could not update invoice payment fields:', invoiceUpdateError)
          }
        } catch (e) {
          console.warn('Could not update invoice payment fields:', e)
        }
      }

      // Try to update order by ID or by order_number
      let orderId = order?.id
      let orderNumber = order?.order_number

      // If no order ID, try to get from sessionStorage or by order_number
      if (!orderId) {
        // Try to get from sessionStorage
        const storedOrderData = sessionStorage.getItem('invoiceOrderData')
        if (storedOrderData) {
          const orderData = JSON.parse(storedOrderData)
          orderId = orderData.id
          orderNumber = orderData.order_number
        }
      }

      if (orderId) {
        try {
          const orderUpdate: any = {
            payment_status: orderPaymentStatus,
            payment_method: paymentMethodDB
          }

          const tryUpdateOrder = async (payload: any) => {
            return await supabase
              .from('orders')
              .update(payload)
              .eq('id', orderId)
          }

          let { error: orderUpdateError } = await tryUpdateOrder(orderUpdate)

          if (orderUpdateError) {
            const msg = String((orderUpdateError as any)?.message || '')
            const code = String((orderUpdateError as any)?.code || '')
            const missingCols = code === 'PGRST204' || code === '42703' || msg.includes("Could not find the '")

            if (missingCols) {
              // Retry with minimal guaranteed columns
              const stripped: any = {
                payment_status: orderPaymentStatus
              }
              const retry = await tryUpdateOrder(stripped)
              orderUpdateError = retry.error
            }
          }

          if (orderUpdateError) {
            console.error('❌ Error updating order:', orderUpdateError)
            throw orderUpdateError
          }
        } catch (e) {
          console.warn('Could not update order from invoice confirmation:', e)
        }
      } else if (orderNumber) {
        // Fallback: try to update by order_number
        try {
          const orderUpdate: any = {
            payment_status: orderPaymentStatus,
            payment_method: paymentMethodDB
          }

          const tryUpdateOrder = async (payload: any) => {
            return await supabase
              .from('orders')
              .update(payload)
              .eq('order_number', orderNumber)
          }

          let { error: orderUpdateError } = await tryUpdateOrder(orderUpdate)

          if (orderUpdateError) {
            const msg = String((orderUpdateError as any)?.message || '')
            const code = String((orderUpdateError as any)?.code || '')
            const missingCols = code === 'PGRST204' || code === '42703' || msg.includes("Could not find the '")

            if (missingCols) {
              const stripped: any = {
                payment_status: orderPaymentStatus
              }
              const retry = await tryUpdateOrder(stripped)
              orderUpdateError = retry.error
            }
          }

          if (orderUpdateError) {
            console.error('❌ Error updating order by order_number:', orderUpdateError)
            throw orderUpdateError
          }
        } catch (e) {
          console.warn('Could not update order by order_number from invoice confirmation:', e)
        }
      } else {
        console.warn('❌ No order ID or order_number found - cannot update order payment status')
      }

      // Insert payment record if not credit
      if (paymentMethod !== 'credit') {
        try {
          const paymentDataToInsert: any = {
            order_id: orderId || null,
            invoice_id: savedInvoice.id,
            payment_number: `PAY-${Date.now()}`,
            client_id: clientId,
            amount: invoiceData.totalAmount,
            payment_method: paymentMethodDB,
            payment_date: new Date().toISOString().split('T')[0],
            status: 'completed'
          }

          // إضافة معلومات الشيك إذا كانت الطريقة شيك
          if (paymentMethod === 'check' && paymentDetails.check_number) {
            paymentDataToInsert.check_bank = paymentDetails.bank_name_ar
            paymentDataToInsert.check_number = paymentDetails.check_number
            paymentDataToInsert.check_deposit_date = paymentDetails.check_date
          }

          await supabase.from('payments').insert(paymentDataToInsert)
        } catch (e) {
          console.warn('Could not insert payment from invoice confirmation:', e)
        }
      }

      setShowPaymentTypeModal(false)
      
      // Notify other pages about the payment update
      window.dispatchEvent(new CustomEvent('payment-updated', { 
        detail: { 
          orderId: orderId || null,
          invoiceId: savedInvoice.id,
          paymentStatus: orderPaymentStatus,
          paymentMethod: paymentMethodDB
        } 
      }))

      window.dispatchEvent(new CustomEvent('order-payment-updated', {
        detail: {
          orderId: orderId || null,
          invoiceId: savedInvoice.id,
          paymentStatus: orderPaymentStatus,
          paymentMethod: paymentMethodDB
        }
      }))
      
      alert('تم تأكيد البيع بنجاح')
      navigate('/orders')
    } catch (error: any) {
      console.error('Error confirming sale:', error)
      alert(`حدث خطأ أثناء تأكيد البيع: ${error?.message || 'خطأ غير معروف'}`)
    }
  }

  if (!order && !invoiceId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">لا توجد بيانات للطلب</p>
          <button
            onClick={() => navigate('/orders')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            العودة للطلبات
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(invoiceId ? '/invoices' : '/orders')}
                className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                {isLocked ? 'عرض فاتورة' : (invoiceId ? 'تعديل فاتورة' : 'إنشاء فاتورة')}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              {!isLocked && (
                isEditing ? (
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    <Save size={16} />
                    <span>حفظ</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    <Edit3 size={16} />
                    <span>تعديل</span>
                  </button>
                )
              )}
              {!isLocked && (
                <button
                  onClick={() => {
                    setPaymentMethod('cash')
                    setShowPaymentTypeModal(true)
                  }}
                  className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  <Save size={16} />
                  <span>تأكيد البيع</span>
                </button>
              )}
              <button
                onClick={handleDownloadPDF}
                className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
              >
                <Download size={16} />
                <span>تحميل PDF</span>
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                <Printer size={16} />
                <span>طباعة</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Content */}
      <div className="max-w-5xl mx-auto p-2">
        <div id="invoice-content" className="bg-white rounded-lg shadow-lg p-4" style={{ direction: 'rtl', fontSize: '12px' }}>
          {/* Invoice Header */}
          <div className="border-b-4 border-blue-600 pb-3 mb-3">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-1">فاتورة</h2>
                <p className="text-gray-600 text-sm">رقم الفاتورة: {invoiceData.invoiceNumber}</p>
              </div>
              <div className="text-left bg-blue-50 p-2 rounded-lg">
                <p className="text-gray-700 font-semibold text-xs">التاريخ: {invoiceData.invoiceDate}</p>
              </div>
            </div>
          </div>

          {/* Company Info */}
          <div className="mb-4 bg-gray-50 p-2 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-1">معلومات الشركة</h3>
                <div className="flex items-start space-x-2">
                  {companyInfo?.logo_url && (
                    <img 
                      src={companyInfo.logo_url} 
                      alt="Company Logo" 
                      className="w-10 h-10 object-contain rounded"
                    />
                  )}
                  <div className="text-xs">
                    <p className="text-gray-700 font-semibold">{companyInfo?.company_name_ar || '—'}</p>
                    <p className="text-gray-600">{companyInfo?.address_ar || '—'}</p>
                    <p className="text-gray-600">الهاتف: {companyInfo?.phone || '—'}</p>
                    <p className="text-gray-600">البريد: {companyInfo?.email || '—'}</p>
                    {companyInfo?.website && <p className="text-gray-600">الموقع: {companyInfo.website}</p>}
                    {companyInfo?.ice && <p className="text-gray-600">ICE: {companyInfo.ice}</p>}
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">معلومات الزبون</h3>
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={invoiceData.clientInfo.name}
                      onChange={(e) => setInvoiceData(prev => ({
                        ...prev,
                        clientInfo: { ...prev.clientInfo, name: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="اسم الزبون"
                    />
                    <input
                      type="text"
                      value={invoiceData.clientInfo.phone}
                      onChange={(e) => setInvoiceData(prev => ({
                        ...prev,
                        clientInfo: { ...prev.clientInfo, phone: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="رقم الهاتف"
                    />
                    <input
                      type="text"
                      value={invoiceData.clientInfo.address}
                      onChange={(e) => setInvoiceData(prev => ({
                        ...prev,
                        clientInfo: { ...prev.clientInfo, address: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="العنوان"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-gray-700 font-semibold">{invoiceData.clientInfo.name}</p>
                    <p className="text-gray-600">{invoiceData.clientInfo.phone}</p>
                    <p className="text-gray-600">{invoiceData.clientInfo.address}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tax Rate Selection */}
          {isEditing && (
            <div className="mb-4 bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center space-x-4 space-x-reverse">
                <label className="text-sm font-semibold text-gray-700">نسبة الضريبة:</label>
                <select
                  value={invoiceData.taxRate}
                  onChange={(e) => updateTaxRate(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value={0}>بدون ضريبة (0%)</option>
                  <option value={7}>ضريبة 7%</option>
                  <option value={10}>ضريبة 10%</option>
                  <option value={20}>ضريبة 20%</option>
                </select>
                <span className="text-sm text-gray-600">
                  ({(invoiceData.subtotal * (invoiceData.taxRate / 100)).toFixed(2)} MAD)
                </span>
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-base font-bold text-gray-900">تفاصيل المنتجات</h3>
              {isEditing && (
                <button
                  onClick={addItem}
                  className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 transition"
                >
                  + إضافة منتج
                </button>
              )}
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded">
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 px-2 py-1 text-right font-bold text-gray-900">الوصف</th>
                    <th className="border border-gray-300 px-2 py-1 text-center font-bold text-gray-900">الكمية</th>
                    <th className="border border-gray-300 px-2 py-1 text-right font-bold text-gray-900">السعر (MAD)</th>
                    <th className="border border-gray-300 px-2 py-1 text-right font-bold text-gray-900">الإجمالي (MAD)</th>
                    {isEditing && <th className="border border-gray-300 px-2 py-1 text-center font-bold text-gray-900">إجراء</th>}
                  </tr>
                </thead>
                <tbody>
                  {invoiceData.items.map((item, index) => (
                    <tr 
                      key={index} 
                      className={`hover:bg-gray-50 ${!isEditing ? 'cursor-pointer' : ''}`}
                      onClick={() => !isEditing && handleProductClick(item)}
                    >
                      <td className="border border-gray-300 px-2 py-1">
                        {isEditing ? (
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            className="w-full px-1 py-0 border border-gray-200 rounded text-xs"
                          />
                        ) : (
                          <span className="font-medium text-xs">{item.description}</span>
                        )}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const quantity = parseInt(e.target.value) || 0
                              const total = quantity * item.unitPrice
                              updateItem(index, 'quantity', quantity)
                              updateItem(index, 'total', total)
                            }}
                            className="w-12 px-1 py-0 border border-gray-200 rounded text-center text-xs"
                          />
                        ) : (
                          <span className="font-semibold text-xs">{item.quantity}</span>
                        )}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => {
                              const unitPrice = parseFloat(e.target.value) || 0
                              const total = item.quantity * unitPrice
                              updateItem(index, 'unitPrice', unitPrice)
                              updateItem(index, 'total', total)
                            }}
                            className="w-16 px-1 py-0 border border-gray-200 rounded text-right text-xs"
                          />
                        ) : (
                          <span className="font-semibold text-xs">{item.unitPrice.toFixed(2)}</span>
                        )}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-bold text-xs">
                        {item.total.toFixed(2)}
                      </td>
                      {isEditing && (
                        <td className="border border-gray-300 px-2 py-1 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              removeItem(index)
                            }}
                            className="text-red-600 hover:text-red-800 font-semibold text-xs"
                          >
                            حذف
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="mb-4">
            <div className="flex justify-end">
              <div className="w-full md:w-1/3">
                <div className="bg-gray-50 p-2 rounded space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">المجموع الفرعي:</span>
                    <span className="font-semibold">{invoiceData.subtotal.toFixed(2)} MAD</span>
                  </div>
                  {invoiceData.taxRate > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">ضريبة القيمة المضافة ({invoiceData.taxRate}%):</span>
                      <span className="font-semibold">{invoiceData.taxAmount.toFixed(2)} MAD</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">الخصم:</span>
                    <span className="font-semibold">-{invoiceData.discountAmount.toFixed(2)} MAD</span>
                  </div>
                  <div className="border-t pt-1">
                    <div className="flex justify-between">
                      <span className="font-bold text-sm">الإجمالي:</span>
                      <span className="font-bold text-sm text-blue-600">{invoiceData.totalAmount.toFixed(2)} MAD</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <h3 className="text-base font-semibold mb-1">ملاحظات</h3>
            {isEditing ? (
              <textarea
                value={invoiceData.notes}
                onChange={(e) => setInvoiceData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                rows={1}
              />
            ) : (
              <div className="bg-gray-50 p-2 rounded">
                <p className="text-gray-700 text-xs">{invoiceData.notes}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-2 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="text-center">
                <p className="text-gray-600 font-semibold text-xs">شكراً لثقتكم بنا!</p>
                <p className="text-gray-500 text-xs mt-0">هذه الفاتورة تم إنشاؤها بواسطة نظام إدارة {companyInfo?.company_name_ar || 'باقالينو'}</p>
              </div>
              {companyInfo?.bank_name && (
                <div className="text-left text-xs">
                  <p className="font-semibold text-gray-700 mb-0">معلومات الدفع:</p>
                  <p className="text-gray-600">البنك: {companyInfo.bank_name}</p>
                  {companyInfo.bank_iban && <p className="text-gray-600">IBAN: {companyInfo.bank_iban}</p>}
                  {companyInfo.bank_account && <p className="text-gray-600">الحساب: {companyInfo.bank_account}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
                  setPaymentDetails({ bank_name_ar: '', check_number: '', check_date: '', credit_due_date: '' })
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
                  setPaymentDetails({ bank_name_ar: '', check_number: '', check_date: '', credit_due_date: '' })
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
                  setPaymentMethod('credit')
                  setPaymentDetails({ bank_name_ar: '', check_number: '', check_date: '', credit_due_date: '' })
                }}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-3 ${
                  paymentMethod === 'credit' 
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
                  <input
                    type="text"
                    value={paymentDetails.check_number}
                    onChange={(e) => setPaymentDetails({...paymentDetails, check_number: e.target.value})}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="أدخل رقم الشيك"
                  />
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

            {paymentMethod === 'credit' && (
              <div className="space-y-4 mb-6 p-4 bg-orange-50 rounded-lg">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ استحقاق الدين</label>
                  <input
                    type="date"
                    value={paymentDetails.credit_due_date}
                    onChange={(e) => setPaymentDetails({...paymentDetails, credit_due_date: e.target.value})}
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
                  if (paymentMethod === 'credit' && !paymentDetails.credit_due_date) {
                    alert('يرجى تحديد تاريخ استحقاق الدين')
                    return
                  }
                  
                  setShowPaymentTypeModal(false)
                  confirmSale()
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

      {/* Popup détails du produit */}
      {showProductDetailsModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]" onClick={() => setShowProductDetailsModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[400px] max-w-[92vw] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-6">
              <span className="inline-block bg-blue-100 text-blue-800 font-bold px-4 py-2 rounded-md">
                تفاصيل المنتج
              </span>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="block text-sm font-bold text-gray-700 mb-2">اسم المنتج</label>
                <p className="text-lg font-semibold text-gray-900">{selectedProduct.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-sm font-bold text-gray-700 mb-2">الكمية</label>
                  <p className="text-xl font-bold text-blue-600">{selectedProduct.quantity}</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-sm font-bold text-gray-700 mb-2">السعر الواحد (MAD)</label>
                  <p className="text-xl font-bold text-green-600">{selectedProduct.unitPrice.toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                <label className="block text-sm font-bold text-blue-700 mb-2">الإجمالي (MAD)</label>
                <p className="text-2xl font-bold text-blue-800">{selectedProduct.total.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowProductDetailsModal(false)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold text-lg transition-colors"
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
