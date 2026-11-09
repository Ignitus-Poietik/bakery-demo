import CakeCatalog from './components/CakeCatalog'
import HeroSection from './components/HeroSection'
import HelpWidget from './components/HelpWidget'
import SiteFooter from './components/SiteFooter'
import SiteHeader from './components/SiteHeader'
import StorySection from './components/StorySection'
import VisitSection from './components/VisitSection'
import './StorefrontPage.css'

export default function StorefrontPage({
  settings,
  orderingOpen,
  itemCount,
  cakes,
  loading,
  error,
  category,
  search,
  quantities,
  onOpenBag,
  onCategoryChange,
  onSearchChange,
  onQuantityChange,
  onAddCake,
  onRetry,
  apiBase,
}) {
  return (
    <div className="storefront-page">
      <SiteHeader
        settings={settings}
        orderingOpen={orderingOpen}
        itemCount={itemCount}
        onOpenBag={onOpenBag}
      />
      <main>
        <HeroSection
          bakeryName={settings?.bakery_name || 'The Cake Bakery'}
          tagline={settings?.tagline}
        />
        <CakeCatalog
          cakes={cakes}
          loading={loading}
          error={error}
          category={category}
          search={search}
          quantities={quantities}
          orderingOpen={orderingOpen}
          onCategoryChange={onCategoryChange}
          onSearchChange={onSearchChange}
          onQuantityChange={onQuantityChange}
          onAdd={onAddCake}
          onRetry={onRetry}
        />
        <StorySection />
        <VisitSection settings={settings} />
      </main>
      <SiteFooter settings={settings} />
      <HelpWidget apiBase={apiBase} onOpenBag={onOpenBag} />
    </div>
  )
}
