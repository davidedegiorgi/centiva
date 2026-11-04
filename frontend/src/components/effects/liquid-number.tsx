import { useEffect, useRef, useState } from 'react'

interface LiquidNumberProps {
  value: string | number
  currency: string
  className?: string
}

export function LiquidNumber({ value, currency, className = '' }: LiquidNumberProps) {
  const numericValue = Number(value)
  const previous = useRef(0)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const frame = requestAnimationFrame(() => {
        setDisplay(numericValue)
        previous.current = numericValue
      })
      return () => cancelAnimationFrame(frame)
    }

    const start = previous.current
    const startedAt = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 1050)
      const eased = 1 - Math.pow(1 - progress, 4)
      setDisplay(start + (numericValue - start) * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
      else previous.current = numericValue
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [numericValue])

  return <span className={`liquid-number ${className}`} aria-label={new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(numericValue)}>
    {new Intl.NumberFormat('it-IT', { style: 'currency', currency, minimumFractionDigits: 2 }).format(display)}
  </span>
}
