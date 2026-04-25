import { useEffect, useState } from 'react'
import { Search, Package, TrendingUp, TrendingDown, AlertTriangle, Building, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

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
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehouseStock, setWarehouseStock] = useState<WarehouseStock[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'out' | 'good'>('all')

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

  const loadProducts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ar, name_en, sku, stock, price_a, cost_price, image_url, category_id')
        .eq('is_active', true)
        .order('name_ar')

      if (error) throw error
      
      setProducts(data || [])
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
      const { data, error } = await supabase
        .from('warehouse_stock')
        .select('id, warehouse_id, product_id, quantity')
        .eq('warehouse_id', warehouseId)

      if (error) throw error

      const aggregated: WarehouseStock[] = (data || []).map((row: any) => ({
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
  // dans `stock` pour ce dépôt (= produits effectivement présents dans ce dépôt).
  const currentStockData = selectedWarehouse
    ? products.filter(p => warehouseStockByProduct[p.id] !== undefined)
    : products
  const filteredStockData = currentStockData.filter(product =>
    product.name_ar?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(product => {
    if (selectedCategory && product.category_id !== selectedCategory) return false

    const stock = getStockForProduct(product)

    if (filterStatus === 'low') return stock > 0 && stock < 10
    if (filterStatus === 'out') return stock === 0
    if (filterStatus === 'good') return stock >= 10
    return true
  })

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
                <col className="w-[46%]" />
                <col className="w-[18%]" />
                <col className="w-[10%]" />
                <col className="w-[14%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="bg-gradient-to-r from-teal-600 to-teal-700 text-white">
                <tr>
                  <th className="px-2 py-1.5 text-right font-bold">اسم المنتج</th>
                  <th className="px-2 py-1.5 text-right font-bold">SKU</th>
                  <th className="px-2 py-1.5 text-right font-bold">المخزون</th>
                  <th className="px-2 py-1.5 text-right font-bold">الحالة</th>
                  <th className="px-2 py-1.5 text-right font-bold">القيمة</th>
                </tr>
              </thead>
              <tbody>
                {filteredStockData.map((product: Product) => {
                  const stock = getStockForProduct(product)
                  const stockStatus = getStockStatus(stock)
                  const value = stock * (product.cost_price || product.price_a * 0.7)
                  
                  return (
                    <tr
                      key={product.id}
                      className="border-b hover:bg-teal-50 transition-colors"
                    >
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
