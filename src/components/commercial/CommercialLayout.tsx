import { useNavigate, useLocation } from 'react-router-dom'
import { Home, ShoppingCart, Users, BarChart3, Plus, Gift, MapPin, DollarSign, LogOut, Camera, Package } from 'lucide-react'

interface CommercialLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  showBack?: boolean
  backTo?: string
  headerRight?: React.ReactNode
  noPadding?: boolean
}

const bottomNavItems = [
  { path: '/commercial/dashboard', icon: Home, label: 'الرئيسية' },
  { path: '/commercial/orders', icon: ShoppingCart, label: 'طلباتي' },
  { path: '/commercial/orders/new', icon: Plus, label: 'طلب جديد', isAction: true },
  { path: '/commercial/clients', icon: Users, label: 'عملائي' },
  { path: '/commercial/performance', icon: BarChart3, label: 'أدائي' },
]

export default function CommercialLayout({
  children,
  title,
  subtitle,
  showBack,
  backTo,
  headerRight,
  noPadding,
}: CommercialLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    localStorage.removeItem('commercial_id')
    localStorage.removeItem('commercial_name')
    localStorage.removeItem('commercial_role')
    localStorage.removeItem('commercial_allowed_price_tiers')
    navigate('/login')
  }

  const isActive = (path: string) => {
    if (path === '/commercial/orders/new') return false
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden" dir="rtl">
      {/* ── Status bar spacer (mobile) ── */}
      <div className="bg-emerald-700 h-safe-top" style={{ height: 'env(safe-area-inset-top, 0px)' }} />

      {/* ── Top Header ── */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {showBack && (
              <button
                onClick={() => backTo ? navigate(backTo) : navigate(-1)}
                className="p-2 rounded-xl bg-white/20 active:bg-white/30 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}
            <div>
              <h1 className="text-lg font-bold leading-tight">{title}</h1>
              {subtitle && <p className="text-emerald-100 text-xs">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {headerRight}
            {!showBack && (
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl bg-white/20 active:bg-white/30 transition-colors"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Scrollable Content ── */}
      <div className={`flex-1 overflow-y-auto overscroll-contain ${noPadding ? '' : 'p-3'}`}>
        {children}
        {/* bottom nav spacer */}
        <div className="h-20" />
      </div>

      {/* ── Bottom Navigation ── */}
      <div
        className="flex-shrink-0 bg-white border-t border-gray-200 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-end justify-around px-2 pt-2 pb-2">
          {bottomNavItems.map((item) => {
            const active = isActive(item.path)
            if (item.isAction) {
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex flex-col items-center -mt-6"
                >
                  <div className="w-14 h-14 rounded-full bg-emerald-600 shadow-lg shadow-emerald-200 flex items-center justify-center active:scale-95 transition-transform">
                    <item.icon size={26} className="text-white" />
                  </div>
                  <span className="text-xs text-emerald-600 font-semibold mt-1">{item.label}</span>
                </button>
              )
            }
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-colors active:bg-gray-100 min-w-[52px]"
              >
                <item.icon
                  size={22}
                  className={active ? 'text-emerald-600' : 'text-gray-400'}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                <span className={`text-[10px] font-medium ${active ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {item.label}
                </span>
                {active && <div className="w-1 h-1 rounded-full bg-emerald-600" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Secondary pages drawer nav (map, payments, promotions, visits, products) ── */
export function CommercialSecondaryNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const items = [
    { path: '/commercial/map', icon: MapPin, label: 'الخريطة', color: 'text-teal-600' },
    { path: '/commercial/payments', icon: DollarSign, label: 'التحصيل', color: 'text-amber-600' },
    { path: '/commercial/promotions', icon: Gift, label: 'العروض', color: 'text-pink-600' },
    { path: '/commercial/products', icon: Package, label: 'المنتجات', color: 'text-purple-600' },
    { path: '/commercial/visits/new', icon: Camera, label: 'زيارة', color: 'text-blue-600' },
  ]

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {items.map((item) => {
        const active = location.pathname.startsWith(item.path)
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
              active
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            <item.icon size={14} />
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
