import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit3, Printer, ArrowLeft, Save, Download } from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { supabase } from '../lib/supabase'

interface OrderItem {
  id: string
  product_id: string
  product_name_ar: string
  product_sku: string
  quantity: number
  unit_price: number
  line_total: number
}

interface Order {
  id: string
  order_number: string
  client: {
    company_name_ar: string
    contact_person_phone: string
  }
  phone: string
  order_date: string
  total_amount: number
  items: OrderItem[]
}

interface DeliveryNoteData {
  noteNumber: string
  deliveryDate: string
  clientInfo: {
    name: string
    phone: string
    address: string
  }
  items: DeliveryItem[]
  notes: string
  deliveredBy: string
  receivedBy: string
}

interface DeliveryItem {
  description: string
  quantity: number
  unit: string
  condition: string
}

export default function DeliveryNotePage() {
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [companyInfo, setCompanyInfo] = useState<any>(null)
  const [deliveryNoteData, setDeliveryNoteData] = useState<DeliveryNoteData>({
    noteNumber: '',
    deliveryDate: new Date().toISOString().split('T')[0],
    clientInfo: {
      name: '',
      phone: '',
      address: ''
    },
    items: [],
    notes: 'تم تسليم جميع المواد بحالة جيدة',
    deliveredBy: '',
    receivedBy: ''
  })

  useEffect(() => {
    fetchCompanyInfo()
    loadOrderData()
  }, [])

  const fetchCompanyInfo = async () => {
    try {
      // Supabase first (source of truth)
      const { data, error } = await supabase
        .from('company_info')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data && !error) {
        setCompanyInfo(data)
        localStorage.setItem('companyInfo', JSON.stringify(data))
        return
      }

      // Fallback: localStorage (do NOT inject defaults)
      const localData = localStorage.getItem('companyInfo')
      if (localData) {
        setCompanyInfo(JSON.parse(localData))
      } else {
        setCompanyInfo(null)
      }
    } catch (error) {
      console.error('Error fetching company info:', error)
    }
  }

  const loadOrderData = () => {
    // Load order data from sessionStorage
    const storedOrderData = sessionStorage.getItem('deliveryNoteOrderData')
    if (storedOrderData) {
      const orderData = JSON.parse(storedOrderData)
      setOrder(orderData)
      
      // Initialize delivery note data with order data
      const items: DeliveryItem[] = orderData.items?.map((item: OrderItem) => ({
        description: item.product_sku ? `${item.product_sku} - ${item.product_name_ar}` : (item.product_name_ar || ''),
        quantity: item.quantity,
        unit: 'قطعة',
        condition: 'جيدة'
      })) || []

      setDeliveryNoteData(prev => ({
        ...prev,
        noteNumber: `BL-${orderData.order_number}`,
        clientInfo: {
          name: orderData.client?.company_name_ar || '',
          phone: orderData.phone || orderData.client?.contact_person_phone || '',
          address: ''
        },
        items
      }))
    }
  }

  const updateItem = (index: number, field: keyof DeliveryItem, value: string | number) => {
    const updatedItems = [...deliveryNoteData.items]
    updatedItems[index] = { ...updatedItems[index], [field]: value }
    
    setDeliveryNoteData(prev => ({
      ...prev,
      items: updatedItems
    }))
  }

  const addItem = () => {
    const newItem: DeliveryItem = {
      description: '',
      quantity: 1,
      unit: 'قطعة',
      condition: 'جديدة'
    }
    
    setDeliveryNoteData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }))
  }

  const removeItem = (index: number) => {
    const updatedItems = deliveryNoteData.items.filter((_, i) => i !== index)
    setDeliveryNoteData(prev => ({
      ...prev,
      items: updatedItems
    }))
  }

  const handlePrint = () => {
    // Create print styles to print only the delivery note
    const printStyles = `
      @media print {
        @page {
          size: portrait;
          margin: 5mm;
        }
        body * {
          visibility: hidden;
        }
        .bg-white.rounded-lg.shadow-lg.p-8, .bg-white.rounded-lg.shadow-lg.p-8 * {
          visibility: visible;
        }
        .bg-white.rounded-lg.shadow-lg.p-8 {
          position: absolute;
          right: 5mm;
          top: 5mm;
          left: 5mm;
          width: calc(100% - 10mm);
          box-shadow: none;
          border-radius: 0;
        }
        /* Hide buttons during print */
        button {
          display: none !important;
        }
        /* Ensure proper text direction */
        .bg-white.rounded-lg.shadow-lg.p-8 {
          direction: rtl;
        }
      }
    `
    
    // Create and append style element
    const styleElement = document.createElement('style')
    styleElement.innerHTML = printStyles
    document.head.appendChild(styleElement)
    
    // Trigger print
    window.print()
    
    // Remove styles after print
    setTimeout(() => {
      document.head.removeChild(styleElement)
    }, 1000)
  }

  const handleSaveDeliveryNote = async () => {
    if (!companyInfo) {
      alert('يرجى ملء معلومات الشركة أولاً')
      return
    }
    if (!deliveryNoteData.clientInfo.name) {
      alert('يرجى ملء اسم العميل')
      return
    }
    if (deliveryNoteData.items.length === 0 || deliveryNoteData.items.every(item => !item.description)) {
      alert('يرجى إضافة منتجات للبون')
      return
    }

    try {
      const deliveryNotePayload = {
        note_number: deliveryNoteData.noteNumber,
        delivery_date: deliveryNoteData.deliveryDate,
        client_name: deliveryNoteData.clientInfo.name,
        client_phone: deliveryNoteData.clientInfo.phone,
        client_address: deliveryNoteData.clientInfo.address,
        company_name: companyInfo.company_name,
        company_name_ar: companyInfo.company_name_ar,
        company_address: companyInfo.address,
        company_address_ar: companyInfo.address_ar,
        company_phone: companyInfo.phone,
        company_email: companyInfo.email,
        company_website: companyInfo.website,
        company_ice: companyInfo.ice,
        company_logo_url: companyInfo.logo_url,
        order_id: order?.id || null,
        order_number: order?.order_number || null,
        items: deliveryNoteData.items,
        notes: deliveryNoteData.notes,
        status: 'draft'
      }

      const { error } = await supabase.from('delivery_notes').insert([deliveryNotePayload])
      if (error) throw error

      alert('تم حفظ بون التسليم بنجاح')
      navigate('/delivery-notes')
    } catch (error: any) {
      console.error('Error saving delivery note:', error)
      alert('فشل حفظ بون التسليم: ' + (error.message || 'خطأ غير معروف'))
    }
  }

  const handleDownload = async () => {
    const element = document.querySelector('.bg-white.rounded-lg.shadow-lg.p-8') as HTMLElement
    if (!element) return

    try {
      // Show loading state
      const downloadButton = document.querySelector('button[class*="bg-purple-600"]') as HTMLButtonElement
      const originalContent = downloadButton?.innerHTML || ''
      if (downloadButton) {
        downloadButton.innerHTML = '<span class="animate-spin">⟳</span> جاري الإنشاء...'
        downloadButton.disabled = true
      }

      // Store original styles
      const originalStyle = element.style.cssText
      
      // Apply styles for PDF generation
      element.style.cssText = `
        width: 210mm;
        max-width: 210mm;
        margin: 0;
        padding: 15mm;
        box-sizing: border-box;
        background: white;
        box-shadow: none;
        border-radius: 0;
        overflow: visible;
      `

      // Wait a bit for styles to apply
      await new Promise(resolve => setTimeout(resolve, 100))

      // Generate canvas with high quality
      const canvas = await html2canvas(element, {
        scale: 2, // Reduced scale to avoid memory issues
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794, // A4 width in pixels at 96 DPI
        height: 1123, // A4 height in pixels at 96 DPI
        windowWidth: 794,
        windowHeight: 1123,
        scrollX: 0,
        scrollY: 0
      })
      
      // Restore original styles
      element.style.cssText = originalStyle
      
      // Create PDF
      const imgData = canvas.toDataURL('image/png', 0.95) // Slightly compressed for better performance
      const pdf = new jsPDF('p', 'mm', 'a4')
      
      // Add full page image
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      
      // Calculate dimensions to fit the entire content
      const imgWidth = pdfWidth
      const imgHeight = (canvas.height * pdfWidth) / canvas.width
      
      // If height exceeds page, add new page
      if (imgHeight > pdfHeight) {
        const pageCount = Math.ceil(imgHeight / pdfHeight)
        for (let i = 0; i < pageCount; i++) {
          if (i > 0) pdf.addPage()
          const yOffset = -i * pdfHeight
          pdf.addImage(imgData, 'PNG', 0, yOffset, pdfWidth, imgHeight, undefined, 'FAST')
        }
      } else {
        // Center on page if fits
        const y = (pdfHeight - imgHeight) / 2
        pdf.addImage(imgData, 'PNG', 0, y, pdfWidth, imgHeight, undefined, 'FAST')
      }
      
      // Save the PDF
      pdf.save(`bon_livraison_${deliveryNoteData.noteNumber}.pdf`)
      
      // Restore button state
      if (downloadButton) {
        downloadButton.innerHTML = originalContent
        downloadButton.disabled = false
      }
      
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('حدث خطأ أثناء إنشاء ملف PDF')
      
      // Restore button state on error
      const downloadButton = document.querySelector('button[class*="bg-purple-600"]') as HTMLButtonElement
      if (downloadButton) {
        downloadButton.innerHTML = originalContent
        downloadButton.disabled = false
      }
    }
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">لا توجد بيانات للطلب</p>
          <button
            onClick={() => navigate('/orders')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            العودة للطلبات
          </button>
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
              <button
                onClick={() => navigate('/orders')}
                className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">إنشاء بون تسليم</h1>
            </div>
            <div className="flex items-center space-x-2">
              {isEditing ? (
                <button
                  onClick={() => {
                    handleSaveDeliveryNote()
                    setIsEditing(false)
                  }}
                  className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  <Save size={16} />
                  <span>حفظ</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  <Edit3 size={16} />
                  <span>تعديل</span>
                </button>
              )}
              <button
                onClick={handleSaveDeliveryNote}
                className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                <Save size={16} />
                <span>حفظ</span>
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
              >
                <Printer size={16} />
                <span>طباعة</span>
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
              >
                <Download size={16} />
                <span>تحميل</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Note Content */}
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Delivery Note Header */}
          <div className="border-b-4 border-green-600 pb-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-4xl font-bold text-gray-900 mb-2">بون تسليم</h2>
                <p className="text-gray-600 text-lg">رقم البون: {deliveryNoteData.noteNumber}</p>
              </div>
              <div className="text-left bg-green-50 p-4 rounded-lg">
                <p className="text-gray-700 font-semibold mb-1">التاريخ: {deliveryNoteData.deliveryDate}</p>
              </div>
            </div>
          </div>

          {/* Company Info */}
          <div className="mb-8 bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">معلومات الشركة</h3>
                <div className="flex items-start space-x-4">
                  {companyInfo?.logo_url && (
                    <img 
                      src={companyInfo.logo_url} 
                      alt="Company Logo" 
                      className="w-16 h-16 object-contain rounded"
                    />
                  )}
                  <div>
                    <p className="text-gray-700 font-semibold">{companyInfo?.company_name_ar || '—'}</p>
                    <p className="text-gray-600">{companyInfo?.address_ar || '—'}</p>
                    <p className="text-gray-600">الهاتف: {companyInfo?.phone || '—'}</p>
                    <p className="text-gray-600">البريد: {companyInfo?.email || '—'}</p>
                    {companyInfo?.website && <p className="text-gray-600">الموقع: {companyInfo.website}</p>}
                    {companyInfo?.ice && <p className="text-gray-600">ICE: {companyInfo.ice}</p>}
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">معلومات العميل</h3>
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={deliveryNoteData.clientInfo.name}
                      onChange={(e) => setDeliveryNoteData(prev => ({
                        ...prev,
                        clientInfo: { ...prev.clientInfo, name: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="اسم العميل"
                    />
                    <input
                      type="text"
                      value={deliveryNoteData.clientInfo.phone}
                      onChange={(e) => setDeliveryNoteData(prev => ({
                        ...prev,
                        clientInfo: { ...prev.clientInfo, phone: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="رقم الهاتف"
                    />
                    <input
                      type="text"
                      value={deliveryNoteData.clientInfo.address}
                      onChange={(e) => setDeliveryNoteData(prev => ({
                        ...prev,
                        clientInfo: { ...prev.clientInfo, address: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="العنوان"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-gray-700 font-semibold">{deliveryNoteData.clientInfo.name}</p>
                    <p className="text-gray-600">{deliveryNoteData.clientInfo.phone}</p>
                    <p className="text-gray-600">{deliveryNoteData.clientInfo.address}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">المواد المسلمة</h3>
              {isEditing && (
                <button
                  onClick={addItem}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition"
                >
                  + إضافة مادة
                </button>
              )}
            </div>
            <div className="overflow-x-auto border-2 border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 px-4 py-3 text-right font-bold text-gray-900">الوصف</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900">الكمية</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900">الوحدة</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900">الحالة</th>
                    {isEditing && <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900">إجراء</th>}
                  </tr>
                </thead>
                <tbody>
                  {deliveryNoteData.items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            className="w-full px-2 py-2 border border-gray-200 rounded"
                          />
                        ) : (
                          <span className="font-medium">{item.description}</span>
                        )}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-20 px-2 py-2 border border-gray-200 rounded text-center"
                          />
                        ) : (
                          <span className="font-semibold">{item.quantity}</span>
                        )}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        {isEditing ? (
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => updateItem(index, 'unit', e.target.value)}
                            className="w-20 px-2 py-2 border border-gray-200 rounded text-center"
                          />
                        ) : (
                          <span>{item.unit}</span>
                        )}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        {isEditing ? (
                          <select
                            value={item.condition}
                            onChange={(e) => updateItem(index, 'condition', e.target.value)}
                            className="w-24 px-2 py-2 border border-gray-200 rounded text-center"
                          >
                            <option value="جديدة">جديدة</option>
                            <option value="مستعملة">مستعملة</option>
                            <option value="متجددة">متجددة</option>
                          </select>
                        ) : (
                          <span className="font-medium">{item.condition}</span>
                        )}
                      </td>
                      {isEditing && (
                        <td className="border border-gray-300 px-4 py-3 text-center">
                          <button
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-800 font-semibold"
                          >
                            حذف
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">ملاحظات</h3>
            {isEditing ? (
              <textarea
                value={deliveryNoteData.notes}
                onChange={(e) => setDeliveryNoteData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
              />
            ) : (
              <p className="text-gray-600">{deliveryNoteData.notes}</p>
            )}
          </div>

          {/* Signatures */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">التوقيعات</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">سلمت من قبل:</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={deliveryNoteData.deliveredBy}
                    onChange={(e) => setDeliveryNoteData(prev => ({ ...prev, deliveredBy: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="اسم المسلم"
                  />
                ) : (
                  <div className="border-b-2 border-gray-300 pb-2">
                    <p className="text-gray-600">{deliveryNoteData.deliveredBy || '___________________'}</p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">استلمت من قبل:</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={deliveryNoteData.receivedBy}
                    onChange={(e) => setDeliveryNoteData(prev => ({ ...prev, receivedBy: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="اسم المستلم"
                  />
                ) : (
                  <div className="border-b-2 border-gray-300 pb-2">
                    <p className="text-gray-600">{deliveryNoteData.receivedBy || '___________________'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t-2 border-gray-200 text-center">
            <p className="text-gray-600 font-semibold">شكراً لثقتكم بنا!</p>
            <p className="text-gray-500 text-sm mt-2">هذا البون تم إنشاؤه بواسطة نظام إدارة {companyInfo?.company_name_ar || 'باقالينو'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
