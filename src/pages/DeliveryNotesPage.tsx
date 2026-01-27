import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Eye, FileText, Clock, CheckCircle, Package, Truck, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface DeliveryNote {
  id: string
  note_number: string
  delivery_date: string
  client_name: string
  client_phone: string
  client_address: string
  company_name: string
  company_name_ar: string
  order_id?: string
  order_number?: string
  order?: {
    id: string
    order_number: string
    status: string
    payment_status: 'pending' | 'partial' | 'paid' | 'refunded'
  }
  items: DeliveryItem[]
  notes?: string
  status: string
  created_at: string
}

interface DeliveryItem {
  description: string
  quantity: number
  unit: string
  condition: string
}

export default function DeliveryNotesPage() {
  const navigate = useNavigate()
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPayment, setFilterPayment] = useState<string>('all')
  const [selectedNote, setSelectedNote] = useState<DeliveryNote | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  useEffect(() => {
    fetchDeliveryNotes()
  }, [])

  const fetchDeliveryNotes = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('delivery_notes')
        .select(`
          *,
          order:orders(
            id,
            order_number,
            status,
            payment_status
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDeliveryNotes(data || [])
    } catch (error) {
      console.error('Error fetching delivery notes:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredNotes = deliveryNotes.filter(note => {
    const matchesSearch = 
      note.note_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.company_name_ar.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || note.status === filterStatus
    const matchesPayment = filterPayment === 'all' || note.order?.payment_status === filterPayment
    
    return matchesSearch && matchesStatus && matchesPayment
  })

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-red-100 text-red-800'
      case 'partial': return 'bg-orange-100 text-orange-800'
      case 'paid': return 'bg-green-100 text-green-800'
      case 'refunded': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'confirmed': return 'bg-blue-100 text-blue-800'
      case 'processing': return 'bg-purple-100 text-purple-800'
      case 'shipped': return 'bg-indigo-100 text-indigo-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />
      case 'confirmed': return <CheckCircle className="w-4 h-4" />
      case 'processing': return <Package className="w-4 h-4" />
      case 'shipped': return <Truck className="w-4 h-4" />
      case 'delivered': return <CheckCircle className="w-4 h-4" />
      case 'cancelled': return <XCircle className="w-4 h-4" />
      default: return null
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-800' },
      sent: { label: 'أرسلت', color: 'bg-blue-100 text-blue-800' },
      delivered: { label: 'سلمت', color: 'bg-green-100 text-green-800' },
      cancelled: { label: 'ملغاة', color: 'bg-red-100 text-red-800' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
    )
  }

  const viewDetails = (note: DeliveryNote) => {
    setSelectedNote(note)
    setShowDetailsModal(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">سجلات التسليم</h1>
            </div>
            <button
              onClick={() => navigate('/delivery-notes/create')}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus size={20} />
              <span>إنشاء بون تسليم</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute right-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="بحث بالرقم أو العميل..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">جميع الحالات</option>
              <option value="pending">في الانتظار</option>
              <option value="confirmed">مؤكد</option>
              <option value="processing">قيد المعالجة</option>
              <option value="shipped">تم الشحن</option>
              <option value="delivered">تم التسليم</option>
              <option value="cancelled">ملغي</option>
            </select>
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">جميع المدفوعات</option>
              <option value="pending">لم يدفع</option>
              <option value="partial">مدفوع جزئياً</option>
              <option value="paid">مدفوع</option>
              <option value="refunded">مسترد</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  رقم البون
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  التاريخ
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  العميل
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الشركة
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  حالة الطلب
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الدفع
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredNotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p>لا توجد سجلات تسليم</p>
                  </td>
                </tr>
              ) : (
                filteredNotes.map((note) => (
                  <tr key={note.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {note.note_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(note.delivery_date).toLocaleDateString('ar-MA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {note.client_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {note.company_name_ar}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {note.order ? (
                        <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 w-fit ${getStatusColor(note.order.status)}`}>
                          {getStatusIcon(note.order.status)}
                          {note.order.status === 'pending' ? 'في الانتظار' :
                           note.order.status === 'confirmed' ? 'مؤكد' :
                           note.order.status === 'processing' ? 'قيد المعالجة' :
                           note.order.status === 'shipped' ? 'تم الشحن' :
                           note.order.status === 'delivered' ? 'تم التسليم' :
                           note.order.status === 'cancelled' ? 'ملغي' : note.order.status}
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                          لا يوجد أمر
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {note.order ? (
                        <span className={`px-2 py-1 text-xs rounded-full ${getPaymentStatusColor(note.order.payment_status)}`}>
                          {note.order.payment_status === 'pending' ? 'لم يدفع' :
                           note.order.payment_status === 'partial' ? 'مدفوع جزئياً' :
                           note.order.payment_status === 'paid' ? 'مدفوع' :
                           note.order.payment_status === 'refunded' ? 'مسترد' : note.order.payment_status}
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                          لا يوجد أمر
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-left space-x-2 space-x-reverse">
                        <button
                          onClick={() => viewDetails(note)}
                          className="text-blue-600 hover:text-blue-900"
                          title="عرض التفاصيل"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">تفاصيل بون التسليم</h2>
                  <p className="text-gray-600">رقم: {selectedNote.note_number}</p>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">إغلاق</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">معلومات العميل</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">الاسم:</span> {selectedNote.client_name}</p>
                    <p><span className="font-medium">الهاتف:</span> {selectedNote.client_phone || '—'}</p>
                    <p><span className="font-medium">العنوان:</span> {selectedNote.client_address || '—'}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">معلومات الشركة</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">الاسم:</span> {selectedNote.company_name_ar}</p>
                    <p><span className="font-medium">التاريخ:</span> {new Date(selectedNote.delivery_date).toLocaleDateString('ar-MA')}</p>
                    <p><span className="font-medium">الحالة:</span> {getStatusBadge(selectedNote.status)}</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">المنتجات</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">الوصف</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">الكمية</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">الوحدة</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedNote.items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-2 text-sm">{item.description}</td>
                          <td className="px-4 py-2 text-sm">{item.quantity}</td>
                          <td className="px-4 py-2 text-sm">{item.unit}</td>
                          <td className="px-4 py-2 text-sm">{item.condition}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedNote.notes && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">ملاحظات</h3>
                  <p className="text-sm text-gray-600">{selectedNote.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
