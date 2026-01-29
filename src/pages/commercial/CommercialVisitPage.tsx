import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, MapPin, Camera, Clock, Save, Navigation, Plus } from 'lucide-react'

interface Client {
  id: string
  company_name_ar: string
  contact_person_name: string
  gps_lat?: number
  gps_lng?: number
}

export default function CommercialVisitPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const clientId = searchParams.get('client')

  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(false)
  const [visitStartTime] = useState(new Date())
  const [formData, setFormData] = useState({
    note: '',
    photo_url: '',
    order_created: false,
    gps_lat: null as number | null,
    gps_lng: null as number | null
  })

  useEffect(() => {
    const commercialId = localStorage.getItem('commercial_id')
    if (!commercialId) {
      navigate('/commercial/login')
      return
    }

    if (clientId) {
      loadClient(clientId)
    }

    getCurrentLocation()
  }, [navigate, clientId])

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            gps_lat: position.coords.latitude,
            gps_lng: position.coords.longitude
          }))
        },
        (error) => {
          console.error('Error getting location:', error)
        }
      )
    }
  }

  const loadClient = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      setClient(data)
    } catch (error) {
      console.error('Error loading client:', error)
    }
  }

  const handleSaveVisit = async () => {
    if (!client) return

    const commercialId = localStorage.getItem('commercial_id')
    if (!commercialId) return

    setLoading(true)
    try {
      const visitEndTime = new Date()
      const durationMinutes = Math.round((visitEndTime.getTime() - visitStartTime.getTime()) / 60000)

      const { error } = await supabase
        .from('visits')
        .insert({
          commercial_id: commercialId,
          client_id: client.id,
          visit_date: visitStartTime.toISOString(),
          gps_lat: formData.gps_lat,
          gps_lng: formData.gps_lng,
          note: formData.note || null,
          photo_url: formData.photo_url || null,
          order_created: formData.order_created,
          duration_minutes: durationMinutes
        })

      if (error) throw error

      alert('✅ تم تسجيل الزيارة بنجاح')
      navigate('/commercial/clients')
    } catch (error) {
      console.error('Error saving visit:', error)
      alert('❌ حدث خطأ أثناء تسجيل الزيارة')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOrder = () => {
    if (client) {
      setFormData(prev => ({ ...prev, order_created: true }))
      navigate(`/commercial/orders/new?client=${client.id}&visit=true`)
    }
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/commercial/map')}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">تسجيل زيارة</h1>
            <p className="text-purple-100 text-sm">{client.company_name_ar}</p>
          </div>
        </div>
      </div>

      {/* Visit Form */}
      <div className="p-4 space-y-4">
        {/* Client Info Card */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <h3 className="font-bold text-gray-800 mb-3">معلومات العميل</h3>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-600">الشركة:</span> <span className="font-medium">{client.company_name_ar}</span></p>
            <p><span className="text-gray-600">جهة الاتصال:</span> <span className="font-medium">{client.contact_person_name}</span></p>
            <p><span className="text-gray-600">الهاتف:</span> <span className="font-medium">{client.contact_person_phone}</span></p>
          </div>
        </div>

        {/* Location Card */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">الموقع الجغرافي</h3>
            <button
              onClick={getCurrentLocation}
              className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm"
            >
              <Navigation size={16} />
              تحديث
            </button>
          </div>
          {formData.gps_lat && formData.gps_lng ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-green-700">
                <MapPin size={20} />
                <div className="text-sm">
                  <p>Lat: {formData.gps_lat.toFixed(6)}</p>
                  <p>Lng: {formData.gps_lng.toFixed(6)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-700 text-sm">
              ⚠️ لم يتم تحديد الموقع
            </div>
          )}
        </div>

        {/* Duration Card */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center gap-3">
            <Clock className="text-blue-600" size={24} />
            <div>
              <p className="text-sm text-gray-600">مدة الزيارة</p>
              <p className="font-bold text-gray-800">
                {Math.round((new Date().getTime() - visitStartTime.getTime()) / 60000)} دقيقة
              </p>
            </div>
          </div>
        </div>

        {/* Photo Upload */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Camera size={20} />
            صورة الزيارة
          </h3>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                const reader = new FileReader()
                reader.onloadend = () => {
                  setFormData(prev => ({ ...prev, photo_url: reader.result as string }))
                }
                reader.readAsDataURL(file)
              }
            }}
            className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
          />
          {formData.photo_url && (
            <div className="mt-3">
              <img 
                src={formData.photo_url} 
                alt="Visit" 
                className="w-full rounded-lg shadow-md"
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <h3 className="font-bold text-gray-800 mb-3">ملاحظات الزيارة</h3>
          <textarea
            value={formData.note}
            onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
            rows={4}
            placeholder="أضف ملاحظات حول الزيارة..."
          />
        </div>

        {/* Actions */}
        <div className="space-y-3 pb-6">
          <button
            onClick={handleCreateOrder}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-lg"
          >
            <Plus size={24} />
            إنشاء طلب للعميل
          </button>

          <button
            onClick={handleSaveVisit}
            disabled={loading}
            className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
          >
            <Save size={24} />
            {loading ? 'جاري الحفظ...' : 'حفظ الزيارة'}
          </button>
        </div>
      </div>
    </div>
  )
}
