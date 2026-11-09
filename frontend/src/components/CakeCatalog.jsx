import { useMemo } from 'react'
import './CakeCatalog.css'
import Icon from './Icon'
import { resolveMediaUrl } from '../utils/media'

const money = (value) => new Intl.NumberFormat('en-GH', {
  style: 'currency',
  currency: 'GHS',
}).format(Number(value || 0))

function CakeCard({ cake, quantity, orderingOpen, onQuantityChange, onAdd }) {
  return (
    <article className={`cake-card${cake.is_available ? '' : ' is-sold-out'}`}>
      <div className="cake-card-image-wrap">
        {cake.image_url
          ? <img className="cake-card-image" src={resolveMediaUrl(cake.image_url)} alt={cake.name} loading="lazy" />
          : <div className="cake-image-placeholder" aria-hidden="true">CAKE</div>}
        {cake.badge && <span className="cake-card-badge">{cake.badge}</span>}
        {!cake.is_available && <span className="cake-sold-out">Sold out</span>}
      </div>
      <div className="cake-card-content">
        <p className="cake-card-category">{cake.category}</p>
        <h3>{cake.name}</h3>
        <p className="cake-card-description">{cake.description}</p>
        <div className="cake-card-bottom">
          <div>
            <p className="cake-card-price">{money(cake.price_ghs)}</p>
            <p className="cake-card-size">{cake.weight_or_size}</p>
          </div>
          <div className="cake-card-actions">
            {cake.is_available && (
              <div className="cake-quantity" aria-label={`Quantity of ${cake.name}`}>
                <button type="button" aria-label="Decrease quantity" onClick={() => onQuantityChange(Math.max(1, quantity - 1))}>
                  <Icon name="minus" size={15} />
                </button>
                <span>{quantity}</span>
                <button type="button" aria-label="Increase quantity" onClick={() => onQuantityChange(quantity + 1)}>
                  <Icon name="plus" size={15} />
                </button>
              </div>
            )}
            <button
              className="button button-add"
              type="button"
              disabled={!cake.is_available || !orderingOpen}
              onClick={() => onAdd(cake)}
            >
              {!orderingOpen ? 'Ordering closed' : cake.is_available ? 'Add to bag' : 'Unavailable'}
              {cake.is_available && orderingOpen && <Icon name="plus" size={15} />}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function CakeCatalog({
  cakes,
  loading,
  error,
  category,
  search,
  quantities,
  orderingOpen,
  onCategoryChange,
  onSearchChange,
  onQuantityChange,
  onAdd,
  onRetry,
}) {
  const categories = useMemo(
    () => ['All cakes', ...new Set(cakes.map((cake) => cake.category).filter(Boolean))],
    [cakes],
  )
  const filteredCakes = useMemo(() => {
    const query = search.trim().toLowerCase()
    return cakes.filter((cake) => {
      const inCategory = category === 'All cakes' || cake.category === category
      const inSearch = !query || [cake.name, cake.description, cake.category]
        .some((value) => (value || '').toLowerCase().includes(query))
      return inCategory && inSearch
    })
  }, [cakes, category, search])

  return (
    <section className="catalog-section section-wrap" id="cakes" aria-labelledby="catalog-title">
      <div className="catalog-heading">
        <div>
          <h2 id="catalog-title">Our cakes</h2>
          <p className="section-lead">
            Cakes made fresh for birthdays, celebrations, and everyday moments.
          </p>
        </div>
        <label className="cake-search" htmlFor="cake-search-input">
          <Icon name="search" size={18} />
          <input
            id="cake-search-input"
            name="search"
            type="search"
            placeholder="Search cakes"
            aria-label="Search cakes"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
      </div>
      <div className="catalog-tools">
        <div className="cake-category-list" role="group" aria-label="Filter cakes by category">
          {categories.map((entry) => (
            <button
              key={entry}
              type="button"
              className={`cake-category-button${category === entry ? ' selected' : ''}`}
              aria-pressed={category === entry}
              onClick={() => onCategoryChange(entry)}
            >
              {entry}
            </button>
          ))}
        </div>
        <p className="results-count">{filteredCakes.length} {filteredCakes.length === 1 ? 'cake' : 'cakes'}</p>
      </div>
      {loading && <div className="catalog-state" role="status"><span className="catalog-loader" /> Gathering the cake collection…</div>}
      {!loading && error && (
        <div className="catalog-state catalog-error" role="alert">
          <p>{error}</p>
          <button className="button button-outline" type="button" onClick={onRetry}>Try again</button>
        </div>
      )}
      {!loading && !error && filteredCakes.length === 0 && (
        <div className="catalog-state">No cakes match that search. Try another name or category.</div>
      )}
      {!loading && !error && filteredCakes.length > 0 && (
        <div className="cake-grid">
          {filteredCakes.map((cake) => (
            <CakeCard
              key={cake.id}
              cake={cake}
              quantity={quantities[cake.id] || 1}
              orderingOpen={orderingOpen}
              onQuantityChange={(value) => onQuantityChange(cake.id, value)}
              onAdd={onAdd}
            />
          ))}
        </div>
      )}
    </section>
  )
}