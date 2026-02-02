import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Gift, BadgePercent } from 'lucide-react'

interface Promotion {
  id: string
  title: string
  type: 'gift' | 'discount'
  scope: 'global' | 'product'
  product_id: string | null
  min_quantity: number
  unit_type: string | null
  discount_percent: number | null
  gift_product_id: string | null
  gift_quantity: number | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
}

interface ProductOption {
  id: string
  name_ar: string
}

const formatDate = (value?: string | null) => {
  if (!value) return ''
  return new Date(value).toISOString().split('T')[0]
}

export default function CommercialPromotionsPage() {
  const navigate = useNavigate()
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const commercialId = localStorage.getItem('commercial_id')
    if (!commercialId) {
      navigate('/commercial/login')
      return
    }

    fetchPromotions()
    fetchProducts()
  }, [navigate])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ar')
        .eq('is_active', true)
        .order('name_ar')

      if (error) throw error
      setProducts((data || []) as ProductOption[])
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  const fetchPromotions = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPromotions((data || []) as Promotion[])
    } catch (error) {
      console.error('Error loading promotions:', error)
    } finally {
      setLoading(false)
    }
  }

  const productMap = useMemo(() => {
    const map = new Map<string, string>()
    products.forEach((p) => map.set(p.id, p.name_ar))
    return map
  }, [products])

  const renderScope = (promo: Promotion) => {
    if (promo.scope === 'global') return 'عرض عام على كل المنتجات'
    const name = promo.product_id ? productMap.get(promo.product_id) : ''
    return name ? `منتج: ${name}` : 'منتج محدد'
  }

  const renderBenefit = (promo: Promotion) => {
    if (promo.type === 'discount') {
      return `خصم ${promo.discount_percent || 0}%`
    }
    const giftName = promo.gift_product_id ? productMap.get(promo.gift_product_id) : ''
    return `هدية: ${giftName || 'منتج'} × ${promo.gift_quantity || 1}`
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/commercial/dashboard')}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold">العروض</h1>
            <p className="text-emerald-100 text-sm">العروض المتاحة للعملاء</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">جاري التحميل...</div>
        ) : promotions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">لا توجد عروض حالياً</div>
        ) : (
          <div className="space-y-4">
            {promotions.map((promo) => (
              <div key={promo.id} className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{promo.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{renderScope(promo)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                    {promo.type === 'discount' ? <BadgePercent size={16} /> : <Gift size={16} />}
                    {promo.type === 'discount' ? 'خصم' : 'هدية'}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
                  <div>
                    الشرط: {promo.min_quantity} {promo.unit_type || ''}
                  </div>
                  <div>الفائدة: {renderBenefit(promo)}</div>
                  <div>يبدأ: {formatDate(promo.starts_at) || 'مباشر'}</div>
                  <div>ينتهي: {formatDate(promo.ends_at) || 'مفتوح'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
