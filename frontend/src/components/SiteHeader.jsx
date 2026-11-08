import './SiteHeader.css'
import Icon from './Icon'

export default function SiteHeader({ settings, orderingOpen, itemCount, onOpenBag }) {
  return (
    <div>
      <header className="site-header">
        <a className="brand" href="#cakes" aria-label={`${settings?.bakery_name || 'Big Bakery'} home`}>
          <strong className="brand-wordmark">{settings?.bakery_name || 'Big Bakery'}</strong>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#cakes">Menu</a>
          <a href="#our-story">About</a>
          <a href="#visit-us">Location</a>
        </nav>
        <div className="header-actions">
          {!orderingOpen && (
            <span className="open-status status-closed">Orders paused</span>
          )}
          <button className="bag-button" type="button" onClick={onOpenBag}>
            <Icon name="bag" size={17} />
            <span>Bag</span>
            <span className="bag-count">{itemCount}</span>
          </button>
        </div>
      </header>
      {!orderingOpen && settings?.closed_reason && (
        <div className="closed-banner" role="status">{settings.closed_reason}</div>
      )}
    </div>
  )
}
