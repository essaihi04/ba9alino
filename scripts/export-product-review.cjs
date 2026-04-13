const fs = require('fs')
const path = require('path')
const {
  buildCategoryMap,
  buildReviewRow,
  fetchAll,
  getDefaultReportsDir,
} = require('./product-review-utils.cjs')

function toCsvValue(value) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

async function main() {
  const reportsDir = getDefaultReportsDir()
  fs.mkdirSync(reportsDir, { recursive: true })

  const [products, categories] = await Promise.all([
    fetchAll('products', 'id,name_ar,sku,category_id,is_active', 'name_ar.asc'),
    fetchAll('product_categories', 'id,name_ar,name_en', 'name_ar.asc'),
  ])

  const categoryMap = buildCategoryMap(categories)
  const rows = products.map((product) => buildReviewRow(product, categoryMap))

  const summary = {
    total_products: rows.length,
    translate_to_ar_count: rows.filter((row) => row.suggested_action === 'translate_to_ar').length,
    review_exclude_count: rows.filter((row) => row.suggested_action === 'review_exclude').length,
    arabic_name_count: rows.filter((row) => row.has_arabic).length,
    latin_name_count: rows.filter((row) => row.has_latin).length,
  }

  const jsonPath = path.join(reportsDir, 'product-review-all.json')
  const csvPath = path.join(reportsDir, 'product-review-all.csv')
  const summaryPath = path.join(reportsDir, 'product-review-summary.json')

  fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2))
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))

  const headers = Object.keys(rows[0] || {
    id: '',
    sku: '',
    current_name_ar: '',
    current_category_id: '',
    current_category_name: '',
    current_is_active: '',
    has_arabic: '',
    has_latin: '',
    looks_french_only: '',
    looks_mixed_french: '',
    looks_truly_unrelated: '',
    suggested_action: '',
    apply: '',
    new_name_ar: '',
    new_category_id: '',
    deactivate: '',
    note: '',
  })

  const csvLines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => toCsvValue(row[header])).join(',')),
  ]
  fs.writeFileSync(csvPath, csvLines.join('\n'))

  console.log(JSON.stringify({
    summary,
    files: {
      json: jsonPath,
      csv: csvPath,
      summary: summaryPath,
    },
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
