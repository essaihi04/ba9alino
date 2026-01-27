import { useEffect, useState, useMemo } from 'react'
import { Plus, Search, Eye } from 'lucide-react'
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
  cost_price?: number
  price_a: number
}

interface PurchaseItem {
  product_id: string
  product_name_ar?: string
  product_sku?: string
  product: Product
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
  notes?: string
  created_at?: string
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null)
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([])
  const [newProductQuantity, setNewProductQuantity] = useState(1)
  const [newSupplier, setNewSupplier] = useState({
    name_ar: '',
    name_en: '',
    contact_person: '',
    email: '',
    phone: '',
    address: ''
  })
  const [purchaseData, setPurchaseData] = useState({
    supplier_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    tax_enabled: true,
    tax_rate: 10,
    payment_type: 'cash' as 'cash' | 'credit' | 'transfer' | 'check',
    notes: ''
  })

  useEffect(() => {
    fetchPurchases()
    fetchSuppliers()
    fetchProducts()
  }, [])

  const fetchPurchases = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('purchases')
        .select(`
          *,
          supplier:suppliers(id, name_ar, name_en, contact_person, email, phone, address)
        `)
        .order('purchase_date', { ascending: false })

      if (error) throw error
      setPurchases(data || [])
    } catch (error) {
      console.error('Error fetching purchases:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSuppliers(data || [])
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ar, sku, cost_price, price_a')
        .order('name_ar', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('suppliers')
        .insert([newSupplier])

      if (error) throw error

      setNewSupplier({
        name_ar: '',
        name_en: '',
        contact_person: '',
        email: '',
        phone: '',
        address: ''
      })
      setShowSupplierModal(false)
      await fetchSuppliers()
      alert('تم إنشاء المورد بنجاح')
    } catch (error) {
      console.error('Error creating supplier:', error)
      alert('حدث خطأ أثناء إنشاء المورد')
    }
  }

  const addPurchaseItem = (productId: string, quantity: number = 1) => {
    const existingItem = purchaseItems.find(item => item.product_id === productId)
    if (existingItem) {
      setPurchaseItems(purchaseItems.map(item =>
        item.product_id === productId
          ? { ...item, quantity: item.quantity + quantity, line_total: (item.quantity + quantity) * item.unit_price }
          : item
      ))
    } else {
      const product = products.find(p => p.id === productId)
      if (product) {
        setPurchaseItems([...purchaseItems, {
          product_id: productId,
          product_name_ar: product.name_ar,
          product_sku: product.sku,
          product: product,
          quantity: quantity,
          unit_price: product.cost_price || 0,
          line_total: quantity * (product.cost_price || 0)
        }])
      }
    }
  }

  const removePurchaseItem = (productId: string) => {
    setPurchaseItems(purchaseItems.filter(item => item.product_id !== productId))
  }

  const updatePurchaseItemQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removePurchaseItem(productId)
    } else {
      setPurchaseItems(purchaseItems.map(item =>
        item.product_id === productId
          ? { ...item, quantity, line_total: quantity * item.unit_price }
          : item
      ))
    }
  }

  const updatePurchaseItemPrice = (productId: string, unitPrice: number) => {
    setPurchaseItems(purchaseItems.map(item =>
      item.product_id === productId
        ? { ...item, unit_price: unitPrice, line_total: item.quantity * unitPrice }
        : item
    ))
  }

  const calculatePurchaseTotal = () => {
    const subtotal = purchaseItems.reduce((total, item) => total + item.line_total, 0)
    const taxAmount = purchaseData.tax_enabled ? (subtotal * purchaseData.tax_rate) / 100 : 0
    return { subtotal, taxAmount, total: subtotal + taxAmount }
  }

  const handleCreatePurchase = async () => {
    if (!purchaseData.supplier_id || purchaseItems.length === 0) {
      alert('يرجى اختيار مورد وإضافة منتج واحد على الأقل')
      return
    }

    try {
      const { subtotal, taxAmount, total } = calculatePurchaseTotal()
      const purchaseNumber = `ACH-${Date.now()}`

      const { data: purchaseResult, error: purchaseError } = await supabase
        .from('purchases')
        .insert([{
          purchase_number: purchaseNumber,
          supplier_id: purchaseData.supplier_id,
          purchase_date: purchaseData.purchase_date,
          status: 'received',
          items: purchaseItems.map(item => ({
            product_id: item.product_id,
            product_name_ar: item.product.name_ar,
            product_sku: item.product.sku,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.line_total
          })),
          subtotal,
          tax_rate: purchaseData.tax_rate,
          tax_amount: taxAmount,
          total_amount: total,
          payment_type: purchaseData.payment_type,
          notes: purchaseData.notes
        }])
        .select()
        .single()

      if (purchaseError) throw purchaseError

      // Add to stock
      for (const item of purchaseItems) {
        const { data: stockItem, error: fetchError } = await supabase
          .from('stock')
          .select('id, quantity_in_stock')
          .eq('product_id', item.product_id)
          .single()

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error fetching stock:', fetchError)
          continue
        }

        if (stockItem) {
          // Update existing stock
          const newQuantity = (stockItem.quantity_in_stock || 0) + item.quantity
          const { error: updateError } = await supabase
            .from('stock')
            .update({
              quantity_in_stock: newQuantity,
              updated_at: new Date().toISOString()
            })
            .eq('id', stockItem.id)

          if (updateError) {
            console.error('Error updating stock:', updateError)
          }
        } else {
          // Create new stock entry
          const { error: insertError } = await supabase
            .from('stock')
            .insert([{
              product_id: item.product_id,
              quantity_in_stock: item.quantity,
              quantity_reserved: 0,
              reorder_level: 10,
              reorder_quantity: 50
            }])

          if (insertError) {
            console.error('Error creating stock:', insertError)
          }
        }

        // Update product cost_price with purchase unit price
        if (item.unit_price > 0) {
          const { error: productUpdateError } = await supabase
            .from('products')
            .update({
              cost_price: item.unit_price,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.product_id)

          if (productUpdateError) {
            console.error('Error updating product cost_price:', productUpdateError)
          }
        }
      }

      setPurchaseData({
        supplier_id: '',
        purchase_date: new Date().toISOString().split('T')[0],
        tax_enabled: true,
        tax_rate: 10,
        payment_type: 'cash',
        notes: ''
      })
      setPurchaseItems([])
      setShowCreateModal(false)
      await fetchPurchases()
      alert('تم إنشاء الشراء بنجاح وتحديث المخزون وأسعار الشراء للمنتجات')
    } catch (error) {
      console.error('Error creating purchase:', error)
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف'
      alert(`حدث خطأ أثناء إنشاء الشراء: ${errorMessage}`)
    }
  }

  const filteredPurchases = useMemo(() => {
    let filtered = purchases

    const s = searchTerm.trim().toLowerCase()
    if (s) {
      filtered = filtered.filter(purchase => {
        const number = String(purchase.purchase_number || '').toLowerCase()
        const supplierName = String(purchase.supplier?.name_ar || '').toLowerCase()
        return number.includes(s) || supplierName.includes(s)
      })
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(purchase => purchase.status === filterStatus)
    }

    return filtered
  }, [purchases, searchTerm, filterStatus])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'received':
        return 'تم الاستقبال'
      case 'pending':
        return 'قيد الانتظار'
      case 'cancelled':
        return 'ملغي'
      default:
        return status
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">المشتريات</h1>
            <p className="text-gray-600 mt-2">إدارة المشتريات من الموردين</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              شراء جديد
            </button>
            <button
              onClick={() => setShowSupplierModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700"
            >
              <Plus className="w-5 h-5" />
              مورد جديد
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-64">
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2">
                <Search size={20} className="text-gray-400" />
                <input
                  type="text"
                  placeholder="ابحث عن شراء أو مورد..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-gray-800"
                />
              </div>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">جميع الحالات</option>
              <option value="pending">قيد الانتظار</option>
              <option value="received">تم الاستقبال</option>
              <option value="cancelled">ملغي</option>
            </select>
          </div>
        </div>

        {/* Purchases Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">جاري التحميل...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-right py-4 px-6 font-semibold text-gray-700">رقم الشراء</th>
                    <th className="text-right py-4 px-6 font-semibold text-gray-700">المورد</th>
                    <th className="text-right py-4 px-6 font-semibold text-gray-700">التاريخ</th>
                    <th className="text-right py-4 px-6 font-semibold text-gray-700">الحالة</th>
                    <th className="text-right py-4 px-6 font-semibold text-gray-700">الإجمالي</th>
                    <th className="text-right py-4 px-6 font-semibold text-gray-700">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        لا توجد مشتريات
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map((purchase) => (
                      <tr key={purchase.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                        <td className="py-4 px-6 font-medium text-gray-800">{purchase.purchase_number}</td>
                        <td className="py-4 px-6 text-gray-600">{purchase.supplier?.name_ar}</td>
                        <td className="py-4 px-6 text-gray-600">
                          {new Date(purchase.purchase_date).toLocaleDateString('ar-MA')}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(purchase.status)}`}>
                            {getStatusLabel(purchase.status)}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-medium text-gray-800">
                          {(purchase.total_amount || 0).toFixed(2)} MAD
                        </td>
                        <td className="py-4 px-6">
                          <button
                            onClick={() => {
                              setSelectedPurchase(purchase)
                              setShowDetailsModal(true)
                            }}
                            className="text-blue-600 hover:text-blue-800"
                            title="عرض التفاصيل"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Purchase Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">شراء جديد</h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setPurchaseData({
                      supplier_id: '',
                      purchase_date: new Date().toISOString().split('T')[0],
                      notes: ''
                    })
                    setPurchaseItems([])
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Purchase Info */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">المورد</label>
                    <div className="flex gap-2">
                      <select
                        value={purchaseData.supplier_id}
                        onChange={(e) => setPurchaseData({ ...purchaseData, supplier_id: e.target.value })}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                      >
                        <option value="">اختر مورد...</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name_ar}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowSupplierModal(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                      >
                        + مورد
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">تاريخ الشراء</label>
                    <input
                      type="date"
                      value={purchaseData.purchase_date}
                      onChange={(e) => setPurchaseData({ ...purchaseData, purchase_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">نوع الدفع</label>
                    <select
                      value={purchaseData.payment_type}
                      onChange={(e) => setPurchaseData({ ...purchaseData, payment_type: e.target.value as 'cash' | 'credit' | 'transfer' | 'check' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="cash">نقدي</option>
                      <option value="credit">آجل</option>
                      <option value="transfer">تحويل بنكي</option>
                      <option value="check">شيك</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">الضريبة</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="tax_enabled"
                          checked={purchaseData.tax_enabled}
                          onChange={(e) => setPurchaseData({ ...purchaseData, tax_enabled: e.target.checked })}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="tax_enabled" className="text-sm text-gray-700">تطبيق الضريبة</label>
                      </div>
                      {purchaseData.tax_enabled && (
                        <select
                          value={purchaseData.tax_rate}
                          onChange={(e) => setPurchaseData({ ...purchaseData, tax_rate: parseInt(e.target.value) })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value={7}>7%</option>
                          <option value={10}>10%</option>
                          <option value={20}>20%</option>
                        </select>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات</label>
                    <textarea
                      value={purchaseData.notes}
                      onChange={(e) => setPurchaseData({ ...purchaseData, notes: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      rows={3}
                      placeholder="ملاحظات إضافية..."
                    />
                  </div>
                </div>

                {/* Products */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">إضافة منتجات</label>
                    <div className="flex gap-2">
                      <select
                        onChange={(e) => {
                          // Ne fait rien ici, la sélection est gérée par le bouton
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        id="purchaseProductSelect"
                      >
                        <option value="">اختر منتج...</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name_ar} - {product.cost_price || 0} MAD
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={newProductQuantity}
                        onChange={(e) => setNewProductQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="الكمية"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const select = document.getElementById('purchaseProductSelect') as HTMLSelectElement
                          if (select.value && newProductQuantity > 0) {
                            addPurchaseItem(select.value, newProductQuantity)
                            select.value = ''
                            setNewProductQuantity(1)
                          }
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                      >
                        إضافة
                      </button>
                    </div>
                  </div>

                  {/* Purchase Items */}
                  <div className="border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <h3 className="font-medium text-gray-800 mb-3">منتجات الشراء</h3>
                    {purchaseItems.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">لا توجد منتجات مضافة</p>
                    ) : (
                      <div className="space-y-3">
                        {purchaseItems.map((item) => (
                          <div key={item.product_id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.product.name_ar}</p>
                              <p className="text-xs text-gray-500">{item.product.sku}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                value={item.unit_price}
                                onChange={(e) => updatePurchaseItemPrice(item.product_id, parseFloat(e.target.value) || 0)}
                                className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder="السعر"
                              />
                              <button
                                type="button"
                                onClick={() => updatePurchaseItemQuantity(item.product_id, item.quantity - 1)}
                                className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                              >
                                <span className="text-xs">-</span>
                              </button>
                              <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updatePurchaseItemQuantity(item.product_id, item.quantity + 1)}
                                className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"
                              >
                                <span className="text-xs">+</span>
                              </button>
                            </div>
                            <div className="text-left">
                              <p className="font-medium text-sm">{(item.line_total || 0).toFixed(2)} MAD</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removePurchaseItem(item.product_id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Purchase Total */}
                  {purchaseItems.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">المجموع الفرعي:</span>
                          <span className="font-medium">{calculatePurchaseTotal().subtotal.toFixed(2)} MAD</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">
                            الضريبة {purchaseData.tax_enabled ? `(${purchaseData.tax_rate}%)` : '(غير مفعلة)'}:
                          </span>
                          <span className="font-medium">{calculatePurchaseTotal().taxAmount.toFixed(2)} MAD</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                          <span className="font-bold text-blue-800">الإجمالي:</span>
                          <span className="text-xl font-bold text-blue-800">{calculatePurchaseTotal().total.toFixed(2)} MAD</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setPurchaseData({
                      supplier_id: '',
                      purchase_date: new Date().toISOString().split('T')[0],
                      notes: ''
                    })
                    setPurchaseItems([])
                  }}
                  className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleCreatePurchase}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium"
                >
                  إنشاء الشراء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Supplier Modal */}
        {showSupplierModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 lg:p-8 max-w-md sm:max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">إنشاء مورد جديد</h2>
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateSupplier} className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">اسم المورد (عربي)</label>
                  <input
                    type="text"
                    value={newSupplier.name_ar}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name_ar: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm sm:text-base"
                    placeholder="أدخل اسم المورد..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">اسم المورد (English)</label>
                  <input
                    type="text"
                    value={newSupplier.name_en}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name_en: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm sm:text-base"
                    placeholder="Enter supplier name in English..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">جهة الاتصال</label>
                  <input
                    type="text"
                    value={newSupplier.contact_person}
                    onChange={(e) => setNewSupplier({ ...newSupplier, contact_person: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm sm:text-base"
                    placeholder="أدخل اسم جهة الاتصال..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm sm:text-base"
                    placeholder="example@email.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">الهاتف</label>
                  <input
                    type="tel"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm sm:text-base"
                    placeholder="06xxxxxxxx ou 07xxxxxxxx"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">العنوان</label>
                  <textarea
                    value={newSupplier.address}
                    onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm sm:text-base resize-none"
                    placeholder="أدخل العنوان الكامل..."
                    rows={3}
                    required
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSupplierModal(false)
                      setNewSupplier({
                        name_ar: '',
                        name_en: '',
                        contact_person: '',
                        email: '',
                        phone: '',
                        address: ''
                      })
                    }}
                    className="flex-1 bg-gray-200 text-gray-800 py-2 px-3 sm:px-4 rounded-lg hover:bg-gray-300 transition font-medium text-sm sm:text-base"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 text-white py-2 px-3 sm:px-4 rounded-lg hover:bg-green-700 transition font-medium text-sm sm:text-base"
                  >
                    إنشاء المورد
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Purchase Details Modal */}
        {showDetailsModal && selectedPurchase && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">تفاصيل الشراء #{selectedPurchase.purchase_number}</h2>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <h3 className="font-semibold mb-2">معلومات المورد</h3>
                  <p><span className="text-gray-500">الاسم:</span> {selectedPurchase.supplier?.name_ar}</p>
                  <p><span className="text-gray-500">البريد:</span> {selectedPurchase.supplier?.email}</p>
                  <p><span className="text-gray-500">الهاتف:</span> {selectedPurchase.supplier?.phone}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">معلومات الشراء</h3>
                  <p><span className="text-gray-500">التاريخ:</span> {new Date(selectedPurchase.purchase_date).toLocaleDateString('ar-MA')}</p>
                  <p><span className="text-gray-500">الحالة:</span> <span className={`px-2 py-1 rounded text-xs ${getStatusColor(selectedPurchase.status)}`}>{getStatusLabel(selectedPurchase.status)}</span></p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-semibold mb-3">منتجات الشراء</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-right">المنتج</th>
                        <th className="px-4 py-2 text-right">الكمية</th>
                        <th className="px-4 py-2 text-right">السعر</th>
                        <th className="px-4 py-2 text-right">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedPurchase.items?.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2">{item.product_name_ar || item.product?.name_ar}</td>
                          <td className="px-4 py-2">{item.quantity}</td>
                          <td className="px-4 py-2">{(item.unit_price || 0).toFixed(2)} MAD</td>
                          <td className="px-4 py-2 font-medium">{(item.line_total || 0).toFixed(2)} MAD</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>المجموع الفرعي:</span>
                    <span className="font-medium">{(selectedPurchase.subtotal || 0).toFixed(2)} MAD</span>
                  </div>
                  <div className="flex justify-between">
                    <span>الضريبة:</span>
                    <span className="font-medium">{(selectedPurchase.tax_amount || 0).toFixed(2)} MAD</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-bold">
                    <span>الإجمالي:</span>
                    <span className="text-lg">{(selectedPurchase.total_amount || 0).toFixed(2)} MAD</span>
                  </div>
                </div>
              </div>

              {selectedPurchase.notes && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">ملاحظات</h3>
                  <p className="text-gray-600">{selectedPurchase.notes}</p>
                </div>
              )}

              <button
                onClick={() => {
                  setShowDetailsModal(false)
                  setSelectedPurchase(null)
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
