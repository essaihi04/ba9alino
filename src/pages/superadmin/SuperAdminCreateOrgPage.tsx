import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Building2, User, Lock, Mail, Phone, Hash } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getSuperAdminCreds } from '../../store/superAdmin'

export default function SuperAdminCreateOrgPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    org_name: '',
    org_slug: '',
    admin_username: '',
    admin_password: '',
    admin_full_name: '',
    contact_email: '',
    contact_phone: '',
  })

  const slugify = (s: string) =>
    s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const creds = getSuperAdminCreds()
    if (!creds) { navigate('/login'); return }

    if (!form.org_name || !form.org_slug || !form.admin_username || !form.admin_password) {
      setError('Veuillez remplir les champs obligatoires.')
      return
    }
    if (form.admin_password.length < 6) {
      setError('Le mot de passe administrateur doit contenir au moins 6 caractères.')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('superadmin_create_organization', {
        ...creds,
        p_org_name: form.org_name.trim(),
        p_org_slug: slugify(form.org_slug),
        p_admin_username: form.admin_username.trim().toLowerCase(),
        p_admin_password: form.admin_password,
        p_admin_full_name: form.admin_full_name.trim() || null,
        p_contact_email: form.contact_email.trim() || null,
        p_contact_phone: form.contact_phone.trim() || null,
      })
      if (error) throw error
      if (!(data as any)?.success) {
        const errCode = String((data as any)?.error || 'unknown')
        const map: Record<string, string> = {
          slug_exists: 'Ce slug est déjà utilisé.',
          admin_username_exists: 'Ce nom d\'admin est déjà utilisé.',
        }
        setError(map[errCode] || `Erreur: ${errCode}`)
        setLoading(false)
        return
      }
      alert(`✅ Organisation "${form.org_name}" créée.\nAdmin: ${form.admin_username} / ${form.admin_password}`)
      navigate('/superadmin')
    } catch (e: any) {
      setError(e?.message || 'Échec de la création.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-2xl mx-auto">
        <Link to="/superadmin" className="text-slate-300 hover:text-white inline-flex items-center gap-2 mb-6">
          <ArrowLeft size={18} /> Retour
        </Link>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-xl">
              <Building2 className="text-white" size={24} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Nouvelle organisation</h1>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset className="border rounded-xl p-4">
              <legend className="px-2 text-sm font-bold text-gray-700">Organisation</legend>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input
                    type="text"
                    value={form.org_name}
                    onChange={e => setForm({ ...form, org_name: e.target.value, org_slug: form.org_slug || slugify(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: Magasin Casa Centre"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL) *</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={form.org_slug}
                      onChange={e => setForm({ ...form, org_slug: slugify(e.target.value) })}
                      className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                      placeholder="magasin-casa-centre"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email contact</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 text-gray-400" size={18} />
                      <input
                        type="email"
                        value={form.contact_email}
                        onChange={e => setForm({ ...form, contact_email: e.target.value })}
                        className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 text-gray-400" size={18} />
                      <input
                        type="tel"
                        value={form.contact_phone}
                        onChange={e => setForm({ ...form, contact_phone: e.target.value })}
                        className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset className="border rounded-xl p-4">
              <legend className="px-2 text-sm font-bold text-gray-700">Administrateur initial</legend>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom d'utilisateur *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={form.admin_username}
                      onChange={e => setForm({ ...form, admin_username: e.target.value.toLowerCase() })}
                      className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="admin_casa"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={form.admin_password}
                      onChange={e => setForm({ ...form, admin_password: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      placeholder="min. 6 caractères"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                  <input
                    type="text"
                    value={form.admin_full_name}
                    onChange={e => setForm({ ...form, admin_full_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3 rounded-lg disabled:opacity-50 hover:shadow-lg transition"
            >
              {loading ? 'Création…' : 'Créer l\'organisation'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
