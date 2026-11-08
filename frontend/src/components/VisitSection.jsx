import './VisitSection.css'
import Icon from './Icon'

export default function VisitSection({ settings }) {
  const phone = (settings?.phone_number || '').replace(/\s+/g, '')

  return (
    <section className="visit-section section-wrap" id="visit-us" aria-labelledby="visit-title">
      <div>
        <h2 id="visit-title">Visit the bakery.</h2>
        <p className="visit-lead">
          Stop by for fresh cakes and pastries, or arrange a pickup order directly from our shop.
        </p>
      </div>
      <div className="visit-details">
        <div className="visit-detail">
          <Icon name="pin" size={18} />
          <div>
            <small>Location</small>
            <p>{settings?.location_address || 'Contact us for our location'}</p>
          </div>
        </div>
        <div className="visit-detail">
          <Icon name="clock" size={18} />
          <div>
            <small>Hours</small>
            <p>{settings?.opening_hours || 'Get in touch for today’s hours'}</p>
          </div>
        </div>
        {phone && (
          <a className="visit-contact-link" href={`tel:${phone}`}>
            Call {settings?.phone_number}
          </a>
        )}
      </div>
    </section>
  )
}
