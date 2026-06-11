const { Pool } = require('pg')
const pool = new Pool({ host: 'localhost', port: 5432, database: 'ba9alino', user: 'ba9alino_admin', password: 'Ba9alinoAdmin2024!' })
async function main() {
  const c = await pool.connect()
  const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='products' ORDER BY ordinal_position")
  console.log(r.rows.map(x => x.column_name).join('\n'))
  c.release(); await pool.end()
}
main().catch(e => { console.error(e.message); process.exit(1) })
