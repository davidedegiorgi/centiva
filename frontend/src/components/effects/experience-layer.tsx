import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { useEffect, useRef, useState } from 'react'
import 'lenis/dist/lenis.css'

gsap.registerPlugin(ScrollTrigger)

function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const lenis = new Lenis({ duration: 1.35, smoothWheel: true, wheelMultiplier: 0.82 })
    lenis.on('scroll', ScrollTrigger.update)
    const update = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)
    return () => { gsap.ticker.remove(update); lenis.destroy() }
  }, [])
  return null
}

function ContextCursor() {
  const cursor = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (!cursor.current || window.matchMedia('(pointer: coarse)').matches) return
    const moveX = gsap.quickTo(cursor.current, 'x', { duration: 0.55, ease: 'power4.out' })
    const moveY = gsap.quickTo(cursor.current, 'y', { duration: 0.55, ease: 'power4.out' })
    const move = (event: PointerEvent) => {
      moveX(event.clientX)
      moveY(event.clientY)
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-cursor-label]')
      setLabel(target?.dataset.cursorLabel ?? '')
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [])

  return <div ref={cursor} className={`museum-cursor ${label ? 'is-active' : ''}`} aria-hidden="true"><span>{label}</span></div>
}

export function ExperienceLayer() {
  return <>
    <SmoothScroll />
    <ContextCursor />
  </>
}
