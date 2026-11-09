import './CartDrawer.css'
import Icon from './Icon'
import { resolveMediaUrl } from '../utils/media'

const money = (value) => new Intl.NumberFormat('en-GH', {
  style: 'currency',
  currency: 'GHS',
}).format(Number(value || 0))

export default function CartDrawer({
  open,
  cartItems,
  itemCount,
  subtotal,
  deliveryFee,
  fulfillment,
  orderingOpen,
  onClose,
  onUpdateItem,
  onContinue,
}) {
  if (!open) return null

  return (
    <div className="cart-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div className="cart-drawer-header">
          <div>
            <p className="cart-eyebrow">YOUR SELECTION</p>
            <h2 id="cart-title">Your bag <span>{itemCount}</span></h2>
          </div>
          <button className="cart-close" type="button" aria-label="Close bag" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="cart-drawer-body">
          {cartItems.length === 0 ? (
            <div className="empty-bag">
              <span className="empty-bag-icon"><Icon name="bag" size={25} /></span>
              <h3>Your bag is taking a breather.</h3>
              <p>Find a cake that feels just right and add it here.</p>
              <button className="button button-primary" type="button" onClick={onClose}>Explore cakes</button>
            </div>
          ) : (
            <>
              <div className="cart-lines">
                {cartItems.map((item) => (
                  <article className="cart-line" key={item.cake_id}>
                    <div className="cart-line-image">
                      {item.cake?.image_url && <img src={resolveMediaUrl(item.cake.image_url)} alt="" />}
                    </div>
                    <div className="cart-line-main">
                      <div className="cart-line-top">
                        <div>
                          <p className="cart-line-category">{item.cake?.category}</p>
                          <h3>{item.name}</h3>
                        </div>
                        <button className="cart-remove" type="button" onClick={() => onUpdateItem(item.cake_id, { quantity: 0 })}>Remove</button>
                      </div>
                      <div className="cart-line-bottom">
                        <div className="cart-quantity">
                          <button type="button" aria-label="Decrease quantity" onClick={() => onUpdateItem(item.cake_id, { quantity: item.quantity - 1 })}>
                            <Icon name="minus" size={15} />
                          </button>
                          <span>{item.quantity}</span>
                          <button type="button" aria-label="Increase quantity" onClick={() => onUpdateItem(item.cake_id, { quantity: item.quantity + 1 })}>
                            <Icon name="plus" size={15} />
                          </button>
                        </div>
                        <strong>{money(item.price * item.quantity)}</strong>
                      </div>
                      <label className="cart-note">
                        <span>A note for the bakery <small>OPTIONAL</small></span>
                        <textarea
                          value={item.item_note}
                          maxLength={500}
                          placeholder="A flavour preference, message, or special request…"
                          onChange={(event) => onUpdateItem(item.cake_id, { item_note: event.target.value })}
                        />
                      </label>
                    </div>
                  </article>
                ))}
              </div>
              <div className="cart-summary">
                <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
                <div><span>Delivery</span><strong>{fulfillment === 'delivery' ? money(deliveryFee) : 'At pickup'}</strong></div>
                <div className="cart-total"><span>Estimated total</span><strong>{money(subtotal + (fulfillment === 'delivery' ? deliveryFee : 0))}</strong></div>
                <p>Final delivery details are confirmed at checkout.</p>
                <button className="button button-primary button-wide" type="button" disabled={!orderingOpen} onClick={onContinue}>
                  {orderingOpen ? 'Continue to checkout' : 'Online ordering is closed'}
                  {orderingOpen && <Icon name="arrow" size={17} />}
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}