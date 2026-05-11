import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Plus, LogOut, Power, Trash2, Users, Package, ShoppingCart, Shield } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSuperAdminStore, getSuperAdminCreds } from '../../store/superAdmin'

interface Org {
  id: string
  name: string
  slug: string
  is_active: boolean
  is_default: boolean
  plan: string
  contact_email: string | null
  contact_phone: string | null
  created_at: string
  members_count: number
  products_count: number
  orders_count: number
}

export default function SuperAdminDashboardPage() {
  const navigate = useNavigate()
  const { fullName, username, logout } = useSuperAdminStore()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchOrgs = async () => {
    const creds = getSuperAdminCreds()
    if (!creds) { navigate('/login'); return }
    setLoading(true); setError('')
    try {
      const { data, error } = await supabase.rpc('superadmin_list_organizations', creds)
      if (error) throw error
      setOrgs((data || []) as Org[])
    } catch (e: any) {
      setError(e?.message || 'Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrgs() }, [])

  const toggleActive = async (org: Org) => {
    const creds = getSuperAdminCreds()
    if (!creds) return
    const ok = window.confirm(`${org.is_active ? 'Désactiver' : 'Activer'} l'organisation "${org.name}" ?`)
    if (!ok) return
    const { data, error } = await supabase.rpc('superadmin_toggle_organization', {
      ...creds,
      p_org_id: org.id,
      p_active: !org.is_active,
    })
    if (error) { alert(error.message); return }
    if (!(data as any)?.success) {
      alert('Erreur: ' + ((data as any)?.error || 'unknown'))
      return
    }
    fetchOrgs()
  }

  const deleteOrg = async (org: Org) => {
    const creds = getSuperAdminCreds()
    if (!creds) return
    if (org.is_default) { alert('Impossible de supprimer l\'organisation par défaut.'); return }
    const ok = window.confirm(`Supprimer définitivement "${org.name}" et toutes ses données ? Cette action est irréversible.`)
    if (!ok) return
    const ok2 = window.confirm(`Confirmer la suppression DÉFINITIVE de "${org.name}" ?`)
    if (!ok2) return
    const { data, error } = await supabase.rpc('superadmin_delete_organization', {
      ...creds,
      p_org_id: org.id,
      p_hard: true,
    })
    if (error) { alert(error.message); return }
    if (!(data as any)?.success) {
      alert('Erreur: ' + ((data as any)?.error || 'unknown'))
      return
    }
    fetchOrgs()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 flex items-center justify-between border border-white/10">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-xl">
              <Shield className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">SuperAdmin</h1>
              <p className="text-sm text-slate-300">{fullName || username}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/superadmin/organizations/new"
              className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-semibold hover:shadow-lg transition"
            >
              <Plus size={18} /> Nouvelle organisation
            </Link>
            <button
              onClick={() => { logout(); navigate('/login') }}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
            >
              <LogOut size={18} /> Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {error && (
          <div className="mb-4 bg-red-500/20 border border-red-500/30 text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-slate-300 py-20">Chargement…</div>
        ) : orgs.length === 0 ? (
          <div className="text-center text-slate-300 py-20">Aucune organisation.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orgs.map(org => (
              <div
                key={org.id}
                className={`bg-white rounded-2xl p-6 shadow-xl border ${org.is_active ? 'border-transparent' : 'border-red-300 opacity-75'}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-lg">
                      <Building2 className="text-white" size={20} />
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-900">{org.name}</h2>
                      <p className="text-xs text-gray-500">{org.slug}</p>
                    </div>
                  </div>
                  {org.is_default && (
                    <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full font-semibold">
                      Par défaut
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <Users className="mx-auto text-slate-500 mb-1" size={16} />
                    <div className="text-sm font-bold">{org.members_count}</div>
                    <div className="text-xs text-slate-500">Membres</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <Package className="mx-auto text-slate-500 mb-1" size={16} />
                    <div className="text-sm font-bold">{org.products_count}</div>
                    <div className="text-xs text-slate-500">Produits</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <ShoppingCart className="mx-auto text-slate-500 mb-1" size={16} />
                    <div className="text-sm font-bold">{org.orders_count}</div>
                    <div className="text-xs text-slate-500">Commandes</div>
                  </div>
                </div>

                {(org.contact_email || org.contact_phone) && (
                  <div className="text-xs text-gray-600 mb-4 space-y-1">
                    {org.contact_email && <div>📧 {org.contact_email}</div>}
                    {org.contact_phone && <div>📞 {org.contact_phone}</div>}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => toggleActive(org)}
                    disabled={org.is_default && org.is_active}
                    className={`flex-1 px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition ${
                      org.is_active
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                        : 'bg-green-100 hover:bg-green-200 text-green-800'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Power size={14} /> {org.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                  <button
                    onClick={() => deleteOrg(org)}
                    disabled={org.is_default}
                    className="px-3 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    title={org.is_default ? 'Impossible de supprimer l\'org par défaut' : 'Supprimer'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
