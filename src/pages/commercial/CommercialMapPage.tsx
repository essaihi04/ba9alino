import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, MapPin, Navigation, Phone, Plus } from 'lucide-react'

interface Client {
  id: string
  company_name_ar: string
  contact_person_name: string
  contact_person_phone: string
  address?: string
  gps_lat?: number
  gps_lng?: number
  subscription_tier: string
  commercial_id?: string
}

export default function CommercialMapPage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    const commercialId = localStorage.getItem('commercial_id')
    if (!commercialId) {
      navigate('/commercial/login')
      return
    }

    loadClients(commercialId)
    getUserLocation()
  }, [navigate])

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => {
          console.error('Error getting location:', error)
        }
      )
    }
  }

  const loadClients = async (commercialId: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('created_by', commercialId)
        .order('company_name_ar')

      if (error) throw error
      setClients(data || [])
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  const openInMaps = (client: Client) => {
    if (client.gps_lat && client.gps_lng) {
      // Try geo: protocol first (works better on mobile apps)
      const geoUrl = `geo:${client.gps_lat},${client.gps_lng}?q=${client.gps_lat},${client.gps_lng}(${encodeURIComponent(client.company_name_ar)})`
      // Fallback to Google Maps web URL
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${client.gps_lat},${client.gps_lng}`
      
      // On mobile, try geo: first, then fallback to Google Maps
      window.location.href = geoUrl
      
      // Fallback after short delay if geo: doesn't work
      setTimeout(() => {
        window.open(mapsUrl, '_blank')
      }, 300)
    }
  }

  const clientsWithLocation = clients.filter(c => c.gps_lat && c.gps_lng)
  const clientsWithoutLocation = clients.filter(c => !c.gps_lat || !c.gps_lng)

  const sortedClients = userLocation 
    ? [...clientsWithLocation].sort((a, b) => {
        const distA = calculateDistance(userLocation.lat, userLocation.lng, a.gps_lat!, a.gps_lng!)
        const distB = calculateDistance(userLocation.lat, userLocation.lng, b.gps_lat!, b.gps_lng!)
        return distA - distB
      })
    : clientsWithLocation

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/commercial/dashboard')}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">خريطة العملاء</h1>
            <p className="text-green-100 text-sm">
              {clientsWithLocation.length} عميل مع موقع
            </p>
          </div>
          {userLocation && (
            <div className="bg-white/20 px-3 py-2 rounded-lg">
              <Navigation size={20} />
            </div>
          )}
        </div>
      </div>

      {/* Clients with Location */}
      <div className="p-4 space-y-3">
        <h2 className="font-bold text-gray-800 mb-3">العملاء القريبون</h2>
        
        {loading ? (
          <div className="text-center py-12 text-gray-500">جاري التحميل...</div>
        ) : sortedClients.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500">لا يوجد عملاء بموقع محدد</p>
          </div>
        ) : (
          sortedClients.map((client) => {
            const distance = userLocation 
              ? calculateDistance(userLocation.lat, userLocation.lng, client.gps_lat!, client.gps_lng!)
              : null

            return (
              <div
                key={client.id}
                onClick={() => openInMaps(client)}
                className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800 text-lg mb-1">
                      {client.company_name_ar}
                    </h3>
                    <p className="text-sm text-gray-600">{client.contact_person_name}</p>
                    {client.address && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <MapPin size={12} />
                        {client.address}
                      </p>
                    )}
                  </div>
                  {distance !== null && (
                    <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold">
                      {distance.toFixed(1)} km
                    </div>
                  )}
                </div>

                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openInMaps(client)}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Navigation size={16} />
                    التوجيه
                  </button>
                  <button
                    onClick={() => navigate(`/commercial/visits/new?client=${client.id}`)}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    زيارة
                  </button>
                  <a
                    href={`tel:${client.contact_person_phone}`}
                    className="bg-orange-600 text-white p-2 rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    <Phone size={20} />
                  </a>
                </div>
              </div>
            )
          })
        )}

        {/* Clients without Location */}
        {clientsWithoutLocation.length > 0 && (
          <>
            <h2 className="font-bold text-gray-800 mb-3 mt-6">عملاء بدون موقع</h2>
            {clientsWithoutLocation.map((client) => (
              <div
                key={client.id}
                className="bg-gray-100 rounded-xl p-4 border-2 border-dashed border-gray-300"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-700">{client.company_name_ar}</h3>
                    <p className="text-sm text-gray-500">{client.contact_person_name}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/commercial/clients/${client.id}/edit`)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    إضافة موقع
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
