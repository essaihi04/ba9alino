/**
 * Import automatique des CSV Supabase → PostgreSQL
 * Lit tous les fichiers "Supabase Snippet*.csv" dans le dossier admin-app
 * Détecte automatiquement la table depuis les colonnes JSON
 */

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const DB_CONFIG = {
  host: '87.106.246.77',
  port: 5432,
  database: 'ba9alino',
  user: 'ba9alino_admin',
  password: 'Ba9alinoAdmin2024!',
  ssl: false,
}

// Dossier contenant les CSV
const CSV_DIR = path.resolve(__dirname, '..')

// Ordre d'import FK-safe
const TABLE_ORDER = [
  'warehouses', 'employees', 'user_accounts',
  'clients', 'suppliers', 'products', 'product_variants', 'stock',
  'cash_sessions', 'orders', 'invoices',
  'payments', 'purchases', 'expenses', 'visits',
]

// Détection automatique de la table depuis les colonnes (vérifications exactes)
function detectTable(row) {
  const cols = Object.keys(row)
  const exact = (c) => cols.includes(c)
  const any = (...cs) => cs.some(c => cols.includes(c))

  // Colonnes très spécifiques → détection sûre
  if (exact('sku'))                                          return 'products'
  if (exact('variant_name') && exact('product_id'))         return 'product_variants'
  if (exact('quantity_in_stock') && exact('product_id'))    return 'stock'
  if (exact('purchase_number'))                             return 'purchases'
  if (exact('invoice_number'))                              return 'invoices'
  if (exact('payment_number'))                              return 'payments'
  if (exact('order_number'))                                return 'orders'
  // company_name_ar est unique aux clients — doit passer avant suppliers
  if (exact('company_name_ar') || exact('subscription_tier')) return 'clients'
  if (exact('contact_person_name'))                         return 'suppliers'
  // cash_sessions: seule table avec employee_id + warehouse_id ensemble
  if (exact('employee_id') && exact('warehouse_id'))        return 'cash_sessions'
  if (any('expense_date') || (exact('category') && exact('description') && !exact('order_id'))) return 'expenses'
  if (exact('pin_code') || exact('username'))               return 'user_accounts'
  if (any('employee_number', 'position', 'hire_date'))      return 'employees'
  if (any('capacity', 'location_ar') && exact('name_ar'))   return 'warehouses'
  return null
}

// Parse le CSV Supabase (format: colonne "data" contenant JSON)
function parseSupabaseCsv(content) {
  const lines = content.split('\n')
  if (lines.length < 2) return null

  const header = lines[0].trim()
  if (header !== 'data') return null

  // Rejoindre toutes les lignes suivantes (le JSON peut contenir des sauts de ligne)
  let jsonStr = lines.slice(1).join('\n').trim()

  // Enlever les guillemets extérieurs CSV si présents
  if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
    jsonStr = jsonStr.slice(1, -1)
  }
  // Unescape les doubles guillemets CSV -> guillemets JSON
  jsonStr = jsonStr.replace(/""/g, '"')

  try {
    const parsed = JSON.parse(jsonStr)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch (e) {
    // Tentative avec sanitization
    function sanitize(str) {
      let out = '', inStr = false, esc = false
      for (const ch of str) {
        const c = ch.charCodeAt(0)
        if (esc) { out += ch; esc = false; continue }
        if (ch === '\\' && inStr) { out += ch; esc = true; continue }
        if (ch === '"') { inStr = !inStr; out += ch; continue }
        if (inStr && c < 0x20) {
          if (c === 0x0A) out += '\\n'
          else if (c === 0x0D) out += '\\r'
          else if (c === 0x09) out += '\\t'
          continue
        }
        out += ch
      }
      return out
    }
    const parsed = JSON.parse(sanitize(jsonStr))
    return Array.isArray(parsed) ? parsed : [parsed]
  }
}

function inferType(val) {
  if (val === null || val === undefined) return 'TEXT'
  if (typeof val === 'boolean') return 'BOOLEAN'
  if (typeof val === 'object') return 'JSONB'
  if (typeof val === 'number') return 'NUMERIC'
  const s = String(val)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return 'UUID'
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) return 'TIMESTAMPTZ'
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'DATE'
  return 'TEXT'
}

function escapeValue(val) {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`
  return `'${String(val).replace(/'/g, "''")}'`
}

