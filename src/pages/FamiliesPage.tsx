import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Category {
  id: string
  name_ar: string
  name_en?: string
  description_ar?: string
  description_en?: string
}

export default function FamiliesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [formData, setFormData] = useState({
    name_ar: '',
    name_en: '',
    description_ar: '',
    description_en: '',
  })

  const loadCategories = async () => {
    setLoading(true)
    try {
      let data: any[] | null = null
      let error: any = null

      const attempt = await supabase
        .from('product_categories')
        .select('*')
        .eq('is_active', true)
        .order('name_ar')

      data = attempt.data as any[]
      error = attempt.error

      if (error) {
        const msg = String((error as any)?.message || '')
        const code = String((error as any)?.code || '')
        const missingIsActive = code === '42703' || msg.toLowerCase().includes('is_active')
        if (!missingIsActive) throw error

        const fallback = await supabase
          .from('product_categories')
          .select('*')
          .order('name_ar')

        data = fallback.data as any[]
        error = fallback.error
      }

      if (error) throw error
      setCategories((data || []) as Category[])
      setSelectedIds(new Set())
    } catch (e) {
      console.error('Error loading categories:', e)
      alert('❌ حدث خطأ أثناء تحميل العائلات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const filteredCategories = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((c) => String(c.name_ar || '').toLowerCase().includes(q))
  }, [categories, searchTerm])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const filteredIds = filteredCategories.map(c => c.id)
      const allSelected = filteredIds.length > 0 && filteredIds.every(id => prev.has(id))
      if (allSelected) return new Set()
      return new Set(filteredIds)
    })
  }

  const deleteCategory = async (category: Category, moveLinked: boolean) => {
    const { data: productsInCategory, error: checkErr } = await supabase
      .from('products')
      .select('id, name_ar')
      .eq('category_id', category.id)
      .limit(5)

    if (checkErr) throw checkErr

    if ((productsInCategory || []).length > 0) {
      if (!moveLinked) return

      const { error: moveErr } = await supabase
        .from('products')
        .update({ category_id: null })
        .eq('category_id', category.id)

      if (moveErr) throw moveErr
    }

    {
      const { error: softErr } = await supabase
        .from('product_categories')
        .update({ is_active: false } as any)
        .eq('id', category.id)

      if (softErr) {
        const msg = String((softErr as any)?.message || '')
        const code = String((softErr as any)?.code || '')
        const missingIsActive = code === '42703' || msg.toLowerCase().includes('is_active')

        if (!missingIsActive) throw softErr

        const { error: delErr } = await supabase
          .from('product_categories')
          .delete()
          .eq('id', category.id)

        if (delErr) throw delErr
      }
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = String(formData.name_ar || '').trim()
    if (!name) return

    setSaving(true)
    try {
      const { data: existing, error: findErr } = await supabase
        .from('product_categories')
        .select('id')
        .eq('name_ar', name)
        .maybeSingle()

      if (!findErr && existing?.id) {
        alert('⚠️ هذه العائلة موجودة بالفعل')
        return
      }

      const payload: any = {
        name_ar: name,
        name_en: formData.name_en || null,
        description_ar: formData.description_ar || null,
        description_en: formData.description_en || null,
      }

      const { error } = await supabase.from('product_categories').insert(payload)
      if (error) throw error

      setFormData({ name_ar: '', name_en: '', description_ar: '', description_en: '' })
      await loadCategories()
      alert('✅ تم إنشاء العائلة بنجاح')
    } catch (e) {
      console.error('Error creating category:', e)
      alert('❌ حدث خطأ أثناء إنشاء العائلة')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (category: Category) => {
    const ok = confirm(`حذف العائلة: ${category.name_ar} ؟`)
    if (!ok) return

    try {
      const { data: productsInCategory } = await supabase
        .from('products')
        .select('id, name_ar')
        .eq('category_id', category.id)
        .limit(5)

      let moveLinked = true
      if ((productsInCategory || []).length > 0) {
        const names = (productsInCategory || []).map((p: any) => p.name_ar).join(', ')
        moveLinked = confirm(
          `هذه العائلة مرتبطة بمنتجات (مثال):\n${names}${(productsInCategory || []).length === 5 ? '...' : ''}\n\n` +
            `المتابعة = نقل المنتجات إلى "بدون عائلة" ثم حذف العائلة.`
        )
      }

      await deleteCategory(category, moveLinked)

      await loadCategories()
      alert('✅ تم حذف العائلة')
    } catch (e) {
      console.error('Error deleting category:', e)
      alert('❌ حدث خطأ أثناء حذف العائلة')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    const targets = filteredCategories.filter(c => selectedIds.has(c.id))
    const ok = confirm(`حذف ${targets.length} عائلة؟`)
    if (!ok) return

    let moveLinked = true
    try {
      let hasLinked = false
      for (const category of targets) {
        const { data: productsInCategory, error: checkErr } = await supabase
          .from('products')
          .select('id')
          .eq('category_id', category.id)
          .limit(1)

        if (checkErr) throw checkErr
        if ((productsInCategory || []).length > 0) {
          hasLinked = true
          break
        }
      }

      if (hasLinked) {
        moveLinked = confirm('بعض العائلات مرتبطة بمنتجات. هل تريد نقل المنتجات إلى "بدون عائلة" ثم الحذف؟')
      }

      for (const category of targets) {
        await deleteCategory(category, moveLinked)
      }

      await loadCategories()
      alert('✅ تم حذف العائلات المحددة')
    } catch (e) {
      console.error('Error deleting categories:', e)
      alert('❌ حدث خطأ أثناء حذف العائلات')
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-800">العائلات</h1>
          <div className="relative w-full md:w-96">
            <Search className="absolute right-3 top-3 text-gray-400" size={20} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث عن عائلة..."
              className="w-full pr-10 pl-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                value={formData.name_ar}
                onChange={(e) => setFormData((p) => ({ ...p, name_ar: e.target.value }))}
                placeholder="اسم العائلة (عربي)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Plus size={18} />
              إضافة
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              value={formData.name_en}
              onChange={(e) => setFormData((p) => ({ ...p, name_en: e.target.value }))}
              placeholder="اسم العائلة (EN)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
            />
            <input
              value={formData.description_ar}
              onChange={(e) => setFormData((p) => ({ ...p, description_ar: e.target.value }))}
              placeholder="وصف (عربي)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
            />
            <input
              value={formData.description_en}
              onChange={(e) => setFormData((p) => ({ ...p, description_en: e.target.value }))}
              placeholder="Description (EN)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg"
            />
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-500">جاري التحميل...</div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-center py-12 text-gray-500">لا توجد عائلات</div>
        ) : (
          <div className="overflow-x-auto">
            {selectedIds.size > 0 && (
              <div className="px-6 py-3 border-b bg-purple-50 flex items-center justify-between">
                <div className="text-sm text-gray-700">تم تحديد {selectedIds.size} عائلة</div>
                <button
                  onClick={handleBulkDelete}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold"
                >
                  حذف المحدد
                </button>
              </div>
            )}
            <table className="w-full">
              <thead className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
                <tr>
                  <th className="px-4 py-4 text-right font-bold">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={
                          filteredCategories.length > 0 &&
                          filteredCategories.every(c => selectedIds.has(c.id))
                        }
                        onChange={toggleSelectAll}
                      />
                      <span>العائلة</span>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-right font-bold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-purple-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="w-4 h-4"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                        />
                        <div>
                          <div className="font-bold text-gray-800">{c.name_ar}</div>
                          {c.name_en ? <div className="text-sm text-gray-500">{c.name_en}</div> : null}
                        </div>
                      </div>
                      {c.name_en ? <div className="text-sm text-gray-500">{c.name_en}</div> : null}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDelete(c)}
                        className="text-red-600 hover:text-red-800 font-bold flex items-center gap-2"
                      >
                        <Trash2 size={18} />
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
