import { type ReactNode } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  LogOut,
  FileText,
  ShoppingCart,
  Package,
  Users,
  Settings,
  BarChart3,
  Boxes,
  Banknote,
  DollarSign,
  ArrowRight,
  CreditCard,
  Building,
  TrendingDown,
  UserCheck,
  Warehouse,
  Key,
} from 'lucide-react'
import { useAuthStore } from '../store/auth'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const menuItems = [
    { label: 'لوحة التحكم', path: '/dashboard', icon: BarChart3, color: 'text-indigo-600' },
    { label: 'كايس', path: '/pos', icon: ShoppingCart, color: 'text-green-600' },
    { label: 'المبيعات', path: '/invoices', icon: FileText, color: 'text-blue-600' },
    { label: 'الطلبات', path: '/orders', icon: FileText, color: 'text-indigo-600' },
    { label: 'الديون', path: '/credits', icon: DollarSign, color: 'text-red-600' },
    { label: 'أرصدة لمزود', path: '/supplier-credits', icon: CreditCard, color: 'text-purple-600' },
    { label: 'المصاريف', path: '/expenses', icon: TrendingDown, color: 'text-red-600' },
    { label: 'الأداء', path: '/payments', icon: Banknote, color: 'text-emerald-600' },
    { label: 'الموظفين', path: '/employees', icon: UserCheck, color: 'text-indigo-600' },
    { label: 'الحسابات', path: '/user-accounts', icon: Key, color: 'text-red-600' },
    { label: 'المنتوجات', path: '/products', icon: Package, color: 'text-purple-600' },
    { label: 'المخازن', path: '/warehouses', icon: Warehouse, color: 'text-blue-600' },
    { label: 'المخزون', path: '/stock', icon: Boxes, color: 'text-teal-600' },
    { label: 'نقل المخزون', path: '/stock-transfers', icon: ArrowRight, color: 'text-orange-600' },
    { label: 'لشرا', path: '/purchases', icon: Boxes, color: 'text-orange-600' },
    { label: 'لمزود', path: '/suppliers', icon: Building, color: 'text-gray-600' },
    { label: 'الزبناء', path: '/clients', icon: Users, color: 'text-cyan-600' },
  ]

  const isDashboard = location.pathname === '/'
  const isPOS = location.pathname === '/pos'

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-600 to-blue-800" dir="rtl">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        {!isPOS && (
          <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {!isDashboard && (
                <button
                  onClick={() => navigate('/')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                >
                  <ArrowRight size={20} className="text-gray-600" />
                  <span className="text-gray-600">العودة</span>
                </button>
              )}
              <img 
                src="/ba9alino_logo.jpeg" 
                alt="بقالينو" 
                className="h-12 w-auto object-contain"
              />
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/profile')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings size={20} className="text-gray-600" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-red-500"
              >
                <LogOut size={20} />
              </button>
            </div>
          </header>
        )}

        {/* Content */}
        <main className={`flex-1 ${isPOS ? 'overflow-hidden' : 'overflow-auto'} ${isPOS ? 'p-0' : 'p-4'}`}>
          {isDashboard ? (
            <div className="space-y-6">
              {/* Titre Ba9alino */}
              <div className="text-center">
                <h1 className="text-5xl font-bold text-white mb-2">بقالينو</h1>
                <p className="text-white/80 text-lg">نظام إدارة المتجر المتكامل</p>
              </div>
              
              {/* Menu Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {menuItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className="bg-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex flex-col items-center justify-center gap-2 cursor-pointer"
                    >
                      <Icon size={32} className={item.color} />
                      <span className="text-center text-gray-800 font-semibold text-sm">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className={`${isPOS ? 'h-full' : 'max-w-7xl mx-auto'}`}>
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
