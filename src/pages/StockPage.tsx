import { useEffect, useState } from 'react'
import { Search, Package, TrendingUp, TrendingDown, AlertTriangle, Building, CheckCircle, Plus, Minus, X, Pencil, ShoppingCart } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useInputPad } from '../components/useInputPad'
import { matchesSearch } from '../utils/searchNormalize'

// Mêmes unités d'achat que la page Achats (PurchasesPage)
type UnitType = 'kilo' | 'litre' | 'carton' | 'paquet' | 'sac' | 'unit'

interface BuyForm {
  quantity: number
  unit_price: number
  unit_type: UnitType
  units_per_carton: number | null
  weight_per_unit: number | null
  packaging_mode: 'none' | 'carton' | 'sachet'
}

// Convertit la saisie d'achat (quantité × unité × packaging) en quantité de base
// (= unité affichée dans le stock). Identique à PurchasesPage.calculateBaseQuantity.
const calculateBaseQuantity = (form: BuyForm) => {
  const safeQuantity = Number(form.quantity) || 0
  const hasUnitsPerCarton = form.units_per_carton != null && form.units_per_carton > 0
  const hasWeightPerUnit = form.weight_per_unit != null && form.weight_per_unit > 0
  const unitsPerCarton = hasUnitsPerCarton ? Number(form.units_per_carton) : 1
  const weightPerUnit = hasWeightPerUnit ? Number(form.weight_per_unit) : 1

  switch (form.unit_type) {
    case 'carton':
      return safeQuantity * unitsPerCarton * weightPerUnit
    case 'paquet':
    case 'sac':
      return safeQuantity * weightPerUnit
    case 'litre':
    case 'kilo':
    default:
      return safeQuantity
  }
}

interface Product {
  id: string
  name_ar: string
  name_en?: string
  sku: string
  stock: number
  price_a: number
  cost_price?: number
  image_url?: string
  category_id?: string
}

interface Category {
  id: string
  name_ar: string
  name_en?: string
}

interface Warehouse {
  id: string
  name: string
  address?: string
  is_active: boolean
}

interface WarehouseStock {
  id: string
  warehouse_id: string
  product_id: string
  quantity: number
  min_alert_level: number
}