// Génère le SQL DDL pour créer la table
function generateDDL(tableName, rows) {
  const schema = {}
  for (const row of rows.slice(0, 10)) {
    for (const [col, val] of Object.entries(row)) {
      if (!schema[col] || schema[col] === 'TEXT') schema[col] = inferType(val)
    }
  }
  const cols = Object.entries(schema).map(([col, type]) =>
    `  "${col}" ${type}${col === 'id' ? ' PRIMARY KEY' : ''}`
  )
  return `CREATE TABLE IF NOT EXISTS public."${tableName}" (\n${cols.join(',\n')}\n);`
}

// Génère les INSERT SQL pour une table
function generateInserts(tableName, rows) {
  const lines = []
  for (const row of rows) {
    const columns = Object.keys(row)
    const values = columns.map(col => escapeValue(row[col]))
    lines.push(`INSERT INTO public."${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;`)
  }
  return lines.join('\n')
}

async function main() {
  console.log('🔍 Recherche des fichiers CSV Supabase...\n')

  const files = fs.readdirSync(CSV_DIR)
    .filter(f => f.startsWith('Supabase Snippet') && f.endsWith('.csv'))
    .map(f => ({ name: f, fullPath: path.join(CSV_DIR, f), size: fs.statSync(path.join(CSV_DIR, f)).size }))
    .filter(f => f.size > 500)
    .sort((a, b) => a.name.localeCompare(b.name))

  if (files.length === 0) {
    console.error('❌ Aucun fichier CSV Supabase trouvé dans', CSV_DIR)
    process.exit(1)
  }

  console.log(`📁 ${files.length} fichiers trouvés:\n`)

  const tableData = {}
  const seenSizes = new Set()

  for (const f of files) {
    const content = fs.readFileSync(f.fullPath, 'utf8')
    const rows = parseSupabaseCsv(content)

    if (!rows || rows.length === 0) { console.log(`  ⏭  ${f.name.substring(0,55)} → vide`); continue }

    if (seenSizes.has(f.size)) { console.log(`  ⏭  ${f.name.substring(0,55)} → doublon`); continue }
    seenSizes.add(f.size)

    const tableName = detectTable(rows[0])
    if (!tableName) {
      const cols = Object.keys(rows[0]).slice(0, 5).join(', ')
      console.log(`  ❓ ${f.name.substring(0,55)} → inconnu (cols: ${cols})`)
      continue
    }

    if (tableData[tableName]) { console.log(`  ⏭  ${f.name.substring(0,55)} → ${tableName} déjà traité`); continue }

    tableData[tableName] = rows
    console.log(`  ✔  ${f.name.substring(0,55)}... → "${tableName}" (${rows.length} lignes)`)
  }

  const tables = Object.keys(tableData)
  console.log(`\n📊 Tables: ${tables.join(', ')}\n`)

  // Générer le fichier SQL
  const outputFile = path.join(__dirname, 'ba9alino-import.sql')
  const ordered = TABLE_ORDER.filter(t => tables.includes(t))
  const remaining = tables.filter(t => !TABLE_ORDER.includes(t))
  const importOrder = [...ordered, ...remaining]

  console.log('🔨 Génération du fichier SQL...')
  const sqlParts = [
    '-- Ba9alino Import SQL',
    '-- Généré le ' + new Date().toISOString(),
    '',
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
    'CREATE EXTENSION IF NOT EXISTS "pgcrypto";',
    'SET session_replication_role = replica;',
    '',
  ]

  for (const t of importOrder) {
    const rows = tableData[t]
    sqlParts.push(`-- ===== ${t} (${rows.length} lignes) =====`)
    sqlParts.push(generateDDL(t, rows))
    sqlParts.push(generateInserts(t, rows))
    sqlParts.push('')
    console.log(`  ✅ ${t}: ${rows.length} lignes`)
  }

  sqlParts.push('SET session_replication_role = DEFAULT;')
  sqlParts.push('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ba9alino_anon;')
  sqlParts.push('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ba9alino_anon;')

  fs.writeFileSync(outputFile, sqlParts.join('\n'), 'utf8')
  const sizeMB = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(1)

  console.log(`\n🎉 Fichier généré: ${outputFile} (${sizeMB} MB)\n`)
  console.log('📋 Prochaines étapes:')
  console.log('  1. scp "' + outputFile + '" root@87.106.246.77:/root/ba9alino-import.sql')
  console.log('  2. ssh root@87.106.246.77 "sudo -u postgres psql ba9alino -f /root/ba9alino-import.sql"')
}


main()
