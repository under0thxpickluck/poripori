import { useEffect, useState } from 'react'
import { useT } from '../lib/i18n'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// 締切までの残り時間を 日/時/分/秒 でカウントダウン。1時間を切ると赤く点滅
export default function Countdown({ deadline, className = '' }: { deadline: string; className?: string }) {
  const t = useT()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const diff = new Date(deadline).getTime() - now
  if (diff <= 0) {
    return <span className={`text-text-muted ${className}`}>{t('締切')}</span>
  }

  const s = Math.floor(diff / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const urgent = diff < 3600_000 // 1時間未満

  const text = d > 0 ? `${t('{n}日', { n: d })} ${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`

  return (
    <span className={`tabular-nums ${urgent ? 'text-no font-semibold animate-pulse' : ''} ${className}`}>
      {text}
    </span>
  )
}
