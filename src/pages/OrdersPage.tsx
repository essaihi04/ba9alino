import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { getCategoryLabelArabic } from '../utils/categoryLabels'
import { Search, Plus, Eye, Edit2, Truck, Package, CheckCircle, XCircle, Clock, Download, FileText, Receipt, Barcode, Save, Trash2, X, DollarSign } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useInputPad } from '../components/useInputPad'

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
    address?: string
    city?: string
  }
  employee_id?: string
  employee?: {
    id: string
    name: string
    phone: string
    role: string
    status: string
  }
  warehouse_id?: string
  warehouse?: {
    id: string
    name: string
    address?: string
    is_active: boolean
  }
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  order_date: string
  delivery_date?: string
  total_amount: number
  discount_amount: number
  tax_amount: number
  final_amount?: number
  payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded'
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
    sku: string
    name_ar: string
    price: number
    cost_price?: number
    image_url?: string
  }
}

interface Category {
  id: string
  name_ar: string
  name_en?: string
}

interface ProductVariant {
  id: string
  product_id: string
  variant_name: string
  unit_type: string
  quantity_contained: number
  barcode: string
  purchase_price: number
  price_a: number
  price_b: number
  price_c: number
  price_d: number
  price_e: number
  stock: number
  alert_threshold: number
  is_active: boolean
  is_default: boolean
}

