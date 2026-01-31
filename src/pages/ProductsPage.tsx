import { useEffect, useState, useRef } from 'react'
import { Search, Plus, Package, Edit2, AlertCircle, TrendingUp, Upload, Barcode, Trash2, Box } from 'lucide-react'
import { getCategoryLabelArabic } from '../utils/categoryLabels'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'
import { useInputPad } from '../components/useInputPad'

interface ProductVariant {
  id?: string
  product_id?: string
  primary_variant_id?: string
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

interface ProductPrimaryVariant {
  id?: string
  product_id?: string
  variant_name: string
  barcode: string
  price_a: number
  price_b: number
  price_c: number
  price_d: number
  price_e: number
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
  const [primaryVariants, setPrimaryVariants] = useState<ProductPrimaryVariant[]>([])

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

  // Auto lookup on barcode scan/type in add modal
  useEffect(() => {
    if (!showAddModal) return
    const trimmed = barcodeInput.trim()
    if (trimmed.length < 6) return
    const timeout = setTimeout(() => handleBarcodeLookup(trimmed), 250)
    return () => clearTimeout(timeout)
  }, [barcodeInput, showAddModal])

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

      if (data && data.length > 0) {
        const { data: variants, error: variantsError } = await supabase
          .from('product_variants')
          .select('product_id, unit_type, quantity_contained, stock')
          .eq('is_active', true)
          .in('product_id', data.map(p => p.id))

        if (variantsError) {
          setProducts(data || [])
          return
        }

        const byProduct = new Map<string, any[]>()
        ;(variants || []).forEach(v => {
          const list = byProduct.get(v.product_id) || []
          list.push(v)
          byProduct.set(v.product_id, list)
        })

        const enriched = (data || []).map(p => {
          const vs = byProduct.get(p.id) || []
          const unitV = vs.find(v => v.unit_type === 'unit')
          const cartonV = vs.find(v => v.unit_type === 'carton')
          const unitsPerCarton = cartonV?.quantity_contained ? Number(cartonV.quantity_contained) : 0

          const piecesFromUnit = unitV?.stock !== null && unitV?.stock !== undefined ? Number(unitV.stock) : null
          const piecesFromCarton = cartonV?.stock !== null && cartonV?.stock !== undefined && unitsPerCarton > 0
            ? Number(cartonV.stock) * unitsPerCarton
            : null

          const displayPieces = (typeof piecesFromUnit === 'number' && Number.isFinite(piecesFromUnit))
            ? piecesFromUnit
            : (typeof piecesFromCarton === 'number' && Number.isFinite(piecesFromCarton) ? piecesFromCarton : (p.stock || 0))

          return {
            ...p,
            stock: displayPieces,
          }
        })

        console.log('Stock examples:', enriched?.slice(0, 3).map(p => ({ name: p.name_ar, stock: p.stock })))
        setProducts(enriched)
      } else {
        console.log('Stock examples:', data?.slice(0, 3).map(p => ({ name: p.name_ar, stock: p.stock })))
        setProducts(data || [])
      }
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    setSelectedProduct(null)
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
    setPrimaryVariants([])
    setImagePreview('')
    setBarcodeInput('')
    setBarcodeLookupError(null)
    setBarcodeLookupResult(null)
    setShowAddModal(true)
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

      setFormData((prev) => ({
        ...prev,
        name_ar: product.name || prev.name_ar,
        sku: barcode,
        // category_id intentionally left as-is (filled later from purchases)
        image_url: product.image || prev.image_url,
      }))

      // Set image preview if image found from barcode lookup
      if (product.image) {
        setImagePreview(product.image)
      }
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
      const packagingManagedByPurchases = true
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

