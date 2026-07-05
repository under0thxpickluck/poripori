import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useStore, mapRpcError } from '../../store/useStore'
import { multiplierAt } from '../../lib/mines-math'
import { useT } from '../../lib/i18n'

// Mines のハウスエッジ（還元率）設定。抽選の分布は常に公正なまま、倍率の係数だけが変わる。
// 変更は進行中のゲームには影響しない（開始時に凍結される）。
export default function AdminMines() {
  const t = useT()
  const { currentUser } = useStore()
  const user = currentUser()
  const [edge, setEdge] = useState(95) // % 表示
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    const { data } = await supabase.from('mines_config').select('*').eq('id', 1).single()
    if (data) setEdge(Math.round(Number((data as { house_edge: number | string }).house_edge) * 100))
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.rpc('admin_mines_set_house_edge', { p_edge: edge / 100 })
    setSaving(false)
    if (error) {
      setMessage({ ok: false, text: mapRpcError(error.message) })
      return
    }
    setMessage({ ok: true, text: t('保存しました。以後に開始されるゲームへ適用されます（進行中のゲームは変わりません）') })
    load()
  }

  if (user?.role !== 'admin') {
    return <div className="text-center py-20 text-no">{t('管理者権限が必要です')}</div>
  }

  const previews = [
    { mines: 1, k: 5 },
    { mines: 3, k: 3 },
    { mines: 5, k: 5 },
    { mines: 10, k: 3 },
    { mines: 24, k: 1 },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text mb-1">{t('Mines設定')}</h1>
        <p className="text-text-muted text-sm">
          {t('還元率（ハウスエッジ）の変更。地雷の分布は常に公正なまま、倍率の係数だけが変わります')}
        </p>
      </div>

      <div className="bg-surface border border-border rounded-lg p-5 max-w-md space-y-4">
        <div>
          <label className="block text-xs text-text-muted mb-1">{t('還元率（%）: 10〜150')}</label>
          <input
            type="number"
            min={10}
            max={150}
            value={edge}
            onChange={(e) => setEdge(Number(e.target.value))}
            className="w-28 px-2.5 py-2 bg-surface-hover border border-border rounded-lg text-sm text-text outline-none"
          />
        </div>

        {edge > 100 && (
          <p className="flex items-center gap-1.5 text-xs text-no">
            <AlertTriangle size={13} /> {t('100%超はユーザーが期待値でプラスになります（プロモ用）')}
          </p>
        )}

        <div className="text-xs text-text-muted space-y-1">
          <p className="font-semibold text-text">{t('倍率プレビュー（罠m個・k枚開け）')}</p>
          {previews.map(({ mines, k }) => (
            <p key={`${mines}-${k}`} className="tabular-nums">
              {t('罠{m}・{k}枚', { m: mines, k })} → {multiplierAt(mines, k, edge / 100).toFixed(2)}x
            </p>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {saving ? t('保存中…') : t('保存')}
        </button>
        {message && (
          <p className={`flex items-center gap-1.5 text-xs ${message.ok ? 'text-yes' : 'text-no'}`}>
            {message.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
