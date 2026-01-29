import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Search, Users, ArrowLeft, Plus, Phone, MapPin, Image as ImageIcon, MapPinOff } from 'lucide-react'

const SHOP_PHOTO_BUCKET = import.meta.env.VITE_SHOP_PHOTO_BUCKET || 'magasin'

interface Client {
  id: string
  company_name_ar: string
  company_name_en?: string
  contact_person_name: string
  contact_person_phone: string
  contact_person_email?: string
  address?: string
  city?: string
  subscription_tier: string
  created_by?: string
  created_at: string
}

export default function CommercialClientsPage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    company_name_ar: '',
    company_name_en: '',
    contact_person_name: '',
    contact_person_phone: '',
    contact_person_email: '',
    address: '',
    city: '',
    subscription_tier: 'E',
    gps_lat: null as number | null,
    gps_lng: null as number | null,
    shop_photo_url: '',
    credit_limit: ''
  })
  const [locating, setLocating] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  useEffect(() => {
    // Vérifier l'authentification
    const commercialId = localStorage.getItem('commercial_id')
    if (!commercialId) {
      navigate('/commercial/login')
      return
    }

    loadClients(commercialId)
  }, [navigate])

  const loadClients = async (commercialId: string) => {
    setLoading(true)
    try {
      // Charger uniquement les clients créés par ce commercial
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('created_by', commercialId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setClients(data || [])
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.company_name_ar || !formData.contact_person_name || !formData.contact_person_phone) {
      alert('الرجاء إدخال الحقول المطلوبة')
      return
    }

    const commercialId = localStorage.getItem('commercial_id')
    if (!commercialId) return

    try {
      const { error } = await supabase
        .from('clients')
        .insert({
          company_name_ar: formData.company_name_ar,
          company_name_en: formData.company_name_en,
          contact_person_name: formData.contact_person_name,
          contact_person_phone: formData.contact_person_phone,
          contact_person_email: formData.contact_person_email || null,
          address: formData.address || null,
          city: formData.city || null,
          subscription_tier: formData.subscription_tier,
          created_by: commercialId,
          commercial_id: commercialId,
          gps_lat: formData.gps_lat,
          gps_lng: formData.gps_lng,
          shop_photo_url: formData.shop_photo_url || null,
          credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : 0
        })

      if (error) throw error

      alert('✅ تم إضافة العميل بنجاح')
      setShowAddModal(false)
      setFormData({
        company_name_ar: '',
        company_name_en: '',
        contact_person_name: '',
        contact_person_phone: '',
        contact_person_email: '',
        address: '',
        city: '',
        subscription_tier: 'E',
        gps_lat: null,
        gps_lng: null,
        shop_photo_url: '',
        credit_limit: ''
      })
      setPhotoError(null)
    } catch (error) {
      console.error('Error adding client:', error)
      alert('❌ حدث خطأ أثناء إضافة العميل')
    }
  }

  const handleLocate = () => {
    if (!navigator.geolocation) {
      alert('🌍 جهازك لا يدعم تحديد الموقع')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          gps_lat: Number(position.coords.latitude.toFixed(6)),
          gps_lng: Number(position.coords.longitude.toFixed(6)),
        }))
        setLocating(false)
      },
      () => {
        alert('❌ تعذر الحصول على الموقع الحالي')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingPhoto(true)
    setPhotoError(null)
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      if (!SHOP_PHOTO_BUCKET) {
        throw new Error('SHOP_PHOTO_BUCKET not configured')
      }

      const filePath = `shops/${crypto.randomUUID?.() || Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from(SHOP_PHOTO_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || `image/${fileExt}`,
        })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from(SHOP_PHOTO_BUCKET)
        .getPublicUrl(filePath)

      if (!publicUrlData?.publicUrl) throw new Error('No public URL returned')

      setFormData(prev => ({ ...prev, shop_photo_url: publicUrlData.publicUrl }))
    } catch (error: any) {
      console.error('Error uploading photo:', error)
      if (error?.message?.includes('Bucket not found')) {
        setPhotoError(`لم يتم العثور على حاوية التخزين "${SHOP_PHOTO_BUCKET}". تأكد من إنشائها في Supabase أو عدل المتغير VITE_SHOP_PHOTO_BUCKET.`)
      } else if (error?.message === 'SHOP_PHOTO_BUCKET not configured') {
        setPhotoError('لم يتم ضبط حاوية تخزين الصور. حدِّد VITE_SHOP_PHOTO_BUCKET في ملف البيئة.')
      } else {
        setPhotoError('تعذر رفع الصورة، حاول مرة أخرى')
      }
    } finally {
      setUploadingPhoto(false)
    }
  }

  const filteredClients = clients.filter(client =>
    client.company_name_ar?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.contact_person_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.contact_person_phone?.includes(searchQuery)
  )

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/commercial/dashboard')}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">عملائي</h1>
            <p className="text-blue-100 text-sm">{clients.length} عميل</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-white text-blue-600 p-3 rounded-lg font-bold hover:bg-blue-50 transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-3 text-gray-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-3 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="ابحث عن عميل..."
          />
        </div>
      </div>

      {/* Clients List */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            جاري التحميل...
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500 mb-4">لا يوجد عملاء</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors"
            >
              إضافة عميل جديد
            </button>
          </div>
        ) : (
          filteredClients.map((client) => (
            <div
              key={client.id}
              className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800 text-lg mb-1">
                    {client.company_name_ar}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">
                    {client.contact_person_name}
                  </p>
                </div>
                <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                  {client.subscription_tier}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone size={16} />
                  <a href={`tel:${client.contact_person_phone}`} className="hover:text-blue-600">
                    {client.contact_person_phone}
                  </a>
                </div>
                {client.address && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin size={16} />
                    <span>{client.address}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate(`/commercial/orders/new?client=${client.id}`)}
                  className="bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  طلب جديد
                </button>
                <button
                  onClick={() => navigate(`/commercial/clients/${client.id}/edit`)}
                  className="bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  تعديل البيانات
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-xl">
              <h2 className="text-xl font-bold">إضافة عميل جديد</h2>
            </div>
            
            <form onSubmit={handleAddClient} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">اسم الشركة (عربي) *</label>
                <input
                  type="text"
                  required
                  value={formData.company_name_ar}
                  onChange={(e) => setFormData({ ...formData, company_name_ar: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="أدخل اسم الشركة..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">اسم الشركة (English)</label>
                <input
                  type="text"
                  value={formData.company_name_en}
                  onChange={(e) => setFormData({ ...formData, company_name_en: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Company name..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">اسم جهة الاتصال *</label>
                <input
                  type="text"
                  required
                  value={formData.contact_person_name}
                  onChange={(e) => setFormData({ ...formData, contact_person_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="أدخل اسم جهة الاتصال..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">رقم الهاتف *</label>
                <input
                  type="tel"
                  required
                  value={formData.contact_person_phone}
                  onChange={(e) => setFormData({ ...formData, contact_person_phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="06xxxxxxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={formData.contact_person_email}
                  onChange={(e) => setFormData({ ...formData, contact_person_email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">العنوان</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="العنوان الكامل..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">المدينة</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="المدينة..."
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium">موقع المتجر</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500">خط العرض</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.gps_lat ?? ''}
                      onChange={(e) => setFormData({ ...formData, gps_lat: e.target.value ? parseFloat(e.target.value) : null })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="مثال: 34.023451"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">خط الطول</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.gps_lng ?? ''}
                      onChange={(e) => setFormData({ ...formData, gps_lng: e.target.value ? parseFloat(e.target.value) : null })}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="مثال: -6.835210"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLocate}
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border border-blue-500 text-blue-600 font-medium hover:bg-blue-50 transition-colors"
                  disabled={locating}
                >
                  {locating ? (
                    <>
                      <MapPinOff size={16} className="animate-pulse" />
                      جاري تحديد الموقع...
                    </>
                  ) : (
                    <>
                      <MapPin size={16} />
                      تحديد الموقع الحالي
                    </>
                  )}
                </button>
                {(formData.gps_lat && formData.gps_lng) && (
                  <p className="text-xs text-green-600">✅ تم حفظ الإحداثيات</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium">صورة المتجر</label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                    <ImageIcon size={18} className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-600">اختر صورة</span>
                  </label>
                  {uploadingPhoto && <span className="text-xs text-blue-600">جاري الرفع...</span>}
                </div>
                {photoError && <p className="text-xs text-red-500">{photoError}</p>}
                {formData.shop_photo_url && (
                  <div className="relative border rounded-lg overflow-hidden">
                    <img src={formData.shop_photo_url} alt="صورة المتجر" className="w-full h-32 object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, shop_photo_url: '' })}
                      className="absolute top-1 left-1 bg-white/80 text-red-600 text-xs px-2 py-0.5 rounded"
                    >
                      إزالة
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">فئة الاشتراك</label>
                <select
                  value={formData.subscription_tier}
                  onChange={(e) => setFormData({ ...formData, subscription_tier: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="A">A - سعر أ</option>
                  <option value="B">B - سعر ب</option>
                  <option value="C">C - سعر ج</option>
                  <option value="D">D - سعر د</option>
                  <option value="E">E - سعر هـ</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors"
                  disabled={uploadingPhoto || locating}
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
