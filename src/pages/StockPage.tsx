import { useEffect, useState } from 'react'
import { Search, Package, TrendingUp, TrendingDown, AlertTriangle, Building } from 'lucide-react'
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
  product: Product
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
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'out'>('all')

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
        .eq('is_active', true)
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
      const { data, error } = await supabase
        .from('warehouse_stock')
        .select(`
          *,
          product:products(id, name_ar, name_en, sku, price_a, cost_price, image_url, category_id)
        `)
        .eq('warehouse_id', warehouseId)
        .order('product(name_ar)')

      if (error) throw error
      
      setWarehouseStock(data || [])
    } catch (error) {
      console.error('Error loading warehouse stock:', error)
    } finally {
      setLoading(false)
    }
  }

  // Utiliser le stock du dépôt sélectionné ou le stock des produits par défaut
  const currentStockData = selectedWarehouse ? warehouseStock.map(ws => ws.product) : products
  const filteredStockData = currentStockData.filter(product =>
    product.name_ar?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(product => {
    if (selectedCategory && product.category_id !== selectedCategory) return false
    
    const stock = selectedWarehouse 
      ? warehouseStock.find(ws => ws.product_id === product.id)?.quantity || 0
      : product.stock
      
    if (filterStatus === 'low') return stock > 0 && stock < 10
    if (filterStatus === 'out') return stock === 0
    return true
  })

  const totalStock = selectedWarehouse
    ? warehouseStock.reduce((sum, ws) => sum + ws.quantity, 0)
    : products.reduce((sum, p) => sum + p.stock, 0)
    
  const lowStockCount = selectedWarehouse
    ? warehouseStock.filter(ws => ws.quantity > 0 && ws.quantity < 10).length
    : products.filter(p => p.stock > 0 && p.stock < 10).length
    
  const outOfStockCount = selectedWarehouse
    ? warehouseStock.filter(ws => ws.quantity === 0).length
    : products.filter(p => p.stock === 0).length
    
  const totalValue = selectedWarehouse
    ? warehouseStock.reduce((sum, ws) => {
        const costPrice = ws.product.cost_price || ws.product.price_a * 0.7
        return sum + (ws.quantity * costPrice)
      }, 0)
    : products.reduce((sum, p) => sum + (p.stock * (p.cost_price || p.price_a * 0.7)), 0)

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

      {/* Sélecteur de dépôt */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-4">
          <Building className="text-gray-600" size={20} />
          <label className="text-gray-700 font-medium">اختر المخزن:</label>
          <select
            value={selectedWarehouse || ''}
            onChange={(e) => setSelectedWarehouse(e.target.value || null)}
            className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-teal-500 focus:outline-none"
          >
            <option value="">المخزون العام (products.stock)</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-teal-100 text-sm mb-1">إجمالي المخزون</p>
              <p className="text-2xl font-bold">{totalStock}</p>
            </div>
            <Package size={32} className="text-teal-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm mb-1">منخفض</p>
              <p className="text-2xl font-bold">{lowStockCount}</p>
            </div>
            <AlertTriangle size={32} className="text-orange-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm mb-1">نفد المخزون</p>
              <p className="text-2xl font-bold">{outOfStockCount}</p>
            </div>
            <TrendingDown size={32} className="text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm mb-1">قيمة المخزون</p>
              <p className="text-2xl font-bold">{totalValue.toFixed(2)} MAD</p>
            </div>
            <TrendingUp size={32} className="text-purple-200" />
          </div>
        </div>
      </div>

      {/* العائلات (Catégories) */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">العائلات</h3>
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              إلغاء التصفية
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              !selectedCategory
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            جميع المنتجات ({currentStockData.length})
          </button>
          {categories.map((category) => {
            const productCount = currentStockData.filter(p => p.category_id === category.id).length
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.name_ar} ({productCount})
              </button>
            )
          })}
        </div>
      </div>

      {/* Recherche et filtres */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute right-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="ابحث عن منتج..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-500 focus:outline-none"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-teal-500 focus:outline-none"
          >
            <option value="all">جميع الحالات</option>
            <option value="low">مخزون منخفض</option>
            <option value="out">نفد المخزون</option>
          </select>
          <button
            onClick={() => {
              setSearchTerm('')
              setFilterStatus('all')
            }}
            className="px-4 py-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50"
          >
            مسح الفلاتر
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-teal-600 to-teal-700 text-white">
                <tr>
                  <th className="px-6 py-4 text-right font-bold">اسم المنتج</th>
                  <th className="px-6 py-4 text-right font-bold">SKU</th>
                  <th className="px-6 py-4 text-right font-bold">المخزون</th>
                  <th className="px-6 py-4 text-right font-bold">حالة المخزون</th>
                  <th className="px-6 py-4 text-right font-bold">القيمة</th>
                </tr>
              </thead>
              <tbody>
                {filteredStockData.map((product: Product) => {
                  const stock = selectedWarehouse 
                    ? warehouseStock.find(ws => ws.product_id === product.id)?.quantity || 0
                    : product.stock
                  const stockStatus = getStockStatus(stock)
                  const value = stock * (product.cost_price || product.price_a * 0.7)
                  
                  return (
                    <tr
                      key={product.id}
                      className="border-b hover:bg-teal-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-800">{product.name_ar}</div>
                        {product.name_en && (
                          <div className="text-sm text-gray-500">{product.name_en}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{product.sku}</td>
                      <td className="px-6 py-4">
                        <span className={`font-bold text-lg ${
                          stock === 0 ? 'text-red-600' :
                          stock < 10 ? 'text-orange-600' : 'text-green-600'
                        }`}>
                          {stock}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${stockStatus.color}`}>
                          {stockStatus.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-800">
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
