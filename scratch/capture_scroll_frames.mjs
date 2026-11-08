import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const PORT = 5199
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

// 1. Mock API Data from backend seed
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
    delivery_towns: ["East Legon, Accra", "Cantonments, Accra", "Osu, Accra", "Tema Community 1"],
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
    {
      id: 3,
      name: "Golden Crunch Hazelnut Praline Cake",
      category: "Birthday Cakes",
      description: "Toasted hazelnut sponge, feuilletine praline crunch, and whipped espresso-caramel swiss meringue buttercream.",
      price_ghs: 490.00,
      is_available: false,
      weight_or_size: "8-inch (10–12 slices)",
      badge: "Popular",
      image_url: "https://images.unsplash.com/photo-1602351447937-745cb720612f?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: 4,
      name: "Two-Tier Ivory Peony Celebration Cake",
      category: "Wedding & Custom",
      description: "Elegant two-tier almond & lemon elderflower sponge finished in smooth ivory buttercream with sugar peonies and gold leaf.",
      price_ghs: 1250.00,
      is_available: true,
      weight_or_size: "6-inch + 9-inch Two-Tier (35–40 servings)",
      badge: "Custom Tier",
      image_url: "https://images.unsplash.com/photo-1535141192574-5d4897c12636?auto=format&fit=crop&w=800&q=80",
    }
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
    // Check public dir
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
  console.log(`Preview server running at http://localhost:${PORT}`)

  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  const userDataDir = path.resolve('scratch/edge_profile')
  const chromeProc = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    '--remote-debugging-port=9222',
    `--user-data-dir=${userDataDir}`,
    '--window-size=1280,840',
    `http://localhost:${PORT}`,
  ])

  // wait for CDP port
  await new Promise((r) => setTimeout(r, 2000))

  try {
    const listRes = await fetch('http://127.0.0.1:9222/json')
    const tabs = await listRes.json()
    const targetTab = tabs.find((t) => t.url.includes(`localhost:${PORT}`)) || tabs[0]
    console.log('Connecting to tab:', targetTab.webSocketDebuggerUrl)

    const ws = new WebSocket(targetTab.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      ws.onopen = resolve
      ws.onerror = reject
    })

    let idCounter = 1
    function sendCommand(method, params = {}) {
      return new Promise((resolve) => {
        const id = idCounter++
        function handler(event) {
          const msg = JSON.parse(event.data)
          if (msg.id === id) {
            ws.removeEventListener('message', handler)
            resolve(msg.result)
          }
        }
        ws.addEventListener('message', handler)
        ws.send(JSON.stringify({ id, method, params }))
      })
    }

    await sendCommand('Page.enable')
    await sendCommand('DOM.enable')

    // Wait for fonts & images to settle
    await new Promise((r) => setTimeout(r, 2500))

    const scrollSteps = [
      { name: '1_hero_wordmark_initial', y: 0 },
      { name: '2_hero_zoom_reveal', y: 450 },
      { name: '3_hero_cake_assembled', y: 900 },
      { name: '4_hero_tiers_split_horizontal', y: 1750 },
      { name: '5_hero_cards_flipped_content', y: 2450 },
      { name: '6_hero_exit_to_menu', y: 3100 },
    ]

    for (const step of scrollSteps) {
      await sendCommand('Runtime.evaluate', {
        expression: `window.scrollTo({ top: ${step.y}, behavior: 'instant' }); document.documentElement.scrollTop = ${step.y};`,
      })
      await new Promise((r) => setTimeout(r, 600))

      const shot = await sendCommand('Page.captureScreenshot', { format: 'png' })
      if (shot && shot.data) {
        const buf = Buffer.from(shot.data, 'base64')
        const shotPath = path.join(OUT, `${step.name}.png`)
        fs.writeFileSync(shotPath, buf)
        console.log(`Saved screenshot: ${step.name}.png (${buf.length} bytes)`)
      }
    }

    ws.close()
  } catch (err) {
    console.error('CDP Error:', err)
  } finally {
    chromeProc.kill()
    server.close()
    process.exit(0)
  }
})
