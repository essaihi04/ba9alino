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
  const inputPath = path.join(reportsDir, 'product-translations.json')

  if (!fs.existsSync(inputPath)) {
    throw new Error(`File not found: ${inputPath}\nRun "node scripts/translate-names.cjs" first.`)
  }

  const translations = JSON.parse(fs.readFileSync(inputPath, 'utf8'))

  if (!forceApply) {
    console.log(`DRY RUN — ${translations.length} traductions prêtes`)
    console.log(`Ajoute --apply pour exécuter sur Supabase.\n`)
    console.log('Échantillon (20):')
    console.log(JSON.stringify(translations.slice(0, 20).map(t => ({
      sku: t.sku,
      current: t.current_name_ar,
      new: t.new_name_ar,
    })), null, 2))
    return
  }

  // APPLY
  console.log(`🚀 Application de ${translations.length} traductions sur Supabase...`)
  const results = []
  const errors = []
  let done = 0

  for (const t of translations) {
    try {
      const updated = await patchProduct(t.id, { name_ar: t.new_name_ar })
      results.push({ id: t.id, sku: t.sku, ok: true })
    } catch (e) {
      errors.push({ id: t.id, sku: t.sku, error: e.message })
      console.error(`❌ ${t.sku}: ${e.message}`)
    }
    done++
    if (done % 100 === 0) console.log(`  ...${done}/${translations.length}`)
  }

  const outputPath = path.join(reportsDir, 'product-translations-applied.json')
  fs.writeFileSync(outputPath, JSON.stringify({ applied: results.length, errors: errors.length, errors_sample: errors.slice(0, 10) }, null, 2))

  console.log(`\n✅ Terminé: ${results.length} réussis, ${errors.length} erreurs`)
  console.log(`📁 Rapport: ${outputPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
