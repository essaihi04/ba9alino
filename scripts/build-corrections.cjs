const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')
const {
  buildCategoryMap,
  fetchAll,
  getDefaultReportsDir,
  hasArabic,
  hasLatin,
  looksTrulyUnrelated,
  isMolHanoutCompatible,
} = require('./product-review-utils.cjs')

async function main() {
  const reportsDir = getDefaultReportsDir()
  fs.mkdirSync(reportsDir, { recursive: true })

  // ─── 1. Charger les produits Supabase ───
  console.log('📦 Chargement des produits Supabase...')
  const [products, categories] = await Promise.all([
    fetchAll('products', 'id,name_ar,sku,category_id,is_active', 'name_ar.asc'),
    fetchAll('product_categories', 'id,name_ar,name_en', 'name_ar.asc'),
  ])
  const categoryMap = buildCategoryMap(categories)

  // ─── 2. Charger le fichier Excel ───
  console.log('📊 Chargement du fichier Excel...')
  const wb = XLSX.readFile(path.join(process.cwd(), 'products.xlsx'))
  const ws = wb.Sheets[wb.SheetNames[0]]
  const excelRows = XLSX.utils.sheet_to_json(ws)

  // Index Excel par barcode
  const excelByBarcode = new Map()
  for (const row of excelRows) {
    const barcode = String(row['الباركود'] || '').trim()
    if (barcode) excelByBarcode.set(barcode, row)
  }
  console.log(`📊 Excel: ${excelRows.length} lignes, ${excelByBarcode.size} barcodes uniques`)

  // ─── 3. Construire les corrections ───
  const corrections = []
  let translateCount = 0
  let deactivateCount = 0
  let imageUpdateCount = 0
  let categoryUpdateCount = 0
  let noChangeCount = 0

  for (const product of products) {
    const sku = String(product.sku || '').trim()
    const currentName = String(product.name_ar || '').trim()
    const categoryName = categoryMap.get(product.category_id) || ''
    const currentHasArabic = hasArabic(currentName)
    const currentHasLatin = hasLatin(currentName)
    const excelRow = excelByBarcode.get(sku)

    const correction = {
      id: product.id,
      sku,
      current_name_ar: currentName,
      current_category_id: product.category_id || '',
      current_category_name: categoryName,
      current_is_active: product.is_active !== false,
      current_image_url: product.image_url || '',
      excel_name: '',
      excel_category: '',
      excel_image: '',
      action: '',
      new_name_ar: '',
      new_category_id: '',
      new_image_url: '',
      deactivate: false,
      note: '',
    }

    if (excelRow) {
      correction.excel_name = String(excelRow['الاسم'] || '').trim()
      correction.excel_category = String(excelRow['الفئة'] || '').trim()
      correction.excel_image = String(excelRow['رابط الصورة'] || '').trim()
    }

    const isTrulyUnrelated = looksTrulyUnrelated(currentName, categoryName)
    const isMolHanout = isMolHanoutCompatible(currentName, categoryName)

    // ─── Cas 1: Produit hors épicerie (non mol hanout) ───
    if (isTrulyUnrelated && !isMolHanout) {
      correction.action = 'deactivate'
      correction.deactivate = true
      correction.note = 'Produit hors épicerie / non mol-hanout'
      deactivateCount++
      corrections.push(correction)
      continue
    }

    // ─── Cas 2: Produit avec nom uniquement en français/latin ───
    if (currentHasLatin && !currentHasArabic) {
      // Si Excel a un nom avec arabe, l'utiliser
      const excelName = correction.excel_name
      const excelHasArabic = hasArabic(excelName)

      if (excelHasArabic && excelName) {
        correction.action = 'update_name_from_excel'
        correction.new_name_ar = excelName
        correction.note = 'Nom arabe trouvé dans le fichier Excel'
        translateCount++

        // Aussi mettre à jour l'image si Excel en a une et pas Supabase
        if (correction.excel_image && !correction.current_image_url) {
          correction.new_image_url = correction.excel_image
          imageUpdateCount++
        }

        // Aussi mettre à jour la catégorie si Excel en a une et pas Supabase
        if (correction.excel_category && !correction.current_category_name) {
          // Chercher catégorie correspondante dans Supabase
          const matchedCategory = categories.find(c =>
            (c.name_ar || '').includes(correction.excel_category) ||
            (correction.excel_category || '').includes(c.name_ar || '')
          )
          if (matchedCategory) {
            correction.new_category_id = matchedCategory.id
            categoryUpdateCount++
          }
        }
      } else if (excelName && excelName !== currentName) {
        // Excel a un nom différent mais aussi en latin → on garde le nom Excel (plus propre)
        correction.action = 'update_name_from_excel'
        correction.new_name_ar = excelName
        correction.note = 'Nom amélioré depuis Excel (même langue)'
        translateCount++
      } else {
        // Pas de meilleur nom dans Excel → garder tel quel, juste flaguer
        correction.action = 'keep_french'
        correction.note = 'Nom français sans traduction disponible'
        noChangeCount++
      }

      corrections.push(correction)
      continue
    }

    // ─── Cas 3: Produit mixte arabe+français ───
    if (currentHasArabic && currentHasLatin) {
      const excelName = correction.excel_name
      const excelHasArabic = hasArabic(excelName)

      // Si Excel a un nom plus arabe (moins de latin), l'utiliser
      if (excelHasArabic && excelName && excelName !== currentName) {
        const excelLatinRatio = (excelName.match(/[A-Za-z]/g) || []).length / Math.max(excelName.length, 1)
        const currentLatinRatio = (currentName.match(/[A-Za-z]/g) || []).length / Math.max(currentName.length, 1)
        if (excelLatinRatio < currentLatinRatio) {
          correction.action = 'update_name_from_excel'
          correction.new_name_ar = excelName
          correction.note = 'Nom Excel plus arabe que le nom actuel'
          translateCount++
        } else {
          correction.action = 'keep'
          noChangeCount++
        }
      } else {
        correction.action = 'keep'
        noChangeCount++
      }

      // Image si manquante
      if (correction.excel_image && !correction.current_image_url) {
        correction.new_image_url = correction.excel_image
        imageUpdateCount++
      }

      corrections.push(correction)
      continue
    }

    // ─── Cas 4: Produit déjà en arabe ───
    if (currentHasArabic && !currentHasLatin) {
      // Juste image si manquante
      if (correction.excel_image && !correction.current_image_url) {
        correction.new_image_url = correction.excel_image
        correction.action = 'update_image'
        imageUpdateCount++
      } else {
        correction.action = 'keep'
      }
      noChangeCount++
      corrections.push(correction)
      continue
    }

    // ─── Cas 5: Autres ───
    correction.action = 'keep'
    noChangeCount++
    corrections.push(correction)
  }

  // ─── 4. Sauvegarder ───
  const summary = {
    total_products: products.length,
    total_corrections: corrections.length,
    translate_count: translateCount,
    deactivate_count: deactivateCount,
    image_update_count: imageUpdateCount,
    category_update_count: categoryUpdateCount,
    no_change_count: noChangeCount,
    excel_matched: corrections.filter(c => c.excel_name).length,
    excel_unmatched: corrections.filter(c => !c.excel_name).length,
  }

  const correctionsWithAction = corrections.filter(c => c.action !== 'keep' && c.action !== 'keep_french')

  fs.writeFileSync(
    path.join(reportsDir, 'product-corrections-full.json'),
    JSON.stringify(corrections, null, 2)
  )
  fs.writeFileSync(
    path.join(reportsDir, 'product-corrections-to-apply.json'),
    JSON.stringify(correctionsWithAction, null, 2)
  )
  fs.writeFileSync(
    path.join(reportsDir, 'product-corrections-summary.json'),
    JSON.stringify(summary, null, 2)
  )

  console.log('\n✅ Rapport généré:')
  console.log(JSON.stringify(summary, null, 2))
  console.log(`\n📁 Fichiers:`)
  console.log(`  - product-corrections-full.json (${corrections.length} produits)`)
  console.log(`  - product-corrections-to-apply.json (${correctionsWithAction.length} corrections)`)
  console.log(`  - product-corrections-summary.json`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
