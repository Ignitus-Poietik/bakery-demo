import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Support testing and deep-linking to specific scroll positions (e.g. ?scroll=1200)
if (typeof window !== 'undefined' && window.location.search.includes('scroll=')) {
  const targetY = parseInt(new URLSearchParams(window.location.search).get('scroll') || '0', 10)
  if (targetY > 0) {
    const applyScroll = () => {
      window.scrollTo(0, targetY)
    }
    window.addEventListener('load', () => setTimeout(applyScroll, 120))
    setTimeout(applyScroll, 200)
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
