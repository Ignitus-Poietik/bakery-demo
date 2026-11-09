import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { resolveMediaUrl } from '../utils/media'
import './ManageSitePage.css'

const TOKEN_STORAGE_KEY = 'big_bakery_manage_token'

const ORDER_STATUS_OPTIONS = [
  'Pending Payment',
  'Paid & Confirmed',
  'Baking in Progress',
  'Ready for Pickup',
  'Out for Delivery',
  'Completed',
  'Cancelled',
]

const DEFAULT_CATEGORIES = [
  'Birthday Cakes',
  'Wedding & Custom',
  'Cupcakes & Boxes',
  'Cheesecakes',
  'Pastries & Slices',
]

const EMPTY_CAKE_FORM = {
  id: null,
  name: '',
  category: 'Birthday Cakes',
  customCategory: '',
  price_ghs: '',
  weight_or_size: '8-inch Tall (12–14 slices)',
  badge: '',
  image_url: '',
  image_mode: 'upload', // 'upload' | 'url'
  description: '',
  is_available: true,
}

const formatMoney = (value) =>
  new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
  }).format(Number(value || 0))

const formatDate = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

async function requestWithToken(apiBase, path, options = {}, activeToken = '') {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  }
  if (activeToken) {
    headers.Authorization = `Bearer ${activeToken}`
  }
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
  })
  const data = await response.json().catch(() => ({}))
  if (response.status === 401 || response.status === 403) {
    const authErr = new Error(data.error || 'Your management session has expired. Please sign in again.')
    authErr.isAuthError = true
    throw authErr
  }
  if (!response.ok) {
    throw new Error(data.error || 'Request could not be completed.')
  }
  return data
}

function notifyStoreChange(onStoreUpdated) {
  const ts = String(Date.now())
  try {
    window.localStorage.setItem('bakery_store_updated_at', ts)
  } catch {
    void 0
  }
  try {
    if (typeof window.BroadcastChannel === 'function') {
      const channel = new window.BroadcastChannel('bakery_store_sync')
      channel.postMessage({ timestamp: ts })
      channel.close()
    }
  } catch {
    void 0
  }
  if (typeof onStoreUpdated === 'function') {
    onStoreUpdated()
  }
}

