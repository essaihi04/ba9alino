import { useEffect, useState } from 'react'
import { Search, Plus, Package, DollarSign, CheckCircle, Truck, AlertCircle, Trash2, X, ShoppingCart } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Supplier {
  id: string
  name_ar: string
  name_en?: string
  contact_person: string
  email: string
  phone: string
  address: string
  created_at?: string
}

interface Product {
  id: string
  name_ar: string
  sku: string
  stock: number
  cost_price?: number
  price_a: number
  category_id?: string
  image_url?: string
}

interface Category {
  id: string
  name_ar: string
}

interface Warehouse {
  id: string
  name: string
  is_active: boolean
}

interface PurchaseItem {
  product_id: string
  product_name_ar?: string
  product_sku?: string
  quantity: number
  unit_price: number
  line_total: number
}

interface Purchase {
  id: string
  purchase_number: string
  supplier_id: string
  supplier?: Supplier
  purchase_date: string
  status: 'pending' | 'received' | 'cancelled'
  items: PurchaseItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  total_amount: number
  payment_type: 'cash' | 'credit' | 'transfer' | 'check'
  payment_status: 'paid' | 'partial' | 'pending'
  paid_amount: number
  remaining_amount: number
  bank_name?: string
  check_number?: string
  check_date?: string
  check_deposit_date?: string
  credit_due_date?: string
  notes?: string
  created_at?: string
}

interface PurchaseFormData {
  supplier_id: string
  warehouse_id: string
  purchase_date: string
  status: 'pending' | 'received' | 'cancelled'
  tax_rate: string
  payment_type: 'cash' | 'credit' | 'transfer' | 'check'
  paid_amount: string
  bank_name: string
  check_number: string
  check_date: string
  check_deposit_date: string
  credit_due_date: string
  notes: string
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([])
  const [formData, setFormData] = useState<PurchaseFormData>({
    supplier_id: '',
    warehouse_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    status: 'received' as 'pending' | 'received' | 'cancelled',
    tax_rate: '0',
    payment_type: 'cash' as 'cash' | 'credit' | 'transfer' | 'check',
    paid_amount: '',
    bank_name: '',
    check_number: '',
    check_date: '',
    check_deposit_date: '',
    credit_due_date: '',
    notes: ''
  })

  useEffect(() => {
    loadPurchases()
    loadProducts()
    loadCategories()
    loadWarehouses()
    loadSuppliers()
  }, [])

  const loadPurchases = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('*, supplier:suppliers(*)')
        .order('purchase_date', { ascending: false })