export default function OrdersPage() {
  const navigate = useNavigate()
  const inputPad = useInputPad()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPayment, setFilterPayment] = useState<string>('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showDocumentModal, setShowDocumentModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [newStatus, setNewStatus] = useState<Order['status'] | ''>('')
  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_method: 'cash',
    payment_date: new Date().toISOString().split('T')[0]
  })
  const [chequeData, setChequeData] = useState({
    bank_name: '',
    cheque_number: '',
    deposit_date: ''
  })
  const [remainingAmount, setRemainingAmount] = useState(0)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCreateClientModal, setShowCreateClientModal] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [variantsByProductId, setVariantsByProductId] = useState<Record<string, ProductVariant[]>>({})
  const [products, setProducts] = useState<any[]>([])
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [coupons, setCoupons] = useState<any[]>([])
  const [orderData, setOrderData] = useState({
    client_id: '',
    phone: '',
    delivery_address: '',
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    coupon_id: '',
    notes: '',
    tva_rate: 0,
    warehouse_id: ''
  })
  const [allowAddressEdit, setAllowAddressEdit] = useState(false)
  const [allowPhoneEdit, setAllowPhoneEdit] = useState(false)
  const [showAutoFillNotification, setShowAutoFillNotification] = useState(false)
  const [newProductQuantity, setNewProductQuantity] = useState(1)
  const [stockData, setStockData] = useState<any[]>([])
  const [newClient, setNewClient] = useState({
    company_name_ar: '',
    address: '',
    city: '',
    contact_person_phone: '',
    subscription_tier: 'A'
  })
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [drafts, setDrafts] = useState<any[]>([])
  const [showDraftsModal, setShowDraftsModal] = useState(false)

  const getOrderItemKey = (productId: string, variantId?: string | null) => `${productId}`

  useEffect(() => {
    fetchOrders()
    fetchDrafts()
    // Listen for payment updates from invoices page
    const handlePaymentUpdate = (event: CustomEvent) => {
      // Refresh orders to get updated payment status
      fetchOrders()
    }
    
    window.addEventListener('payment-updated', handlePaymentUpdate as EventListener)
    
    return () => {
      window.removeEventListener('payment-updated', handlePaymentUpdate as EventListener)
    }
  }, [])

  useEffect(() => {
    fetchClients()
    fetchCategories()
    fetchProducts()
    fetchProductVariants()
    fetchCoupons()
    fetchStockData()
    fetchWarehouses()
  }, [])

  useEffect(() => {
    if (!showCreateModal) return

    const draftRaw = localStorage.getItem('order_create_draft')
    if (!draftRaw) return

    try {
      const draft = JSON.parse(draftRaw)
      const shouldLoad = window.confirm('يوجد مسودة طلب محفوظة. هل تريد تحميلها؟')
      if (!shouldLoad) return

      if (draft?.orderData) {
        setOrderData((prev) => ({
          ...prev,
          ...draft.orderData,
          order_date: draft.orderData.order_date || prev.order_date,
          delivery_date: draft.orderData.delivery_date || ''
        }))
      }
      if (Array.isArray(draft?.orderItems)) {
        setOrderItems(draft.orderItems)
      }
      if (draft?.selectedCategoryId !== undefined) {
        setSelectedCategoryId(draft.selectedCategoryId || '')
      }
      if (typeof draft?.productSearchTerm === 'string') {
        setProductSearchTerm(draft.productSearchTerm)
      }
    } catch {
    }
  }, [showCreateModal])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      // Enhanced query with employee and client joins
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:client_id (
            id,
            company_name_ar,
            company_name_en,
            address,
            city,
            contact_person_phone,
            subscription_tier
          ),
          employee:created_by (
            id,
            name,
            phone,
            role,
            status
          ),
          warehouse:warehouse_id (
            id,
            name,
            address,
            is_active
          )
        `)
        .order('order_date', { ascending: false })

      if (error) {
        console.error('Orders query failed:', error)
        throw error
      }
      
      console.log('Orders fetched successfully:', data?.length || 0, 'orders')
      console.log('Sample order with employee:', data?.[0])
      setOrders(data || [])
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      let data: any[] | null = null
      let error: any = null

      const attempt = await supabase
        .from('product_categories')
        .select('id, name_ar, name_en')
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
          .select('id, name_ar, name_en')
          .order('name_ar')

        data = fallback.data as any[]
        error = fallback.error
      }

      if (error) throw error
      setCategories((data || []) as Category[])
    } catch (error) {
      console.error('Error fetching categories:', error)
      setCategories([])
    }
  }

  const fetchProductVariants = async () => {
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select('id, product_id, variant_name, unit_type, quantity_contained, barcode, purchase_price, price_a, price_b, price_c, price_d, price_e, stock, alert_threshold, is_active, is_default')
        .eq('is_active', true)
        .order('product_id')

      if (error) throw error

      const map: Record<string, ProductVariant[]> = {}
      ;(data || []).forEach((v: any) => {
        const pid = String(v.product_id)
        if (!map[pid]) map[pid] = []
        map[pid].push(v as ProductVariant)
      })
      setVariantsByProductId(map)
    } catch (error) {
      console.error('Error fetching variants:', error)
      setVariantsByProductId({})
    }
  }

  const filteredProducts = useMemo(() => {
    const search = productSearchTerm.trim().toLowerCase()
    return (products || []).filter((p) => {
      const matchesCategory = !selectedCategoryId || p.category_id === selectedCategoryId
      if (!matchesCategory) return false
      if (!search) return true

      return (
        (p.name_ar || '').toLowerCase().includes(search) ||
        (p.sku || '').toLowerCase().includes(search)
      )
    })
  }, [products, productSearchTerm, selectedCategoryId])

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name_ar, company_name_en, address, city, contact_person_phone, subscription_tier')
        .eq('is_active', true)
        .order('company_name_ar')
      
      if (error) throw error
      setClients(data || [])
    } catch (error) {
      console.error('Error fetching clients:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, 
          sku, 
          name_ar, 
          price, 
          price_a, 
          price_b, 
          price_c, 
          price_d, 
          price_e, 
          image_url, 
          category_id,
          product_variants (
            id,
            price_a,
            price_b,
            price_c,
            price_d,
            price_e,
            stock,
            is_active,
            is_default
          )
        `)
        .eq('is_active', true)
        .order('name_ar')
      
      if (error) throw error
      
      console.log('Products loaded with variants:', data?.length || 0)
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('is_active', true)
        .order('code')
      
      if (error) throw error
      setCoupons(data || [])
    } catch (error) {
      console.error('Error fetching coupons:', error)
      // Silently continue if coupons table doesn't exist
      setCoupons([])
    }
  }

  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setWarehouses(data || [])
      
      // Auto-select first warehouse if none selected
      if (data && data.length > 0 && !orderData.warehouse_id) {
        setOrderData(prev => ({ ...prev, warehouse_id: data[0].id }))
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
      setWarehouses([])
    }
  }

  const fetchStockData = async () => {
    try {
      // Fetch stock data
      const { data: stockData, error: stockError } = await supabase
        .from('stock')
        .select('product_id, quantity_in_stock, quantity_available, quantity_reserved')
      
      if (stockError) throw stockError
      
      // Fetch orders that should be considered as reserved stock
      let ordersData = null
      try {
        // First try to get order items directly
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('product_id, quantity, orders!inner(status)')
          .in('orders.status', ['confirmed', 'processing', 'shipped'])
        
        if (!itemsError) {
          ordersData = orderItems
        } else {
          // Fallback: try orders table with items
          const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('status')
            .or('status.eq.confirmed,status.eq.processing,status.eq.shipped')
          
          if (!ordersError) {
            ordersData = orders
          }
        }
      } catch (ordersError) {
        console.warn('Could not fetch orders data, using stock data only:', ordersError)
        ordersData = null
      }
      
      // Calculate reserved quantities from orders
      const reservedFromOrders: { [key: string]: number } = {}
      
      if (ordersData) {
        ordersData.forEach((item: any) => {
          // Handle order_items structure (direct from order_items table)
          if (item.product_id && item.quantity) {
            const productId = item.product_id
            const quantity = item.quantity || 0
            reservedFromOrders[productId] = (reservedFromOrders[productId] || 0) + quantity
          }
          // Handle fallback orders structure (from orders table with items array)
          else if (item.items && Array.isArray(item.items)) {
            item.items.forEach((orderItem: any) => {
              const productId = orderItem.product_id || orderItem.product?.id
              const quantity = orderItem.quantity || 0
              if (productId) {
                reservedFromOrders[productId] = (reservedFromOrders[productId] || 0) + quantity
              }
            })
          }
        })
      }
      
      // Merge stock data with order reservations
      const mergedStockData = (stockData || []).map(stockItem => {
        const orderReserved = reservedFromOrders[stockItem.product_id] || 0
        const originalReserved = stockItem.quantity_reserved || 0
        const totalReserved = originalReserved + orderReserved
        
        return {
          ...stockItem,
          quantity_reserved: totalReserved,
          quantity_available: Math.max(0, (stockItem.quantity_in_stock || 0) - totalReserved)
        }
      })
      
      setStockData(mergedStockData)
    } catch (error) {
      console.error('Error fetching stock data:', error)
      setStockData([])
    }
  }

  const handleCreateClient = async () => {
    if (!newClient.company_name_ar || !newClient.address || !newClient.city || !newClient.contact_person_phone) {
      alert('يرجى ملء اسم العميل والعنوان والمدينة ورقم الهاتف')
      return
    }

    try {
      // Create client with updated fields
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert([{
          company_name_ar: newClient.company_name_ar,
          address: newClient.address,
          city: newClient.city,
          contact_person_phone: newClient.contact_person_phone,
          subscription_tier: newClient.subscription_tier,
          is_active: true
        }])
        .select()
        .single()

      if (clientError) throw clientError

      // Add to clients list and select it
      setClients([...clients, clientData])
      setOrderData({ ...orderData, client_id: clientData.id })
      
      // Reset form and close modal
      setNewClient({
        company_name_ar: '',
        address: '',
        city: '',
        contact_person_phone: '',
        subscription_tier: 'A'
      })
      setShowCreateClientModal(false)
      
      alert('تم إنشاء العميل بنجاح')
    } catch (error) {
      console.error('Error creating client:', error)
      alert('حدث خطأ أثناء إنشاء العميل')
    }
  }

  const handleClientChange = (clientId: string) => {
    setOrderData({ ...orderData, client_id: clientId })
    setAllowAddressEdit(false) // Reset edit state when client changes
    setAllowPhoneEdit(false) // Reset edit state when client changes
    
    // Auto-fill phone and address when client is selected
    if (clientId) {
      const selectedClient = clients.find(client => client.id === clientId)
      
      if (selectedClient) {
        const hasPhone = selectedClient.contact_person_phone
        const hasAddress = selectedClient.address
        
        setOrderData(prev => ({
          ...prev,
          phone: hasPhone || '',
          delivery_address: hasAddress ? `${selectedClient.address}, ${selectedClient.city || ''}` : ''
        }))
        
        // Show notification if auto-fill occurred
        if (hasPhone || hasAddress) {
          setShowAutoFillNotification(true)
          setTimeout(() => setShowAutoFillNotification(false), 3000)
        }
        
        // Update existing order items with new pricing based on client category
        updateOrderItemsPricing(selectedClient.subscription_tier)
      }
    } else {
      // Clear fields when no client is selected
      setOrderData(prev => ({
        ...prev,
        phone: '',
        delivery_address: ''
      }))
      
      // Reset pricing to default for existing items
      updateOrderItemsPricing(null)
    }
  }
  const updateOrderItemsPricing = (clientTier: string | null) => {
    setOrderItems(prevItems => 
      prevItems.map(item => {
        const product = products.find(p => p.id === item.product_id)
        if (!product) return item
        
        let newUnitPrice = getProductPriceForClient(product)
        
        return {
          ...item,
          unit_price: newUnitPrice,
          line_total: item.quantity * newUnitPrice
        }
      })
    )
  }

  const getProductPriceForClient = (product: any) => {
    // Debug: Afficher les prix du produit
    console.log(`Price debug for ${product.name_ar}:`, {
      price_a: product.price_a,
      price_b: product.price_b,
      price_c: product.price_c,
      price_d: product.price_d,
      price_e: product.price_e,
      price: product.price,
      variants: product.product_variants,
      client_id: orderData.client_id,
      client_tier: clients.find(c => c.id === orderData.client_id)?.subscription_tier
    })
    
    // Priorité 1: Utiliser les prix du variant par défaut
    const defaultVariant = product.product_variants?.find((v: any) => v.is_default)
    const activeVariant = product.product_variants?.find((v: any) => v.is_active)
    const variantToUse = defaultVariant || activeVariant || product.product_variants?.[0]
    
    if (variantToUse) {
      const variantPrice = getVariantPriceForClient(variantToUse)
      if (variantPrice > 0) {
        console.log(`Using variant price for ${product.name_ar}: ${variantPrice}`)
        return variantPrice
      }
    }
    
    // Priorité 2: Utiliser les prix du produit de base
    const basePrice =
      (product.price_e ?? product.price ?? product.price_a ?? product.price_b ?? product.price_c ?? product.price_d ?? 0)
    
    if (!orderData.client_id) {
      return Number(basePrice) || 0
    }
    
    const selectedClient = clients.find(client => client.id === orderData.client_id)
    
    if (!selectedClient) {
      return Number(basePrice) || 0
    }
    
    let finalPrice = 0
    switch (selectedClient.subscription_tier) {
      case 'A':
        finalPrice = product.price_a || basePrice || 0
        break
      case 'B':
        finalPrice = product.price_b || basePrice || 0
        break
      case 'C':
        finalPrice = product.price_c || basePrice || 0
        break
      case 'D':
        finalPrice = product.price_d || basePrice || 0
        break
      case 'E':
        finalPrice = product.price_e || basePrice || 0
        break
      default:
        finalPrice = basePrice || 0
    }
    
    // Additional fallback - if still 0, try other price fields
    if (finalPrice === 0) {
      const prices = [product.price_a, product.price_b, product.price_c, product.price_d, product.price_e, product.price]
      const nonZeroPrice = prices.find(p => p && p > 0)
      if (nonZeroPrice) {
        finalPrice = nonZeroPrice
      } else {
        console.warn('All prices are 0 for product:', product.name_ar)
      }
    }
    
    console.log(`Final price for ${product.name_ar}: ${finalPrice}`)
    return finalPrice
  }

  const calculateOrderTotal = () => {
    let subtotal = orderItems.reduce((total, item) => total + item.line_total, 0)
    
    // Apply coupon discount if selected
    if (orderData.coupon_id) {
      const coupon = coupons.find(c => c.id === orderData.coupon_id)
      if (coupon) {
        if (coupon.discount_type === 'percentage') {
          subtotal = subtotal * (1 - coupon.discount_value / 100)
        } else {
          subtotal = subtotal - coupon.discount_value
        }
      }
    }
    
    // Apply TVA
    const tvaAmount = subtotal * (orderData.tva_rate / 100)
    const totalWithTVA = subtotal + tvaAmount
    
    return Math.max(0, totalWithTVA)
  }

  const calculateSubtotal = () => {
    let subtotal = orderItems.reduce((total, item) => total + item.line_total, 0)
    
    // Apply coupon discount if selected
    if (orderData.coupon_id) {
      const coupon = coupons.find(c => c.id === orderData.coupon_id)
      if (coupon) {
        if (coupon.discount_type === 'percentage') {
          subtotal = subtotal * (1 - coupon.discount_value / 100)
        } else {
          subtotal = subtotal - coupon.discount_value
        }
      }
    }
    
    return Math.max(0, subtotal)
  }

  const calculateTVA = () => {
    const subtotal = calculateSubtotal()
    return subtotal * (orderData.tva_rate / 100)
  }

  const getVariantPriceForClient = (variant: ProductVariant) => {
    const selectedClient = clients.find((c) => c.id === orderData.client_id)
    const tier = selectedClient?.subscription_tier
    switch (tier) {
      case 'A':
        return variant.price_a
      case 'B':
        return variant.price_b
      case 'C':
        return variant.price_c
      case 'D':
        return variant.price_d
      case 'E':
        return variant.price_e
      default:
        return variant.price_e
    }
  }

  const getStockQuantity = (productId: string, warehouseId?: string) => {
    const product = products.find(p => p.id === productId)

    // 1) Stock table (preferred when present)
    // If warehouseId is provided, prefer the matching warehouse row when the field exists.
    if (warehouseId) {
      const warehouseStock = stockData.find(item =>
        item.product_id === productId && (item as any).warehouse_id === warehouseId
      )
      const qty = Number(warehouseStock?.quantity_available || 0)
      if (qty > 0) return qty
    }

    // Otherwise get total stock across all warehouses
    const stockItem = stockData.find(item => item.product_id === productId)
    const qtyAvailable = Number(stockItem?.quantity_available || 0)
    if (qtyAvailable > 0) return qtyAvailable

    // 2) Variants stock (sum)
    const variantsTotal = (variantsByProductId[productId] || []).reduce((sum, v) => sum + Number(v.stock || 0), 0)
    if (variantsTotal > 0) return variantsTotal

    // 3) Base product stock (fallback)
    const baseStock = Number((product as any)?.stock || 0)
    return baseStock > 0 ? baseStock : 0
  }

  const getVariantStock = (productId: string, variantId: string) => {
    const v = (variantsByProductId[productId] || []).find(x => x.id === variantId)
    if (!v) return 0
    return Math.max(0, Number(v.stock || 0))
  }

  const validateStockForProduct = (productId: string, requestedQuantity: number, existingQuantity: number = 0) => {
    const availableStock = getStockQuantity(productId)
    const totalRequested = existingQuantity + requestedQuantity
    
    if (totalRequested > availableStock) {
      const product = products.find(p => p.id === productId)
      const productName = product ? product.name_ar : 'المنتج'
      
      alert(`⚠️ كمية غير متوفرة في المخزون!\n\n${productName}:\n- الكمية المتوفرة: ${availableStock}\n- الكمية المطلوبة: ${totalRequested}\n- الكمية الزائدة: ${totalRequested - availableStock}\n\nيرجى تعديل الكمية أو اختيار منتج آخر.`)
      return false
    }
    
    return true
  }

  const addOrderItem = (productId: string, quantity: number = 1) => {
    const itemKey = getOrderItemKey(productId)

    const existingItem = orderItems.find((item) => getOrderItemKey(item.product_id) === itemKey)
    const existingQuantity = existingItem ? existingItem.quantity : 0

    if (!validateStockForProduct(productId, quantity, existingQuantity)) {
      return
    }

    if (existingItem) {
      setOrderItems(orderItems.map(item =>
        getOrderItemKey(item.product_id) === itemKey
          ? { ...item, quantity: item.quantity + quantity, line_total: (item.quantity + quantity) * item.unit_price }
          : item
      ))
      return
    }

    const product = products.find(p => p.id === productId)
    if (!product) {
      console.error('Product not found:', productId)
      return
    }

    const unitPrice = getProductPriceForClient(product)

    setOrderItems([...orderItems, {
      product_id: productId,
      quantity,
      unit_price: unitPrice,
      line_total: quantity * unitPrice,
      product: {
        ...product,
        name_ar: product.name_ar,
        sku: product.sku
      }
    }])
  }

  const removeOrderItem = (productId: string) => {
    const key = getOrderItemKey(productId)
    setOrderItems(orderItems.filter(item => getOrderItemKey(item.product_id) !== key))
  }

  const updateOrderItemQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeOrderItem(productId)
    } else {
      // Validate stock before updating quantity
      if (!validateStockForProduct(productId, 0, quantity)) {
        return // Stop if stock validation fails
      }
      
      setOrderItems(orderItems.map(item =>
        getOrderItemKey(item.product_id) === getOrderItemKey(productId)
          ? { ...item, quantity: quantity, line_total: quantity * item.unit_price }
          : item
      ))
    }
  }

  const saveOrderDraft = async () => {
    try {
      const draftData = {
        orderData,
        orderItems,
        selectedCategoryId,
        productSearchTerm,
        created_at: new Date().toISOString(),
        status: 'draft'
      }

      // Générer un ID unique pour le brouillon
      const draftId = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Sauvegarder dans localStorage avec un ID unique
      const draftWithId = { ...draftData, id: draftId }
      localStorage.setItem(`order_draft_${draftId}`, JSON.stringify(draftWithId))
      
      // Mettre à jour la liste des brouillons depuis localStorage
      fetchDraftsFromLocalStorage()
      
      alert('تم حفظ المسودة بنجاح')
    } catch (error) {
      console.error('Error saving draft:', error)
      alert('خطأ في حفظ المسودة')
    }
  }

  const fetchDraftsFromLocalStorage = () => {
    try {
      const drafts = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('order_draft_')) {
          const draftData = localStorage.getItem(key)
          if (draftData) {
            drafts.push(JSON.parse(draftData))
          }
        }
      }
      // Trier par date de création (plus récent en premier)
      drafts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setDrafts(drafts)
    } catch (error) {
      console.error('Error fetching drafts from localStorage:', error)
      setDrafts([])
    }
  }

  const fetchDrafts = async () => {
    // Utiliser localStorage au lieu de la base de données
    fetchDraftsFromLocalStorage()
  }

  const loadDraft = (draft: any) => {
    if (draft?.orderData) {
      setOrderData((prev) => ({
        ...prev,
        ...draft.orderData,
        order_date: draft.orderData.order_date || prev.order_date,
        delivery_date: draft.orderData.delivery_date || ''
      }))
    }
    if (Array.isArray(draft?.orderItems)) {
      setOrderItems(draft.orderItems)
    }
    if (draft?.selectedCategoryId) {
      setSelectedCategoryId(draft.selectedCategoryId)
    }
    if (draft?.productSearchTerm) {
      setProductSearchTerm(draft.productSearchTerm)
    }
    setShowDraftsModal(false)
    setShowCreateModal(true)
  }

  const deleteDraft = (draftId: string) => {
    try {
      localStorage.removeItem(`order_draft_${draftId}`)
      fetchDraftsFromLocalStorage()
      alert('تم حذف المسودة بنجاح')
    } catch (error) {
      console.error('Error deleting draft:', error)
      alert('خطأ في حذف المسودة')
    }
  }

  const createInvoiceForOrder = async (order: any, items: any[]) => {
    try {
      let selectedClient = clients.find((c) => c.id === order.client_id)
      
      // If client not found in local state, fetch directly from database
      if (!selectedClient) {
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('id', order.client_id)
          .single()
          
        if (clientError) {
          console.error('🔍 Error fetching client from database:', clientError)
        } else if (clientData) {
          selectedClient = clientData
        }
      }
      
      const clientName = selectedClient?.company_name_ar || 'عميل عام'
      const clientPhone = order.phone || selectedClient?.contact_person_phone || null
      const clientAddress = selectedClient?.address ? 
        `${selectedClient.address}${selectedClient.city ? `, ${selectedClient.city}` : ''}` : null

      const subtotal = order.subtotal || 0
      const taxRate = Number(order.tax_rate || orderData.tva_rate || 0)
      const taxAmount = order.tax_amount || (subtotal * (taxRate / 100))
      const totalAmount = order.total_amount || order.final_amount || (subtotal + taxAmount)

      const invoiceItems = (items || []).map((item: any) => ({
        product_id: item.product_id,
        product_name_ar: item.product_name_ar,
        product_sku: item.product_sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total
      }))

      const invoicePayloadBase: any = {
        invoice_number: `FAC-${order.order_number}`,
        invoice_date: new Date().toISOString(),
        client_id: order.client_id,
        client_name: clientName,
        client_phone: clientPhone,
        client_address: clientAddress,
        company_name_ar: 'بقالينو',
        order_id: order.id,
        order_number: order.order_number,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        discount_amount: 0,
        total_amount: totalAmount,
        paid_amount: 0,
        remaining_amount: totalAmount,
        currency: 'MAD',
        status: 'sent',
        payment_status: 'unpaid',
        items: invoiceItems
      }

      const tryInsert = async (payload: any) => {
        return await supabase.from('invoices').insert(payload)
      }

      let { error } = await tryInsert(invoicePayloadBase)
      if (error) {
        const msg = String((error as any)?.message || '')
        const code = String((error as any)?.code || '')
        const missingCols =
          code === '42703' ||
          code === 'PGRST204' ||
          msg.includes('payment_status') ||
          msg.includes('tax_rate') ||
          msg.includes('tax_amount') ||
          msg.includes("'items'") ||
          msg.includes(' items ')
        if (missingCols) {
          const stripped: any = { ...invoicePayloadBase }
          delete stripped.items
          delete stripped.payment_status
          delete stripped.payment_method
          delete stripped.tax_rate
          delete stripped.tax_amount
          delete stripped.discount_amount
          ;({ error } = await tryInsert(stripped))
        }
      }

      if (error) {
        console.error('Error creating invoice automatically:', error)
      }
    } catch (error) {
      console.error('Unexpected error creating invoice automatically:', error)
    }
  }

  const handleCreateOrder = async () => {
    if (!orderData.client_id || !orderData.phone || !orderData.delivery_address || orderItems.length === 0) {
      console.error('❌ Missing required fields for order creation')
      alert('يرجى اختيار عميل وإدخال رقم الهاتف وعنوان التوصيل وإضافة منتج واحد على الأقل')
      return
    }

    // Check if order total is 0
    const orderTotal = orderItems.reduce(
      (sum, item) => sum + Number((item.line_total ?? (Number(item.unit_price || 0) * Number(item.quantity || 0))) || 0),
      0
    )
    
    if (orderTotal === 0) {
      console.error('❌ Order total is 0 - cannot create order')
      alert('❌ لا يمكن إنشاء أمر بمبلغ إجمالي 0. يرجى التحقق من أسعار المنتجات.')
      return
    }

    try {
      const orderNumber = `ORD-${Date.now()}${Math.floor(Math.random() * 1000)}`
      const orderTotal = orderItems.reduce(
        (sum, item) => sum + Number((item.line_total ?? (Number(item.unit_price || 0) * Number(item.quantity || 0))) || 0),
        0
      )
      const orderItemsData = orderItems.map(item => ({
        product_id: item.product_id,
        product_name_ar: item.product?.name_ar,
        product_sku: item.product?.sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: (item.line_total ?? (Number(item.unit_price || 0) * Number(item.quantity || 0))),
        variant_id: item.variant_id || null
      }))

      const orderPayload = {
        order_number: orderNumber,
        client_id: orderData.client_id,
        phone: orderData.phone,
        delivery_address: orderData.delivery_address,
        warehouse_id: orderData.warehouse_id,
        subtotal: calculateSubtotal(),
        tax_amount: calculateTVA(),
        total_amount: orderTotal,
        status: 'pending',
        payment_status: 'unpaid',
        payment_method: null,
        created_at: new Date().toISOString()
      }

      const { data: order, error } = await supabase
        .from('orders')
        .insert(orderPayload)
        .select()
        .single()

      if (error) {
        console.error('❌ Error creating order:', error)
        throw error
      }

      // Insert order items separately
      const orderItemsToInsert = orderItemsData.map(item => ({
        ...item,
        order_id: order.id,
        created_at: new Date().toISOString()
      }))

      const tryInsertOrderItems = async (rows: any[]) => {
        return await supabase
          .from('order_items')
          .insert(rows)
      }

      let { error: orderItemsInsertError } = await tryInsertOrderItems(orderItemsToInsert)

      if (orderItemsInsertError) {
        const msg = String((orderItemsInsertError as any)?.message || '')
        const code = String((orderItemsInsertError as any)?.code || '')
        const missingCols =
          code === '42703' ||
          code === 'PGRST204' ||
          msg.includes("Could not find the '")

        if (missingCols) {
          const stripped = orderItemsToInsert.map((it) => {
            const copy: any = {
              order_id: it.order_id,
              product_id: it.product_id,
              quantity: it.quantity,
              unit_price: it.unit_price,
              line_total: it.line_total
            }
            return copy
          })

          const retry = await tryInsertOrderItems(stripped)
          orderItemsInsertError = retry.error
        }
      }

      if (orderItemsInsertError) {
        console.error('❌ Error inserting order items:', orderItemsInsertError)
        // Don't throw error here, as order was created successfully
        console.warn('Order created but items failed to insert')
      }

      await createInvoiceForOrder(order, orderItemsToInsert)

      // Reset form and close modal
      setShowCreateModal(false)
      setShowAutoFillNotification(false)
      localStorage.removeItem('order_create_draft')
      setOrderData({
        client_id: '',
        phone: '',
        delivery_address: '',
        order_date: new Date().toISOString().split('T')[0],
        delivery_date: '',
        coupon_id: '',
        notes: '',
        tva_rate: 0,
        warehouse_id: warehouses[0]?.id || ''
      })
      setOrderItems([])
      setSelectedCategoryId('')
      setProductSearchTerm('')
      
      // Refresh orders
      fetchOrders()
      
      alert('تم إنشاء الطلب بنجاح')
      
      // Show status modal for the newly created order
      const newOrder = order
      setSelectedOrder(newOrder)
      setNewStatus('pending')
      setShowStatusModal(true)
    } catch (error: any) {
      console.error('Error creating order:', error)
      alert(`حدث خطأ أثناء إنشاء الطلب: ${error?.message || 'خطأ غير معروف'}`)
    }
  }

  // Calculate total quantity for an order
  const getOrderTotalQuantity = (order: any) => {
    if (!order.items || !Array.isArray(order.items)) return 0
    return order.items.reduce((total: number, item: any) => total + (item.quantity || 0), 0)
  }

  const updateOrderStatus = async () => {
    if (!selectedOrder) return

    if (!newStatus) return

    try {
      const previousStatus = selectedOrder.status

      const { error } = await supabase
        .from('orders')
        .update({
          status: newStatus
        })
        .eq('id', selectedOrder.id)

      if (error) {
        console.error('Update error:', error)
        throw error
      }
      
      await updateStockOnStatusChange(selectedOrder, previousStatus, newStatus as Order['status'])
      
      // If order is delivered, show document modal
      if (newStatus === 'delivered') {
        setShowStatusModal(false)
        setShowDocumentModal(true)
      } else {
        setShowStatusModal(false)
        setSelectedOrder(null)
        setNewStatus('')
      }
      
      fetchOrders()
    } catch (error: any) {
      console.error('Error updating order status:', error)
      alert(`حدث خطأ أثناء تحديث الحالة: ${error?.message || 'خطأ غير معروف'}`)
    }
  }

  const getOrderRemainingAmount = async (orderId: string, orderTotal: number): Promise<number> => {
    try {
      const { data: payments } = await supabase
        .from('payments')
        .select('amount, status')
        .eq('order_id', orderId)
        .or('status.eq.completed,status.eq.refunded')

      const rows = payments || []
      const totalPaid = rows
        .filter((p: any) => p.status === 'completed')
        .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
      const totalRefunded = rows
        .filter((p: any) => p.status === 'refunded')
        .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)

      const netPaid = Math.max(0, totalPaid - totalRefunded)
      return orderTotal - netPaid
    } catch (error) {
      console.error('Error calculating remaining amount:', error)
      return orderTotal
    }
  }

  const addPayment = async () => {
    if (!selectedOrder || !paymentData.amount) return

    try {
      const orderTotal = selectedOrder.final_amount || selectedOrder.total_amount
      const paymentAmount = parseFloat(paymentData.amount)
      
      // Get existing payments for this order
      const { data: existingPayments } = await supabase
        .from('payments')
        .select('amount, status')
        .eq('order_id', selectedOrder.id)
        .or('status.eq.completed,status.eq.refunded')

      const rows = existingPayments || []
      const totalPaid = rows
        .filter((p: any) => p.status === 'completed')
        .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
      const totalRefunded = rows
        .filter((p: any) => p.status === 'refunded')
        .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
      const netPaid = Math.max(0, totalPaid - totalRefunded)

      // Update order payment status
      const newTotalPaid = netPaid + paymentAmount
      
      let newPaymentStatus = 'partial'
      if (newTotalPaid >= orderTotal) {
        newPaymentStatus = 'paid'
      } else if (newTotalPaid > 0) {
        newPaymentStatus = 'partial'
      }

      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({ 
          payment_status: newPaymentStatus, 
          payment_method: paymentData.payment_method 
        })
        .eq('id', selectedOrder.id)

      if (orderUpdateError) {
        console.error('❌ Error updating order payment status:', orderUpdateError)
        throw orderUpdateError
      }

      // Update corresponding invoice payment status if invoice exists
      if (selectedOrder.id) {
        const { data: invoices, error: invoiceError } = await supabase
          .from('invoices')
          .select('id, total_amount, paid_amount, order_id, order_number')
          .eq('order_id', selectedOrder.id)

        if (invoiceError) {
          console.error('🔍 Error finding invoices:', invoiceError)
        }

        const invoicesList = [...(invoices || [])]

        // Try alternative search if no invoices found with order_id
        if (invoicesList.length === 0) {
          const { data: invoicesByNumber } = await supabase
            .from('invoices')
            .select('id, total_amount, paid_amount, order_id, order_number')
            .eq('order_number', selectedOrder.order_number)
          
          if (invoicesByNumber && invoicesByNumber.length > 0) {
            invoicesList.push(...invoicesByNumber)
          }
        }

        if (invoicesList.length > 0) {
          const invoice = invoicesList[0]
          
          const newInvoicePaidAmount = newTotalPaid
          const newInvoiceStatus = newTotalPaid >= invoice.total_amount ? 'paid' : 'sent'
          
          const { error: invoiceUpdateError } = await supabase
            .from('invoices')
            .update({ 
              paid_amount: newInvoicePaidAmount,
              remaining_amount: invoice.total_amount - newInvoicePaidAmount,
              status: newInvoiceStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', invoice.id)

          if (invoiceUpdateError) {
            console.error('🔍 Error updating invoice payment status:', invoiceUpdateError)
          }
        }
      }

      setShowPaymentModal(false)
      fetchOrders()
      
      // Reset payment and cheque data
      setPaymentData({
        amount: '',
        payment_method: 'cash',
        payment_date: new Date().toISOString().split('T')[0]
      })
      setChequeData({
        bank_name: '',
        cheque_number: '',
        deposit_date: ''
      })
      
      // Also trigger a refresh of invoices if they're cached in the app
      // This ensures the payment status is reflected in the invoices page
      window.dispatchEvent(new CustomEvent('order-payment-updated', { 
        detail: { 
          orderId: selectedOrder.id,
          paymentStatus: newPaymentStatus,
          newTotalPaid: newTotalPaid
        } 
      }))
      
      alert('تم تسجيل الدفعة بنجاح')
    } catch (error: any) {
      console.error('Error adding payment:', error)
      alert(`حدث خطأ أثناء تسجيل الدفعة: ${error?.message || 'خطأ غير معروف'}`)
    }
  }

  const updateStockOnStatusChange = async (
    order: Order,
    fromStatus: Order['status'],
    toStatus: Order['status']
  ) => {
    if (fromStatus === toStatus) return

    // Entering delivered => deduct stock
    if (fromStatus !== 'delivered' && toStatus === 'delivered') {
      await updateStockForDeliveredTransition(order, 'deduct')
      return
    }

    // Leaving delivered => restock
    if (fromStatus === 'delivered' && toStatus !== 'delivered') {
      await updateStockForDeliveredTransition(order, 'restock')
      return
    }
  }

  const updateStockForDeliveredTransition = async (order: Order, mode: 'deduct' | 'restock') => {
    try {
      // Fetch order items if not available
      let orderItems = order.items
      if (!orderItems || !Array.isArray(orderItems)) {
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('product_id, variant_id, quantity')
          .eq('order_id', order.id)
        
        if (itemsError) {
          console.error('Error fetching order items:', itemsError)
          return
        }
        orderItems = items || []
      }
      
      for (const item of orderItems) {
        // Get current stock from product_variants table (since we use variant_id)
        const { data: stockItem, error: fetchError } = await supabase
          .from('product_variants')
          .select('id, stock')
          .eq('id', item.variant_id || item.product_id)
          .single()
        
        if (fetchError) {
          console.error('Error fetching stock item:', fetchError)
          continue
        }
        
        const currentInStock = stockItem?.stock || 0
        const delta = mode === 'deduct' ? -item.quantity : item.quantity
        const newInStock = Math.max(0, currentInStock + delta)
        
        const { error: updateError } = await supabase
          .from('product_variants')
          .update({
            stock: newInStock,
            updated_at: new Date().toISOString()
          })
          .eq('id', stockItem.id)
        
        if (updateError) {
          console.error('Error updating stock:', updateError)
        }
      }
    } catch (error) {
      console.error('Error updating stock on delivery:', error)
      // Don't throw error to avoid blocking status update
    }
  }

  const generateInvoice = () => {
    if (!selectedOrder) return
    
    // Store order data in sessionStorage for the invoice page
    sessionStorage.setItem('invoiceOrderData', JSON.stringify(selectedOrder))
    
    // Navigate to invoice creation page
    navigate('/invoices/create')
  }

  const generateDeliveryNote = () => {
    if (!selectedOrder) return
    
    // Store order data in sessionStorage for the delivery note page
    sessionStorage.setItem('deliveryNoteOrderData', JSON.stringify(selectedOrder))
    
    // Navigate to delivery note page
    navigate('/delivery-notes/create')
  }

  const closeDocumentModal = () => {
    setShowDocumentModal(false)
    setSelectedOrder(null)
    setNewStatus('')
  }

  const filteredOrders = useMemo(() => {
    let filtered = orders

    // Search filter
    const s = searchTerm.trim().toLowerCase()
    if (s) {
      filtered = filtered.filter(order => {
        const number = String(order.order_number || '').toLowerCase()
        const clientName = String(order.client?.company_name_ar || '').toLowerCase()
        const email = String(order.client?.contact_person_email || '').toLowerCase()
        return number.includes(s) || clientName.includes(s) || email.includes(s)
      })
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(order => order.status === filterStatus)
    }

    // Payment filter
    if (filterPayment !== 'all') {
      filtered = filtered.filter(order => order.payment_status === filterPayment)
    }

    // Date range filter
    if (dateRange.start) {
      filtered = filtered.filter(order => 
        new Date(order.order_date) >= new Date(dateRange.start)
      )
    }
    if (dateRange.end) {
      filtered = filtered.filter(order => 
        new Date(order.order_date) <= new Date(dateRange.end + 'T23:59:59')
      )
    }

    return filtered
  }, [orders, searchTerm, filterStatus, filterPayment, dateRange])

  const stats = useMemo(() => {
    const total = orders.length
    const pending = orders.filter(o => o.status === 'pending').length
    const processing = orders.filter(o => o.status === 'processing').length
    const shipped = orders.filter(o => o.status === 'shipped').length
    const delivered = orders.filter(o => o.status === 'delivered').length
    const cancelled = orders.filter(o => o.status === 'cancelled').length
    const totalRevenue = orders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.total_amount || 0), 0)

    return { total, pending, processing, shipped, delivered, cancelled, totalRevenue }
  }, [orders])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />
      case 'confirmed': return <CheckCircle className="w-4 h-4" />
      case 'processing': return <Package className="w-4 h-4" />
      case 'shipped': return <Truck className="w-4 h-4" />
      case 'delivered': return <CheckCircle className="w-4 h-4" />
      case 'cancelled': return <XCircle className="w-4 h-4" />
      default: return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'confirmed': return 'bg-blue-100 text-blue-800'
      case 'processing': return 'bg-purple-100 text-purple-800'
      case 'shipped': return 'bg-indigo-100 text-indigo-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-red-100 text-red-800'
      case 'unpaid': return 'bg-red-100 text-red-800'
      case 'partial': return 'bg-orange-100 text-orange-800'
      case 'paid': return 'bg-green-100 text-green-800'
      case 'refunded': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">الطلبات</h1>
          <p className="text-white mt-2">إدارة طلبات العملاء وتتبعها</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700"
          >
            <Plus className="w-5 h-5" />
            طلب جديد
          </button>
          <button 
            onClick={() => setShowDraftsModal(true)}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-orange-700"
          >
            <Save className="w-5 h-5" />
            المسودات ({drafts.length})
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-md border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">إجمالي الطلبات</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
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
              <p className="text-gray-500 text-sm">قيد المعالجة</p>
              <p className="text-2xl font-bold text-purple-600">{stats.processing}</p>
            </div>
            <Package className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-md border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">تم الشحن</p>
              <p className="text-2xl font-bold text-indigo-600">{stats.shipped}</p>
            </div>
            <Truck className="w-8 h-8 text-indigo-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-md border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">تم التسليم</p>
              <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-md border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">إجمالي الإيرادات</p>
              <p className="text-2xl font-bold">{stats.totalRevenue.toFixed(2)} MAD</p>
            </div>
            <Package className="w-8 h-8 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="البحث عن طلب..."
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
            <option value="confirmed">مؤكد</option>
            <option value="processing">قيد المعالجة</option>
            <option value="shipped">تم الشحن</option>
            <option value="delivered">تم التسليم</option>
            <option value="cancelled">ملغي</option>
          </select>
          <select
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">جميع المدفوعات</option>
            <option value="pending">لم يدفع</option>
            <option value="partial">مدفوع جزئيا</option>
            <option value="paid">مدفوع بالكامل</option>
            <option value="refunded">مسترد</option>
          </select>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase w-24">رقم الطلب</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase min-w-40">العميل</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase w-32">التاريخ</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase w-28">البائع</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase w-28">المخزن</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase w-20">الكمية</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase w-28">المبلغ</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase w-28">حالة الطلب</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase w-28">حالة الدفع</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase w-28">نوع الأداء</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase w-24">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    لا توجد طلبات
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-3 py-4">
                      <p className="font-medium">#{order.order_number}</p>
                    </td>
                    <td className="px-3 py-4">
                      <div>
                        <p className="font-medium">{order.client?.company_name_ar}</p>
                        <p className="text-sm text-gray-500">{order.client?.contact_person_email}</p>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <p className="font-medium">{new Date(order.order_date).toLocaleDateString('ar-MA')}</p>
                      <p className="text-sm text-gray-500">{new Date(order.order_date).toLocaleTimeString('ar-MA')}</p>
                    </td>
                    <td className="px-3 py-4">
                      <div>
                        <p className="font-medium">{order.employee?.name || 'غير محدد'}</p>
                        <p className="text-sm text-gray-500">{order.employee?.role}</p>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div>
                        <p className="font-medium">{order.warehouse?.name || 'غير محدد'}</p>
                        <p className="text-sm text-gray-500">{order.warehouse?.is_active ? 'نشط' : 'غير نشط'}</p>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-blue-600">{getOrderTotalQuantity(order)}</span>
                        <span className="text-xs text-gray-500">منتج</span>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <div>
                        <p className="font-medium">{(order.total_amount || 0).toFixed(2)} MAD</p>
                        {order.discount_amount > 0 && (
                          <p className="text-sm text-gray-500 line-through">
                            {((order.total_amount || 0) + (order.discount_amount || 0)).toFixed(2)} MAD
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 w-fit ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {order.status === 'pending' ? 'في الانتظار' :
                         order.status === 'confirmed' ? 'مؤكد' :
                         order.status === 'processing' ? 'قيد المعالجة' :
                         order.status === 'shipped' ? 'تم الشحن' :
                         order.status === 'delivered' ? 'تم التسليم' :
                         order.status === 'cancelled' ? 'ملغي' : order.status}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getPaymentStatusColor(order.payment_status)}`}>
                        {order.payment_status === 'unpaid' ? 'لم يدفع' :
                         order.payment_status === 'partial' ? 'مدفوع جزئيا' :
                         order.payment_status === 'paid' ? 'مدفوع' :
                         order.payment_status === 'refunded' ? 'مسترد' : order.payment_status}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                        {order.payment_method === 'cash' ? 'نقدي' :
                         order.payment_method === 'check' ? 'شيك' :
                         order.payment_method === 'card' ? 'بطاقة' :
                         order.payment_method === 'bank_transfer' ? 'تحويل بنكي' :
                         order.payment_method === 'mobile_payment' ? 'دفع محمول' :
                         order.payment_method === 'credit' ? 'دين' :
                         order.payment_method || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setSelectedOrder(order)
                            setShowDetailsModal(true)
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedOrder(order)
                            setNewStatus(order.status)
                            setShowStatusModal(true)
                          }}
                          className={`text-green-600 hover:text-green-800 ${
                            order.status === 'delivered' && order.payment_status === 'paid' 
                              ? 'opacity-50 cursor-not-allowed' 
                              : ''
                          }`}
                          title={
                            order.status === 'delivered' && order.payment_status === 'paid' 
                              ? 'لا يمكن تعديل حالة الطلب المكتمل' 
                              : 'تغيير الحالة'
                          }
                          disabled={order.status === 'delivered' && order.payment_status === 'paid'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            setSelectedOrder(order)
                            const orderTotal = order.final_amount || order.total_amount
                            const remaining = await getOrderRemainingAmount(order.id, orderTotal)
                            setRemainingAmount(remaining)
                            setPaymentData({
                              amount: '',
                              payment_method: 'cash',
                              payment_date: new Date().toISOString().split('T')[0]
                            })
                            setShowPaymentModal(true)
                          }}
                          className={`text-purple-600 hover:text-purple-800 ${
                            order.payment_status === 'paid' 
                              ? 'opacity-50 cursor-not-allowed' 
                              : ''
                          }`}
                          title={
                            order.payment_status === 'paid' 
                              ? 'الطلب مدفوع بالكامل' 
                              : 'إضافة دفعة للطلب'
                          }
                          disabled={order.payment_status === 'paid'}
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Modal */}
      {showDetailsModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">تفاصيل الطلب #{selectedOrder.order_number}</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <h3 className="font-semibold mb-2">معلومات العميل</h3>
                <p><span className="text-gray-500">الاسم:</span> {selectedOrder.client?.company_name_ar}</p>
                <p><span className="text-gray-500">البريد:</span> {selectedOrder.client?.contact_person_email}</p>
                <p><span className="text-gray-500">الهاتف:</span> {selectedOrder.client?.contact_person_phone}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">معلومات الطلب</h3>
                <p><span className="text-gray-500">التاريخ:</span> {new Date(selectedOrder.order_date).toLocaleString('ar-MA')}</p>
                <p><span className="text-gray-500">الحالة:</span> 
                  <span className={`mr-2 px-2 py-1 text-xs rounded-full ${getStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status}
                  </span>
                </p>
                <p><span className="text-gray-500">الدفع:</span> 
                  <span className={`mr-2 px-2 py-1 text-xs rounded-full ${getPaymentStatusColor(selectedOrder.payment_status)}`}>
                    {selectedOrder.payment_status}
                  </span>
                </p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold mb-2">عنوان التسليم</h3>
              <p>{selectedOrder.shipping_address?.street}</p>
              <p>{selectedOrder.shipping_address?.city}, {selectedOrder.shipping_address?.postal_code}</p>
              <p>{selectedOrder.shipping_address?.country}</p>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold mb-2">تفاصيل المنتجات</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-right">الوصف</th>
                      <th className="px-4 py-2 text-right">الكمية</th>
                      <th className="px-4 py-2 text-right">السعر (MAD)</th>
                      <th className="px-4 py-2 text-right">الإجمالي (MAD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedOrder.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2">
                          <div>
                            <p className="font-medium">
                              {item.product_name_ar || item.product?.name_ar || 'Produit sans nom'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {item.product_sku || item.product?.sku}
                              {item.variant_name && (
                                <span className="ml-2 text-blue-600">
                                  {item.variant_name}
                                </span>
                              )}
                            </p>
                            {item.product?.description && (
                              <p className="text-xs text-gray-400 mt-1 max-w-xs">
                                {item.product.description}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center">{item.quantity}</td>
                        <td className="px-4 py-2 text-right">{(item.unit_price || 0).toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-medium">
                          {(item.line_total || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <div>
                <p className="text-gray-500">المجموع الفرعي: {(selectedOrder.total_amount || 0).toFixed(2)} MAD</p>
                {(selectedOrder.discount_amount || 0) > 0 && (
                  <p className="text-gray-500">الخصم: -{(selectedOrder.discount_amount || 0).toFixed(2)} MAD</p>
                )}
                <p className="text-xl font-bold">الإجمالي: {(selectedOrder.total_amount || 0).toFixed(2)} MAD</p>
              </div>
              <button
                onClick={() => {
                  setShowDetailsModal(false)
                  setSelectedOrder(null)
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">إضافة دفعة للطلب #{selectedOrder.order_number}</h2>
            <form onSubmit={(e) => { e.preventDefault(); addPayment(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">المبلغ (MAD)</label>
                <button
                  type="button"
                  onClick={() =>
                    inputPad.open({
                      title: 'المبلغ (MAD)',
                      mode: 'decimal',
                      dir: 'ltr',
                      initialValue: paymentData.amount || '0',
                      min: 0,
                      max: remainingAmount,
                      onConfirm: (v) => {
                        const value = parseFloat(v) || 0
                        if (value <= remainingAmount) {
                          setPaymentData({...paymentData, amount: v})
                        }
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-left"
                >
                  {paymentData.amount || '0'}
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  المبلغ الإجمالي: {(selectedOrder?.final_amount || selectedOrder?.total_amount || 0).toFixed(2)} MAD
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  المبلغ المدفوع سابقاً: {((selectedOrder?.final_amount || selectedOrder?.total_amount || 0) - remainingAmount).toFixed(2)} MAD
                </p>
                <p className="text-xs text-green-600 mt-1 font-medium">
                  المتبقي: {remainingAmount.toFixed(2)} MAD
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  الحد الأقصى: {remainingAmount.toFixed(2)} MAD
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">طريقة الدفع</label>
                <select
                  value={paymentData.payment_method}
                  onChange={(e) => setPaymentData({...paymentData, payment_method: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="cash">نقدي (Cash)</option>
                  <option value="check">شيك (Cheque)</option>
                  <option value="card">بطاقة (Card)</option>
                  <option value="bank_transfer">تحويل بنكي (Bank Transfer)</option>
                  <option value="mobile_payment">دفع محمول (Mobile Payment)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">تاريخ الدفع</label>
                <input
                  type="date"
                  value={paymentData.payment_date}
                  onChange={(e) => setPaymentData({...paymentData, payment_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              {paymentData.payment_method === 'check' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">اسم البنك</label>
                    <select
                      value={chequeData.bank_name}
                      onChange={(e) => setChequeData({...chequeData, bank_name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    >
                      <option value="">اختر البنك</option>
                      <option value="Attijariwafa Bank">Attijariwafa Bank</option>
                      <option value="Banque Populaire">Banque Populaire</option>
                      <option value="BMCE">BMCE</option>
                      <option value="CIH">CIH</option>
                      <option value="Crédit Agricole">Crédit Agricole</option>
                      <option value="Crédit du Maroc">Crédit du Maroc</option>
                      <option value="Société Générale">Société Générale</option>
                      <option value="BMCI">BMCI</option>
                      <option value="Al Barid Bank">Al Barid Bank</option>
                      <option value="AwBank">AwBank</option>
                      <option value="Bank of Africa">Bank of Africa</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">رقم الشيك</label>
                    <input
                      type="text"
                      value={chequeData.cheque_number}
                      onChange={(e) => setChequeData({...chequeData, cheque_number: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="أدخل رقم الشيك"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">تاريخ الاستحقاق</label>
                    <input
                      type="date"
                      value={chequeData.deposit_date}
                      onChange={(e) => setChequeData({...chequeData, deposit_date: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false)
                    setPaymentData({
                      amount: '',
                      payment_method: 'cash',
                      payment_date: new Date().toISOString().split('T')[0]
                    })
                    setChequeData({
                      bank_name: '',
                      cheque_number: '',
                      deposit_date: ''
                    })
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  تسجيل الدفعة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {showStatusModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">تحديث حالة الطلب</h2>
            <form onSubmit={(e) => { e.preventDefault(); updateOrderStatus(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">الحالة الجديدة</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">في الانتظار</option>
                  <option value="confirmed">مؤكد</option>
                  <option value="processing">قيد المعالجة</option>
                  <option value="shipped">تم الشحن</option>
                  <option value="delivered">تم التسليم</option>
                  <option value="cancelled">ملغي</option>
                </select>
              </div>
              <div className="flex gap-4 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowStatusModal(false)
                    setSelectedOrder(null)
                    setNewStatus('')
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  تحديث
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-4 max-w-7xl w-full h-[100vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">إنشاء طلب جديد</h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false)
                  setShowAutoFillNotification(false)
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Auto-fill notification */}
            {showAutoFillNotification && (
              <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center gap-2 animate-pulse">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">تم ملء معلومات الهاتف والعنوان تلقائياً من بيانات العميل</span>
              </div>
            )}

            {/* Compact top bar with client info only */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">العميل</label>
                  <div className="flex gap-2">
                    <select
                      value={orderData.client_id}
                      onChange={(e) => handleClientChange(e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    >
                      <option value="">اختر عميل...</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.company_name_ar} {client.subscription_tier && `(${getCategoryLabelArabic(client.subscription_tier)})`}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCreateClientModal(true)}
                      className="bg-green-600 text-white px-2 py-1 rounded-lg hover:bg-green-700 transition text-sm"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">المخزن</label>
                  <select
                    value={orderData.warehouse_id}
                    onChange={(e) => setOrderData({ ...orderData, warehouse_id: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {warehouses.length === 0 ? (
                      <option value="">لا توجد مخازن</option>
                    ) : (
                      warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">التاريخ</label>
                  <input
                    type="date"
                    value={orderData.order_date}
                    onChange={(e) => setOrderData({ ...orderData, order_date: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">كوبون الخصم</label>
                  <select
                    value={orderData.coupon_id}
                    onChange={(e) => setOrderData({ ...orderData, coupon_id: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">بدون كوبون</option>
                    {coupons.map((coupon) => (
                      <option key={coupon.id} value={coupon.id}>
                        {coupon.code} - {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `${coupon.discount_value} MAD`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ضريبة القيمة المضافة (TVA)</label>
                  <select
                    value={orderData.tva_rate}
                    onChange={(e) => setOrderData({ ...orderData, tva_rate: parseFloat(e.target.value) })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="0">بدون TVA</option>
                    <option value="7">7%</option>
                    <option value="10">10%</option>
                    <option value="20">20%</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
              {/* Categories - Moved to top */}
              <div className="lg:col-span-12">
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <h3 className="font-bold text-gray-800 mb-2 text-sm">العائلات</h3>
                  <div className="max-h-24 overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCategoryId('')}
                        className={`px-2.5 py-1 rounded border text-xs whitespace-nowrap transition ${
                          !selectedCategoryId
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        كل العائلات
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategoryId(cat.id)}
                          title={cat.name_ar}
                          className={`px-2.5 py-1 rounded border text-xs whitespace-nowrap transition max-w-[140px] truncate ${
                            selectedCategoryId === cat.id
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {cat.name_ar}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Products */}
              <div className="lg:col-span-7">
                <div className="bg-white border border-gray-200 rounded-lg p-3 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-800 text-sm">منتجات العائلة المختارة</h3>
                    <div className="relative flex-1 max-w-xs mr-2">
                      <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={12} />
                      <input
                        type="text"
                        placeholder="ابحث عن منتج..."
                        value={productSearchTerm}
                        onChange={(e) => setProductSearchTerm(e.target.value)}
                        className="w-full pr-8 pl-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {filteredProducts.map((product) => {
                        const variants = (variantsByProductId[product.id] || []).slice().sort((a, b) => Number(b.is_default) - Number(a.is_default))
                        const hasVariants = variants.length > 0
                        const availableProduct = getStockQuantity(product.id, orderData.warehouse_id)
                        const priceLabel = getProductPriceForClient(product)

                        return (
                          <div 
                            key={product.id} 
                            className="border border-gray-200 rounded-lg p-2 hover:shadow-md transition bg-white cursor-pointer hover:bg-gray-50"
                            onClick={() => {
                              if (!hasVariants) {
                                addOrderItem(product.id, 1)
                              } else {
                                // For products with variants, add the default variant or first variant
                                const defaultVariant = variants.find(v => v.is_default) || variants[0]
                                if (defaultVariant) {
                                  addOrderItem(product.id, 1, defaultVariant)
                                }
                              }
                            }}
                          >
                            <div className="flex flex-col items-center text-center">
                              {product.image_url ? (
                                <img
                                  src={product.image_url}
                                  alt={product.name_ar}
                                  className="w-8 h-8 object-cover rounded mb-1"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center mb-1">
                                  <Package size={12} className="text-gray-400" />
                                </div>
                              )}
                              <p className="font-semibold text-gray-800 text-xs truncate w-full leading-tight">{product.name_ar}</p>
                              <p className="text-xs text-gray-500 truncate w-full">{product.sku}</p>
                              <p className="text-xs text-gray-500">المتوفر: {availableProduct}</p>
                              
                              {!hasVariants ? (
                                <div className="mt-1">
                                  <p className="text-xs text-gray-700 font-bold">
                                    {priceLabel} MAD
                                  </p>
                                </div>
                              ) : (
                                <div className="mt-1">
                                  {variants.slice(0, 1).map((v) => {
                                    const vPrice = getVariantPriceForClient(v)
                                    const vStock = getVariantStock(product.id, v.id)
                                    return (
                                      <div key={v.id} className="text-xs">
                                        <p className="font-bold text-gray-800">{vPrice} MAD</p>
                                        <p className="text-xs text-gray-500">{v.variant_name}</p>
                                        <p className="text-xs text-gray-500">Stock: {vStock}</p>
                                      </div>
                                    )
                                  })}
                                  {variants.length > 1 && (
                                    <p className="text-xs text-blue-600">+{variants.length - 1} أخرى</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="bg-white border border-gray-200 rounded-lg p-3 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-800 text-sm">الفاتورة / السلة</h3>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 font-bold text-blue-800 text-sm">
                      {calculateOrderTotal().toFixed(2)} MAD
                    </div>
                  </div>

                  {/* TVA Summary */}
                  {orderData.tva_rate > 0 && (
                    <div className="mb-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-600">الإجمالي الفرعي:</span>
                          <span className="font-medium">{calculateSubtotal().toFixed(2)} MAD</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">TVA ({orderData.tva_rate}%):</span>
                          <span className="font-medium">{calculateTVA().toFixed(2)} MAD</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-gray-300">
                          <span className="font-bold text-gray-800">الإجمالي:</span>
                          <span className="font-bold text-blue-600">{calculateOrderTotal().toFixed(2)} MAD</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="border border-gray-200 rounded-lg overflow-hidden flex-1 min-h-0">
                    <div className="overflow-y-auto h-full">
                      {orderItems.length === 0 ? (
                        <p className="text-gray-500 text-center py-4 text-xs">لا توجد منتجات مضافة</p>
                      ) : (
                        <table className="w-full">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-2 py-1 text-right text-xs font-medium text-gray-700">SKU</th>
                              <th className="px-2 py-1 text-right text-xs font-medium text-gray-700">منتج</th>
                              <th className="px-2 py-1 text-center text-xs font-medium text-gray-700">كمية</th>
                              <th className="px-2 py-1 text-right text-xs font-medium text-gray-700">سعر</th>
                              <th className="px-2 py-1 text-right text-xs font-medium text-gray-700">إجمالي</th>
                              <th className="px-2 py-1 text-center text-xs font-medium text-gray-700"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {orderItems.map((item, idx) => {
                              const availableQuantity = getStockQuantity(item.product_id, orderData.warehouse_id)

                              return (
                                <tr key={`${item.product_id}-${idx}`} className="hover:bg-gray-50">
                                  <td className="px-2 py-1 text-xs text-gray-900">
                                    <div className="flex items-center gap-1">
                                      <span className="truncate max-w-[60px]">{item.product?.sku}</span>
                                      {item.variant_barcode && (
                                        <span className="flex items-center gap-1 text-blue-600">
                                          <Barcode size={10} />
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-2 py-1 text-xs text-gray-900">
                                    <div>
                                      <p className="font-medium truncate max-w-[100px]">{item.product?.name_ar}</p>
                                      {item.variant_name && (
                                        <p className="text-xs text-gray-500 truncate">{item.variant_name}</p>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-2 py-1">
                                    <div className="flex items-center justify-center space-x-1">
                                      <button
                                        type="button"
                                        onClick={() => updateOrderItemQuantity(item.product_id, item.quantity - 1)}
                                        className="w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                                      >
                                        <span className="text-xs">-</span>
                                      </button>
                                      <span className="w-6 text-center font-medium text-xs">{item.quantity}</span>
                                      <button
                                        type="button"
                                        onClick={() => updateOrderItemQuantity(item.product_id, item.quantity + 1)}
                                        className="w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                                      >
                                        <span className="text-xs">+</span>
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-2 py-1 text-xs text-gray-900 text-right">
                                    {(item.unit_price || 0).toFixed(2)}
                                  </td>
                                  <td className="px-2 py-1 text-xs text-gray-900 text-right font-medium">
                                    {(item.line_total || 0).toFixed(2)}
                                  </td>
                                  <td className="px-2 py-1 text-center">
                                    <button
                                      type="button"
                                      onClick={() => removeOrderItem(item.product_id)}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t mt-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveOrderDraft}
                  className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800 font-medium flex items-center gap-2 text-sm"
                >
                  <Save size={14} />
                  حفظ المسودة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setShowAutoFillNotification(false)
                    setOrderData({
                      client_id: '',
                      phone: '',
                      delivery_address: '',
                      order_date: new Date().toISOString().split('T')[0],
                      delivery_date: '',
                      coupon_id: '',
                      notes: ''
                    })
                    setOrderItems([])
                    setSelectedCategoryId('')
                    setProductSearchTerm('')
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium text-sm"
                >
                  إلغاء
                </button>
              </div>
              <button
                type="button"
                onClick={handleCreateOrder}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm"
              >
                تأكيد الطلب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Client Modal */}
      {showCreateClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 w-full max-w-md sm:max-w-lg">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">إنشاء عميل جديد</h2>
              <button
                type="button"
                onClick={() => setShowCreateClientModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleCreateClient(); }} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">اسم العميل</label>
                <input
                  type="text"
                  value={newClient.company_name_ar}
                  onChange={(e) => setNewClient({ ...newClient, company_name_ar: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm sm:text-base"
                  placeholder="أدخل اسم العميل..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">العنوان</label>
                <input
                  type="text"
                  value={newClient.address}
                  onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm sm:text-base"
                  placeholder="أدخل العنوان الكامل..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">المدينة</label>
                <input
                  type="text"
                  value={newClient.city}
                  onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm sm:text-base"
                  placeholder="أدخل المدينة..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">الفئة</label>
                <select
                  value={newClient.subscription_tier}
                  onChange={(e) => setNewClient({ ...newClient, subscription_tier: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm sm:text-base"
                  required
                >
                  <option value="A">فئة A</option>
                  <option value="B">فئة B</option>
                  <option value="C">فئة C</option>
                  <option value="D">فئة D</option>
                  <option value="E">فئة E</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">رقم الهاتف</label>
                <input
                  type="tel"
                  value={newClient.contact_person_phone}
                  onChange={(e) => setNewClient({ ...newClient, contact_person_phone: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm sm:text-base"
                  placeholder="06xxxxxxxx ou 07xxxxxxxx"
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateClientModal(false)
                    setNewClient({
                      company_name_ar: '',
                      address: '',
                      city: '',
                      contact_person_phone: '',
                      subscription_tier: 'A'
                    })
                  }}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 px-3 sm:px-4 rounded-lg hover:bg-gray-300 transition font-medium text-sm sm:text-base"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-2 px-3 sm:px-4 rounded-lg hover:bg-green-700 transition font-medium text-sm sm:text-base"
                >
                  إنشاء العميل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Generation Modal */}
      {showDocumentModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">تم التسليم بنجاح!</h2>
              <button
                type="button"
                onClick={closeDocumentModal}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-gray-600 mb-2">تم تحديث حالة الطلب إلى "تم التسليم"</p>
              <p className="text-sm text-gray-500">هل ترغب في طباعة فاتورة أو بون تسليم؟</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={generateInvoice}
                className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                <FileText size={20} />
                <span>إنشاء فاتورة</span>
              </button>
              
              <button
                onClick={generateDeliveryNote}
                className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-medium"
              >
                <Receipt size={20} />
                <span>إنشاء بون تسليم</span>
              </button>
              
              <button
                onClick={closeDocumentModal}
                className="w-full bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                لا شكراً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drafts Modal */}
      {showDraftsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">المسودات المحفوظة</h2>
              <button
                onClick={() => setShowDraftsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            {drafts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Save size={48} className="mx-auto mb-4 text-gray-300" />
                <p>لا توجد مسودات محفوظة</p>
              </div>
            ) : (
              <div className="space-y-4">
                {drafts.map((draft) => (
                  <div key={draft.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Package size={16} className="text-blue-600" />
                          <span className="font-semibold text-gray-800">
                            مسودة #{draft.id.slice(0, 8)}
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(draft.created_at).toLocaleDateString('ar-DZ')}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">العميل:</span> {draft.orderData?.client_id || 'غير محدد'}
                          </div>
                          <div>
                            <span className="font-medium">الهاتف:</span> {draft.orderData?.phone || 'غير محدد'}
                          </div>
                          <div>
                            <span className="font-medium">المنتجات:</span> {draft.orderItems?.length || 0} منتجات
                          </div>
                          <div>
                            <span className="font-medium">العنوان:</span> {draft.orderData?.delivery_address || 'غير محدد'}
                          </div>
                        </div>

                        {draft.orderItems && draft.orderItems.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-medium text-gray-700 mb-2">المنتجات:</p>
                            <div className="flex flex-wrap gap-2">
                              {draft.orderItems.slice(0, 3).map((item: any, index: number) => (
                                <span key={index} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                                  {item.product_name_ar} x{item.quantity}
                                </span>
                              ))}
                              {draft.orderItems.length > 3 && (
                                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                                  +{draft.orderItems.length - 3} أخرى
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => loadDraft(draft)}
                          className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1"
                        >
                          <Package size={14} />
                          تحميل
                        </button>
                        <button
                          onClick={() => deleteDraft(draft.id)}
                          className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm flex items-center gap-1"
                        >
                          <Trash2 size={14} />
                          حذف
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {inputPad.Modal}
    </div>
  )
}
