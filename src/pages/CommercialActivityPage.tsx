import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MapPin, Calendar, Clock, Package, User, Eye, Camera } from 'lucide-react'

interface Visit {
  id: string
  commercial_id: string
  client_id: string
  visit_date: string
  gps_lat?: number
  gps_lng?: number
  note?: string
  photo_url?: string
  order_created: boolean
  duration_minutes?: number
  employees?: {
    name: string
    phone: string
  }
  clients?: {
    company_name_ar: string
    contact_person_name: string
  }
}

interface CommercialStats {
  commercial_id: string
  commercial_name: string
  total_visits: number
  total_orders: number
  total_revenue: number
  conversion_rate: number
}

export default function CommercialActivityPage() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [commercialStats, setCommercialStats] = useState<CommercialStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('today')

  useEffect(() => {
    loadVisits()
    loadCommercialStats()
  }, [filter])

  const loadVisits = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('visits')
        .select(`
          *,
          employees (
            name,
            phone
          ),
          clients (
            company_name_ar,
            contact_person_name
          )
        `)
        .order('visit_date', { ascending: false })

      const now = new Date()
      if (filter === 'today') {
        const today = now.toISOString().split('T')[0]
        query = query.gte('visit_date', today)
      } else if (filter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        query = query.gte('visit_date', weekAgo)
      } else if (filter === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        query = query.gte('visit_date', monthAgo)
      }

      const { data, error } = await query

      if (error) throw error
      setVisits(data || [])
    } catch (error) {
      console.error('Error loading visits:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCommercialStats = async () => {
    try {
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id, name')
        .eq('role', 'commercial')
        .eq('status', 'active')

      if (empError) throw empError

      const statsPromises = (employees || []).map(async (emp) => {
        const [visitsRes, ordersRes] = await Promise.all([
          supabase
            .from('visits')
            .select('id, order_created')
            .eq('commercial_id', emp.id),
          supabase
            .from('orders')
            .select('total_amount')
            .eq('created_by', emp.id)
        ])

        const visits = visitsRes.data || []
        const orders = ordersRes.data || []
        const ordersFromVisits = visits.filter(v => v.order_created).length

        return {
          commercial_id: emp.id,
          commercial_name: emp.name,
          total_visits: visits.length,
          total_orders: orders.length,
          total_revenue: orders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
          conversion_rate: visits.length > 0 ? (ordersFromVisits / visits.length) * 100 : 0
        }
      })

      const stats = await Promise.all(statsPromises)
      setCommercialStats(stats.sort((a, b) => b.total_revenue - a.total_revenue))
    } catch (error) {
      console.error('Error loading commercial stats:', error)
    }
  }

  return (
    <div className="p-6" dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-4">
          <MapPin className="text-white" size={36} />
          نشاط التجار الميداني
        </h1>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('today')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              filter === 'today'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            اليوم
          </button>
          <button
            onClick={() => setFilter('week')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              filter === 'week'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            هذا الأسبوع
          </button>
          <button
            onClick={() => setFilter('month')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              filter === 'month'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            هذا الشهر
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            الكل
          </button>
        </div>

        {/* Commercial Performance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {commercialStats.map((stat) => (
            <div key={stat.commercial_id} className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-100 p-3 rounded-full">
                  <User className="text-blue-600" size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{stat.commercial_name}</h3>
                  <p className="text-xs text-gray-500">تاجر</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">الزيارات:</span>
                  <span className="font-bold text-gray-800">{stat.total_visits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">الطلبات:</span>
                  <span className="font-bold text-green-600">{stat.total_orders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">المبيعات:</span>
                  <span className="font-bold text-blue-600">{(stat.total_revenue / 1000).toFixed(1)}K</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">معدل التحويل:</span>
                  <span className="font-bold text-purple-600">{stat.conversion_rate.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Visits List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gray-50 border-b p-4">
          <h2 className="font-bold text-gray-800 text-lg">سجل الزيارات ({visits.length})</h2>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">جاري التحميل...</div>
        ) : visits.length === 0 ? (
          <div className="text-center py-12 text-gray-500">لا توجد زيارات</div>
        ) : (
          <div className="divide-y">
            {visits.map((visit) => (
              <div
                key={visit.id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <User className="text-blue-600" size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800">{visit.employees?.name}</h3>
                        <p className="text-sm text-gray-600">{visit.clients?.company_name_ar}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600 mr-14">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>{new Date(visit.visit_date).toLocaleDateString('ar-MA')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>{new Date(visit.visit_date).toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {visit.duration_minutes && (
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          <span>{visit.duration_minutes} دقيقة</span>
                        </div>
                      )}
                    </div>

                    {visit.note && (
                      <p className="text-sm text-gray-600 mt-2 mr-14 bg-gray-50 p-2 rounded">
                        {visit.note}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {visit.order_created && (
                      <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <Package size={12} />
                        طلب منشأ
                      </div>
                    )}
                    {visit.gps_lat && visit.gps_lng && (
                      <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <MapPin size={12} />
                        موقع
                      </div>
                    )}
                    {visit.photo_url && (
                      <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <Camera size={12} />
                        صورة
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setSelectedVisit(visit)
                        setShowDetailsModal(true)
                      }}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                    >
                      <Eye size={16} />
                      التفاصيل
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visit Details Modal */}
      {showDetailsModal && selectedVisit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-t-xl">
              <h2 className="text-2xl font-bold mb-2">تفاصيل الزيارة</h2>
              <p className="text-purple-100">{selectedVisit.clients?.company_name_ar}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Commercial Info */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <User size={20} />
                  التاجر
                </h3>
                <p className="text-gray-700">{selectedVisit.employees?.name}</p>
                <p className="text-sm text-gray-600">{selectedVisit.employees?.phone}</p>
              </div>

              {/* Visit Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-bold text-gray-800 mb-3">معلومات الزيارة</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="text-gray-600" size={16} />
                    <span>{new Date(selectedVisit.visit_date).toLocaleDateString('ar-MA')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="text-gray-600" size={16} />
                    <span>{new Date(selectedVisit.visit_date).toLocaleTimeString('ar-MA')}</span>
                  </div>
                  {selectedVisit.duration_minutes && (
                    <div className="flex items-center gap-2">
                      <Clock className="text-gray-600" size={16} />
                      <span>المدة: {selectedVisit.duration_minutes} دقيقة</span>
                    </div>
                  )}
                  {selectedVisit.gps_lat && selectedVisit.gps_lng && (
                    <div className="flex items-center gap-2">
                      <MapPin className="text-gray-600" size={16} />
                      <a
                        href={`https://www.google.com/maps?q=${selectedVisit.gps_lat},${selectedVisit.gps_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        عرض على الخريطة
                      </a>
                    </div>
                  )}
                  {selectedVisit.order_created && (
                    <div className="flex items-center gap-2">
                      <Package className="text-green-600" size={16} />
                      <span className="text-green-600 font-medium">تم إنشاء طلب</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedVisit.note && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-bold text-gray-800 mb-2">الملاحظات</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedVisit.note}</p>
                </div>
              )}

              {/* Photo */}
              {selectedVisit.photo_url && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <Camera size={20} />
                    صورة الزيارة
                  </h3>
                  <img
                    src={selectedVisit.photo_url}
                    alt="Visit"
                    className="w-full rounded-lg shadow-md"
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300"
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
