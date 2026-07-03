import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStore, mapRpcError } from '../../store/useStore'
import { generateMultipliers, calcRTP, ROW_OPTIONS, GROWTH } from '../../lib/plinko-odds'

type ConfigRow = { rows_count: number; multipliers: number[]; updated_at: string }

// 8段⇔16段の線形補間で各段数の狙いRTPを出す
function targetRtp(rows: number, rtp8: number, rtp16: number): number {
  const t = (rows - ROW_OPTIONS[0]) / (ROW_OPTIONS[ROW_OPTIONS.length - 1] - ROW_OPTIONS[0])
  return rtp8 + (rtp16 - rtp8) * t
}

export default function AdminPlinko() {
  const { currentUser } = useStore()
  const user = currentUser()
  const [config, setConfig] = useState<ConfigRow[]>([])
  const [rtp8, setRtp8] = useState(95)
  const [rtp16, setRtp16] = useState(90)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    const { data } = await supabase
      .from('plinko_config')
      .select('rows_count, multipliers, updated_at')
      .order('rows_count')
    if (!data) return
    const rows = data.map((r) => ({ ...r, multipliers: (r.multipliers as (number | string)[]).map(Number) }))
    setConfig(rows)
    const lo = rows.find((r) => r.rows_count === ROW_OPTIONS[0])
    const hi = rows.find((r) => r.rows_count === ROW_OPTIONS[ROW_OPTIONS.length - 1])
    if (lo) setRtp8(Math.round(calcRTP(lo.rows_count, lo.multipliers) * 1000) / 10)
    if (hi) setRtp16(Math.round(calcRTP(hi.rows_count, hi.multipliers) * 1000) / 10)
  }

  useEffect(() => {
    load()
  }, [])

  const preview = useMemo(
    () =>
      ROW_OPTIONS.map((rows) => {
        const mult = generateMultipliers(rows, targetRtp(rows, rtp8, rtp16) / 100, GROWTH)
        return { rows, mult, rtp: calcRTP(rows, mult) }
      }),
    [rtp8, rtp16]
  )

  const hasOver100 = preview.some((p) => p.rtp > 1)

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    for (const p of preview) {
      const { error } = await supabase.rpc('admin_plinko_set_multipliers', {
        p_rows: p.rows,
        p_multipliers: p.mult,
      })
      if (error) {
        setMessage({ ok: false, text: `${p.rows}段の保存に失敗: ${mapRpcError(error.message)}` })
        setSaving(false)
        return
      }
    }
    setSaving(false)
    setMessage({ ok: true, text: '保存しました。以後のプレイに新しい還元率が適用されます' })
    load()
  }

  if (user?.role !== 'admin') {
    return <div className="text-center py-20 text-no">管理者権限が必要です</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text mb-1">Plinko設定</h1>
        <p className="text-text-muted text-sm">還元率(RTP)の変更。抽選の分布は常に公正な二項分布のまま、マスの倍率だけが変わります</p>
      </div>

      <div className="bg-surface border border-border rounded-lg p-5 mb-4">
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <label className="block text-xs text-text-muted mb-1">8段のRTP(%)</label>
            <input
              type="number"
              step={0.5}
              min={10}
              max={150}
              value={rtp8}
              onChange={(e) => setRtp8(Number(e.target.value))}
              className="w-28 px-2 py-2 bg-surface-hover border border-border rounded-lg text-sm text-text outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">16段のRTP(%)</label>
            <input
              type="number"
              step={0.5}
              min={10}
              max={150}
              value={rtp16}
              onChange={(e) => setRtp16(Number(e.target.value))}
              className="w-28 px-2 py-2 bg-surface-hover border border-border rounded-lg text-sm text-text outline-none"
            />
          </div>
          <p className="text-xs text-text-muted">間の段数(10/12/14)は線形補間されます</p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="ml-auto px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-bold transition-colors disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
        {hasOver100 && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-amber-400">
            <AlertTriangle size={15} /> RTPが100%を超えています。ポイントが増え続ける設定です(プロモ用)
          </p>
        )}
        {message && (
          <p className={`mt-3 flex items-center gap-1.5 text-sm ${message.ok ? 'text-yes' : 'text-no'}`}>
            {message.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {message.text}
          </p>
        )}
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-muted">
              <th className="text-left px-5 py-3 font-medium">段数</th>
              <th className="text-left px-4 py-3 font-medium">保存後の倍率テーブル(プレビュー)</th>
              <th className="text-right px-5 py-3 font-medium">実RTP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {preview.map((p) => (
              <tr key={p.rows}>
                <td className="px-5 py-3 font-semibold text-text">{p.rows}段</td>
                <td className="px-4 py-3 text-text-muted font-mono text-xs break-all">{p.mult.join(', ')}</td>
                <td className={`px-5 py-3 text-right font-semibold ${p.rtp > 1 ? 'text-amber-400' : 'text-text'}`}>
                  {(p.rtp * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {config.length > 0 && (
        <p className="mt-3 text-xs text-text-muted">
          現在の設定の最終更新: {new Date(Math.max(...config.map((c) => +new Date(c.updated_at)))).toLocaleString('ja-JP')}
        </p>
      )}
    </div>
  )
}
