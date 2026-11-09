import { useEffect, useRef } from 'react'
import './HeroSection.css'

const TOTAL_FRAMES = 158
const FRAME_ASPECT = 1344 / 768

function getFrameUrl(index) {
  const padded = String(Math.max(1, Math.min(TOTAL_FRAMES, index))).padStart(3, '0')
  return `/hero-frames/ezgif-frame-${padded}.jpg`
}

function smoothStep(start, end, value) {
  const progress = Math.max(0, Math.min(1, (value - start) / (end - start)))
  return progress * progress * (3 - 2 * progress)
}

export default function HeroSection({ bakeryName, tagline }) {
  const stageRef = useRef(null)
  const sceneRef = useRef(null)
  const canvasRef = useRef(null)
  const introVeilRef = useRef(null)
  const blurVeilRef = useRef(null)

  const imagesRef = useRef([])
  const targetFrameRef = useRef(1)
  const currentFrameRef = useRef(1)
  const lastDrawnFrameRef = useRef(-1)
  const animationFrameRef = useRef(0)
  const isReducedMotionRef = useRef(false)

  function drawFrame(frameNumber, force = false) {
    const rounded = Math.round(frameNumber)
    if (!force && rounded === lastDrawnFrameRef.current) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const index = rounded - 1
    let img = imagesRef.current[index]
    if (!img || !img.complete || img.naturalWidth === 0) {
      for (let offset = 1; offset < TOTAL_FRAMES; offset += 1) {
        const prev = imagesRef.current[index - offset]
        if (prev && prev.complete && prev.naturalWidth > 0) {
          img = prev
          break
        }
        const next = imagesRef.current[index + offset]
        if (next && next.complete && next.naturalWidth > 0) {
          img = next
          break
        }
      }
    }
    if (!img || !img.complete || img.naturalWidth === 0) return

    lastDrawnFrameRef.current = rounded
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    const cW = canvas.width
    const cH = canvas.height
    const canvasAspect = cW / cH

    let dW
    let dH
    let dX
    let dY

    if (canvasAspect > FRAME_ASPECT) {
      dW = cW
      dH = cW / FRAME_ASPECT
      dX = 0
      dY = (cH - dH) / 2
    } else {
      dH = cH
      dW = cH * FRAME_ASPECT
      dX = (cW - dW) / 2
      dY = 0
    }

    ctx.drawImage(img, dX, dY, dW, dH)
  }

  useEffect(() => {
    let active = true
    const images = new Array(TOTAL_FRAMES)
    imagesRef.current = images

    const frame1 = new Image()
    frame1.decoding = 'sync'
    frame1.src = getFrameUrl(1)
    frame1.onload = () => {
      if (!active) return
      images[0] = frame1
      drawFrame(1, true)
    }

    for (let i = 2; i <= TOTAL_FRAMES; i += 1) {
      const img = new Image()
      img.decoding = 'async'
      img.src = getFrameUrl(i)
      img.onload = () => {
        if (!active) return
        images[i - 1] = img
        // Decode ahead into GPU bitmap memory so scrubbing never stalls on decode
        if (typeof img.decode === 'function') {
          img.decode().catch(() => {})
        }
      }
    }

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    const scene = sceneRef.current
    const canvas = canvasRef.current
    const introVeil = introVeilRef.current
    const blurVeil = blurVeilRef.current
    const root = document.documentElement
    if (!stage || !scene || !canvas) return undefined

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    isReducedMotionRef.current = reducedMotionQuery.matches

    function resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = window.innerWidth
      const h = window.innerHeight
      const targetW = Math.floor(w * dpr)
      const targetH = Math.floor(h * dpr)
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW
        canvas.height = targetH
      }
      drawFrame(currentFrameRef.current, true)
    }

    function updateVisualState() {
      const bounds = stage.getBoundingClientRect()
      const maxScroll = Math.max(1, stage.offsetHeight - window.innerHeight)
      const progress = Math.max(0, Math.min(1, -bounds.top / maxScroll))

      if (isReducedMotionRef.current) {
        if (introVeil) {
          introVeil.style.opacity = '0'
          introVeil.style.pointerEvents = 'none'
        }
        if (blurVeil) blurVeil.style.opacity = '0'
        scene.style.opacity = progress >= 1 ? '0' : '1'
        scene.style.visibility = progress >= 1 ? 'hidden' : 'visible'
        root.style.setProperty('--menu-opacity', '1')
        targetFrameRef.current = 90
        currentFrameRef.current = 90
        drawFrame(90)
        return
      }

      // 1. Initial centered title & translucent veil clears as scrolling starts (0.00 -> 0.10)
      const introOpacity = Math.max(0, 1 - smoothStep(0.005, 0.10, progress))
      if (introVeil) {
        introVeil.style.opacity = introOpacity.toFixed(3)
        introVeil.style.pointerEvents = introOpacity > 0.15 ? 'auto' : 'none'
      }

      // 2. Frame scrubbing (0.00 -> 0.76 maps to frames 1 -> 158)
      const frameProgress = Math.max(0, Math.min(1, progress / 0.76))
      targetFrameRef.current = 1 + frameProgress * (TOTAL_FRAMES - 1)

      // 3. Last frame blurs & fades smoothly into the menu (0.74 -> 1.00)
      // Uses a fixed-radius backdrop-filter layer whose opacity animates (zero per-frame blur recomputation)
      const blurProgress = smoothStep(0.72, 0.94, progress)
      const fadeOutProgress = smoothStep(0.82, 0.99, progress)
      const menuFadeIn = smoothStep(0.75, 0.96, progress)

      if (blurVeil) {
        blurVeil.style.opacity = blurProgress.toFixed(3)
      }

      const sceneOpacity = 1 - fadeOutProgress
      scene.style.opacity = sceneOpacity.toFixed(3)
      scene.style.visibility = sceneOpacity <= 0.005 ? 'hidden' : 'visible'

      root.style.setProperty('--menu-opacity', menuFadeIn.toFixed(3))
    }

    function renderLoop() {
      const diff = targetFrameRef.current - currentFrameRef.current
      if (Math.abs(diff) > 0.05) {
        currentFrameRef.current += diff * 0.35
        drawFrame(currentFrameRef.current)
      } else if (Math.round(targetFrameRef.current) !== lastDrawnFrameRef.current) {
        currentFrameRef.current = targetFrameRef.current
        drawFrame(currentFrameRef.current)
      }
      animationFrameRef.current = window.requestAnimationFrame(renderLoop)
    }

    function onMotionChange(event) {
      isReducedMotionRef.current = event.matches
      updateVisualState()
    }

    resizeCanvas()
    updateVisualState()
    animationFrameRef.current = window.requestAnimationFrame(renderLoop)

    window.addEventListener('resize', resizeCanvas)
    window.addEventListener('scroll', updateVisualState, { passive: true })
    reducedMotionQuery.addEventListener('change', onMotionChange)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('scroll', updateVisualState)
      reducedMotionQuery.removeEventListener('change', onMotionChange)
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }
      root.style.removeProperty('--menu-opacity')
    }
  }, [])

  return (
    <section className="hero-stage" ref={stageRef} aria-labelledby="hero-title">
      <div className="hero-scene" ref={sceneRef}>
        <canvas className="hero-canvas" ref={canvasRef} />

        {/* Hardware-accelerated fixed-radius blur veil that blurs Frame 158 smoothly into the menu */}
        <div className="hero-blur-veil" ref={blurVeilRef} aria-hidden="true" />

        {/* Initial translucent veil + large centered hero title that clears as scrolling starts */}
        <div className="hero-intro-veil" ref={introVeilRef}>
          <div className="hero-center-content">
            <h1 className="hero-wordmark" id="hero-title">
              {bakeryName || 'Big Bakery'}
            </h1>
            <p className="hero-subline">
              {tagline || 'Freshly baked cakes for birthdays, celebrations, and everyday moments.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