      {
        const { data: existingPrimary } = await supabase
          .from('product_primary_variants')
          .select('id')
          .eq('product_id', selectedProduct.id)

        const existingIds = (existingPrimary || []).map((v: any) => v.id)
        const currentIds = primaryVariants.filter(v => v.id).map(v => v.id)

        const toDelete = existingIds.filter((id: string) => !currentIds.includes(id))
        if (toDelete.length > 0) {
          await supabase
            .from('product_primary_variants')
            .update({ is_active: false, is_default: false })
            .in('id', toDelete)
        }

        const activePrimary = primaryVariants.filter(v => v.is_active !== false)
        const normalizedPrimary = activePrimary.length > 0
          ? (() => {
              const hasDefault = activePrimary.some(v => v.is_default)
              if (hasDefault) return activePrimary
              const copy = [...activePrimary]
              copy[0] = { ...copy[0], is_default: true }
              return copy
            })()
          : [{
              variant_name: 'افتراضي',
              barcode: String(formData.sku || '').trim() || generateBarcode(),
              price_a: parsePrice(formData.price_a),
              price_b: parsePrice(formData.price_b),
              price_c: parsePrice(formData.price_c),
              price_d: parsePrice(formData.price_d),
              price_e: parsePrice(formData.price_e),
              is_active: true,
              is_default: true,
            } as ProductPrimaryVariant]

        for (const pv of normalizedPrimary.filter(v => v.id)) {
          await supabase
            .from('product_primary_variants')
            .update({
              variant_name: pv.variant_name,
              barcode: pv.barcode,
              price_a: pv.price_a,
              price_b: pv.price_b,
              price_c: pv.price_c,
              price_d: pv.price_d,
              price_e: pv.price_e,
              is_active: pv.is_active,
              is_default: pv.is_default,
            })
            .eq('id', pv.id)
        }

        const newPrimary = normalizedPrimary.filter(v => !v.id)
        if (newPrimary.length > 0) {
          await supabase
            .from('product_primary_variants')
            .insert(
              newPrimary.map(v => ({
                product_id: selectedProduct.id,
                variant_name: v.variant_name,
                barcode: v.barcode,
                price_a: v.price_a,
                price_b: v.price_b,
                price_c: v.price_c,
                price_d: v.price_d,
                price_e: v.price_e,
                is_active: v.is_active,
                is_default: v.is_default,
              }))
            )
        }
      }

      // Handle variants: delete removed, update existing, insert new
      // First, get current variants from DB to compare
      if (!packagingManagedByPurchases) {
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
      }

      // Synchroniser le prix d'achat du produit principal avec les variants
      const productCostPrice = parsePrice(formData.cost_price)
      if (!packagingManagedByPurchases) {
        if (productCostPrice > 0) {
          await supabase
            .from('product_variants')
            .update({ purchase_price: productCostPrice })
            .eq('product_id', selectedProduct.id)
        }
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
      setPrimaryVariants([])
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

    try {
      const { data: primaryData, error: primaryError } = await supabase
        .from('product_primary_variants')
        .select('id, product_id, variant_name, barcode, price_a, price_b, price_c, price_d, price_e, is_active, is_default')
        .eq('product_id', product.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })

      if (!primaryError && primaryData) {
        const normalized = (primaryData as any[]).map(v => ({
          ...v,
          is_active: v.is_active !== false,
          is_default: Boolean(v.is_default),
        })) as ProductPrimaryVariant[]
        if (normalized.length > 0 && !normalized.some(v => v.is_default)) {
          const withDefault = [...normalized]
          withDefault[0] = { ...withDefault[0], is_default: true }
          setPrimaryVariants(withDefault)
        } else {
          setPrimaryVariants(normalized)
        }
      } else {
        setPrimaryVariants([])
      }
    } catch (err) {
      console.error('Error loading primary variants:', err)
      setPrimaryVariants([])
    }
    
