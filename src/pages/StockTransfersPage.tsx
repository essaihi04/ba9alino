import { useEffect, useState } from 'react'
import { Search, Plus, ArrowRight, ArrowLeft, CheckCircle, XCircle, Clock, Trash2, Eye, Edit2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useInputPad } from '../components/useInputPad'

interface Warehouse {
  id: string
  name: string
  address?: string
  is_active: boolean
}

interface Product {
  id: string
  name_ar: string
  name_en?: string
  sku: string
  price: number
  cost_price?: number
  image_url?: string
  stock?: number
}

interface WarehouseStock {
  id: string
  warehouse_id: string
  product_id: string
  quantity: number
  min_alert_level: number
  product: Product
}

interface StockTransfer {
  id: string
  from_warehouse_id: string
  to_warehouse_id: string
  status: 'pending' | 'completed' | 'cancelled'
  created_at: string
  completed_at?: string
  from_warehouse?: Warehouse
  to_warehouse?: Warehouse
  items?: StockTransferItem[]
}

interface StockTransferItem {
  id: string
  transfer_id: string
  product_id: string
  quantity: number
  product: Product
}

export default function StockTransfersPage() {
  const inputPad = useInputPad()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [fromWarehouseStock, setFromWarehouseStock] = useState<WarehouseStock[]>([])
  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Formulaire de création
  const [fromWarehouse, setFromWarehouse] = useState('')
  const [toWarehouse, setToWarehouse] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<{product_id: string, quantity: number}[]>([])

  useEffect(() => {
    loadWarehouses()
    loadTransfers()
  }, [])

  useEffect(() => {
    if (fromWarehouse) {
      loadFromWarehouseStock(fromWarehouse)
    }
  }, [fromWarehouse])

  const loadWarehouses = async () => {
    console.log('🏢 Loading warehouses...')
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('is_active', true)
        .order('name')

      console.log('📋 Warehouses result:', { data, error })
      if (error) throw error
      setWarehouses(data || [])
    } catch (error) {
      console.error('❌ Error loading warehouses:', error)
    }
  }

  const loadFromWarehouseStock = async (warehouseId: string) => {
    console.log('🔍 Loading warehouse stock for:', warehouseId)
    try {
      const { data, error } = await supabase
        .from('warehouse_stock')
        .select(`
          *,
          product:products(id, name_ar, name_en, sku, price, cost_price, image_url, stock)
        `)
        .eq('warehouse_id', warehouseId)
        .gt('quantity', 0)
        .order('product(name_ar)')

      console.log('📦 Warehouse stock query result:', { data, error })

      // Si warehouse_stock est vide ou a une erreur, utiliser le fallback
      if (error || !data || data.length === 0) {
        if (error) {
          console.error('❌ Error loading warehouse stock:', error)
        } else {
          console.log('📦 Warehouse stock is empty, using fallback...')
        }
        console.log('🔄 Trying fallback to products table...')
        
        // Fallback: try loading products directly if warehouse_stock fails
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id, name_ar, name_en, sku, price, cost_price, image_url, stock')
          .eq('is_active', true)
          .gt('stock', 0)
          .order('name_ar')
        
        console.log('📋 Products fallback result:', { data: productsData, error: productsError })
        
        if (productsError) throw productsError
        
        // Convert products to warehouse_stock format
        const warehouseStockFormat = (productsData || []).map(product => ({
          id: product.id,
          warehouse_id: warehouseId,
          product_id: product.id,
          quantity: product.stock || 0,
          min_alert_level: 5,
          product: product
        }))
        
        console.log('🔄 Converted to warehouse stock format:', warehouseStockFormat)
        setFromWarehouseStock(warehouseStockFormat)
      } else {
        console.log('✅ Setting warehouse stock:', data)
        setFromWarehouseStock(data || [])
      }
    } catch (error) {
      console.error('💥 Critical error loading warehouse stock:', error)
      setFromWarehouseStock([])
    }
  }

  const loadTransfers = async () => {
    setLoading(true)
    try {
      // Charger les transferts sans les jointures
      const { data: transfersData, error: transfersError } = await supabase
        .from('stock_transfers')
        .select('*')
        .order('created_at', { ascending: false })

      if (transfersError) throw transfersError

      // Charger tous les dépôts
      const { data: warehousesData, error: warehousesError } = await supabase
        .from('warehouses')
        .select('id, name, address')

      if (warehousesError) throw warehousesError

      // Associer les dépôts aux transferts
      const transfersWithWarehouses = (transfersData || []).map(transfer => ({
        ...transfer,
        from_warehouse: warehousesData?.find(w => w.id === transfer.from_warehouse_id),
        to_warehouse: warehousesData?.find(w => w.id === transfer.to_warehouse_id)
      }))

      setTransfers(transfersWithWarehouses)
    } catch (error) {
      console.error('Error loading transfers:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTransferDetails = async (transferId: string) => {
    try {
      const { data, error } = await supabase
        .from('stock_transfer_items')
        .select(`
          *,
          product:products(id, name_ar, name_en, sku, price, cost_price)
        `)
        .eq('transfer_id', transferId)

      if (error) throw error
      
      const transfer = transfers.find(t => t.id === transferId)
      if (transfer) {
        setSelectedTransfer({
          ...transfer,
          items: data || []
        })
      }
    } catch (error) {
      console.error('Error loading transfer details:', error)
    }
  }

  const handleCreateTransfer = async () => {
    if (!fromWarehouse || !toWarehouse || selectedProducts.length === 0) {
      alert('❌ يرجى ملء جميع الحقول المطلوبة')
      return
    }

    if (fromWarehouse === toWarehouse) {
      alert('❌ لا يمكن النقل إلى نفس المخزن')
      return
    }

    try {
      // Créer le transfert
      const { data: transfer, error: transferError } = await supabase
        .from('stock_transfers')
        .insert({
          from_warehouse_id: fromWarehouse,
          to_warehouse_id: toWarehouse,
          status: 'pending'
        })
        .select()
        .single()

      if (transferError) throw transferError

      // Ajouter les produits au transfert
      const transferItems = selectedProducts.map(item => ({
        transfer_id: transfer.id,
        product_id: item.product_id,
        quantity: item.quantity
      }))

      const { error: itemsError } = await supabase
        .from('stock_transfer_items')
        .insert(transferItems)

      if (itemsError) throw itemsError

      // Réinitialiser le formulaire
      setShowCreateModal(false)
      setFromWarehouse('')
      setToWarehouse('')
      setSelectedProducts([])
      setSearchTerm('')
      
      await loadTransfers()
      alert('✅ تم إنشاء طلب النقل بنجاح')
    } catch (error) {
      console.error('Error creating transfer:', error)
      alert('❌ حدث خطأ أثناء إنشاء طلب النقل')
    }
  }

  const handleCompleteTransfer = async (transferId: string) => {
    if (!confirm('هل أنت متأكد من إتمام هذا النقل؟')) return

    try {
      // Essayer d'abord la fonction simplifiée
      const { error: simpleError } = await supabase.rpc('complete_stock_transfer_simple', {
        p_transfer_id: transferId
      })

      if (simpleError) {
        console.log('🔄 Simple function failed, trying original...')
        // Si la fonction simplifiée échoue, essayer l'originale
        const { error } = await supabase.rpc('complete_stock_transfer', {
          p_transfer_id: transferId
        })

        if (error) throw error
      }

      await loadTransfers()
      alert('✅ تم إتمام النقل بنجاح')
    } catch (error) {
      console.error('Error completing transfer:', error)
      alert('❌ حدث خطأ أثناء إتمام النقل: ' + (error as any)?.message || 'Erreur inconnue')
    }
  }

  const handleCancelTransfer = async (transferId: string) => {
    if (!confirm('هل أنت متأكد من إلغاء هذا النقل؟')) return

    try {
      const { error } = await supabase
        .from('stock_transfers')
        .update({ status: 'cancelled' })
        .eq('id', transferId)

      if (error) throw error

      await loadTransfers()
      alert('✅ تم إلغاء النقل')
    } catch (error) {
      console.error('Error cancelling transfer:', error)
      alert('❌ حدث خطأ أثناء إلغاء النقل')
    }
  }

  const addProductToTransfer = (productId: string, availableQuantity: number) => {
    const existing = selectedProducts.find(p => p.product_id === productId)
    if (existing) {
      setSelectedProducts(selectedProducts.map(p => 
        p.product_id === productId 
          ? { ...p, quantity: Math.min(p.quantity + 1, availableQuantity) }
          : p
      ))
    } else {
      setSelectedProducts([...selectedProducts, { product_id: productId, quantity: 1 }])
    }
  }

  const updateProductQuantity = (productId: string, quantity: number, availableQuantity: number) => {
    if (quantity <= 0) {
      setSelectedProducts(selectedProducts.filter(p => p.product_id !== productId))
    } else {
      setSelectedProducts(selectedProducts.map(p => 
        p.product_id === productId 
          ? { ...p, quantity: Math.min(quantity, availableQuantity) }
          : p
      ))
    }
  }

  const removeProductFromTransfer = (productId: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.product_id !== productId))
  }

  const openQuantityEditor = (productId: string) => {
    const stockItem = fromWarehouseStock.find(item => item.product_id === productId)
    const selected = selectedProducts.find(item => item.product_id === productId)
    if (!stockItem || !selected) return

    inputPad.open({
      title: `الكمية - ${stockItem.product.name_ar}`,
      mode: 'number',
      dir: 'ltr',
      min: 1,
      max: stockItem.quantity,
      initialValue: String(selected.quantity),
      onConfirm: (value) => {
        const parsed = parseInt(value, 10)
        if (Number.isNaN(parsed)) return
        updateProductQuantity(productId, parsed, stockItem.quantity)
      }
    })
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'في الانتظار'
      case 'completed': return 'مكتمل'
      case 'cancelled': return 'ملغي'
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      case 'completed': return 'text-green-600 bg-green-100'
      case 'cancelled': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={16} />
      case 'completed': return <CheckCircle size={16} />
      case 'cancelled': return <XCircle size={16} />
      default: return null
    }
  }

  const filteredStock = fromWarehouseStock.filter(item =>
    item.product.name_ar?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <ArrowRight className="text-white" size={36} />
          نقل المخزون
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
        >
          <Plus size={20} />
          طلب نقل جديد
        </button>
      </div>

      {/* Liste des transferts */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">طلبات النقل</h2>
        {loading ? (
          <div className="text-center py-12 text-gray-500">جاري التحميل...</div>
        ) : transfers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">لا توجد طلبات نقل</div>
        ) : (
          <div className="space-y-4">
            {transfers.map((transfer) => (
              <div key={transfer.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 ${getStatusColor(transfer.status)}`}>
                          {getStatusIcon(transfer.status)}
                          {getStatusLabel(transfer.status)}
                        </span>
                        <span className="text-gray-500 text-sm">
                          {new Date(transfer.created_at).toLocaleDateString('ar-DZ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="font-medium">{transfer.from_warehouse?.name}</span>
                        <ArrowLeft size={16} className="text-gray-400" />
                        <span className="font-medium">{transfer.to_warehouse?.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        loadTransferDetails(transfer.id)
                        setShowDetailsModal(true)
                      }}
                      className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Eye size={14} />
                    </button>
                    {transfer.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleCompleteTransfer(transfer.id)}
                          className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          <CheckCircle size={14} />
                        </button>
                        <button
                          onClick={() => handleCancelTransfer(transfer.id)}
                          className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          <XCircle size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de création de transfert */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-4">طلب نقل جديد</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">من المخزن</label>
                <select
                  value={fromWarehouse}
                  onChange={(e) => setFromWarehouse(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">اختر المخزن المصدر</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">إلى المخزن</label>
                <select
                  value={toWarehouse}
                  onChange={(e) => setToWarehouse(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                >
                  <option value="">اختر المخزن المستهدف</option>
                  {warehouses
                    .filter(w => w.id !== fromWarehouse)
                    .map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {fromWarehouse && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">اختر المنتجات</label>
                  <div className="relative">
                    <Search className="absolute right-3 top-3 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="ابحث عن منتج..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">المنتجات المتاحة</h3>
                    <div className="max-h-60 overflow-y-auto border rounded-lg p-2">
                      {filteredStock.map((item) => (
                        <div key={item.product_id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                          <div>
                            <div className="font-medium">{item.product.name_ar}</div>
                            <div className="text-sm text-gray-500">المتاح: {item.quantity}</div>
                          </div>
                          <button
                            onClick={() => addProductToTransfer(item.product_id, item.quantity)}
                            className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded text-sm"
                          >
                            إضافة
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">المنتجات المختارة</h3>
                    <div className="max-h-60 overflow-y-auto border rounded-lg p-2">
                      {selectedProducts.length === 0 ? (
                        <div className="text-center text-gray-500 py-4">لم يتم اختيار أي منتجات</div>
                      ) : (
                        selectedProducts.map((selected) => {
                          const stockItem = fromWarehouseStock.find(item => item.product_id === selected.product_id)
                          const product = stockItem?.product
                          return (
                            <div key={selected.product_id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                              <div>
                                <div className="font-medium">{product?.name_ar}</div>
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full text-sm font-semibold">
                                    {selected.quantity}
                                    <span className="text-xs text-gray-500">
                                      / {stockItem?.quantity || 0}
                                    </span>
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      openQuantityEditor(selected.product_id)
                                    }}
                                    className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded text-sm flex items-center gap-1"
                                  >
                                    <Edit2 size={12} />
                                    تعديل
                                  </button>
                                </div>
                              </div>
                              <button
                                onClick={() => removeProductFromTransfer(selected.product_id)}
                                className="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded text-sm"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleCreateTransfer}
                disabled={!fromWarehouse || !toWarehouse || selectedProducts.length === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-3 rounded-lg font-medium transition-colors"
              >
                إنشاء طلب النقل
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setFromWarehouse('')
                  setToWarehouse('')
                  setSelectedProducts([])
                  setSearchTerm('')
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal des détails du transfert */}
      {showDetailsModal && selectedTransfer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">تفاصيل طلب النقل</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 ${getStatusColor(selectedTransfer.status)}`}>
                  {getStatusIcon(selectedTransfer.status)}
                  {getStatusLabel(selectedTransfer.status)}
                </span>
                <span className="text-gray-500 text-sm">
                  {new Date(selectedTransfer.created_at).toLocaleDateString('ar-DZ')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{selectedTransfer.from_warehouse?.name}</span>
                <ArrowLeft size={16} className="text-gray-400" />
                <span className="font-medium">{selectedTransfer.to_warehouse?.name}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-right p-3 text-gray-700">المنتج</th>
                    <th className="text-right p-3 text-gray-700">الكمية</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTransfer.items?.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-3">{item.product.name_ar}</td>
                      <td className="p-3 font-medium">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {inputPad.Modal}
    </div>
  )
}
