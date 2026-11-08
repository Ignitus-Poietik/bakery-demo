import { useMemo, useState } from 'react'
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
  const total = subtotal + (form.fulfillment === 'delivery' ? deliveryFee : 0)
  const filteredTowns = useMemo(
    () => towns.filter((town) => town.toLowerCase().includes(townQuery.trim().toLowerCase())),
    [towns, townQuery],
  )

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
    if (form.fulfillment === 'delivery' && !towns.includes(form.town)) {
      setError('Choose a delivery town from the suggestions.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${apiBase}/api/orders/initiate/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fulfillment_type: form.fulfillment,
          name_input_mode: form.nameMode,
          customer_full_name: form.fullName.trim(),
          customer_first_name: form.firstName.trim(),
          customer_middle_name: form.middleName.trim(),
          customer_last_name: form.lastName.trim(),
          customer_phone: form.phone.trim(),
          delivery_town: form.fulfillment === 'delivery' ? form.town : '',
          delivery_address: form.fulfillment === 'delivery' ? form.address.trim() : '',
          items: cartItems.map((item) => ({
            cake_id: item.cake_id,
            quantity: item.quantity,
            item_note: item.item_note.trim(),
          })),
        }),
      })
      setPendingOrder(await readResponse(response))
    } catch (requestError) {
      setError(requestError.message || 'Could not connect to the bakery server.')
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
    } catch (requestError) {
      setError(requestError.message || 'We could not verify your payment.')
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
                <fieldset className="checkout-fieldset">
                  <legend>Your details</legend>
                  <div className="name-mode-toggle">
                    <button className={form.nameMode === 'full' ? 'active' : ''} type="button" onClick={() => updateForm('nameMode', 'full')}>Full name</button>
                    <button className={form.nameMode === 'split' ? 'active' : ''} type="button" onClick={() => updateForm('nameMode', 'split')}>First & last</button>
                  </div>
                  {form.nameMode === 'full' ? (
                    <label className="checkout-field">Full name
                      <input autoComplete="name" required value={form.fullName} onChange={(event) => updateForm('fullName', event.target.value)} />
                    </label>
                  ) : (
                    <div className="checkout-name-fields">
                      <label className="checkout-field">First name
                        <input autoComplete="given-name" required value={form.firstName} onChange={(event) => updateForm('firstName', event.target.value)} />
                      </label>
                      <label className="checkout-field">Middle name <small>OPTIONAL</small>
                        <input autoComplete="additional-name" value={form.middleName} onChange={(event) => updateForm('middleName', event.target.value)} />
                      </label>
                      <label className="checkout-field">Last name
                        <input autoComplete="family-name" required value={form.lastName} onChange={(event) => updateForm('lastName', event.target.value)} />
                      </label>
                    </div>
                  )}
                  <div className="checkout-name-fields">
                    <label className="checkout-field">Phone number
                      <input autoComplete="tel" type="tel" required minLength={7} value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} />
                    </label>
                    <label className="checkout-field">Email for Paystack
                      <input autoComplete="email" type="email" required value={form.email} onChange={(event) => updateForm('email', event.target.value)} />
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
                          <small>{money(settings.delivery_fee_ghs)} fee</small>
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
                        <label className="checkout-field town-field">Delivery town
                          <input
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
                              {filteredTowns.slice(0, 8).map((town) => (
                                <button key={town} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                                  setTownQuery(town)
                                  updateForm('town', town)
                                  setTownOpen(false)
                                }}>{town}</button>
                              ))}
                            </span>
                          )}
                        </label>
                        <label className="checkout-field">Address or nearby landmark
                          <textarea autoComplete="street-address" required rows="2" value={form.address} onChange={(event) => updateForm('address', event.target.value)} />
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
