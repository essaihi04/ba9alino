import { useEffect, useState } from 'react'
import { Search, Plus, Package, DollarSign, CheckCircle, Truck, AlertCircle, Trash2, X, ShoppingCart, CreditCard, Edit, PlusCircle, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useInputPad } from '../components/useInputPad'

interface Supplier {
  id: string
  name_ar: string
  name_en?: string
  contact_person: string
  email: string
  phone: string
  address: string
  created_at?: string
}

interface Product {
  id: string
  name_ar: string
  sku: string
  stock: number
  cost_price?: number
  price_a: number
  category_id?: string
  image_url?: string
}

interface Category {
  id: string
  name_ar: string
}

interface Warehouse {
  id: string
  name: string
  is_active: boolean
}

interface ProductPrimaryVariant {
  id: string
  product_id: string
  variant_name: string
  is_default?: boolean
  is_active?: boolean
}

type UnitType = 'kilo' | 'carton' | 'paquet' | 'sac'

interface PurchaseLineItem {
  product_id: string
  primary_variant_id?: string
  primary_variant_name?: string
  product_name_ar: string
  product_sku: string
  quantity: number
  unit_price: number
  line_total: number
  unit_type?: UnitType
  units_per_carton?: number | null
  weight_per_unit?: number | null
  base_quantity?: number
  packaging_mode?: 'none' | 'carton' | 'sachet'
}

interface Purchase {
  id: string
  purchase_number: string
  supplier_id: string
  supplier?: Supplier
  purchase_date: string
  status: 'pending' | 'received' | 'cancelled'
  items: PurchaseLineItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  payment_type: 'cash' | 'credit' | 'transfer' | 'check'
  payment_status: 'paid' | 'partial' | 'pending'
  paid_amount: number
  remaining_amount: number
  bank_name?: string
  check_number?: string
  check_date?: string
  check_deposit_date?: string
  credit_due_date?: string
  notes?: string
  created_at?: string
}

