import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Search, Package, ArrowLeft, Filter } from 'lucide-react'

interface Product {
  id: string
  name_ar: string
  sku: string
  price_a: number
  price_b: number
  price_c: number
  price_d: number
  price_e: number
  stock: number
  category_id?: string
  image_url?: string
  is_active_for_commercial?: boolean
}

interface Category {
  id: string
  name_ar: string
}

export default function CommercialProductsPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  useEffect(() => {
    // Vérifier l'authentification
    const commercialId = localStorage.getItem('commercial_id')
    if (!commercialId) {
      navigate('/commercial/login')
      return
    }

    loadProducts()
    loadCategories()
  }, [navigate])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name_ar')

      if (error) throw error
      const rawProducts = (data || []) as Product[]
      const visibleProducts = rawProducts.filter(p => p.is_active_for_commercial !== false)
      setProducts(visibleProducts)
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

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || product.category_id === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/commercial/dashboard')}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold">المنتجات</h1>
            <p className="text-purple-100 text-sm">عرض المنتجات والأسعار</p>
          </div>
          <button
            onClick={() => navigate('/commercial/orders/new')}
            className="mr-auto bg-white text-purple-700 px-4 py-2 rounded-lg font-bold hover:bg-purple-50 transition-colors"
          >
            إنشاء طلب
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-3 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300"
            placeholder="ابحث عن منتج..."
          />
        </div>
      </div>

      {/* Categories Filter */}
      <div className="bg-white p-4 shadow-sm overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              !selectedCategory
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            الكل ({products.length})
          </button>
          {categories.map((category) => {
            const count = products.filter(p => p.category_id === category.id).length
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.name_ar} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Products Grid - Card View */}
      <div className="p-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            جاري التحميل...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">لا توجد منتجات</p>
            <button
              onClick={() => navigate('/commercial/orders/new')}
              className="mt-4 bg-purple-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-purple-700 transition-colors"
            >
              ابدأ التسوق
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Product Image */}
                <div className="bg-gray-100 h-20 flex items-center justify-center overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name_ar}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package size={24} className="text-gray-400" />
                  )}
                </div>

                {/* Product Info */}
                <div className="p-2">
                  <h3 className="font-bold text-gray-800 text-xs mb-1 line-clamp-2">
                    {product.name_ar}
                  </h3>
                  <p className="text-xs text-gray-500 mb-2">
                    SKU: {product.sku || 'N/A'}
                  </p>

                  {/* Stock Badge */}
                  <div className={`text-xs font-medium px-2 py-1 rounded mb-2 inline-block ${
                    product.stock > 10
                      ? 'bg-green-100 text-green-700'
                      : product.stock > 0
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    المخزون: {product.stock}
                  </div>

                  {/* Prices Grid - Compact */}
                  <div className="grid grid-cols-2 gap-1 bg-gray-50 rounded p-2 text-xs">
                    <div className="text-center">
                      <p className="text-gray-500 text-xs">A</p>
                      <p className="font-bold text-blue-600">{product.price_a.toFixed(0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 text-xs">B</p>
                      <p className="font-bold text-green-600">{product.price_b.toFixed(0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 text-xs">C</p>
                      <p className="font-bold text-orange-600">{product.price_c.toFixed(0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 text-xs">D</p>
                      <p className="font-bold text-purple-600">{product.price_d.toFixed(0)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
