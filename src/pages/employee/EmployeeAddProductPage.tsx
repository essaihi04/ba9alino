import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Plus, Barcode, Package, Upload, AlertCircle, X } from 'lucide-react'

interface ProductVariant {
  id?: string
  product_id?: string
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

interface Category {
  id: string
  name_ar: string
  name_en?: string
}

interface BarcodeResult {
  name: string
  category: string
  image: string
  brand?: string
  size?: string
}

export default function EmployeeAddProductPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeLookupLoading, setBarcodeLookupLoading] = useState(false)
  const [barcodeLookupError, setBarcodeLookupError] = useState<string | null>(null)
  const [barcodeLookupResult, setBarcodeLookupResult] = useState<BarcodeResult | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  
  // États pour la recherche de produits existants
  const [searchQuery, setSearchQuery] = useState('')
  const [existingProducts, setExistingProducts] = useState<any[]>([])
  const [showProductList, setShowProductList] = useState(false)
  const [selectedExistingProduct, setSelectedExistingProduct] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    name_ar: '',
    sku: '',
    category_id: '',
    category_name: '', // Pour modification lors du scan
    cost_price: '',
    price_a: '',
    price_b: '',
    price_c: '',
    price_d: '',
    price_e: '',
    quantity_in_stock: '0',
    image_url: '',
  })
  
  const [variants, setVariants] = useState<ProductVariant[]>([])

  useEffect(() => {
    loadCategories()
  }, [])

  // Effet pour la recherche automatique de produits
  useEffect(() => {
    if (searchQuery.length > 2) {
      searchExistingProducts()
    } else {
      setExistingProducts([])
      setShowProductList(false)
    }
  }, [searchQuery])

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

  // Fonction pour rechercher des produits existants
  const searchExistingProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ar, sku, barcode, price_a, price_b, price_c, price_d, price_e, stock, category_id, image_url')
        .or(`name_ar.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%,barcode.ilike.%${searchQuery}%`)
        .eq('is_active', true)
        .limit(10)

      if (error) throw error
      setExistingProducts(data || [])
      setShowProductList(true)
    } catch (error) {
      console.error('Error searching products:', error)
      setExistingProducts([])
      setShowProductList(false)
    }
  }

  // Fonction pour sélectionner un produit existant
  const selectExistingProduct = (product: any) => {
    setSelectedExistingProduct(product)
    setFormData({
      ...formData,
      name_ar: product.name_ar,
      sku: product.sku,
      barcode: product.barcode || '',
      price_a: product.price_a?.toString() || '',
      price_b: product.price_b?.toString() || '',
      price_c: product.price_c?.toString() || '',
      price_d: product.price_d?.toString() || '',
      price_e: product.price_e?.toString() || '',
      quantity_in_stock: product.stock?.toString() || '0',
      category_id: product.category_id || '',
      image_url: product.image_url || ''
    })
    setShowProductList(false)
    setSearchQuery(product.name_ar)
  }

  const normalizeCategoryName = (name: string) => String(name || '').trim()

  const simplifyAndTranslateCategory = (raw: string) => {
    const input = String(raw || '').trim()
    if (!input) return ''

    const last = input
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(-1)[0] || input

    const key = last.toLowerCase()
    const map: Record<string, string> = {
      'beverages': 'مشروبات',
      'waters': 'مياه',
      'water': 'مياه',
      'mineral waters': 'مياه معدنية',
      'natural mineral waters': 'مياه معدنية طبيعية',
      'spring waters': 'مياه الينابيع',
      'juice': 'عصير',
      'juices': 'عصائر',
      'milk': 'حليب',
      'yogurt': 'ياغورت',
      'tea': 'شاي',
      'coffee': 'قهوة',
      'soft drinks': 'مشروبات غازية',
      'carbonated drinks': 'مشروبات غازية',
    }

    return map[key] || last
  }

  const ensureCategoryId = async (name: string): Promise<string | null> => {
    const categoryName = normalizeCategoryName(name)
    if (!categoryName) return null

    const local = categories.find((c) => String(c.name_ar || '').trim().toLowerCase() === categoryName.toLowerCase())
    if (local?.id) return local.id

    const { data: existing, error: findErr } = await supabase
      .from('product_categories')
      .select('id, name_ar')
      .eq('name_ar', categoryName)
      .limit(1)
      .maybeSingle()

    if (!findErr && existing?.id) {
      setCategories((prev) => {
        if (prev.some((c) => c.id === existing.id)) return prev
        return [...prev, existing as any]
      })
      return existing.id
    }

    const { data: created, error: createErr } = await supabase
      .from('product_categories')
      .insert({ name_ar: categoryName })
      .select('id, name_ar')
      .single()

    if (createErr) {
      console.error('Error creating category:', createErr)
      return null
    }

    setCategories((prev) => [...prev, created as any])
    return created?.id || null
  }

  const fetchGoUpcProduct = async (barcode: string) => {
    const fetchOpenFoodFacts = async () => {
      try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`)
        if (!response.ok) return null
        const data = await response.json()
        if (data.status !== 1 || !data.product) return null
        const product = data.product

        const offQuantity = String(product.quantity || '').trim()
        const offQtyNum = product.product_quantity ? Number(product.product_quantity) : NaN
        const offQtyUnit = String(product.product_quantity_unit || '').trim()
        const offSize = offQuantity || ((Number.isFinite(offQtyNum) && offQtyUnit) ? `${offQtyNum} ${offQtyUnit}` : '')

        return {
          name_ar: String(product.product_name_ar || '').trim(),
          name: String(product.product_name || '').trim(),
          category: String(product.categories || product.categories_tags?.[0] || '').trim(),
          image: String(product.image_front_url || product.image_url || '').trim(),
          brand: product.brands ? String(product.brands).trim() : undefined,
          size: offSize,
        }
      } catch (error) {
        console.error('OpenFoodFacts error:', error)
        return null
      }
    }

    const off = await fetchOpenFoodFacts()
    if (off) {
      return {
        name: off.name_ar || off.name || '',
        category: off.category || '',
        image: off.image || '',
        brand: off.brand,
        size: off.size || undefined,
      }
    }

    return null
  }

  const handleBarcodeLookup = async (barcodeRaw?: string) => {
    const barcode = String(barcodeRaw ?? barcodeInput).trim()
    if (!barcode) return

    setBarcodeLookupLoading(true)
    setBarcodeLookupError(null)
    setBarcodeLookupResult(null)

    try {
      const product = await fetchGoUpcProduct(barcode)
      setBarcodeLookupResult(product)

      const normalizedCategory = simplifyAndTranslateCategory(product.category)
      const catId = normalizedCategory ? await ensureCategoryId(normalizedCategory) : null

      setFormData((prev) => ({
        ...prev,
        name_ar: product.name || prev.name_ar,
        sku: barcode,
        category_id: catId || prev.category_id,
        category_name: normalizedCategory || '',
        image_url: product.image || prev.image_url,
      }))

      if (product.image) {
        setImagePreview(product.image)
      }

      // Pré-remplir un variant par défaut
      if (variants.length === 0) {
        setVariants([{
          variant_name: 'وحدة',
          unit_type: 'unit',
          quantity_contained: 1,
          barcode,
          purchase_price: 0,
          price_a: 0,
          price_b: 0,
          price_c: 0,
          price_d: 0,
          price_e: 0,
          stock: 0,
          alert_threshold: 10,
          is_active: true,
          is_default: true,
        }])
      }
    } catch (err: any) {
      console.error('Barcode lookup error:', err)
      setBarcodeLookupError(err?.message || 'Barcode lookup failed')
    } finally {
      setBarcodeLookupLoading(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      // Simuler upload - remplacer par vrai upload si nécessaire
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setImagePreview(result)
        setFormData(prev => ({ ...prev, image_url: result }))
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('❌ حدث خطأ أثناء رفع الصورة')
    } finally {
      setIsUploading(false)
    }
  }

  const parsePrice = (value: string) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }

  const parseQuantity = (value: string) => {
    const n = Number.parseInt(value, 10)
    return Number.isFinite(n) ? n : 0
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const productData: any = {
        name_ar: formData.name_ar,
        sku: formData.sku,
        category_id: formData.category_id || null,
        cost_price: parsePrice(formData.cost_price),
        price_a: parsePrice(formData.price_a),
        price_b: parsePrice(formData.price_b),
        price_c: parsePrice(formData.price_c),
        price_d: parsePrice(formData.price_d),
        price_e: parsePrice(formData.price_e),
        stock: parseQuantity(formData.quantity_in_stock),
        image_url: formData.image_url || null,
        is_active: true,
      }

      const { data: productResult, error } = await supabase
        .from('products')
        .insert([productData])
        .select()
        .single()

      if (error) throw error

      // Ajouter les variants si présents
      if (variants.length > 0 && productResult) {
        const variantsToInsert = variants.map(v => ({
          product_id: productResult.id,
          variant_name: v.variant_name,
          unit_type: v.unit_type,
          quantity_contained: v.quantity_contained,
          barcode: v.barcode,
          purchase_price: v.purchase_price,
          price_a: v.price_a,
          price_b: v.price_b,
          price_c: v.price_c,
          price_d: v.price_d,
          price_e: v.price_e,
          stock: v.stock,
          alert_threshold: v.alert_threshold,
          is_active: v.is_active,
          is_default: v.is_default,
        }))
        
        const { error: variantsError } = await supabase
          .from('product_variants')
          .insert(variantsToInsert)
        
        if (variantsError) {
          console.error('Error saving variants:', variantsError)
        }
      }

      alert('✅ تم إضافة المنتج بنجاح')
      navigate('/employee/products')
    } catch (error) {
      console.error('Error adding product:', error)
      alert(`❌ حدث خطأ: ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
    } finally {
      setLoading(false)
    }
  }

  const addVariant = () => {
    const newVariant: ProductVariant = {
      variant_name: '',
      unit_type: 'unit',
      quantity_contained: 1,
      barcode: Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0'),
      purchase_price: 0,
      price_a: 0,
      price_b: 0,
      price_c: 0,
      price_d: 0,
      price_e: 0,
      stock: 0,
      alert_threshold: 10,
      is_active: true,
      is_default: variants.length === 0,
    }
    setVariants([...variants, newVariant])
  }

  const updateVariant = (index: number, field: keyof ProductVariant, value: any) => {
    const updated = [...variants]
    updated[index] = { ...updated[index], [field]: value }
    
    if (field === 'is_default' && value === true) {
      updated.forEach((v, i) => {
        if (i !== index) v.is_default = false
      })
    }
    
    setVariants(updated)
  }

  const removeVariant = (index: number) => {
    const updated = variants.filter((_, i) => i !== index)
    if (variants[index].is_default && updated.length > 0) {
      updated[0].is_default = true
    }
    setVariants(updated)
  }

  const unitTypes = [
    { value: 'unit', label: 'وحدة' },
    { value: 'kg', label: 'كيلو' },
    { value: 'litre', label: 'لتر' },
    { value: 'carton', label: 'كرتون' },
    { value: 'pack', label: 'باك' },
    { value: 'palette', label: 'بالط' },
    { value: 'sac', label: 'كيس' },
  ]

  return (
    <div className="min-h-screen bg-gray-100 p-4" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate('/employee/products')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} className="text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">إضافة منتج جديد</h1>
          </div>

          {/* Barcode Scanner */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-bold text-gray-700 mb-2">مسح الباركود</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleBarcodeLookup()}
                className="flex-1 p-3 border-2 border-gray-200 rounded-lg"
                placeholder="ادخل أو امسح الباركود..."
              />
              <button
                onClick={() => handleBarcodeLookup()}
                disabled={barcodeLookupLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2"
              >
                <Barcode size={18} />
                {barcodeLookupLoading ? 'جاري البحث...' : 'بحث'}
              </button>
            </div>

            {barcodeLookupError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {barcodeLookupError}
              </div>
            )}

            {barcodeLookupResult && (
              <div className="mt-3 space-y-3">
                <div className="flex gap-3 items-start">
                  {barcodeLookupResult.image ? (
                    <img
                      src={barcodeLookupResult.image}
                      alt={barcodeLookupResult.name}
                      className="w-20 h-20 object-cover rounded-lg border"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg border bg-white flex items-center justify-center">
                      <Package size={22} className="text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{barcodeLookupResult.name || '—'}</p>
                    <p className="text-sm text-gray-600">{barcodeLookupResult.category || '—'}</p>
                    {barcodeLookupResult.size && (
                      <p className="text-xs text-gray-500">Size: {barcodeLookupResult.size}</p>
                    )}
                    {barcodeLookupResult.brand && (
                      <p className="text-xs text-gray-500">{barcodeLookupResult.brand}</p>
                    )}
                  </div>
                </div>
                
                {/* Champ pour modifier le nom de famille */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    تعديل اسم العائلة (si détecté: {barcodeLookupResult.category || '—'})
                  </label>
                  <input
                    type="text"
                    value={formData.category_name || ''}
                    onChange={(e) => {
                      const newCategoryName = e.target.value
                      setFormData(prev => ({ ...prev, category_name: newCategoryName }))
                      if (newCategoryName) {
                        const existing = categories.find(c => c.name_ar === newCategoryName)
                        if (existing) {
                          setFormData(prev => ({ ...prev, category_id: existing.id, category_name: newCategoryName }))
                        }
                      }
                    }}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg"
                    placeholder="ادخل اسم العائلة الصحيح..."
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (formData.category_name) {
                        const catId = await ensureCategoryId(formData.category_name)
                        if (catId) {
                          setFormData(prev => ({ ...prev, category_id: catId }))
                          alert('✅ تم إضافة/تحديث العائلة بنجاح')
                        }
                      }
                    }}
                    className="mt-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                  >
                    تأكيد العائلة
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Product Form */}
          <form onSubmit={handleAddProduct} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">اسم المنتج</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery || formData.name_ar}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setFormData({...formData, name_ar: e.target.value})
                    }}
                    onFocus={() => setSearchQuery(formData.name_ar)}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg"
                    placeholder="ابحث عن اسم منتج موجود أو أدخل اسم جديد..."
                    required
                  />
                  
                  {/* Liste des produits existants */}
                  {showProductList && existingProducts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto z-10">
                      <div className="p-2 bg-gray-50 border-b border-gray-200">
                        <p className="text-xs text-gray-600">اختر منتجًا موجودًا:</p>
                      </div>
                      {existingProducts.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => selectExistingProduct(product)}
                          className="w-full text-right p-3 hover:bg-gray-50 border-b border-gray-100 flex items-center justify-between group"
                        >
                          <div>
                            <p className="font-medium text-gray-800 group-hover:text-blue-600">
                              {product.name_ar}
                            </p>
                            <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                            {product.barcode && (
                              <p className="text-sm text-gray-500">الكود: {product.barcode}</p>
                            )}
                          </div>
                          <Package size={20} className="text-gray-400 group-hover:text-blue-500" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Indicateur de produit sélectionné */}
                {selectedExistingProduct && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">مستند إلى:</span> {selectedExistingProduct.name_ar}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedExistingProduct(null)
                        setSearchQuery('')
                        setFormData({...formData, name_ar: ''})
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">العائلة</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                >
                  <option value="">بدون عائلة</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name_ar}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">SKU</label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({...formData, sku: e.target.value})}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">سعر الشراء</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={(e) => setFormData({...formData, cost_price: e.target.value})}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">سعر الفئة A</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price_a}
                  onChange={(e) => setFormData({...formData, price_a: e.target.value})}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">سعر الفئة B</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price_b}
                  onChange={(e) => setFormData({...formData, price_b: e.target.value})}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">سعر الفئة C</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price_c}
                  onChange={(e) => setFormData({...formData, price_c: e.target.value})}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">سعر الفئة D</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price_d}
                  onChange={(e) => setFormData({...formData, price_d: e.target.value})}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">سعر الفئة E</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price_e}
                  onChange={(e) => setFormData({...formData, price_e: e.target.value})}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الكمية في المخزون</label>
                <input
                  type="number"
                  value={formData.quantity_in_stock}
                  onChange={(e) => setFormData({...formData, quantity_in_stock: e.target.value})}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                />
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">صورة المنتج</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="product-image-upload"
              />
              <label
                htmlFor="product-image-upload"
                className="cursor-pointer bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 w-fit transition-colors"
              >
                <Upload size={18} />
                {isUploading ? 'جاري الرفع...' : 'رفع صورة'}
              </label>
              
              {(imagePreview || formData.image_url) && (
                <div className="mt-4">
                  <img
                    src={imagePreview || formData.image_url}
                    alt="معاينة المنتج"
                    className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200"
                  />
                </div>
              )}
            </div>

            {/* Variants */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">المتغيرات</h3>
                <button
                  type="button"
                  onClick={addVariant}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"
                >
                  <Plus size={18} />
                  إضافة متغير
                </button>
              </div>

              {variants.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-500">لا توجد متغيرات</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {variants.map((variant, index) => (
                    <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-gray-700">المتغير {index + 1}</span>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={variant.is_default}
                              onChange={(e) => updateVariant(index, 'is_default', e.target.checked)}
                              className="w-4 h-4"
                            />
                            افتراضي
                          </label>
                          <button
                            type="button"
                            onClick={() => removeVariant(index)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <AlertCircle size={18} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <input
                          type="text"
                          value={variant.variant_name}
                          onChange={(e) => updateVariant(index, 'variant_name', e.target.value)}
                          className="p-2 border border-gray-200 rounded"
                          placeholder="اسم المتغير"
                        />
                        <select
                          value={variant.unit_type}
                          onChange={(e) => updateVariant(index, 'unit_type', e.target.value)}
                          className="p-2 border border-gray-200 rounded"
                        >
                          {unitTypes.map(type => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={variant.quantity_contained}
                          onChange={(e) => updateVariant(index, 'quantity_contained', parseInt(e.target.value) || 1)}
                          className="p-2 border border-gray-200 rounded"
                          placeholder="الكمية"
                        />
                        <input
                          type="text"
                          value={variant.barcode}
                          onChange={(e) => updateVariant(index, 'barcode', e.target.value)}
                          className="p-2 border border-gray-200 rounded"
                          placeholder="الباركود"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={variant.price_a}
                          onChange={(e) => updateVariant(index, 'price_a', parseFloat(e.target.value) || 0)}
                          className="p-2 border border-gray-200 rounded"
                          placeholder="سعر A"
                        />
                        <input
                          type="number"
                          value={variant.stock}
                          onChange={(e) => updateVariant(index, 'stock', parseInt(e.target.value) || 0)}
                          className="p-2 border border-gray-200 rounded"
                          placeholder="المخزون"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-bold transition-colors"
              >
                {loading ? 'جاري الإضافة...' : 'إضافة المنتج'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
