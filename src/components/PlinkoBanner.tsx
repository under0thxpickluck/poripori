import { Link } from 'react-router-dom'
import { Dices, ArrowRight } from 'lucide-react'
import { useT } from '../lib/i18n'

export default function PlinkoBanner() {
  const t = useT()
  return (
    <Link
      to="/plinko"
      className="relative block mb-6 rounded-lg border border-accent/30 bg-gradient-to-r from-accent/15 via-surface to-surface hover:border-accent/60 transition-colors overflow-hidden group"
    >
      <span className="absolute top-3 right-3 text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-hover text-text-muted border border-border">
        PR
      </span>
      <div className="flex items-center gap-4 p-5">
        <div className="w-12 h-12 rounded-lg bg-accent/20 text-accent flex items-center justify-center shrink-0">
          <Dices size={26} />
        </div>
        <div className="min-w-0 pr-8">
          <p className="text-base font-bold text-text">{t('たまには運任せにしてみる？')}</p>
          <p className="text-xs text-text-muted mt-0.5">{t('Plinko でポイントを増やそう 🎲 賭けて、落として、当てるだけ')}</p>
        </div>
        <ArrowRight size={18} className="ml-auto text-accent shrink-0 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  )
}
