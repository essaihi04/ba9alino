const fs = require('fs')
const path = require('path')

const SUPABASE_URL = 'https://pvztozmqrbjxsyqwxmex.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2enRvem1xcmJqeHN5cXd4bWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MTc5NTksImV4cCI6MjA4NDQ5Mzk1OX0.APCmDFTCTP_Cj1lLdOW1_DSPGD0ofhrfI-3EBF7V5Go'

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
}

async function fetchAll(table, select, orderBy) {
  const pageSize = 1000
  let from = 0
  let rows = []

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=${encodeURIComponent(orderBy)}`
    const res = await fetch(url, {
      headers: {
        ...headers,
        Range: `${from}-${from + pageSize - 1}`,
        'Range-Unit': 'items',
      },
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(`${table} HTTP ${res.status}: ${JSON.stringify(data).slice(0, 500)}`)
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

function looksFrenchOrLatin(name) {
  const s = String(name || '').trim()
  if (!s) return false
  return hasLatin(s) && !hasArabic(s)
}

function looksMixedMostlyFrench(name) {
  const s = String(name || '').trim()
  if (!s) return false
  return hasLatin(s) && /\b(de|du|la|le|des|avec|pour|sans|et|au|aux|comprim[eé]s?|jus|natural|mix|paste|herbal|petit|beurre|decor|biotin|century|shampoo|gel|cr[eè]me|capsule|vitamin)\b/i.test(s)
}

function looksNonGrocery(name, categoryName) {
  const s = `${String(name || '')} ${String(categoryName || '')}`.toLowerCase()
  const patterns = [
    'biotin', 'vitamin', 'vitamine', 'aphrodisiac', 'herbal', 'paste', 'comprim', 'capsule', 'gel', 'serum', 'cream', 'crème', 'savon', 'shampoo', 'dentifrice', 'parfum', 'déodorant', 'deodorant', 'cosmetic', 'cosmétique', 'sécabies', 'dolostop', '21st century', 'collagen', 'nutrition', 'caffeine', 'coffein', 'multivitamin', 'propolis'
  ]
  return patterns.some(p => s.includes(p))
}

function toEntry(product, categoryMap) {
  return {
    id: product.id,
    name_ar: product.name_ar,
    sku: product.sku,
    category_id: product.category_id || null,
    category_name: categoryMap.get(product.category_id) || null,
  }
}

async function main() {
  const [products, categories] = await Promise.all([
    fetchAll('products', 'id,name_ar,sku,category_id', 'name_ar.asc'),
    fetchAll('product_categories', 'id,name_ar,name_en', 'name_ar.asc'),
  ])

  const categoryMap = new Map(categories.map(c => [c.id, c.name_ar || c.name_en || '']))

  const frenchOnly = []
  const mixedFrench = []
  const nonGrocery = []

  for (const product of products) {
    const entry = toEntry(product, categoryMap)
    if (looksFrenchOrLatin(product.name_ar)) frenchOnly.push(entry)
    else if (looksMixedMostlyFrench(product.name_ar)) mixedFrench.push(entry)

    if (looksNonGrocery(product.name_ar, entry.category_name)) nonGrocery.push(entry)
  }

  const outDir = path.join(process.cwd(), 'reports')
  fs.mkdirSync(outDir, { recursive: true })

  fs.writeFileSync(path.join(outDir, 'product-audit-summary.json'), JSON.stringify({
    total_products: products.length,
    total_categories: categories.length,
    french_only_count: frenchOnly.length,
    mixed_french_count: mixedFrench.length,
    non_grocery_suspect_count: nonGrocery.length,
  }, null, 2))

  fs.writeFileSync(path.join(outDir, 'product-audit-french-only.json'), JSON.stringify(frenchOnly, null, 2))
  fs.writeFileSync(path.join(outDir, 'product-audit-mixed-french.json'), JSON.stringify(mixedFrench, null, 2))
  fs.writeFileSync(path.join(outDir, 'product-audit-non-grocery.json'), JSON.stringify(nonGrocery, null, 2))

  console.log(JSON.stringify({
    total_products: products.length,
    total_categories: categories.length,
    french_only_count: frenchOnly.length,
    mixed_french_count: mixedFrench.length,
    non_grocery_suspect_count: nonGrocery.length,
    reports_dir: outDir,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
