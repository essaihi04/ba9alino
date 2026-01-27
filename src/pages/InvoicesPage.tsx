import { useEffect, useState } from 'react'
import { Search, Eye, Plus, FileText, DollarSign, CheckCircle, Clock, AlertCircle, Package, Barcode, X, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Invoice {
  id: string
  invoice_number: string
  invoice_date: string
  client_id: string | null
  client_name: string | null
  client_phone: string | null
  client_address: string | null
  company_name_ar: string | null
  order_id: string | null
  order_number: string | null
  employee_id?: string | null
  employee?: {
    id: string
    name: string
    phone: string
    role: string
    status: string
  }
  warehouse_id?: string | null
  warehouse?: {
    id: string
    name: string
    address?: string
    is_active: boolean
  }
  items?: InvoiceItem[] // JSONB array
  subtotal: number | null
  tax_rate: number | null
  tax_amount: number | null
  discount_amount: number | null
  total_amount: number | null
  paid_amount: number | null
  remaining_amount: number | null
  currency: string | null
  status: string | null
  payment_status: string | null
  payment_method?: string | null
  notes?: string
  created_at: string
}

interface InvoiceItem {
  id: string
  product_id: string
  product_name_ar: string
  product_sku: string
  quantity: number
  unit_type: 'unit' | 'kg' | 'carton'
  unit_price: number
  line_total: number
  barcode?: string
  weight?: number
  weight_unit?: string
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
  stock: number
  category_id?: string
  image_url?: string
  weight?: number
  weight_unit?: string
  barcode?: string
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  
  // États pour le modal de création de facture
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProducts, setSelectedProducts] = useState<InvoiceItem[]>([])
  const [formData, setFormData] = useState({
    client_name: '',
    client_phone: '',
    client_address: '',
    notes: ''
  })
  const [loadingProducts, setLoadingProducts] = useState(false)

  useEffect(() => {
    loadInvoices()
    loadProducts()
  }, [])

  const loadProducts = async () => {
    setLoadingProducts(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ar, name_en, sku, price_a, price_b, price_c, price_d, price_e, stock, weight, weight_unit')
        .order('name_ar')

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const getInvoiceTotalQuantity = (invoice: Invoice) => {
    if (!invoice.items || !Array.isArray(invoice.items)) return 0
    return invoice.items.reduce((total: number, item: any) => total + (item.quantity || 0), 0)
  }

  // Générer un code-barres aléatoire
  const generateBarcode = () => {
    return Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0')
  }

  // Ajouter un produit à la facture
  const addProductToInvoice = (product: Product, unitType: 'unit' | 'kg' | 'carton', quantity: number) => {
    const price = unitType === 'unit' ? product.price_a : 
                  unitType === 'kg' ? product.price_b : 
                  product.price_c

    const newItem: InvoiceItem = {
      id: `temp-${Date.now()}-${Math.random()}`,
      product_id: product.id,
      product_name_ar: product.name_ar,
      product_sku: product.sku,
      quantity,
      unit_type: unitType,
      unit_price: price,
      line_total: price * quantity,
      barcode: product.barcode || generateBarcode(),
      weight: product.weight,
      weight_unit: product.weight_unit
    }

    setSelectedProducts([...selectedProducts, newItem])
  }

  // Supprimer un produit de la facture
  const removeProductFromInvoice = (itemId: string) => {
    setSelectedProducts(selectedProducts.filter(item => item.id !== itemId))
  }

  // Calculer le total de la facture
  const calculateTotal = () => {
    return selectedProducts.reduce((total, item) => total + item.line_total, 0)
  }

  // Créer la facture
  const createInvoice = async () => {
    try {
      const invoiceData = {
        invoice_number: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        invoice_date: new Date().toISOString(),
        client_name: formData.client_name || 'عميل عام',
        client_phone: formData.client_phone,
        client_address: formData.client_address,
        company_name_ar: 'بقالينو',
        subtotal: calculateTotal(),
        total_amount: calculateTotal(),
        paid_amount: 0,
        remaining_amount: calculateTotal(),
        currency: 'MAD',
        status: 'draft',
        payment_status: 'unpaid',
        notes: formData.notes,
        items: selectedProducts.map(item => ({
          product_id: item.product_id,
          product_name_ar: item.product_name_ar,
          product_sku: item.product_sku,
          quantity: item.quantity,
          unit_type: item.unit_type,
          unit_price: item.unit_price,
          line_total: item.line_total,
          barcode: item.barcode
        }))
      }

      const { data, error } = await supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single()

      if (error) throw error

      // Réinitialiser le formulaire
      setShowCreateModal(false)
      setSelectedProducts([])
      setFormData({
        client_name: '',
        client_phone: '',
        client_address: '',
        notes: ''
      })

      // Recharger les factures
      loadInvoices()
    } catch (error) {
      console.error('Error creating invoice:', error)
    }
  }

  const loadInvoices = async () => {
    setLoading(true)
    try {
      // Récupérer les factures avec les paiements
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          payments (
            amount,
            payment_method,
            status,
            payment_date,
            created_at
          )
        `)
        .order('created_at', { ascending: false })

      if (invoicesError) throw invoicesError
      
      // Récupérer tous les employés et entrepôts en une seule fois
      const [employeesData, warehousesData] = await Promise.all([
        supabase.from('employees').select('id, name, phone, role, status').eq('status', 'active'),
        supabase.from('warehouses').select('id, name, address, is_active').eq('is_active', true)
      ])
      
      // Créer des maps pour un accès rapide
      const employeeMap = new Map((employeesData.data || []).map(emp => [emp.id, emp]))
      const warehouseMap = new Map((warehousesData.data || []).map(wh => [wh.id, wh]))
      
      // Enrichir les factures avec les données + recompute paid/remaining/status from payments
      const enrichedInvoices = (invoicesData || []).map((invoice: any) => {
        const payments = Array.isArray(invoice.payments) ? invoice.payments : []
        const completedPaymentsTotal = payments
          .filter((p: any) => p?.status === 'completed')
          .reduce((sum: number, p: any) => sum + Number(p?.amount || 0), 0)

        const totalAmount = Number(invoice.total_amount || 0)
        const paidAmountFromInvoice = Number(invoice.paid_amount || 0)
        const computedPaidAmount = paidAmountFromInvoice > 0 ? paidAmountFromInvoice : completedPaymentsTotal
        const computedRemaining = Math.max(0, totalAmount - computedPaidAmount)

        const latestPayment = payments
          .slice()
          .sort((a: any, b: any) => {
            const da = new Date(a?.created_at || a?.payment_date || 0).getTime()
            const db = new Date(b?.created_at || b?.payment_date || 0).getTime()
            return db - da
          })[0]

        const computedPaymentStatus = computedRemaining === 0
          ? 'paid'
          : (computedPaidAmount > 0 ? 'partial' : 'unpaid')

        const finalPaymentStatus = (invoice.payment_status === 'credit')
          ? 'credit'
          : computedPaymentStatus

        return {
          ...invoice,
          paid_amount: computedPaidAmount,
          remaining_amount: computedRemaining,
          payment_method: latestPayment?.payment_method || null,
          payment_status: finalPaymentStatus,
          employee: invoice.employee_id ? employeeMap.get(invoice.employee_id) || null : null,
          warehouse: invoice.warehouse_id ? warehouseMap.get(invoice.warehouse_id) || null : null,
        }
      })
      
      setInvoices(enrichedInvoices)
    } catch (error) {
      console.error('Error loading invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculer les statistiques
  const stats = {
    totalInvoices: invoices.length,
    totalAmount: invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0),
    paidAmount: invoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0),
    remainingAmount: invoices.reduce((sum, inv) => sum + (inv.remaining_amount || 0), 0),
    paidCount: invoices.filter(inv => (inv.payment_status || '') === 'paid').length,
    partialCount: invoices.filter(inv => (inv.payment_status || '') === 'partial').length,
    creditCount: invoices.filter(inv => (inv.payment_status || '') === 'credit').length,
  }

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = (invoice.client_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (invoice.company_name_ar || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (invoice.invoice_number || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || (invoice.payment_status || '') === filterStatus
    
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1">
            <CheckCircle size={14} />
            مدفوعة
          </span>
        )
      case 'partial':
        return (
          <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1">
            <Clock size={14} />
            جزئية
          </span>
        )
      case 'unpaid':
        return (
          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1">
            <AlertCircle size={14} />
            غير مدفوعة
          </span>
        )
      case 'credit':
        return (
          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1">
            <AlertCircle size={14} />
            دين
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

  const remaining = (invoice: Invoice) => invoice.remaining_amount || ((invoice.total_amount || 0) - (invoice.paid_amount || 0))

  const getPaymentTypeDisplay = (paymentMethod: string | null | undefined) => {
    if (!paymentMethod) return '-'
    
    switch (paymentMethod) {
      case 'cash':
        return (
          <span className="flex items-center gap-1 text-green-700 font-semibold">
            <DollarSign size={16} />
            نقدي
          </span>
        )
      case 'check':
        return (
          <span className="flex items-center gap-1 text-blue-700 font-semibold">
            <FileText size={16} />
            شيك
          </span>
        )
      case 'debt':
        return (
          <span className="flex items-center gap-1 text-orange-700 font-semibold">
            <Clock size={16} />
            دين
          </span>
        )
      default:
        return paymentMethod
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <FileText className="text-white" size={36} />
          المبيعات
        </h1>
        <button
            onClick={() => window.location.href = '/pos'}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
          >
            <Plus size={20} />
            بيع جديد
          </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">إجمالي الفواتير</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalInvoices}</p>
            </div>
            <FileText className="text-blue-600" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">إجمالي المبيعات</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalAmount.toFixed(2)} MAD</p>
            </div>
            <DollarSign className="text-green-600" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-emerald-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">المدفوع</p>
              <p className="text-2xl font-bold text-gray-800">{stats.paidAmount.toFixed(2)} MAD</p>
            </div>
            <CheckCircle className="text-emerald-600" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">المتبقي</p>
              <p className="text-2xl font-bold text-gray-800">{stats.remainingAmount.toFixed(2)} MAD</p>
            </div>
            <AlertCircle className="text-red-600" size={32} />
          </div>
        </div>
      </div>

      {/* Statistiques détaillées */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-700 text-sm font-semibold">فواتير مدفوعة</p>
              <p className="text-xl font-bold text-green-800">{stats.paidCount}</p>
            </div>
            <CheckCircle className="text-green-600" size={24} />
          </div>
        </div>

        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-700 text-sm font-semibold">فواتير جزئية</p>
              <p className="text-xl font-bold text-yellow-800">{stats.partialCount}</p>
            </div>
            <Clock className="text-yellow-600" size={24} />
          </div>
        </div>

        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-700 text-sm font-semibold">فواتير دين</p>
              <p className="text-xl font-bold text-red-800">{stats.creditCount}</p>
            </div>
            <AlertCircle className="text-red-600" size={24} />
          </div>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute right-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="ابحث عن فاتورة أو عميل..."
              className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
          >
            <option value="all">كل الحالات</option>
            <option value="unpaid">غير مدفوعة</option>
            <option value="paid">مدفوعة</option>
            <option value="partial">جزئية</option>
            <option value="credit">دين</option>
          </select>

          <div className="flex items-center justify-center text-sm text-gray-600">
            {filteredInvoices.length} فاتورة
          </div>
        </div>
      </div>

      {/* Tableau des factures */}
      <div className="bg-white rounded-xl shadow-lg">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            جاري التحميل...
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            لا توجد فواتير
          </div>
        ) : (
          <div className="overflow-x-auto w-full pb-2">
            <table className="w-full min-w-max">
              <thead className="bg-gradient-to-r from-blue-600 to-blue-700" style={{ color: '#000000' }}>
                <tr>
                  <th className="px-6 py-4 text-right font-bold" style={{ color: '#000000' }}>رقم الفاتورة</th>
                  <th className="px-6 py-4 text-right font-bold" style={{ color: '#000000' }}>العميل</th>
                  <th className="px-6 py-4 text-right font-bold" style={{ color: '#000000' }}>التاريخ</th>
                  <th className="px-6 py-4 text-right font-bold" style={{ color: '#000000' }}>البائع</th>
                  <th className="px-6 py-4 text-right font-bold" style={{ color: '#000000' }}>المخزن</th>
                  <th className="px-6 py-4 text-right font-bold" style={{ color: '#000000' }}>الكمية</th>
                  <th className="px-6 py-4 text-right font-bold" style={{ color: '#000000' }}>المجموع</th>
                  <th className="px-6 py-4 text-right font-bold" style={{ color: '#000000' }}>المدفوع</th>
                  <th className="px-6 py-4 text-right font-bold" style={{ color: '#000000' }}>الباقي</th>
                  <th className="px-6 py-4 text-right font-bold" style={{ color: '#000000' }}>نوع الدفع</th>
                  <th className="px-6 py-4 text-right font-bold" style={{ color: '#000000' }}>الحالة</th>
                  <th className="px-6 py-4 text-right font-bold" style={{ color: '#000000' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b hover:bg-blue-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-800">
                        #{invoice.invoice_number || invoice.id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-700">
                        {invoice.client_name || invoice.company_name_ar || 'عميل عام'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(invoice.invoice_date).toLocaleDateString('ar-DZ')}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-700">{invoice.employee?.name || 'غير محدد'}</p>
                        <p className="text-sm text-gray-500">{invoice.employee?.role || ''}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-700">{invoice.warehouse?.name || 'غير محدد'}</p>
                        <p className="text-sm text-gray-500">{invoice.warehouse?.is_active ? 'نشط' : 'غير نشط'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-blue-600">{getInvoiceTotalQuantity(invoice)}</span>
                        <span className="text-xs text-gray-500">منتج</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-gray-800">
                        {(invoice.total_amount || 0).toFixed(2)} MAD
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-green-600">
                        {(invoice.paid_amount || 0).toFixed(2)} MAD
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-bold text-lg ${
                        remaining(invoice) > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {remaining(invoice).toFixed(2)} MAD
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getPaymentTypeDisplay(invoice.payment_method)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(invoice.payment_status || '')}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => {
                          // Ouvrir les détails de la facture
                          window.location.href = `/invoices/${invoice.id}/edit`
                        }}
                        className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-2 rounded-lg transition-colors"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm mb-1">إجمالي المبيعات</p>
              <p className="text-2xl font-bold">
                {filteredInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0).toFixed(2)} MAD
              </p>
            </div>
            <FileText size={32} className="text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm mb-1">المدفوع</p>
              <p className="text-2xl font-bold">
                {filteredInvoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0).toFixed(2)} MAD
              </p>
            </div>
            <CheckCircle size={32} className="text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm mb-1">الديون</p>
              <p className="text-2xl font-bold">
                {filteredInvoices.reduce((sum, inv) => sum + remaining(inv), 0).toFixed(2)} MAD
              </p>
            </div>
            <AlertCircle size={32} className="text-red-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm mb-1">عدد الفواتير</p>
              <p className="text-2xl font-bold">{filteredInvoices.length}</p>
            </div>
            <DollarSign size={32} className="text-purple-200" />
          </div>
        </div>
      </div>

      {/* Modal de création de facture */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">إنشاء فاتورة جديدة</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Informations client */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">اسم العميل</label>
                  <input
                    type="text"
                    value={formData.client_name}
                    onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="اسم العميل"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">هاتف العميل</label>
                  <input
                    type="tel"
                    value={formData.client_phone}
                    onChange={(e) => setFormData({...formData, client_phone: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="هاتف العميل"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">عنوان العميل</label>
                  <input
                    type="text"
                    value={formData.client_address}
                    onChange={(e) => setFormData({...formData, client_address: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="عنوان العميل"
                  />
                </div>
              </div>

              {/* Produits */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">إضافة المنتجات</h3>
                
                {/* Liste des produits disponibles */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-md font-medium text-gray-700 mb-3">المنتجات المتاحة</h4>
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                      {loadingProducts ? (
                        <div className="p-4 text-center text-gray-500">جاري التحميل...</div>
                      ) : (
                        <div className="divide-y divide-gray-200">
                          {products.map((product) => (
                            <div key={product.id} className="p-3 hover:bg-gray-50">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="font-medium text-gray-800">{product.name_ar}</p>
                                  <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                                  <p className="text-sm text-gray-500">المخزون: {product.stock}</p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => addProductToInvoice(product, 'unit', 1)}
                                    className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                                  >
                                    وحدة
                                  </button>
                                  <button
                                    onClick={() => addProductToInvoice(product, 'kg', 1)}
                                    className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                                  >
                                    كيلو
                                  </button>
                                  <button
                                    onClick={() => addProductToInvoice(product, 'carton', 1)}
                                    className="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600"
                                  >
                                    كرتون
                                  </button>
                                </div>
                              </div>
                              <div className="flex gap-4 text-sm text-gray-600">
                                <span>سعر الوحدة: {product.price_a} MAD</span>
                                <span>سعر الكيلو: {product.price_b} MAD</span>
                                <span>سعر الكرتون: {product.price_c} MAD</span>
                              </div>
                              {product.barcode && (
                                <div className="flex items-center gap-2 mt-2">
                                  <Barcode size={16} className="text-gray-400" />
                                  <span className="text-sm text-gray-600">{product.barcode}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Produits sélectionnés */}
                  <div>
                    <h4 className="text-md font-medium text-gray-700 mb-3">المنتجات المضافة</h4>
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                      {selectedProducts.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">لم يتم إضافة أي منتج بعد</div>
                      ) : (
                        <div className="divide-y divide-gray-200">
                          {selectedProducts.map((item) => (
                            <div key={item.id} className="p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-gray-800">{item.product_name_ar}</p>
                                  <p className="text-sm text-gray-500">
                                    {item.unit_type === 'unit' ? 'وحدة' : 
                                     item.unit_type === 'kg' ? 'كيلو' : 'كرتون'} × {item.quantity}
                                  </p>
                                  <p className="text-sm text-gray-500">{item.unit_price} MAD / {item.unit_type}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-800">{item.line_total} MAD</span>
                                  <button
                                    onClick={() => removeProductFromInvoice(item.id)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                              {item.barcode && (
                                <div className="flex items-center gap-2 mt-2">
                                  <Barcode size={14} className="text-gray-400" />
                                  <span className="text-xs text-gray-600">{item.barcode}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="ملاحظات إضافية..."
                />
              </div>

              {/* Total et actions */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-semibold text-gray-800">المجموع:</span>
                  <span className="text-2xl font-bold text-blue-600">{calculateTotal().toFixed(2)} MAD</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={createInvoice}
                    disabled={selectedProducts.length === 0}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    إنشاء الفاتورة
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
