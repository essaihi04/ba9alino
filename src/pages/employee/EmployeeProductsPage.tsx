import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Search, Package, Plus } from 'lucide-react'
import { getCategoryLabelArabic } from '../../utils/categoryLabels'

interface ProductVariant {
  id: string
  product_id: string
  unit_type: string
  quantity_contained: number
  purchase_price: number
  price_a: number
  price_b: number
  price_c: number
  price_d: number
  price_e: number
  stock: number
  is_active: boolean
  is_default: boolean
}

interface Product {
  id: string
  sku: string
  name_ar: string
  name_en?: string
  price?: number
  cost_price?: number
  price_a?: number
  price_b?: number
  price_c?: number
  price_d?: number
  price_e?: number
  stock?: number
  image_url?: string
  product_variants?: ProductVariant[]
  is_active: boolean
  created_at: string
}

interface Stock {
  id: string
  product_id: string
  quantity_in_stock: number
  quantity_reserved: number
  quantity_available: number
  reorder_level: number
  is_low_stock: boolean
  is_out_of_stock: boolean
}

export default function EmployeeProductsPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [stocks, setStocks] = useState<Map<string, Stock>>(new Map())
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all')

  useEffect(() => {
    const employeeId = localStorage.getItem('employee_id')
    if (!employeeId) {
      navigate('/employee/login')
      return
    }
    loadProducts()
  }, [navigate])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(
          'id, sku, name_ar, name_en, price, cost_price, price_a, price_b, price_c, price_d, price_e, stock, image_url, is_active, created_at, product_variants (id, product_id, unit_type, quantity_contained, purchase_price, price_a, price_b, price_c, price_d, price_e, stock, is_active, is_default)'
        )
        .eq('is_active', true)
        .order('name_ar')

      if (productsError) throw productsError

      const { data: stocksData, error: stocksError } = await supabase
        .from('stock')
        .select('*')

      if (stocksError) throw stocksError

      setProducts(productsData || [])

      const stockMap = new Map()
      stocksData?.forEach((stock) => {
        stockMap.set(stock.product_id, stock)
      })
      setStocks(stockMap)
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const getAvailableStock = (product: Product) => {
    const stockRow = stocks.get(product.id)

    const variants = product.product_variants || []
    const unitVariant = variants.find(v => v.unit_type === 'unit')
    if (unitVariant && typeof unitVariant.stock === 'number') {
      return unitVariant.stock
    }

    const cartonVariant = variants.find(v => v.unit_type === 'carton')
    const unitsPerCarton = cartonVariant?.quantity_contained ? Number(cartonVariant.quantity_contained) : 0
    if (cartonVariant && typeof cartonVariant.stock === 'number' && unitsPerCarton > 0) {
      return cartonVariant.stock * unitsPerCarton
    }
    
    // Debug: Afficher les informations de stock pour ce produit
    console.log(`Stock debug for ${product.name_ar} (${product.id}):`, {
      stockRow,
      quantity_available: stockRow?.quantity_available,
      quantity_in_stock: stockRow?.quantity_in_stock,
      product_stock: product.stock,
      variants: product.product_variants,
      variants_total: (product.product_variants || []).reduce((sum, v) => sum + (v.stock || 0), 0)
    })
    
    // Priorité 1: Utiliser quantity_available depuis la table stock
    if (typeof stockRow?.quantity_available === 'number' && stockRow.quantity_available > 0) {
      return stockRow.quantity_available
    }
    
    // Priorité 2: Utiliser quantity_in_stock si quantity_available n'est pas disponible
    if (typeof stockRow?.quantity_in_stock === 'number' && stockRow.quantity_in_stock > 0) {
      return stockRow.quantity_in_stock
    }
    
    // Priorité 3: Calculer depuis les variants
    const variantsTotal = (product.product_variants || []).reduce((sum, v) => sum + (v.stock || 0), 0)
    if (variantsTotal > 0) {
      return variantsTotal
    }
    
    // Priorité 4: Utiliser le stock de base du produit
    return product.stock || 0
  }

  const getDisplayPrice = (product: Product, tier: 'a' | 'b' | 'c' | 'd' | 'e') => {
    const variants = product.product_variants || []
    const chosenVariant =
      variants.find((v) => v.is_default) ||
      variants.find((v) => v.is_active) ||
      variants[0]

    const vPrice = chosenVariant
      ? tier === 'a'
        ? chosenVariant.price_a
        : tier === 'b'
          ? chosenVariant.price_b
          : tier === 'c'
            ? chosenVariant.price_c
            : tier === 'd'
              ? chosenVariant.price_d
              : chosenVariant.price_e
      : 0

    const pPrice =
      tier === 'a'
        ? product.price_a
        : tier === 'b'
          ? product.price_b
          : tier === 'c'
            ? product.price_c
            : tier === 'd'
              ? product.price_d
              : product.price_e

    return (vPrice || 0) > 0 ? (vPrice || 0) : (pPrice || 0) > 0 ? (pPrice || 0) : (product.price || 0)
  }

  const filteredProducts = products.filter(product => {
    const stock = stocks.get(product.id)
    const matchesSearch = String(product.name_ar || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(product.sku || '').toLowerCase().includes(searchQuery.toLowerCase())

    const available = getAvailableStock(product)

    let matchesFilter = true
    if (filter === 'in_stock') matchesFilter = available > 0
    if (filter === 'low_stock') matchesFilter = stock ? stock.is_low_stock === true : false
    if (filter === 'out_of_stock') matchesFilter = stock ? stock.is_out_of_stock === true : available <= 0

    return matchesSearch && matchesFilter
  })

  return (
    <div className="min-h-screen bg-gray-100" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-800 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate('/employee/dashboard')}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold">المنتجات والمخزون</h1>
            <p className="text-orange-100">إدارة المنتجات والأسعار والمخزون</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Search and Filter */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                placeholder="ابحث عن منتج أو SKU..."
              />
            </div>
            <button
              onClick={() => navigate('/employee/products/add')}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-lg font-bold transition-colors flex items-center gap-2"
            >
              <Plus size={20} />
              منتج جديد
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {['all', 'in_stock', 'low_stock', 'out_of_stock'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status as any)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === status
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {status === 'all' && 'الكل'}
                {status === 'in_stock' && 'متوفر'}
                {status === 'low_stock' && 'مخزون منخفض'}
                {status === 'out_of_stock' && 'غير متوفر'}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-12 text-gray-500">جاري التحميل...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Package className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-500">لا توجد منتجات</p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const stock = stocks.get(product.id)
              const available = getAvailableStock(product)
              const stockStatus = (stock ? stock.is_out_of_stock : available <= 0)
                ? 'bg-red-100 text-red-700'
                : (stock ? stock.is_low_stock : false)
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-green-100 text-green-700'

              const priceA = getDisplayPrice(product, 'a')
              const priceB = getDisplayPrice(product, 'b')
              const priceC = getDisplayPrice(product, 'c')
              const priceD = getDisplayPrice(product, 'd')
              const priceE = getDisplayPrice(product, 'e')
              const costPrice = product.cost_price || 0
              const marginBase = priceA || 0
              const marginPct = marginBase > 0 ? ((marginBase - costPrice) / marginBase) * 100 : 0

              return (
                <div key={product.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">{product.name_ar}</h3>
                      <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${stockStatus}`}>
                      {available > 0 ? `المتوفر: ${available}` : `غير متوفر`}
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">{getCategoryLabelArabic('A')}:</span>
                      <span className="font-bold text-green-600">{(priceA || 0).toFixed(2)} MAD</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">{getCategoryLabelArabic('B')}:</span>
                      <span className="font-bold text-green-600">{(priceB || 0).toFixed(2)} MAD</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">{getCategoryLabelArabic('C')}:</span>
                      <span className="font-bold text-green-600">{(priceC || 0).toFixed(2)} MAD</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">{getCategoryLabelArabic('D')}:</span>
                      <span className="font-bold text-green-600">{(priceD || 0).toFixed(2)} MAD</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">{getCategoryLabelArabic('E')}:</span>
                      <span className="font-bold text-green-600">{(priceE || 0).toFixed(2)} MAD</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">سعر التكلفة:</span>
                      <span className="font-bold text-gray-700">{costPrice.toFixed(2)} MAD</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">الهامش (A):</span>
                      <span className="font-bold text-blue-600">{marginPct.toFixed(1)}%</span>
                    </div>
                  </div>

                  {stock && (
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">في المخزن:</span>
                        <span className="font-medium">{stock.quantity_in_stock}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">محجوز:</span>
                        <span className="font-medium">{stock.quantity_reserved}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">متاح:</span>
                        <span className="font-bold text-green-600">{stock.quantity_available}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="text-gray-600">حد إعادة الطلب:</span>
                        <span className="font-medium">{stock.reorder_level}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