export default function ManageSitePage({ apiBase = '', onStoreUpdated }) {
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_STORAGE_KEY) || '')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [activeTab, setActiveTab] = useState('cakes')
  const [loading, setLoading] = useState(() => Boolean(window.localStorage.getItem(TOKEN_STORAGE_KEY)))

  const [settings, setSettings] = useState(null)
  const [cakes, setCakes] = useState([])
  const [orders, setOrders] = useState([])

  // Cake Management State
  const [cakeSearch, setCakeSearch] = useState('')
  const [cakeCategoryFilter, setCakeCategoryFilter] = useState('All')
  const [cakeForm, setCakeForm] = useState(EMPTY_CAKE_FORM)
  const [cakeFormOpen, setCakeFormOpen] = useState(false)
  const [cakeSaving, setCakeSaving] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)

  // Orders Management State
  const [orderSearch, setOrderSearch] = useState('')
  const [orderStatusFilter, setOrderStatusFilter] = useState('All')
  const [updatingOrderRef, setUpdatingOrderRef] = useState('')

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState(null)
  const [settingsSaving, setSettingsSaving] = useState(false)

  // Delivery places state inside settings tab
  const [newPlaceName, setNewPlaceName] = useState('')
  const [newPlaceFee, setNewPlaceFee] = useState('')
  const [placeSearch, setPlaceSearch] = useState('')

  const placesToDisplay = useMemo(() => {
    const list = settingsForm?.delivery_places || []
    if (!placeSearch.trim()) return list
    const q = placeSearch.trim().toLowerCase()
    return list.filter((p) => p.name.toLowerCase().includes(q))
  }, [settingsForm?.delivery_places, placeSearch])

  const broadcastStoreChange = useCallback(() => {
    notifyStoreChange(onStoreUpdated)
  }, [onStoreUpdated])

  function notify(message, type = 'success') {
    if (type === 'error') {
      toast.error(message)
    } else {
      toast.success(message)
    }
  }

  const authFetch = useCallback(
    async (path, options = {}, overrideToken) => {
      try {
        return await requestWithToken(apiBase, path, options, overrideToken ?? token)
      } catch (err) {
        if (err.isAuthError) {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY)
          setToken('')
        }
        throw err
      }
    },
    [apiBase, token],
  )

  const applyDashboardPayload = useCallback((bootData, ordersData) => {
    setSettings(bootData.settings)
    setCakes(bootData.cakes || [])
    setOrders(ordersData.orders || [])

    const defaultFee = Number(bootData.settings.delivery_fee_ghs ?? 25.0)
    let placesList = []
    if (Array.isArray(bootData.settings.delivery_places) && bootData.settings.delivery_places.length > 0) {
      placesList = bootData.settings.delivery_places.map((p) => ({
        name: p.name,
        fee_ghs: Number(p.fee_ghs ?? defaultFee),
      }))
    } else if (Array.isArray(bootData.settings.delivery_towns)) {
      const townFees = bootData.settings.delivery_town_fees || {}
      placesList = bootData.settings.delivery_towns.map((town) => ({
        name: town,
        fee_ghs: townFees[town] !== undefined ? Number(townFees[town]) : defaultFee,
      }))
    }

    setSettingsForm({
      bakery_name: bootData.settings.bakery_name || '',
      tagline: bootData.settings.tagline || '',
      is_ordering_open: Boolean(bootData.settings.is_ordering_open),
      closed_reason: bootData.settings.closed_reason || '',
      opening_hours: bootData.settings.opening_hours || '',
      location_address: bootData.settings.location_address || '',
      phone_number: bootData.settings.phone_number || '',
      whatsapp_number: bootData.settings.whatsapp_number || '',
      delivery_enabled: Boolean(bootData.settings.delivery_enabled),
      pickup_enabled: Boolean(bootData.settings.pickup_enabled),
      delivery_fee_ghs: String(bootData.settings.delivery_fee_ghs ?? '25.00'),
      delivery_places: placesList,
    })
  }, [])

  const loadDashboardData = useCallback(
    async (activeToken) => {
      setLoading(true)
      try {
        const [bootData, ordersData] = await Promise.all([
          authFetch('/api/bootstrap/', { method: 'GET' }, activeToken),
          authFetch('/api/orders/', { method: 'GET' }, activeToken),
        ])
        applyDashboardPayload(bootData, ordersData)
      } catch (err) {
        notify(err.message || 'Could not load management data.', 'error')
      } finally {
        setLoading(false)
      }
    },
    [authFetch, applyDashboardPayload],
  )

  useEffect(() => {
    if (!token) return undefined
    let active = true
    Promise.all([
      requestWithToken(apiBase, '/api/bootstrap/', { method: 'GET' }, token),
      requestWithToken(apiBase, '/api/orders/', { method: 'GET' }, token),
    ])
      .then(([bootData, ordersData]) => {
        if (!active) return
        applyDashboardPayload(bootData, ordersData)
      })
      .catch((err) => {
        if (!active) return
        if (err.isAuthError) {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY)
          setToken('')
        }
        notify(err.message || 'Could not load management data.', 'error')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [apiBase, token, applyDashboardPayload])

  async function handleLogin(event) {
    event.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      const response = await fetch(`${apiBase}/api/manage/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: loginPassword.trim(),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Invalid password.')
      }
      window.localStorage.setItem(TOKEN_STORAGE_KEY, data.token)
      setToken(data.token)
      setLoginPassword('')
      toast.success('Signed in to management dashboard')
    } catch (err) {
      setLoginError(err.message || 'Could not sign in.')
      toast.error(err.message || 'Could not sign in.')
    } finally {
      setLoginLoading(false)
    }
  }

  function handleLogout() {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken('')
    toast('Signed out of management console')
  }

  const allCategories = useMemo(() => {
    const set = new Set(DEFAULT_CATEGORIES)
    cakes.forEach((cake) => {
      if (cake.category) set.add(cake.category)
    })
    return Array.from(set)
  }, [cakes])

  const filteredCakes = useMemo(() => {
    const q = cakeSearch.trim().toLowerCase()
    return cakes.filter((cake) => {
      const matchesCat = cakeCategoryFilter === 'All' || cake.category === cakeCategoryFilter
      const matchesQuery =
        !q ||
        cake.name.toLowerCase().includes(q) ||
        cake.category.toLowerCase().includes(q) ||
        (cake.description || '').toLowerCase().includes(q)
      return matchesCat && matchesQuery
    })
  }, [cakes, cakeSearch, cakeCategoryFilter])

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase()
    return orders.filter((order) => {
      const matchesStatus =
        orderStatusFilter === 'All' ||
        order.order_status === orderStatusFilter ||
        (orderStatusFilter === 'Paid Only' && order.payment_status === 'paid')
      const matchesQuery =
        !q ||
        order.order_reference.toLowerCase().includes(q) ||
        order.customer_full_name.toLowerCase().includes(q) ||
        order.customer_phone.toLowerCase().includes(q) ||
        (order.delivery_town || '').toLowerCase().includes(q)
      return matchesStatus && matchesQuery
    })
  }, [orders, orderSearch, orderStatusFilter])

  async function handleToggleOrderingOpen() {
    if (!settings) return
    const nextState = !settings.is_ordering_open
    try {
      const data = await authFetch('/api/settings/', {
        method: 'PATCH',
        body: JSON.stringify({ is_ordering_open: nextState }),
      })
      setSettings(data.settings)
      setSettingsForm((prev) => (prev ? { ...prev, is_ordering_open: data.settings.is_ordering_open } : prev))
      broadcastStoreChange()
      notify(
        data.settings.is_ordering_open
          ? 'Online ordering is now OPEN on customer storefront.'
          : 'Online ordering is now CLOSED on customer storefront.',
      )
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  function openNewCakeForm() {
    setCakeForm({
      ...EMPTY_CAKE_FORM,
      category: allCategories[0] || 'Birthday Cakes',
      image_mode: 'upload',
    })
    setCakeFormOpen(true)
    setActiveTab('cakes')
  }

  function openEditCakeForm(cake) {
    const hasUploadUrl = cake.image_url?.startsWith('/media/')
    setCakeForm({
      id: cake.id,
      name: cake.name || '',
      category: allCategories.includes(cake.category) ? cake.category : '__custom__',
      customCategory: allCategories.includes(cake.category) ? '' : cake.category || '',
      price_ghs: String(cake.price_ghs ?? ''),
      weight_or_size: cake.weight_or_size || '8-inch Tall (12–14 slices)',
      badge: cake.badge || '',
      image_url: cake.image_url || '',
      image_mode: hasUploadUrl ? 'upload' : cake.image_url ? 'url' : 'upload',
      description: cake.description || '',
      is_available: Boolean(cake.is_available),
    })
    setCakeFormOpen(true)
  }

  async function handleImageFileUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setImageUploading(true)
    const formData = new FormData()
    formData.append('image', file)

    const uploadToastId = toast.loading('Uploading cake photo…')
    try {
      const data = await authFetch('/api/uploads/cake-image/', {
        method: 'POST',
        body: formData,
      })
      setCakeForm((prev) => ({
        ...prev,
        image_url: data.image_url,
        image_mode: 'upload',
      }))
      toast.success('Photo uploaded successfully!', { id: uploadToastId })
    } catch (err) {
      toast.error(err.message || 'Image upload failed.', { id: uploadToastId })
    } finally {
      setImageUploading(false)
      event.target.value = ''
    }
  }

  async function handleSaveCake(event) {
    event.preventDefault()
    setCakeSaving(true)
    const resolvedCategory =
      cakeForm.category === '__custom__' ? cakeForm.customCategory.trim() : cakeForm.category.trim()

    const payload = {
      name: cakeForm.name.trim(),
      category: resolvedCategory || 'Birthday Cakes',
      price_ghs: Number(cakeForm.price_ghs),
      weight_or_size: cakeForm.weight_or_size.trim(),
      badge: cakeForm.badge.trim(),
      image_url: cakeForm.image_url.trim(),
      description: cakeForm.description.trim(),
      is_available: Boolean(cakeForm.is_available),
    }

    try {
      if (cakeForm.id) {
        const data = await authFetch(`/api/cakes/${cakeForm.id}/`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        setCakes((prev) => prev.map((c) => (c.id === cakeForm.id ? data.cake : c)))
        notify(`Updated "${data.cake.name}" on the menu.`)
      } else {
        const data = await authFetch('/api/cakes/', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setCakes((prev) => [data.cake, ...prev])
        notify(`Added "${data.cake.name}" to the menu.`)
      }
      setCakeFormOpen(false)
      setCakeForm(EMPTY_CAKE_FORM)
      broadcastStoreChange()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setCakeSaving(false)
    }
  }

  async function handleToggleCakeAvailability(cake) {
    try {
      const data = await authFetch(`/api/cakes/${cake.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ is_available: !cake.is_available }),
      })
      setCakes((prev) => prev.map((c) => (c.id === cake.id ? data.cake : c)))
      broadcastStoreChange()
      notify(
        data.cake.is_available
          ? `"${data.cake.name}" is now marked Available.`
          : `"${data.cake.name}" is now marked Sold Out.`,
      )
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  async function handleDeleteCake(cake) {
    if (!window.confirm(`Remove "${cake.name}" from the menu?`)) return
    try {
      await authFetch(`/api/cakes/${cake.id}/`, { method: 'DELETE' })
      setCakes((prev) => prev.filter((c) => c.id !== cake.id))
      broadcastStoreChange()
      notify(`Removed "${cake.name}" from the menu.`)
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  async function handleUpdateOrderStatus(orderReference, newStatus) {
    setUpdatingOrderRef(orderReference)
    try {
      const data = await authFetch(`/api/orders/${orderReference}/status/`, {
        method: 'PATCH',
        body: JSON.stringify({ order_status: newStatus }),
      })
      setOrders((prev) =>
        prev.map((o) => (o.order_reference === orderReference ? data.order : o)),
      )
      notify(`Order ${orderReference} status updated to "${newStatus}".`)
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setUpdatingOrderRef('')
    }
  }

  // Delivery Places Management helpers
  function handleAddDeliveryPlace(event) {
    event.preventDefault()
    const name = newPlaceName.trim()
    if (!name) return

    const fee = Number(newPlaceFee || settingsForm?.delivery_fee_ghs || 25.0)
    if (fee < 0) {
      toast.error('Delivery price must be 0 or greater.')
      return
    }

    setSettingsForm((prev) => {
      const currentPlaces = prev?.delivery_places || []
      const exists = currentPlaces.some((p) => p.name.toLowerCase() === name.toLowerCase())
      if (exists) {
        toast.error(`"${name}" is already in your delivery places list.`)
        return prev
      }
      return {
        ...prev,
        delivery_places: [{ name, fee_ghs: fee }, ...currentPlaces],
      }
    })

    toast.success(`Added "${name}" with delivery fee GHS ${fee.toFixed(2)}`)
    setNewPlaceName('')
    setNewPlaceFee('')
  }

  function handleUpdatePlaceFee(placeName, newFee) {
    const val = Number(newFee)
    setSettingsForm((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        delivery_places: prev.delivery_places.map((p) =>
          p.name === placeName ? { ...p, fee_ghs: isNaN(val) ? p.fee_ghs : val } : p,
        ),
      }
    })
  }

  function handleRemovePlace(placeName) {
    setSettingsForm((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        delivery_places: prev.delivery_places.filter((p) => p.name !== placeName),
      }
    })
    toast(`Removed "${placeName}" from delivery places. Click Save to apply.`)
  }

  async function handleSaveSettings(event) {
    event.preventDefault()
    if (!settingsForm) return
    setSettingsSaving(true)

    const payload = {
      bakery_name: settingsForm.bakery_name.trim(),
      tagline: settingsForm.tagline.trim(),
      is_ordering_open: Boolean(settingsForm.is_ordering_open),
      closed_reason: settingsForm.closed_reason.trim(),
      opening_hours: settingsForm.opening_hours.trim(),
      location_address: settingsForm.location_address.trim(),
      phone_number: settingsForm.phone_number.trim(),
      whatsapp_number: settingsForm.whatsapp_number.trim(),
      delivery_enabled: Boolean(settingsForm.delivery_enabled),
      pickup_enabled: Boolean(settingsForm.pickup_enabled),
      delivery_fee_ghs: Number(settingsForm.delivery_fee_ghs || 25.0),
      delivery_places: (settingsForm.delivery_places || []).map((p) => ({
        name: p.name.trim(),
        fee_ghs: Number(p.fee_ghs || settingsForm.delivery_fee_ghs || 25.0),
      })),
    }

    try {
      const data = await authFetch('/api/settings/', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setSettings(data.settings)
      broadcastStoreChange()
      notify('Business settings and delivery pricing updated on the storefront!')
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setSettingsSaving(false)
    }
  }

  // 1. Login View if not authenticated
  if (!token) {
    return (
      <main className="manage-login-screen">
        <div className="manage-login-card">
          <div className="manage-login-header">
            <a href="/" className="manage-back-link">← Back to Storefront</a>
            <h1>Business Management</h1>
            <p>Sign in to manage your cake menu, prices, store availability, delivery places, and customer orders.</p>
          </div>

          <form onSubmit={handleLogin} className="manage-login-form">
            <label className="manage-field">
              <span>Management Password</span>
              <input
                type="password"
                required
                autoFocus
                placeholder="Enter management password…"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </label>

            {loginError && <p className="manage-error" role="alert">{loginError}</p>}

            <button type="submit" className="button button-primary button-wide" disabled={loginLoading}>
              {loginLoading ? 'Signing in…' : 'Open Management Dashboard'}
            </button>
          </form>
        </div>
      </main>
    )
  }

  const availableCakesCount = cakes.filter((c) => c.is_available).length
  const soldOutCakesCount = cakes.length - availableCakesCount
  const paidOrders = orders.filter((o) => o.payment_status === 'paid')
  const paidRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total_ghs || 0), 0)

  const headerMeta = {
    cakes: {
      title: 'Cakes & Menu',
      subtitle: 'Add, edit, or remove cakes and manage GHS prices, photos, categories, and availability.',
    },
    orders: {
      title: 'Incoming Orders',
      subtitle: 'Review customer orders, cake inscriptions, delivery addresses, and update fulfillment statuses.',
    },
    ordering: {
      title: 'Delivery Places & Custom Prices',
      subtitle: 'Set delivery fees for each town or area you deliver to, and toggle store-wide ordering.',
    },
    profile: {
      title: 'Business Hours, Location & Contact',
      subtitle: 'Update your bakery hours, physical address, and customer contact numbers.',
    },
  }[activeTab]

  // 2. Authenticated SaaS Side-Navigation Layout
  return (
    <div className="manage-layout">
      {/* Left SaaS Sidebar Navigation */}
      <aside className="manage-sidebar" aria-label="Business navigation">
        <div className="manage-sidebar-top">
          <div className="manage-sidebar-brand">
            <strong>{settings?.bakery_name || 'Big Bakery'}</strong>
            <span>Management Console</span>
          </div>

          {settings && (
            <div className="manage-sidebar-status-box">
              <div className="manage-status-row">
                <span className="manage-status-label">Online Ordering</span>
                <span className={`store-pill ${settings.is_ordering_open ? 'open' : 'closed'}`}>
                  {settings.is_ordering_open ? 'Open' : 'Closed'}
                </span>
              </div>
              <button
                type="button"
                className="manage-sidebar-toggle-btn"
                onClick={handleToggleOrderingOpen}
              >
                {settings.is_ordering_open ? 'Close Store Ordering' : 'Reopen Store Ordering'}
              </button>
            </div>
          )}

          <div className="manage-nav-group">
            <span className="manage-nav-heading">Operations</span>
            <nav className="manage-sidenav">
              <button
                type="button"
                className={`manage-sidenav-item ${activeTab === 'cakes' ? 'active' : ''}`}
                onClick={() => setActiveTab('cakes')}
              >
                <span className="manage-sidenav-text">Cakes & Menu</span>
                <span className="manage-sidenav-count">{cakes.length}</span>
              </button>

              <button
                type="button"
                className={`manage-sidenav-item ${activeTab === 'orders' ? 'active' : ''}`}
                onClick={() => setActiveTab('orders')}
              >
                <span className="manage-sidenav-text">Incoming Orders</span>
                <span className="manage-sidenav-count">{orders.length}</span>
              </button>
            </nav>
          </div>

          <div className="manage-nav-group">
            <span className="manage-nav-heading">Configuration</span>
            <nav className="manage-sidenav">
              <button
                type="button"
                className={`manage-sidenav-item ${activeTab === 'ordering' ? 'active' : ''}`}
                onClick={() => setActiveTab('ordering')}
              >
                <span className="manage-sidenav-text">Delivery Places & Fees</span>
                <span className="manage-sidenav-count">
                  {settingsForm?.delivery_places?.length ?? settings?.delivery_towns?.length ?? 0}
                </span>
              </button>

              <button
                type="button"
                className={`manage-sidenav-item ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <span className="manage-sidenav-text">Hours, Location & Contact</span>
              </button>
            </nav>
          </div>
        </div>

        <div className="manage-sidebar-footer">
          <a href="/" className="manage-sidebar-link">
            ← View Live Storefront
          </a>
          <button type="button" className="manage-sidebar-logout" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Right Workspace Area */}
      <div className="manage-workspace">
        <header className="manage-workspace-header">
          <div>
            <h1>{headerMeta?.title}</h1>
            <p>{headerMeta?.subtitle}</p>
          </div>
          <div className="manage-header-actions">
            {activeTab === 'cakes' && (
              <button type="button" className="button button-primary" onClick={openNewCakeForm}>
                + Add New Cake
              </button>
            )}
            {activeTab === 'orders' && (
              <button
                type="button"
                className="manage-btn-outline"
                onClick={() => loadDashboardData(token)}
              >
                Refresh Orders
              </button>
            )}
          </div>
        </header>

        <main className="manage-content">
          {/* KPI Strip */}
          <section className="manage-stats" aria-label="Bakery metrics">
            <div className="manage-stat-card">
              <span className="manage-stat-label">Menu Catalog</span>
              <strong>{cakes.length} Cakes</strong>
              <small>{availableCakesCount} available · {soldOutCakesCount} sold out</small>
            </div>
            <div className="manage-stat-card">
              <span className="manage-stat-label">Total Orders</span>
              <strong>{orders.length} Orders</strong>
              <small>{paidOrders.length} paid · {orders.length - paidOrders.length} pending</small>
            </div>
            <div className="manage-stat-card">
              <span className="manage-stat-label">Confirmed Revenue</span>
              <strong>{formatMoney(paidRevenue)}</strong>
              <small>Verified via Paystack</small>
            </div>
            <div className="manage-stat-card">
              <span className="manage-stat-label">Delivery Towns</span>
              <strong>{settingsForm?.delivery_places?.length ?? 0} Places</strong>
              <small>Custom prices configured</small>
            </div>
          </section>

          {loading && <p className="manage-loading">Loading bakery data…</p>}

          {/* SECTION 1: CAKES & MENU */}
          {!loading && activeTab === 'cakes' && (
            <section className="manage-panel">
              {cakeFormOpen && (
                <form className="manage-cake-editor" onSubmit={handleSaveCake}>
                  <div className="manage-editor-top">
                    <h3>{cakeForm.id ? 'Edit Cake' : 'Add a New Cake'}</h3>
                    <button
                      type="button"
                      className="manage-btn-text"
                      onClick={() => setCakeFormOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="manage-form-grid">
                    <label className="manage-field">
                      <span>Cake Name *</span>
                      <input
                        type="text"
                        required
                        value={cakeForm.name}
                        placeholder="e.g. Ghanaian Dark Cocoa Gateau"
                        onChange={(e) => setCakeForm({ ...cakeForm, name: e.target.value })}
                      />
                    </label>

                    <label className="manage-field">
                      <span>Category *</span>
                      <select
                        value={cakeForm.category}
                        onChange={(e) => setCakeForm({ ...cakeForm, category: e.target.value })}
                      >
                        {allCategories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="__custom__">+ New Custom Category…</option>
                      </select>
                    </label>

                    {cakeForm.category === '__custom__' && (
                      <label className="manage-field">
                        <span>New Category Name *</span>
                        <input
                          type="text"
                          required
                          value={cakeForm.customCategory}
                          placeholder="e.g. Seasonal Specials"
                          onChange={(e) => setCakeForm({ ...cakeForm, customCategory: e.target.value })}
                        />
                      </label>
                    )}

                    <label className="manage-field">
                      <span>Price (GHS) *</span>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        required
                        value={cakeForm.price_ghs}
                        placeholder="450.00"
                        onChange={(e) => setCakeForm({ ...cakeForm, price_ghs: e.target.value })}
                      />
                    </label>

                    <label className="manage-field">
                      <span>Size / Servings</span>
                      <input
                        type="text"
                        value={cakeForm.weight_or_size}
                        placeholder="8-inch Tall (12–14 slices)"
                        onChange={(e) => setCakeForm({ ...cakeForm, weight_or_size: e.target.value })}
                      />
                    </label>

                    <label className="manage-field">
                      <span>Highlight Badge (optional)</span>
                      <input
                        type="text"
                        value={cakeForm.badge}
                        placeholder="e.g. Bestseller, Signature, Fresh Daily"
                        onChange={(e) => setCakeForm({ ...cakeForm, badge: e.target.value })}
                      />
                    </label>
                  </div>

                  {/* Photo Upload or URL Choice */}
                  <div className="manage-photo-section">
                    <div className="manage-photo-header">
                      <span className="manage-field-label">Cake Photo *</span>
                      <div className="manage-photo-mode-toggle">
                        <button
                          type="button"
                          className={cakeForm.image_mode === 'upload' ? 'active' : ''}
                          onClick={() => setCakeForm((prev) => ({ ...prev, image_mode: 'upload' }))}
                        >
                          Upload File
                        </button>
                        <button
                          type="button"
                          className={cakeForm.image_mode === 'url' ? 'active' : ''}
                          onClick={() => setCakeForm((prev) => ({ ...prev, image_mode: 'url' }))}
                        >
                          Use Image URL
                        </button>
                      </div>
                    </div>

                    <div className="manage-photo-input-area">
                      {cakeForm.image_mode === 'upload' ? (
                        <div className="manage-upload-dropzone">
                          <label className="manage-file-label">
                            <input
                              type="file"
                              accept="image/png, image/jpeg, image/webp, image/avif, image/gif, image/svg+xml"
                              disabled={imageUploading}
                              onChange={handleImageFileUpload}
                            />
                            <div className="manage-dropzone-inner">
                              <span className="manage-dropzone-icon">📷</span>
                              <strong>{imageUploading ? 'Uploading photo…' : 'Click to select or drop a photo'}</strong>
                              <small>Supports PNG, JPG, WebP, AVIF up to 12 MB</small>
                            </div>
                          </label>
                          {cakeForm.image_url && (
                            <p className="manage-current-path">Current uploaded file: <code>{cakeForm.image_url}</code></p>
                          )}
                        </div>
                      ) : (
                        <label className="manage-field">
                          <span>Image URL</span>
                          <input
                            type="url"
                            value={cakeForm.image_url}
                            placeholder="https://images.unsplash.com/photo-..."
                            onChange={(e) => setCakeForm({ ...cakeForm, image_url: e.target.value })}
                          />
                        </label>
                      )}

                      {/* Photo Preview */}
                      {cakeForm.image_url && (
                        <div className="manage-photo-preview-wrap">
                          <div className="manage-photo-preview-card">
                            <img src={resolveMediaUrl(cakeForm.image_url, apiBase)} alt="Cake preview" />
                            <button
                              type="button"
                              className="manage-photo-clear-btn"
                              title="Remove photo"
                              onClick={() => setCakeForm((prev) => ({ ...prev, image_url: '' }))}
                            >
                              ✕
                            </button>
                          </div>
                          <span className="manage-preview-label">Live Preview</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <label className="manage-field">
                    <span>Description</span>
                    <textarea
                      rows={3}
                      value={cakeForm.description}
                      placeholder="Describe sponge layers, fillings, and frostings…"
                      onChange={(e) => setCakeForm({ ...cakeForm, description: e.target.value })}
                    />
                  </label>

                  <label className="manage-checkbox">
                    <input
                      type="checkbox"
                      checked={cakeForm.is_available}
                      onChange={(e) => setCakeForm({ ...cakeForm, is_available: e.target.checked })}
                    />
                    <span>Available for customer ordering (uncheck to mark Sold Out)</span>
                  </label>

                  <div className="manage-editor-actions">
                    <button type="submit" className="button button-primary" disabled={cakeSaving || imageUploading}>
                      {cakeSaving ? 'Saving…' : cakeForm.id ? 'Save Cake Changes' : 'Create Cake'}
                    </button>
                    <button
                      type="button"
                      className="manage-btn-outline"
                      onClick={() => setCakeFormOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="manage-toolbar">
                <div className="manage-category-pills">
                  {['All', ...allCategories].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={cakeCategoryFilter === cat ? 'selected' : ''}
                      onClick={() => setCakeCategoryFilter(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <input
                  type="search"
                  className="manage-search"
                  placeholder="Search cakes by name or category…"
                  value={cakeSearch}
                  onChange={(e) => setCakeSearch(e.target.value)}
                />
              </div>

              <div className="manage-cake-list">
                {filteredCakes.map((cake) => (
                  <article key={cake.id} className={`manage-cake-row ${!cake.is_available ? 'sold-out' : ''}`}>
                    <div className="manage-cake-thumb">
                      {cake.image_url ? (
                        <img src={resolveMediaUrl(cake.image_url, apiBase)} alt={cake.name} />
                      ) : (
                        <span>{cake.name[0]}</span>
                      )}
                    </div>
                    <div className="manage-cake-info">
                      <div className="manage-cake-title-line">
                        <h3>{cake.name}</h3>
                        <span className="manage-cat-tag">{cake.category}</span>
                        {cake.badge && <span className="manage-badge-tag">{cake.badge}</span>}
                      </div>
                      <p>{cake.description}</p>
                      <small>{cake.weight_or_size}</small>
                    </div>
                    <div className="manage-cake-price">
                      <strong>{formatMoney(cake.price_ghs)}</strong>
                      <span className={`avail-pill ${cake.is_available ? 'in' : 'out'}`}>
                        {cake.is_available ? 'Available' : 'Sold Out'}
                      </span>
                    </div>
                    <div className="manage-cake-actions">
                      <button
                        type="button"
                        className="manage-btn-outline"
                        onClick={() => handleToggleCakeAvailability(cake)}
                      >
                        {cake.is_available ? 'Mark Sold Out' : 'Mark Available'}
                      </button>
                      <button
                        type="button"
                        className="manage-btn-outline"
                        onClick={() => openEditCakeForm(cake)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="manage-btn-danger"
                        onClick={() => handleDeleteCake(cake)}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
                {filteredCakes.length === 0 && (
                  <p className="manage-empty">No cakes match your current filter.</p>
                )}
              </div>
            </section>
          )}

          {/* SECTION 2: INCOMING ORDERS */}
          {!loading && activeTab === 'orders' && (
            <section className="manage-panel">
              <div className="manage-toolbar">
                <div className="manage-category-pills">
                  {['All', 'Paid Only', ...ORDER_STATUS_OPTIONS].map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={orderStatusFilter === status ? 'selected' : ''}
                      onClick={() => setOrderStatusFilter(status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
                <input
                  type="search"
                  className="manage-search"
                  placeholder="Search reference, customer, phone, town…"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                />
              </div>

              <div className="manage-orders-list">
                {filteredOrders.map((order) => (
                  <article key={order.order_reference} className="manage-order-card">
                    <div className="manage-order-top">
                      <div>
                        <div className="manage-order-ref-line">
                          <strong>{order.order_reference}</strong>
                          <span className={`pay-pill ${order.payment_status}`}>
                            {order.payment_status === 'paid' ? 'Paid via Paystack' : 'Pending Payment'}
                          </span>
                          <span className="fulfillment-pill">
                            {order.fulfillment_type === 'delivery' ? 'Delivery' : 'Store Pickup'}
                          </span>
                        </div>
                        <small className="manage-order-date">
                          Placed {formatDate(order.created_at)}
                          {order.paystack_reference ? ` · Ref: ${order.paystack_reference}` : ''}
                        </small>
                      </div>

                      <div className="manage-order-status-box">
                        <label>
                          <span>Order Status</span>
                          <select
                            value={order.order_status}
                            disabled={updatingOrderRef === order.order_reference}
                            onChange={(e) =>
                              handleUpdateOrderStatus(order.order_reference, e.target.value)
                            }
                          >
                            {ORDER_STATUS_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                            {!ORDER_STATUS_OPTIONS.includes(order.order_status) && (
                              <option value={order.order_status}>{order.order_status}</option>
                            )}
                          </select>
                        </label>
                      </div>
                    </div>

                    <div className="manage-order-grid">
                      <div className="manage-order-customer">
                        <h4>Customer & Fulfillment</h4>
                        <p><strong>Name:</strong> {order.customer_full_name}</p>
                        <p><strong>Phone:</strong> <a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a></p>
                        <p><strong>Town:</strong> {order.delivery_town || 'Store Pickup'}</p>
                        <p><strong>Address / Landmark:</strong> {order.delivery_address || 'Pickup at Bakery'}</p>
                      </div>

                      <div className="manage-order-items">
                        <h4>Ordered Cakes ({order.items?.length || 0})</h4>
                        <ul>
                          {(order.items || []).map((item) => (
                            <li key={item.id}>
                              <div className="manage-order-item-line">
                                <span>
                                  <strong>{item.quantity}×</strong> {item.cake_name}{' '}
                                  <small>({item.cake_category})</small>
                                </span>
                                <strong>{formatMoney(item.line_total_ghs)}</strong>
                              </div>
                              {item.item_note && (
                                <p className="manage-order-note">
                                  Note: “{item.item_note}”
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="manage-order-footer">
                      <div className="manage-order-totals">
                        <span>Subtotal: {formatMoney(order.subtotal_ghs)}</span>
                        <span>Delivery: {formatMoney(order.delivery_fee_ghs)}</span>
                        <strong>Total: {formatMoney(order.total_ghs)}</strong>
                      </div>
                      {order.payment_status === 'paid' && (
                        <a
                          className="manage-btn-outline"
                          href={`${apiBase}/api/orders/${order.order_reference}/receipt/?download=1`}
                        >
                          Download Receipt
                        </a>
                      )}
                    </div>
                  </article>
                ))}

                {filteredOrders.length === 0 && (
                  <p className="manage-empty">No orders match the current filter.</p>
                )}
              </div>
            </section>
          )}

          {/* SECTION 3: DELIVERY PLACES & CUSTOM PRICES */}
          {!loading && activeTab === 'ordering' && settingsForm && (
            <section className="manage-panel">
              <form className="manage-settings-form" onSubmit={handleSaveSettings}>
                {/* Store Status Toggle */}
                <fieldset className="manage-fieldset">
                  <legend>Storewide Ordering Switch</legend>
                  <label className="manage-checkbox">
                    <input
                      type="checkbox"
                      checked={settingsForm.is_ordering_open}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, is_ordering_open: e.target.checked })
                      }
                    />
                    <span>
                      <strong>Online Ordering is Open</strong> — Allow customers to add cakes and submit orders on the storefront
                    </span>
                  </label>

                  <label className="manage-field">
                    <span>Closed Banner Message (shown to customers when ordering is closed)</span>
                    <textarea
                      rows={2}
                      value={settingsForm.closed_reason}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, closed_reason: e.target.value })
                      }
                    />
                  </label>
                </fieldset>

                {/* Fulfillment Switches & Base Delivery Fee */}
                <fieldset className="manage-fieldset">
                  <legend>Fulfillment Options & Base Fee</legend>
                  <div className="manage-form-grid">
                    <label className="manage-checkbox">
                      <input
                        type="checkbox"
                        checked={settingsForm.delivery_enabled}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, delivery_enabled: e.target.checked })
                        }
                      />
                      <span>Enable Delivery Fulfillment</span>
                    </label>

                    <label className="manage-checkbox">
                      <input
                        type="checkbox"
                        checked={settingsForm.pickup_enabled}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, pickup_enabled: e.target.checked })
                        }
                      />
                      <span>Enable Store Pickup Fulfillment</span>
                    </label>

                    <label className="manage-field">
                      <span>Default / Fallback Delivery Fee (GHS)</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={settingsForm.delivery_fee_ghs}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, delivery_fee_ghs: e.target.value })
                        }
                      />
                      <small>Used when a delivery town does not have a specific custom fee assigned.</small>
                    </label>
                  </div>
                </fieldset>

                {/* Delivery Places and Custom Delivery Prices */}
                <fieldset className="manage-fieldset">
                  <legend>Delivery Places & Custom Delivery Prices</legend>
                  <p className="manage-legend-sub">
                    Add the towns, suburbs, or cities you deliver to and set the exact delivery price for each area.
                    These prices show in the customer checkout dropdown and are automatically added to the customer's total.
                  </p>

                  {/* Add New Delivery Place Row */}
                  <div className="manage-add-place-card">
                    <h4>+ Add Delivery Place & Price</h4>
                    <div className="manage-add-place-row">
                      <input
                        type="text"
                        placeholder="Place name (e.g. East Legon, Accra)"
                        value={newPlaceName}
                        onChange={(e) => setNewPlaceName(e.target.value)}
                      />
                      <div className="manage-price-input-wrap">
                        <span className="price-prefix">GHS</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={settingsForm.delivery_fee_ghs || '25.00'}
                          value={newPlaceFee}
                          onChange={(e) => setNewPlaceFee(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={handleAddDeliveryPlace}
                      >
                        Add Place
                      </button>
                    </div>
                  </div>

                  {/* Search and count of delivery places */}
                  <div className="manage-places-toolbar">
                    <span className="manage-places-count">
                      Configured Places: <strong>{settingsForm.delivery_places?.length || 0}</strong>
                    </span>
                    <input
                      type="search"
                      className="manage-search"
                      placeholder="Search delivery places…"
                      value={placeSearch}
                      onChange={(e) => setPlaceSearch(e.target.value)}
                    />
                  </div>

                  {/* Places Table / List */}
                  <div className="manage-places-list">
                    {placesToDisplay.map((place) => (
                      <div key={place.name} className="manage-place-item">
                        <div className="manage-place-name-wrap">
                          <span className="manage-place-icon">📍</span>
                          <strong className="manage-place-name">{place.name}</strong>
                        </div>

                        <div className="manage-place-price-controls">
                          <span className="manage-place-currency">GHS</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="manage-place-fee-input"
                            value={place.fee_ghs}
                            onChange={(e) => handleUpdatePlaceFee(place.name, e.target.value)}
                          />
                          <button
                            type="button"
                            className="manage-place-remove-btn"
                            title={`Remove ${place.name}`}
                            onClick={() => handleRemovePlace(place.name)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}

                    {placesToDisplay.length === 0 && (
                      <p className="manage-empty">
                        {placeSearch ? 'No delivery places match your search.' : 'No delivery places added yet. Add one above!'}
                      </p>
                    )}
                  </div>
                </fieldset>

                <div>
                  <button type="submit" className="button button-primary" disabled={settingsSaving}>
                    {settingsSaving ? 'Saving Changes…' : 'Save Delivery Places & Settings'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* SECTION 4: BUSINESS HOURS, LOCATION & CONTACT */}
          {!loading && activeTab === 'profile' && settingsForm && (
            <section className="manage-panel">
              <form className="manage-settings-form" onSubmit={handleSaveSettings}>
                <fieldset className="manage-fieldset">
                  <legend>Business Hours, Location & Contact Details</legend>
                  <div className="manage-form-grid">
                    <label className="manage-field">
                      <span>Bakery Name</span>
                      <input
                        type="text"
                        required
                        value={settingsForm.bakery_name}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, bakery_name: e.target.value })
                        }
                      />
                    </label>

                    <label className="manage-field">
                      <span>Tagline</span>
                      <input
                        type="text"
                        value={settingsForm.tagline}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, tagline: e.target.value })
                        }
                      />
                    </label>

                    <label className="manage-field">
                      <span>Opening Hours</span>
                      <input
                        type="text"
                        required
                        value={settingsForm.opening_hours}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, opening_hours: e.target.value })
                        }
                      />
                    </label>

                    <label className="manage-field">
                      <span>Bakery Location Address</span>
                      <input
                        type="text"
                        required
                        value={settingsForm.location_address}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, location_address: e.target.value })
                        }
                      />
                    </label>

                    <label className="manage-field">
                      <span>Phone Number</span>
                      <input
                        type="text"
                        required
                        value={settingsForm.phone_number}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, phone_number: e.target.value })
                        }
                      />
                    </label>

                    <label className="manage-field">
                      <span>WhatsApp Number (digits only, e.g. 233245550192)</span>
                      <input
                        type="text"
                        required
                        value={settingsForm.whatsapp_number}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, whatsapp_number: e.target.value })
                        }
                      />
                    </label>
                  </div>
                </fieldset>

                <div>
                  <button type="submit" className="button button-primary" disabled={settingsSaving}>
                    {settingsSaving ? 'Saving Details…' : 'Save Business Details'}
                  </button>
                </div>
              </form>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