      if (error) throw error
      setPurchases(data || [])
    } catch (error) {
      console.error('Error loading purchases:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name')

      if (error) throw error

      const list = (data || []) as Warehouse[]
      setWarehouses(list)

      if (!formData.warehouse_id && list.length > 0) {
        setFormData(prev => ({ ...prev, warehouse_id: list[0].id }))
      }
    } catch (error) {
      console.error('Error loading warehouses:', error)
    }
  }

  const loadSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name_ar')

      if (error) throw error
      setSuppliers(data || [])
    } catch (error) {
      console.error('Error loading suppliers:', error)
    }
  }

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ar, sku, stock, cost_price, price_a, category_id')
        .order('name_ar')

      if (error) throw error
      
      console.log('Purchases - Produits récupérés:', data?.length, 'produits')
      
      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('id, name_ar')
        .order('name_ar')

      if (error) throw error
      setCategories((data || []) as Category[])
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const filteredProducts = products
    .filter(p =>
      p.name_ar?.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(productSearchQuery.toLowerCase())
    )
    .filter(p => {
      if (selectedCategory && p.category_id !== selectedCategory) return false
      return true
    })

  const filteredPurchases = purchases.filter(purchase =>
    purchase.items?.some(item => 
      item.product_name_ar?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product_sku?.toLowerCase().includes(searchTerm.toLowerCase())
    ) ||
    purchase.purchase_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.supplier?.name_ar?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return (
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1">
            <CheckCircle size={14} />
            مستلم
          </span>
        )
      case 'pending':
        return (
          <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1">
            <Truck size={14} />
            في الانتظار
          </span>
        )
      case 'cancelled':
        return (
          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1">
            <AlertCircle size={14} />
            ملغي
          </span>
        )
      default:
        return (
          <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-bold text-sm">
            {status}
          </span>
        )
    }
  }

  const handleAddPurchase = async () => {
    if (!formData.product_id || !formData.quantity || !formData.unit_price) {
      alert('يرجى ملء جميع الحقول المطلوبة')
      return
    }

    if (warehouses.length > 0 && !formData.warehouse_id) {
      alert('يرجى اختيار المخزن')
      return
    }

    if (formData.payment_type === 'check') {
      if (!formData.check_number || !formData.check_date || !formData.check_deposit_date) {
        alert('يرجى إدخال رقم الشيك وتاريخ الشيك وتاريخ الإيداع')
        return
      }
    }

    if (formData.payment_type === 'credit') {
      if (!formData.credit_due_date) {
        alert('يرجى إدخال تاريخ استحقاق الدين')
        return
      }
    }

    try {
      const selectedProduct = products.find(p => p.id === formData.product_id)
      if (!selectedProduct) return

      const quantity = parseInt(formData.quantity)
      const unitPrice = parseFloat(formData.unit_price)
      const lineTotal = quantity * unitPrice

      const taxRate = Number(formData.tax_rate || 0)
      const taxAmount = lineTotal * (taxRate / 100)
      const totalAmount = lineTotal + taxAmount

      // 1) Déterminer le fournisseur
      let supplierId: string | null = formData.supplier_id || null

      if (!supplierId) {
        // Fallback: Trouver ou créer un fournisseur par défaut
        const { data: defaultSupplier } = await supabase
          .from('suppliers')
          .select('id')
          .eq('name_ar', 'مورد عام')
          .maybeSingle()

        if (defaultSupplier) {
          supplierId = defaultSupplier.id
        } else {
          const { data: newSupplier } = await supabase
            .from('suppliers')
            .insert({
              name_ar: 'مورد عام',
              name_en: 'General Supplier',
              contact_person: '',
              email: '',
              phone: '',
              address: ''
            })
            .select()
            .single()

          supplierId = newSupplier?.id || null
        }
      }

      if (!supplierId) {
        alert('يرجى اختيار المورد')
        return
      }

      // 2) Paiement initial (pour alimenter أرصدة الموردين عبر supplier_payments)
      const isCredit = formData.payment_type === 'credit'
      const defaultPaid = isCredit ? 0 : totalAmount
      const paidAmountRaw = formData.paid_amount === '' ? defaultPaid : Number(formData.paid_amount)
      const paidAmount = Math.max(0, Math.min(paidAmountRaw, totalAmount))
      const remainingAmount = Math.max(0, totalAmount - paidAmount)
      const paymentStatus = remainingAmount === 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'pending')

      // 3) Créer l'achat dans la base de données
      const purchaseNumber = `ACH-${Date.now()}`

      const purchasePayloadBase: any = {
        purchase_number: purchaseNumber,
        supplier_id: supplierId,
        purchase_date: formData.purchase_date,
        status: formData.status,
        items: [
          {
            product_id: selectedProduct.id,
            product_name_ar: selectedProduct.name_ar,
            product_sku: selectedProduct.sku,
            quantity,
            unit_price: unitPrice,
            line_total: lineTotal
          }
        ],
        subtotal: lineTotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_type: formData.payment_type,
        paid_amount: paidAmount,
        remaining_amount: remainingAmount,
        payment_status: paymentStatus,
        bank_name: formData.payment_type === 'check' ? (formData.bank_name || null) : null,
        check_number: formData.payment_type === 'check' ? (formData.check_number || null) : null,
        check_date: formData.payment_type === 'check' ? (formData.check_date || null) : null,
        check_deposit_date: formData.payment_type === 'check' ? (formData.check_deposit_date || null) : null,
        credit_due_date: formData.payment_type === 'credit' ? (formData.credit_due_date || null) : null,
        notes: formData.notes || null
      }

      let newPurchase: any = null

      // Try to persist warehouse_id if the column exists; fallback safely if it doesn't.
      {
        const payloadWithWarehouse = {
          ...purchasePayloadBase,
          ...(formData.warehouse_id ? { warehouse_id: formData.warehouse_id } : {})
        }

        const firstAttempt = await supabase
          .from('purchases')
          .insert(payloadWithWarehouse)
          .select()
          .single()

        if (firstAttempt.error) {
          const msg = String((firstAttempt.error as any).message || '')
          const isUnknownColumn = msg.toLowerCase().includes('warehouse_id')

          if (!isUnknownColumn) throw firstAttempt.error

          const fallbackAttempt = await supabase
            .from('purchases')
            .insert(purchasePayloadBase)
            .select()
            .single()

          if (fallbackAttempt.error) throw fallbackAttempt.error
          newPurchase = fallbackAttempt.data
        } else {
          newPurchase = firstAttempt.data
        }
      }

      if (!newPurchase) {
        throw new Error('Failed to create purchase')
      }

      // 4) Si paiement initial > 0, créer un enregistrement supplier_payments
      if (paidAmount > 0) {
        const paymentMethod = formData.payment_type === 'credit' ? 'cash' : formData.payment_type
        const { error: paymentErr } = await supabase
          .from('supplier_payments')
          .insert({
            supplier_id: supplierId,
            amount: paidAmount,
            payment_date: formData.purchase_date,
            payment_method: paymentMethod,
            notes: newPurchase?.purchase_number ? `Purchase ${newPurchase.purchase_number}` : 'Purchase payment'
          })

        if (paymentErr) throw paymentErr
      }

      // 5) Mettre à jour le stock global du produit
      const { error: stockError } = await supabase
        .from('products')
        .update({
          stock: selectedProduct.stock + quantity,
          cost_price: unitPrice
        })
        .eq('id', selectedProduct.id)

      if (stockError) throw stockError

      // 5-bis) Mettre à jour le stock du dépôt de façon atomique (évite conflits warehouse_stock_unique)
      // Utilise la fonction SQL apply_stock_movement définie dans database-migrations/multi_warehouses.sql
      if (formData.warehouse_id) {
        const { error: whMoveErr } = await supabase.rpc('apply_stock_movement', {
          p_warehouse_id: formData.warehouse_id,
          p_product_id: selectedProduct.id,
          p_type: 'purchase',
          p_quantity: quantity,
          p_source_reference: newPurchase?.id || null
        })

        if (whMoveErr) throw whMoveErr
      }

      // 6) Recharger les achats pour afficher le nouvel enregistrement
      await loadPurchases()
      await loadProducts()
      await loadSuppliers()

      // 7) Fermer le modal et réinitialiser le formulaire
      setShowAddModal(false)
      setFormData({
        supplier_id: '',
        warehouse_id: warehouses?.[0]?.id || '',
        product_id: '',
        quantity: '',
        unit_price: '',
        purchase_date: new Date().toISOString().split('T')[0],
        status: 'received',
        tax_rate: '0',
        payment_type: 'cash',
        paid_amount: '',
        bank_name: '',
        check_number: '',
        check_date: '',
        check_deposit_date: '',
        credit_due_date: '',
        notes: ''
      })
      
      alert('✅ تم إضافة المشتريات وتحديث المخزون بنجاح')
    } catch (error) {
      console.error('Error adding purchase:', error)
      alert('❌ حدث خطأ أثناء إضافة المشتريات')
    }
  }

  const totalPurchases = filteredPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0)
  const pendingCount = filteredPurchases.filter(p => p.status === 'pending').length

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Truck className="text-white" size={36} />
          المشتريات
        </h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
        >
          <Plus size={20} />
          شراء جديد
        </button>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm mb-1">إجمالي المشتريات</p>
              <p className="text-2xl font-bold">{totalPurchases.toFixed(2)} MAD</p>
            </div>
            <DollarSign size={32} className="text-orange-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm mb-1">في الانتظار</p>
              <p className="text-2xl font-bold">{pendingCount}</p>
            </div>
            <Truck size={32} className="text-yellow-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm mb-1">مستلم</p>
              <p className="text-2xl font-bold">{filteredPurchases.filter(p => p.status === 'received').length}</p>
            </div>
            <CheckCircle size={32} className="text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm mb-1">عدد المشتريات</p>
              <p className="text-2xl font-bold">{filteredPurchases.length}</p>
            </div>
            <Package size={32} className="text-blue-200" />
          </div>
        </div>
      </div>

      {/* Recherche */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="relative">
          <Search className="absolute right-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="ابحث عن شراء أو منتج أو مورد..."
            className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Tableau des achats */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            جاري التحميل...
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            لا توجد مشتريات
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-orange-600 to-orange-700 text-white">
                <tr>
                  <th className="px-6 py-4 text-right font-bold">رقم الشراء</th>
                  <th className="px-6 py-4 text-right font-bold">المنتجات</th>
                  <th className="px-6 py-4 text-right font-bold">الكمية</th>
                  <th className="px-6 py-4 text-right font-bold">الإجمالي</th>
                  <th className="px-6 py-4 text-right font-bold">المورد</th>
                  <th className="px-6 py-4 text-right font-bold">التاريخ</th>
                  <th className="px-6 py-4 text-right font-bold">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((purchase) => (
                  <tr
                    key={purchase.id}
                    className="border-b hover:bg-orange-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-800">
                        {purchase.purchase_number}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {purchase.items?.map((item, index) => (
                          <div key={index} className="text-sm">
                            <p className="font-semibold text-gray-700">{item.product_name_ar}</p>
                            {item.product_sku && (
                              <p className="text-xs text-gray-500">SKU: {item.product_sku}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {purchase.items?.map((item, index) => (
                          <div key={index} className="text-sm font-bold text-gray-800">
                            {item.quantity}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-orange-600">
                        {(purchase.total_amount || 0).toFixed(2)} MAD
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-700">
                        {purchase.supplier?.name_ar || 'غير محدد'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(purchase.purchase_date).toLocaleDateString('ar-DZ')}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(purchase.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal إضافة شراء */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto" onClick={() => setShowAddModal(false)}>
          <div className="min-h-full flex items-start md:items-center justify-center p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">شراء جديد</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">المورد</label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                >
                  <option value="">اختر المورد</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name_ar}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">المخزن</label>
                <select
                  value={formData.warehouse_id}
                  onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                >
                  {warehouses.length === 0 ? (
                    <option value="">لا توجد مخازن</option>
                  ) : (
                    warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">بحث المنتج</label>
                <input
                  type="text"
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                  placeholder="ابحث بالاسم أو SKU..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">الفئة</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(null)}
                    className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                      !selectedCategory ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    الكل
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedCategory(category.id)}
                      className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                        selectedCategory === category.id
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {category.name_ar}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">المنتج</label>
                <select
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                >
                  <option value="">اختر المنتج</option>
                  {filteredProducts.map((product) => {
                    const categoryName = categories.find(c => c.id === product.category_id)?.name_ar
                    return (
                      <option key={product.id} value={product.id}>
                        {product.name_ar}{categoryName ? ` - ${categoryName}` : ''} (المخزون: {product.stock})
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الشراء</label>
                <input
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الكمية</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                  placeholder="الكمية"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">سعر الشراء للوحدة</label>
                <input
                  type="number"
                  value={formData.unit_price}
                  onChange={(e) => setFormData({...formData, unit_price: e.target.value})}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                  placeholder="سعر الوحدة"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">نسبة الضريبة (%)</label>
                <input
                  type="number"
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">حالة الشراء</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                >
                  <option value="received">مستلم</option>
                  <option value="pending">في الانتظار</option>
                  <option value="cancelled">ملغي</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">نوع الدفع</label>
                <select
                  value={formData.payment_type}
                  onChange={(e) => setFormData({ ...formData, payment_type: e.target.value as any })}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                >
                  <option value="cash">نقدي</option>
                  <option value="transfer">تحويل</option>
                  <option value="check">شيك</option>
                  <option value="credit">دين</option>
                </select>
              </div>

              {formData.payment_type === 'check' && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">البنك (اختياري)</label>
                    <input
                      type="text"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg"
                      placeholder="مثال: BMCE"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">رقم الشيك</label>
                    <input
                      type="text"
                      value={formData.check_number}
                      onChange={(e) => setFormData({ ...formData, check_number: e.target.value })}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg"
                      placeholder="أدخل رقم الشيك"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الشيك</label>
                    <input
                      type="date"
                      value={formData.check_date}
                      onChange={(e) => setFormData({ ...formData, check_date: e.target.value })}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ الإيداع</label>
                    <input
                      type="date"
                      value={formData.check_deposit_date}
                      onChange={(e) => setFormData({ ...formData, check_deposit_date: e.target.value })}
                      className="w-full p-3 border-2 border-gray-200 rounded-lg"
                    />
                  </div>
                </>
              )}

              {formData.payment_type === 'credit' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">تاريخ استحقاق الدين</label>
                  <input
                    type="date"
                    value={formData.credit_due_date}
                    onChange={(e) => setFormData({ ...formData, credit_due_date: e.target.value })}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">المبلغ المدفوع (اختياري)</label>
                <input
                  type="number"
                  value={formData.paid_amount}
                  onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                  placeholder={formData.payment_type === 'credit' ? '0.00' : 'اتركه فارغ للدفع الكامل'}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">ملاحظات</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg"
                  rows={3}
                  placeholder="ملاحظات حول الشراء أو معلومات الدفع..."
                />
              </div>
            </div>

            <div className="flex flex-col-reverse md:flex-row gap-3 mt-6">
              <button
                onClick={handleAddPurchase}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-bold"
              >
                إضافة الشراء
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-bold"
              >
                إلغاء
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
