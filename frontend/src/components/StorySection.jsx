import './StorySection.css'

export default function StorySection() {
  return (
    <section className="story-section" id="our-story" aria-labelledby="story-title">
      <div className="story-inner">
        <div className="story-content">
          <h2 id="story-title">Baked fresh in small batches.</h2>
          <p>
            Every cake is prepared to order in our kitchen using real butter, fresh eggs,
            and Ghanaian cocoa. Pick a cake from the menu, leave an inscription or note
            in your bag, and we will have it ready for pickup or delivery.
          </p>
        </div>
        <a className="story-link" href="#cakes">
          Back to menu
        </a>
      </div>
    </section>
  )
}
