import LiveSparkline from './LiveSparkline'

type Props = { src?: string; category: string; className?: string }

export default function MarketImage({ src, category: _category, className = '' }: Props) {
  if (src) {
    return <img src={src} alt="" className={`object-cover ${className}`} />
  }
  // 画像のないマーケットは、動く1分足チャート風のプレースホルダを表示
  return <LiveSparkline className={className} />
}