export default function StockPage() {
  const inputPad = useInputPad()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehouseStock, setWarehouseStock] = useState<WarehouseStock[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'out' | 'good'>('all')
  // Pagination: max 50 produits par page pour éviter de tout rendre d'un coup.
  const PAGE_SIZE = 50
  const [page, setPage] = useState(1)
  // Ajustement manuel du stock (stock préexistant / inventaire)
  // Par défaut on affiche TOUS les produits (même ceux encore absents du dépôt,
  // stock 0) afin qu'un produit fraîchement créé dans la page Produits apparaisse
  // immédiatement ici. Décocher la case masque les produits sans ligne warehouse_stock.
  const [showAllProducts, setShowAllProducts] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustTargets, setAdjustTargets] = useState<Product[]>([])
  const [adjustMode, setAdjustMode] = useState<'add' | 'sub' | 'set'>('add')
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustSaving, setAdjustSaving] = useState(false)
  // Réapprovisionnement « comme un achat » (même fenêtre que la page Achats) :
  // saisie quantité + unité + prix d'achat, qui met à jour le stock ET le prix
  // d'achat de référence (propagé vers la page Produits et la caisse).
  const [buyOpen, setBuyOpen] = useState(false)
  const [buyTarget, setBuyTarget] = useState<Product | null>(null)
  const [buySaving, setBuySaving] = useState(false)
  const [buyForm, setBuyForm] = useState<BuyForm>({
    quantity: 1,
    unit_price: 0,
    unit_type: 'kilo',
    units_per_carton: 1,
    weight_per_unit: 1,
    packaging_mode: 'none',
  })

  useEffect(() => {
    loadProducts()
    loadCategories()
    loadWarehouses()
  }, [])

  useEffect(() => {
    if (selectedWarehouse) {
      loadWarehouseStock(selectedWarehouse)
    }
  }, [selectedWarehouse])

  // Revenir à la première page quand un filtre/recherche/dépôt change.
  useEffect(() => {
    setPage(1)
  }, [searchTerm, selectedCategory, filterStatus, selectedWarehouse, showAllProducts])

  const loadProducts = async () => {
    setLoading(true)
    try {
      // Charger TOUS les produits actifs, comme la page Produits. Supabase limite
      // une requête à 1000 lignes par défaut : on boucle par tranches pour ne
      // manquer aucun produit (ancien ou nouveau) au-delà de 1000.
      const pageSize = 1000
      let from = 0
      const all: Product[] = []
      while (true) {
        const { data, error } = await supabase
          .from('products')
          .select('id, name_ar, name_en, sku, stock, price_a, cost_price, image_url, category_id')
          .eq('is_active', true)
          .order('name_ar')
          // Clé de tri unique en second: sans elle, la pagination .range() par
          // tranches de 1000 peut sauter/dupliquer des lignes quand des name_ar
          // sont à égalité (produits manquants dans la liste).
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1)

        if (error) throw error
        const batch = (data || []) as Product[]
        all.push(...batch)
        if (batch.length < pageSize) break
        from += pageSize
      }

      setProducts(all)
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .order('name_ar')

      if (error) throw error
      
      setCategories(data || [])
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const loadWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .order('name')

      if (error) throw error
      
      setWarehouses(data || [])
      
      // Sélectionner le premier dépôt par défaut si aucun n'est sélectionné
      if (data && data.length > 0 && !selectedWarehouse) {
        setSelectedWarehouse(data[0].id)
      }
    } catch (error) {
      console.error('Error loading warehouses:', error)
    }
  }

  const loadWarehouseStock = async (warehouseId: string) => {
    setLoading(true)
    try {
      // Source de vérité par dépôt: la table `warehouse_stock`.
      // (La table `stock` chez ce projet est globale et ne possède pas de colonne
      // warehouse_id; les achats écrivent dans warehouse_stock via un dual-write.)
      // Charger toutes les lignes du dépôt par tranches (limite Supabase = 1000).
      const pageSize = 1000
      let from = 0
      const rows: any[] = []
      while (true) {
        const { data, error } = await supabase
          .from('warehouse_stock')
          .select('id, warehouse_id, product_id, quantity')
          .eq('warehouse_id', warehouseId)
          // Ordre stable obligatoire pour une pagination .range() fiable.
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1)

        if (error) throw error
        const batch = data || []
        rows.push(...batch)
        if (batch.length < pageSize) break
        from += pageSize
      }

      const aggregated: WarehouseStock[] = rows.map((row: any) => ({
        id: row.id,
        warehouse_id: row.warehouse_id,
        product_id: row.product_id,
        quantity: Number(row.quantity ?? 0) || 0,
        min_alert_level: 0,
      }))

      setWarehouseStock(aggregated)
    } catch (error) {
      console.error('Error loading warehouse stock:', error)
    } finally {
      setLoading(false)
    }
  }

  // Source unique de produits: la table products (synchronisée avec la page Produits).
  // Le warehouse_stock fournit uniquement la quantité par produit pour le dépôt sélectionné.
  const warehouseStockByProduct: Record<string, number> = warehouseStock.reduce(
    (acc, ws) => {
      acc[ws.product_id] = ws.quantity
      return acc
    },
    {} as Record<string, number>
  )

  const getStockForProduct = (product: Product) =>
    selectedWarehouse
      ? warehouseStockByProduct[product.id] || 0
      : product.stock

  // Quand un dépôt est sélectionné, restreindre aux produits ayant une ligne
  // dans `warehouse_stock` pour ce dépôt (= produits effectivement présents).
  // Sauf si "afficher tous les produits" est activé (pour saisir un stock
  // préexistant sur des produits encore absents du dépôt → quantité 0).
  const currentStockData = selectedWarehouse
    ? (showAllProducts ? products : products.filter(p => warehouseStockByProduct[p.id] !== undefined))
    : products
  const filteredStockData = currentStockData.filter(product =>
    // Recherche normalisée (arabe: أ/إ/آ -> ا, etc.) comme la page Produits,
    // sinon "اكوافينا" ne trouve pas "أكوافينا".
    matchesSearch(product.name_ar, searchTerm) ||
    matchesSearch(product.sku, searchTerm)
  ).filter(product => {
    if (selectedCategory && product.category_id !== selectedCategory) return false

    const stock = getStockForProduct(product)

    if (filterStatus === 'low') return stock > 0 && stock < 10
    if (filterStatus === 'out') return stock === 0
    if (filterStatus === 'good') return stock >= 10
    return true
  })

  // Découpage en pages de PAGE_SIZE. On borne la page courante au nombre de
  // pages disponibles (utile si le filtrage réduit la liste).
  const totalPages = Math.max(1, Math.ceil(filteredStockData.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedStockData = filteredStockData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Garder uniquement les catégories ayant un nom lisible (Arabe/Latin)
  // et qui contiennent au moins un produit dans la vue actuelle.
  const isReadableName = (name?: string) => {
    if (!name) return false
    const trimmed = name.trim()
    if (trimmed.length < 2) return false
    // Doit contenir au moins une lettre arabe ou latine
    if (!/[\u0600-\u06FFA-Za-zÀ-ÿ]/.test(trimmed)) return false
    // Rejeter les noms contenant des caractères de contrôle / remplacement / symboles bizarres
    if (/[\uFFFD\u0000-\u001F]/.test(trimmed)) return false
    // Rejeter si trop de caractères non-lettres / non-espaces / non-ponctuation simple
    const letters = (trimmed.match(/[\u0600-\u06FFA-Za-zÀ-ÿ]/g) || []).length
    if (letters / trimmed.length < 0.5) return false
    return true
  }

  const visibleCategories = categories.filter(c => {
    if (!isReadableName(c.name_ar)) return false
    const count = currentStockData.filter(p => p.category_id === c.id).length
    return count > 0
  })

  // Stats calculées sur le scope courant (dépôt sélectionné ou global).
  // إجمالي = nombre total de produits dans ce scope (= جيد + منخفض + نفد).
  const totalStock = currentStockData.length
  const lowStockCount = currentStockData.filter(p => {
    const s = getStockForProduct(p)
    return s > 0 && s < 10
  }).length
  const outOfStockCount = currentStockData.filter(p => getStockForProduct(p) === 0).length
  const goodStockCount = currentStockData.filter(p => getStockForProduct(p) >= 10).length
  const totalValue = currentStockData.reduce((sum, p) => {
    const s = getStockForProduct(p)
    const costPrice = p.cost_price || p.price_a * 0.7
    return sum + s * costPrice
  }, 0)

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { text: 'نفد المخزون', color: 'text-red-700 bg-red-100' }
    if (stock < 10) return { text: 'منخفض', color: 'text-orange-700 bg-orange-100' }
    if (stock < 50) return { text: 'متوسط', color: 'text-yellow-700 bg-yellow-100' }
    return { text: 'جيد', color: 'text-green-700 bg-green-100' }
  }

  // ============================ AJUSTEMENT DE STOCK =====================
  // Applique un delta (signé) au stock d'un produit pour le dépôt courant en
  // gardant cohérentes les 4 tables (cf. invariant stock):
  //   warehouse_stock.quantity (dépôt), stock.quantity_in_stock (caisse),
  //   products.stock (legacy), product_variants.stock (par unité).
  // Le delta est en UNITÉS DE BASE (= la valeur affichée dans cette page).
  // On NE touche JAMAIS cost_price (un ajustement manuel n'a pas de prix d'achat).
  const adjustProductStock = async (productId: string, warehouseId: string, delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) return

    // 1) warehouse_stock — source de vérité par dépôt (lue par cette page)
    try {
      const { data: existingWS } = await supabase
        .from('warehouse_stock')
        .select('id, quantity')
        .eq('warehouse_id', warehouseId)
        .eq('product_id', productId)
        .maybeSingle()
      if (existingWS?.id) {
        const nextQty = Math.max(0, (Number((existingWS as any).quantity) || 0) + delta)
        await supabase
          .from('warehouse_stock')
          .update({ quantity: nextQty, updated_at: new Date().toISOString() })
          .eq('id', (existingWS as any).id)
      } else if (delta > 0) {
        await supabase.from('warehouse_stock').insert({
          warehouse_id: warehouseId,
          product_id: productId,
          quantity: Math.max(0, delta),
          min_alert_level: 0,
        })
      }
    } catch (e) {
      console.warn('warehouse_stock adjust skipped:', e)
    }

    // 2) stock.quantity_in_stock — source lue par la caisse (résolution: NULL -> première)
    try {
      const { data: stockRows } = await supabase
        .from('stock')
        .select('id, quantity_in_stock, primary_variant_id')
        .eq('product_id', productId)
      if (Array.isArray(stockRows) && stockRows.length > 0) {
        const stockRow = stockRows.find((r: any) => r.primary_variant_id === null) || stockRows[0]
        if (stockRow?.id) {
          await supabase
            .from('stock')
            .update({ quantity_in_stock: Math.max(0, (Number(stockRow.quantity_in_stock) || 0) + delta) })
            .eq('id', stockRow.id)
        }
      } else if (delta > 0) {
        let ins = await supabase
          .from('stock')
          .insert({ product_id: productId, quantity_in_stock: Math.max(0, delta), quantity_reserved: 0 })
        if (ins.error) await supabase.from('stock').insert({ product_id: productId, quantity_in_stock: Math.max(0, delta) })
      }
    } catch (e) {
      console.warn('stock.quantity_in_stock adjust skipped:', e)
    }

    // 3) products.stock — colonne legacy / fallback (cost_price inchangé)
    try {
      const { data: prod } = await supabase.from('products').select('stock').eq('id', productId).single()
      if (prod) {
        await supabase
          .from('products')
          .update({ stock: Math.max(0, (Number(prod.stock) || 0) + delta) })
          .eq('id', productId)
      }
    } catch (e) {
      console.warn('products.stock adjust skipped:', e)
    }

    // 4) product_variants.stock — base (unit/kilo) en unités de base ;
    //    carton dérivé = delta / unités-par-carton (miroir du décrément caisse).
    try {
      const { data: variants } = await supabase
        .from('product_variants')
        .select('id, unit_type, quantity_contained, stock')
        .eq('product_id', productId)
      const list = variants || []
      const unitV = list.find((v: any) => v.unit_type === 'unit')
      const kiloV = list.find((v: any) => v.unit_type === 'kilo')
      const cartonV = list.find((v: any) => v.unit_type === 'carton')
      const upc = cartonV?.quantity_contained ? Number(cartonV.quantity_contained) : 0
      if (unitV?.id) {
        await supabase.from('product_variants').update({ stock: Math.max(0, (Number(unitV.stock) || 0) + delta) }).eq('id', unitV.id)
      }
      if (kiloV?.id) {
        await supabase.from('product_variants').update({ stock: Math.max(0, (Number(kiloV.stock) || 0) + delta) }).eq('id', kiloV.id)
      }
      if (cartonV?.id && upc > 0) {
        await supabase.from('product_variants').update({ stock: Math.max(0, (Number(cartonV.stock) || 0) + delta / upc) }).eq('id', cartonV.id)
      }
    } catch (e) {
      console.warn('product_variants.stock adjust skipped:', e)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allVisibleSelected = pagedStockData.length > 0 && pagedStockData.every((p) => selectedIds.has(p.id))
  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pagedStockData.map((p) => p.id)))
    }
  }

  const openAdjust = (targets: Product[], mode: 'add' | 'sub' | 'set' = 'add') => {
    if (!selectedWarehouse) {
      alert('يرجى اختيار مخزن أولاً')
      return
    }
    if (targets.length === 0) return
    setAdjustTargets(targets)
    setAdjustMode(mode)
    setAdjustQty('')
    setAdjustOpen(true)
  }

  const closeAdjust = () => {
    if (adjustSaving) return
    setAdjustOpen(false)
    setAdjustTargets([])
    setAdjustQty('')
  }

  const confirmAdjust = async () => {
    if (!selectedWarehouse) return
    const qty = Number(adjustQty)
    if (!Number.isFinite(qty) || qty < 0) {
      alert('يرجى إدخال كمية صحيحة')
      return
    }
    setAdjustSaving(true)
    try {
      for (const target of adjustTargets) {
        const current = getStockForProduct(target)
        let delta = 0
        if (adjustMode === 'add') delta = qty
        else if (adjustMode === 'sub') delta = -Math.min(qty, current) // ne pas descendre sous 0
        else delta = qty - current // set absolu
        await adjustProductStock(target.id, selectedWarehouse, delta)
      }
      // Recharger les données du dépôt + produits (cost/stock legacy)
      await loadWarehouseStock(selectedWarehouse)
      await loadProducts()
      setSelectedIds(new Set())
      setAdjustOpen(false)
      setAdjustTargets([])
      setAdjustQty('')
    } catch (e) {
      console.error('Error adjusting stock:', e)
      alert('❌ حدث خطأ أثناء تعديل المخزون')
    } finally {
      setAdjustSaving(false)
    }
  }

  // Ajustement rapide +/- 1 sur une ligne (sans ouvrir le modal)
  const quickAdjust = async (product: Product, delta: number) => {
    if (!selectedWarehouse) {
      alert('يرجى اختيار مخزن أولاً')
      return
    }
    const current = getStockForProduct(product)
    if (delta < 0 && current <= 0) return
    await adjustProductStock(product.id, selectedWarehouse, delta)
    await loadWarehouseStock(selectedWarehouse)
    await loadProducts()
  }

  // =================== RÉAPPRO « COMME UN ACHAT » ====================
  // Ouvre la même fenêtre que la page Achats pour un produit donné.
  const openBuy = (product: Product) => {
    if (!selectedWarehouse) {
      alert('يرجى اختيار مخزن أولاً')
      return
    }
    setBuyTarget(product)
    setBuyForm({
      quantity: 1,
      unit_price: product.cost_price || product.price_a || 0,
      unit_type: 'kilo',
      units_per_carton: 1,
      weight_per_unit: 1,
      packaging_mode: 'none',
    })
    setBuyOpen(true)
  }

  const closeBuy = () => {
    if (buySaving) return
    setBuyOpen(false)
    setBuyTarget(null)
  }

  // Met à jour le prix d'achat de référence (purchase_price) sur toutes les
  // variantes du produit, exprimé par unité de base, afin que la page Produits
  // et la caisse affichent le nouveau prix. baseUnitCost = coût d'une unité de base.
  const updateVariantPurchasePrices = async (productId: string, baseUnitCost: number) => {
    try {
      const { data: variants } = await supabase
        .from('product_variants')
        .select('id, unit_type, quantity_contained')
        .eq('product_id', productId)
      for (const v of variants || []) {
        let price = baseUnitCost
        if (v.unit_type === 'carton' || v.unit_type === 'paquet' || v.unit_type === 'sac') {
          const factor = Number(v.quantity_contained) || 1
          price = baseUnitCost * factor
        }
        await supabase.from('product_variants').update({ purchase_price: price }).eq('id', v.id)
      }
    } catch (e) {
      console.warn('variant purchase_price update skipped:', e)
    }
  }

  // Validation identique à PurchasesPage.saveEdit (champs requis selon l'unité)
  const validateBuyForm = (): boolean => {
    if (!buyForm.quantity || buyForm.quantity <= 0) {
      alert('يرجى إدخال كمية صحيحة')
      return false
    }
    if (buyForm.unit_type === 'carton') {
      if (!buyForm.units_per_carton || buyForm.units_per_carton <= 0) {
        alert('يرجى إدخال عدد الوحدات في الكرتون')
        return false
      }
      if (!buyForm.weight_per_unit || buyForm.weight_per_unit <= 0) {
        alert('يرجى إدخال وزن/كمية كل وحدة داخل الكرتون')
        return false
      }
    }
    if ((buyForm.unit_type === 'kilo' || buyForm.unit_type === 'litre') && buyForm.packaging_mode === 'carton') {
      if (!buyForm.units_per_carton || buyForm.units_per_carton <= 0) {
        alert('يرجى إدخال عدد الوحدات في الكرتون')
        return false
      }
      if (!buyForm.weight_per_unit || buyForm.weight_per_unit <= 0) {
        alert('يرجى إدخال وزن/كمية كل وحدة داخل الكرتون')
        return false
      }
    }
    if ((buyForm.unit_type === 'paquet' || buyForm.unit_type === 'sac' || buyForm.packaging_mode === 'sachet') && (!buyForm.weight_per_unit || buyForm.weight_per_unit <= 0)) {
      alert('يرجى إدخال الوزن/الكمية لكل كيس/ساشي')
      return false
    }
    return true
  }

  const confirmBuy = async () => {
    if (!selectedWarehouse || !buyTarget) return
    if (!validateBuyForm()) return

    const baseQty = calculateBaseQuantity(buyForm)
    if (baseQty <= 0) {
      alert('الكمية الأساسية المضافة يجب أن تكون أكبر من صفر')
      return
    }

    setBuySaving(true)
    try {
      // 1) Coût moyen pondéré (par unité de base) AVANT d'ajouter le stock.
      const { data: prod } = await supabase
        .from('products')
        .select('stock, cost_price')
        .eq('id', buyTarget.id)
        .single()
      const oldStock = Number(prod?.stock) || 0
      const oldCost = Number(prod?.cost_price) || 0
      const totalSpend = buyForm.quantity * buyForm.unit_price
      const baseUnitCost = baseQty > 0 ? totalSpend / baseQty : buyForm.unit_price
      const newStock = oldStock + baseQty
      const newCost = newStock > 0 ? (oldStock * oldCost + totalSpend) / newStock : oldCost

      // 2) Ajouter la quantité de base aux 4 tables de stock (invariant stock).
      await adjustProductStock(buyTarget.id, selectedWarehouse, baseQty)

      // 3) Mettre à jour le prix d'achat de référence sur le produit
      //    (adjustProductStock a déjà incrémenté products.stock).
      await supabase.from('products').update({ cost_price: newCost }).eq('id', buyTarget.id)

      // 4) Propager le prix d'achat de référence aux variantes (page Produits + caisse).
      await updateVariantPurchasePrices(buyTarget.id, baseUnitCost)

      await loadWarehouseStock(selectedWarehouse)
      await loadProducts()
      setBuyOpen(false)
      setBuyTarget(null)
    } catch (e) {
      console.error('Error restocking product:', e)
      alert('❌ حدث خطأ أثناء تحديث المخزون')
    } finally {
      setBuySaving(false)
    }
  }

  const selectedProducts = filteredStockData.filter((p) => selectedIds.has(p.id))

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Package className="text-white" size={36} />
          المخزون
        </h1>
      </div>

      {/* Sélecteur de dépôt + statistiques compactes (cliquables) */}
      <div className="bg-white rounded-xl shadow-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Building className="text-gray-600 shrink-0" size={16} />
          <label className="text-gray-700 text-sm font-medium shrink-0">اختر المخزن:</label>
          <select
            value={selectedWarehouse || ''}
            onChange={(e) => setSelectedWarehouse(e.target.value || null)}
            className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded-md focus:border-teal-500 focus:outline-none"
          >
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`flex items-center justify-between gap-2 text-right bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-md px-2 py-1.5 shadow transition ${
              filterStatus === 'all' ? 'ring-2 ring-teal-300' : ''
            }`}
          >
            <Package size={16} className="text-teal-200 shrink-0" />
            <div className="leading-tight">
              <p className="text-[10px] text-teal-100">إجمالي</p>
              <p className="text-sm font-bold">{totalStock}</p>
            </div>
          </button>

          <button
            onClick={() => setFilterStatus(filterStatus === 'good' ? 'all' : 'good')}
            className={`flex items-center justify-between gap-2 text-right bg-gradient-to-br from-green-500 to-green-600 text-white rounded-md px-2 py-1.5 shadow transition ${
              filterStatus === 'good' ? 'ring-2 ring-green-300' : ''
            }`}
          >
            <CheckCircle size={16} className="text-green-200 shrink-0" />
            <div className="leading-tight">
              <p className="text-[10px] text-green-100">المخزون جيد</p>
              <p className="text-sm font-bold">{goodStockCount}</p>
            </div>
          </button>

          <button
            onClick={() => setFilterStatus(filterStatus === 'low' ? 'all' : 'low')}
            className={`flex items-center justify-between gap-2 text-right bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-md px-2 py-1.5 shadow transition ${
              filterStatus === 'low' ? 'ring-2 ring-orange-300' : ''
            }`}
          >
            <AlertTriangle size={16} className="text-orange-200 shrink-0" />
            <div className="leading-tight">
              <p className="text-[10px] text-orange-100">منخفض</p>
              <p className="text-sm font-bold">{lowStockCount}</p>
            </div>
          </button>

          <button
            onClick={() => setFilterStatus(filterStatus === 'out' ? 'all' : 'out')}
            className={`flex items-center justify-between gap-2 text-right bg-gradient-to-br from-red-500 to-red-600 text-white rounded-md px-2 py-1.5 shadow transition ${
              filterStatus === 'out' ? 'ring-2 ring-red-300' : ''
            }`}
          >
            <TrendingDown size={16} className="text-red-200 shrink-0" />
            <div className="leading-tight">
              <p className="text-[10px] text-red-100">نفد المخزون</p>
              <p className="text-sm font-bold">{outOfStockCount}</p>
            </div>
          </button>

          <div className="flex items-center justify-between gap-2 text-right bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-md px-2 py-1.5 shadow">
            <TrendingUp size={16} className="text-purple-200 shrink-0" />
            <div className="leading-tight">
              <p className="text-[10px] text-purple-100">قيمة المخزون</p>
              <p className="text-sm font-bold">{totalValue.toFixed(2)} MAD</p>
            </div>
          </div>
        </div>
      </div>

      {/* Familles + recherche + filtres - une seule ligne */}
      <div className="bg-white rounded-xl shadow-lg p-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
          <label className="md:col-span-1 text-sm font-bold text-gray-800">العائلات</label>
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="md:col-span-4 px-2 py-2 text-sm border border-gray-200 rounded-md focus:border-teal-500 focus:outline-none"
          >
            <option value="">جميع المنتجات ({currentStockData.length})</option>
            {visibleCategories.map((category) => {
              const productCount = currentStockData.filter(p => p.category_id === category.id).length
              return (
                <option key={category.id} value={category.id}>
                  {category.name_ar} ({productCount})
                </option>
              )
            })}
          </select>
          <div className="md:col-span-4 relative">
            <Search className="absolute right-2 top-2.5 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="ابحث عن منتج..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-8 pl-2 py-2 text-sm border border-gray-200 rounded-md focus:border-teal-500 focus:outline-none"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="md:col-span-2 px-2 py-2 text-sm border border-gray-200 rounded-md focus:border-teal-500 focus:outline-none"
          >
            <option value="all">جميع الحالات</option>
            <option value="good">المخزون جيد</option>
            <option value="low">مخزون منخفض</option>
            <option value="out">نفد المخزون</option>
          </select>
          <button
            onClick={() => {
              setSearchTerm('')
              setFilterStatus('all')
              setSelectedCategory(null)
            }}
            className="md:col-span-1 px-2 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50"
          >
            مسح
          </button>
        </div>
      </div>

      {/* Barre d'ajustement du stock (sélection + actions groupées) */}
      <div className="bg-white rounded-xl shadow-lg p-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={showAllProducts}
            onChange={(e) => setShowAllProducts(e.target.checked)}
            className="w-4 h-4 accent-teal-600"
            disabled={!selectedWarehouse}
          />
          عرض كل المنتجات (لإضافة مخزون مبدئي)
        </label>

        <div className="flex-1" />

        {selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-teal-700">{selectedIds.size} محدد</span>
            <button
              onClick={() => openAdjust(selectedProducts, 'add')}
              className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-3 py-1.5 rounded-lg"
            >
              <Plus size={16} /> إضافة كمية
            </button>
            <button
              onClick={() => openAdjust(selectedProducts, 'sub')}
              className="flex items-center gap-1 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold px-3 py-1.5 rounded-lg"
            >
              <Minus size={16} /> إنقاص كمية
            </button>
            <button
              onClick={() => openAdjust(selectedProducts, 'set')}
              className="flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold px-3 py-1.5 rounded-lg"
            >
              <Pencil size={16} /> تعيين الكمية
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="flex items-center gap-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold px-3 py-1.5 rounded-lg"
            >
              <X size={16} /> إلغاء التحديد
            </button>
          </div>
        ) : (
          <span className="text-xs text-gray-500">حدّد منتجات لإضافة أو إنقاص أو تعيين الكمية</span>
        )}
      </div>

      {/* Tableau des produits */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            جاري التحميل...
          </div>
        ) : filteredStockData.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            لا توجد منتجات
          </div>
        ) : (
          <div>
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col className="w-[4%]" />
                <col className="w-[31%]" />
                <col className="w-[13%]" />
                <col className="w-[9%]" />
                <col className="w-[11%]" />
                <col className="w-[10%]" />
                <col className="w-[22%]" />
              </colgroup>
              <thead className="bg-gradient-to-r from-teal-600 to-teal-700 text-white">
                <tr>
                  <th className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 accent-white"
                      title="تحديد الكل"
                    />
                  </th>
                  <th className="px-2 py-1.5 text-right font-bold">اسم المنتج</th>
                  <th className="px-2 py-1.5 text-right font-bold">SKU</th>
                  <th className="px-2 py-1.5 text-right font-bold">المخزون</th>
                  <th className="px-2 py-1.5 text-right font-bold">الحالة</th>
                  <th className="px-2 py-1.5 text-right font-bold">القيمة</th>
                  <th className="px-2 py-1.5 text-center font-bold">تعديل</th>
                </tr>
              </thead>
              <tbody>
                {pagedStockData.map((product: Product) => {
                  const stock = getStockForProduct(product)
                  const stockStatus = getStockStatus(stock)
                  const value = stock * (product.cost_price || product.price_a * 0.7)
                  const isSelected = selectedIds.has(product.id)

                  return (
                    <tr
                      key={product.id}
                      className={`border-b transition-colors ${isSelected ? 'bg-teal-50' : 'hover:bg-teal-50'}`}
                    >
                      <td className="px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(product.id)}
                          className="w-4 h-4 accent-teal-600"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <div className="font-semibold text-gray-800 truncate" title={product.name_ar}>{product.name_ar}</div>
                        {product.name_en && (
                          <div className="text-[10px] text-gray-500 truncate" title={product.name_en}>{product.name_en}</div>
                        )}
                      </td>
                      <td className="px-2 py-1 text-gray-600 truncate" title={product.sku}>{product.sku}</td>
                      <td className="px-2 py-1">
                        <span className={`font-bold ${
                          stock === 0 ? 'text-red-600' :
                          stock < 10 ? 'text-orange-600' : 'text-green-600'
                        }`}>
                          {stock}
                        </span>
                      </td>
                      <td className="px-2 py-1">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${stockStatus.color}`}>
                          {stockStatus.text}
                        </span>
                      </td>
                      <td className="px-2 py-1 font-bold text-gray-800 whitespace-nowrap">
                        {value.toFixed(2)} MAD
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => quickAdjust(product, -1)}
                            disabled={!selectedWarehouse || stock <= 0}
                            className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold flex items-center justify-center disabled:opacity-40"
                            title="إنقاص 1"
                          >
                            <Minus size={14} />
                          </button>
                          <button
                            onClick={() => quickAdjust(product, 1)}
                            disabled={!selectedWarehouse}
                            className="w-6 h-6 rounded bg-green-600 hover:bg-green-700 text-white font-bold flex items-center justify-center disabled:opacity-40"
                            title="إضافة 1"
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            onClick={() => openAdjust([product], 'set')}
                            disabled={!selectedWarehouse}
                            className="w-6 h-6 rounded bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center disabled:opacity-40"
                            title="تعيين الكمية"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => openBuy(product)}
                            disabled={!selectedWarehouse}
                            className="w-6 h-6 rounded bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center disabled:opacity-40"
                            title="تعديل المخزون (شراء: كمية + وحدة + سعر الشراء)"
                          >
                            <ShoppingCart size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination (50 par page) */}
            {filteredStockData.length > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-100 text-xs">
                <span className="text-gray-600">
                  عرض {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredStockData.length)} من {filteredStockData.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={currentPage <= 1}
                    className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                  >
                    الأولى
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                  >
                    السابق
                  </button>
                  <span className="px-2 py-1 font-bold text-teal-700 whitespace-nowrap">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                  >
                    التالي
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={currentPage >= totalPages}
                    className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                  >
                    الأخيرة
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal d'ajustement du stock */}
      {adjustOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3"
          dir="rtl"
          onClick={closeAdjust}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800">
                {adjustMode === 'add' ? 'إضافة كمية للمخزون' : adjustMode === 'sub' ? 'إنقاص كمية من المخزون' : 'تعيين كمية المخزون'}
              </h3>
              <button onClick={closeAdjust} className="text-gray-500 hover:text-gray-700" disabled={adjustSaving}>
                <X size={20} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Type d'opération */}
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: 'add', label: 'إضافة' },
                  { v: 'sub', label: 'إنقاص' },
                  { v: 'set', label: 'تعيين' },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setAdjustMode(opt.v)}
                    className={`py-2 rounded-lg text-sm font-bold border transition-colors ${
                      adjustMode === opt.v ? 'bg-teal-600 text-white border-teal-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-teal-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  {adjustMode === 'set' ? 'الكمية الجديدة' : 'الكمية'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  autoFocus
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-teal-500 focus:outline-none text-lg"
                  placeholder="0"
                />
              </div>

              {/* Liste des produits concernés */}
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {adjustTargets.map((t) => {
                  const current = getStockForProduct(t)
                  const qty = Number(adjustQty) || 0
                  const next = adjustMode === 'add'
                    ? current + qty
                    : adjustMode === 'sub'
                      ? Math.max(0, current - qty)
                      : qty
                  return (
                    <div key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="font-medium text-gray-800 truncate flex-1" title={t.name_ar}>{t.name_ar}</span>
                      <span className="text-gray-500 whitespace-nowrap mr-2">{current}</span>
                      <span className="text-teal-700 font-bold whitespace-nowrap">→ {next}</span>
                    </div>
                  )
                })}
              </div>

              <p className="text-xs text-gray-500">
                سيتم تطبيق التغيير على المخزن المحدد فقط. سعر الشراء لا يتغيّر.
              </p>
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button
                onClick={confirmAdjust}
                disabled={adjustSaving}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2.5 rounded-lg font-bold disabled:opacity-50"
              >
                {adjustSaving ? 'جاري الحفظ...' : 'تأكيد'}
              </button>
              <button
                onClick={closeAdjust}
                disabled={adjustSaving}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-lg font-bold disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de réapprovisionnement « comme un achat » (même fenêtre que la page Achats) */}
      {buyOpen && buyTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3" dir="rtl" onClick={closeBuy}>
          <div className="bg-white rounded-2xl p-4 sm:p-5 w-full max-w-[420px] max-h-[92vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-3">تعديل المخزون (شراء)</h3>

            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">المنتج:</p>
              <p className="font-bold text-gray-800 text-sm">{buyTarget.name_ar}</p>
              <p className="text-[11px] text-gray-500">SKU: {buyTarget.sku} · المخزون الحالي: {getStockForProduct(buyTarget)}</p>
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
                        initialValue: buyForm.quantity.toString(),
                        min: 1,
                        onConfirm: (v) => setBuyForm({ ...buyForm, quantity: parseInt(v) || 1 }),
                      })
                    }
                    className="w-full p-2 border rounded-lg text-left"
                  >
                    {buyForm.quantity}
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
                        initialValue: buyForm.unit_price.toString(),
                        min: 0,
                        onConfirm: (v) => setBuyForm({ ...buyForm, unit_price: parseFloat(v) || 0 }),
                      })
                    }
                    className="w-full p-2 border rounded-lg text-left"
                  >
                    {buyForm.unit_price}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">وحدة الشراء</label>
                <select
                  value={buyForm.unit_type}
                  onChange={(e) => {
                    const newUnit = e.target.value as UnitType
                    setBuyForm(prev => ({
                      ...prev,
                      unit_type: newUnit,
                      packaging_mode: (newUnit === 'kilo' || newUnit === 'litre') ? prev.packaging_mode : 'none'
                    }))
                  }}
                  className="w-full p-2 border rounded-lg bg-white"
                >
                  <option value="kilo">كيلو</option>
                  <option value="litre">لتر</option>
                  <option value="carton">كرتون</option>
                  <option value="paquet">باكيت</option>
                  <option value="sac">كيس</option>
                  <option value="unit">وحدة</option>
                </select>
              </div>

              {(buyForm.unit_type === 'kilo' || buyForm.unit_type === 'litre') && (
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
                        onClick={() => setBuyForm(prev => ({ ...prev, packaging_mode: option.key as any }))}
                        className={`p-2 border rounded-lg ${buyForm.packaging_mode === option.key ? 'bg-purple-100 border-purple-400' : 'bg-white'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {buyForm.packaging_mode === 'carton' && (
                    <div className="mt-3">
                      <label className="block text-xs font-bold text-gray-700 mb-1">عدد الوحدات في الكرتون</label>
                      <button
                        type="button"
                        onClick={() =>
                          inputPad.open({
                            title: 'عدد الوحدات في الكرتون',
                            mode: 'number',
                            dir: 'ltr',
                            initialValue: (buyForm.units_per_carton || 0).toString(),
                            min: 1,
                            onConfirm: (v) => setBuyForm({ ...buyForm, units_per_carton: parseInt(v) || 1 }),
                          })
                        }
                        className="w-full p-2 border rounded-lg text-left"
                      >
                        {buyForm.units_per_carton || 1}
                      </button>
                      <label className="block text-xs font-bold text-gray-700 mb-1 mt-3">وزن/كمية كل وحدة داخل الكرتون</label>
                      <button
                        type="button"
                        onClick={() =>
                          inputPad.open({
                            title: 'وزن/كمية كل وحدة داخل الكرتون',
                            mode: 'decimal',
                            dir: 'ltr',
                            initialValue: (buyForm.weight_per_unit || 0).toString(),
                            min: 0.001,
                            onConfirm: (v) => setBuyForm({ ...buyForm, weight_per_unit: parseFloat(v) || 1 }),
                          })
                        }
                        className="w-full p-2 border rounded-lg text-left"
                      >
                        {buyForm.weight_per_unit || 1}
                      </button>
                    </div>
                  )}

                  {buyForm.packaging_mode === 'sachet' && (
                    <div className="mt-3">
                      <label className="block text-xs font-bold text-gray-700 mb-1">عدد/وزن كل كيس</label>
                      <button
                        type="button"
                        onClick={() =>
                          inputPad.open({
                            title: 'عدد/وزن كل كيس',
                            mode: 'decimal',
                            dir: 'ltr',
                            initialValue: (buyForm.weight_per_unit || 0).toString(),
                            min: 0.001,
                            onConfirm: (v) => setBuyForm({ ...buyForm, weight_per_unit: parseFloat(v) || 1 }),
                          })
                        }
                        className="w-full p-2 border rounded-lg text-left"
                      >
                        {buyForm.weight_per_unit || 1}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {buyForm.unit_type === 'carton' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">عدد الوحدات في الكرتون</label>
                  <button
                    type="button"
                    onClick={() =>
                      inputPad.open({
                        title: 'عدد الوحدات في الكرتون',
                        mode: 'number',
                        dir: 'ltr',
                        initialValue: (buyForm.units_per_carton || 0).toString(),
                        min: 1,
                        onConfirm: (v) => setBuyForm({ ...buyForm, units_per_carton: parseInt(v) || 1 }),
                      })
                    }
                    className="w-full p-2 border rounded-lg text-left"
                  >
                    {buyForm.units_per_carton || 1}
                  </button>
                  <label className="block text-xs font-bold text-gray-700 mb-1 mt-3">الوزن/الكمية لكل وحدة</label>
                  <button
                    type="button"
                    onClick={() =>
                      inputPad.open({
                        title: 'الوزن/الكمية لكل وحدة داخل الكرتون',
                        mode: 'decimal',
                        dir: 'ltr',
                        initialValue: (buyForm.weight_per_unit || 0).toString(),
                        min: 0.001,
                        onConfirm: (v) => setBuyForm({ ...buyForm, weight_per_unit: parseFloat(v) || 1 }),
                      })
                    }
                    className="w-full p-2 border rounded-lg text-left"
                  >
                    {buyForm.weight_per_unit || 1}
                  </button>
                </div>
              )}
              {(buyForm.unit_type === 'paquet' || buyForm.unit_type === 'sac') && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">الوزن/الكمية لكل باكيت/كيس</label>
                  <button
                    type="button"
                    onClick={() =>
                      inputPad.open({
                        title: 'الوزن/الكمية لكل باكيت/كيس',
                        mode: 'decimal',
                        dir: 'ltr',
                        initialValue: (buyForm.weight_per_unit || 0).toString(),
                        min: 0.001,
                        onConfirm: (v) => setBuyForm({ ...buyForm, weight_per_unit: parseFloat(v) || 1 }),
                      })
                    }
                    className="w-full p-2 border rounded-lg text-left"
                  >
                    {buyForm.weight_per_unit || 1}
                  </button>
                </div>
              )}

              {/* Résumé prix + quantité de base + nouveau stock */}
              {(() => {
                const baseQty = calculateBaseQuantity(buyForm)
                const total = buyForm.quantity * buyForm.unit_price
                const baseUnitCost = baseQty > 0 ? total / baseQty : 0
                const current = getStockForProduct(buyTarget)
                return (
                  <div className="mt-4 p-3 bg-gray-50 border rounded-lg space-y-2 text-sm">
                    <p className="font-bold text-gray-800">ملخص السعر والكمية</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex justify-between"><span className="text-gray-600">المجموع:</span><span className="font-bold">{total.toFixed(2)} MAD</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">الكمية الأساسية المضافة:</span><span className="font-bold">{baseQty.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">التكلفة لكل وحدة أساسية:</span><span className="font-bold">{baseUnitCost.toFixed(2)} MAD</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">المخزون بعد التعديل:</span><span className="font-bold text-teal-700">{current} → {(current + baseQty).toFixed(2)}</span></div>
                    </div>
                    <p className="text-[11px] text-gray-500">سيتم اعتماد سعر الشراء هذا كمرجع في صفحة المنتجات والكاسة.</p>
                  </div>
                )
              })()}
            </div>

            <div className="flex gap-2 mt-5 text-sm">
              <button
                onClick={closeBuy}
                disabled={buySaving}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-bold disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={confirmBuy}
                disabled={buySaving}
                className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 font-bold disabled:opacity-50"
              >
                {buySaving ? 'جاري الحفظ...' : 'حفظ التعديل'}
              </button>
            </div>
          </div>
        </div>
      )}

      {inputPad.Modal}
    </div>
  )
}
