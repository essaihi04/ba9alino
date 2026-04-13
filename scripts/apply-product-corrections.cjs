const fs = require('fs')
const path = require('path')
const {
  getDefaultReportsDir,
  getHeaders,
  getSupabaseConfig,
} = require('./product-review-utils.cjs')

async function patchProduct(productId, patch) {
  const { url } = getSupabaseConfig()
  const requestUrl = `${url}/rest/v1/products?id=eq.${encodeURIComponent(productId)}`
  const response = await fetch(requestUrl, {
    method: 'PATCH',
    headers: getHeaders({
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(patch),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(`PATCH ${productId} HTTP ${response.status}: ${JSON.stringify(data).slice(0, 500)}`)
  }

  return data
}

function parseBoolean(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized) return null
  if (['1', 'true', 'yes', 'y', 'oui'].includes(normalized)) return true
  if (['0', 'false', 'no', 'n', 'non'].includes(normalized)) return false
  return null
}

function buildPatch(row) {
  const patch = {}
  const apply = parseBoolean(row.apply)
  if (apply !== true) return null

  const newName = String(row.new_name_ar || '').trim()
  const newCategoryId = String(row.new_category_id || '').trim()
  const deactivate = parseBoolean(row.deactivate)

  if (newName) patch.name_ar = newName
  if (newCategoryId) patch.category_id = newCategoryId
  if (deactivate !== null) patch.is_active = !deactivate

  return Object.keys(patch).length > 0 ? patch : null
}

async function main() {
  const reportsDir = getDefaultReportsDir()
  const inputPath = process.argv[2] || path.join(reportsDir, 'product-review-all.json')
  const forceApply = process.argv.includes('--apply')

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Correction file not found: ${inputPath}`)
  }

  const rows = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
  const actions = rows
    .map((row) => ({ row, patch: buildPatch(row) }))
    .filter((entry) => entry.patch)

  if (!forceApply) {
    console.log(JSON.stringify({
      dry_run: true,
      message: 'Add --apply to execute updates on Supabase.',
      file: inputPath,
      changes_count: actions.length,
      sample: actions.slice(0, 20).map(({ row, patch }) => ({
        id: row.id,
        sku: row.sku,
        current_name_ar: row.current_name_ar,
        patch,
      })),
    }, null, 2))
    return
  }

  const results = []
  for (const { row, patch } of actions) {
    const updated = await patchProduct(row.id, patch)
    results.push({
      id: row.id,
      sku: row.sku,
      patch,
      updated,
    })
  }

  const outputPath = path.join(reportsDir, 'product-corrections-applied.json')
  fs.writeFileSync(outputPath, JSON.stringify({
    applied_count: results.length,
    results,
  }, null, 2))

  console.log(JSON.stringify({
    dry_run: false,
    applied_count: results.length,
    output: outputPath,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
