/**
 * Ba9alino — Import JSON backup → PostgreSQL
 * Crée les tables automatiquement depuis le JSON (pas besoin de schéma séparé)
 *
 * Usage:
 *   node import-backup.js <chemin-vers-backup.json>
 *
 * Exemple:
 *   node import-backup.js backup-ba9alino.json
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

// Ordre d'insertion pour respecter les foreign keys
const TABLE_ORDER = [
  'warehouses', 'employees', 'user_accounts', 'virtual_accounts',
  'clients', 'products', 'product_variants', 'stock', 'warehouse_stock',
  'suppliers', 'cash_sessions', 'purchases', 'purchase_items',
  'supplier_payments', 'orders', 'order_items', 'invoices', 'invoice_items',
  'payments', 'cash_session_reports', 'expenses', 'employee_transactions',
  'visits', 'coupons', 'coupon_usage', 'company_info', 'audit_logs',
]

// Déduire le type PostgreSQL depuis une valeur JS
function inferType(val) {
  if (val === null || val === undefined) return 'TEXT'
  if (typeof val === 'boolean') return 'BOOLEAN'
  if (typeof val === 'object') return 'JSONB'
  if (typeof val === 'number') return Number.isInteger(val) ? 'NUMERIC' : 'NUMERIC'
  const s = String(val)
  // UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return 'UUID'
  // Timestamp
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) return 'TIMESTAMPTZ'
  // Date
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'DATE'
  return 'TEXT'
}

// Construire le schéma de colonnes depuis les données
function inferSchema(rows) {
  const schema = {}
  for (const row of rows.slice(0, 10)) {
    for (const [col, val] of Object.entries(row)) {
      if (!schema[col] || schema[col] === 'TEXT') {
        schema[col] = inferType(val)
      }
    }
  }
  return schema
}

// Créer la table si elle n'existe pas
async function createTable(client, tableName, rows) {
  const schema = inferSchema(rows)
  const cols = Object.entries(schema).map(([col, type]) => {
    const isPK = col === 'id'
    return `"${col}" ${type}${isPK ? ' PRIMARY KEY' : ''}`
  })
  const ddl = `CREATE TABLE IF NOT EXISTS public."${tableName}" (${cols.join(', ')})`
  try {
    await client.query(ddl)
    console.log(`  🏗  Table "${tableName}" créée/vérifiée`)
  } catch (e) {
    console.warn(`  ⚠️  Création table "${tableName}" ignorée: ${e.message.substring(0, 80)}`)
  }
}

function escapeValue(val) {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`
  return `'${String(val).replace(/'/g, "''")}'`
}

async function importTable(client, tableName, rows) {
  if (!rows || rows.length === 0) {
    console.log(`  ⏭  ${tableName}: vide`)
    return
  }

  await createTable(client, tableName, rows)

  console.log(`  📥 ${tableName}: import de ${rows.length} lignes...`)
  let inserted = 0, errors = 0

  // Import par batch de 50
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    for (const row of batch) {
      const columns = Object.keys(row)
      const values = columns.map(col => escapeValue(row[col]))
      const sql = `INSERT INTO public."${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING`
      try {
        await client.query(sql)
        inserted++
      } catch (e) {
        errors++
        if (errors <= 2) console.warn(`    ⚠️  ${e.message.substring(0, 100)}`)
      }
    }
  }

  console.log(`  ✅ ${tableName}: ${inserted}/${rows.length} insérées${errors ? `, ${errors} erreurs` : ''}`)
}

async function main() {
  const backupFile = process.argv[2]
  if (!backupFile) {
    console.error('Usage: node import-backup.js <backup-file.json>')
    process.exit(1)
  }

  const filePath = path.resolve(backupFile)
  if (!fs.existsSync(filePath)) {
    console.error(`Fichier introuvable: ${filePath}`)
    process.exit(1)
  }

  console.log(`📂 Lecture: ${filePath}`)
  const raw = fs.readFileSync(filePath, 'utf8')

  let backup
  try {
    // Echapper les caractères de contrôle à l'intérieur des chaînes JSON (machine à états)
    function sanitizeJson(str) {
      let out = ''
      let inString = false
      let escaped = false
      for (let i = 0; i < str.length; i++) {
        const ch = str[i]
        const code = ch.charCodeAt(0)
        if (escaped) { out += ch; escaped = false; continue }
        if (ch === '\\' && inString) { out += ch; escaped = true; continue }
        if (ch === '"') { inString = !inString; out += ch; continue }
        if (inString && code < 0x20) {
          if (code === 0x0A) out += '\\n'
          else if (code === 0x0D) out += '\\r'
          else if (code === 0x09) out += '\\t'
          // Ignorer les autres caractères de contrôle
          continue
        }
        out += ch
      }
      return out
    }
    backup = JSON.parse(sanitizeJson(raw))
    if (backup.export_all_tables) backup = backup.export_all_tables
    if (Array.isArray(backup) && backup[0]?.export_all_tables) backup = backup[0].export_all_tables
  } catch (e) {
    console.error('JSON invalide:', e.message)
    process.exit(1)
  }

  const tables = Object.keys(backup)
  console.log(`📊 ${tables.length} tables trouvées: ${tables.join(', ')}\n`)

  const client = new Client(DB_CONFIG)
  try {
    console.log('🔌 Connexion à PostgreSQL sur 87.106.246.77...')
    await client.connect()
    console.log('✅ Connecté!\n')

    // Extensions requises
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`)

    // Désactiver les contraintes FK pendant l'import
    await client.query('SET session_replication_role = replica')

    const ordered = TABLE_ORDER.filter(t => tables.includes(t))
    const remaining = tables.filter(t => !TABLE_ORDER.includes(t))
    const importOrder = [...ordered, ...remaining]

    for (const tableName of importOrder) {
      if (backup[tableName] !== undefined) {
        await importTable(client, tableName, backup[tableName])
      }
    }

    // Réactiver les contraintes
    await client.query('SET session_replication_role = DEFAULT')

    // Permissions
    await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ba9alino_anon')
    await client.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ba9alino_anon')

    console.log('\n🎉 Import terminé avec succès!\n')
    console.log('📊 Vérification finale:')
    for (const t of importOrder) {
      if (backup[t] && backup[t].length > 0) {
        try {
          const r = await client.query(`SELECT COUNT(*) FROM public."${t}"`)
          console.log(`  ${t}: ${r.rows[0].count} lignes`)
        } catch (_) {}
      }
    }

  } catch (e) {
    console.error('Erreur fatale:', e.message)
  } finally {
    await client.end()
  }
}

main()