export default function PurchasesPage() {
  const inputPad = useInputPad()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [primaryVariantsByProductId, setPrimaryVariantsByProductId] = useState<Record<string, ProductPrimaryVariant[]>>({})
  const [categories, setCategories] = useState<Category[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreatePurchaseModal, setShowCreatePurchaseModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [purchaseItems, setPurchaseItems] = useState<PurchaseLineItem[]>([])
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingItem, setEditingItem] = useState<PurchaseLineItem | null>(null)
  const [editPrimaryVariantId, setEditPrimaryVariantId] = useState<string>('')
  const [editForm, setEditForm] = useState({
    quantity: 1,
    unit_price: 0,
    unit_type: 'kilo' as UnitType,
    units_per_carton: 1 as number | null,
    weight_per_unit: 1 as number | null,
    packaging_mode: 'none' as 'none' | 'carton' | 'sachet',
  })
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'cash' as 'cash' | 'transfer' | 'check',
    payment_date: new Date().toISOString().split('T')[0],
    notes: ''
  })
  const [showEditPurchaseModal, setShowEditPurchaseModal] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null)
  const [editPurchaseItems, setEditPurchaseItems] = useState<PurchaseLineItem[]>([])
  
  // Formulaire d'achat
  const [purchaseForm, setPurchaseForm] = useState({
    supplier_id: '',
    warehouse_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    status: 'received' as 'pending' | 'received' | 'cancelled',
    tax_rate: '0',
    payment_type: 'cash' as 'cash' | 'credit' | 'transfer' | 'check',
    paid_amount: '',
    bank_name: '',
    check_number: '',
    check_date: '',
    check_deposit_date: '',
    credit_due_date: '',
    notes: ''
  })

  useEffect(() => {
    loadPurchases()
    loadProducts()
    loadCategories()
    loadWarehouses()
    loadSuppliers()
  }, [])

  const loadPurchases = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('*, supplier:suppliers(*)')
        .order('purchase_date', { ascending: false })

      if (error) throw error
      setPurchases(data || [])
    } catch (error) {
      console.error('Error loading purchases:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name')

      if (error) throw error

      const list = (data || []) as Warehouse[]
      setWarehouses(list)

      if (!purchaseForm.warehouse_id && list.length > 0) {
        setPurchaseForm(prev => ({ ...prev, warehouse_id: list[0].id }))
      }
    } catch (error) {
      console.error('Error loading warehouses:', error)
    }
  }

  const loadSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name_ar')

      if (error) throw error
      setSuppliers(data || [])
    } catch (error) {
      console.error('Error loading suppliers:', error)
    }
  }

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ar, sku, stock, cost_price, price_a, category_id, image_url')
        .order('name_ar')

      if (error) throw error
      setProducts(data || [])

      const productIds = (data || []).map(p => p.id)
      if (productIds.length === 0) {
        setPrimaryVariantsByProductId({})
        return
      }

      const { data: primaryVariants, error: primaryError } = await supabase
        .from('product_primary_variants')
        .select('id, product_id, variant_name, is_default, is_active')
        .in('product_id', productIds)

      if (primaryError) {
        console.warn('Error loading product primary variants:', primaryError)
        setPrimaryVariantsByProductId({})
        return
      }

      const byProduct: Record<string, ProductPrimaryVariant[]> = {}
      ;(primaryVariants || []).forEach((v: any) => {
        if (!v?.product_id) return
        const pid = String(v.product_id)
        if (!byProduct[pid]) byProduct[pid] = []
        byProduct[pid].push(v as ProductPrimaryVariant)
      })
      setPrimaryVariantsByProductId(byProduct)
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .order('name_ar')

      if (error) throw error
      setCategories((data || []) as Category[])
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  // Filtrer les produits par catégorie sélectionnée
  const filteredProducts = selectedCategory 
    ? products.filter(p => p.category_id === selectedCategory)
    : products

  // Ajouter un produit à la facture
  const calculateBaseQuantity = (form: { quantity: number; unit_type: UnitType; units_per_carton?: number | null; weight_per_unit?: number | null; packaging_mode?: 'none' | 'carton' | 'sachet' }) => {
    const safeQuantity = Number(form.quantity) || 0
    const hasUnitsPerCarton = form.units_per_carton !== null && form.units_per_carton !== undefined && form.units_per_carton > 0
    const hasWeightPerUnit = form.weight_per_unit !== null && form.weight_per_unit !== undefined && form.weight_per_unit > 0
    const unitsPerCarton = hasUnitsPerCarton ? Number(form.units_per_carton) : 1
    const weightPerUnit = hasWeightPerUnit ? Number(form.weight_per_unit) : 1

    switch (form.unit_type) {
      case 'carton':
        return safeQuantity * unitsPerCarton * weightPerUnit
      case 'paquet':
        return safeQuantity * weightPerUnit
      case 'sac':
        return safeQuantity * weightPerUnit
      case 'kilo':
      default:
        return safeQuantity
    }
  }

  const addProductToInvoice = (product: Product) => {
    const pvs = primaryVariantsByProductId[product.id] || []
    const defaultPv = pvs.find(v => v.is_default) || pvs[0]
    const primaryVariantId = defaultPv?.id

    const existingItem = purchaseItems.find(item =>
      item.product_id === product.id && (item.primary_variant_id || '') === (primaryVariantId || '')
    )
    
    if (existingItem) {
      // Augmenter la quantité
      setPurchaseItems(purchaseItems.map(item =>
        item.product_id === product.id && (item.primary_variant_id || '') === (primaryVariantId || '')
          ? {
              ...item,
              quantity: item.quantity + 1,
              line_total: (item.quantity + 1) * item.unit_price,
              base_quantity: calculateBaseQuantity({
                quantity: item.quantity + 1,
                unit_type: item.unit_type || 'kilo',
                units_per_carton: item.units_per_carton || 1,
                weight_per_unit: item.weight_per_unit || 1,
              })
            }
          : item
      ))
    } else {
      // Ajouter un nouvel item
      const unitPrice = product.cost_price || product.price_a
      const defaultForm = {
        quantity: 1,
        unit_type: 'kilo' as UnitType,
        units_per_carton: null as number | null,
        weight_per_unit: null as number | null,
        packaging_mode: 'none' as 'none' | 'carton' | 'sachet'
      }
      setPurchaseItems([
        ...purchaseItems,
        {
          product_id: product.id,
          primary_variant_id: primaryVariantId,
          primary_variant_name: defaultPv?.variant_name,
          product_name_ar: product.name_ar,
          product_sku: product.sku,
          quantity: 1,
          unit_price: unitPrice,
          line_total: unitPrice,
          unit_type: defaultForm.unit_type,
          units_per_carton: defaultForm.units_per_carton,
          weight_per_unit: defaultForm.weight_per_unit,
          packaging_mode: defaultForm.packaging_mode,
          base_quantity: calculateBaseQuantity(defaultForm),
        }
      ])
    }
  }

  // Supprimer un produit de la facture
  const removeProductFromInvoice = (productId: string) => {
    setPurchaseItems(purchaseItems.filter(item => item.product_id !== productId))
  }

  
  // Ouvrir le popup d'édition
  const openEditModal = (item: PurchaseLineItem) => {
    setEditingItem(item)
    const pvs = primaryVariantsByProductId[item.product_id] || []
    const defaultPv = pvs.find(v => v.is_default) || pvs[0]
    setEditPrimaryVariantId(String(item.primary_variant_id || defaultPv?.id || ''))
    setEditForm({
      quantity: item.quantity,
      unit_price: item.unit_price,
      unit_type: item.unit_type || 'kilo',
      units_per_carton: item.units_per_carton ?? 1,
      weight_per_unit: item.weight_per_unit ?? 1,
      packaging_mode: item.packaging_mode || 'none',
    })
    setShowEditModal(true)
  }

  // Sauvegarder les modifications
  const saveEdit = () => {
    if (!editingItem) return

    const targetUpdater = editingPurchase ? setEditPurchaseItems : setPurchaseItems
    const sourceItems = editingPurchase ? editPurchaseItems : purchaseItems

    // Validation: obliger إدخال عدد الوحدات والوزن لكل وحدة عند الحاجة
    if (editForm.unit_type === 'carton') {
      if (!editForm.units_per_carton || editForm.units_per_carton <= 0) {
        alert('يرجى إدخال عدد الوحدات في الكرتون')
        return
      }
      if (!editForm.weight_per_unit || editForm.weight_per_unit <= 0) {
        alert('يرجى إدخال وزن/كمية كل وحدة داخل الكرتون')
        return
      }
    }

    if (editForm.unit_type === 'kilo' && editForm.packaging_mode === 'carton') {
      if (!editForm.units_per_carton || editForm.units_per_carton <= 0) {
        alert('يرجى إدخال عدد الوحدات في الكرتون')
        return
      }
      if (!editForm.weight_per_unit || editForm.weight_per_unit <= 0) {
        alert('يرجى إدخال وزن/كمية كل وحدة داخل الكرتون')
        return
      }
    }

    if ((editForm.unit_type === 'paquet' || editForm.unit_type === 'sac' || editForm.packaging_mode === 'sachet') && (!editForm.weight_per_unit || editForm.weight_per_unit <= 0)) {
      alert('يرجى إدخال الوزن/الكمية لكل كيس/ساشي')
      return
    }

    const editingKey = `${editingItem.product_id}:${editingItem.primary_variant_id || ''}`
    const nextKey = `${editingItem.product_id}:${editPrimaryVariantId || ''}`
    const baseQuantity = calculateBaseQuantity(editForm)

    const nextItem: PurchaseLineItem = {
      ...editingItem,
      primary_variant_id: editPrimaryVariantId || undefined,
      primary_variant_name: (primaryVariantsByProductId[editingItem.product_id] || []).find(v => v.id === editPrimaryVariantId)?.variant_name,
      quantity: editForm.quantity,
      unit_price: editForm.unit_price,
      unit_type: editForm.unit_type,
      units_per_carton: editForm.units_per_carton,
      weight_per_unit: editForm.weight_per_unit,
      packaging_mode: editForm.packaging_mode || 'none',
      base_quantity: baseQuantity,
      line_total: editForm.quantity * editForm.unit_price,
    }

    if (editForm.quantity <= 0) {
      targetUpdater(sourceItems.filter(item => `${item.product_id}:${item.primary_variant_id || ''}` !== editingKey))
    } else {
      // If primary variant changed and collides with another line, merge
      const hasCollision = editingKey !== nextKey && sourceItems.some(item => `${item.product_id}:${item.primary_variant_id || ''}` === nextKey)
      if (hasCollision) {
        const merged = sourceItems
          .filter(item => `${item.product_id}:${item.primary_variant_id || ''}` !== editingKey)
          .map(item => {
            if (`${item.product_id}:${item.primary_variant_id || ''}` !== nextKey) return item
            const mergedQty = (Number(item.quantity) || 0) + (Number(nextItem.quantity) || 0)
            const mergedTotal = mergedQty * (Number(nextItem.unit_price) || 0)
            return {
              ...item,
              ...nextItem,
              quantity: mergedQty,
              line_total: mergedTotal,
              base_quantity: (Number(item.base_quantity) || 0) + (Number(nextItem.base_quantity) || 0),
            }
          })
        targetUpdater(merged)
      } else {
        targetUpdater(sourceItems.map(item =>
          `${item.product_id}:${item.primary_variant_id || ''}` === editingKey ? nextItem : item
        ))
      }
    }

    setShowEditModal(false)
    setEditingItem(null)
  }

  // Calculer les totaux
  const subtotal = purchaseItems.reduce((sum, item) => sum + item.line_total, 0)
  const taxRate = parseFloat(purchaseForm.tax_rate) || 0
  const taxAmount = subtotal * (taxRate / 100)
  const totalAmount = subtotal + taxAmount

  const isMissingColumnError = (err: any, column: string) => {
    const msg = String(err?.message || '')
    const hint = String(err?.hint || '')
    const details = String(err?.details || '')
    return msg.includes(column) || hint.includes(column) || details.includes(column)
  }

  const isGeneratedColumnError = (err: any, column: string) => {
    const msg = String(err?.message || '')
    const details = String(err?.details || '')
    return (
      err?.code === '428C9' ||
      msg.includes('generated column') ||
      details.includes('generated column') ||
      msg.includes(column)
    )
  }

  const upsertWarehouseStock = async (params: {
    productId: string
    primaryVariantId?: string
    warehouseId: string
    delta: number
    costPrice: number
  }) => {
    const { productId, primaryVariantId, warehouseId, delta, costPrice } = params

    // Try with warehouse_id (per-warehouse stock)
    let existingStock: any = null
    let stockSelectError: any = null
    {
      let q = supabase
        .from('stock')
        .select('*')
        .eq('product_id', productId)
        .eq('warehouse_id', warehouseId)
      if (primaryVariantId) q = q.eq('primary_variant_id', primaryVariantId)
      const res = await q.maybeSingle()
      existingStock = res.data
      stockSelectError = res.error
    }

    if (stockSelectError && isMissingColumnError(stockSelectError, 'primary_variant_id')) {
      const res = await supabase
        .from('stock')
        .select('*')
        .eq('product_id', productId)
        .eq('warehouse_id', warehouseId)
        .maybeSingle()
      existingStock = res.data
      stockSelectError = res.error
    }

    // Fallback: stock table without warehouse_id
    if (stockSelectError && isMissingColumnError(stockSelectError, 'warehouse_id')) {
      const res = await supabase
        .from('stock')
        .select('*')
        .eq('product_id', productId)
        .maybeSingle()
      existingStock = res.data
      stockSelectError = res.error
    }

    if (stockSelectError) throw stockSelectError

    if (existingStock?.id) {
      const currentInStock = Number(existingStock.quantity_in_stock ?? existingStock.quantity_available ?? 0) || 0
      const nextQty = Math.max(0, currentInStock + delta)

      // Try rich update, fallback to minimal update if some columns are missing
      let updateRes = await supabase
        .from('stock')
        .update({
          quantity_in_stock: nextQty,
          cost_price: costPrice,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingStock.id)

      if (
        updateRes.error &&
        (isMissingColumnError(updateRes.error, 'cost_price') ||
          isMissingColumnError(updateRes.error, 'updated_at') ||
          isGeneratedColumnError(updateRes.error, 'quantity_available') ||
          isMissingColumnError(updateRes.error, 'quantity_in_stock'))
      ) {
        updateRes = await supabase
          .from('stock')
          .update({ quantity_in_stock: nextQty })
          .eq('id', existingStock.id)
      }

      if (updateRes.error) throw updateRes.error
      return
    }

    // Insert
    let insertRes = await supabase
      .from('stock')
      .insert({
        product_id: productId,
        primary_variant_id: primaryVariantId || null,
        warehouse_id: warehouseId,
        quantity_in_stock: Math.max(0, delta),
        quantity_reserved: 0,
        cost_price: costPrice,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    // Fallback if schema doesn't include some columns
    if (insertRes.error && (isMissingColumnError(insertRes.error, 'primary_variant_id') || isMissingColumnError(insertRes.error, 'warehouse_id'))) {
      insertRes = await supabase
        .from('stock')
        .insert({
          product_id: productId,
          quantity_in_stock: Math.max(0, delta),
          quantity_reserved: 0,
        })
    } else if (
      insertRes.error &&
      (
        isMissingColumnError(insertRes.error, 'cost_price') ||
        isMissingColumnError(insertRes.error, 'created_at') ||
        isMissingColumnError(insertRes.error, 'updated_at') ||
        isGeneratedColumnError(insertRes.error, 'quantity_available')
      )
    ) {
      insertRes = await supabase
        .from('stock')
        .insert({
          product_id: productId,
          primary_variant_id: primaryVariantId || null,
          warehouse_id: warehouseId,
          quantity_in_stock: Math.max(0, delta),
          quantity_reserved: 0,
        })
      if (insertRes.error && (isMissingColumnError(insertRes.error, 'primary_variant_id') || isMissingColumnError(insertRes.error, 'warehouse_id'))) {
        insertRes = await supabase
          .from('stock')
          .insert({
            product_id: productId,
            quantity_in_stock: Math.max(0, delta),
            quantity_reserved: 0,
          })
      }
    }

    if (insertRes.error) throw insertRes.error
  }

  const deleteDerivedKiloVariants = async (productId: string, primaryVariantId?: string) => {
    let query = supabase
      .from('product_variants')
      .select('id')
      .eq('product_id', productId)
      .eq('unit_type', 'kilo')
      .gt('quantity_contained', 0)
      .lt('quantity_contained', 1)
    if (primaryVariantId) query = query.eq('primary_variant_id', primaryVariantId)

    const { data: badKiloVariants, error: selectError } = await query

    if (selectError && isMissingColumnError(selectError, 'primary_variant_id')) {
      const res = await supabase
        .from('product_variants')
        .select('id')
        .eq('product_id', productId)
        .eq('unit_type', 'kilo')
        .gt('quantity_contained', 0)
        .lt('quantity_contained', 1)
      if (res.error) throw res.error
      const ids2 = (res.data || []).map((v: any) => v.id)
      if (ids2.length === 0) return
      const del2 = await supabase.from('product_variants').delete().in('id', ids2)
      if (del2.error) throw del2.error
      return
    }

    if (selectError) throw selectError

    const ids = (badKiloVariants || []).map(v => v.id)
    if (ids.length === 0) return

    const { error: deleteError } = await supabase
      .from('product_variants')
      .delete()
      .in('id', ids)

    if (deleteError) throw deleteError
  }

  // Soumettre l'achat
  const handleSubmitPurchase = async () => {
    if (purchaseItems.length === 0) {
      alert('يرجى إضافة منتجات إلى الفاتورة')
      return
    }

    if (!purchaseForm.supplier_id) {
      alert('يرجى اختيار المورد')
      return
    }

    if (!purchaseForm.warehouse_id) {
      alert('يرجى اختيار المستودع')
      return
    }

    try {
      const purchaseNumber = `ACH-${Date.now()}`
      
      // Si paiement en espèce, marquer comme payé automatiquement
      let paidAmount = 0
      let paymentStatus = 'pending'
      
      if (purchaseForm.payment_type === 'cash') {
        paidAmount = totalAmount
        paymentStatus = 'paid'
      } else {
        paidAmount = purchaseForm.paid_amount ? parseFloat(purchaseForm.paid_amount) : 0
        paymentStatus = paidAmount >= totalAmount ? 'paid' : (paidAmount > 0 ? 'partial' : 'pending')
      }
      
      const remainingAmount = Math.max(0, totalAmount - paidAmount)

      const purchasePayload: any = {
        purchase_number: purchaseNumber,
        supplier_id: purchaseForm.supplier_id,
        purchase_date: purchaseForm.purchase_date,
        status: purchaseForm.status,
        items: purchaseItems,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_type: purchaseForm.payment_type,
        paid_amount: paidAmount,
        remaining_amount: remainingAmount,
        payment_status: paymentStatus,
        notes: purchaseForm.notes
      }

      if (purchaseForm.payment_type === 'check') {
        purchasePayload.check_number = purchaseForm.check_number
        purchasePayload.check_date = purchaseForm.check_date
        purchasePayload.check_deposit_date = purchaseForm.check_deposit_date
      }

      if (purchaseForm.payment_type === 'transfer') {
        purchasePayload.bank_name = purchaseForm.bank_name
      }

      if (purchaseForm.payment_type === 'credit') {
        purchasePayload.credit_due_date = purchaseForm.credit_due_date
      }

      const { error } = await supabase
        .from('purchases')
        .insert([purchasePayload])

      if (error) throw error

      // Ajouter les produits au stock
      if (purchaseForm.status === 'received' && purchaseForm.warehouse_id) {
        for (const item of purchaseItems) {
          if (!item.product_id || !purchaseForm.warehouse_id) continue
          const baseQuantity = Number(item.base_quantity ?? item.quantity ?? 0) || 0
          const unitPrice = Number(item.unit_price) || 0
          const unitType = item.unit_type || 'kilo'
          const packagingMode = item.packaging_mode || 'none'
          const primaryVariantId = item.primary_variant_id

          // 1) Mettre à jour stock par entrepôt (stock table)
          await upsertWarehouseStock({
            productId: item.product_id,
            primaryVariantId,
            warehouseId: purchaseForm.warehouse_id,
            delta: baseQuantity,
            costPrice: unitPrice,
          })

          // 2) Mettre à jour le stock total du produit avec coût moyen pondéré
          const { data: product } = await supabase
            .from('products')
            .select('stock, cost_price')
            .eq('id', item.product_id)
            .single()

          if (product) {
            const oldStock = Number(product.stock) || 0
            const oldCost = Number(product.cost_price) || 0
            const newStock = oldStock + baseQuantity
            const newCost = newStock > 0
              ? ((oldStock * oldCost) + (baseQuantity * unitPrice)) / newStock
              : oldCost

            await supabase
              .from('products')
              .update({
                stock: newStock,
                cost_price: newCost
              })
              .eq('id', item.product_id)
          }

          // 3) Mettre à jour/Créer la variante correspondant au unit_type
          const baseQtyContained = unitType === 'kilo'
            ? 1
            : (unitType === 'carton'
              ? (item.units_per_carton ?? 1)
              : ((unitType === 'paquet' || unitType === 'sac') ? (item.weight_per_unit ?? 1) : 1))

          const qtyContained = item.units_per_carton ?? item.weight_per_unit ?? 1

          const baseVariantsQuery = (() => {
            let q = supabase
              .from('product_variants')
              .select('*')
              .eq('product_id', item.product_id)
              .eq('unit_type', unitType)
            if (primaryVariantId) q = q.eq('primary_variant_id', primaryVariantId)
            return q
          })()

          let baseVariantsFinal: any[] | null = null
          {
            const res = await baseVariantsQuery
            if (res.error && primaryVariantId && isMissingColumnError(res.error, 'primary_variant_id')) {
              const res2 = await supabase
                .from('product_variants')
                .select('*')
                .eq('product_id', item.product_id)
                .eq('unit_type', unitType)
              if (res2.error) throw res2.error
              baseVariantsFinal = res2.data
            } else {
              if (res.error) throw res.error
              baseVariantsFinal = res.data
            }
          }

          const existingVariant = unitType === 'kilo'
            ? (baseVariantsFinal || []).find((v: any) => !v.quantity_contained || Number(v.quantity_contained) <= 1 || v.variant_name === 'kilo')
            : (baseVariantsFinal || [])[0]

          const mainVariantStockDelta = (unitType === 'kilo')
            ? baseQuantity
            : (Number(item.quantity) || 0)

          if (existingVariant?.id) {
            await supabase
              .from('product_variants')
              .update({
                variant_name: existingVariant.variant_name || unitType,
                unit_type: unitType,
                quantity_contained: baseQtyContained || 1,
                purchase_price: unitPrice,
                stock: (existingVariant.stock || 0) + mainVariantStockDelta,
                alert_threshold: existingVariant.alert_threshold ?? 10,
                is_active: true,
              })
              .eq('id', existingVariant.id)
          } else {
            await supabase
              .from('product_variants')
              .insert({
                product_id: item.product_id,
                primary_variant_id: primaryVariantId || null,
                variant_name: unitType,
                unit_type: unitType,
                quantity_contained: baseQtyContained || 1,
                purchase_price: unitPrice,
                price_a: 0,
                price_b: 0,
                price_c: 0,
                price_d: 0,
                price_e: 0,
                stock: mainVariantStockDelta,
                alert_threshold: 10,
                is_active: true,
                is_default: unitType === 'unit',
              })
          }

          // 3bis) Si achat بالكرتون، ضمان وجود متغير "وحدة" بتكلفة/مخزون بالوحدة
          if (unitType === 'carton' && qtyContained > 1) {
            const perUnitCost = qtyContained > 0 ? unitPrice / qtyContained : unitPrice
            const cartonCount = Number(item.quantity) || 0
            let unitVariant: any = null
            {
              let q = supabase
                .from('product_variants')
                .select('*')
                .eq('product_id', item.product_id)
                .eq('unit_type', 'unit')
              if (primaryVariantId) q = q.eq('primary_variant_id', primaryVariantId)
              const res = await q.maybeSingle()
              if (res.error && primaryVariantId && isMissingColumnError(res.error, 'primary_variant_id')) {
                const res2 = await supabase
                  .from('product_variants')
                  .select('*')
                  .eq('product_id', item.product_id)
                  .eq('unit_type', 'unit')
                  .maybeSingle()
                if (res2.error) throw res2.error
                unitVariant = res2.data
              } else {
                if (res.error) throw res.error
                unitVariant = res.data
              }
            }

            if (unitVariant?.id) {
              await supabase
                .from('product_variants')
                .update({
                  variant_name: unitVariant.variant_name || 'وحدة',
                  quantity_contained: 1,
                  purchase_price: perUnitCost,
                  stock: (unitVariant.stock || 0) + (cartonCount * qtyContained),
                })
                .eq('id', unitVariant.id)
            } else {
              await supabase
                .from('product_variants')
                .insert({
                  product_id: item.product_id,
                  primary_variant_id: primaryVariantId || null,
                  variant_name: 'وحدة',
                  unit_type: 'unit',
                  quantity_contained: 1,
                  purchase_price: perUnitCost,
                  price_a: 0,
                  price_b: 0,
                  price_c: 0,
                  price_d: 0,
                  price_e: 0,
                  stock: cartonCount * qtyContained,
                  alert_threshold: 10,
                  is_active: true,
                  is_default: true,
                })
            }

            await deleteDerivedKiloVariants(item.product_id, primaryVariantId)
          }

          // 3ter) Achat بالكيلو لكن مع تغليف كرتون => إنشاء/تحديث متغير كرتون + وحدة مشتقة
          if (unitType === 'kilo' && packagingMode === 'carton' && item.units_per_carton && item.weight_per_unit) {
            const unitsPerCarton = Number(item.units_per_carton) || 1
            const weightPerUnit = Number(item.weight_per_unit) || 1
            const cartonWeight = unitsPerCarton * weightPerUnit
            const cartonCount = cartonWeight > 0 ? baseQuantity / cartonWeight : 0
            const perCartonPrice = cartonWeight > 0 ? unitPrice * cartonWeight : unitPrice
            const perUnitPrice = unitPrice * weightPerUnit

            // carton variant
            let cartonVariant: any = null
            {
              let q = supabase
                .from('product_variants')
                .select('*')
                .eq('product_id', item.product_id)
                .eq('unit_type', 'carton')
              if (primaryVariantId) q = q.eq('primary_variant_id', primaryVariantId)
              const res = await q.maybeSingle()
              if (res.error && primaryVariantId && isMissingColumnError(res.error, 'primary_variant_id')) {
                const res2 = await supabase
                  .from('product_variants')
                  .select('*')
                  .eq('product_id', item.product_id)
                  .eq('unit_type', 'carton')
                  .maybeSingle()
                if (res2.error) throw res2.error
                cartonVariant = res2.data
              } else {
                if (res.error) throw res.error
                cartonVariant = res.data
              }
            }

            if (cartonVariant?.id) {
              await supabase
                .from('product_variants')
                .update({
                  purchase_price: perCartonPrice,
                  quantity_contained: unitsPerCarton,
                  stock: (cartonVariant.stock || 0) + cartonCount,
                })
                .eq('id', cartonVariant.id)
            } else {
              await supabase
                .from('product_variants')
                .insert({
                  product_id: item.product_id,
                  primary_variant_id: primaryVariantId || null,
                  variant_name: 'كرتون',
                  unit_type: 'carton',
                  quantity_contained: unitsPerCarton,
                  purchase_price: perCartonPrice,
                  price_a: 0,
                  price_b: 0,
                  price_c: 0,
                  price_d: 0,
                  price_e: 0,
                  stock: cartonCount,
                  alert_threshold: 10,
                  is_active: true,
                  is_default: false,
                })
            }

            // derived kilo variant (named by weight) instead of unit
            await deleteDerivedKiloVariants(item.product_id)

            const unitPieces = weightPerUnit > 0 ? (baseQuantity / weightPerUnit) : 0
            const { data: unitVariant } = await supabase
              .from('product_variants')
              .select('*')
              .eq('product_id', item.product_id)
              .eq('unit_type', 'unit')
              .maybeSingle()

            if (unitVariant?.id) {
              await supabase
                .from('product_variants')
                .update({
                  variant_name: unitVariant.variant_name || 'وحدة',
                  quantity_contained: 1,
                  purchase_price: perUnitPrice,
                  stock: (unitVariant.stock || 0) + unitPieces,
                })
                .eq('id', unitVariant.id)
            } else {
              await supabase
                .from('product_variants')
                .insert({
                  product_id: item.product_id,
                  primary_variant_id: primaryVariantId || null,
                  variant_name: 'وحدة',
                  unit_type: 'unit',
                  quantity_contained: 1,
                  purchase_price: perUnitPrice,
                  price_a: 0,
                  price_b: 0,
                  price_c: 0,
                  price_d: 0,
                  price_e: 0,
                  stock: unitPieces,
                  alert_threshold: 10,
                  is_active: true,
                  is_default: false,
                })
            }
          }
        }
      }

      // Réinitialiser le formulaire
      setPurchaseForm({
        supplier_id: '',
        warehouse_id: warehouses.length > 0 ? warehouses[0].id : '',
        purchase_date: new Date().toISOString().split('T')[0],
        status: 'received',
        tax_rate: '0',
        payment_type: 'cash',
        paid_amount: '',
        bank_name: '',
        check_number: '',
        check_date: '',
        check_deposit_date: '',
        credit_due_date: '',
        notes: ''
      })
      await loadPurchases()
      await loadProducts() // Recharger les produits pour mettre à jour les stocks

      setShowCreatePurchaseModal(false)
      setPurchaseItems([])
      setSelectedCategory(null)
    } catch (error) {
      console.error('Error creating purchase:', error)
      alert('❌ حدث خطأ أثناء إنشاء الفاتورة')
    }
  }

  // Fonctions pour gérer les paiements
  const openPaymentModal = (purchase: Purchase) => {
    setSelectedPurchase(purchase)
    setPaymentForm({
      amount: purchase.remaining_amount.toString(),
      payment_method: 'cash',
      payment_date: new Date().toISOString().split('T')[0],
      notes: ''
    })
    setShowPaymentModal(true)
  }

  const handleAddPayment = async () => {
    if (!selectedPurchase || !paymentForm.amount) return

    try {
      const amount = parseFloat(paymentForm.amount)
      const newPaidAmount = selectedPurchase.paid_amount + amount
      const newRemainingAmount = Math.max(0, selectedPurchase.total_amount - newPaidAmount)
      const newPaymentStatus = newRemainingAmount === 0 ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'pending')

      // Mettre à jour la facture
      await supabase
        .from('purchases')
        .update({
          paid_amount: newPaidAmount,
          remaining_amount: newRemainingAmount,
          payment_status: newPaymentStatus
        })
        .eq('id', selectedPurchase.id)

      // Ajouter l'enregistrement de paiement
      const { error: paymentInsertError } = await supabase
        .from('purchase_payments')
        .insert({
          purchase_id: selectedPurchase.id,
          amount: amount,
          payment_method: paymentForm.payment_method,
          payment_date: paymentForm.payment_date,
          notes: paymentForm.notes,
          created_at: new Date().toISOString()
        })

      if (paymentInsertError && !['PGRST302', 'PGRST204', 'PGRST205'].includes(paymentInsertError.code)) {
        console.warn('purchase_payments insert failed', paymentInsertError)
      }

      alert('✅ تم إضافة الدفعة بنجاح')
      setShowPaymentModal(false)
      await loadPurchases()
    } catch (error) {
      console.error('Error adding payment:', error)
      alert('❌ حدث خطأ أثناء إضافة الدفعة')
    }
  }

  // Fonctions pour éditer et supprimer une facture
  const openEditPurchaseModal = async (purchase: Purchase) => {
    try {
      const { data } = await supabase
        .from('purchases')
        .select('*, supplier:suppliers(*)')
        .eq('id', purchase.id)
        .single()

      const fullPurchase = (data as Purchase) || purchase
      setEditingPurchase(fullPurchase)
      setEditPurchaseItems(fullPurchase.items || [])
      setShowEditPurchaseModal(true)
    } catch (error) {
      console.error('Error loading purchase for edit:', error)
      alert('تعذر تحميل بيانات الفاتورة للتعديل')
    }
  }

  const calculateBaseQuantityFromLine = (item: PurchaseLineItem) => {
    const safeQuantity = Number(item.quantity) || 0
    const unitType = item.unit_type || 'kilo'
    const unitsPerCarton = item.units_per_carton && item.units_per_carton > 0 ? Number(item.units_per_carton) : 1
    const weightPerUnit = item.weight_per_unit && item.weight_per_unit > 0 ? Number(item.weight_per_unit) : 1

    switch (unitType) {
      case 'carton':
        return safeQuantity * unitsPerCarton * weightPerUnit
      case 'paquet':
      case 'sac':
        return safeQuantity * weightPerUnit
      case 'kilo':
      default:
        return safeQuantity
    }
  }

  const updateEditItem = (index: number, field: keyof PurchaseLineItem, value: any) => {
    setEditPurchaseItems(prev => {
      const copy = [...prev]
      const item = { ...copy[index] }
      ;(item as any)[field] = value
      item.line_total = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
      copy[index] = item
      return copy
    })
  }

  const handleUpdatePurchase = async () => {
    if (!editingPurchase) return

    try {
      const updatedItems = editPurchaseItems.map(item => {
        const pvs = primaryVariantsByProductId[item.product_id] || []
        const defaultPv = pvs.find(v => v.is_default) || pvs[0]
        const primaryVariantId = item.primary_variant_id || defaultPv?.id
        return {
          ...item,
          primary_variant_id: primaryVariantId,
          primary_variant_name: item.primary_variant_name || defaultPv?.variant_name,
          quantity: Number(item.quantity) || 0,
          unit_price: Number(item.unit_price) || 0,
          units_per_carton: item.units_per_carton ? Number(item.units_per_carton) : null,
          weight_per_unit: item.weight_per_unit ? Number(item.weight_per_unit) : null,
          packaging_mode: item.packaging_mode || 'none',
          line_total: (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
          base_quantity: calculateBaseQuantityFromLine(item),
        }
      })

      const subtotalUpdated = updatedItems.reduce((sum, item) => sum + item.line_total, 0)
      const taxRate = editingPurchase.tax_rate || 0
      const taxAmount = subtotalUpdated * (taxRate / 100)
      const totalAmount = subtotalUpdated + taxAmount
      const paidAmount = editingPurchase.paid_amount || 0
      const remainingAmount = Math.max(0, totalAmount - paidAmount)
      const paymentStatus = remainingAmount === 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'pending')

      // Ajuster stocks pour chaque produit selon delta
      for (const newItem of updatedItems) {
        if (!newItem.product_id) continue
        const oldItem = editingPurchase.items?.find(i =>
          i.product_id === newItem.product_id && (i.primary_variant_id || '') === (newItem.primary_variant_id || '')
        )
        const oldBaseQty = oldItem ? Number(oldItem.base_quantity ?? calculateBaseQuantityFromLine(oldItem)) || 0 : 0
        const newBaseQty = Number(newItem.base_quantity ?? calculateBaseQuantityFromLine(newItem)) || 0
        const delta = newBaseQty - oldBaseQty
        const unitPrice = Number(newItem.unit_price) || 0
        const unitType = newItem.unit_type || 'kilo'
        const packagingMode = newItem.packaging_mode || 'none'
        const primaryVariantId = newItem.primary_variant_id
        const baseQtyContained = unitType === 'kilo'
          ? 1
          : (unitType === 'carton'
            ? (newItem.units_per_carton ?? 1)
            : ((unitType === 'paquet' || unitType === 'sac') ? (newItem.weight_per_unit ?? 1) : 1))
        const qtyContained = newItem.units_per_carton && newItem.units_per_carton > 0
          ? Number(newItem.units_per_carton)
          : (newItem.weight_per_unit && newItem.weight_per_unit > 0 ? Number(newItem.weight_per_unit) : 1)

        // Stock par entrepôt
        if (editingPurchase.warehouse_id) {
          await upsertWarehouseStock({
            productId: newItem.product_id,
            primaryVariantId,
            warehouseId: editingPurchase.warehouse_id,
            delta,
            costPrice: unitPrice,
          })
        }

        // Produit principal (stock + coût moyen)
        const { data: product } = await supabase
          .from('products')
          .select('stock, cost_price')
          .eq('id', newItem.product_id)
          .single()

        if (product) {
          const currentStock = Number(product.stock) || 0
          const currentCost = Number(product.cost_price) || 0
          const stockWithoutOld = Math.max(0, currentStock - oldBaseQty)
          const newStock = Math.max(0, stockWithoutOld + newBaseQty)
          const newCost = newStock > 0
            ? ((stockWithoutOld * currentCost) + (newBaseQty * unitPrice)) / newStock
            : currentCost

          await supabase
            .from('products')
            .update({
              stock: newStock,
              cost_price: newCost
            })
            .eq('id', newItem.product_id)
        }

        // Variante principale (selon unit_type)
        let existingVariants: any[] | null = null
        {
          let q = supabase
            .from('product_variants')
            .select('*')
            .eq('product_id', newItem.product_id)
            .eq('unit_type', unitType)
          if (primaryVariantId) q = q.eq('primary_variant_id', primaryVariantId)
          const res = await q
          if (res.error && primaryVariantId && isMissingColumnError(res.error, 'primary_variant_id')) {
            const res2 = await supabase
              .from('product_variants')
              .select('*')
              .eq('product_id', newItem.product_id)
              .eq('unit_type', unitType)
            if (res2.error) throw res2.error
            existingVariants = res2.data
          } else {
            if (res.error) throw res.error
            existingVariants = res.data
          }
        }

        const existingVariant = unitType === 'kilo'
          ? (existingVariants || []).find(v => !v.quantity_contained || Number(v.quantity_contained) <= 1 || v.variant_name === 'kilo')
          : (existingVariants || [])[0]

        const newMainQty = (unitType === 'kilo') ? newBaseQty : (Number(newItem.quantity) || 0)
        const oldMainQtySameType = oldItem && (oldItem.unit_type || 'kilo') === unitType
          ? ((unitType === 'kilo') ? oldBaseQty : (Number(oldItem.quantity) || 0))
          : 0

        if (existingVariant?.id) {
          await supabase
            .from('product_variants')
            .update({
              purchase_price: unitPrice,
              quantity_contained: baseQtyContained || 1,
              stock: Math.max(0, (existingVariant.stock || 0) - oldMainQtySameType + newMainQty),
            })
            .eq('id', existingVariant.id)
        } else {
          await supabase
            .from('product_variants')
            .insert({
              product_id: newItem.product_id,
              primary_variant_id: primaryVariantId || null,
              variant_name: unitType,
              unit_type: unitType,
              quantity_contained: baseQtyContained || 1,
              purchase_price: unitPrice,
              price_a: 0,
              price_b: 0,
              price_c: 0,
              price_d: 0,
              price_e: 0,
              stock: newMainQty,
              alert_threshold: 10,
              is_active: true,
              is_default: unitType === 'unit',
            })
        }

        if (oldItem && (oldItem.unit_type || 'kilo') !== unitType) {
          const oldUnitType = oldItem.unit_type || 'kilo'
          let oldVariants: any[] | null = null
          {
            let q = supabase
              .from('product_variants')
              .select('*')
              .eq('product_id', newItem.product_id)
              .eq('unit_type', oldUnitType)
            if (primaryVariantId) q = q.eq('primary_variant_id', primaryVariantId)
            const res = await q
            if (res.error && primaryVariantId && isMissingColumnError(res.error, 'primary_variant_id')) {
              const res2 = await supabase
                .from('product_variants')
                .select('*')
                .eq('product_id', newItem.product_id)
                .eq('unit_type', oldUnitType)
              if (res2.error) throw res2.error
              oldVariants = res2.data
            } else {
              if (res.error) throw res.error
              oldVariants = res.data
            }
          }

          const oldVariant = oldUnitType === 'kilo'
            ? (oldVariants || []).find(v => !v.quantity_contained || Number(v.quantity_contained) <= 1 || v.variant_name === 'kilo')
            : (oldVariants || [])[0]

          const oldMainQty = (oldUnitType === 'kilo') ? oldBaseQty : (Number(oldItem.quantity) || 0)
          if (oldVariant?.id && oldMainQty > 0) {
            const nextOldStock = Math.max(0, (oldVariant.stock || 0) - oldMainQty)
            const oldQtyContained = oldVariant.quantity_contained ? Number(oldVariant.quantity_contained) : 1
            const isBaseKilo = oldUnitType === 'kilo' && (!oldVariant.quantity_contained || oldQtyContained <= 1)

            if (nextOldStock === 0 && isBaseKilo) {
              await supabase
                .from('product_variants')
                .delete()
                .eq('id', oldVariant.id)
            } else {
              await supabase
                .from('product_variants')
                .update({
                  stock: nextOldStock,
                })
                .eq('id', oldVariant.id)
            }
          }
        }

        // Variante unité quand achat كرتون
        if (unitType === 'carton' && qtyContained > 1) {
          const perUnitCost = qtyContained > 0 ? unitPrice / qtyContained : unitPrice
          let unitVariant: any = null
          {
            let q = supabase
              .from('product_variants')
              .select('*')
              .eq('product_id', newItem.product_id)
              .eq('unit_type', 'unit')
            if (primaryVariantId) q = q.eq('primary_variant_id', primaryVariantId)
            const res = await q.maybeSingle()
            if (res.error && primaryVariantId && isMissingColumnError(res.error, 'primary_variant_id')) {
              const res2 = await supabase
                .from('product_variants')
                .select('*')
                .eq('product_id', newItem.product_id)
                .eq('unit_type', 'unit')
                .maybeSingle()
              if (res2.error) throw res2.error
              unitVariant = res2.data
            } else {
              if (res.error) throw res.error
              unitVariant = res.data
            }
          }

          const oldCartonQty = oldItem && (oldItem.unit_type || 'kilo') === 'carton' ? (Number(oldItem.quantity) || 0) : 0
          const newCartonQty = Number(newItem.quantity) || 0
          const perUnitDelta = (newCartonQty - oldCartonQty) * qtyContained

          if (unitVariant?.id) {
            await supabase
              .from('product_variants')
              .update({
                purchase_price: perUnitCost,
                stock: Math.max(0, (unitVariant.stock || 0) + perUnitDelta),
              })
              .eq('id', unitVariant.id)
          }

          await deleteDerivedKiloVariants(newItem.product_id, primaryVariantId)
        }

        // Variante كرتون/وحدة مشتقة عند شراء كيلو مع تغليف كرتون
        if (
          (unitType === 'kilo' && packagingMode === 'carton' && newItem.units_per_carton && newItem.weight_per_unit) ||
          (oldItem?.unit_type === 'kilo' && (oldItem.packaging_mode || 'none') === 'carton' && oldItem.units_per_carton && oldItem.weight_per_unit)
        ) {
          const unitsPerCarton = Number(newItem.units_per_carton) || 1
          const weightPerUnit = Number(newItem.weight_per_unit) || 1
          const cartonWeight = unitsPerCarton * weightPerUnit
          const oldPackagingMode = oldItem?.packaging_mode || 'none'
          const oldUnitsPerCarton = oldItem?.units_per_carton ? Number(oldItem.units_per_carton) : unitsPerCarton
          const oldWeightPerUnit = oldItem?.weight_per_unit ? Number(oldItem.weight_per_unit) : weightPerUnit
          const oldCartonWeight = oldUnitsPerCarton * oldWeightPerUnit
          const newCartonCount = (unitType === 'kilo' && packagingMode === 'carton' && cartonWeight > 0)
            ? (newBaseQty / cartonWeight)
            : 0
          const oldCartonCount = (oldItem?.unit_type === 'kilo' && oldPackagingMode === 'carton' && oldCartonWeight > 0)
            ? (oldBaseQty / oldCartonWeight)
            : 0
          const cartonDelta = newCartonCount - oldCartonCount
          const perCartonPrice = cartonWeight > 0 ? unitPrice * cartonWeight : unitPrice
          const perUnitPrice = unitPrice * weightPerUnit

          // carton variant
          let cartonVariant: any = null
          {
            let q = supabase
              .from('product_variants')
              .select('*')
              .eq('product_id', newItem.product_id)
              .eq('unit_type', 'carton')
            if (primaryVariantId) q = q.eq('primary_variant_id', primaryVariantId)
            const res = await q.maybeSingle()
            if (res.error && primaryVariantId && isMissingColumnError(res.error, 'primary_variant_id')) {
              const res2 = await supabase
                .from('product_variants')
                .select('*')
                .eq('product_id', newItem.product_id)
                .eq('unit_type', 'carton')
                .maybeSingle()
              if (res2.error) throw res2.error
              cartonVariant = res2.data
            } else {
              if (res.error) throw res.error
              cartonVariant = res.data
            }
          }

          if (cartonVariant?.id) {
            await supabase
              .from('product_variants')
              .update({
                purchase_price: perCartonPrice,
                quantity_contained: unitsPerCarton,
                stock: Math.max(0, (cartonVariant.stock || 0) + cartonDelta),
              })
              .eq('id', cartonVariant.id)
          } else {
            await supabase
              .from('product_variants')
              .insert({
                product_id: newItem.product_id,
                primary_variant_id: primaryVariantId || null,
                variant_name: 'كرتون',
                unit_type: 'carton',
                quantity_contained: unitsPerCarton,
                purchase_price: perCartonPrice,
                price_a: 0,
                price_b: 0,
                price_c: 0,
                price_d: 0,
                price_e: 0,
                stock: cartonDelta,
                alert_threshold: 10,
                is_active: true,
                is_default: false,
              })
          }

          // unit variant derived
          const unitDelta = cartonDelta * unitsPerCarton
          let unitFromCarton: any = null
          {
            let q = supabase
              .from('product_variants')
              .select('*')
              .eq('product_id', newItem.product_id)
              .eq('unit_type', 'unit')
            if (primaryVariantId) q = q.eq('primary_variant_id', primaryVariantId)
            const res = await q.maybeSingle()
            if (res.error && primaryVariantId && isMissingColumnError(res.error, 'primary_variant_id')) {
              const res2 = await supabase
                .from('product_variants')
                .select('*')
                .eq('product_id', newItem.product_id)
                .eq('unit_type', 'unit')
                .maybeSingle()
              if (res2.error) throw res2.error
              unitFromCarton = res2.data
            } else {
              if (res.error) throw res.error
              unitFromCarton = res.data
            }
          }

          if (unitFromCarton?.id) {
            await supabase
              .from('product_variants')
              .update({
                purchase_price: perUnitPrice,
                stock: Math.max(0, (unitFromCarton.stock || 0) + unitDelta),
              })
              .eq('id', unitFromCarton.id)
          } else {
            await supabase
              .from('product_variants')
              .insert({
                product_id: newItem.product_id,
                primary_variant_id: primaryVariantId || null,
                variant_name: 'وحدة',
                unit_type: 'unit',
                quantity_contained: 1,
                purchase_price: perUnitPrice,
                price_a: 0,
                price_b: 0,
                price_c: 0,
                price_d: 0,
                price_e: 0,
                stock: unitDelta,
                alert_threshold: 10,
                is_active: true,
                is_default: false,
              })
          }

          await deleteDerivedKiloVariants(newItem.product_id, primaryVariantId)
        }
      }
 // Mettre à jour la facture
      const { error: updateError } = await supabase
        .from('purchases')
        .update({
          items: updatedItems,
          subtotal: subtotalUpdated,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          paid_amount: paidAmount,
          remaining_amount: remainingAmount,
          payment_status: paymentStatus,
        })
        .eq('id', editingPurchase.id)

      if (updateError) throw updateError

      alert('✅ تم تحديث الفاتورة وتحديث المخزون بنجاح')
      setShowEditPurchaseModal(false)
      setEditingPurchase(null)
      setEditPurchaseItems([])
      await loadPurchases()
      await loadProducts()
    } catch (error) {
      console.error('Error updating purchase:', error)
      alert('❌ حدث خطأ أثناء تحديث الفاتورة')
    }
  }

  const handleDeletePurchase = async (purchase: Purchase) => {
    if (!confirm(`هل أنت متأكد من حذف فاتورة الشراء ${purchase.purchase_number}؟\nسيتم أيضا خصم الكميات من المخزون!`)) {
      return
    }

    try {
      // Retirer les quantités du stock pour chaque produit dans la facture
      if (purchase.items && purchase.items.length > 0) {
        for (const item of purchase.items) {
          const productId = String(item.product_id || '')
          if (!productId) continue
          const baseQty = Number(item.base_quantity ?? item.quantity ?? 1) || 0
          if (baseQty <= 0) continue
          // Retirer du stock principal du produit
          const { data: product } = await supabase
            .from('products')
            .select('stock')
            .eq('id', productId)
            .single()

          if (product) {
            const newStock = Math.max(0, product.stock - baseQty)
            await supabase
              .from('products')
              .update({ stock: newStock, cost_price: 0 })
              .eq('id', productId)
          }

          // Retirer du stock dans les variants du produit
          const { data: variants } = await supabase
            .from('product_variants')
            .select('id, stock')
            .eq('product_id', productId)

          if (variants && variants.length > 0) {
            for (const variant of variants) {
              const newVariantStock = Math.max(0, variant.stock - baseQty)
              await supabase
                .from('product_variants')
                .update({ stock: newVariantStock, purchase_price: 0 })
                .eq('id', variant.id)
            }
          }

          // Retirer du stock par entrepôt si applicable
          const warehouseId = String((purchase as any).warehouse_id || '')
          let stockRecords: any[] | null = null
          let stockError: any = null

          if (warehouseId) {
            const res = await supabase
              .from('stock')
              .select('id, quantity_in_stock')
              .eq('product_id', productId)
              .eq('warehouse_id', warehouseId)
            stockRecords = res.data
            stockError = res.error

            if (stockError && isMissingColumnError(stockError, 'warehouse_id')) {
              const res2 = await supabase
                .from('stock')
                .select('id, quantity_in_stock')
                .eq('product_id', productId)
              stockRecords = res2.data
              stockError = res2.error
            }
          } else {
            const res = await supabase
              .from('stock')
              .select('id, quantity_in_stock')
              .eq('product_id', productId)
            stockRecords = res.data
            stockError = res.error
          }

          if (stockError) throw stockError

          if (stockRecords && stockRecords.length > 0) {
            for (const stockRecord of stockRecords) {
              const currentInStock = Number(stockRecord.quantity_in_stock ?? 0) || 0
              const newWarehouseStock = Math.max(0, currentInStock - baseQty)
              await supabase
                .from('stock')
                .update({ quantity_in_stock: newWarehouseStock })
                .eq('id', stockRecord.id)
            }
          }
        }
      }

      // Supprimer les enregistrements de paiement
      const { error: delPaymentsError } = await supabase
        .from('purchase_payments')
        .delete()
        .eq('purchase_id', purchase.id)

      if (delPaymentsError && !['PGRST204', 'PGRST302', 'PGRST205'].includes(delPaymentsError.code)) {
        console.warn('Erreur suppression paiements', delPaymentsError)
      }

      // Supprimer la facture
      await supabase
        .from('purchases')
        .delete()
        .eq('id', purchase.id)

      alert('✅ تم حذف الفاتورة وخصم الكميات من المخزون بنجاح')
      await loadPurchases()
      await loadProducts() // Recharger les produits pour mettre à jour les stocks affichés
    } catch (error) {
      console.error('Error deleting purchase:', error)
      alert('❌ حدث خطأ أثناء حذف الفاتورة')
    }
  }

  const filteredPurchases = purchases.filter(purchase =>
    purchase.items?.some(item => 
      item.product_name_ar?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product_sku?.toLowerCase().includes(searchTerm.toLowerCase())
    ) ||
    purchase.purchase_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.supplier?.name_ar?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return (
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1">
            <CheckCircle size={14} />
            مستلم
          </span>
        )
      case 'pending':
        return (
          <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1">
            <Truck size={14} />
            في الانتظار
          </span>
        )
      case 'cancelled':
        return (
          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1">
            <AlertCircle size={14} />
            ملغي
          </span>
        )
      default:
        return (
          <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-bold text-sm">
            {status}
          </span>
        )
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShoppingCart className="text-white" size={36} />
            إدارة المشتريات
          </h1>
          <p className="text-white mt-2">إنشاء وإدارة فواتير الشراء</p>
        </div>
        <button
          onClick={() => setShowCreatePurchaseModal(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700"
        >
          <Plus className="w-5 h-5" />
          فاتورة شراء جديدة
        </button>
      </div>

      {/* البحث */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="relative">
          <Search className="absolute right-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="ابحث عن فاتورة..."
            className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* جدول الفواتير */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            جاري التحميل...
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            لا توجد فواتير شراء
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white text-black border-b">
                <tr>
                  <th className="px-6 py-4 text-right font-bold">رقم الفاتورة</th>
                  <th className="px-6 py-4 text-right font-bold">المورد</th>
                  <th className="px-6 py-4 text-right font-bold">التاريخ</th>
                  <th className="px-6 py-4 text-right font-bold">الإجمالي</th>
                  <th className="px-6 py-4 text-right font-bold">المتبقي</th>
                  <th className="px-6 py-4 text-right font-bold">الحالة</th>
                  <th className="px-6 py-4 text-right font-bold">حالة الدفع</th>
                  <th className="px-6 py-4 text-right font-bold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((purchase) => (
                  <tr key={purchase.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-800">{purchase.purchase_number}</td>
                    <td className="px-6 py-4 text-gray-700">{purchase.supplier?.name_ar}</td>
                    <td className="px-6 py-4 text-gray-700">{new Date(purchase.purchase_date).toLocaleDateString('ar-MA')}</td>
                    <td className="px-6 py-4 font-bold text-gray-800">{purchase.total_amount.toFixed(2)} MAD</td>
                    <td className="px-6 py-4">
                      <span className={`font-bold ${
                        purchase.remaining_amount > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {purchase.remaining_amount.toFixed(2)} MAD
                      </span>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(purchase.status)}</td>
                    <td className="px-6 py-4">{getStatusBadge(purchase.payment_status)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {purchase.payment_status !== 'paid' && (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(purchase)}
                            className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200 transition-colors"
                            title="إضافة دفعة"
                          >
                            <CreditCard size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditPurchaseModal(purchase)}
                          className="bg-green-100 text-green-700 p-2 rounded-lg hover:bg-green-200 transition-colors"
                          title="تعديل الفاتورة"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditPurchaseModal(purchase)}
                          className="bg-gray-100 text-gray-600 p-2 rounded-lg hover:bg-gray-200 transition-colors"
                          title="عرض التفاصيل"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePurchase(purchase)}
                          className="bg-red-100 text-red-600 p-2 rounded-lg hover:bg-red-200 transition-colors"
                          title="حذف الفاتورة"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal إنشاء فاتورة شراء */}
      {showCreatePurchaseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 text-white p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">فاتورة شراء جديدة</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreatePurchaseModal(false)
                    setPurchaseItems([])
                    setSelectedCategory(null)
                  }}
                  className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSubmitPurchase}
                  className="bg-white text-green-700 hover:bg-gray-100 px-4 py-2 rounded-lg font-bold"
                >
                  حفظ الفاتورة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreatePurchaseModal(false)
                    setPurchaseItems([])
                    setSelectedCategory(null)
                  }}
                  className="hover:bg-white hover:bg-opacity-20 p-2 rounded-lg"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 grid grid-cols-12 gap-6 h-[80vh]">
              {/* Colonne gauche: Facture */}
              <div className="col-span-7 bg-white rounded-xl shadow-lg p-6 flex flex-col">
                <h3 className="text-xl font-bold text-gray-800 mb-4">فاتورة الشراء</h3>
                
                {/* Informations de la facture */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">المورد *</label>
                    <select
                      value={purchaseForm.supplier_id}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier_id: e.target.value })}
                      className="w-full p-2 border rounded-lg text-sm"
                    >
                      <option value="">اختر المورد</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name_ar}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">المستودع *</label>
                    <select
                      value={purchaseForm.warehouse_id}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, warehouse_id: e.target.value })}
                      className="w-full p-2 border rounded-lg text-sm"
                    >
                      <option value="">اختر المستودع</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">التاريخ</label>
                    <input
                      type="date"
                      value={purchaseForm.purchase_date}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })}
                      className="w-full p-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">نسبة الضريبة (%)</label>
                    <button
                      type="button"
                      onClick={() =>
                        inputPad.open({
                          title: 'نسبة الضريبة (%)',
                          mode: 'decimal',
                          dir: 'ltr',
                          initialValue: purchaseForm.tax_rate || '0',
                          min: 0,
                          onConfirm: (v) => setPurchaseForm({ ...purchaseForm, tax_rate: v }),
                        })
                      }
                      className="w-full p-2 border rounded-lg text-sm text-left"
                    >
                      {purchaseForm.tax_rate || '0'}
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">نوع الدفع</label>
                    <select
                      value={purchaseForm.payment_type}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, payment_type: e.target.value as any })}
                      className="w-full p-2 border rounded-lg text-sm"
                    >
                      <option value="cash">نقدي</option>
                      <option value="transfer">تحويل</option>
                      <option value="check">شيك</option>
                      <option value="credit">دين</option>
                    </select>
                  </div>
                </div>

                {/* Tableau des produits de la facture */}
                <div className="flex-1 bg-gray-50 rounded-lg overflow-hidden mb-4">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gray-200 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">المنتج</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">الكمية</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">سعر الوحدة</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">المجموع</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">إجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseItems.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                              لم يتم إضافة منتجات بعد
                            </td>
                          </tr>
                        ) : (
                          purchaseItems.map((item) => (
                            <tr key={item.product_id} className="border-t hover:bg-gray-100">
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => openEditModal(item)}
                                  className="text-left hover:text-blue-600 transition-colors"
                                >
                                  <p className="font-bold text-gray-800">{item.product_name_ar}</p>
                                  <p className="text-xs text-gray-600">SKU: {item.product_sku}</p>
                                </button>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="font-bold text-gray-800">{item.quantity}</span>
                              </td>
                              <td className="px-4 py-3 text-right font-medium">{item.unit_price.toFixed(2)} MAD</td>
                              <td className="px-4 py-3 text-right font-bold text-green-600">{item.line_total.toFixed(2)} MAD</td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => removeProductFromInvoice(item.product_id)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Résumé */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 space-y-2 border-2 border-green-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">الإجمالي الفرعي:</span>
                    <span className="font-bold text-gray-800">{subtotal.toFixed(2)} MAD</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">الضريبة ({taxRate}%):</span>
                    <span className="font-bold text-gray-800">{taxAmount.toFixed(2)} MAD</span>
                  </div>
                  <div className="border-t-2 border-green-300 pt-2 flex justify-between text-lg">
                    <span className="font-bold text-gray-800">الإجمالي:</span>
                    <span className="font-bold text-green-700">{totalAmount.toFixed(2)} MAD</span>
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm font-bold text-gray-700 mb-1">المبلغ المدفوع</label>
                    <button
                      type="button"
                      onClick={() =>
                        inputPad.open({
                          title: 'المبلغ المدفوع',
                          mode: 'decimal',
                          dir: 'ltr',
                          initialValue: purchaseForm.paid_amount || '0',
                          min: 0,
                          onConfirm: (v) => setPurchaseForm({ ...purchaseForm, paid_amount: v }),
                        })
                      }
                      className="w-full p-2 border rounded-lg text-sm text-left"
                    >
                      {purchaseForm.paid_amount || '0'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Colonne droite: Familles et produits */}
              <div className="col-span-5 bg-white rounded-xl shadow-lg p-6 flex flex-col">
                {/* Sélection des familles */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-3">اختر العائلة</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`px-3 py-1 rounded-lg transition-colors text-sm ${
                        !selectedCategory
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      جميع المنتجات
                    </button>
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`px-3 py-1 rounded-lg transition-colors text-sm ${
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

                {/* Affichage des produits */}
                <div className="flex-1 overflow-y-auto">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-3">
                      {selectedCategory ? 'المنتجات' : 'جميع المنتجات'}
                    </h3>
                    {filteredProducts.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Package size={48} className="mx-auto mb-4 opacity-50" />
                        <p>لا توجد منتجات في هذه الفئة</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {filteredProducts.map((product) => (
                          <button
                            key={product.id}
                            onClick={() => addProductToInvoice(product)}
                            className="border-2 border-gray-200 rounded-lg p-3 hover:border-green-500 hover:bg-green-50 transition-all"
                          >
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name_ar}
                                className="w-full h-16 object-cover rounded-lg mb-2"
                              />
                            ) : (
                              <div className="w-full h-16 bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                                <Package size={20} className="text-gray-400" />
                              </div>
                            )}
                            <p className="font-bold text-xs text-gray-800 mb-1 truncate">{product.name_ar}</p>
                            <p className="text-xs text-gray-600 mb-1">SKU: {product.sku}</p>
                            <p className="text-xs font-bold text-green-600">{(product.cost_price || product.price_a).toFixed(2)} MAD</p>
                            <p className="text-xs text-gray-500 mt-1">المخزون: {product.stock}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Popup d'édition de produit */}
            {showEditModal && editingItem && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-4 sm:p-5 w-full max-w-[420px] max-h-[92vh] overflow-y-auto shadow-2xl">
                  <h3 className="text-lg font-bold text-gray-800 mb-3">تعديل المنتج</h3>

                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">المنتج:</p>
                    <p className="font-bold text-gray-800 text-sm">{editingItem.product_name_ar}</p>
                    <p className="text-[11px] text-gray-500">SKU: {editingItem.product_sku}</p>
                  </div>

                  {(primaryVariantsByProductId[editingItem.product_id] || []).length > 0 && (
                    <div className="mb-3">
                      <label className="block text-xs font-bold text-gray-700 mb-1">المتغير</label>
                      <select
                        value={editPrimaryVariantId}
                        onChange={(e) => setEditPrimaryVariantId(e.target.value)}
                        className="w-full p-2 border rounded-lg bg-white"
                      >
                        {(primaryVariantsByProductId[editingItem.product_id] || []).map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.variant_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">الكمية</label>
                        <button
                          type="button"
                          onClick={() =>
                            inputPad.open({
                              title: 'الكمية',
                              mode: 'number',
                              dir: 'ltr',
                              initialValue: editForm.quantity.toString(),
                              min: 1,
                              onConfirm: (v) => setEditForm({ ...editForm, quantity: parseInt(v) || 1 }),
                            })
                          }
                          className="w-full p-2 border rounded-lg text-left"
                        >
                          {editForm.quantity}
                        </button>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">سعر وحدة الشراء (MAD)</label>
                        <button
                          type="button"
                          onClick={() =>
                            inputPad.open({
                              title: 'سعر وحدة الشراء (MAD)',
                              mode: 'decimal',
                              dir: 'ltr',
                              initialValue: editForm.unit_price.toString(),
                              min: 0,
                              onConfirm: (v) => setEditForm({ ...editForm, unit_price: parseFloat(v) || 0 }),
                            })
                          }
                          className="w-full p-2 border rounded-lg text-left"
                        >
                          {editForm.unit_price}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">وحدة الشراء</label>
                      <select
                        value={editForm.unit_type}
                        onChange={(e) => {
                          const newUnit = e.target.value as UnitType
                          setEditForm(prev => ({
                            ...prev,
                            unit_type: newUnit,
                            packaging_mode: newUnit === 'kilo' ? prev.packaging_mode : 'none'
                          }))
                        }}
                        className="w-full p-2 border rounded-lg bg-white"
                      >
                        <option value="kilo">كيلو</option>
                        <option value="carton">كرتون</option>
                        <option value="paquet">باكيت</option>
                        <option value="sac">كيس</option>
                      </select>
                    </div>

                    {editForm.unit_type === 'kilo' && (
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">خيارات التعبئة للكِيلو</label>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {[
                            { key: 'none', label: 'بدون' },
                            { key: 'carton', label: 'يوجد كرتون' },
                            { key: 'sachet', label: 'يوجد كيس/ساشي' },
                          ].map(option => (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => setEditForm({ ...editForm, packaging_mode: option.key as 'none' | 'carton' | 'sachet' })}
                              className={`border rounded-lg py-2 ${editForm.packaging_mode === option.key ? 'border-green-500 text-green-600 font-bold' : 'border-gray-200 text-gray-600'}`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {(editForm.unit_type === 'carton' || editForm.unit_type === 'kilo' && editForm.packaging_mode === 'carton') && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-gray-700">عدد الوحدات في الكرتون (اختياري)</label>
                          {editForm.units_per_carton !== null && (
                            <button
                              type="button"
                              onClick={() => setEditForm({ ...editForm, units_per_carton: null })}
                              className="text-xs text-red-500 hover:underline"
                            >
                              مسح
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            inputPad.open({
                              title: 'عدد الوحدات في الكرتون',
                              mode: 'number',
                              dir: 'ltr',
                              initialValue: editForm.units_per_carton?.toString() || '',
                              min: 1,
                              onConfirm: (v) => {
                                const parsed = parseInt(v)
                                setEditForm({ ...editForm, units_per_carton: Number.isNaN(parsed) ? null : parsed })
                              },
                            })
                          }
                          className="w-full p-2 border rounded-lg text-left"
                        >
                          {editForm.units_per_carton ?? 'غير محدد'}
                        </button>
                      </div>
                    )}

                    {(editForm.unit_type !== 'kilo' || editForm.packaging_mode !== 'none') && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-bold text-gray-700">
                            وزن الوحدة ({(editForm.unit_type === 'carton' || (editForm.unit_type === 'kilo' && editForm.packaging_mode === 'carton')) ? 'داخل الكرتون' : (editForm.unit_type === 'sac' || (editForm.unit_type === 'kilo' && editForm.packaging_mode === 'sachet')) ? 'الكيس' : 'الوحدة'}) - اختياري
                          </label>
                          {editForm.weight_per_unit !== null && (
                            <button
                              type="button"
                              onClick={() => setEditForm({ ...editForm, weight_per_unit: null })}
                              className="text-xs text-red-500 hover:underline"
                            >
                              مسح
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            inputPad.open({
                              title: 'وزن الوحدة (كغ)',
                              mode: 'decimal',
                              dir: 'ltr',
                              initialValue: editForm.weight_per_unit?.toString() || '',
                              min: 0,
                              onConfirm: (v) => {
                                const parsed = parseFloat(v)
                                setEditForm({ ...editForm, weight_per_unit: Number.isNaN(parsed) ? null : parsed })
                              },
                            })
                          }
                          className="w-full p-2 border rounded-lg text-left"
                        >
                          {editForm.weight_per_unit ?? 'غير محدد'}
                        </button>
                        <p className="text-[11px] text-gray-500 mt-1">يمكن تركه فارغًا إذا لم تكن هذه المعلومة متوفرة.</p>
                      </div>
                    )}

                    {(() => {
                      const totalCost = editForm.quantity * editForm.unit_price
                      const baseQty = calculateBaseQuantity(editForm)
                      const baseCost = baseQty > 0 ? totalCost / baseQty : 0
                      let packagingInfo: {
                        packagesLabel: string
                        packagesCount: number
                        unitsCount: number
                        costPerPackage: number
                        costPerUnit: number
                      } | null = null

                      const hasPackagingQuantities = (editForm.units_per_carton ?? 0) > 0 && (editForm.weight_per_unit ?? 0) > 0
                      if (editForm.unit_type === 'kilo' && editForm.packaging_mode !== 'none' && hasPackagingQuantities) {
                        const kilosPerPackage = (editForm.units_per_carton || 0) * (editForm.weight_per_unit || 0)
                        if (kilosPerPackage > 0) {
                          const packagesCount = editForm.quantity / kilosPerPackage
                          const unitsCount = packagesCount * (editForm.units_per_carton || 0)
                          const costPerPackage = kilosPerPackage * editForm.unit_price
                          const costPerUnit = (editForm.weight_per_unit || 0) * editForm.unit_price
                          packagingInfo = {
                            packagesLabel: editForm.packaging_mode === 'carton' ? 'الكراتين المحسوبة' : 'الأكياس المحسوبة',
                            packagesCount,
                            unitsCount,
                            costPerPackage,
                            costPerUnit,
                          }
                        }
                      }

                      return (
                        <div className="bg-gray-50 rounded-lg p-2.5 space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">المجموع:</span>
                            <span className="font-bold text-green-600">{totalCost.toFixed(2)} MAD</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">الكمية الأساسية المضافة:</span>
                            <span className="font-bold text-gray-800">{baseQty.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">التكلفة لكل وحدة أساسية:</span>
                            <span className="font-bold text-gray-800">{baseCost.toFixed(2)} MAD</span>
                          </div>
                          {packagingInfo && (
                            <div className="pt-2 mt-1 border-t border-dashed border-gray-200 space-y-1">
                              <div className="flex justify-between">
                                <span className="text-gray-600">{packagingInfo.packagesLabel}:</span>
                                <span className="font-bold text-gray-800">{packagingInfo.packagesCount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">عدد الوحدات/القطع:</span>
                                <span className="font-bold text-gray-800">{packagingInfo.unitsCount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">التكلفة لكل {editForm.packaging_mode === 'carton' ? 'كرتون' : 'كيس'}:</span>
                                <span className="font-bold text-gray-800">{packagingInfo.costPerPackage.toFixed(2)} MAD</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">التكلفة لكل وحدة/قطعة:</span>
                                <span className="font-bold text-gray-800">{packagingInfo.costPerUnit.toFixed(2)} MAD</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>

                  <div className="flex gap-2 mt-5 text-sm">
                    <button
                      onClick={() => setShowEditModal(false)}
                      className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-bold"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={saveEdit}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-bold"
                    >
                      حفظ
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Popup d'ajout de paiement */}
            {showPaymentModal && selectedPurchase && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-md">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">إضافة دفعة</h3>
                  
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">فاتورة:</p>
                    <p className="font-bold text-gray-800">{selectedPurchase.purchase_number}</p>
                    <p className="text-sm text-gray-600">المورد: {selectedPurchase.supplier?.name_ar}</p>
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">الإجمالي:</span>
                        <span className="font-bold">{selectedPurchase.total_amount.toFixed(2)} MAD</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">المدفوع:</span>
                        <span className="font-bold text-green-600">{selectedPurchase.paid_amount.toFixed(2)} MAD</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold">
                        <span className="text-red-600">المتبقي:</span>
                        <span className="text-red-600">{selectedPurchase.remaining_amount.toFixed(2)} MAD</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">المبلغ *</label>
                      <button
                        type="button"
                        onClick={() =>
                          inputPad.open({
                            title: 'المبلغ *',
                            mode: 'decimal',
                            dir: 'ltr',
                            initialValue: paymentForm.amount || '0',
                            min: 0.01,
                            max: selectedPurchase.remaining_amount,
                            onConfirm: (v) => setPaymentForm({ ...paymentForm, amount: v }),
                          })
                        }
                        className="w-full p-2 border rounded-lg text-left"
                      >
                        {paymentForm.amount || '0'}
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">طريقة الدفع *</label>
                      <select
                        value={paymentForm.payment_method}
                        onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value as any })}
                        className="w-full p-2 border rounded-lg"
                      >
                        <option value="cash">نقدي</option>
                        <option value="transfer">تحويل بنكي</option>
                        <option value="check">شيك</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">تاريخ الدفع</label>
                      <input
                        type="date"
                        value={paymentForm.payment_date}
                        onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات</label>
                      <textarea
                        value={paymentForm.notes}
                        onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                        className="w-full p-2 border rounded-lg"
                        rows={3}
                        placeholder="ملاحظات إضافية..."
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setShowPaymentModal(false)}
                      className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-bold"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={handleAddPayment}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-bold"
                    >
                      إضافة الدفعة
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Popup détails de la facture */}
            {showEditPurchaseModal && editingPurchase && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-800">تعديل فاتورة الشراء</h3>
                    <button
                      onClick={() => setShowEditPurchaseModal(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X size={24} />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">رقم الفاتورة</p>
                      <p className="font-bold text-gray-800">{editingPurchase.purchase_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">المورد</p>
                      <p className="font-bold text-gray-800">{editingPurchase.supplier?.name_ar}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">التاريخ</p>
                      <p className="font-bold text-gray-800">{new Date(editingPurchase.purchase_date).toLocaleDateString('ar-MA')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">الحالة</p>
                      <div>{getStatusBadge(editingPurchase.status)}</div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-bold text-gray-800 mb-3">المنتجات</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full border">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-right">المنتج</th>
                            <th className="px-4 py-2 text-center">الكمية</th>
                            <th className="px-4 py-2 text-right">سعر الوحدة</th>
                            <th className="px-4 py-2 text-right">الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editPurchaseItems.map((item, index) => (
                            <tr key={index} className="border-t">
                              <td className="px-4 py-2">
                                <p className="font-bold">{item.product_name_ar}</p>
                                <p className="text-xs text-gray-500">SKU: {item.product_sku}</p>
                              </td>
                              <td className="px-4 py-2 text-center">
                                <input
                                  type="number"
                                  className="w-24 p-1 border rounded text-center"
                                  min={0}
                                  step={0.01}
                                  value={item.quantity}
                                  onChange={(e) => updateEditItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                />
                              </td>
                              <td className="px-4 py-2 text-right">
                                <input
                                  type="number"
                                  className="w-24 p-1 border rounded text-right"
                                  min={0}
                                  step={0.01}
                                  value={item.unit_price}
                                  onChange={(e) => updateEditItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                />
                              </td>
                              <td className="px-4 py-2 text-right font-bold">{item.line_total.toFixed(2)} MAD</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-600">الإجمالي</p>
                      <p className="font-bold text-gray-800">{editingPurchase.total_amount.toFixed(2)} MAD</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">المدفوع</p>
                      <p className="font-bold text-green-600">{editingPurchase.paid_amount.toFixed(2)} MAD</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">المتبقي</p>
                      <p className="font-bold text-red-600">{editingPurchase.remaining_amount.toFixed(2)} MAD</p>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setShowEditPurchaseModal(false)}
                      className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-bold"
                    >
                      إغلاق
                    </button>
                    <button
                      onClick={handleUpdatePurchase}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-bold"
                    >
                      حفظ التعديلات
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Modals accessibles حتى عند إغلاق نافذة إنشاء الفاتورة */}
      {!showCreatePurchaseModal && showPaymentModal && selectedPurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">إضافة دفعة</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">المبلغ</label>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">طريقة الدفع</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value as any })}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="cash">نقدًا</option>
                  <option value="transfer">تحويل</option>
                  <option value="check">شيك</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">تاريخ الدفع</label>
                <input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                  rows={3}
                  placeholder="ملاحظات إضافية..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddPayment}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-bold"
              >
                إضافة الدفعة
              </button>
            </div>
          </div>
        </div>
      )}

      {!showCreatePurchaseModal && showEditPurchaseModal && editingPurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">تعديل فاتورة الشراء</h3>
              <button
                onClick={() => setShowEditPurchaseModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">رقم الفاتورة</p>
                <p className="font-bold text-gray-800">{editingPurchase.purchase_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">المورد</p>
                <p className="font-bold text-gray-800">{editingPurchase.supplier?.name_ar}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">التاريخ</p>
                <p className="font-bold text-gray-800">{new Date(editingPurchase.purchase_date).toLocaleDateString('ar-MA')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">الحالة</p>
                <div>{getStatusBadge(editingPurchase.status)}</div>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="font-bold text-gray-800 mb-3">المنتجات</h4>
              <div className="overflow-x-auto">
                <table className="w-full border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-right">المنتج</th>
                      <th className="px-4 py-2 text-center">الكمية</th>
                      <th className="px-4 py-2 text-right">سعر الوحدة</th>
                      <th className="px-4 py-2 text-right">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editPurchaseItems.map((item, index) => (
                      <tr key={index} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            className="text-left hover:text-blue-600"
                            onClick={() => {
                              setEditingItem(item)
                              setEditForm({
                                quantity: item.quantity,
                                unit_price: item.unit_price,
                                unit_type: item.unit_type || 'kilo',
                                units_per_carton: item.units_per_carton ?? 1,
                                weight_per_unit: item.weight_per_unit ?? 1,
                                packaging_mode: item.packaging_mode || 'none',
                              })
                              setShowEditModal(true)
                            }}
                          >
                            <p className="font-bold">{item.product_name_ar}</p>
                            <p className="text-xs text-gray-500">SKU: {item.product_sku}</p>
                          </button>
                        </td>
                        <td className="px-4 py-2 text-center">{item.quantity}</td>
                        <td className="px-4 py-2 text-right">{item.unit_price.toFixed(2)} MAD</td>
                        <td className="px-4 py-2 text-right font-bold">{item.line_total.toFixed(2)} MAD</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">الإجمالي</p>
                <p className="font-bold text-gray-800">{editingPurchase.total_amount.toFixed(2)} MAD</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">المدفوع</p>
                <p className="font-bold text-green-600">{editingPurchase.paid_amount.toFixed(2)} MAD</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">المتبقي</p>
                <p className="font-bold text-red-600">{editingPurchase.remaining_amount.toFixed(2)} MAD</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditPurchaseModal(false)}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-bold"
              >
                إغلاق
              </button>
              <button
                onClick={handleUpdatePurchase}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-bold"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal تعديل المنتج متاح عالميًا (للاستخدام من نافذة التعديل أيضًا) */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-4 sm:p-5 w-full max-w-[420px] max-h-[92vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-3">تعديل المنتج</h3>

            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">المنتج:</p>
              <p className="font-bold text-gray-800 text-sm">{editingItem.product_name_ar}</p>
              <p className="text-[11px] text-gray-500">SKU: {editingItem.product_sku}</p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">الكمية</label>
                  <button
                    type="button"
                    onClick={() =>
                      inputPad.open({
                        title: 'الكمية',
                        mode: 'number',
                        dir: 'ltr',
                        initialValue: editForm.quantity.toString(),
                        min: 1,
                        onConfirm: (v) => setEditForm({ ...editForm, quantity: parseInt(v) || 1 }),
                      })
                    }
                    className="w-full p-2 border rounded-lg text-left"
                  >
                    {editForm.quantity}
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">سعر وحدة الشراء (MAD)</label>
                  <button
                    type="button"
                    onClick={() =>
                      inputPad.open({
                        title: 'سعر وحدة الشراء (MAD)',
                        mode: 'decimal',
                        dir: 'ltr',
                        initialValue: editForm.unit_price.toString(),
                        min: 0,
                        onConfirm: (v) => setEditForm({ ...editForm, unit_price: parseFloat(v) || 0 }),
                      })
                    }
                    className="w-full p-2 border rounded-lg text-left"
                  >
                    {editForm.unit_price}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">وحدة الشراء</label>
                <select
                  value={editForm.unit_type}
                  onChange={(e) => {
                    const newUnit = e.target.value as UnitType
                    setEditForm(prev => ({
                      ...prev,
                      unit_type: newUnit,
                      packaging_mode: newUnit === 'kilo' ? prev.packaging_mode : 'none'
                    }))
                  }}
                  className="w-full p-2 border rounded-lg bg-white"
                >
                  <option value="kilo">كيلو</option>
                  <option value="carton">كرتون</option>
                  <option value="paquet">باكيت</option>
                  <option value="sac">كيس</option>
                </select>
              </div>

              {editForm.unit_type === 'kilo' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">خيارات التعبئة للكِيلو</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { key: 'none', label: 'بدون' },
                      { key: 'carton', label: 'يوجد كرتون' },
                      { key: 'sachet', label: 'يوجد كيس/ساشي' },
                    ].map(option => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setEditForm(prev => ({ ...prev, packaging_mode: option.key as any }))}
                        className={`p-2 border rounded-lg ${editForm.packaging_mode === option.key ? 'bg-purple-100 border-purple-400' : 'bg-white'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {editForm.packaging_mode === 'carton' && (
                    <div className="mt-3">
                      <label className="block text-xs font-bold text-gray-700 mb-1">عدد الوحدات في الكرتون</label>
                      <button
                        type="button"
                        onClick={() =>
                          inputPad.open({
                            title: 'عدد الوحدات في الكرتون',
                            mode: 'number',
                            dir: 'ltr',
                            initialValue: (editForm.units_per_carton || 0).toString(),
                            min: 1,
                            onConfirm: (v) => setEditForm({ ...editForm, units_per_carton: parseInt(v) || 1 }),
                          })
                        }
                        className="w-full p-2 border rounded-lg text-left"
                      >
                        {editForm.units_per_carton || 1}
                      </button>
                      <label className="block text-xs font-bold text-gray-700 mb-1 mt-3">وزن/كمية كل وحدة داخل الكرتون</label>
                      <button
                        type="button"
                        onClick={() =>
                          inputPad.open({
                            title: 'وزن/كمية كل وحدة داخل الكرتون',
                            mode: 'decimal',
                            dir: 'ltr',
                            initialValue: (editForm.weight_per_unit || 0).toString(),
                            min: 0.001,
                            onConfirm: (v) => setEditForm({ ...editForm, weight_per_unit: parseFloat(v) || 1 }),
                          })
                        }
                        className="w-full p-2 border rounded-lg text-left"
                      >
                        {editForm.weight_per_unit || 1}
                      </button>
                    </div>
                  )}

                  {editForm.packaging_mode === 'sachet' && (
                    <div className="mt-3">
                      <label className="block text-xs font-bold text-gray-700 mb-1">عدد/وزن كل كيس</label>
                      <button
                        type="button"
                        onClick={() =>
                          inputPad.open({
                            title: 'عدد/وزن كل كيس',
                            mode: 'decimal',
                            dir: 'ltr',
                            initialValue: (editForm.weight_per_unit || 0).toString(),
                            min: 0.001,
                            onConfirm: (v) => setEditForm({ ...editForm, weight_per_unit: parseFloat(v) || 1 }),
                          })
                        }
                        className="w-full p-2 border rounded-lg text-left"
                      >
                        {editForm.weight_per_unit || 1}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {editForm.unit_type === 'carton' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">عدد الوحدات في الكرتون</label>
                  <button
                    type="button"
                    onClick={() =>
                      inputPad.open({
                        title: 'عدد الوحدات في الكرتون',
                        mode: 'number',
                        dir: 'ltr',
                        initialValue: (editForm.units_per_carton || 0).toString(),
                        min: 1,
                        onConfirm: (v) => setEditForm({ ...editForm, units_per_carton: parseInt(v) || 1 }),
                      })
                    }
                    className="w-full p-2 border rounded-lg text-left"
                  >
                    {editForm.units_per_carton || 1}
                  </button>
                  <label className="block text-xs font-bold text-gray-700 mb-1 mt-3">الوزن/الكمية لكل وحدة</label>
                  <button
                    type="button"
                    onClick={() =>
                      inputPad.open({
                        title: 'الوزن/الكمية لكل وحدة داخل الكرتون',
                        mode: 'decimal',
                        dir: 'ltr',
                        initialValue: (editForm.weight_per_unit || 0).toString(),
                        min: 0.001,
                        onConfirm: (v) => setEditForm({ ...editForm, weight_per_unit: parseFloat(v) || 1 }),
                      })
                    }
                    className="w-full p-2 border rounded-lg text-left"
                  >
                    {editForm.weight_per_unit || 1}
                  </button>
                </div>
              )}
              {(editForm.unit_type === 'paquet' || editForm.unit_type === 'sac') && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">الوزن/الكمية لكل باكيت/كيس</label>
                  <button
                    type="button"
                    onClick={() =>
                      inputPad.open({
                        title: 'الوزن/الكمية لكل باكيت/كيس',
                        mode: 'decimal',
                        dir: 'ltr',
                        initialValue: (editForm.weight_per_unit || 0).toString(),
                        min: 0.001,
                        onConfirm: (v) => setEditForm({ ...editForm, weight_per_unit: parseFloat(v) || 1 }),
                      })
                    }
                    className="w-full p-2 border rounded-lg text-left"
                  >
                    {editForm.weight_per_unit || 1}
                  </button>
                </div>
              )}

              {/* ملخص الأسعار والكمية الأساسية */}
              {(() => {
                const baseQty = calculateBaseQuantity(editForm)
                const total = editForm.quantity * editForm.unit_price
                const baseUnitCost = baseQty > 0 ? total / baseQty : 0
                const rawUnitsPerCarton = editForm.units_per_carton || 1
                const rawPieceWeight = editForm.weight_per_unit || 1
                const isCartonUnit = editForm.unit_type === 'carton'
                const isKiloCarton = editForm.unit_type === 'kilo' && editForm.packaging_mode === 'carton'
                const sachetUnits = (editForm.unit_type === 'paquet' || editForm.unit_type === 'sac') ? rawPieceWeight : null

                // فقط عند الكرتون نستخدم قيم الكرتون، غير ذلك نعتبرها 1
                const unitsPerCarton = (isCartonUnit || isKiloCarton) ? rawUnitsPerCarton : 1
                const pieceWeight = (isCartonUnit || isKiloCarton) ? rawPieceWeight : 1
                const cartonWeight = unitsPerCarton * pieceWeight // الوزن/الكمية الإجمالية للكرتون (بـ وحدة الأساس)

                // Calculs spécifiques للكرتون في حالة الشراء بالكيلو مع تعبئة كرتون
                const totalPieces = isCartonUnit
                  ? editForm.quantity * unitsPerCarton
                  : (isKiloCarton && pieceWeight > 0 ? (editForm.quantity / pieceWeight) : (sachetUnits ? editForm.quantity * sachetUnits : editForm.quantity))

                const cartonCount = isCartonUnit
                  ? editForm.quantity
                  : (isKiloCarton && unitsPerCarton > 0 ? (totalPieces / unitsPerCarton) : null)

                const cartonPrice = isCartonUnit
                  ? editForm.unit_price
                  : (isKiloCarton ? editForm.unit_price * cartonWeight : null)

                const unitPriceInsideCarton = isCartonUnit
                  ? (unitsPerCarton ? editForm.unit_price / unitsPerCarton : null)
                  : (isKiloCarton && unitsPerCarton > 0 ? (cartonPrice ?? 0) / unitsPerCarton : null)

                const costPerCartonUnit = unitPriceInsideCarton ?? baseUnitCost
                const cartonUnitsDisplay = (isCartonUnit || isKiloCarton) ? unitsPerCarton : null
                const costLabel = cartonUnitsDisplay ? 'التكلفة لكل وحدة داخل الكرتون:' : 'التكلفة لكل وحدة:'
                const costValue = cartonUnitsDisplay ? costPerCartonUnit : baseUnitCost

                return (
                  <div className="mt-4 p-3 bg-gray-50 border rounded-lg space-y-2 text-sm">
                    <p className="font-bold text-gray-800">ملخص السعر والكمية</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex justify-between"><span className="text-gray-600">المجموع:</span><span className="font-bold">{total.toFixed(2)} MAD</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">الكمية الأساسية المضافة:</span><span className="font-bold">{baseQty.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">{costLabel}</span><span className="font-bold">{costValue.toFixed(2)} MAD</span></div>
                      {cartonCount !== null && (
                        <div className="flex justify-between"><span className="text-gray-600">عدد الكراتين المشتراة:</span><span className="font-bold">{cartonCount}</span></div>
                      )}
                      {totalPieces !== null && (
                        <div className="flex justify-between"><span className="text-gray-600">إجمالي القطع/الوحدات:</span><span className="font-bold">{totalPieces}</span></div>
                      )}
                      {editForm.unit_type === 'kilo' && (
                        <div className="flex justify-between"><span className="text-gray-600">سعر الكيلو:</span><span className="font-bold">{editForm.unit_price.toFixed(2)} MAD</span></div>
                      )}
                      {cartonUnitsDisplay && cartonPrice !== null && (
                        <div className="flex justify-between"><span className="text-gray-600">سعر الكرتون:</span><span className="font-bold">{cartonPrice.toFixed(2)} MAD</span></div>
                      )}
                      {cartonUnitsDisplay && (
                        <div className="flex justify-between"><span className="text-gray-600">عدد الوحدات في الكرتون:</span><span className="font-bold">{cartonUnitsDisplay}</span></div>
                      )}
                      {cartonUnitsDisplay && unitPriceInsideCarton !== null && (
                        <div className="flex justify-between"><span className="text-gray-600">سعر الوحدة داخل الكرتون:</span><span className="font-bold">{unitPriceInsideCarton.toFixed(3)} MAD</span></div>
                      )}
                      {sachetUnits && (
                        <div className="flex justify-between"><span className="text-gray-600">سعر الكيس/الساشي:</span><span className="font-bold">{editForm.unit_price.toFixed(2)} MAD</span></div>
                      )}
                      {sachetUnits && (
                        <div className="flex justify-between"><span className="text-gray-600">الكمية لكل كيس/ساشي:</span><span className="font-bold">{sachetUnits}</span></div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="flex gap-2 mt-5 text-sm">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={saveEdit}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-bold"
              >
                حفظ التعديل
              </button>
            </div>
          </div>
        </div>
      )}

      {inputPad.Modal}
    </div>
  )
}
