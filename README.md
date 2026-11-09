# Big Bakery Patisserie

A full-stack online cake storefront, guest ordering & Paystack checkout system, and SaaS business management console built with **Django REST Framework** and **React + Vite**.

---

## Features

### 1. Customer Storefront & Immersive Hero
- **158-Frame Scroll-Scrubbed Hero Sequence**: Hardware-accelerated HTML5 `<canvas>` unboxing sequence (`frontend/public/hero-frames/ezgif-frame-001.jpg` – `158.jpg`) with a translucent title veil that clears on scroll and blurs smoothly into the cake menu.
- **Cake Catalog & Filtering**: Browse cakes by category (`Birthday Cakes`, `Wedding & Custom`, `Cupcakes & Boxes`, `Cheesecakes`, `Pastries & Slices`) or search by keyword.
- **Live Availability**: Available cakes support quantity selection and instant cart addition; sold-out cakes remain visible on the menu with a clear **Sold Out** state and cannot be ordered.
- **Whole-Bakery Ordering State**: Displays whether online ordering is open or paused, along with opening hours, bakery location, and direct contact links.

### 2. Guest Checkout, Paystack Payment & Downloadable Receipts
- **No Account Required**: Customers can check out as a guest using either their **Full Name** or split **First / Middle (optional) / Last Name** plus phone number and email.
- **Custom Cake Notes**: Each cake line in the shopping bag supports an optional custom inscription or bakery note.
- **Fulfillment & Searchable Town Dropdown**: Supports **Delivery** (with a searchable dropdown of supported towns + landmark/address input) or **Store Pickup**.
- **Server-Verified Paystack Checkout (GHS)**: Orders are confirmed only after Paystack payment verification (`POST /api/orders/<order_reference>/confirm-payment/`).
- **Downloadable Receipt**: Every confirmed paid order generates a downloadable, printable HTML receipt (`GET /api/orders/<order_reference>/receipt/?download=1`).

### 3. Business-Help Chatbot
- Answers customer questions about cake prices (GHS), availability, opening hours, delivery towns, and how to use the website checkout.
- Keeps order placement, payment, and receipts strictly inside the website checkout flow (does not collect orders inside chat).
- Provides direct **Phone** and **WhatsApp** fallback links for bespoke requests or complex issues.

### 4. SaaS Business Management Console (`/manage-site`)
A dedicated side-navigation management console for the bakery owner at `/manage-site`:
- **Cakes & Menu**: Add, edit, and remove cakes; update GHS prices, categories (including custom categories), sizes, badges, and toggle **Available / Sold Out** in one click.
- **Incoming Orders**: Inspect customer orders, cake inscriptions, delivery towns/addresses, and Paystack references, download receipts, and update order status (`Pending Payment`, `Paid & Confirmed`, `Baking in Progress`, `Ready for Pickup`, `Out for Delivery`, `Completed`, `Cancelled`).
- **Ordering & Delivery Control**: Open or close online ordering for the entire business, customize the closed-ordering banner message, toggle delivery/pickup, and edit the flat delivery fee and supported towns.
- **Hours, Location & Contact**: Update the bakery name, tagline, opening hours, physical address, phone number, and WhatsApp number.

---

## Project Structure

```text
bakery-demo/
├── backend/                  # Django 6 + Django REST Framework API
│   ├── backend/              # Project settings & root URL configuration
│   ├── bakery/               # Core app: models, views, Paystack verifier, seed data, tests
│   ├── .env                  # Local Paystack test keys (git-ignored)
│   └── manage.py
├── frontend/                 # React 19 + Vite 8 storefront & management UI
│   ├── public/hero-frames/   # 158 sharpened scroll sequence frames
│   ├── src/
│   │   ├── components/       # HeroSection, CakeCatalog, CartDrawer, CheckoutDialog, ManageSitePage, HelpWidget
│   │   ├── App.jsx
│   │   └── StorefrontPage.jsx
│   └── vite.config.js        # Dev server proxy (/api, /admin, /static -> 127.0.0.1:8000)
├── plan.md                   # Product & functional requirements
└── README.md
```

---

## Getting Started

### Prerequisites
- **Python** 3.12+
- **Node.js** 20+ and **npm**

### 1. Backend Setup (Django API)

From the project root:

```powershell
# Create and activate virtual environment (if not already created)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install backend dependencies
pip install django djangorestframework

# Run database migrations
python backend/manage.py migrate

# Start the Django development server on http://127.0.0.1:8000
python backend/manage.py runserver
```

*Note: On first request to `/api/bootstrap/` (or login to `/api/manage/login/`), the backend automatically seeds the initial cakes, bakery settings, delivery towns, and management credentials.*

### 2. Frontend Setup (React + Vite)

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser. Vite proxies `/api`, `/admin`, and `/static` requests to `http://127.0.0.1:8000`.

---

## Environment Variables (`backend/.env`)

Create `backend/.env` to configure Paystack credentials:

```env
PAYSTACK_PUBLIC_KEY=pk_test_your_public_key_here
PAYSTACK_SECRET_KEY=sk_test_your_secret_key_here
```

