import { useRef } from 'react'
import type React from 'react'

// マウス追従の3Dチルト＋スポットライト（CSS変数 --mx/--my を更新）
export function useTilt<T extends HTMLElement>(max = 8) {
  const ref = useRef<T>(null)

  function onMouseMove(e: React.MouseEvent) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.setProperty('--mx', `${px * 100}%`)
    el.style.setProperty('--my', `${py * 100}%`)
    el.style.transform = `perspective(900px) rotateX(${-(py - 0.5) * max}deg) rotateY(${(px - 0.5) * max}deg)`
  }

  function onMouseLeave() {
    const el = ref.current
    if (!el) return
    el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)'
  }

  return { ref, onMouseMove, onMouseLeave }
}
