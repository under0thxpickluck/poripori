import { useEffect, useRef, useState } from 'react'

type Props = {
  value: number
  duration?: number
  format?: (n: number) => string
}

// 目標値まで数字をパラパラと加算するアニメーション
export default function CountUp({ value, duration = 900, format }: Props) {
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    const start = performance.now()
    let raf = 0
    function tick(now: number) {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(from + (value - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  const n = Math.round(display)
  return <>{format ? format(n) : n.toLocaleString()}</>
}
