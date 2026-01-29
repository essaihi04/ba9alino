import { useEffect, useState, useRef } from 'react'
import { Search, Plus, Package, Edit2, AlertCircle, TrendingUp, Upload, Barcode, Trash2, Box } from 'lucide-react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'
import { useInputPad } from '../components/useInputPad'

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

interface Product {
  id: string
  name_ar: string
  sku: string
  cost_price?: number
  price_a: number
  price_b: number
  price_c: number
  price_d: number
  price_e: number
  stock: number
  category_id?: string
  image_url?: string
  created_at?: string
  weight?: number
  weight_unit?: string
  variants?: ProductVariant[]
}

interface Category {
  id: string
  name_ar: string
  name_en?: string
  description_ar?: string
  description_en?: string
}

export default function ProductsPage() {
  const inputPad = useInputPad()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditProductModal, setShowEditProductModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [stockQuantity, setStockQuantity] = useState('')
  const [formData, setFormData] = useState({
    name_ar: '',
    sku: '',
    category_id: '',
    category_name: '', // Ajout pour la modification de catégorie lors du scan
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

  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeLookupLoading, setBarcodeLookupLoading] = useState(false)
  const [barcodeLookupError, setBarcodeLookupError] = useState<string | null>(null)
  const [barcodeLookupResult, setBarcodeLookupResult] = useState<null | {
    name: string
    category: string
    image: string
    brand?: string
    size?: string
  }>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const barcodeInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    loadProducts()
    loadCategories()
  }, [])

  // Recharger les données lorsque la page devient visible (après retour d'une autre page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Page became visible, reloading products...')
        loadProducts()
      }
    }

    const handleFocus = () => {
      console.log('Page gained focus, reloading products...')
      loadProducts()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  useEffect(() => {
    if (!showAddModal) return
    // autofocus for USB barcode scanners (they type then press Enter)
    setTimeout(() => barcodeInputRef.current?.focus(), 50)
  }, [showAddModal])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ar, sku, cost_price, price_a, price_b, price_c, price_d, price_e, stock, category_id, image_url, created_at, weight, weight_unit')
        .eq('is_active', true)
        .order('name_ar', { ascending: true })

      if (error) throw error
      
      console.log('Produits récupérés:', data?.length, 'produits')
      console.log('Stock examples:', data?.slice(0, 3).map(p => ({ name: p.name_ar, stock: p.stock })))
      
      setProducts(data || [])
      
      // Forcer la mise à jour du stock en vérifiant les variants
      if (data && data.length > 0) {
        const { data: variants, error: variantsError } = await supabase
          .from('product_variants')
          .select('product_id, stock')
          .in('product_id', data.map(p => p.id))
        
        if (!variantsError && variants) {
          console.log('Variants stock check:', variants.slice(0, 3))
        }
      }
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
      
      console.log('العائلات récupérées:', data?.length, 'عائلات')
      
      setCategories(data || [])
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const normalizeCategoryName = (name: string) => String(name || '').trim()

  const simplifyAndTranslateCategory = (raw: string) => {
    const input = String(raw || '').trim()
    if (!input) return ''

    // If categories come like "A,B,C", take the last (most specific)
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
      // refresh local list lazily
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
      } catch (openFoodError) {
        console.warn('Open Food Facts API failed:', openFoodError)
        return null
      }
    }

    let edgeProduct: { name: string; category: string; image: string; brand?: string; size?: string } | null = null

    // Try Supabase Edge Function first
    try {
      const { data, error } = await supabase.functions.invoke('go-upc-scrape', {
        body: { barcode }
      })

      if (!error) {
        const ok = Boolean((data as any)?.success)
        if (ok) {
          const p = (data as any)?.product || {}
          edgeProduct = {
            name: String(p?.name || '').trim(),
            category: String(p?.category || '').trim(),
            image: String(p?.image || '').trim(),
            brand: p?.brand ? String(p.brand).trim() : undefined,
            size: p?.size ? String(p.size).trim() : undefined,
          }
        }
      }
    } catch (edgeFunctionError) {
      console.warn('Edge Function failed, trying fallback API:', edgeFunctionError)
    }

    // Always try OpenFoodFacts to get Arabic name if available (no external translation)
    const off = await fetchOpenFoodFacts()
    if (edgeProduct) {
      return {
        ...edgeProduct,
        name: off?.name_ar || edgeProduct.name || off?.name || '',
        category: edgeProduct.category || off?.category || '',
        image: edgeProduct.image || off?.image || '',
        brand: edgeProduct.brand || off?.brand,
        size: edgeProduct.size || off?.size || undefined,
      }
    }

    // If Edge Function fails, fallback to OpenFoodFacts
    if (off) {
      return {
        name: off.name_ar || off.name || '',
        category: off.category || '',
        image: off.image || '',
        brand: off.brand,
        size: off.size || undefined,
      }
    }

    // Second fallback: UPCItemDB API
    try {
      const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`)
      if (response.ok) {
        const data = await response.json()
        if (data.code === 'OK' && data.items && data.items.length > 0) {
          const item = data.items[0]
          return {
            name: String(item.title || '').trim(),
            category: String(item.category || '').trim(),
            image: String(item.image || '').trim(),
            brand: item.brand ? String(item.brand).trim() : undefined,
            size: undefined,
          }
        }
      }
    } catch (upcItemError) {
      console.warn('UPCItemDB API failed:', upcItemError)
    }

    // If all APIs fail, throw error
    throw new Error('Product not found in any database')
  }

  const parseSizeToVariantFields = (size?: string): { unit_type: string; quantity_contained: number; variant_name: string } => {
    const raw = String(size || '').trim()
    if (!raw) {
      return { unit_type: 'unit', quantity_contained: 1, variant_name: 'وحدة' }
    }

    const formatQtyAr = (n: number) => {
      const rounded = Math.round(n * 1000) / 1000
      const s = String(rounded)
      const trimmed = s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
      return trimmed.replace('.', ',')
    }

    const toVariantNameAr = (qty: number, unitType: string, original?: string) => {
      if (!Number.isFinite(qty) || qty <= 0) return original || raw
      if (unitType === 'litre') return `الكمية: ${formatQtyAr(qty)} لتر`
      if (unitType === 'kg') return `الكمية: ${formatQtyAr(qty)} كيلو`
      return original || raw
    }

    // Examples: "1 Kg", "1,5 L", "500 g", "330 ml", "1.5L"
    const normalized = raw.replace(/\s+/g, ' ').trim()
    const m = normalized.match(/^\s*([0-9]+(?:[\.,][0-9]+)?)\s*([a-zA-Z]+)\b/)
    if (!m) {
      return { unit_type: 'unit', quantity_contained: 1, variant_name: raw }
    }

    const qtyRaw = String(m[1] || '').replace(',', '.')
    const qty = Number(qtyRaw)
    const unit = String(m[2] || '').toLowerCase()
    if (!Number.isFinite(qty) || qty <= 0) {
      return { unit_type: 'unit', quantity_contained: 1, variant_name: raw }
    }

    // Mass
    if (unit === 'kg' || unit === 'kgs' || unit === 'kilogram' || unit === 'kilograms') {
      return { unit_type: 'kg', quantity_contained: qty, variant_name: toVariantNameAr(qty, 'kg', raw) }
    }
    if (unit === 'g' || unit === 'gr' || unit === 'gram' || unit === 'grams') {
      const kg = qty / 1000
      return { unit_type: 'kg', quantity_contained: kg, variant_name: toVariantNameAr(kg, 'kg', raw) }
    }

    // Volume
    if (unit === 'l' || unit === 'lt' || unit === 'liter' || unit === 'litre' || unit === 'liters' || unit === 'litres') {
      return { unit_type: 'litre', quantity_contained: qty, variant_name: toVariantNameAr(qty, 'litre', raw) }
    }
    if (unit === 'ml') {
      const l = qty / 1000
      return { unit_type: 'litre', quantity_contained: l, variant_name: toVariantNameAr(l, 'litre', raw) }
    }
    if (unit === 'cl') {
      const l = qty / 100
      return { unit_type: 'litre', quantity_contained: l, variant_name: toVariantNameAr(l, 'litre', raw) }
    }
    if (unit === 'dl') {
      const l = qty / 10
      return { unit_type: 'litre', quantity_contained: l, variant_name: toVariantNameAr(l, 'litre', raw) }
    }

    return { unit_type: 'unit', quantity_contained: 1, variant_name: raw }
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
        image_url: product.image || prev.image_url,
      }))

      // Set image preview if image found from barcode lookup
      if (product.image) {
        setImagePreview(product.image)
      }

      // If there are no variants yet, prefill a default variant barcode
      setVariants((prev) => {
        const parsed = parseSizeToVariantFields(product.size)

        if (prev.length === 0) {
          return [
            {
              variant_name: parsed.variant_name,
              unit_type: parsed.unit_type,
              quantity_contained: parsed.quantity_contained,
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
            }
          ]
        }

        // If there's an existing placeholder variant, update it from size
        if (
          prev.length === 1 &&
          prev[0].variant_name === 'وحدة' &&
          prev[0].unit_type === 'unit' &&
          prev[0].quantity_contained === 1
        ) {
          return [
            {
              ...prev[0],
              variant_name: parsed.variant_name,
              unit_type: parsed.unit_type,
              quantity_contained: parsed.quantity_contained,
              barcode: prev[0].barcode || barcode,
            }
          ]
        }

        return prev
      })
    } catch (err: any) {
      console.error('Barcode lookup error:', err)
      setBarcodeLookupError(err?.message || 'Barcode lookup failed')
    } finally {
      setBarcodeLookupLoading(false)
    }
  }

  const filteredProducts = products.filter(product =>
    product.name_ar?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(product => {
    if (selectedCategory === null) return true
    if (selectedCategory === 'no-family') return !product.category_id
    return product.category_id === selectedCategory
  })

  const getStockStatus = (stock: number) => {
    if (stock === 0) {
      return { text: 'نفذ المخزون', color: 'text-red-700 bg-red-100' }
    } else if (stock < 10) {
      return { text: 'منخفض', color: 'text-orange-700 bg-orange-100' }
    } else if (stock < 50) {
      return { text: 'متوسط', color: 'text-yellow-700 bg-yellow-100' }
    } else {
      return { text: 'جيد', color: 'text-green-700 bg-green-100' }
    }
  }

  const handleEditPrice = async () => {
    if (!selectedProduct || !editPrice) return

    try {
      await supabase
        .from('products')
        .update({ price_a: parseFloat(editPrice) })
        .eq('id', selectedProduct.id)

      await loadProducts()
      setShowEditModal(false)
      setSelectedProduct(null)
      setEditPrice('')
      alert('✅ تم تحديث السعر بنجاح')
    } catch (error) {
      console.error('Error updating price:', error)
      alert('❌ حدث خطأ')
    }
  }

  const handleAddStock = async () => {
    if (!selectedProduct || !stockQuantity) return

    try {
      await supabase
        .from('products')
        .update({ 
          stock: selectedProduct.stock + parseInt(stockQuantity)
        })
        .eq('id', selectedProduct.id)

      await loadProducts()
      setShowStockModal(false)
      setSelectedProduct(null)
      setStockQuantity('')
      alert('✅ تم إضافة المخزون بنجاح')
    } catch (error) {
      console.error('Error adding stock:', error)
      alert('❌ حدث خطأ')
    }
  }

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct) return

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
      }

      let { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', selectedProduct.id)

      if (error) {
        const msg = String((error as any)?.message || '')
        const code = String((error as any)?.code || '')
        const missingBarcode = code === '42703' || msg.includes('barcode')
        if (missingBarcode) {
          delete productData.barcode
          const retry = await supabase
            .from('products')
            .update(productData)
            .eq('id', selectedProduct.id)
          error = retry.error
        }
      }

      if (error) throw error

      // Handle variants: delete removed, update existing, insert new
      // First, get current variants from DB to compare
      const { data: existingVariants } = await supabase
        .from('product_variants')
        .select('id')
        .eq('product_id', selectedProduct.id)
      
      const existingIds = (existingVariants || []).map(v => v.id)
      const currentIds = variants.filter(v => v.id).map(v => v.id)
      
      // Delete variants that were removed
      const toDelete = existingIds.filter(id => !currentIds.includes(id))
      if (toDelete.length > 0) {
        await supabase
          .from('product_variants')
          .delete()
          .in('id', toDelete)
      }
      
      // Update existing variants
      for (const variant of variants.filter(v => v.id)) {
        await supabase
          .from('product_variants')
          .update({
            variant_name: variant.variant_name,
            unit_type: variant.unit_type,
            quantity_contained: variant.quantity_contained,
            barcode: variant.barcode,
            purchase_price: variant.purchase_price,
            price_a: variant.price_a,
            price_b: variant.price_b,
            price_c: variant.price_c,
            price_d: variant.price_d,
            price_e: variant.price_e,
            stock: variant.stock,
            alert_threshold: variant.alert_threshold,
            is_active: variant.is_active,
            is_default: variant.is_default,
          })
          .eq('id', variant.id)
      }
      
      // Insert new variants
      const newVariants = variants.filter(v => !v.id)
      if (newVariants.length > 0) {
        const variantsToInsert = newVariants.map(v => ({
          product_id: selectedProduct.id,
          variant_name: v.variant_name,
          unit_type: v.unit_type,
          quantity_contained: v.quantity_contained,
          barcode: v.barcode,
          purchase_price: v.purchase_price || parsePrice(formData.cost_price), // Utiliser le prix d'achat du produit si non défini
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
        
        const { error: insertError } = await supabase
          .from('product_variants')
          .insert(variantsToInsert)
        
        if (insertError) throw insertError
      }

      // Synchroniser le prix d'achat du produit principal avec les variants
      const productCostPrice = parsePrice(formData.cost_price)
      if (productCostPrice > 0) {
        await supabase
          .from('product_variants')
          .update({ purchase_price: productCostPrice })
          .eq('product_id', selectedProduct.id)
      }

      await loadProducts()
      setFormData({
        name_ar: '',
        sku: '',
        category_id: '',
        category_name: '',
        cost_price: '',
        price_a: '',
        price_b: '',
        price_c: '',
        price_d: '',
        price_e: '',
        quantity_in_stock: '0',
        image_url: '',
      })
      setVariants([])
      setImagePreview('')
      alert('✅ تم تحديث المنتج بنجاح')
    } catch (error) {
      console.error('Error updating product:', error)
      alert(`❌ حدث خطأ: ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
    }
  }

  const openEditModal = async (product: Product) => {
    setSelectedProduct(product)
    setFormData({
      name_ar: product.name_ar,
      sku: product.sku,
      category_id: product.category_id || '',
      cost_price: product.cost_price?.toString() || '',
      price_a: product.price_a.toString(),
      price_b: product.price_b.toString(),
      price_c: product.price_c.toString(),
      price_d: product.price_d.toString(),
      price_e: product.price_e.toString(),
      quantity_in_stock: product.stock.toString(),
      image_url: product.image_url || '',
    })
    setImagePreview(product.image_url || '')
    setShowEditProductModal(true)
    
    // Load variants for this product
    try {
      const { data: variantsData, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', product.id)
        .order('is_default', { ascending: false })
      
      if (!error && variantsData) {
        setVariants(variantsData)
      } else {
        setVariants([])
      }
    } catch (err) {
      console.error('Error loading variants:', err)
      setVariants([])
    }
  }

  const generateBarcode = () => {
    return Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0')
  }

  const addVariant = () => {
    const newVariant: ProductVariant = {
      variant_name: '',
      unit_type: 'unit',
      quantity_contained: 1,
      barcode: generateBarcode(),
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
    
    // If setting as default, unset others
    if (field === 'is_default' && value === true) {
      updated.forEach((v, i) => {
        if (i !== index) v.is_default = false
      })
    }
    
    setVariants(updated)
  }

  const removeVariant = (index: number) => {
    const updated = variants.filter((_, i) => i !== index)
    // If removed variant was default, set first one as default
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

  const lowStockCount = products.filter(p => p.stock < 10).length
  const outOfStockCount = products.filter(p => p.stock === 0).length

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
      }

      let { data: productResult, error } = await supabase
        .from('products')
        .insert([productData])
        .select()
        .single()

      if (error) {
        const msg = String((error as any)?.message || '')
        const code = String((error as any)?.code || '')
        const missingBarcode = code === '42703' || msg.includes('barcode')
        if (missingBarcode) {
          delete productData.barcode
          const retry = await supabase
            .from('products')
            .insert([productData])
            .select()
            .single()
          productResult = retry.data
          error = retry.error
        }
      }

      if (error) throw error

      setProducts(prev => [productResult as Product, ...prev])
      
      // Save variants if any
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

      // Reset form
      setFormData({
        name_ar: '',
        sku: '',
        category_id: '',
        category_name: '',
        cost_price: '',
        price_a: '',
        price_b: '',
        price_c: '',
        price_d: '',
        price_e: '',
        quantity_in_stock: '0',
        image_url: '',
      })
      setVariants([])
      setImagePreview('')
      setShowAddModal(false)
      setBarcodeInput('')
      setBarcodeLookupError(null)
      setBarcodeLookupResult(null)
      
      alert('✅ تم إضافة المنتج بنجاح')
      await loadProducts()
    } catch (error) {
      console.error('Error adding product:', error)
      alert(`❌ حدث خطأ: ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
    }
  }

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

      // Skip header row
      const rows = jsonData.slice(1).filter(row => row.length > 0)

      let createdCategories: { [key: string]: string } = {}
      let createdProducts = 0
      let errors = 0

      for (const row of rows) {
        try {
          const family = row[0]?.toString().trim()
          const id = row[1]?.toString().trim()
          const product = row[2]?.toString().trim()
          const priceC = parseFloat(row[3]?.toString().replace(/[^\d.]/g, '')) || 0
          const priceD = parseFloat(row[4]?.toString().replace(/[^\d.]/g, '')) || 0
          const priceE = parseFloat(row[5]?.toString().replace(/[^\d.]/g, '')) || 0
          const priceB = parseFloat(row[6]?.toString().replace(/[^\d.]/g, '')) || 0
          const priceA = parseFloat(row[7]?.toString().replace(/[^\d.]/g, '')) || 0

          if (!family || !id || !product) {
            errors++
            continue
          }

          // Créer ou récupérer la catégorie
          let categoryId = createdCategories[family]
          if (!categoryId) {
            const { data: existingCategory } = await supabase
              .from('product_categories')
              .select('id')
              .eq('name_ar', family)
              .maybeSingle()

            if (existingCategory) {
              categoryId = existingCategory.id
            } else {
              const { data: newCategory } = await supabase
                .from('product_categories')
                .insert({ name_ar: family })
                .select()
                .single()
              categoryId = newCategory?.id
            }
            createdCategories[family] = categoryId
          }

          // Créer le produit
          const productData = {
            name_ar: product,
            sku: id,
            price_a: priceA,
            price_b: priceB,
            price_c: priceC,
            price_d: priceD,
            price_e: priceE,
            stock: 0,
            category_id: categoryId,
          }

          await supabase.from('products').insert(productData)
          createdProducts++
        } catch (error) {
          console.error('Error importing row:', error)
          errors++
        }
      }

      await loadProducts()
      await loadCategories()
      alert(`✅ تم استيراد ${createdProducts} منتج بنجاح${errors > 0 ? ` (${errors} أخطاء)` : ''}`)
    } catch (error) {
      console.error('Error importing Excel:', error)
      alert('❌ حدث خطأ أثناء استيراد الملف')
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Package className="text-white" size={36} />
          المنتجات
        </h1>
        <div className="flex gap-2">
          <label className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex items-center gap-2 cursor-pointer">
            <Upload size={20} />
            استيراد Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              className="hidden"
            />
          </label>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
          >
            <Plus size={20} />
            منتج جديد
          </button>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm mb-1">إجمالي المنتجات</p>
              <p className="text-2xl font-bold">{products.length}</p>
            </div>
            <Package size={32} className="text-purple-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm mb-1">نفذ المخزون</p>
              <p className="text-2xl font-bold">{outOfStockCount}</p>
            </div>
            <AlertCircle size={32} className="text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm mb-1">منخفض المخزون</p>
              <p className="text-2xl font-bold">{lowStockCount}</p>
            </div>
            <TrendingUp size={32} className="text-orange-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm mb-1">متوفر</p>
              <p className="text-2xl font-bold">{products.length - lowStockCount}</p>
            </div>
            <Package size={32} className="text-green-200" />
          </div>
        </div>
      </div>

      {/* العائلات (Catégories) */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">العائلات</h3>
          {selectedCategory && selectedCategory !== 'no-family' && (
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
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            جميع المنتجات ({products.length})
          </button>
          <button
            onClick={() => setSelectedCategory('no-family')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              selectedCategory === 'no-family'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            بدون عائلة ({products.filter(p => !p.category_id).length})
          </button>
          {categories.map((category) => {
            const productCount = products.filter(p => p.category_id === category.id).length
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.name_ar} ({productCount})
              </button>
            )
          })}
        </div>
      </div>

      {/* Recherche */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="ابحث عن منتج..."
              className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => {
              console.log('Manual refresh triggered')
              loadProducts()
            }}
            className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            title="تحديث البيانات"
          >
            <Package size={20} />
            تحديث
          </button>
        </div>
      </div>

      {/* Tableau des produits */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            جاري التحميل...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            لا توجد منتجات
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
                <tr>
                  <th className="px-6 py-4 text-right font-bold">اسم المنتج</th>
                  <th className="px-6 py-4 text-right font-bold">سعر البيع</th>
                  <th className="px-6 py-4 text-right font-bold">المخزون</th>
                  <th className="px-6 py-4 text-right font-bold">حالة المخزون</th>
                  <th className="px-6 py-4 text-right font-bold">القيمة الإجمالية</th>
                  <th className="px-6 py-4 text-right font-bold">إجراءات سريعة</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const stockStatus = getStockStatus(product.stock)
                  const totalValue = product.price_a * product.stock
                  
                  return (
                    <tr
                      key={product.id}
                      className="border-b hover:bg-purple-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-gray-800">{product.name_ar}</p>
                          {product.sku && (
                            <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-800">
                          {product.price_a.toFixed(2)} MAD
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-bold text-lg ${
                          product.stock === 0 ? 'text-red-600' : 
                          product.stock < 10 ? 'text-orange-600' : 'text-green-600'
                        }`}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full font-bold text-sm ${stockStatus.color}`}>
                          {stockStatus.text}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-800">
                          {totalValue.toFixed(2)} MAD
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(product)}
                            className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-2 rounded-lg text-sm font-bold transition-colors"
                          >
                            <Edit2 size={14} />
                            تعديل المنتج
                          </button>
                          <button
                            onClick={() => {
                              setSelectedProduct(product)
                              setEditPrice(product.price_a.toString())
                              setShowEditModal(true)
                            }}
                            className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-2 rounded-lg text-sm font-bold transition-colors"
                          >
                            تعديل السعر
                          </button>
                          <button
                            onClick={() => {
                              setSelectedProduct(product)
                              setStockQuantity('')
                              setShowStockModal(true)
                            }}
                            className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-2 rounded-lg text-sm font-bold transition-colors"
                          >
                            <Package size={14} />
                            إضافة مخزون
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal تعديل السعر */}
      {showEditModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">تعديل سعر المنتج</h3>
            <p className="text-gray-600 mb-4">{selectedProduct.name_ar}</p>
            <button
              type="button"
              onClick={() =>
                inputPad.open({
                  title: 'تعديل السعر',
                  mode: 'decimal',
                  dir: 'ltr',
                  initialValue: editPrice || '0',
                  min: 0,
                  onConfirm: (v) => setEditPrice(v),
                })
              }
              className="w-full p-3 border-2 border-gray-200 rounded-lg mb-4 text-left"
            >
              {editPrice || '0'}
            </button>
            <div className="flex gap-3">
              <button
                onClick={handleEditPrice}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold"
              >
                حفظ
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal إضافة مخزون */}
      {showStockModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowStockModal(false)}>
          <div className="bg-white rounded-xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">إضافة مخزون</h3>
            <p className="text-gray-600 mb-2">{selectedProduct.name_ar}</p>
            <p className="text-sm text-gray-500 mb-4">المخزون الحالي: {selectedProduct.stock}</p>
            <button
              type="button"
              onClick={() =>
                inputPad.open({
                  title: 'كمية المخزون',
                  mode: 'number',
                  dir: 'ltr',
                  initialValue: stockQuantity || '0',
                  onConfirm: (v) => setStockQuantity(v),
                })
              }
              className="w-full p-3 border-2 border-gray-200 rounded-lg mb-4 text-left"
            >
              {stockQuantity || '0'}
            </button>
            <div className="flex gap-3">
              <button
                onClick={handleAddStock}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold"
              >
                إضافة
              </button>
              <button
                onClick={() => setShowStockModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajout Produit */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-6">إضافة منتج جديد</h3>
            
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">مسح الباركود (Go-UPC)</label>
                <div className="flex gap-2">
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleBarcodeLookup()
                      }
                    }}
                    className="flex-1 p-3 border-2 border-gray-200 rounded-lg"
                    placeholder="6111035000058"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => handleBarcodeLookup()}
                    disabled={barcodeLookupLoading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-3 rounded-lg font-bold flex items-center gap-2"
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
                          // Mettre à jour la catégorie sélectionnée si elle existe
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">اسم المنتج</label>
                  <input
                    type="text"
                    value={formData.name_ar}
                    onChange={(e) => setFormData({...formData, name_ar: e.target.value})}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg"
                    required
                  />
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
              </div>

              {/* Section Image */}
              <div className="mt-6 border-t-2 border-gray-200 pt-6">
                <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Upload size={20} />
      📷 صورة المنتج
                </h4>
                
                <div className="space-y-4">
                  {/* Upload Button */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">اختر صورة المنتج</label>
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
                    {isUploading && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-purple-600">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                        جاري رفع الصورة...
                      </div>
                    )}
                  </div>

                  {/* Image Preview */}
                  {(imagePreview || formData.image_url) && (
                    <div className="mt-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">معاينة الصورة</label>
                      <div className="relative inline-block">
                        <img
                          src={imagePreview || formData.image_url}
                          alt="معاينة المنتج"
                          className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImagePreview('')
                            setFormData({ ...formData, image_url: '' })
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg transition-colors"
                          title="حذف الصورة"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">
                        سيتم حفظ الصورة مع المنتج
                      </p>
                    </div>
                  )}

                  {/* Alternative URL Input */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">أو أدخل رابط الصورة مباشرةً</label>
                    <input
                      type="url"
                      value={formData.image_url}
                      onChange={(e) => {
                        setFormData({ ...formData, image_url: e.target.value })
                        if (e.target.value) {
                          setImagePreview(e.target.value)
                        }
                      }}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                </div>
              </div>

              {/* Section Variantes */}
              <div className="mt-6 border-t-2 border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Box size={20} />
                    📦 المتغيرات ووحدات البيع
                  </h4>
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
                    <Box size={48} className="mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-500 mb-2">لا توجد متغيرات</p>
                    <p className="text-sm text-gray-400">أضف متغيرات للمنتج (وحدة، كرتون، باك...)</p>
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
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">اسم المتغير</label>
                            <input
                              type="text"
                              value={variant.variant_name}
                              onChange={(e) => updateVariant(index, 'variant_name', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                              placeholder="وحدة / كرتون 12..."
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">نوع الوحدة</label>
                            <select
                              value={variant.unit_type}
                              onChange={(e) => updateVariant(index, 'unit_type', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                            >
                              {unitTypes.map(ut => (
                                <option key={ut.value} value={ut.value}>{ut.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">الكمية المحتواة</label>
                            <button
                              type="button"
                              onClick={() =>
                                inputPad.open({
                                  title: 'الكمية المحتواة',
                                  mode: 'decimal',
                                  dir: 'ltr',
                                  initialValue: variant.quantity_contained.toString(),
                                  min: 0.001,
                                  step: 0.001,
                                  onConfirm: (v) => updateVariant(index, 'quantity_contained', parseFloat(v) || 1),
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-left"
                            >
                              {variant.quantity_contained}
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">الكود</label>
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={variant.barcode}
                                onChange={(e) => updateVariant(index, 'barcode', e.target.value)}
                                className="flex-1 p-2 border border-gray-300 rounded-lg text-sm"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => updateVariant(index, 'barcode', generateBarcode())}
                                className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg"
                                title="توليد كود"
                              >
                                <Barcode size={16} />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 md:grid-cols-7 gap-3 mt-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">سعر الشراء</label>
                            <button
                              type="button"
                              onClick={() =>
                                inputPad.open({
                                  title: 'سعر الشراء',
                                  mode: 'decimal',
                                  dir: 'ltr',
                                  initialValue: variant.purchase_price.toString(),
                                  min: 0,
                                  onConfirm: (v) => updateVariant(index, 'purchase_price', parseFloat(v) || 0),
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-left"
                            >
                              {variant.purchase_price}
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">سعر A</label>
                            <button
                              type="button"
                              onClick={() =>
                                inputPad.open({
                                  title: 'السعر A',
                                  mode: 'decimal',
                                  dir: 'ltr',
                                  initialValue: variant.price_a.toString(),
                                  min: 0,
                                  onConfirm: (v) => updateVariant(index, 'price_a', parseFloat(v) || 0),
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-left"
                            >
                              {variant.price_a}
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">سعر B</label>
                            <button
                              type="button"
                              onClick={() =>
                                inputPad.open({
                                  title: 'السعر B',
                                  mode: 'decimal',
                                  dir: 'ltr',
                                  initialValue: variant.price_b.toString(),
                                  min: 0,
                                  onConfirm: (v) => updateVariant(index, 'price_b', parseFloat(v) || 0),
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-left"
                            >
                              {variant.price_b}
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">سعر C</label>
                            <button
                              type="button"
                              onClick={() =>
                                inputPad.open({
                                  title: 'السعر C',
                                  mode: 'decimal',
                                  dir: 'ltr',
                                  initialValue: variant.price_c.toString(),
                                  min: 0,
                                  onConfirm: (v) => updateVariant(index, 'price_c', parseFloat(v) || 0),
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-left"
                            >
                              {variant.price_c}
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">سعر D</label>
                            <button
                              type="button"
                              onClick={() =>
                                inputPad.open({
                                  title: 'السعر D',
                                  mode: 'decimal',
                                  dir: 'ltr',
                                  initialValue: variant.price_d.toString(),
                                  min: 0,
                                  onConfirm: (v) => updateVariant(index, 'price_d', parseFloat(v) || 0),
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-left"
                            >
                              {variant.price_d}
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">سعر E</label>
                            <button
                              type="button"
                              onClick={() =>
                                inputPad.open({
                                  title: 'السعر E',
                                  mode: 'decimal',
                                  dir: 'ltr',
                                  initialValue: variant.price_e.toString(),
                                  min: 0,
                                  onConfirm: (v) => updateVariant(index, 'price_e', parseFloat(v) || 0),
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-left"
                            >
                              {variant.price_e}
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">المخزون</label>
                            <button
                              type="button"
                              onClick={() =>
                                inputPad.open({
                                  title: 'المخزون',
                                  mode: 'number',
                                  dir: 'ltr',
                                  initialValue: variant.stock.toString(),
                                  onConfirm: (v) => updateVariant(index, 'stock', parseFloat(v) || 0),
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-left"
                            >
                              {variant.stock}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold"
                >
                  إضافة المنتج
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setVariants([]); }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal تعديل المنتج */}
      {showEditProductModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowEditProductModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-6">تعديل المنتج</h3>
            
            <form onSubmit={handleEditProduct} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">اسم المنتج</label>
                  <input
                    type="text"
                    value={formData.name_ar}
                    onChange={(e) => setFormData({...formData, name_ar: e.target.value})}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg"
                    required
                  />
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
              </div>

              {/* Section Variantes Edit */}
              <div className="mt-6 border-t-2 border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Box size={20} />
                    📦 المتغيرات ووحدات البيع
                  </h4>
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
                    <Box size={48} className="mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-500 mb-2">لا توجد متغيرات</p>
                    <p className="text-sm text-gray-400">أضف متغيرات للمنتج (وحدة، كرتون، باك...)</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {variants.map((variant, index) => (
                      <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-gray-700">المتغير {index + 1} {variant.id ? '(محفوظ)' : '(جديد)'}</span>
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
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">اسم المتغير</label>
                            <input
                              type="text"
                              value={variant.variant_name}
                              onChange={(e) => updateVariant(index, 'variant_name', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                              placeholder="وحدة / كرتون 12..."
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">نوع الوحدة</label>
                            <select
                              value={variant.unit_type}
                              onChange={(e) => updateVariant(index, 'unit_type', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                            >
                              {unitTypes.map(ut => (
                                <option key={ut.value} value={ut.value}>{ut.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">الكمية المحتواة</label>
                            <button
                              type="button"
                              onClick={() =>
                                inputPad.open({
                                  title: 'الكمية المحتواة',
                                  mode: 'decimal',
                                  dir: 'ltr',
                                  initialValue: variant.quantity_contained.toString(),
                                  min: 0.001,
                                  step: 0.001,
                                  onConfirm: (v) => updateVariant(index, 'quantity_contained', parseFloat(v) || 1),
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-left"
                            >
                              {variant.quantity_contained}
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">الكود</label>
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={variant.barcode}
                                onChange={(e) => updateVariant(index, 'barcode', e.target.value)}
                                className="flex-1 p-2 border border-gray-300 rounded-lg text-sm"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => updateVariant(index, 'barcode', generateBarcode())}
                                className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg"
                                title="توليد كود"
                              >
                                <Barcode size={16} />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 md:grid-cols-7 gap-3 mt-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">سعر الشراء</label>
                            <button
                              type="button"
                              onClick={() =>
                                inputPad.open({
                                  title: 'سعر الشراء',
                                  mode: 'decimal',
                                  dir: 'ltr',
                                  initialValue: variant.purchase_price.toString(),
                                  min: 0,
                                  onConfirm: (v) => updateVariant(index, 'purchase_price', parseFloat(v) || 0),
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-left"
                            >
                              {variant.purchase_price}
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">سعر A</label>
                            <button
                              type="button"
                              onClick={() =>
                                inputPad.open({
                                  title: 'السعر A',
                                  mode: 'decimal',
                                  dir: 'ltr',
                                  initialValue: variant.price_a.toString(),
                                  min: 0,
                                  onConfirm: (v) => updateVariant(index, 'price_a', parseFloat(v) || 0),
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-left"
                            >
                              {variant.price_a}
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">سعر B</label>
                            <button
                              type="button"
                              onClick={() =>
                                inputPad.open({
                                  title: 'السعر B',
                                  mode: 'decimal',
                                  dir: 'ltr',
                                  initialValue: variant.price_b.toString(),
                                  min: 0,
                                  onConfirm: (v) => updateVariant(index, 'price_b', parseFloat(v) || 0),
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-left"
                            >
                              {variant.price_b}
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">سعر C</label>
                            <button
                              type="button"
                              onClick={() =>
                                inputPad.open({
                                  title: 'السعر C',
                                  mode: 'decimal',
                                  dir: 'ltr',
                                  initialValue: variant.price_c.toString(),
                                  min: 0,
                                  onConfirm: (v) => updateVariant(index, 'price_c', parseFloat(v) || 0),
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-left"
                            >
                              {variant.price_c}
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">سعر D</label>
                            <button
                              type="button"
                              onClick={() =>
                                inputPad.open({
                                  title: 'السعر D',
                                  mode: 'decimal',
                                  dir: 'ltr',
                                  initialValue: variant.price_d.toString(),
                                  min: 0,
                                  onConfirm: (v) => updateVariant(index, 'price_d', parseFloat(v) || 0),
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-left"
                            >
                              {variant.price_d}
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">سعر E</label>
                            <button
                              type="button"
                              onClick={() =>
                                inputPad.open({
                                  title: 'السعر E',
                                  mode: 'decimal',
                                  dir: 'ltr',
                                  initialValue: variant.price_e.toString(),
                                  min: 0,
                                  onConfirm: (v) => updateVariant(index, 'price_e', parseFloat(v) || 0),
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-left"
                            >
                              {variant.price_e}
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">المخزون</label>
                            <button
                              type="button"
                              onClick={() =>
                                inputPad.open({
                                  title: 'المخزون',
                                  mode: 'number',
                                  dir: 'ltr',
                                  initialValue: variant.stock.toString(),
                                  onConfirm: (v) => updateVariant(index, 'stock', parseFloat(v) || 0),
                                })
                              }
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm text-left"
                            >
                              {variant.stock}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold"
                >
                  حفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={() => { setShowEditProductModal(false); setVariants([]); }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {inputPad.Modal}
    </div>
  )
}
