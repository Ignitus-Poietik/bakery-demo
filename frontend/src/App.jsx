import { useCallback, useEffect, useMemo, useState } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import CartDrawer from './components/CartDrawer'
import CheckoutDialog from './components/CheckoutDialog'
import ManageSitePage from './components/ManageSitePage'
import StorefrontPage from './StorefrontPage'
import './App.css'

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  ''
).replace(/\/+$/, '')

async function fetchStoreData() {
  const response = await fetch(`${API_BASE}/api/bootstrap/`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'The bakery menu is temporarily unavailable.')
  return data
}

export default function App() {
  const [settings, setSettings] = useState(null)
  const [cakes, setCakes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [category, setCategory] = useState('All cakes')
  const [search, setSearch] = useState('')
  const [quantities, setQuantities] = useState({})
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  const loadStore = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await fetchStoreData()
      setSettings(data.settings)
      setCakes(data.cakes || [])
    } catch (error) {
      setLoadError(error.message || 'Could not connect to the bakery.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    fetchStoreData()
      .then((data) => {
        if (!active) return
        setSettings(data.settings)
        setCakes(data.cakes || [])
      })
      .catch((error) => {
        if (active) setLoadError(error.message || 'Could not connect to the bakery.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  // Keep customer site synchronized whenever admin updates settings/cakes in /manage-site
  useEffect(() => {
    function refreshStoreQuietly() {
      fetchStoreData()
        .then((data) => {
          setSettings(data.settings)
          setCakes(data.cakes || [])
        })
        .catch(() => {})
    }

    function onVisibilityOrFocus() {
      if (document.visibilityState === 'visible') {
        refreshStoreQuietly()
      }
    }

    function onStorageChange(event) {
      if (event.key === 'bakery_store_updated_at') {
        refreshStoreQuietly()
      }
    }

    window.addEventListener('focus', onVisibilityOrFocus)
    document.addEventListener('visibilitychange', onVisibilityOrFocus)
    window.addEventListener('storage', onStorageChange)

    let channel = null
    if (typeof window.BroadcastChannel === 'function') {
      channel = new window.BroadcastChannel('bakery_store_sync')
      channel.onmessage = () => refreshStoreQuietly()
    }

    return () => {
      window.removeEventListener('focus', onVisibilityOrFocus)
      document.removeEventListener('visibilitychange', onVisibilityOrFocus)
      window.removeEventListener('storage', onStorageChange)
      if (channel) channel.close()
    }
  }, [])

  useEffect(() => {
    if (settings?.bakery_name) {
      document.title = settings.tagline
        ? `${settings.bakery_name} — ${settings.tagline}`
        : settings.bakery_name
    }
  }, [settings?.bakery_name, settings?.tagline])

  const cartItems = useMemo(() => cart.map((item) => {
    const cake = cakes.find((entry) => entry.id === item.cake_id)
    return {
      ...item,
      cake,
      name: cake?.name || item.name,
      price: Number(cake?.price_ghs ?? item.price_ghs),
    }
  }), [cart, cakes])
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0)
  const subtotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0)
  const orderingOpen = Boolean(settings?.is_ordering_open)
  const deliveryFee = Number(settings?.delivery_fee_ghs || 0)
  const deliveryEnabled = settings?.delivery_enabled !== false
  const initialFulfillment = deliveryEnabled ? 'delivery' : 'pickup'

  function addCake(cake) {
    if (!orderingOpen || !cake.is_available) return
    const quantity = Number(quantities[cake.id] || 1)
    setCart((current) => {
      const existing = current.find((item) => item.cake_id === cake.id)
      if (existing) {
        return current.map((item) => item.cake_id === cake.id
          ? { ...item, quantity: item.quantity + quantity }
          : item)
      }
      return [...current, {
        cake_id: cake.id,
        name: cake.name,
        price_ghs: Number(cake.price_ghs),
        quantity,
        item_note: '',
      }]
    })
    setQuantities((current) => ({ ...current, [cake.id]: 1 }))
    setCartOpen(true)
    toast.success(`Added ${quantity}× ${cake.name} to your bag`)
  }

  function updateCartItem(cakeId, updates) {
    if (updates.quantity === 0) {
      const target = cart.find((item) => item.cake_id === cakeId)
      if (target) toast(`Removed ${target.name} from your bag`)
    }
    setCart((current) => current
      .map((item) => item.cake_id === cakeId ? { ...item, ...updates } : item)
      .filter((item) => item.quantity > 0))
  }

  function continueToCheckout() {
    setCartOpen(false)
    setCheckoutOpen(true)
  }

  function handleOrderSuccess() {
    setCart([])
  }

  const toasterElement = (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3600,
        style: {
          background: '#23150f',
          color: '#fbf7f0',
          borderRadius: '10px',
          padding: '12px 16px',
          fontSize: '13.5px',
          fontWeight: 500,
          boxShadow: '0 12px 32px rgba(35, 21, 15, 0.22)',
        },
        success: {
          iconTheme: {
            primary: '#b87a38',
            secondary: '#fbf7f0',
          },
        },
      }}
    />
  )

  const pathname = typeof window !== 'undefined' ? window.location.pathname.replace(/\/+$/, '') : ''
  if (pathname === '/manage-site') {
    return (
      <>
        {toasterElement}
        <ManageSitePage apiBase={API_BASE} onStoreUpdated={loadStore} />
      </>
    )
  }

  return (
    <>
      {toasterElement}
      <StorefrontPage
        settings={settings}
        orderingOpen={orderingOpen}
        itemCount={itemCount}
        cakes={cakes}
        loading={loading}
        error={loadError}
        category={category}
        search={search}
        quantities={quantities}
        onOpenBag={() => setCartOpen(true)}
        onCategoryChange={setCategory}
        onSearchChange={setSearch}
        onQuantityChange={(cakeId, quantity) => setQuantities((current) => ({
          ...current,
          [cakeId]: quantity,
        }))}
        onAddCake={addCake}
        onRetry={loadStore}
        apiBase={API_BASE}
      />
      <CartDrawer
        open={cartOpen}
        cartItems={cartItems}
        itemCount={itemCount}
        subtotal={subtotal}
        deliveryFee={deliveryFee}
        fulfillment={initialFulfillment}
        orderingOpen={orderingOpen}
        onClose={() => setCartOpen(false)}
        onUpdateItem={updateCartItem}
        onContinue={continueToCheckout}
      />
      {checkoutOpen && (
        <CheckoutDialog
          settings={settings}
          cartItems={cartItems}
          itemCount={itemCount}
          subtotal={subtotal}
          deliveryFee={deliveryFee}
          apiBase={API_BASE}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={handleOrderSuccess}
        />
      )}
    </>
  )
}
