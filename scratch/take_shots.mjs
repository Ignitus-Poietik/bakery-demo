import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const PORT = 5233
const DIST = path.resolve('frontend/dist')
const OUT = path.resolve('scratch/shots')
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
}

const bootstrapData = {
  settings: {
    bakery_name: "Big Bakery Patisserie",
    tagline: "Artisanal Celebration Gateaux & Handcrafted Pastries in Accra",
    is_ordering_open: true,
    closed_reason: "Our ovens are currently resting!",
    opening_hours: "Mon – Sat: 7:30 AM – 8:00 PM | Sun: 10:00 AM – 6:00 PM",
    location_address: "14 Labone Crescent, Cantonments, Accra, Ghana",
    phone_number: "+233 24 555 0192",
    whatsapp_number: "233245550192",
    delivery_enabled: true,
    pickup_enabled: true,
    delivery_fee_ghs: 25.00,
    delivery_towns: ["East Legon, Accra", "Cantonments, Accra", "Osu, Accra"],
    paystack_public_key: "pk_test_demo",
  },
  cakes: [
    {
      id: 1,
      name: "Rose Berry Velvet Gateau",
      category: "Birthday Cakes",
      description: "Three plush layers of Madagascar vanilla & hibiscus-berry sponge, whipped mascarpone cream, and fresh berry compote.",
      price_ghs: 420.00,
      is_available: true,
      weight_or_size: "8-inch Tall (12–14 slices)",
      badge: "Bestseller",
      image_url: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: 2,
      name: "Ghanaian Dark Cocoa & Salted Caramel",
      category: "Birthday Cakes",
      description: "70% single-origin Ghanaian dark chocolate sponge layered with silky couverture ganache and house-made sea salt caramel drip.",
      price_ghs: 460.00,
      is_available: true,
      weight_or_size: "8-inch Tall (12–14 slices)",
      badge: "Signature",
      image_url: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80",
    },
  ],
  promos: [],
  orders: []
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0]
  if (url === '/api/bootstrap/') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(JSON.stringify(bootstrapData))
    return
  }

  let filePath = path.join(DIST, url === '/' ? 'index.html' : url)
  if (!fs.existsSync(filePath)) {
    const pubPath = path.join('frontend/public', url)
    if (fs.existsSync(pubPath)) {
      filePath = pubPath
    } else {
      filePath = path.join(DIST, 'index.html')
    }
  }

  const ext = path.extname(filePath)
  const mime = MIME[ext] || 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': mime })
  fs.createReadStream(filePath).pipe(res)
})

server.listen(PORT, async () => {
  console.log(`Server started on http://127.0.0.1:${PORT}`)
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"

  const frames = [
    { name: '01_initial_hero', scroll: 0 },
    { name: '02_zoom_fading_letters', scroll: 550 },
    { name: '03_cake_assembled_center', scroll: 950 },
    { name: '04_tiers_split_horizontal', scroll: 1850 },
    { name: '05_cards_flipped_writings', scroll: 2600 },
    { name: '06_hero_exiting_menu_appears', scroll: 3200 },
  ]

  for (const f of frames) {
    const outPng = path.join(OUT, `${f.name}.png`)
    const targetUrl = `http://127.0.0.1:${PORT}/?scroll=${f.scroll}`
    try {
      await execFileAsync(edgePath, [
        '--headless=new',
        '--disable-gpu',
        '--window-size=1280,860',
        `--screenshot=${outPng}`,
        targetUrl,
      ])
      console.log(`Captured ${f.name} (scroll=${f.scroll})`)
    } catch (e) {
      console.error(`Error capturing ${f.name}:`, e.message)
    }
  }

  server.close()
  console.log('All screenshots captured successfully.')
  process.exit(0)
})
