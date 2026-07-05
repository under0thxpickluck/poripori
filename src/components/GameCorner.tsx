import { Link } from 'react-router-dom'
import { Dices, Cpu, ArrowRight } from 'lucide-react'
import { useT } from '../lib/i18n'

// ホームのゲームコーナー（Plinko / Mines の2枚カード）。
// 旧 PlinkoBanner を置き換えたもの。カードを増やすときはここに足す。
const GAMES = [
  {
    to: '/plinko',
    Icon: Dices,
    title: 'たまには運任せにしてみる？',
    desc: 'Plinko 🎲 賭けて、落として、当てるだけ',
    iconCls: 'bg-accent/20 text-accent',
    cardCls: 'border-accent/30 from-accent/15 hover:border-accent/60',
    arrowCls: 'text-accent',
  },
  {
    to: '/mines',
    Icon: Cpu,
    title: 'グリッドに潜むトラップを避けろ',
    desc: 'Mines 🕹 開けるほど倍率アップ、引き際はキミ次第',
    iconCls: 'bg-cyan-400/20 text-cyan-300',
    cardCls: 'border-cyan-400/30 from-cyan-400/15 hover:border-cyan-400/60',
    arrowCls: 'text-cyan-300',
  },
] as const

export default function GameCorner() {
  const t = useT()
  return (
    <div className="grid sm:grid-cols-2 gap-3 mb-6">
      {GAMES.map(({ to, Icon, title, desc, iconCls, cardCls, arrowCls }) => (
        <Link
          key={to}
          to={to}
          className={`relative block rounded-lg border bg-gradient-to-r via-surface to-surface transition-colors overflow-hidden group ${cardCls}`}
        >
          <span className="absolute top-3 right-3 text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-hover text-text-muted border border-border">
            PR
          </span>
          <div className="flex items-center gap-4 p-5">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${iconCls}`}>
              <Icon size={26} />
            </div>
            <div className="min-w-0 pr-6">
              <p className="text-sm font-bold text-text">{t(title)}</p>
              <p className="text-xs text-text-muted mt-0.5">{t(desc)}</p>
            </div>
            <ArrowRight size={18} className={`ml-auto shrink-0 group-hover:translate-x-1 transition-transform ${arrowCls}`} />
          </div>
        </Link>
      ))}
    </div>
  )
}
