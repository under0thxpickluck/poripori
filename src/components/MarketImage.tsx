import { Megaphone } from 'lucide-react'

type Props = { src?: string; yes?: number; category?: string; className?: string }

// 画像のないマーケットでは、フェイクのチャートではなく
// 実際のYES確率（LMSR現在値）をそのまま可視化したゲージを表示する。
export default function MarketImage({ src, yes, category: _category, className = '' }: Props) {
  if (src) {
    return <img src={src} alt="" className={`object-cover ${className}`} />
  }

  // 画像なしの広告など、価格を持たない要素は中立タイル（フェイク価格は出さない）
  if (yes === undefined) {
    return (
      <div className={`flex items-center justify-center bg-surface-hover ${className}`}>
        <Megaphone className="text-text-muted/50" size={18} />
      </div>
    )
  }

  // 実データ: YES確率を 0–100% に丸め、下からYES(緑)・上にNO(赤)を実比率で塗る
  const pct = Math.round(Math.min(1, Math.max(0, yes)) * 100)

  return (
    <div className={`relative overflow-hidden bg-no/10 ${className}`}>
      {/* YES側（緑）を下から実数比率で塗る */}
      <div
        className="absolute inset-x-0 bottom-0 bg-yes/20 transition-[height] duration-500"
        style={{ height: `${pct}%` }}
      />
      {/* YES / NO の境界線 */}
      <div
        className="absolute inset-x-0 h-px bg-yes/50"
        style={{ bottom: `${pct}%` }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold leading-none text-yes drop-shadow-sm">{pct}%</span>
      </div>
    </div>
  )
}
