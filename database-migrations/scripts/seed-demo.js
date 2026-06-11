/**
 * Seed demo data for arbicasa and mohamed grosiste organizations
 * Products: 75-110 per store
 * Orders: 10-15 per store
 *
 * Run on the server:
 *   cd /opt/ba9alino/ && node seed-demo.js
 * Or from local after copying:
 *   scp seed-demo.js root@87.106.246.77:/opt/ba9alino/seed-demo.js
 *   ssh root@87.106.246.77 "cd /opt/ba9alino && node seed-demo.js"
 */

const { Pool } = require('pg')

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'ba9alino',
  user: 'ba9alino_admin',
  password: 'Ba9alinoAdmin2024!',
})

const ORG_NAMES = ['arbicasa', 'mohamed grosiste']

// Categories in Arabic
const CATEGORIES = [
  { name_ar: 'مواد غذائية', name_en: 'Alimentation' },
  { name_ar: 'مشروبات', name_en: 'Boissons' },
  { name_ar: 'منتجات التنظيف', name_en: 'Produits de nettoyage' },
  { name_ar: 'مستحضرات التجميل', name_en: 'Cosmétiques' },
  { name_ar: 'لوازم المطبخ', name_en: 'Ustensiles de cuisine' },
  { name_ar: 'إلكترونيات', name_en: 'Électronique' },
  { name_ar: 'ملابس', name_en: 'Vêtements' },
  { name_ar: 'أدوات مدرسية', name_en: 'Fournitures scolaires' },
]

// Product name templates per category (Arabic)
const PRODUCT_TEMPLATES = {
  'مواد غذائية': [
    'أرز بسمتي', 'سكر أبيض', 'دقيق فاخر', 'زيت نباتي', 'معكرونة سباغيتي',
    'عدس أحمر', 'حمص مجفف', 'فول سوداني', 'تمر مدجول', 'عصير برتقال',
    'صلصة طماطم', 'مربى فراولة', 'جبن أبيض', 'لبن زبادي', 'زبدة طبيعية',
    'شاي أخضر', 'قهوة تركية', 'كاكاو بودرة', 'كورن فليكس', 'عسل طبيعي',
  ],
  'مشروبات': [
    'ماء معدني', 'مشروب غازي', 'عصير تفاح', 'عصير مانجو', 'شاي بالنعناع',
    'قهوة سريعة الذوبان', 'حليب بالشوكولاتة', 'مشروب طاقة', 'عصير عنب', 'شراب الفواكه',
  ],
  'منتجات التنظيف': [
    'صابون غسيل', 'مسحوق تنظيف', 'منظف زجاج', 'معطر جو', 'منظف أرضيات',
    'صابون استحمام', 'شامبو شعر', 'معجون أسنان', 'فرشاة أسنان', 'مناديل مبللة',
    'منظف مطبخ', 'مبيض ملابس', 'منديل ورقي', 'قفازات مطاطية', 'مضاد للجراثيم',
  ],
  'مستحضرات التجميل': [
    'كريم ترطيب', 'أحمر شفاه', 'ماسكارا', 'كريم أساس', 'عطر فاخر',
    'لوشن الجسم', 'زيت للشعر', 'قناع الوجه', 'مزيل مكياج', 'كريم لليدين',
  ],
  'لوازم المطبخ': [
    'سكين مطبخ', 'طاسة قلي', 'غلاية ماء', 'وعاء بلاستيكي', 'صحن زجاجي',
    'كوب سيراميك', 'ملاعق خشبية', 'لوح تقطيع', 'مصفاة', 'علب تخزين',
  ],
  'إلكترونيات': [
    'سماعات رأس', 'كابل شحن', 'شاحن حائطي', 'بطارية خارجية', 'مصباح LED',
    'ماوس لاسلكي', 'لوحة مفاتيح', 'كاميرا ويب', 'سماعة بلوتوث', 'مروحة صغيرة',
  ],
  'ملابس': [
    'قميص رجالي', 'بنطلون جينز', 'تيشيرت قطني', 'جاكيت خفيف', 'حذاء رياضي',
    'جوارب قطنية', 'قبعة صيفية', 'وشاح', 'حزام جلدي', 'نظارة شمسية',
  ],
  'أدوات مدرسية': [
    'قلم حبر', 'دفتر ملاحظات', 'ممحاة', 'مسطرة بلاستيكية', 'ألوان مائية',
    'مقلمة', 'مبراة', 'غماء بلاستيكي', 'مجلد ورقي', 'كيس قرطاسية',
  ],
}

