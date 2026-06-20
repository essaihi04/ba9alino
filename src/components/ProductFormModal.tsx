import { useEffect, useRef, useState } from 'react'
import { Barcode, Box, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BarcodeScanner } from './BarcodeScanner'
import { getCategoryLabelArabic } from '../utils/categoryLabels'

// =====================================================================
//  ProductFormModal — formulaire d'ajout / modification de produit
//  IDENTIQUE a celui de la page Produits, mais autonome (gere son propre
//  state + logique Supabase) afin d'etre reutilisable depuis la caisse
//  (POSPage) sans quitter l'ecran. La page Produits garde son propre
//  formulaire inline; ce composant en est la version partageable.
// =====================================================================

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

interface Category {
  id: string
  name_ar: string
}

interface ProductFormModalProps {
  isOpen: boolean
  mode: 'add' | 'edit'
  productId?: string
  onClose: () => void
  onSaved?: () => void
}

const emptyForm = {
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

export default function ProductFormModal({ isOpen, mode, productId, onClose, onSaved }: ProductFormModalProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [formData, setFormData] = useState({ ...emptyForm })
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [primaryVariants, setPrimaryVariants] = useState<ProductPrimaryVariant[]>([])
  const [imagePreview, setImagePreview] = useState('')
  const [, setIsUploading] = useState(false)
  const [isSavingProduct, setIsSavingProduct] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [barcodeLookupError, setBarcodeLookupError] = useState<string | null>(null)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const barcodeInputRef = useRef<HTMLInputElement | null>(null)

  // ---- Helpers ------------------------------------------------------
  const generateBarcode = () => Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0')
  const parsePrice = (value: string) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  const parseQuantity = (value: string) => {
    const n = Number.parseInt(value, 10)
    return Number.isFinite(n) ? n : 0
  }

  // ---- Chargement des categories ------------------------------------
  const loadCategories = async () => {
    try {
      const attempt = await supabase
        .from('product_categories')
        .select('*')
        .eq('is_active', true)
        .order('name_ar')
      let data = attempt.data as any[]
      let error = attempt.error
      if (error) {
        const msg = String((error as any)?.message || '')
        const code = String((error as any)?.code || '')
        const missingIsActive = code === '42703' || msg.toLowerCase().includes('is_active')
        if (!missingIsActive) throw error
        const fallback = await supabase.from('product_categories').select('*').order('name_ar')
        data = fallback.data as any[]
        error = fallback.error
      }
      if (error) throw error
      setCategories((data || []) as Category[])
    } catch (err) {
      console.error('Error loading categories:', err)
    }
  }

  // ---- Recherche produit par code-barres (APIs externes) ------------
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
    try {
      const { data, error } = await supabase.functions.invoke('go-upc-scrape', { body: { barcode } })
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
    if (off) {
      return {
        name: off.name_ar || off.name || '',
        category: off.category || '',
        image: off.image || '',
        brand: off.brand,
        size: off.size || undefined,
      }
    }
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
    throw new Error('Product not found in any database')
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('حجم الصورة يجب أن لا يتجاوز 5 ميجابايت')
      return
    }
    try {
      setIsUploading(true)
      const fileName = `products/${Date.now()}-${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: true })
      if (uploadError) {
        console.error('Upload error:', uploadError)
        alert('فشل رفع الصورة. يرجى المحاولة مرة أخرى.')
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(uploadData.path)
      setImagePreview(publicUrl)
      setFormData((prev) => ({ ...prev, image_url: publicUrl }))
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('حدث خطأ أثناء رفع الصورة')
    } finally {
      setIsUploading(false)
    }
  }

  const handleBarcodeLookup = async (barcodeRaw?: string) => {
    const barcode = String(barcodeRaw ?? barcodeInput).trim()
    if (!barcode) return

    // Le produit existe-t-il deja (actif) ?
    try {
      const { data: existing } = await supabase
        .from('products')
        .select('id, is_active')
        .eq('sku', barcode)
        .eq('is_active', true)
        .maybeSingle()
      if (existing) {
        setBarcodeLookupError('هذا المنتج مُسجّل مسبقاً في لائحة المنتجات')
        setBarcodeInput('')
        setFormData((prev) => ({ ...prev, sku: '' }))
        setTimeout(() => barcodeInputRef.current?.focus(), 50)
        return
      }
    } catch (e) {
      console.warn('sku check skipped:', e)
    }

    setBarcodeLookupError(null)
    try {
      const product = await fetchGoUpcProduct(barcode)
      setFormData((prev) => ({
        ...prev,
        name_ar: product.name || prev.name_ar,
        sku: barcode,
        image_url: product.image || prev.image_url,
      }))
      if (product.image) setImagePreview(product.image)
    } catch (err: any) {
      console.error('Barcode lookup error:', err)
      setBarcodeLookupError('لم يتم العثور على المنتج لهذا الباركود')
    }
  }

  // ---- Gestion des variantes ----------------------------------------
  const addPrimaryVariant = () => {
    setPrimaryVariants((prev) => [
      ...prev,
      {
        variant_name: '',
        barcode: generateBarcode(),
        price_a: parsePrice(formData.price_a),
        price_b: parsePrice(formData.price_b),
        price_c: parsePrice(formData.price_c),
        price_d: parsePrice(formData.price_d),
        price_e: parsePrice(formData.price_e),
        is_active: true,
        is_default: prev.length === 0,
      },
    ])
  }

  const updatePrimaryVariant = (index: number, field: keyof ProductPrimaryVariant, value: any) => {
    setPrimaryVariants((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      if (field === 'is_default' && value === true) {
        updated.forEach((v, i) => { if (i !== index) v.is_default = false })
      }
      return updated
    })
  }

  const removePrimaryVariant = (index: number) => {
    setPrimaryVariants((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      if (prev[index]?.is_default && updated.length > 0) {
        updated[0] = { ...updated[0], is_default: true }
      }
      return updated
    })
  }

  const updateVariant = (index: number, field: keyof ProductVariant, value: any) => {
    setVariants((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      if (field === 'is_default' && value === true) {
        updated.forEach((v, i) => { if (i !== index) v.is_default = false })
      }
      return updated
    })
  }

  // ---- Chargement du produit a editer -------------------------------
  const loadProductForEdit = async (id: string) => {
    setLoadingEdit(true)
    try {
      const { data: product, error } = await supabase.from('products').select('*').eq('id', id).single()
      if (error || !product) throw error || new Error('produit introuvable')

      setFormData({
        name_ar: product.name_ar || '',
        sku: product.sku || '',
        category_id: product.category_id || '',
        category_name: '',
        cost_price: product.cost_price?.toString() || '',
        price_a: (product.price_a ?? 0).toString(),
        price_b: (product.price_b ?? 0).toString(),
        price_c: (product.price_c ?? 0).toString(),
        price_d: (product.price_d ?? 0).toString(),
        price_e: (product.price_e ?? 0).toString(),
        quantity_in_stock: (product.stock ?? 0).toString(),
        image_url: product.image_url || '',
      })
      setImagePreview(product.image_url || '')

      let normalizedPrimary: ProductPrimaryVariant[] = []
      try {
        const { data: primaryData, error: primaryError } = await supabase
          .from('product_primary_variants')
          .select('id, product_id, variant_name, barcode, price_a, price_b, price_c, price_d, price_e, is_active, is_default')
          .eq('product_id', id)
          .eq('is_active', true)
          .order('is_default', { ascending: false })
        if (!primaryError && primaryData) {
          normalizedPrimary = (primaryData as any[]).map((v) => ({
            ...v,
            is_active: v.is_active !== false,
            is_default: Boolean(v.is_default),
          })) as ProductPrimaryVariant[]
        }
      } catch (err) {
        console.error('Error loading primary variants:', err)
      }

      let normalizedVariants: ProductVariant[] = []
      try {
        const { data: variantsData, error: vErr } = await supabase
          .from('product_variants')
          .select('*')
          .eq('product_id', id)
          .order('is_default', { ascending: false })
        if (!vErr && variantsData) {
          const filtered = variantsData.filter((v) => {
            if (v.unit_type !== 'kilo') return true
            const qc = v.quantity_contained === null || v.quantity_contained === undefined ? null : Number(v.quantity_contained)
            if (!qc) return true
            return !(qc > 0 && qc < 1)
          })
          normalizedVariants = filtered.map((v) => {
            if (v.unit_type === 'kilo' && v.quantity_contained && (!v.variant_name || v.variant_name === 'kilo')) {
              return { ...v, variant_name: `${v.quantity_contained}` }
            }
            return v
          })
        }
      } catch (err) {
        console.error('Error loading variants:', err)
      }

      if (normalizedPrimary.length === 0 && normalizedVariants.length > 0) {
        const defaultPrimary: ProductPrimaryVariant = {
          variant_name: 'افتراضي',
          barcode: String(product.sku || '').trim() || generateBarcode(),
          price_a: product.price_a ?? 0,
          price_b: product.price_b ?? 0,
          price_c: product.price_c ?? 0,
          price_d: product.price_d ?? 0,
          price_e: product.price_e ?? 0,
          is_active: true,
          is_default: true,
        }
        const { data: createdPrimary, error: createError } = await supabase
          .from('product_primary_variants')
          .insert([{ ...defaultPrimary, product_id: id }])
          .select()
          .single()
        if (!createError && createdPrimary) {
          normalizedPrimary = [{
            ...createdPrimary,
            is_active: createdPrimary.is_active !== false,
            is_default: Boolean(createdPrimary.is_default),
          } as ProductPrimaryVariant]
          const variantIdsToUpdate = normalizedVariants.filter((v) => !v.primary_variant_id && v.id).map((v) => v.id as string)
          if (variantIdsToUpdate.length > 0) {
            await supabase.from('product_variants').update({ primary_variant_id: createdPrimary.id }).in('id', variantIdsToUpdate)
            normalizedVariants = normalizedVariants.map((v) => (v.primary_variant_id ? v : { ...v, primary_variant_id: createdPrimary.id }))
          }
        }
      }

      if (normalizedPrimary.length > 0 && !normalizedPrimary.some((v) => v.is_default)) {
        const withDefault = [...normalizedPrimary]
        withDefault[0] = { ...withDefault[0], is_default: true }
        normalizedPrimary = withDefault
      }
      if (normalizedVariants.length > 0 && !normalizedVariants.some((v) => v.is_default)) {
        const withDefault = [...normalizedVariants]
        withDefault[0] = { ...withDefault[0], is_default: true }
        normalizedVariants = withDefault
      }

      const defaultPrimaryVariant = normalizedPrimary.find((v) => v.is_default) || normalizedPrimary[0]
      if (defaultPrimaryVariant) {
        setFormData((prev) => ({
          ...prev,
          price_a: String(defaultPrimaryVariant.price_a ?? product.price_a ?? 0),
          price_b: String(defaultPrimaryVariant.price_b ?? product.price_b ?? 0),
          price_c: String(defaultPrimaryVariant.price_c ?? product.price_c ?? 0),
          price_d: String(defaultPrimaryVariant.price_d ?? product.price_d ?? 0),
          price_e: String(defaultPrimaryVariant.price_e ?? product.price_e ?? 0),
        }))
      }

      setPrimaryVariants(normalizedPrimary)
      setVariants(normalizedVariants)
    } catch (err) {
      console.error('Error loading product for edit:', err)
      alert('❌ تعذّر تحميل بيانات المنتج')
      onClose()
    } finally {
      setLoadingEdit(false)
    }
  }

  // ---- Sauvegarde : ajout -------------------------------------------
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingProduct(true)
    try {
      const skuToCheck = String(formData.sku || '').trim()
      if (skuToCheck) {
        const { data: existingSku } = await supabase
          .from('products')
          .select('id, is_active')
          .eq('sku', skuToCheck)
          .maybeSingle()
        if (existingSku) {
          if ((existingSku as any).is_active === false) {
            const reactivate = confirm('يوجد منتج مؤرشف بنفس الكود. هل تريد إعادة تفعيله وتحديثه بالبيانات الجديدة؟')
            if (reactivate) {
              const updateData: any = {
                name_ar: formData.name_ar,
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
              const { error: updErr } = await supabase.from('products').update(updateData).eq('id', (existingSku as any).id)
              if (updErr) throw updErr
              await supabase.from('product_primary_variants').update({ is_active: true }).eq('product_id', (existingSku as any).id)
              alert('✅ تم إعادة تفعيل المنتج بنجاح')
              onSaved?.()
              onClose()
              return
            }
            return
          }
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
        is_active: true,
      }

      let { data: productResult, error } = await supabase.from('products').insert([productData]).select().single()
      if (error) {
        const msg = String((error as any)?.message || '')
        const code = String((error as any)?.code || '')
        const missingBarcode = code === '42703' || msg.includes('barcode')
        if (missingBarcode) {
          delete productData.barcode
          const retry = await supabase.from('products').insert([productData]).select().single()
          productResult = retry.data
          error = retry.error
        }
      }
      if (error) throw error

      const activePrimary = primaryVariants.filter((v) => v.is_active !== false)
      const normalizedPrimary = activePrimary.length > 0
        ? (() => {
            const hasDefault = activePrimary.some((v) => v.is_default)
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
        await supabase.from('product_primary_variants').insert(
          normalizedPrimary.map((v) => ({
            product_id: productResult!.id,
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

      alert('✅ تم إضافة المنتج بنجاح')
      onSaved?.()
      onClose()
    } catch (error) {
      console.error('Error adding product:', error)
      alert(`❌ حدث خطأ: ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
    } finally {
      setIsSavingProduct(false)
    }
  }

  // ---- Sauvegarde : modification ------------------------------------
  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productId) return
    setIsSavingProduct(true)
    try {
      const activePrimary = primaryVariants.filter((v) => v.is_active !== false)
      const normalizedPrimary = activePrimary.length > 0
        ? (() => {
            const hasDefault = activePrimary.some((v) => v.is_default)
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

      const defaultPrimaryVariant = normalizedPrimary.find((v) => v.is_default) || normalizedPrimary[0]
      const productData: any = {
        name_ar: formData.name_ar,
        sku: formData.sku,
        category_id: formData.category_id || null,
        cost_price: parsePrice(formData.cost_price),
        price_a: defaultPrimaryVariant?.price_a ?? parsePrice(formData.price_a),
        price_b: defaultPrimaryVariant?.price_b ?? parsePrice(formData.price_b),
        price_c: defaultPrimaryVariant?.price_c ?? parsePrice(formData.price_c),
        price_d: defaultPrimaryVariant?.price_d ?? parsePrice(formData.price_d),
        price_e: defaultPrimaryVariant?.price_e ?? parsePrice(formData.price_e),
        stock: parseQuantity(formData.quantity_in_stock),
        image_url: formData.image_url || null,
      }

      let { error } = await supabase.from('products').update(productData).eq('id', productId)
      if (error) {
        const msg = String((error as any)?.message || '')
        const code = String((error as any)?.code || '')
        const missingBarcode = code === '42703' || msg.includes('barcode')
        if (missingBarcode) {
          delete productData.barcode
          const retry = await supabase.from('products').update(productData).eq('id', productId)
          error = retry.error
        }
      }
      if (error) throw error

      {
        const { data: existingPrimary } = await supabase.from('product_primary_variants').select('id').eq('product_id', productId)
        const existingIds = (existingPrimary || []).map((v: any) => v.id)
        const currentIds = normalizedPrimary.filter((v) => v.id).map((v) => v.id)
        const toDelete = existingIds.filter((id: string) => !currentIds.includes(id))
        if (toDelete.length > 0) {
          await supabase.from('product_primary_variants').update({ is_active: false, is_default: false }).in('id', toDelete)
        }
        for (const pv of normalizedPrimary.filter((v) => v.id)) {
          await supabase.from('product_primary_variants').update({
            variant_name: pv.variant_name,
            barcode: pv.barcode,
            price_a: pv.price_a,
            price_b: pv.price_b,
            price_c: pv.price_c,
            price_d: pv.price_d,
            price_e: pv.price_e,
            is_active: pv.is_active,
            is_default: pv.is_default,
          }).eq('id', pv.id)
        }
        const newPrimary = normalizedPrimary.filter((v) => !v.id)
        if (newPrimary.length > 0) {
          await supabase.from('product_primary_variants').insert(
            newPrimary.map((v) => ({
              product_id: productId,
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

      // Variantes (vendeur): on met a jour le lien primary/unite sans toucher
      // au stock ni au prix d'achat (geres par les achats).
      {
        const { data: existingVariants } = await supabase.from('product_variants').select('id').eq('product_id', productId)
        const existingIds = (existingVariants || []).map((v) => v.id)
        const currentIds = variants.filter((v) => v.id).map((v) => v.id)
        const toDelete = existingIds.filter((id) => !currentIds.includes(id))
        if (toDelete.length > 0) {
          await supabase.from('product_variants').delete().in('id', toDelete)
        }
        for (const variant of variants.filter((v) => v.id)) {
          await supabase.from('product_variants').update({
            variant_name: variant.variant_name,
            unit_type: variant.unit_type,
            quantity_contained: variant.quantity_contained,
            barcode: variant.barcode,
            primary_variant_id: variant.primary_variant_id || null,
            price_a: variant.price_a,
            price_b: variant.price_b,
            price_c: variant.price_c,
            price_d: variant.price_d,
            price_e: variant.price_e,
            alert_threshold: variant.alert_threshold,
            is_active: variant.is_active,
            is_default: variant.is_default,
          }).eq('id', variant.id)
        }
      }

      alert('✅ تم تحديث المنتج بنجاح')
      onSaved?.()
      onClose()
    } catch (error) {
      console.error('Error updating product:', error)
      alert(`❌ حدث خطأ: ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
    } finally {
      setIsSavingProduct(false)
    }
  }

  // ---- Effets d'ouverture -------------------------------------------
  useEffect(() => {
    if (!isOpen) return
    loadCategories()
    setBarcodeInput('')
    setBarcodeLookupError(null)
    if (mode === 'add') {
      setFormData({ ...emptyForm })
      setVariants([])
      setPrimaryVariants([])
      setImagePreview('')
    } else if (mode === 'edit' && productId) {
      loadProductForEdit(productId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, productId])

  if (!isOpen) return null

  const isEdit = mode === 'edit'

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] ${isSavingProduct ? 'pointer-events-none' : ''}`}
      dir="rtl"
      onClick={() => { if (!isSavingProduct) onClose() }}
    >
      <div
        className={`bg-white rounded-xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto relative ${isSavingProduct ? 'opacity-75' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(isSavingProduct || loadingEdit) && (
          <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10 rounded-xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-purple-700 font-bold">{isSavingProduct ? 'جاري الحفظ...' : 'جاري التحميل...'}</p>
            </div>
          </div>
        )}

        <h3 className="text-xl font-bold mb-6">{isEdit ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h3>

        <form onSubmit={isEdit ? handleEditProduct : handleAddProduct} className="space-y-4">
          <div className="sticky top-0 z-20 bg-white py-3 border-b border-gray-200 flex gap-3">
            <button
              type="submit"
              disabled={isSavingProduct}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEdit ? 'حفظ التعديلات' : 'حفظ المنتج'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSavingProduct}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-bold disabled:opacity-50"
            >
              إلغاء
            </button>
          </div>

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
              <div className="flex gap-2">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={formData.sku || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, sku: e.target.value })
                    setBarcodeInput(e.target.value)
                    if (barcodeLookupError) setBarcodeLookupError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (!isEdit) handleBarcodeLookup(e.currentTarget.value)
                    }
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="أدخل الباركود أو الكود"
                />
                <button
                  type="button"
                  onClick={() => setShowBarcodeScanner(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg flex items-center gap-1"
                  title="مسح الباركود بالكاميرا"
                >
                  <Barcode size={18} />
                  <span className="hidden sm:inline text-sm">مسح</span>
                </button>
              </div>
              {barcodeLookupError && <p className="mt-1 text-xs font-semibold text-red-600">{barcodeLookupError}</p>}
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
                <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="flex-1" />
                {imagePreview && <img src={imagePreview} alt="preview" className="w-12 h-12 object-contain rounded border" />}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {(['price_a', 'price_b', 'price_c', 'price_d', 'price_e'] as const).map((field, idx) => (
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
              <label className="block text-sm font-bold text-gray-700 mb-2">المخزون (يُحدَّث من المشتريات)</label>
              <input
                type="text"
                value={formData.quantity_in_stock || ''}
                readOnly
                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mb-2">
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
              {primaryVariants.filter((pv) => pv.is_active !== false).map((pv, index) => {
                const showPrimarySelector = primaryVariants.filter((v) => v.is_active !== false).length > 1
                const hasScopedPackaging = variants.some((v) => Boolean(v.primary_variant_id))
                const packaging = variants.filter((v) => {
                  if (!hasScopedPackaging) return true
                  if (pv.id && v.primary_variant_id) return v.primary_variant_id === pv.id
                  if (!v.primary_variant_id && pv.is_default) return true
                  return false
                })

                return (
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

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3" data-price-grid="true">
                      {(['price_a', 'price_b', 'price_c', 'price_d', 'price_e'] as const).map((field, idx) => (
                        <div key={field}>
                          <label className="block text-xs font-bold text-gray-600 mb-1">سعر {getCategoryLabelArabic(String.fromCharCode(65 + idx) as any)}</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            data-price-input="true"
                            value={(pv as any)[field] === 0 ? '' : ((pv as any)[field] ?? '')}
                            onChange={(e) => {
                              const nextValue = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                              updatePrimaryVariant(index, field as any, nextValue)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                const container = e.currentTarget.closest('[data-price-grid="true"]')
                                const inputs = container?.querySelectorAll<HTMLInputElement>('input[data-price-input="true"]')
                                if (!inputs || inputs.length === 0) return
                                const currentIndex = Array.from(inputs).indexOf(e.currentTarget)
                                const next = inputs[currentIndex + 1]
                                if (next) next.focus()
                              }
                            }}
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                      ))}
                    </div>

                    {isEdit && (
                      <div className="mt-4 border border-gray-200 rounded-lg bg-white p-3">
                        <div className="font-bold text-gray-700 mb-2">وحدات البيع</div>
                        {!variants.some((v) => Boolean(v.primary_variant_id)) && variants.length > 0 && (
                          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-2">
                            ملاحظة: وحدات البيع غير مربوطة بمتغير أساسي لذلك يتم عرضها كـ وحدات عامة.
                          </div>
                        )}
                        {packaging.length === 0 ? (
                          <div className="text-sm text-gray-500">لا توجد وحدات بيع لهذا المتغير</div>
                        ) : (
                          <div className="space-y-2">
                            {packaging.map((v, vi) => (
                              <div
                                key={v.id || vi}
                                className={`grid grid-cols-2 ${showPrimarySelector ? 'md:grid-cols-8' : 'md:grid-cols-7'} gap-2 text-sm bg-gray-50 border border-gray-200 rounded p-2`}
                              >
                                <div className="col-span-2 md:col-span-2">
                                  <div className="text-xs text-gray-500">الاسم</div>
                                  <div className="font-semibold text-gray-800">{v.variant_name}</div>
                                </div>
                                {showPrimarySelector && (
                                  <div>
                                    <div className="text-xs text-gray-500">المتغير الأساسي</div>
                                    <select
                                      value={v.primary_variant_id || ''}
                                      onChange={(e) => {
                                        const next = e.target.value || null
                                        const idx = variants.findIndex((x) => (x.id && v.id ? x.id === v.id : x === v))
                                        if (idx >= 0) updateVariant(idx, 'primary_variant_id', next)
                                      }}
                                      className="w-full p-1 border border-gray-300 rounded bg-white text-gray-800"
                                    >
                                      {primaryVariants.filter((p) => p.is_active !== false).map((p) => (
                                        <option key={p.id || p.variant_name} value={p.id || ''}>{p.variant_name}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                                <div>
                                  <div className="text-xs text-gray-500">الوحدة</div>
                                  <select
                                    value={v.unit_type}
                                    onChange={(e) => {
                                      const idx = variants.findIndex((x) => (x.id && v.id ? x.id === v.id : x === v))
                                      if (idx >= 0) updateVariant(idx, 'unit_type', e.target.value)
                                    }}
                                    className="w-full p-1 border border-gray-300 rounded bg-white text-gray-800"
                                  >
                                    {unitTypes.map((u) => (
                                      <option key={u.value} value={u.value}>{u.label}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500">المحتوى</div>
                                  <input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    value={Number(v.quantity_contained ?? 0)}
                                    onChange={(e) => {
                                      const next = Number(e.target.value)
                                      const idx = variants.findIndex((x) => (x.id && v.id ? x.id === v.id : x === v))
                                      if (idx >= 0) updateVariant(idx, 'quantity_contained', Number.isFinite(next) ? next : 0)
                                    }}
                                    className="w-full p-1 border border-gray-300 rounded bg-white text-gray-800"
                                  />
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
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-4 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
            وحدات البيع (وحدة/كرتون/كيلو) تُنشأ وتُحدَّث من صفحة المشتريات.
          </div>
        </form>
      </div>

      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={(barcode) => {
          setShowBarcodeScanner(false)
          setFormData((prev) => ({ ...prev, sku: barcode }))
          setBarcodeInput(barcode)
          if (barcodeLookupError) setBarcodeLookupError(null)
          if (!isEdit) handleBarcodeLookup(barcode)
        }}
      />
    </div>
  )
}
