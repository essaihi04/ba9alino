import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ResetAppButton from '../components/ResetAppButton'

interface ProductCategory {
  id: string
  name_ar: string
  name_en?: string
  description_ar?: string
  description_en?: string
  is_active: boolean
  created_at?: string
}

interface Product {
  id: string
  name_ar: string
  name_en?: string
  sku: string
  cost_price?: number
  price_a: number
  price_b: number
  price_c: number
  price_d: number
  price_e: number
  category_id?: string
  category?: ProductCategory
  image_url?: string
  created_at?: string
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null)
  const [formData, setFormData] = useState({
    name_ar: '',
    name_en: '',
    sku: '',
    cost_price: '',
    price_a: '',
    price_b: '',
    price_c: '',
    price_d: '',
    price_e: '',
    category_id: '',
    quantity_in_stock: '0',
    image_url: '',
  })
  const [imagePreview, setImagePreview] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [categoryFormData, setCategoryFormData] = useState({
    name_ar: '',
    name_en: '',
    description_ar: '',
    description_en: '',
  })

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  const parsePrice = (value: string) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }

  const parseQuantity = (value: string) => {
    const n = Number.parseInt(value, 10)
    return Number.isFinite(n) ? n : 0
  }

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name_ar,
          name_en,
          sku,
          cost_price,
          price_a,
          price_b,
          price_c,
          price_d,
          price_e,
          category_id,
          image_url,
          created_at,
          is_active,
          archive_date,
          category:product_categories(id, name_ar, name_en)
        `)
        .eq('is_active', true) // Only fetch active products
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      console.log('Fetching categories...')
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('is_active', true)
        .order('name_ar')
      
      if (error) {
        console.error('Error fetching categories:', error)
        throw error
      }
      
      console.log('Categories fetched:', data)
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('يرجى اختيار ملف صورة صالح')
        return
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('حجم الصورة يجب أن لا يتجاوز 5 ميجابايت')
        return
      }
      
      try {
        setIsUploading(true)
        
        // Upload to Supabase Storage
        const fileName = `products/${Date.now()}-${file.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          })
        
        if (uploadError) {
          console.error('Upload error:', uploadError)
          alert('فشل رفع الصورة. يرجى المحاولة مرة أخرى.')
          return
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(uploadData.path)
        
        // Update form with public URL
        setImagePreview(publicUrl)
        setFormData({ ...formData, image_url: publicUrl })
        
        console.log('Image uploaded successfully:', publicUrl)
      } catch (error) {
        console.error('Error uploading image:', error)
        alert('حدث خطأ أثناء رفع الصورة')
      } finally {
        setIsUploading(false)
      }
    }
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const productData = {
        name_ar: formData.name_ar,
        name_en: formData.name_en || null,
        sku: formData.sku,
        cost_price: parsePrice(formData.cost_price) || null,
        price_a: parsePrice(formData.price_a),
        price_b: parsePrice(formData.price_b),
        price_c: parsePrice(formData.price_c),
        price_d: parsePrice(formData.price_d),
        price_e: parsePrice(formData.price_e),
        category_id: formData.category_id || null,
        image_url: formData.image_url || null,
      }

      let productId: string
      
      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id)
        if (error) throw error
        productId = editingProduct.id

        setProducts(prev =>
          prev.map(p => (p.id === editingProduct.id ? { ...p, ...(productData as any) } : p))
        )
        
        // Update stock quantity if editing
        const { error: stockError } = await supabase
          .from('stock')
          .update({ 
            quantity_in_stock: parseQuantity(formData.quantity_in_stock),
            last_restock_date: new Date().toISOString()
          })
          .eq('product_id', productId)
        if (stockError) throw stockError
      } else {
        // Create product first
        const { data: productResult, error } = await supabase
          .from('products')
          .insert([productData])
          .select()
          .single()
        if (error) throw error
        
        productId = productResult.id

        setProducts(prev => [productResult as Product, ...prev])
        
        // Create stock entry for the new product
        const stockData = {
          product_id: productId,
          quantity_in_stock: parseQuantity(formData.quantity_in_stock),
          quantity_reserved: 0,
          reorder_level: 10,
          reorder_quantity: 50,
          last_stock_check: new Date().toISOString(),
          last_restock_date: new Date().toISOString(),
        }
        
        const { error: stockError } = await supabase
          .from('stock')
          .insert([stockData])
        if (stockError) throw stockError
      }
      
      setFormData({
        name_ar: '',
        name_en: '',
        sku: '',
        cost_price: '',
        price_a: '',
        price_b: '',
        price_c: '',
        price_d: '',
        price_e: '',
        category_id: '',
        quantity_in_stock: '0',
        image_url: '',
      })
      setImagePreview('')
      setEditingProduct(null)
      setShowModal(false)
      await fetchProducts()
    } catch (error) {
      console.error('Error saving product:', error)
    }
  }

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingCategory) {
        // Update existing category
        const { error } = await supabase
          .from('product_categories')
          .update({
            name_ar: categoryFormData.name_ar,
            name_en: categoryFormData.name_en || null,
            description_ar: categoryFormData.description_ar || null,
            description_en: categoryFormData.description_en || null,
          })
          .eq('id', editingCategory.id)
        
        if (error) throw error
      } else {
        // Create new category
        const { error } = await supabase
          .from('product_categories')
          .insert([{
            name_ar: categoryFormData.name_ar,
            name_en: categoryFormData.name_en || null,
            description_ar: categoryFormData.description_ar || null,
            description_en: categoryFormData.description_en || null,
          }])
        
        if (error) throw error
      }
      
      // Reset form and close modal
      setCategoryFormData({
        name_ar: '',
        name_en: '',
        description_ar: '',
        description_en: '',
      })
      setEditingCategory(null)
      setShowCategoryModal(false)
      
      // Refresh categories list
      await fetchCategories()
    } catch (error) {
      console.error('Error saving category:', error)
    }
  }

  const handleEditCategory = async (category: ProductCategory) => {
    setEditingCategory(category)
    setCategoryFormData({
      name_ar: category.name_ar,
      name_en: category.name_en || '',
      description_ar: category.description_ar || '',
      description_en: category.description_en || '',
    })
    setShowCategoryModal(true)
  }

  const handleDeleteCategory = async (id: string) => {
    // Check if category is referenced by products
    const { data: productsInCategory, error: checkError } = await supabase
      .from('products')
      .select('id, name_ar')
      .eq('category_id', id)
      .limit(5) // Just get first 5 for display

    if (checkError) throw checkError

    if (productsInCategory && productsInCategory.length > 0) {
      const productNames = productsInCategory.map(p => p.name_ar).join(', ')
      const forceDelete = confirm(
        `هذه الفئة مرتبطة بـ ${productsInCategory.length} منتجات على الأقل:\n${productNames}${productsInCategory.length === 5 ? '...' : ''}\n\n` +
        `الخيارات:\n• "موافق" = حذف الفئة ونقل المنتجات إلى "بدون فئة"\n• "إلغاء" = إلغاء العملية`
      )
      
      if (!forceDelete) return

      try {
        // Move products to "no category" (null category_id)
        const { error: updateError } = await supabase
          .from('products')
          .update({ category_id: null })
          .eq('category_id', id)
        
        if (updateError) throw updateError

        // Now archive the category
        const { error: archiveError } = await supabase
          .from('product_categories')
          .update({ is_active: false })
          .eq('id', id)
        
        if (archiveError) throw archiveError
        
        await fetchCategories()
        await fetchProducts() // Refresh products to show category changes
        alert(`تم حذف الفئة ونقل ${productsInCategory.length} منتجات إلى "بدون فئة"`)
      } catch (error) {
        console.error('Error force deleting category:', error)
        alert('حدث خطأ أثناء حذف الفئة')
      }
    } else {
      // No products, just archive
      const confirmDelete = confirm('هل أنت متأكد من أرشفة هذه الفئة؟')
      if (!confirmDelete) return

      try {
        const { error } = await supabase
          .from('product_categories')
          .update({ is_active: false })
          .eq('id', id)
        
        if (error) throw error
        
        await fetchCategories()
        alert('تم أرشفة الفئة بنجاح')
      } catch (error) {
        console.error('Error deleting category:', error)
        alert('حدث خطأ أثناء حذف الفئة')
      }
    }
  }

  const handleEditProduct = async (product: Product) => {
    setEditingProduct(product)
    
    // Get stock quantity for this product
    const { data: stockData } = await supabase
      .from('stock')
      .select('quantity_in_stock')
      .eq('product_id', product.id)
      .single()
    
    setFormData({
      name_ar: product.name_ar,
      name_en: product.name_en || '',
      sku: product.sku,
      cost_price: product.cost_price?.toString() || '',
      price_a: product.price_a.toString(),
      price_b: product.price_b.toString(),
      price_c: product.price_c.toString(),
      price_d: product.price_d.toString(),
      price_e: product.price_e.toString(),
      category_id: product.category_id || '',
      quantity_in_stock: stockData?.quantity_in_stock?.toString() || '0',
      image_url: product.image_url || '',
    })
    setImagePreview(product.image_url || '')
    setShowModal(true)
  }

  const handleDeleteProduct = async (id: string) => {
    const action = confirm('هل تريد أرشفة هذا المنتج أم حذفه نهائياً؟\n\n• "موافق" للأرشفة (آمن)\n• "إلغاء" للحذف النهائي (قد يفشل إذا مرتبط ببيانات أخرى)')
    
    if (!action) {
      return
    }

    try {
      // Vérifier si le produit est référencé dans des commandes
      const { data: orderItems, error: checkError } = await supabase
        .from('order_items')
        .select('id')
        .eq('product_id', id)
        .limit(1)

      if (checkError) throw checkError

      // Vérifier si le produit est référencé dans les achats
      const { data: purchaseItems, error: purchaseCheckError } = await supabase
        .from('purchases')
        .select('id, items')
        .limit(100) // Limiter pour éviter les gros résultats
      
      if (purchaseCheckError) throw purchaseCheckError

      // Vérifier manuellement si le produit_id existe dans les items
      const hasPurchaseReferences = purchaseItems?.some(purchase => {
        try {
          const items = Array.isArray(purchase.items) ? purchase.items : []
          return items.some((item: any) => item.product_id === id)
        } catch {
          return false
        }
      }) || false

      // Vérifier si le produit a du stock
      const { data: stockItems, error: stockCheckError } = await supabase
        .from('stock')
        .select('id')
        .eq('product_id', id)
        .limit(1)

      if (stockCheckError) throw stockCheckError

      const hasReferences = (orderItems && orderItems.length > 0) || 
                           hasPurchaseReferences || 
                           (stockItems && stockItems.length > 0)

      if (hasReferences) {
        // Archiver le produit au lieu de le supprimer
        const { error: archiveError } = await supabase
          .from('products')
          .update({ 
            is_active: false, 
            archive_date: new Date().toISOString() 
          })
          .eq('id', id)
        
        if (archiveError) throw archiveError
        
        // Supprimer le stock associé au produit archivé
        const { error: stockError } = await supabase
          .from('stock')
          .delete()
          .eq('product_id', id)
        
        if (stockError) {
          console.warn('Impossible de supprimer le stock:', stockError)
        }
        
        setProducts(prev => prev.filter(p => p.id !== id))
        await fetchProducts()
        alert('تم أرشفة المنتج بنجاح. لن يظهر في القائمة ولكن سيبقى في السجلات.')
      } else {
        // Demander confirmation pour suppression réelle
        const confirmDelete = confirm('هذا المنتج ليس مرتبطاً بأي بيانات. هل تريد حذفه نهائياً؟')
        if (!confirmDelete) return

        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', id)
        
        if (error) throw error
        
        // Supprimer le stock associé au produit supprimé
        const { error: stockError } = await supabase
          .from('stock')
          .delete()
          .eq('product_id', id)
        
        if (stockError) {
          console.warn('Impossible de supprimer le stock:', stockError)
        }
        
        setProducts(prev => prev.filter(p => p.id !== id))
        await fetchProducts()
        alert('تم حذف المنتج نهائياً')
      }
    } catch (error) {
      console.error('Error handling product:', error)
      if (error instanceof Error) {
        if (error.message.includes('foreign key constraint')) {
          alert('لا يمكن حذف هذا المنتج لأنه مرتبط ببيانات أخرى. سيتم أرشفته بدلاً من ذلك.')
          // Essayer d'archiver en cas d'échec
          try {
            await supabase
              .from('products')
              .update({ 
                is_active: false, 
                archive_date: new Date().toISOString() 
              })
              .eq('id', id)
            setProducts(prev => prev.filter(p => p.id !== id))
            await fetchProducts()
            alert('تم أرشفة المنتج بنجاح')
          } catch (archiveError) {
            alert(`فشل الأرشفة أيضاً: ${archiveError instanceof Error ? archiveError.message : 'خطأ غير معروف'}`)
          }
        } else {
          alert(`حدث خطأ: ${error.message}`)
        }
      } else {
        alert('حدث خطأ غير متوقع')
      }
    }
  }

  const filteredProducts = products.filter((product) => {
    const search = searchTerm.toLowerCase()
    const matchesSearch = (product.name_ar || '').toLowerCase().includes(search) ||
                          (product.name_en || '').toLowerCase().includes(search) ||
                          (product.sku || '').toLowerCase().includes(search)
    
    const matchesCategory = !selectedCategoryId || product.category_id === selectedCategoryId
    
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">إدارة المنتجات</h1>
          <p className="text-gray-600 mt-2">قائمة بجميع منتجاتك</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-green-600 to-teal-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition"
          >
            <Plus size={20} />
            <span>إضافة فئة</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition"
          >
            <Plus size={20} />
            <span>إضافة منتج</span>
          </button>
        </div>
      </div>

      {/* Categories Display */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-gray-800">الفئات المتاحة</h3>
            {selectedCategoryId && (
              <button
                onClick={() => setSelectedCategoryId(null)}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
              >
                <span>إلغاء التصفية</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <span className="text-sm text-gray-500">{categories.length} فئة</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.length > 0 ? (
            <>
              {/* All categories button */}
              <div
                onClick={() => setSelectedCategoryId(null)}
                className={`inline-flex items-center px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                  !selectedCategoryId
                    ? 'bg-gradient-to-r from-gray-600 to-gray-700 text-white border border-gray-600'
                    : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                <span className="font-medium">جميع الفئات</span>
                <span className="mr-2 text-sm opacity-75">({products.length})</span>
              </div>
              
              {/* Category buttons */}
              {categories.map((category) => {
                const productCount = products.filter(p => p.category_id === category.id).length
                const isSelected = selectedCategoryId === category.id
                
                return (
                  <div
                    key={category.id}
                    className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border border-blue-600'
                        : 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-gray-800 hover:from-blue-100 hover:to-indigo-100'
                    }`}
                  >
                    <div 
                      onClick={() => setSelectedCategoryId(category.id)}
                      className="flex items-center flex-1 cursor-pointer"
                    >
                      <div className={`w-2 h-2 rounded-full ml-2 ${
                        isSelected ? 'bg-white' : 'bg-blue-500'
                      }`}></div>
                      <span className="font-medium">{category.name_ar}</span>
                      {category.name_en && (
                        <span className={`text-sm mr-2 ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                          ({category.name_en})
                        </span>
                      )}
                      <span className={`text-sm ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                        {productCount}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 mr-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditCategory(category)
                        }}
                        className={`p-1 rounded transition ${isSelected ? 'hover:bg-blue-700' : 'hover:bg-blue-200'}`}
                      >
                        <Edit2 size={14} className={isSelected ? 'text-white' : 'text-blue-600'} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteCategory(category.id)
                        }}
                        className={`p-1 rounded transition ${isSelected ? 'hover:bg-blue-700' : 'hover:bg-red-100'}`}
                      >
                        <Trash2 size={14} className={isSelected ? 'text-white' : 'text-red-600'} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </>
          ) : (
            <div className="text-center py-8 w-full">
              <div className="text-gray-400 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-gray-500">لا توجد فئات متاحة</p>
              <p className="text-gray-400 text-sm mt-1">اضغط على "إضافة فئة" للبدء</p>
            </div>
          )}
        </div>
      </div>

      {/* Reset App Button */}
      <ResetAppButton />

      {/* Search */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex items-center space-x-3 bg-gray-50 rounded-lg px-4 py-3">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="ابحث عن منتج..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent outline-none text-gray-800"
          />
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">جاري التحميل...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">الصورة</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">اسم المنتج</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">الفئة</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">SKU</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">الأسعار (A-B-C-D-E)</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="py-4 px-6">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name_ar}
                          className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                          onError={(e) => {
                            e.currentTarget.src = '';
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-gray-800 font-medium">{product.name_ar}</td>
                    <td className="py-4 px-6 text-gray-600">{product.category?.name_ar || '—'}</td>
                    <td className="py-4 px-6 text-gray-600">{product.sku}</td>
                    <td className="py-4 px-6">
                      <div className="text-sm space-y-1">
                        <div className="text-purple-700 font-medium">Achat: {product.cost_price || 0} MAD</div>
                        <div className="text-green-700 font-medium">A: {product.price_a || 0} MAD</div>
                        <div className="text-blue-700">B: {product.price_b || 0} MAD</div>
                        <div className="text-yellow-700">C: {product.price_c || 0} MAD</div>
                        <div className="text-orange-700">D: {product.price_d || 0} MAD</div>
                        <div className="text-red-700">E: {product.price_e || 0} MAD</div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <button 
                          onClick={() => handleEditProduct(product)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(product.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 size={18} />
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

      {/* Add Client Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{editingProduct ? 'تعديل منتج' : 'إضافة منتج جديد'}</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">اسم المنتج (عربي)</label>
                <input
                  type="text"
                  value={formData.name_ar}
                  onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">اسم المنتج (English)</label>
                <input
                  type="text"
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SKU</label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">سعر الشراء (MAD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">السعر فئة A (MAD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price_a}
                  onChange={(e) => setFormData({ ...formData, price_a: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">السعر فئة B (MAD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price_b}
                  onChange={(e) => setFormData({ ...formData, price_b: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">السعر فئة C (MAD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price_c}
                  onChange={(e) => setFormData({ ...formData, price_c: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">السعر فئة D (MAD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price_d}
                  onChange={(e) => setFormData({ ...formData, price_d: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">السعر فئة E (MAD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price_e}
                  onChange={(e) => setFormData({ ...formData, price_e: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">الكمية المتاحة</label>
                <input
                  type="number"
                  min="0"
                  value={formData.quantity_in_stock}
                  onChange={(e) => setFormData({ ...formData, quantity_in_stock: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                  required
                />
              </div>
              </div>
              
              {/* Category and Image - Full width */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">الفئة</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                >
                  <option value="">اختر فئة...</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name_ar}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">صورة المنتج</label>
                <div className="space-y-4">
                  {/* File Upload */}
                  <div>
                    <label className="block">
                      <span className="sr-only">اختر صورة</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="block w-full text-sm text-gray-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-full file:border-0
                          file:text-sm file:font-semibold
                          file:bg-indigo-50 file:text-indigo-700
                          hover:file:bg-indigo-100
                          cursor-pointer"
                      />
                    </label>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF jusqu'à 5MB</p>
                    {isUploading && (
                      <div className="mt-2 flex items-center text-sm text-blue-600">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        جاري رفع الصورة...
                      </div>
                    )}
                  </div>
                  
                  {/* URL Input (fallback) */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">أو استخدم رابط</span>
                    </div>
                  </div>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => {
                      setFormData({ ...formData, image_url: e.target.value })
                      setImagePreview('')
                    }}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
                  />
                  
                  {/* Preview */}
                  {(imagePreview || formData.image_url) && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-600 mb-2">معاينة الصورة:</p>
                      <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                        <img
                          src={imagePreview || formData.image_url}
                          alt="معاينة المنتج"
                          className="w-full h-48 object-cover"
                          onError={(e) => {
                            e.currentTarget.src = '';
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImagePreview('')
                            setFormData({ ...formData, image_url: '' })
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition font-medium"
                >
                  {editingProduct ? 'تحديث' : 'إضافة'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">{editingCategory ? 'تعديل فئة' : 'إضافة فئة جديدة'}</h2>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryModal(false)
                  setEditingCategory(null)
                  setCategoryFormData({
                    name_ar: '',
                    name_en: '',
                    description_ar: '',
                    description_en: '',
                  })
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">اسم الفئة (عربي)</label>
                <input
                  type="text"
                  value={categoryFormData.name_ar}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name_ar: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">اسم الفئة (English)</label>
                <input
                  type="text"
                  value={categoryFormData.name_en}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name_en: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">الوصف (عربي)</label>
                <textarea
                  value={categoryFormData.description_ar}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description_ar: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 outline-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">الوصف (English)</label>
                <textarea
                  value={categoryFormData.description_en}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description_en: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 outline-none"
                  rows={3}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition font-medium"
                >
                  إضافة فئة
                </button>
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