// Client names (Arabic)
const CLIENT_NAMES = [
  'محمد العلي', 'أحمد بن صالح', 'خالد الزهراوي', 'يوسف المنصوري',
  'عبد الرحمن الفاسي', 'كريم البغدادي', 'طارق الحسني', 'سمير التونسي',
  'ناصر القادري', 'هشام الجزائري', 'عمر السعودي', 'فؤاد المصري',
  'زيد العراقي', 'باسم الشامي', 'لؤي الخليلي', 'رامي الكوفي',
  'وائل السوري', 'ماجد اليمني', 'سفيان الليبي', 'جلال المغربي',
]

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randFloat(min, max, decimals = 2) {
  const val = Math.random() * (max - min) + min
  return parseFloat(val.toFixed(decimals))
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function seedOrganization(client, orgName) {
  console.log(`\n=== Seeding ${orgName} ===`)

  // 1) Find org ID
  const orgRes = await client.query(
    "SELECT id FROM organizations WHERE name ILIKE $1 OR slug ILIKE $1 LIMIT 1",
    [orgName]
  )
  if (orgRes.rows.length === 0) {
    console.error(`Organization "${orgName}" not found!`)
    return
  }
  const orgId = orgRes.rows[0].id
  console.log(`  org_id: ${orgId}`)

  // 2) Insert categories (if not already there) and get their IDs
  const categoryIds = {}
  for (const cat of CATEGORIES) {
    const existing = await client.query(
      "SELECT id FROM product_categories WHERE name_ar = $1 AND organization_id = $2 LIMIT 1",
      [cat.name_ar, orgId]
    )
    if (existing.rows.length > 0) {
      categoryIds[cat.name_ar] = existing.rows[0].id
    } else {
      const inserted = await client.query(
        "INSERT INTO product_categories (name_ar, name_en, organization_id) VALUES ($1, $2, $3) RETURNING id",
        [cat.name_ar, cat.name_en, orgId]
      )
      categoryIds[cat.name_ar] = inserted.rows[0].id
    }
  }
  console.log(`  Categories: ${Object.keys(categoryIds).length}`)

  // 3) Count existing products for this org
  const existingProdRes = await client.query(
    "SELECT COUNT(*) FROM products WHERE organization_id = $1",
    [orgId]
  )
  const existingCount = parseInt(existingProdRes.rows[0].count, 10)
  console.log(`  Existing products: ${existingCount}`)

  const targetProducts = rand(75, 110)
  const productsToAdd = Math.max(0, targetProducts - existingCount)
  console.log(`  Target: ${targetProducts}, Adding: ${productsToAdd}`)

  const insertedProducts = []
  if (productsToAdd > 0) {
    const cats = shuffle(Object.keys(categoryIds))
    let prodIdx = 0

    for (let i = 0; i < productsToAdd; i++) {
      const catName = cats[i % cats.length]
      const templates = PRODUCT_TEMPLATES[catName] || ['منتج عام']
      const tpl = templates[rand(0, templates.length - 1)]
      const prodName = `${tpl} - ${rand(100, 999)}`
      const sku = `SKU-${rand(1000, 9999)}-${rand(10, 99)}`
      const priceA = randFloat(50, 2500)
      const priceB = parseFloat((priceA * 0.85).toFixed(2))
      const priceC = parseFloat((priceA * 0.75).toFixed(2))
      const priceD = parseFloat((priceA * 0.65).toFixed(2))
      const priceE = parseFloat((priceA * 0.55).toFixed(2))
      const costPrice = parseFloat((priceA * 0.40).toFixed(2))

      const catId = categoryIds[catName]
      const stockQty = rand(10, 500)

      const res = await client.query(
        `INSERT INTO products (
          sku, name_ar, name_en, description_ar, category_id,
          price, price_a, price_b, price_c, price_d, price_e,
          cost_price, stock, is_active, organization_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING id`,
        [
          sku,
          prodName,
          `${prodName} (EN)`,
          `${prodName} - منتج عالي الجودة`,
          catId,
          priceA,
          priceA,
          priceB,
          priceC,
          priceD,
          priceE,
          costPrice,
          stockQty,
          true,
          orgId,
        ]
      )
      const prodId = res.rows[0].id
      insertedProducts.push(prodId)

      prodIdx++
    }
  }
  console.log(`  Products added: ${insertedProducts.length}`)

  // 4) Get all products for this org (for order items)
  const allProdsRes = await client.query(
    "SELECT id, name_ar, price, price_b, price_c, price_d, price_e FROM products WHERE organization_id = $1",
    [orgId]
  )
  const allProducts = allProdsRes.rows
  console.log(`  Total products for orders: ${allProducts.length}`)

  // 5) Insert clients (if needed)
  const clientCountRes = await client.query(
    "SELECT COUNT(*) FROM clients WHERE organization_id = $1",
    [orgId]
  )
  const existingClients = parseInt(clientCountRes.rows[0].count, 10)
  const clientsToAdd = Math.max(0, 10 - existingClients)

  const clientIds = []
  for (let i = 0; i < clientsToAdd; i++) {
    const name = CLIENT_NAMES[rand(0, CLIENT_NAMES.length - 1)]
    const res = await client.query(
      `INSERT INTO clients (
        company_name_ar, contact_person_name, contact_person_phone,
        address, city, subscription_tier, is_active, organization_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id`,
      [
        name,
        name,
        `0${rand(5, 7)}${rand(10000000, 99999999)}`,
        `${rand(1, 100)} شارع ${rand(1, 50)}`,
        'الجزائر',
        ['A', 'B', 'C', 'D', 'E'][rand(0, 4)],
        true,
        orgId,
      ]
    )
    clientIds.push(res.rows[0].id)
  }

  // Get existing client IDs
  const allClientsRes = await client.query(
    "SELECT id FROM clients WHERE organization_id = $1",
    [orgId]
  )
  const allClientIds = allClientsRes.rows.map(r => r.id)
  console.log(`  Total clients for orders: ${allClientIds.length}`)

  // 6) Insert orders (10-15)
  const orderCountRes = await client.query(
    "SELECT COUNT(*) FROM orders WHERE organization_id = $1",
    [orgId]
  )
  const existingOrders = parseInt(orderCountRes.rows[0].count, 10)
  const targetOrders = rand(10, 15)
  const ordersToAdd = Math.max(0, targetOrders - existingOrders)
  console.log(`  Existing orders: ${existingOrders}, Target: ${targetOrders}, Adding: ${ordersToAdd}`)

  const statuses = ['pending', 'processing', 'completed', 'cancelled']
  const paymentStatuses = ['unpaid', 'partial', 'paid']
  const sources = ['pos', 'web', 'manual']

  for (let o = 0; o < ordersToAdd; o++) {
    const orderDate = new Date()
    orderDate.setDate(orderDate.getDate() - rand(0, 60))

    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${o}`
    const clientId = allClientIds[rand(0, allClientIds.length - 1)]
    const status = statuses[rand(0, statuses.length - 1)]
    const paymentStatus = paymentStatuses[rand(0, paymentStatuses.length - 1)]
    const source = sources[rand(0, sources.length - 1)]

    const orderRes = await client.query(
      `INSERT INTO orders (
        order_number, client_id, order_date, status, payment_status,
        source, notes, organization_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id`,
      [
        orderNumber,
        clientId,
        orderDate.toISOString().split('T')[0],
        status,
        paymentStatus,
        source,
        `Commande demo #${o + 1}`,
        orgId,
      ]
    )
    const orderId = orderRes.rows[0].id

    // Insert order items (1-5 items per order)
    const itemCount = rand(1, 5)
    const shuffledProds = shuffle(allProducts)
    let subtotal = 0

    for (let j = 0; j < itemCount; j++) {
      const prod = shuffledProds[j]
      const qty = rand(1, 10)
      const unitPrice = parseFloat(prod.price)
      const totalPrice = parseFloat((qty * unitPrice).toFixed(2))
      subtotal += totalPrice

      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, product_name_ar, organization_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [orderId, prod.id, qty, unitPrice, totalPrice, prod.name_ar || 'منتج', orgId]
      )
    }

    // Update order totals
    const taxAmount = parseFloat((subtotal * 0.19).toFixed(2))
    const discount = rand(0, 1) === 0 ? parseFloat((subtotal * 0.05).toFixed(2)) : 0
    const totalAmount = parseFloat((subtotal + taxAmount - discount).toFixed(2))

    await client.query(
      `UPDATE orders SET
        subtotal = $1,
        tax_amount = $2,
        discount_amount = $3,
        total_amount = $4,
        updated_at = NOW()
      WHERE id = $5`,
      [subtotal, taxAmount, discount, totalAmount, orderId]
    )
  }

  console.log(`  Orders added: ${ordersToAdd}`)
  console.log(`=== Done seeding ${orgName} ===`)
}

async function main() {
  const client = await pool.connect()
  try {
    for (const orgName of ORG_NAMES) {
      await seedOrganization(client, orgName)
    }
    console.log('\n✅ All demo data seeded successfully!')
  } catch (err) {
    console.error('\n❌ Error:', err.message)
    console.error(err.stack)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