    // Load variants for this product
    try {
      const { data: variantsData, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', product.id)
        .order('is_default', { ascending: false })
      
      if (!error && variantsData) {
        const filtered = variantsData.filter(v => {
          if (v.unit_type !== 'kilo') return true
          const qc = v.quantity_contained === null || v.quantity_contained === undefined ? null : Number(v.quantity_contained)
          if (!qc) return true
          return !(qc > 0 && qc < 1)
        })

        const normalized = filtered.map(v => {
          if (v.unit_type === 'kilo' && v.quantity_contained && (!v.variant_name || v.variant_name === 'kilo')) {
            return {
              ...v,
              variant_name: `${v.quantity_contained}`
            }
          }
          return v
        })

        if (normalized.length > 0 && !normalized.some(v => v.is_default)) {
          const withDefault = [...normalized]
          withDefault[0] = { ...withDefault[0], is_default: true }
          setVariants(withDefault)
        } else {
          setVariants(normalized)
        }
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

  const addPrimaryVariant = () => {
    const newVariant: ProductPrimaryVariant = {
      variant_name: '',
      barcode: generateBarcode(),
      price_a: parsePrice(formData.price_a),
      price_b: parsePrice(formData.price_b),
      price_c: parsePrice(formData.price_c),
      price_d: parsePrice(formData.price_d),
      price_e: parsePrice(formData.price_e),
      is_active: true,
      is_default: primaryVariants.length === 0,
    }
    setPrimaryVariants([...primaryVariants, newVariant])
  }

  const updatePrimaryVariant = (index: number, field: keyof ProductPrimaryVariant, value: any) => {
    const updated = [...primaryVariants]
    updated[index] = { ...updated[index], [field]: value }
    if (field === 'is_default' && value === true) {
      updated.forEach((v, i) => {
        if (i !== index) v.is_default = false
      })
    }
    setPrimaryVariants(updated)
  }

  const removePrimaryVariant = (index: number) => {
    const updated = primaryVariants.filter((_, i) => i !== index)
    if (primaryVariants[index]?.is_default && updated.length > 0) {
      updated[0] = { ...updated[0], is_default: true }
    }
    setPrimaryVariants(updated)
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
    { value: 'kilo', label: 'كيلو' },
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
      const packagingManagedByPurchases = true
      // Prevent duplicate SKU
      const skuToCheck = String(formData.sku || '').trim()
      if (skuToCheck) {
        const { data: existingSku } = await supabase
          .from('products')
          .select('id')
          .eq('sku', skuToCheck)
          .maybeSingle()

        if (existingSku) {
          alert('❌ هذا الكود موجود مسبقًا، يرجى اختيار كود/باركود آخر')
          return
        }
      }

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

      const activePrimary = primaryVariants.filter(v => v.is_active !== false)
      const normalizedPrimary = activePrimary.length > 0
        ? (() => {
            const hasDefault = activePrimary.some(v => v.is_default)
            if (hasDefault) return activePrimary
            const copy = [...activePrimary]
            copy[0] = { ...copy[0], is_default: true }
            return copy
          })()
        : [{
            variant_name: 'افتراضي',
            barcode: String(formData.sku || '').trim() || generateBarcode(),
            price_a: parsePrice(formData.price_a),
            price_b: parsePrice(formData.price_b),
            price_c: parsePrice(formData.price_c),
            price_d: parsePrice(formData.price_d),
            price_e: parsePrice(formData.price_e),
            is_active: true,
            is_default: true,
          } as ProductPrimaryVariant]

      if (productResult?.id && normalizedPrimary.length > 0) {
        await supabase
          .from('product_primary_variants')
          .insert(
            normalizedPrimary.map(v => ({
              product_id: productResult.id,
              variant_name: v.variant_name,
              barcode: v.barcode,
              price_a: v.price_a,
              price_b: v.price_b,
              price_c: v.price_c,
              price_d: v.price_d,
              price_e: v.price_e,
              is_active: v.is_active,
              is_default: v.is_default,
            }))
          )
      }
      
      // Save variants if any
      if (!packagingManagedByPurchases) {
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
      setPrimaryVariants([])
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
          <Package size={32} />
          إدارة المنتجات
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
            onClick={openAddModal}
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
                        <button
                          onClick={() => openEditModal(product)}
                          className="text-right w-full"
                        >
                          <p className="font-bold text-gray-800 hover:text-purple-700 underline-offset-4 hover:underline">
                            {product.name_ar}
                          </p>
                          {product.sku && (
                            <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                          )}
                        </button>
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
                        <div className="flex items-center gap-2">
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
                          </div>
                          <div className="bg-gray-100 text-gray-500 px-3 py-2 rounded-lg text-sm font-bold" title="المخزون يُحدَّث تلقائياً من فواتير الشراء">
                            <Package size={14} className="inline mr-1" />
                            المخزون من المشتريات فقط
                          </div>
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

      {/* Modal إضافة مخزون désactivée (mise à jour depuis المشتريات) */}

      {/* Modal Ajout Produit */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => { setShowAddModal(false); setVariants([]); setPrimaryVariants([]); }}>
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-6">إضافة منتج جديد</h3>

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">اسم المنتج</label>
                  <input
                    type="text"
                    value={formData.name_ar}
                    onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">الباركود / الكود</label>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={formData.sku || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, sku: e.target.value })
                      setBarcodeInput(e.target.value)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleBarcodeLookup(e.currentTarget.value)
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">العائلة</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">بدون عائلة</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name_ar}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">صورة المنتج</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="flex-1"
                    />
                    {imagePreview && <img src={imagePreview} alt="preview" className="w-12 h-12 object-cover rounded border" />}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {(['price_a','price_b','price_c','price_d','price_e'] as const).map((field, idx) => (
                  <div key={field}>
                    <label className="block text-xs font-bold text-gray-600 mb-1">سعر {getCategoryLabelArabic(String.fromCharCode(65 + idx) as any)}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={(formData as any)[field] ?? ''}
                      onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">سعر الشراء (محسوب من المشتريات)</label>
                  <input
                    type="text"
                    value={formData.cost_price || '0'}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">المخزون (يُحدَّث من المشتريات)</label>
                  <input
                    type="text"
                    value={formData.quantity_in_stock || ''}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Box size={20} />
                  المتغيرات الأساسية
                </h4>
                <button
                  type="button"
                  onClick={addPrimaryVariant}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"
                >
                  <Plus size={18} />
                  إضافة متغير أساسي
                </button>
              </div>

              {primaryVariants.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Box size={48} className="mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-500 mb-2">لا توجد متغيرات أساسية</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {primaryVariants.filter(pv => pv.is_active !== false).map((pv, index) => (
                    <div key={pv.id || index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-gray-700">المتغير {index + 1} {pv.id ? '(محفوظ)' : '(جديد)'}</span>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={pv.is_default}
                              onChange={(e) => updatePrimaryVariant(index, 'is_default', e.target.checked)}
                              className="w-4 h-4"
                            />
                            افتراضي
                          </label>
                          <button
                            type="button"
                            onClick={() => removePrimaryVariant(index)}
                            className="text-red-500 hover:text-red-700 p-1"
                            disabled={primaryVariants.length <= 1}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">اسم المتغير</label>
                          <input
                            type="text"
                            value={pv.variant_name}
                            onChange={(e) => updatePrimaryVariant(index, 'variant_name', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="لون / حجم / ذوق..."
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">الباركود</label>
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={pv.barcode}
                              onChange={(e) => updatePrimaryVariant(index, 'barcode', e.target.value)}
                              className="flex-1 p-2 border border-gray-300 rounded-lg text-sm"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => updatePrimaryVariant(index, 'barcode', generateBarcode())}
                              className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg"
                              title="توليد كود"
                            >
                              <Barcode size={16} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
                        {(['price_a','price_b','price_c','price_d','price_e'] as const).map((field, idx) => (
                          <div key={field}>
                            <label className="block text-xs font-bold text-gray-600 mb-1">سعر {getCategoryLabelArabic(String.fromCharCode(65 + idx) as any)}</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={(pv as any)[field] ?? 0}
                              onChange={(e) => updatePrimaryVariant(index, field as any, parseFloat(e.target.value) || 0)}
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                وحدات البيع (وحدة/كرتون/كيلو) تُنشأ وتُحدَّث من صفحة المشتريات.
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold"
                >
                  حفظ المنتج
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setVariants([]); setPrimaryVariants([]); }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => { setShowEditProductModal(false); setVariants([]); setPrimaryVariants([]); }}>
          <div className="bg-white rounded-xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-6">تعديل المنتج</h3>
            
            <form onSubmit={handleEditProduct} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">سعر الشراء (محسوب من المشتريات)</label>
                  <input
                    type="text"
                    value={formData.cost_price || '0'}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">المخزون (يُحدَّث من المشتريات)</label>
                  <input
                    type="text"
                    value={formData.quantity_in_stock}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                  />
                </div>
                <div className="col-span-full">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <Box size={20} />
                      المتغيرات الأساسية
                    </h4>
                    <button
                      type="button"
                      onClick={addPrimaryVariant}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"
                    >
                      <Plus size={18} />
                      إضافة متغير أساسي
                    </button>
                  </div>

                  {primaryVariants.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <Box size={48} className="mx-auto text-gray-400 mb-3" />
                      <p className="text-gray-500 mb-2">لا توجد متغيرات أساسية</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {primaryVariants.filter(pv => pv.is_active !== false).map((pv, index) => {
                        const packaging = variants.filter(v => {
                          if (pv.id && v.primary_variant_id) return v.primary_variant_id === pv.id
                          if (!v.primary_variant_id && pv.is_default) return true
                          return false
                        })

                        return (
                          <div key={pv.id || index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-bold text-gray-700">المتغير {index + 1}</span>
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={pv.is_default}
                                    onChange={(e) => updatePrimaryVariant(index, 'is_default', e.target.checked)}
                                    className="w-4 h-4"
                                  />
                                  افتراضي
                                </label>
                                <button
                                  type="button"
                                  onClick={() => removePrimaryVariant(index)}
                                  className="text-red-500 hover:text-red-700 p-1"
                                  disabled={primaryVariants.length <= 1}
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">اسم المتغير</label>
                                <input
                                  type="text"
                                  value={pv.variant_name}
                                  onChange={(e) => updatePrimaryVariant(index, 'variant_name', e.target.value)}
                                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                                  placeholder="لون / حجم / ذوق..."
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">الباركود</label>
                                <div className="flex gap-1">
                                  <input
                                    type="text"
                                    value={pv.barcode}
                                    onChange={(e) => updatePrimaryVariant(index, 'barcode', e.target.value)}
                                    className="flex-1 p-2 border border-gray-300 rounded-lg text-sm"
                                    required
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updatePrimaryVariant(index, 'barcode', generateBarcode())}
                                    className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg"
                                    title="توليد كود"
                                  >
                                    <Barcode size={16} />
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
                              {(['price_a','price_b','price_c','price_d','price_e'] as const).map((field, idx) => (
                                <div key={field}>
                                  <label className="block text-xs font-bold text-gray-600 mb-1">سعر {getCategoryLabelArabic(String.fromCharCode(65 + idx) as any)}</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={(pv as any)[field] ?? 0}
                                    onChange={(e) => updatePrimaryVariant(index, field as any, parseFloat(e.target.value) || 0)}
                                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                                  />
                                </div>
                              ))}
                            </div>

                            <div className="mt-4 border border-gray-200 rounded-lg bg-white p-3">
                              <div className="font-bold text-gray-700 mb-2">وحدات البيع</div>
                              {packaging.length === 0 ? (
                                <div className="text-sm text-gray-500">لا توجد وحدات بيع لهذا المتغير</div>
                              ) : (
                                <div className="space-y-2">
                                  {packaging.map((v, vi) => (
                                    <div key={v.id || vi} className="grid grid-cols-2 md:grid-cols-7 gap-2 text-sm bg-gray-50 border border-gray-200 rounded p-2">
                                      <div className="col-span-2 md:col-span-2">
                                        <div className="text-xs text-gray-500">الاسم</div>
                                        <div className="font-semibold text-gray-800">{v.variant_name}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-gray-500">الوحدة</div>
                                        <div className="text-gray-800">{v.unit_type}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-gray-500">المحتوى</div>
                                        <div className="text-gray-800">{v.quantity_contained}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-gray-500">سعر الشراء</div>
                                        <div className="text-gray-800">{Number(v.purchase_price ?? 0).toFixed(2)}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-gray-500">الباركود</div>
                                        <div className="text-gray-800">{v.barcode || '-'}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs text-gray-500">المخزون</div>
                                        <div className="text-gray-800">{v.stock}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
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
                  onClick={() => { setShowEditProductModal(false); setVariants([]); setPrimaryVariants([]); }}
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
