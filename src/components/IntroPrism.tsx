import { useEffect, useRef, useState } from 'react'

const SEEN_KEY = 'pp-intro-seen'

// 初回アクセス時のイントロ：クリスタルの「MR」プリズムが加速回転し、
// 砕けて星屑になって消える（WebGL）。three.js は表示時のみ動的ロード。
export default function IntroPrism() {
  const [active, setActive] = useState(() => {
    if (typeof window === 'undefined') return false
    if (sessionStorage.getItem(SEEN_KEY)) return false
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    return true
  })
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    sessionStorage.setItem(SEEN_KEY, '1')
    let disposed = false
    let cleanup: (() => void) | undefined
    import('./introPrismScene').then(({ mountIntroScene }) => {
      if (disposed || !hostRef.current) return
      cleanup = mountIntroScene(hostRef.current, () => setActive(false))
    })
    return () => {
      disposed = true
      cleanup?.()
    }
  }, [active])

  if (!active) return null

  return (
    <div
      ref={hostRef}
      className="fixed inset-0 z-[100] cursor-pointer bg-[#04050a]"
      onClick={() => setActive(false)}
      aria-hidden
    />
  )
}