---

## Management & Admin Access

### Website Business Management Console (For Bakery Owners)
- **URL**: `http://localhost:5173/manage-site`
- **Seeded Password**: `bakery2026`

### Django Admin Panel (For Developers)
- **URL**: `http://127.0.0.1:8000/admin/` (or `http://localhost:5173/admin/`)
- **Username**: `admin`
- **Password**: `bakery2026`

---

## API Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/bootstrap/` | Returns bakery settings, cakes, categories, and promos |
| `POST` | `/api/manage/login/` | Authenticates management password and returns a signed Bearer token |
| `GET, PATCH` | `/api/settings/` | Reads or updates bakery settings, hours, ordering status, and towns |
| `GET, POST` | `/api/cakes/` | Lists cakes or creates a new cake (staff/token required for `POST`) |
| `PATCH, DELETE` | `/api/cakes/<id>/` | Updates cake details/availability or removes a cake |
| `POST` | `/api/orders/initiate/` | Validates cart & customer details and creates a pending order for Paystack |
| `POST` | `/api/orders/<ref>/confirm-payment/` | Verifies transaction with Paystack and marks the order paid |
| `GET` | `/api/orders/<ref>/receipt/?download=1` | Downloads the HTML receipt for a confirmed paid order |
| `GET` | `/api/orders/` | Lists incoming website orders (staff/token required) |
| `PATCH` | `/api/orders/<ref>/status/` | Updates an order's fulfillment status (staff/token required) |
| `POST` | `/api/chatbot/` | Business-help assistant with Phone & WhatsApp fallback |

---

## Production Deployment Guide

This application is ready for production across three complementary services:
1. **Neon** — Serverless Lakebase PostgreSQL database with connection pooling and automated branching.
2. **Render** — Django REST Framework backend running on Gunicorn with WhiteNoise static assets and production security hardening.
3. **Vercel** — React + Vite frontend with global CDN edge routing and client-side SPA rewrites.

### 1. Neon Database Setup

1. In the [Neon Console](https://console.neon.tech/), select your project (e.g. `restless-bread-27904885`) and branch (`production`).
2. Copy your **Pooled Connection String** (it ends with `-pooler...` and `?sslmode=require`).
   ```text
   postgresql://neondb_owner:<password>@ep-mute-paper-b9noacqm-pooler.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
3. Database migrations and initial seed data run automatically during Render's build via `backend/build.sh`.

### 2. Render Backend Deployment

1. Create a **New Web Service** on [Render](https://dashboard.render.com/) and connect your GitHub repository:
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `./build.sh`
   - **Start Command**: `gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT`
   *(Or click "Deploy from Blueprint" using the included [`render.yaml`](render.yaml))*
2. Configure **Environment Variables** in Render:
   - `DEBUG`: `False`
   - `SECRET_KEY`: `<generate-a-strong-random-50-character-secret>`
   - `DATABASE_URL`: `postgresql://neondb_owner:<password>@...-pooler...neon.tech/neondb?sslmode=require`
   - `ALLOWED_HOSTS`: `.onrender.com,localhost,127.0.0.1`
   - `CSRF_TRUSTED_ORIGINS`: `https://*.onrender.com,https://*.vercel.app`
   - `PAYSTACK_PUBLIC_KEY`: `pk_test_...`
   - `PAYSTACK_SECRET_KEY`: `sk_test_...`
3. Deploy the service. Your backend API will be available at `https://<your-render-service>.onrender.com`.

### 3. Vercel Frontend Deployment

1. Import your GitHub repository into [Vercel](https://vercel.com/new).
2. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add the **Environment Variable**:
   - `VITE_API_BASE_URL`: `https://<your-render-service>.onrender.com`
4. Deploy. Vercel automatically deploys the frontend with client-side SPA routing backed by [`frontend/vercel.json`](frontend/vercel.json).

---

## Security Hardening & Deploy Checks

Django's built-in deployment security verification has been passed with zero issues:
- `DEBUG = False` enforced in production.
- `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')` configured for Render's reverse proxy.
- `SECURE_SSL_REDIRECT = True` redirects all insecure HTTP traffic to HTTPS.
- `SESSION_COOKIE_SECURE = True` and `CSRF_COOKIE_SECURE = True` prevent transmission over unencrypted connections.
- `SECURE_HSTS_SECONDS = 31536000` enforces HTTP Strict Transport Security for 1 year.
- `X_FRAME_OPTIONS = 'DENY'` and `SECURE_CONTENT_TYPE_NOSNIFF = True` prevent clickjacking and MIME-type sniffing.
- `WhiteNoise` serves and compresses production static files with cache-busting hashes.

Run the production security audit locally:
```powershell
python scratch/test_deploy_check.py
# Or:
# $env:DEBUG="False"; python backend/manage.py check --deploy
```

---

## Testing & Production Build

### Run Backend Tests
```powershell
cd backend
..\.venv\Scripts\python.exe manage.py test bakery
```

### Run Frontend Lint & Production Build
```powershell
cd frontend
npm run lint
npm run build
```
