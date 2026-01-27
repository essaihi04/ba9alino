import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Client {
  id: string
  company_name_ar: string
  company_name_en?: string
  contact_person_name: string
  contact_person_email: string
  contact_person_phone: string
  address?: string
  subscription_tier: string
  created_at?: string
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    company_name_ar: '',
    company_name_en: '',
    contact_person_name: '',
    contact_person_email: '',
    contact_person_phone: '',
    address: '',
    subscription_tier: 'A',
  })

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setClients(data || [])
    } catch (error) {
      console.error('Error fetching clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingClient) {
        // Update existing client
        const { error } = await supabase
          .from('clients')
          .update(formData)
          .eq('id', editingClient)
        
        if (error) throw error
      } else {
        // Add new client
        const { error } = await supabase
          .from('clients')
          .insert([formData])
        
        if (error) throw error
      }
      
      resetForm()
      setShowModal(false)
      fetchClients()
    } catch (error) {
      console.error('Error saving client:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      company_name_ar: '',
      company_name_en: '',
      contact_person_name: '',
      contact_person_email: '',
      contact_person_phone: '',
      address: '',
      subscription_tier: 'A',
    })
    setEditingClient(null)
  }

  const handleEditClient = (client: Client) => {
    setFormData({
      company_name_ar: client.company_name_ar,
      company_name_en: client.company_name_en || '',
      contact_person_name: client.contact_person_name,
      contact_person_email: client.contact_person_email,
      contact_person_phone: client.contact_person_phone,
      address: client.address || '',
      subscription_tier: client.subscription_tier,
    })
    setEditingClient(client.id)
    setShowModal(true)
  }

  const handleDeleteClient = async (clientId: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الزبون؟')) {
      try {
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', clientId)
        
        if (error) throw error
        fetchClients()
      } catch (error) {
        console.error('Error deleting client:', error)
      }
    }
  }

  const filteredClients = clients.filter(client =>
    client.company_name_ar.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.company_name_en?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'A': 'bg-green-100 text-green-800',
      'B': 'bg-blue-100 text-blue-800',
      'C': 'bg-yellow-100 text-yellow-800',
      'D': 'bg-orange-100 text-orange-800',
      'E': 'bg-red-100 text-red-800',
    }
    return colors[category] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">إدارة الزبناء</h1>
          <p className="text-white mt-2">قائمة بجميع زبنائك</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition"
        >
          <Plus size={20} />
          <span>إضافة زبون</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex items-center space-x-3 bg-gray-50 rounded-lg px-4 py-3">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="ابحث عن زبون..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent outline-none text-gray-800"
          />
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">جاري التحميل...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">اسم الشركة</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">جهة الاتصال</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">البريد الإلكتروني</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">الهاتف</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">العنوان</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">الفئة</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="py-4 px-6 text-gray-800 font-medium">{client.company_name_ar}</td>
                    <td className="py-4 px-6 text-gray-800">{client.contact_person_name}</td>
                    <td className="py-4 px-6 text-gray-600">{client.contact_person_email}</td>
                    <td className="py-4 px-6 text-gray-600">{client.contact_person_phone}</td>
                    <td className="py-4 px-6 text-gray-600">{client.address || '-'}</td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(client.subscription_tier)}`}>
                        {client.subscription_tier}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition">
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => handleEditClient(client)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteClient(client.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 size={18} />
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

      {/* Add Client Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 lg:p-8 max-w-md sm:max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                {editingClient ? 'تعديل الزبون' : 'إضافة زبون جديد'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setShowModal(false)
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleAddClient} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">اسم الشركة (عربي)</label>
                <input
                  type="text"
                  value={formData.company_name_ar}
                  onChange={(e) => setFormData({ ...formData, company_name_ar: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm sm:text-base"
                  placeholder="أدخل اسم الشركة بالعربي..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">اسم الشركة (English)</label>
                <input
                  type="text"
                  value={formData.company_name_en}
                  onChange={(e) => setFormData({ ...formData, company_name_en: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm sm:text-base"
                  placeholder="Enter company name in English..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">اسم جهة الاتصال</label>
                <input
                  type="text"
                  value={formData.contact_person_name}
                  onChange={(e) => setFormData({ ...formData, contact_person_name: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm sm:text-base"
                  placeholder="أدخل اسم جهة الاتصال..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={formData.contact_person_email}
                  onChange={(e) => setFormData({ ...formData, contact_person_email: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm sm:text-base"
                  placeholder="example@email.com"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">الهاتف</label>
                <input
                  type="tel"
                  value={formData.contact_person_phone}
                  onChange={(e) => setFormData({ ...formData, contact_person_phone: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm sm:text-base"
                  placeholder="06xxxxxxxx ou 07xxxxxxxx"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">العنوان</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm sm:text-base resize-none"
                  placeholder="أدخل العنوان الكامل..."
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">الفئة</label>
                <select
                  value={formData.subscription_tier}
                  onChange={(e) => setFormData({ ...formData, subscription_tier: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none text-sm sm:text-base"
                >
                  <option value="A">فئة A</option>
                  <option value="B">فئة B</option>
                  <option value="C">فئة C</option>
                  <option value="D">فئة D</option>
                  <option value="E">فئة E</option>
                </select>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white py-2 px-3 sm:px-4 rounded-lg hover:bg-indigo-700 transition font-medium text-sm sm:text-base"
                >
                  {editingClient ? 'تحديث' : 'إضافة'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm()
                    setShowModal(false)
                  }}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 px-3 sm:px-4 rounded-lg hover:bg-gray-300 transition font-medium text-sm sm:text-base"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
