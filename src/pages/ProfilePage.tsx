    import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building, Phone, MapPin, Save, Edit2, Camera, CreditCard } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface CompanyInfo {
  id?: string
  company_name: string
  company_name_ar: string
  logo_url?: string
  ice: string
  address: string
  address_ar: string
  phone: string
  email: string
  website?: string
  tax_id: string
  bank_name?: string
  bank_iban?: string
  bank_account?: string
  created_at?: string
  updated_at?: string
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    company_name: '',
    company_name_ar: '',
    logo_url: '',
    ice: '',
    address: '',
    address_ar: '',
    phone: '',
    email: '',
    website: '',
    tax_id: '',
    bank_name: '',
    bank_iban: '',
    bank_account: ''
  })
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')

  useEffect(() => {
    fetchCompanyInfo()
  }, [])

  const fetchCompanyInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('company_info')
        .select('*')
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (data) {
        setCompanyInfo(data)
        setLogoPreview(data.logo_url || '')
      }
    } catch (error) {
      console.error('Error fetching company info:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadLogo = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop()
    const fileName = `company-logo-${Date.now()}.${fileExt}`
    
    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('logos')
      .getPublicUrl(fileName)

    return publicUrl
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      let logoUrl = companyInfo.logo_url

      // Upload new logo if changed
      if (logoFile) {
        logoUrl = await uploadLogo(logoFile)
      }

      const companyData = {
        ...companyInfo,
        logo_url: logoUrl,
        updated_at: new Date().toISOString()
      }

      if (companyInfo.id) {
        // Update existing
        const { error } = await supabase
          .from('company_info')
          .update(companyData)
          .eq('id', companyInfo.id)

        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('company_info')
          .insert(companyData)

        if (error) throw error
      }

      // Update localStorage for invoices
      localStorage.setItem('companyInfo', JSON.stringify(companyData))

      setIsEditing(false)
      setLogoFile(null)
      alert('تم حفظ المعلومات بنجاح')
    } catch (error) {
      console.error('Error saving company info:', error)
      alert('حدث خطأ أثناء حفظ المعلومات')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setLogoFile(null)
    fetchCompanyInfo() // Reset to original data
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
              <button
                onClick={() => navigate('/')}
                className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">ملف الشركة</h1>
            </div>
            <div className="flex items-center space-x-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancel}
                    className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <Save size={16} />
                    <span>{saving ? 'جاري الحفظ...' : 'حفظ'}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  <Edit2 size={16} />
                  <span>تعديل</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Logo Section */}
          <div className="mb-8 text-center">
            <div className="relative inline-block">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Company Logo"
                  className="w-32 h-32 object-contain rounded-lg border-2 border-gray-200"
                />
              ) : (
                <div className="w-32 h-32 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <Building className="w-12 h-12 text-gray-400" />
                </div>
              )}
              {isEditing && (
                <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700">
                  <Camera size={16} />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Company Information */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Building className="w-5 h-5 ml-2" />
                معلومات الشركة
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم الشركة (عربي)</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={companyInfo.company_name_ar}
                      onChange={(e) => setCompanyInfo(prev => ({ ...prev, company_name_ar: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="اسم الشركة بالعربية"
                    />
                  ) : (
                    <p className="text-gray-900">{companyInfo.company_name_ar || 'غير محدد'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم الشركة (فرنساوي)</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={companyInfo.company_name}
                      onChange={(e) => setCompanyInfo(prev => ({ ...prev, company_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Nom de l'entreprise"
                    />
                  ) : (
                    <p className="text-gray-900">{companyInfo.company_name || 'غير محدد'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الرقم التعريفي للشركة (ICE)</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={companyInfo.ice}
                      onChange={(e) => setCompanyInfo(prev => ({ ...prev, ice: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="ICE"
                    />
                  ) : (
                    <p className="text-gray-900">{companyInfo.ice || 'غير محدد'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الرقم الضريبي</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={companyInfo.tax_id}
                      onChange={(e) => setCompanyInfo(prev => ({ ...prev, tax_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="الرقم الضريبي"
                    />
                  ) : (
                    <p className="text-gray-900">{companyInfo.tax_id || 'غير محدد'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Phone className="w-5 h-5 ml-2" />
                معلومات الاتصال
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={companyInfo.phone}
                      onChange={(e) => setCompanyInfo(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="06xxxxxxxx"
                    />
                  ) : (
                    <p className="text-gray-900">{companyInfo.phone || 'غير محدد'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={companyInfo.email}
                      onChange={(e) => setCompanyInfo(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="email@company.com"
                    />
                  ) : (
                    <p className="text-gray-900">{companyInfo.email || 'غير محدد'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الموقع الإلكتروني</label>
                  {isEditing ? (
                    <input
                      type="url"
                      value={companyInfo.website}
                      onChange={(e) => setCompanyInfo(prev => ({ ...prev, website: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="https://www.company.com"
                    />
                  ) : (
                    <p className="text-gray-900">{companyInfo.website || 'غير محدد'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <MapPin className="w-5 h-5 ml-2" />
              العنوان
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">العنوان (عربي)</label>
                {isEditing ? (
                  <textarea
                    value={companyInfo.address_ar}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, address_ar: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                    placeholder="العنوان بالعربية"
                  />
                ) : (
                  <p className="text-gray-900">{companyInfo.address_ar || 'غير محدد'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">العنوان (فرنساوي)</label>
                {isEditing ? (
                  <textarea
                    value={companyInfo.address}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                    placeholder="Adresse en français"
                  />
                ) : (
                  <p className="text-gray-900">{companyInfo.address || 'غير محدد'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Bank Information */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <CreditCard className="w-5 h-5 ml-2" />
              معلومات البنكية
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم البنك</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={companyInfo.bank_name}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, bank_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="اسم البنك"
                  />
                ) : (
                  <p className="text-gray-900">{companyInfo.bank_name || 'غير محدد'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={companyInfo.bank_iban}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, bank_iban: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="IBAN"
                  />
                ) : (
                  <p className="text-gray-900">{companyInfo.bank_name || 'غير محدد'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم الحساب</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={companyInfo.bank_account}
                    onChange={(e) => setCompanyInfo(prev => ({ ...prev, bank_account: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="رقم الحساب"
                  />
                ) : (
                  <p className="text-gray-900">{companyInfo.bank_account || 'غير محدد'}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
