import './SiteFooter.css'

export default function SiteFooter({ settings }) {
  const phone = (settings?.phone_number || '').replace(/\s+/g, '')
  const whatsApp = (settings?.whatsapp_number || '').replace(/\D/g, '')
  const name = settings?.bakery_name || 'Big Bakery'

  return (
    <footer className="site-footer">
      <div className="footer-brand-wrap">
        <a className="brand-wordmark" href="#cakes">{name}</a>
        <p className="footer-signoff">
          {settings?.opening_hours || 'Freshly baked every day'}
        </p>
      </div>
      <nav className="footer-links" aria-label="Contact and page links">
        {phone && <a href={`tel:${phone}`}>Phone</a>}
        {whatsApp && <a href={`https://wa.me/${whatsApp}`} target="_blank" rel="noreferrer">WhatsApp</a>}
        <a href="#cakes">Menu</a>
      </nav>
      <small className="copyright">© {new Date().getFullYear()} {name}</small>
    </footer>
  )
}
