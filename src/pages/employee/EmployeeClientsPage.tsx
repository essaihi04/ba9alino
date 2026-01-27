import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Plus, Eye, Search, Phone, MapPin, DollarSign } from 'lucide-react'

interface Client {
  id: string
  company_name_ar: string
  company_name_en: string
  contact_person_name: string
  contact_person_phone: string
  contact_person_email: string
  billing_address_ar: string
  city: string
  subscription_tier: string
  credit_limit: number
  created_at: string
}

export default function EmployeeClientsPage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  useEffect(() => {
    const employeeId = localStorage.getItem('employee_id')
    if (!employeeId) {
      navigate('/employee/login')
      return
    }
    loadClients()
  }, [navigate])

  const loadClients = async () => {
    setLoading(true)
    try {
      const employeeId = localStorage.getItem('employee_id')
      if (!employeeId) {
        navigate('/employee/login')
        return
      }

      console.log('Loading clients for employee:', employeeId)
      
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('created_by', employeeId)
        .order('company_name_ar')

      if (error) throw error
      console.log('Employee clients loaded:', data?.length, 'clients')
      setClients(data || [])
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredClients = clients.filter(client =>
    client.company_name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.contact_person_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.contact_person_phone.includes(searchQuery)
  )

  return (
    <div className="min-h-screen bg-gray-100" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-600 to-cyan-800 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/employee/dashboard')}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-bold">العملاء</h1>
              <p className="text-cyan-100">إدارة قائمة العملاء والمعلومات</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/employee/clients/new')}
            className="bg-white text-cyan-600 px-6 py-3 rounded-lg font-bold hover:bg-cyan-50 transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            عميل جديد
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Search */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="relative">
            <Search className="absolute right-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-3 border-2 border-gray-300 rounded-lg focus:border-cyan-500 focus:outline-none"
              placeholder="ابحث عن عميل أو اسم أو هاتف..."
            />
          </div>
        </div>

        {/* Clients Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-12 text-gray-500">جاري التحميل...</div>
          ) : filteredClients.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">لا توجد عملاء</div>
          ) : (
            filteredClients.map((client) => (
              <div key={client.id} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800">{client.company_name_ar}</h3>
                    <p className="text-sm text-gray-500">{client.company_name_en}</p>
                  </div>
                  <div className="bg-cyan-100 text-cyan-700 px-3 py-1 rounded-full text-sm font-bold">
                    {client.subscription_tier}
                  </div>
                </div>

                <div className="space-y-3 mb-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Phone size={16} className="text-cyan-600" />
                    <span>{client.contact_person_phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <span className="font-medium">المسؤول:</span>
                    <span>{client.contact_person_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <MapPin size={16} className="text-cyan-600" />
                    <span>{client.city}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <DollarSign size={16} className="text-green-600" />
                    <span>حد الائتمان: {client.credit_limit.toFixed(2)} MAD</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedClient(client)
                    setShowDetailsModal(true)
                  }}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Eye size={16} />
                  عرض التفاصيل
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 text-white p-6">
              <h2 className="text-2xl font-bold">{selectedClient.company_name_ar}</h2>
              <p className="text-cyan-100">{selectedClient.company_name_en}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-bold text-gray-800 mb-4">معلومات الشركة</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-gray-600">الاسم بالعربية:</p>
                      <p className="font-medium text-gray-800">{selectedClient.company_name_ar}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">الاسم بالإنجليزية:</p>
                      <p className="font-medium text-gray-800">{selectedClient.company_name_en}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">الفئة:</p>
                      <p className="font-medium text-cyan-600">{selectedClient.subscription_tier}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">المدينة:</p>
                      <p className="font-medium text-gray-800">{selectedClient.city}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-gray-800 mb-4">معلومات الاتصال</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-gray-600">اسم المسؤول:</p>
                      <p className="font-medium text-gray-800">{selectedClient.contact_person_name}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">الهاتف:</p>
                      <p className="font-medium text-gray-800">{selectedClient.contact_person_phone}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">البريد الإلكتروني:</p>
                      <p className="font-medium text-gray-800">{selectedClient.contact_person_email}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">العنوان:</p>
                      <p className="font-medium text-gray-800">{selectedClient.billing_address_ar}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-gray-800 mb-3">معلومات الائتمان</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">حد الائتمان:</p>
                    <p className="text-2xl font-bold text-green-600">{selectedClient.credit_limit.toFixed(2)} MAD</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">تاريخ الإنشاء:</p>
                    <p className="font-medium text-gray-800">{new Date(selectedClient.created_at).toLocaleDateString('ar-MA')}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t p-6 bg-gray-50">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
