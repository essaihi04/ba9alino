import { useEffect, useState } from 'react'
import { Search, Plus, Package, TrendingUp, Edit2, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Warehouse {
  id: string
  name: string
  address?: string
  manager_id?: string
  is_active: boolean
  created_at: string
  manager?: {
    id: string
    email: string
    user_metadata?: {
      first_name?: string
      last_name?: string
    }
  }
  stock_count?: number
  total_stock?: number
  low_stock_count?: number
  out_of_stock_count?: number
  stock_value?: number
}

interface WarehouseStock {
  id: string
  warehouse_id: string
  product_id: string
  quantity: number
  min_alert_level: number
  updated_at: string
  product?: {
    id: string
    name_ar: string
    sku: string
    cost_price?: number
    price_a: number
  }
}

interface StockMovement {
  id: string
  warehouse_id: string
  product_id: string
  type: 'sale' | 'purchase' | 'transfer' | 'adjustment' | 'return'
  quantity: number
  source_reference?: string
  created_by?: string
  created_at: string
  product?: {
    id: string
    name_ar: string
    sku: string
  }
  created_by_user?: {
    email: string
    user_metadata?: {
      first_name?: string
      last_name?: string
    }
  }
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)
  const [warehouseStock, setWarehouseStock] = useState<WarehouseStock[]>([])
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [showMovementsModal, setShowMovementsModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    manager_id: '',
  })

  useEffect(() => {
    loadWarehouses()
  }, [])

  const loadWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Get manager information for each warehouse
      const warehousesWithManagers = await Promise.all(
        (data || []).map(async (warehouse) => {
          let manager = null
          if (warehouse.manager_id) {
            const { data: managerData } = await supabase.auth.admin.getUserById(warehouse.manager_id)
            manager = managerData?.user ? {
              id: managerData.user.id,
              email: managerData.user.email || '',
              user_metadata: managerData.user.user_metadata || {}
            } : null
          }

          return {
            ...warehouse,
            manager
          }
        })
      )

      // Get stock statistics for each warehouse
      const warehousesWithStats = await Promise.all(
        (warehousesWithManagers || []).map(async (warehouse) => {
          const { data: stockData } = await supabase
            .from('warehouse_stock')
            .select('quantity, min_alert_level')
            .eq('warehouse_id', warehouse.id)

          const stockStats = {
            stock_count: stockData?.length || 0,
            total_stock: stockData?.reduce((sum, item) => sum + item.quantity, 0) || 0,
            low_stock_count: stockData?.filter(item => item.quantity > 0 && item.quantity <= item.min_alert_level).length || 0,
            out_of_stock_count: stockData?.filter(item => item.quantity === 0).length || 0,
          }

          return {
            ...warehouse,
            ...stockStats
          }
        })
      )

      setWarehouses(warehousesWithStats)
    } catch (error) {
      console.error('Error loading warehouses:', error)
    }
  }

  const loadWarehouseStock = async (warehouseId: string) => {
    try {
      const { data, error } = await supabase
        .from('warehouse_stock')
        .select(`
          *,
          product:products(id, name_ar, sku, cost_price, price_a)
        `)
        .eq('warehouse_id', warehouseId)
        .order('updated_at', { ascending: false })

      if (error) throw error
      setWarehouseStock(data || [])
    } catch (error) {
      console.error('Error loading warehouse stock:', error)
    }
  }

  const loadStockMovements = async (warehouseId: string) => {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          product:products(id, name_ar, sku)
        `)
        .eq('warehouse_id', warehouseId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      // Get user information for each movement
      const movementsWithUsers = await Promise.all(
        (data || []).map(async (movement) => {
          let created_by_user = null
          if (movement.created_by) {
            const { data: userData } = await supabase.auth.admin.getUserById(movement.created_by)
            created_by_user = userData?.user ? {
              email: userData.user.email || '',
              user_metadata: userData.user.user_metadata || {}
            } : null
          }
          return {
            ...movement,
            created_by_user
          }
        })
      )

      setStockMovements(movementsWithUsers)
    } catch (error) {
      console.error('Error loading stock movements:', error)
    }
  }

  const handleAddWarehouse = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('warehouses')
        .insert({
          name: formData.name,
          address: formData.address || null,
          manager_id: formData.manager_id || null,
        })

      if (error) throw error

      setShowAddModal(false)
      setFormData({ name: '', address: '', manager_id: '' })
      await loadWarehouses()
      alert('✅ تم إضافة المخزن بنجاح')
    } catch (error) {
      console.error('Error adding warehouse:', error)
      alert('❌ حدث خطأ')
    }
  }

  const handleEditWarehouse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWarehouse) return

    try {
      const { error } = await supabase
        .from('warehouses')
        .update({
          name: formData.name,
          address: formData.address || null,
          manager_id: formData.manager_id || null,
        })
        .eq('id', selectedWarehouse.id)

      if (error) throw error

      setShowEditModal(false)
      setSelectedWarehouse(null)
      setFormData({ name: '', address: '', manager_id: '' })
      await loadWarehouses()
      alert('✅ تم تحديث المخزن بنجاح')
    } catch (error) {
      console.error('Error updating warehouse:', error)
      alert('❌ حدث خطأ')
    }
  }

  const handleDeleteWarehouse = async (warehouseId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المخزن نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.')) return

    try {
      // Vérifier si le dépôt a du stock
      const { data: stockData } = await supabase
        .from('warehouse_stock')
        .select('quantity')
        .eq('warehouse_id', warehouseId)
        .gt('quantity', 0)

      if (stockData && stockData.length > 0) {
        alert('❌ لا يمكن حذف مخزن يحتوي على منتجات. يجب نقل أو بيع كل المخزون أولاً.')
        return
      }

      // Vérifier s'il y a des commandes liées
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id')
        .eq('warehouse_id', warehouseId)

      if (ordersData && ordersData.length > 0) {
        alert('❌ لا يمكن حذف مخزن مرتبط بطلبات. يجب حذف أو تعديل الطلبات أولاً.')
        return
      }

      // Vérifier s'il y a des transferts liés
      const { data: transfersData } = await supabase
        .from('stock_transfers')
        .select('id')
        .or(`from_warehouse_id.eq.${warehouseId},to_warehouse_id.eq.${warehouseId}`)

      if (transfersData && transfersData.length > 0) {
        alert('❌ لا يمكن حذف مخزن مرتبط بتحويلات مخزون. سيتم تعطيله بدل الحذف.')
        const { error: deactivateErr } = await supabase
          .from('warehouses')
          .update({ is_active: false })
          .eq('id', warehouseId)

        if (deactivateErr) throw deactivateErr

        await loadWarehouses()
        alert('✅ تم تعطيل المخزن بنجاح')
        return
      }

      // Supprimer définitivement le dépôt
      const { error } = await supabase
        .from('warehouses')
        .delete()
        .eq('id', warehouseId)

      if (error) throw error

      await loadWarehouses()
      alert('✅ تم حذف المخزن بنجاح')
    } catch (error) {
      console.error('Error deleting warehouse:', error)

      const err: any = error
      if (err?.code === '23503') {
        try {
          const { error: deactivateErr } = await supabase
            .from('warehouses')
            .update({ is_active: false })
            .eq('id', warehouseId)

          if (deactivateErr) throw deactivateErr

          await loadWarehouses()
          alert('✅ لا يمكن حذف المخزن لأنه مرتبط ببيانات أخرى، تم تعطيله بدل الحذف')
          return
        } catch (e) {
          console.error('Error deactivating warehouse after delete failure:', e)
        }
      }

      alert('❌ حدث خطأ أثناء حذف المخزن')
    }
  }

  const openEditModal = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse)
    setFormData({
      name: warehouse.name,
      address: warehouse.address || '',
      manager_id: warehouse.manager_id || '',
    })
    setShowEditModal(true)
  }

  const openStockModal = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse)
    loadWarehouseStock(warehouse.id)
    setShowStockModal(true)
  }

  const openMovementsModal = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse)
    loadStockMovements(warehouse.id)
    setShowMovementsModal(true)
  }

  const filteredWarehouses = warehouses.filter(warehouse =>
    warehouse.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warehouse.address?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'sale': return 'بيع'
      case 'purchase': return 'شراء'
      case 'transfer': return 'نقل'
      case 'adjustment': return 'تعديل'
      case 'return': return 'مرتجع'
      default: return type
    }
  }

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'sale': return 'text-red-600 bg-red-100'
      case 'purchase': return 'text-green-600 bg-green-100'
      case 'transfer': return 'text-blue-600 bg-blue-100'
      case 'adjustment': return 'text-yellow-600 bg-yellow-100'
      case 'return': return 'text-purple-600 bg-purple-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Package className="text-white" size={36} />
          المخازن
        </h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
        >
          <Plus size={20} />
          إضافة مخزن
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="relative">
          <Search className="absolute right-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="ابحث عن مخزن..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Warehouses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWarehouses.map((warehouse) => (
          <div key={warehouse.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800">{warehouse.name}</h3>
                {warehouse.address && (
                  <p className="text-gray-600 text-sm mt-1">{warehouse.address}</p>
                )}
                {warehouse.manager && (
                  <p className="text-gray-500 text-sm mt-1">
                    المدير: {warehouse.manager.user_metadata?.first_name || ''} {warehouse.manager.user_metadata?.last_name || warehouse.manager.email}
                  </p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">المنتجات</p>
                <p className="text-lg font-bold text-gray-800">{warehouse.stock_count || 0}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">إجمالي المخزون</p>
                <p className="text-lg font-bold text-gray-800">{warehouse.total_stock || 0}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <p className="text-orange-500 text-xs">منخفض</p>
                <p className="text-lg font-bold text-orange-700">{warehouse.low_stock_count || 0}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-red-500 text-xs">نفد</p>
                <p className="text-lg font-bold text-red-700">{warehouse.out_of_stock_count || 0}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => openStockModal(warehouse)}
                className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
              >
                <Package size={14} />
                المخزون
              </button>
              <button
                onClick={() => openMovementsModal(warehouse)}
                className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1"
              >
                <TrendingUp size={14} />
                الحركات
              </button>
              <button
                onClick={() => openEditModal(warehouse)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => handleDeleteWarehouse(warehouse.id)}
                className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                title="حذف نهائي"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Warehouse Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-800 mb-4">إضافة مخزن جديد</h2>
            <form onSubmit={handleAddWarehouse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">اسم المخزن</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">العنوان</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  إضافة
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Warehouse Modal */}
      {showEditModal && selectedWarehouse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-800 mb-4">تعديل المخزن</h2>
            <form onSubmit={handleEditWarehouse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">اسم المخزن</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">العنوان</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  تحديث
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Modal */}
      {showStockModal && selectedWarehouse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">المخزون - {selectedWarehouse.name}</h2>
              <button
                onClick={() => setShowStockModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-right p-3 text-gray-700">المنتج</th>
                    <th className="text-right p-3 text-gray-700">الرمز</th>
                    <th className="text-right p-3 text-gray-700">الكمية</th>
                    <th className="text-right p-3 text-gray-700">حد الإنذار</th>
                    <th className="text-right p-3 text-gray-700">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouseStock.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{item.product?.name_ar}</td>
                      <td className="p-3">{item.product?.sku}</td>
                      <td className="p-3 font-medium">{item.quantity}</td>
                      <td className="p-3">{item.min_alert_level}</td>
                      <td className="p-3">
                        {item.quantity === 0 ? (
                          <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">
                            نفد
                          </span>
                        ) : item.quantity <= item.min_alert_level ? (
                          <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-bold">
                            منخفض
                          </span>
                        ) : (
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">
                            جيد
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Movements Modal */}
      {showMovementsModal && selectedWarehouse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">حركات المخزون - {selectedWarehouse.name}</h2>
              <button
                onClick={() => setShowMovementsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-right p-3 text-gray-700">التاريخ</th>
                    <th className="text-right p-3 text-gray-700">المنتج</th>
                    <th className="text-right p-3 text-gray-700">النوع</th>
                    <th className="text-right p-3 text-gray-700">الكمية</th>
                    <th className="text-right p-3 text-gray-700">بواسطة</th>
                  </tr>
                </thead>
                <tbody>
                  {stockMovements.map((movement) => (
                    <tr key={movement.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{new Date(movement.created_at).toLocaleDateString('ar-DZ')}</td>
                      <td className="p-3">{movement.product?.name_ar}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getMovementTypeColor(movement.type)}`}>
                          {getMovementTypeLabel(movement.type)}
                        </span>
                      </td>
                      <td className="p-3 font-medium">{movement.quantity}</td>
                      <td className="p-3 text-sm text-gray-600">
                        {movement.created_by_user?.user_metadata?.first_name || ''} {movement.created_by_user?.user_metadata?.last_name || movement.created_by_user?.email}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
