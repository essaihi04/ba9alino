/**
 * Import d'une table depuis un fichier JSON individuel
 *
 * Usage:
 *   node import-table.js <nom_table> <fichier.json>
 *
 * Exemple:
 *   node import-table.js products table_products.json
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
      continue
    }
    out += ch
  }
  return out
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

function inferSchema(rows) {
  const schema = {}
  for (const row of rows.slice(0, 10)) {
    for (const [col, val] of Object.entries(row)) {
      if (!schema[col] || schema[col] === 'TEXT') schema[col] = inferType(val)
    }
  }
  return schema
}

function escapeValue(val) {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`
  return `'${String(val).replace(/'/g, "''")}'`
}

async function main() {
  const tableName = process.argv[2]
  const backupFile = process.argv[3]

  if (!tableName || !backupFile) {
    console.error('Usage: node import-table.js <table> <fichier.json>')
    process.exit(1)
  }

  const filePath = path.resolve(backupFile)
  if (!fs.existsSync(filePath)) {
    console.error(`Fichier introuvable: ${filePath}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(filePath, 'utf8')
  let rows
  try {
    const parsed = JSON.parse(sanitizeJson(raw))
    // Supporte { data: [...] } ou directement [...]
    rows = parsed.data || parsed
    if (!Array.isArray(rows)) rows = [rows]
  } catch (e) {
    console.error('JSON invalide:', e.message)
    process.exit(1)
  }

  console.log(`📊 Table "${tableName}": ${rows.length} lignes`)

  const client = new Client(DB_CONFIG)
  try {
    await client.connect()
    console.log('✅ Connecté à PostgreSQL')

    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`)
    await client.query('SET session_replication_role = replica')

    // Créer la table si nécessaire
    if (rows.length > 0) {
      const schema = inferSchema(rows)
      const cols = Object.entries(schema).map(([col, type]) =>
        `"${col}" ${type}${col === 'id' ? ' PRIMARY KEY' : ''}`
      )
      const ddl = `CREATE TABLE IF NOT EXISTS public."${tableName}" (${cols.join(', ')})`
      try { await client.query(ddl) } catch (_) {}
    }

    let inserted = 0, errors = 0
    for (const row of rows) {
      const columns = Object.keys(row)
      const values = columns.map(col => escapeValue(row[col]))
      const sql = `INSERT INTO public."${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING`
      try { await client.query(sql); inserted++ }
      catch (e) { errors++; if (errors <= 3) console.warn(`  ⚠️  ${e.message.substring(0, 100)}`) }
    }

    await client.query('SET session_replication_role = DEFAULT')
    await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON public."${tableName}" TO ba9alino_anon`)

    const count = await client.query(`SELECT COUNT(*) FROM public."${tableName}"`)
    console.log(`🎉 "${tableName}": ${inserted}/${rows.length} insérées${errors ? `, ${errors} erreurs` : ''} — Total en base: ${count.rows[0].count}`)

  } catch (e) {
    console.error('Erreur:', e.message)
  } finally {
    await client.end()
  }
}

main()
