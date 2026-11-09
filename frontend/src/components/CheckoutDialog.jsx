import { useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import './CheckoutDialog.css'
import Icon from './Icon'

const money = (value) => new Intl.NumberFormat('en-GH', {
  style: 'currency',
  currency: 'GHS',
}).format(Number(value || 0))
const EMPTY_TOWNS = []

async function readResponse(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.')
  return data
}

export default function CheckoutDialog({
  settings,
  cartItems,
  itemCount,
  subtotal,
  deliveryFee,
  apiBase,
  onClose,
  onSuccess,
}) {
  const [form, setForm] = useState({
    nameMode: 'full',
    fullName: '',
    firstName: '',
    middleName: '',
    lastName: '',
    phone: '',
    email: '',
    town: '',
    address: '',
    fulfillment: settings?.delivery_enabled ? 'delivery' : 'pickup',
  })
  const [townQuery, setTownQuery] = useState('')
  const [townOpen, setTownOpen] = useState(false)
  const [pendingOrder, setPendingOrder] = useState(null)
  const [confirmedOrder, setConfirmedOrder] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const towns = settings?.delivery_towns ?? EMPTY_TOWNS
  const townFees = settings?.delivery_town_fees || {}
  const activeDeliveryFee =
    form.fulfillment === 'delivery'
      ? Number(
          form.town && townFees[form.town] !== undefined
            ? townFees[form.town]
            : deliveryFee,
        )
      : 0
  const total = subtotal + activeDeliveryFee
  const filteredTowns = useMemo(
    () => towns.filter((town) => town.toLowerCase().includes(townQuery.trim().toLowerCase())),
    [towns, townQuery],
  )

  function getTownFee(townName) {
    if (townFees[townName] !== undefined) {
      return Number(townFees[townName])
    }
    return Number(deliveryFee || 0)
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
  }

  async function submitOrder(event) {
    event.preventDefault()
    setError('')
    if (!settings?.is_ordering_open) {
      setError(settings?.closed_reason || 'Online ordering is currently closed.')
      return
    }
    if (cartItems.some((item) => !item.cake?.is_available)) {
      setError('A cake in your bag is no longer available. Please remove it before continuing.')
      return
    }

    // Serialize form input values from the submitted form
    const formData = new FormData(event.currentTarget)
    const serialized = Object.fromEntries(formData.entries())

    const fulfillment = serialized.fulfillment_type || form.fulfillment || 'delivery'
    const nameMode = serialized.name_input_mode || form.nameMode || 'full'
    const fullName = String(serialized.customer_full_name ?? form.fullName ?? '').trim()
    const firstName = String(serialized.customer_first_name ?? form.firstName ?? '').trim()
    const middleName = String(serialized.customer_middle_name ?? form.middleName ?? '').trim()
    const lastName = String(serialized.customer_last_name ?? form.lastName ?? '').trim()
    const phone = String(serialized.customer_phone ?? form.phone ?? '').trim()
    const email = String(serialized.customer_email ?? form.email ?? '').trim()
    const selectedTown = String(serialized.delivery_town ?? form.town ?? townQuery ?? '').trim()
    const address = String(serialized.delivery_address ?? form.address ?? '').trim()

    if (fulfillment === 'delivery' && !towns.includes(selectedTown)) {
      setError('Choose a delivery town from the suggestions.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${apiBase}/api/orders/initiate/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fulfillment_type: fulfillment,
          name_input_mode: nameMode,
          customer_full_name: fullName,
          customer_first_name: firstName,
          customer_middle_name: middleName,
          customer_last_name: lastName,
          customer_phone: phone,
          customer_email: email,
          delivery_town: fulfillment === 'delivery' ? selectedTown : '',
          delivery_address: fulfillment === 'delivery' ? address : '',
          items: cartItems.map((item) => ({
            cake_id: item.cake_id,
            quantity: item.quantity,
            item_note: (item.item_note || '').trim(),
          })),
        }),
      })
      const result = await readResponse(response)
      setPendingOrder(result)
      toast.success('Order details saved. Proceed to Paystack payment.')
    } catch (requestError) {
      const msg = requestError.message || 'Could not connect to the bakery server.'
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function verifyPayment(paymentPayload, orderReference) {
    setSubmitting(true)
    setError('')
    const paystackReference = typeof paymentPayload === 'string'
      ? paymentPayload
      : (paymentPayload?.reference || paymentPayload?.trxref || '')
    try {
      const response = await fetch(`${apiBase}/api/orders/${orderReference}/confirm-payment/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paystack_reference: paystackReference,
          paystack_status: paymentPayload?.status || 'success',
          paystack_message: paymentPayload?.message || 'Approved',
          paystack_transaction: paymentPayload?.trans || paymentPayload?.transaction || '',
        }),
      })
      const result = await readResponse(response)
      setConfirmedOrder(result.order)
      setPendingOrder(null)
      onSuccess(result.order)
      toast.success('Payment verified! Your cake order is confirmed.')
    } catch (requestError) {
      const msg = requestError.message || 'We could not verify your payment.'
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  function startPayment() {
    const paystack = pendingOrder?.paystack
    if (!paystack?.public_key || !/^pk_(test|live)_/.test(paystack.public_key) || paystack.public_key.includes('demo')) {
      setError('Paystack is not configured yet. Please contact the bakery to complete your order.')
      return
    }
    if (!window.PaystackPop) {
      setError('The Paystack payment window could not load. Check your connection and try again.')
      return
    }
    const orderReference = pendingOrder.order.order_reference
    let paymentCompleted = false
    const handler = window.PaystackPop.setup({
      key: paystack.public_key,
      email: form.email.trim(),
      amount: paystack.amount_pesewas,
      currency: paystack.currency || 'GHS',
      ref: paystack.reference,
      onClose: () => {
        if (!paymentCompleted) {
          setError('Payment was not completed. Your order is still unpaid.')
        }
      },
      callback: (payment) => {
        paymentCompleted = true
        verifyPayment(
          {
            ...payment,
            reference: payment?.reference || payment?.trxref || paystack.reference,
          },
          orderReference,
        )
      },
    })
    handler.openIframe()
  }

  return (
    <div className="checkout-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onClose()
    }}>
      <section className="checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
        <div className="checkout-header">
          <div>
            <p className="checkout-eyebrow">{confirmedOrder ? 'ORDER COMPLETE' : 'A FEW DETAILS'}</p>
            <h2 id="checkout-title">{confirmedOrder ? 'It’s on its way.' : 'Checkout'}</h2>
          </div>
          <button className="checkout-close" type="button" aria-label="Close checkout" disabled={submitting} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="checkout-content">
          {confirmedOrder ? (
            <div className="checkout-success">
              <span className="success-icon"><Icon name="check" size={26} /></span>
              <p className="checkout-eyebrow">PAYMENT CONFIRMED</p>
              <h3>Thank you, {confirmedOrder.customer_full_name}.</h3>
              <p>Your order has been sent to the bakery. Keep this reference for your records.</p>
              <div className="order-reference">
                <span>ORDER REFERENCE</span>
                <strong>{confirmedOrder.order_reference}</strong>
              </div>
              <a className="button button-primary button-wide" href={`${apiBase}/api/orders/${confirmedOrder.order_reference}/receipt/?download=1`}>
                Download your receipt <Icon name="arrow" size={17} />
              </a>
              <button className="checkout-text-button" type="button" onClick={onClose}>Back to the cakes</button>
            </div>
          ) : pendingOrder ? (
            <div className="payment-ready">
              <div className="order-reference">
                <span>ORDER REFERENCE</span>
                <strong>{pendingOrder.order.order_reference}</strong>
              </div>
              <h3>Your order is ready for payment.</h3>
              <p>Pay securely with Paystack. Your order is only confirmed after payment is verified.</p>
              <div className="payment-total"><span>Total</span><strong>{money(pendingOrder.order.total_ghs)}</strong></div>
              <button className="button button-primary button-wide" type="button" disabled={submitting} onClick={startPayment}>
                {submitting ? 'Verifying payment…' : 'Pay with Paystack'}
                <Icon name="arrow" size={17} />
              </button>
              <button className="checkout-text-button" type="button" onClick={() => setPendingOrder(null)}>Edit order details</button>
            </div>
          ) : (
            <>
              <div className="checkout-summary">
                <div><span>{itemCount} {itemCount === 1 ? 'cake' : 'cakes'}</span><strong>{money(total)}</strong></div>
                <p>No account needed. Just a few details so we can get your order to you.</p>
              </div>
              <form className="checkout-form" onSubmit={submitOrder}>
                <input type="hidden" name="name_input_mode" value={form.nameMode} />
                <input type="hidden" name="fulfillment_type" value={form.fulfillment} />

                <fieldset className="checkout-fieldset">
                  <legend>Your details</legend>
                  <div className="name-mode-toggle">
                    <button className={form.nameMode === 'full' ? 'active' : ''} type="button" onClick={() => updateForm('nameMode', 'full')}>Full name</button>
                    <button className={form.nameMode === 'split' ? 'active' : ''} type="button" onClick={() => updateForm('nameMode', 'split')}>First & last</button>
                  </div>
                  {form.nameMode === 'full' ? (
                    <label className="checkout-field" htmlFor="checkout-full-name">Full name
                      <input
                        id="checkout-full-name"
                        name="customer_full_name"
                        autoComplete="name"
                        required
                        value={form.fullName}
                        onChange={(event) => updateForm('fullName', event.target.value)}
                      />
                    </label>
                  ) : (
                    <div className="checkout-name-fields">
                      <label className="checkout-field" htmlFor="checkout-first-name">First name
                        <input
                          id="checkout-first-name"
                          name="customer_first_name"
                          autoComplete="given-name"
                          required
                          value={form.firstName}
                          onChange={(event) => updateForm('firstName', event.target.value)}
                        />
                      </label>
                      <label className="checkout-field" htmlFor="checkout-middle-name">Middle name <small>OPTIONAL</small>
                        <input
                          id="checkout-middle-name"
                          name="customer_middle_name"
                          autoComplete="additional-name"
                          value={form.middleName}
                          onChange={(event) => updateForm('middleName', event.target.value)}
                        />
                      </label>
                      <label className="checkout-field" htmlFor="checkout-last-name">Last name
                        <input
                          id="checkout-last-name"
                          name="customer_last_name"
                          autoComplete="family-name"
                          required
                          value={form.lastName}
                          onChange={(event) => updateForm('lastName', event.target.value)}
                        />
                      </label>
                    </div>
                  )}
                  <div className="checkout-name-fields">
                    <label className="checkout-field" htmlFor="checkout-phone">Phone number
                      <input
                        id="checkout-phone"
                        name="customer_phone"
                        autoComplete="tel"
                        type="tel"
                        required
                        minLength={7}
                        value={form.phone}
                        onChange={(event) => updateForm('phone', event.target.value)}
                      />
                    </label>
                    <label className="checkout-field" htmlFor="checkout-email">Email for Paystack
                      <input
                        id="checkout-email"
                        name="customer_email"
                        autoComplete="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={(event) => updateForm('email', event.target.value)}
                      />
                    </label>
                  </div>
                </fieldset>

                {(settings?.delivery_enabled || settings?.pickup_enabled) && (
                  <fieldset className="checkout-fieldset">
                    <legend>How would you like your cakes?</legend>
                    <div className="fulfillment-options">
                      {settings.delivery_enabled && (
                        <button className={form.fulfillment === 'delivery' ? 'selected' : ''} type="button" onClick={() => updateForm('fulfillment', 'delivery')}>
                          <span className="option-radio" /> Delivery
                          <small>
                            {form.town
                              ? `${money(activeDeliveryFee)} (${form.town})`
                              : `${money(settings.delivery_fee_ghs)} base fee`}
                          </small>
                        </button>
                      )}
                      {settings.pickup_enabled && (
                        <button className={form.fulfillment === 'pickup' ? 'selected' : ''} type="button" onClick={() => updateForm('fulfillment', 'pickup')}>
                          <span className="option-radio" /> Pick up
                          <small>Collect from bakery</small>
                        </button>
                      )}
                    </div>
                    {form.fulfillment === 'delivery' && (
                      <div className="delivery-fields">
                        <label className="checkout-field town-field" htmlFor="checkout-town">Delivery town
                          <input
                            id="checkout-town"
                            name="delivery_town"
                            autoComplete="address-level2"
                            required
                            value={townQuery}
                            placeholder="Start typing your town…"
                            onFocus={() => setTownOpen(true)}
                            onChange={(event) => {
                              setTownQuery(event.target.value)
                              updateForm('town', '')
                              setTownOpen(true)
                            }}
                            onBlur={() => window.setTimeout(() => setTownOpen(false), 120)}
                          />
                          {townOpen && filteredTowns.length > 0 && (
                            <span className="town-options" role="listbox">
                              {filteredTowns.slice(0, 12).map((town) => (
                                <button key={town} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                                  setTownQuery(town)
                                  updateForm('town', town)
                                  setTownOpen(false)
                                }}>
                                  <span>{town}</span>
                                  <strong className="town-option-fee">{money(getTownFee(town))}</strong>
                                </button>
                              ))}
                            </span>
                          )}
                        </label>
                        <label className="checkout-field" htmlFor="checkout-address">Address or nearby landmark
                          <textarea
                            id="checkout-address"
                            name="delivery_address"
                            autoComplete="street-address"
                            required
                            rows="2"
                            value={form.address}
                            onChange={(event) => updateForm('address', event.target.value)}
                          />
                        </label>
                      </div>
                    )}
                  </fieldset>
                )}
                {error && <p className="checkout-error" role="alert">{error}</p>}
                <button className="button button-primary button-wide" type="submit" disabled={submitting || !settings?.is_ordering_open || cartItems.length === 0}>
                  {submitting ? 'Preparing your order…' : 'Continue to payment'}
                  {!submitting && <Icon name="arrow" size={17} />}
                </button>
                <p className="secure-note">You’ll pay securely through Paystack. No account required.</p>
              </form>
            </>
          )}
          {error && (pendingOrder || confirmedOrder) && <p className="checkout-error" role="alert">{error}</p>}
        </div>
      </section>
    </div>
  )
}
