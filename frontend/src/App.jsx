import { useCallback, useEffect, useMemo, useState } from 'react'
import CartDrawer from './components/CartDrawer'
import CheckoutDialog from './components/CheckoutDialog'
import StorefrontPage from './StorefrontPage'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

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
  }

  function updateCartItem(cakeId, updates) {
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

  return (
    <>
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
