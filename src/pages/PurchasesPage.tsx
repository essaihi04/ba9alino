import { useEffect, useState } from 'react'
import { Search, Plus, Package, DollarSign, CheckCircle, Truck, AlertCircle, Trash2, X, ShoppingCart, CreditCard, Edit, PlusCircle, Eye } from 'lucide-react'
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

interface PurchaseLineItem {
  product_id: string
  product_name_ar: string
  product_sku: string
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
  items: PurchaseLineItem[]
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

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreatePurchaseModal, setShowCreatePurchaseModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [purchaseItems, setPurchaseItems] = useState<PurchaseLineItem[]>([])
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingItem, setEditingItem] = useState<PurchaseLineItem | null>(null)
  const [editForm, setEditForm] = useState({
    quantity: 1,
    unit_price: 0
  })
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_method: 'cash' as 'cash' | 'transfer' | 'check',
    payment_date: new Date().toISOString().split('T')[0],
    notes: ''
  })
  const [showEditPurchaseModal, setShowEditPurchaseModal] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null)
  
  // Formulaire d'achat
  const [purchaseForm, setPurchaseForm] = useState({
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

      if (!purchaseForm.warehouse_id && list.length > 0) {
        setPurchaseForm(prev => ({ ...prev, warehouse_id: list[0].id }))
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
        .select('id, name_ar, sku, stock, cost_price, price_a, category_id, image_url')
        .order('name_ar')

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  const loadCategories = async () => {
    try {
      const [categoriesRes, clientsRes] = await Promise.all([
        supabase.from('product_categories').select('*').order('name_ar'),
        supabase.from('clients').select('*').eq('created_by', commercialId).order('company_name_ar')
      ])

      if (categoriesRes.error) throw categoriesRes.error
      if (clientsRes.error) throw clientsRes.error

      setCategories((categoriesRes.data || []) as Category[])
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  // Filtrer les produits par catégorie sélectionnée
  const filteredProducts = selectedCategory 
    ? products.filter(p => p.category_id === selectedCategory)
    : products

  // Ajouter un produit à la facture
  const addProductToInvoice = (product: Product) => {
    const existingItem = purchaseItems.find(item => item.product_id === product.id)
    
    if (existingItem) {
      // Augmenter la quantité
      setPurchaseItems(purchaseItems.map(item =>
        item.product_id === product.id
          ? {
              ...item,
              quantity: item.quantity + 1,
              line_total: (item.quantity + 1) * item.unit_price
            }
          : item
      ))
    } else {
      // Ajouter un nouvel item
      const unitPrice = product.cost_price || product.price_a
      setPurchaseItems([
        ...purchaseItems,
        {
          product_id: product.id,
          product_name_ar: product.name_ar,
          product_sku: product.sku,
          quantity: 1,
          unit_price: unitPrice,
          line_total: unitPrice
        }
      ])
    }
  }

  // Supprimer un produit de la facture
  const removeProductFromInvoice = (productId: string) => {
    setPurchaseItems(purchaseItems.filter(item => item.product_id !== productId))
  }

  
  // Ouvrir le popup d'édition
  const openEditModal = (item: PurchaseLineItem) => {
    setEditingItem(item)
    setEditForm({
      quantity: item.quantity,
      unit_price: item.unit_price
    })
    setShowEditModal(true)
  }

  // Sauvegarder les modifications
  const saveEdit = () => {
    if (!editingItem) return

    if (editForm.quantity <= 0) {
      removeProductFromInvoice(editingItem.product_id)
    } else {
      setPurchaseItems(purchaseItems.map(item =>
        item.product_id === editingItem.product_id
          ? {
              ...item,
              quantity: editForm.quantity,
              unit_price: editForm.unit_price,
              line_total: editForm.quantity * editForm.unit_price
            }
          : item
      ))
    }

    setShowEditModal(false)
    setEditingItem(null)
  }

  // Calculer les totaux
  const subtotal = purchaseItems.reduce((sum, item) => sum + item.line_total, 0)
  const taxRate = parseFloat(purchaseForm.tax_rate) || 0
  const taxAmount = subtotal * (taxRate / 100)
  const totalAmount = subtotal + taxAmount

  // Soumettre l'achat
  const handleSubmitPurchase = async () => {
    if (purchaseItems.length === 0) {
      alert('يرجى إضافة منتجات إلى الفاتورة')
      return
    }

    if (!purchaseForm.supplier_id) {
      alert('يرجى اختيار المورد')
      return
    }

    if (!purchaseForm.warehouse_id) {
      alert('يرجى اختيار المستودع')
      return
    }

    try {
      const purchaseNumber = `ACH-${Date.now()}`
      
      // Si paiement en espèce, marquer comme payé automatiquement
      let paidAmount = 0
      let paymentStatus = 'pending'
      
      if (purchaseForm.payment_type === 'cash') {
        paidAmount = totalAmount
        paymentStatus = 'paid'
      } else {
        paidAmount = purchaseForm.paid_amount ? parseFloat(purchaseForm.paid_amount) : 0
        paymentStatus = paidAmount >= totalAmount ? 'paid' : (paidAmount > 0 ? 'partial' : 'pending')
      }
      
      const remainingAmount = Math.max(0, totalAmount - paidAmount)

      const purchasePayload: any = {
        purchase_number: purchaseNumber,
        supplier_id: purchaseForm.supplier_id,
        purchase_date: purchaseForm.purchase_date,
        status: purchaseForm.status,
        items: purchaseItems,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_type: purchaseForm.payment_type,
        paid_amount: paidAmount,
        remaining_amount: remainingAmount,
        payment_status: paymentStatus,
        notes: purchaseForm.notes
      }

      if (purchaseForm.payment_type === 'check') {
        purchasePayload.check_number = purchaseForm.check_number
        purchasePayload.check_date = purchaseForm.check_date
        purchasePayload.check_deposit_date = purchaseForm.check_deposit_date
      }

      if (purchaseForm.payment_type === 'transfer') {
        purchasePayload.bank_name = purchaseForm.bank_name
      }

      if (purchaseForm.payment_type === 'credit') {
        purchasePayload.credit_due_date = purchaseForm.credit_due_date
      }

      const { error } = await supabase
        .from('purchases')
        .insert([purchasePayload])

      if (error) throw error

      // Ajouter les produits au stock
      if (purchaseForm.status === 'received' && purchaseForm.warehouse_id) {
        for (const item of purchaseItems) {
          // Vérifier si le produit existe déjà dans le stock de ce dépôt
          const { data: existingStock } = await supabase
            .from('stock')
            .select('*')
            .eq('product_id', item.product_id)
            .eq('warehouse_id', purchaseForm.warehouse_id)
            .single()

          if (existingStock) {
            // Mettre à jour le stock existant
            await supabase
              .from('stock')
              .update({
                quantity_available: existingStock.quantity_available + item.quantity,
                cost_price: item.unit_price, // Mettre à jour le prix d'achat
                updated_at: new Date().toISOString()
              })
              .eq('id', existingStock.id)
          } else {
            // Créer une nouvelle entrée de stock
            await supabase
              .from('stock')
              .insert({
                product_id: item.product_id,
                warehouse_id: purchaseForm.warehouse_id,
                quantity_available: item.quantity,
                cost_price: item.unit_price,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
          }

          // Mettre à jour le stock total du produit
          const { data: product } = await supabase
            .from('products')
            .select('stock')
            .eq('id', item.product_id)
            .single()

          if (product) {
            await supabase
              .from('products')
              .update({
                stock: product.stock + item.quantity,
                cost_price: item.unit_price // Mettre à jour le prix d'achat par défaut
              })
              .eq('id', item.product_id)
          }

          // Mettre à jour le stock dans les variants du produit
          const { data: variants } = await supabase
            .from('product_variants')
            .select('id, stock')
            .eq('product_id', item.product_id)

          if (variants && variants.length > 0) {
            // Mettre à jour tous les variants du produit
            for (const variant of variants) {
              await supabase
                .from('product_variants')
                .update({
                  stock: variant.stock + item.quantity,
                  purchase_price: item.unit_price // Mettre à jour le prix d'achat
                })
                .eq('id', variant.id)
            }
          }
        }
      }

      alert('✅ تم إنشاء الفاتورة وإضافة المنتجات إلى المخزون بنجاح')
      setShowCreatePurchaseModal(false)
      setPurchaseItems([])
      setSelectedCategory(null)
      setPurchaseForm({
        supplier_id: '',
        warehouse_id: warehouses.length > 0 ? warehouses[0].id : '',
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
      await loadPurchases()
      await loadProducts() // Recharger les produits pour mettre à jour les stocks
    } catch (error) {
      console.error('Error creating purchase:', error)
      alert('❌ حدث خطأ أثناء إنشاء الفاتورة')
    }
  }

  // Fonctions pour gérer les paiements
  const openPaymentModal = (purchase: Purchase) => {
    setSelectedPurchase(purchase)
    setPaymentForm({
      amount: purchase.remaining_amount.toString(),
      payment_method: 'cash',
      payment_date: new Date().toISOString().split('T')[0],
      notes: ''
    })
    setShowPaymentModal(true)
  }

  const handleAddPayment = async () => {
    if (!selectedPurchase || !paymentForm.amount) return

    try {
      const amount = parseFloat(paymentForm.amount)
      const newPaidAmount = selectedPurchase.paid_amount + amount
      const newRemainingAmount = Math.max(0, selectedPurchase.total_amount - newPaidAmount)
      const newPaymentStatus = newRemainingAmount === 0 ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'pending')

      // Mettre à jour la facture
      await supabase
        .from('purchases')
        .update({
          paid_amount: newPaidAmount,
          remaining_amount: newRemainingAmount,
          payment_status: newPaymentStatus
        })
        .eq('id', selectedPurchase.id)

      // Ajouter l'enregistrement de paiement
      await supabase
        .from('purchase_payments')
        .insert({
          purchase_id: selectedPurchase.id,
          amount: amount,
          payment_method: paymentForm.payment_method,
          payment_date: paymentForm.payment_date,
          notes: paymentForm.notes,
          created_at: new Date().toISOString()
        })

      alert('✅ تم إضافة الدفعة بنجاح')
      setShowPaymentModal(false)
      await loadPurchases()
    } catch (error) {
      console.error('Error adding payment:', error)
      alert('❌ حدث خطأ أثناء إضافة الدفعة')
    }
  }

  // Fonctions pour éditer et supprimer une facture
  const openEditPurchaseModal = (purchase: Purchase) => {
    setEditingPurchase(purchase)
    setShowEditPurchaseModal(true)
  }

  const handleDeletePurchase = async (purchase: Purchase) => {
    if (!confirm(`هل أنت متأكد من حذف فاتورة الشراء ${purchase.purchase_number}؟\nسيتم أيضا خصم الكميات من المخزون!`)) {
      return
    }

    try {
      // Retirer les quantités du stock pour chaque produit dans la facture
      if (purchase.items && purchase.items.length > 0) {
        for (const item of purchase.items) {
          // Retirer du stock principal du produit
          const { data: product } = await supabase
            .from('products')
            .select('stock')
            .eq('id', item.product_id)
            .single()

          if (product) {
            const newStock = Math.max(0, product.stock - item.quantity)
            await supabase
              .from('products')
              .update({ stock: newStock })
              .eq('id', item.product_id)
          }

          // Retirer du stock dans les variants du produit
          const { data: variants } = await supabase
            .from('product_variants')
            .select('id, stock')
            .eq('product_id', item.product_id)

          if (variants && variants.length > 0) {
            for (const variant of variants) {
              const newVariantStock = Math.max(0, variant.stock - item.quantity)
              await supabase
                .from('product_variants')
                .update({ stock: newVariantStock })
                .eq('id', variant.id)
            }
          }

          // Retirer du stock par entrepôt si applicable
          const { data: stockRecords } = await supabase
            .from('stock')
            .select('id, quantity_available')
            .eq('product_id', item.product_id)

          if (stockRecords && stockRecords.length > 0) {
            for (const stockRecord of stockRecords) {
              const newWarehouseStock = Math.max(0, stockRecord.quantity_available - item.quantity)
              await supabase
                .from('stock')
                .update({ quantity_available: newWarehouseStock })
                .eq('id', stockRecord.id)
            }
          }
        }
      }

      // Supprimer les enregistrements de paiement
      await supabase
        .from('purchase_payments')
        .delete()
        .eq('purchase_id', purchase.id)

      // Supprimer la facture
      await supabase
        .from('purchases')
        .delete()
        .eq('id', purchase.id)

      alert('✅ تم حذف الفاتورة وخصم الكميات من المخزون بنجاح')
      await loadPurchases()
      await loadProducts() // Recharger les produits pour mettre à jour les stocks affichés
    } catch (error) {
      console.error('Error deleting purchase:', error)
      alert('❌ حدث خطأ أثناء حذف الفاتورة')
    }
  }

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

  return (
    <div className="space-y-6" dir="rtl">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShoppingCart className="text-white" size={36} />
            إدارة المشتريات
          </h1>
          <p className="text-white mt-2">إنشاء وإدارة فواتير الشراء</p>
        </div>
        <button
          onClick={() => setShowCreatePurchaseModal(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700"
        >
          <Plus className="w-5 h-5" />
          فاتورة شراء جديدة
        </button>
      </div>

      {/* البحث */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="relative">
          <Search className="absolute right-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="ابحث عن فاتورة..."
            className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* جدول الفواتير */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            جاري التحميل...
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            لا توجد فواتير شراء
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-green-600 to-green-700 text-white">
                <tr>
                  <th className="px-6 py-4 text-right font-bold">رقم الفاتورة</th>
                  <th className="px-6 py-4 text-right font-bold">المورد</th>
                  <th className="px-6 py-4 text-right font-bold">التاريخ</th>
                  <th className="px-6 py-4 text-right font-bold">الإجمالي</th>
                  <th className="px-6 py-4 text-right font-bold">المتبقي</th>
                  <th className="px-6 py-4 text-right font-bold">الحالة</th>
                  <th className="px-6 py-4 text-right font-bold">حالة الدفع</th>
                  <th className="px-6 py-4 text-center font-bold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((purchase) => (
                  <tr key={purchase.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-800">{purchase.purchase_number}</td>
                    <td className="px-6 py-4 text-gray-700">{purchase.supplier?.name_ar}</td>
                    <td className="px-6 py-4 text-gray-700">{new Date(purchase.purchase_date).toLocaleDateString('ar-MA')}</td>
                    <td className="px-6 py-4 font-bold text-gray-800">{purchase.total_amount.toFixed(2)} MAD</td>
                    <td className="px-6 py-4">
                      <span className={`font-bold ${
                        purchase.remaining_amount > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {purchase.remaining_amount.toFixed(2)} MAD
                      </span>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(purchase.status)}</td>
                    <td className="px-6 py-4">{getStatusBadge(purchase.payment_status)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {purchase.payment_status !== 'paid' && (
                          <button
                            onClick={() => openPaymentModal(purchase)}
                            className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200 transition-colors"
                            title="إضافة دفعة"
                          >
                            <CreditCard size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => openEditPurchaseModal(purchase)}
                          className="bg-gray-100 text-gray-600 p-2 rounded-lg hover:bg-gray-200 transition-colors"
                          title="عرض التفاصيل"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleDeletePurchase(purchase)}
                          className="bg-red-100 text-red-600 p-2 rounded-lg hover:bg-red-200 transition-colors"
                          title="حذف الفاتورة"
                        >
                          <Trash2 size={16} />
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

      {/* Modal إنشاء فاتورة شراء */}
      {showCreatePurchaseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 text-white p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold">فاتورة شراء جديدة</h2>
              <button
                onClick={() => {
                  setShowCreatePurchaseModal(false)
                  setPurchaseItems([])
                  setSelectedCategory(null)
                }}
                className="hover:bg-white hover:bg-opacity-20 p-2 rounded-lg"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 grid grid-cols-12 gap-6 h-[80vh]">
              {/* Colonne gauche: Facture */}
              <div className="col-span-7 bg-white rounded-xl shadow-lg p-6 flex flex-col">
                <h3 className="text-xl font-bold text-gray-800 mb-4">فاتورة الشراء</h3>
                
                {/* Informations de la facture */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">المورد *</label>
                    <select
                      value={purchaseForm.supplier_id}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier_id: e.target.value })}
                      className="w-full p-2 border rounded-lg text-sm"
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
                    <label className="block text-sm font-bold text-gray-700 mb-1">المستودع *</label>
                    <select
                      value={purchaseForm.warehouse_id}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, warehouse_id: e.target.value })}
                      className="w-full p-2 border rounded-lg text-sm"
                    >
                      <option value="">اختر المستودع</option>
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">التاريخ</label>
                    <input
                      type="date"
                      value={purchaseForm.purchase_date}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })}
                      className="w-full p-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">نسبة الضريبة (%)</label>
                    <input
                      type="number"
                      value={purchaseForm.tax_rate}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, tax_rate: e.target.value })}
                      className="w-full p-2 border rounded-lg text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">نوع الدفع</label>
                    <select
                      value={purchaseForm.payment_type}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, payment_type: e.target.value as any })}
                      className="w-full p-2 border rounded-lg text-sm"
                    >
                      <option value="cash">نقدي</option>
                      <option value="transfer">تحويل</option>
                      <option value="check">شيك</option>
                      <option value="credit">دين</option>
                    </select>
                  </div>
                </div>

                {/* Tableau des produits de la facture */}
                <div className="flex-1 bg-gray-50 rounded-lg overflow-hidden mb-4">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gray-200 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">المنتج</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">الكمية</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">سعر الوحدة</th>
                          <th className="px-4 py-3 text-right text-sm font-bold text-gray-700">المجموع</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">إجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseItems.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                              لم يتم إضافة منتجات بعد
                            </td>
                          </tr>
                        ) : (
                          purchaseItems.map((item) => (
                            <tr key={item.product_id} className="border-t hover:bg-gray-100">
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => openEditModal(item)}
                                  className="text-left hover:text-blue-600 transition-colors"
                                >
                                  <p className="font-bold text-gray-800">{item.product_name_ar}</p>
                                  <p className="text-xs text-gray-600">SKU: {item.product_sku}</p>
                                </button>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="font-bold text-gray-800">{item.quantity}</span>
                              </td>
                              <td className="px-4 py-3 text-right font-medium">{item.unit_price.toFixed(2)} MAD</td>
                              <td className="px-4 py-3 text-right font-bold text-green-600">{item.line_total.toFixed(2)} MAD</td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => removeProductFromInvoice(item.product_id)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Résumé */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 space-y-2 border-2 border-green-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">الإجمالي الفرعي:</span>
                    <span className="font-bold text-gray-800">{subtotal.toFixed(2)} MAD</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">الضريبة ({taxRate}%):</span>
                    <span className="font-bold text-gray-800">{taxAmount.toFixed(2)} MAD</span>
                  </div>
                  <div className="border-t-2 border-green-300 pt-2 flex justify-between text-lg">
                    <span className="font-bold text-gray-800">الإجمالي:</span>
                    <span className="font-bold text-green-700">{totalAmount.toFixed(2)} MAD</span>
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm font-bold text-gray-700 mb-1">المبلغ المدفوع</label>
                    <input
                      type="number"
                      value={purchaseForm.paid_amount}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, paid_amount: e.target.value })}
                      className="w-full p-2 border rounded-lg text-sm"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Colonne droite: Familles et produits */}
              <div className="col-span-5 bg-white rounded-xl shadow-lg p-6 flex flex-col">
                {/* Sélection des familles */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-3">اختر العائلة</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`px-3 py-1 rounded-lg transition-colors text-sm ${
                        !selectedCategory
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      جميع المنتجات
                    </button>
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`px-3 py-1 rounded-lg transition-colors text-sm ${
                          selectedCategory === category.id
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {category.name_ar}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Affichage des produits */}
                <div className="flex-1 overflow-y-auto">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-3">
                      {selectedCategory ? 'المنتجات' : 'جميع المنتجات'}
                    </h3>
                    {filteredProducts.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Package size={48} className="mx-auto mb-4 opacity-50" />
                        <p>لا توجد منتجات في هذه الفئة</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {filteredProducts.map((product) => (
                          <button
                            key={product.id}
                            onClick={() => addProductToInvoice(product)}
                            className="border-2 border-gray-200 rounded-lg p-3 hover:border-green-500 hover:bg-green-50 transition-all"
                          >
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name_ar}
                                className="w-full h-16 object-cover rounded-lg mb-2"
                              />
                            ) : (
                              <div className="w-full h-16 bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                                <Package size={20} className="text-gray-400" />
                              </div>
                            )}
                            <p className="font-bold text-xs text-gray-800 mb-1 truncate">{product.name_ar}</p>
                            <p className="text-xs text-gray-600 mb-1">SKU: {product.sku}</p>
                            <p className="text-xs font-bold text-green-600">{(product.cost_price || product.price_a).toFixed(2)} MAD</p>
                            <p className="text-xs text-gray-500 mt-1">المخزون: {product.stock}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-4 mt-6 px-6">
              <button
                onClick={() => {
                  setShowCreatePurchaseModal(false)
                  setPurchaseItems([])
                  setSelectedCategory(null)
                }}
                className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300 font-bold"
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmitPurchase}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold"
              >
                حفظ الفاتورة
              </button>
            </div>

            {/* Popup d'édition de produit */}
            {showEditModal && editingItem && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-md">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">تعديل المنتج</h3>
                  
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">المنتج:</p>
                    <p className="font-bold text-gray-800">{editingItem.product_name_ar}</p>
                    <p className="text-xs text-gray-500">SKU: {editingItem.product_sku}</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">الكمية</label>
                      <input
                        type="number"
                        min="1"
                        value={editForm.quantity}
                        onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 1 })}
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">سعر الوحدة (MAD)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.unit_price}
                        onChange={(e) => setEditForm({ ...editForm, unit_price: parseFloat(e.target.value) || 0 })}
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">المجموع:</span>
                        <span className="font-bold text-green-600">
                          {(editForm.quantity * editForm.unit_price).toFixed(2)} MAD
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setShowEditModal(false)}
                      className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-bold"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={saveEdit}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-bold"
                    >
                      حفظ
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Popup d'ajout de paiement */}
            {showPaymentModal && selectedPurchase && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-md">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">إضافة دفعة</h3>
                  
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">فاتورة:</p>
                    <p className="font-bold text-gray-800">{selectedPurchase.purchase_number}</p>
                    <p className="text-sm text-gray-600">المورد: {selectedPurchase.supplier?.name_ar}</p>
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">الإجمالي:</span>
                        <span className="font-bold">{selectedPurchase.total_amount.toFixed(2)} MAD</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">المدفوع:</span>
                        <span className="font-bold text-green-600">{selectedPurchase.paid_amount.toFixed(2)} MAD</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold">
                        <span className="text-red-600">المتبقي:</span>
                        <span className="text-red-600">{selectedPurchase.remaining_amount.toFixed(2)} MAD</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">المبلغ *</label>
                      <input
                        type="number"
                        min="0.01"
                        max={selectedPurchase.remaining_amount}
                        step="0.01"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                        className="w-full p-2 border rounded-lg"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">طريقة الدفع *</label>
                      <select
                        value={paymentForm.payment_method}
                        onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value as any })}
                        className="w-full p-2 border rounded-lg"
                      >
                        <option value="cash">نقدي</option>
                        <option value="transfer">تحويل بنكي</option>
                        <option value="check">شيك</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">تاريخ الدفع</label>
                      <input
                        type="date"
                        value={paymentForm.payment_date}
                        onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات</label>
                      <textarea
                        value={paymentForm.notes}
                        onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                        className="w-full p-2 border rounded-lg"
                        rows={3}
                        placeholder="ملاحظات إضافية..."
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setShowPaymentModal(false)}
                      className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-bold"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={handleAddPayment}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 font-bold"
                    >
                      إضافة الدفعة
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Popup détails de la facture */}
            {showEditPurchaseModal && editingPurchase && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-800">تفاصيل الفاتورة</h3>
                    <button
                      onClick={() => setShowEditPurchaseModal(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X size={24} />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">رقم الفاتورة</p>
                      <p className="font-bold text-gray-800">{editingPurchase.purchase_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">المورد</p>
                      <p className="font-bold text-gray-800">{editingPurchase.supplier?.name_ar}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">التاريخ</p>
                      <p className="font-bold text-gray-800">{new Date(editingPurchase.purchase_date).toLocaleDateString('ar-MA')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">الحالة</p>
                      <div>{getStatusBadge(editingPurchase.status)}</div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-bold text-gray-800 mb-3">المنتجات</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full border">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-right">المنتج</th>
                            <th className="px-4 py-2 text-center">الكمية</th>
                            <th className="px-4 py-2 text-right">سعر الوحدة</th>
                            <th className="px-4 py-2 text-right">الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editingPurchase.items?.map((item, index) => (
                            <tr key={index} className="border-t">
                              <td className="px-4 py-2">
                                <p className="font-bold">{item.product_name_ar}</p>
                                <p className="text-xs text-gray-500">SKU: {item.product_sku}</p>
                              </td>
                              <td className="px-4 py-2 text-center">{item.quantity}</td>
                              <td className="px-4 py-2 text-right">{item.unit_price.toFixed(2)} MAD</td>
                              <td className="px-4 py-2 text-right font-bold">{item.line_total.toFixed(2)} MAD</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-600">الإجمالي</p>
                      <p className="font-bold text-gray-800">{editingPurchase.total_amount.toFixed(2)} MAD</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">المدفوع</p>
                      <p className="font-bold text-green-600">{editingPurchase.paid_amount.toFixed(2)} MAD</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">المتبقي</p>
                      <p className="font-bold text-red-600">{editingPurchase.remaining_amount.toFixed(2)} MAD</p>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setShowEditPurchaseModal(false)}
                      className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-bold"
                    >
                      إغلاق
                    </button>
                    {editingPurchase.payment_status !== 'paid' && (
                      <button
                        onClick={() => {
                          setShowEditPurchaseModal(false)
                          openPaymentModal(editingPurchase)
                        }}
                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-bold"
                      >
                        إضافة دفعة
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
