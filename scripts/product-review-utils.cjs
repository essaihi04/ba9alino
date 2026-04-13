const path = require('path')

const DEFAULT_SUPABASE_URL = 'https://pvztozmqrbjxsyqwxmex.supabase.co'
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2enRvem1xcmJqeHN5cXd4bWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MTc5NTksImV4cCI6MjA4NDQ5Mzk1OX0.APCmDFTCTP_Cj1lLdOW1_DSPGD0ofhrfI-3EBF7V5Go'

function getSupabaseConfig() {
  return {
    url: process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    key: process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY,
  }
}

function getHeaders(extra = {}) {
  const { key } = getSupabaseConfig()
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  }
}

async function fetchAll(table, select, orderBy) {
  const { url } = getSupabaseConfig()
  const pageSize = 1000
  let from = 0
  let rows = []

  while (true) {
    const requestUrl = `${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=${encodeURIComponent(orderBy)}`
    const response = await fetch(requestUrl, {
      headers: getHeaders({
        Range: `${from}-${from + pageSize - 1}`,
        'Range-Unit': 'items',
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(`${table} HTTP ${response.status}: ${JSON.stringify(data).slice(0, 500)}`)
    }
    rows = rows.concat(data || [])
    if (!data || data.length < pageSize) break
    from += pageSize
  }

  return rows
}

function hasArabic(text) {
  return /[\u0600-\u06FF]/.test(String(text || ''))
}

function hasLatin(text) {
  return /[A-Za-zÀ-ÿ]/.test(String(text || ''))
}

function looksFrenchOnly(name) {
  const value = String(name || '').trim()
  if (!value) return false
  return hasLatin(value) && !hasArabic(value)
}

function looksMixedFrench(name) {
  const value = String(name || '').trim()
  if (!value) return false
  return hasLatin(value) && /\b(de|du|la|le|des|avec|pour|sans|et|au|aux|comprim[eé]s?|jus|natural|mix|paste|herbal|petit|beurre|decor|biotin|century|shampoo|gel|cr[eè]me|capsule|vitamin)\b/i.test(value)
}

function isMolHanoutCompatible(name, categoryName) {
  const value = `${String(name || '')} ${String(categoryName || '')}`.toLowerCase()
  const keepKeywords = [
    'shampoo',
    'shampooing',
    'gel douche',
    'déodorant',
    'deodorant',
    'savon',
    'dentifrice',
    'crème fraiche',
    'beurre',
    'lait',
    'jus',
    'biscuit',
    'gaufrette',
    'sauce',
    'coco',
    'boisson',
    'eau',
    'water',
    'malt',
    'cola',
    'coffee',
    'café',
    'farine',
    'دقيق',
    'maizena',
  ]

  return keepKeywords.some((keyword) => value.includes(keyword))
}

function looksTrulyUnrelated(name, categoryName) {
  const value = `${String(name || '')} ${String(categoryName || '')}`.toLowerCase()
  if (isMolHanoutCompatible(name, categoryName)) return false

  const unrelatedKeywords = [
    'vitamin',
    'vitamine',
    'multivitamin',
    'biotin',
    'zinc',
    'magnesium',
    'collagen',
    'capsule',
    'capsules',
    'comprim',
    'aphrodisiac',
    'herbal mix',
    'nutrition',
    '21st century',
    'california gold',
    'bodymass',
    'biotechusa',
    'additiva',
    'propolis',
    'epimedium',
    'dolostop',
    'sécabies',
    'mcg',
    ' mg',
    'omega-3',
    'probiotics',
    'minerals',
    'vitamins',
    'hyaluronic',
  ]

  return unrelatedKeywords.some((keyword) => value.includes(keyword))
}

function buildCategoryMap(categories) {
  return new Map(categories.map((category) => [category.id, category.name_ar || category.name_en || '']))
}

function buildReviewRow(product, categoryMap) {
  const categoryName = categoryMap.get(product.category_id) || ''
  const frenchOnly = looksFrenchOnly(product.name_ar)
  const mixedFrench = !frenchOnly && looksMixedFrench(product.name_ar)
  const trulyUnrelated = looksTrulyUnrelated(product.name_ar, categoryName)
  const suggestedAction = trulyUnrelated
    ? 'review_exclude'
    : (frenchOnly || mixedFrench)
      ? 'translate_to_ar'
      : ''

  return {
    id: product.id,
    sku: product.sku || '',
    current_name_ar: product.name_ar || '',
    current_category_id: product.category_id || '',
    current_category_name: categoryName,
    current_is_active: product.is_active !== false,
    has_arabic: hasArabic(product.name_ar),
    has_latin: hasLatin(product.name_ar),
    looks_french_only: frenchOnly,
    looks_mixed_french: mixedFrench,
    looks_truly_unrelated: trulyUnrelated,
    suggested_action: suggestedAction,
    apply: '',
    new_name_ar: '',
    new_category_id: '',
    deactivate: '',
    note: '',
  }
}

function getDefaultReportsDir() {
  return path.join(process.cwd(), 'reports')
}

module.exports = {
  buildCategoryMap,
  buildReviewRow,
  fetchAll,
  getDefaultReportsDir,
  getSupabaseConfig,
  getHeaders,
  hasArabic,
  hasLatin,
  isMolHanoutCompatible,
  looksFrenchOnly,
  looksMixedFrench,
  looksTrulyUnrelated,
}
