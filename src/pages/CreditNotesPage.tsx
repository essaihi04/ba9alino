import { useEffect, useState } from 'react'
import { Search, Eye, Edit2, Trash2, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function CreditNotesPage() {
  const [creditNotes, setCreditNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchCreditNotes()
  }, [])

  const fetchCreditNotes = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('credit_notes')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setCreditNotes(data || [])
    } catch (error) {
      console.error('Error fetching credit notes:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      issued: 'bg-blue-100 text-blue-800',
      applied: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const filteredCreditNotes = creditNotes.filter(note =>
    note.credit_note_number?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">إدارة بونات الخصم</h1>
          <p className="text-gray-600 mt-2">قائمة بجميع بونات الخصم</p>
        </div>
        <button className="flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition">
          <Plus size={20} />
          <span>بونة خصم جديدة</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex items-center space-x-3 bg-gray-50 rounded-lg px-4 py-3">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="ابحث عن بونة خصم..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent outline-none text-gray-800"
          />
        </div>
      </div>

      {/* Credit Notes Table */}
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
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">رقم البونة</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">التاريخ</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">المبلغ</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">المطبق</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">المتبقي</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">الحالة</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredCreditNotes.map((note) => (
                  <tr key={note.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="py-4 px-6 text-gray-800 font-medium">{note.credit_note_number}</td>
                    <td className="py-4 px-6 text-gray-600">{new Date(note.credit_date).toLocaleDateString('ar-SA')}</td>
                    <td className="py-4 px-6 text-gray-800 font-medium">{note.total_credit_amount.toFixed(2)} ر.س</td>
                    <td className="py-4 px-6 text-gray-800">{note.applied_amount.toFixed(2)} ر.س</td>
                    <td className="py-4 px-6 text-gray-800">{note.remaining_amount.toFixed(2)} ر.س</td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(note.status)}`}>
                        {note.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition">
                          <Eye size={18} />
                        </button>
                        <button className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition">
                          <Edit2 size={18} />
                        </button>
                        <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition">
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
    </div>
  )
}
