import { Landmark, Bitcoin, Trophy, Bot, Cpu, FlaskConical, Clapperboard, HelpCircle } from 'lucide-react'

type Props = { src?: string; category: string; className?: string }

const CAT_ICON: Record<string, typeof HelpCircle> = {
  Politics: Landmark,
  Crypto: Bitcoin,
  Sports: Trophy,
  AI: Bot,
  Tech: Cpu,
  Science: FlaskConical,
  Entertainment: Clapperboard,
}

const CAT_BG: Record<string, string> = {
  Politics: 'bg-blue-500/15 text-blue-400',
  Crypto: 'bg-orange-500/15 text-orange-400',
  Sports: 'bg-green-500/15 text-green-400',
  AI: 'bg-purple-500/15 text-purple-400',
  Tech: 'bg-cyan-500/15 text-cyan-400',
  Science: 'bg-sky-500/15 text-sky-400',
  Entertainment: 'bg-pink-500/15 text-pink-400',
}

export default function MarketImage({ src, category, className = '' }: Props) {
  if (src) {
    return <img src={src} alt="" className={`object-cover ${className}`} />
  }
  const Icon = CAT_ICON[category] ?? HelpCircle
  const bg = CAT_BG[category] ?? 'bg-surface-hover text-text-muted'
  return (
    <div className={`flex items-center justify-center ${bg} ${className}`}>
      <Icon size={28} />
    </div>
  )
}
