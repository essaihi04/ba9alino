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
    throw new Error(`PATCH ${productId} HTTP ${response.status}: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return data
}

async function main() {
  const forceApply = process.argv.includes('--apply')
  const reportsDir = getDefaultReportsDir()
  const inputPath = path.join(reportsDir, 'product-corrections-to-apply.json')

  if (!fs.existsSync(inputPath)) {
    throw new Error(`File not found: ${inputPath}\nRun "node scripts/build-corrections.cjs" first.`)
  }

  const corrections = JSON.parse(fs.readFileSync(inputPath, 'utf8'))

  const patches = []
  for (const c of corrections) {
    const patch = {}
    if (c.action === 'deactivate' && c.deactivate) patch.is_active = false
    if (c.action === 'update_name_from_excel' && c.new_name_ar) patch.name_ar = c.new_name_ar
    if (c.new_image_url) patch.image_url = c.new_image_url
    if (c.new_category_id) patch.category_id = c.new_category_id
    if (Object.keys(patch).length > 0) {
      patches.push({ id: c.id, sku: c.sku, current_name: c.current_name_ar, action: c.action, patch })
    }
  }

  if (!forceApply) {
    console.log(`DRY RUN — ${patches.length} corrections prêtes`)
    console.log(`Ajoute --apply pour exécuter sur Supabase.\n`)
    const byAction = {}
    patches.forEach(p => { byAction[p.action] = (byAction[p.action] || 0) + 1 })
    console.log(JSON.stringify(byAction, null, 2))
    console.log('\nÉchantillon (15):')
    console.log(JSON.stringify(patches.slice(0, 15).map(p => ({ sku: p.sku, name: p.current_name, patch: p.patch })), null, 2))
    return
  }

  // APPLY
  console.log(`🚀 Application de ${patches.length} corrections sur Supabase...`)
  const results = []
  const errors = []
  let done = 0

  for (const p of patches) {
    try {
      const updated = await patchProduct(p.id, p.patch)
      results.push({ id: p.id, sku: p.sku, patch: p.patch, ok: true })
    } catch (e) {
      errors.push({ id: p.id, sku: p.sku, patch: p.patch, error: e.message })
      console.error(`❌ ${p.sku}: ${e.message}`)
    }
    done++
    if (done % 50 === 0) console.log(`  ...${done}/${patches.length}`)
  }

  const outputPath = path.join(reportsDir, 'product-corrections-applied.json')
  fs.writeFileSync(outputPath, JSON.stringify({ applied: results.length, errors: errors.length, results, errors }, null, 2))

  console.log(`\n✅ Terminé: ${results.length} réussis, ${errors.length} erreurs`)
  console.log(`📁 Rapport: ${outputPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
