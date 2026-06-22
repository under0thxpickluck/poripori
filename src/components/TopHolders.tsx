import { useStore } from '../store/useStore'

function HolderColumn({
  title,
  color,
  rows,
}: {
  title: string
  color: string
  rows: { name: string; shares: number }[]
}) {
  return (
    <div className="flex-1">
      <h3 className={`text-xs font-semibold mb-2 ${color}`}>{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-text-muted py-2">保有者なし</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={r.name} className="flex items-center gap-2">
              <span className="text-xs text-text-muted w-4 shrink-0">{i + 1}</span>
              <div className="w-6 h-6 rounded-full bg-surface-hover flex items-center justify-center text-[10px] text-text shrink-0">
                {r.name.charAt(0)}
              </div>
              <span className="text-xs text-text flex-1 min-w-0 truncate">{r.name}</span>
              <span className="text-xs font-semibold text-text shrink-0">{Math.round(r.shares)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TopHolders({ marketId }: { marketId: string }) {
  const { positions, users } = useStore()
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? '不明'

  const market = positions.filter((p) => p.marketId === marketId)
  const yes = market
    .filter((p) => p.yesShares > 0)
    .map((p) => ({ name: name(p.userId), shares: p.yesShares }))
    .sort((a, b) => b.shares - a.shares)
    .slice(0, 5)
  const no = market
    .filter((p) => p.noShares > 0)
    .map((p) => ({ name: name(p.userId), shares: p.noShares }))
    .sort((a, b) => b.shares - a.shares)
    .slice(0, 5)

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <h2 className="text-sm font-semibold text-text mb-4">トップホルダー</h2>
      <div className="flex gap-6">
        <HolderColumn title="YES 保有" color="text-yes" rows={yes} />
        <div className="w-px bg-border" />
        <HolderColumn title="NO 保有" color="text-no" rows={no} />
      </div>
    </div>
  )
}
