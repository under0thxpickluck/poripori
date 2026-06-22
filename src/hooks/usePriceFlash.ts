import { useEffect, useRef, useState } from 'react'

// 値が変化したら一瞬だけ緑(up)/赤(down)に光るクラス名を返す
export function usePriceFlash(value: number) {
  const prev = useRef(value)
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    if (value > prev.current) setFlash('up')
    else if (value < prev.current) setFlash('down')
    prev.current = value
    if (flash === null) return
    const t = setTimeout(() => setFlash(null), 650)
    return () => clearTimeout(t)
  }, [value, flash])

  return flash ? `flash-${flash}` : ''
}
