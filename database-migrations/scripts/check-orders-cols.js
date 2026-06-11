const { Pool } = require('pg')
const pool = new Pool({ host: 'localhost', port: 5432, database: 'ba9alino', user: 'ba9alino_admin', password: 'Ba9alinoAdmin2024!' })
async function main() {
  const c = await pool.connect()
  const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='orders' ORDER BY ordinal_position")
  console.log('orders:', r.rows.map(x => x.column_name).join(', '))
  const r2 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='order_items' ORDER BY ordinal_position")
  console.log('order_items:', r2.rows.map(x => x.column_name).join(', '))
  const r3 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='product_categories' ORDER BY ordinal_position")
  console.log('product_categories:', r3.rows.map(x => x.column_name).join(', '))
  c.release(); await pool.end()
}
main().catch(e => { console.error(e.message); process.exit(1) })
