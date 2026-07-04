import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw, Landmark, Coins, Gift, X, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { IS_LOCAL } from '../lib/localClient'
import { useAuth } from '../store/useAuth'

type Transfer = {
  id: string
  direction: 'in' | 'out'
  ep_amount: number
  points_delta: number
  status: string
  created_at: string
}

const GROUP_LABEL: Record<string, string> = { '5000': 'LIFAIOV', aisalon: 'aisalon' }
const STATUS_LABEL: Record<string, string> = {
  completed: '完了',
  pending: '処理中',
  failed: '失敗（残高は変わっていません）',
  reversed: '取消済み（EPは返却済み）',
}
const MIN_EP = 1
const MAX_EP = 10000
const QUICK = [10, 100, 1000]

// EPウォレット: サロンEP⇄MR（MIRAIXポイント）の転送と履歴
export default function Wallet() {
  const { profile, loadProfile } = useAuth()
  const [params, setParams] = useSearchParams()
  const welcomeBonus = Number(params.get('welcome') ?? 0)
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [msgKind, setMsgKind] = useState<'ok' | 'error'>('ok')
  const [epBalance, setEpBalance] = useState<number | null>(null)
  const [history, setHistory] = useState<Transfer[]>([])
  const linked = Boolean(profile?.salon_login_id)

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('ep_transfers')
      .select('id, direction, ep_amount, points_delta, status, created_at')
      .order('created_at', { ascending: false })
      .limit(30)
    setHistory((data as Transfer[]) ?? [])
  }, [])

  // サロン側のEP残高を照会（読み取りのみ）
  const loadEpBalance = useCallback(async () => {
    const { data } = await supabase.functions.invoke('ep-transfer', {
      body: { direction: 'balance' },
    })
    if (data?.ok) setEpBalance(Number(data.ep_balance))
  }, [])

  useEffect(() => {
    if (IS_LOCAL || !linked) return
    loadHistory()
    loadEpBalance()
  }, [linked, loadHistory, loadEpBalance])

  if (IS_LOCAL) {
    return <p className="py-24 text-center text-sm text-text-muted">ローカルデモモードではEPウォレットは利用できません。</p>
  }
  if (!profile) {
    return <p className="py-24 text-center text-sm text-text-muted">サインインしてください。</p>
  }
  if (!linked) {
    return (
      <div className="py-24 text-center space-y-3 px-4">
        <p className="text-sm text-text-muted">
          サロン連携がありません。LIFAIOV / aisalon の LIFAI Arcade から「MIRAIX」を開いてください。
        </p>
        <Link to="/" className="inline-block text-sm text-accent hover:underline">ホームへ戻る</Link>
      </div>
    )
  }

  const ep = Number(amount)
  const amountOk = Number.isInteger(ep) && ep >= MIN_EP && ep <= MAX_EP
  // 特典ロック枠: この分はサロンEPへ出金不可（特典で増えた分・入金分は出金可）
  const locked = Math.max(0, Math.floor(Number(profile.bonus_locked ?? 0)))
  const withdrawable = Math.max(0, Math.floor(profile.points) - locked)

  const transfer = async () => {
    setMsg(null)
    if (!amountOk) {
      setMsgKind('error')
      setMsg(`${MIN_EP}〜${MAX_EP.toLocaleString()} の整数で入力してください。`)
      return
    }
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('ep-transfer', {
        body: { direction, amount: ep, idempotencyKey: crypto.randomUUID() },
      })
      if (error || !data?.ok) {
        const code = data?.error ?? error?.message ?? 'unknown'
        setMsgKind('error')
        setMsg(
          code === 'insufficient_ep' ? 'サロンのEP残高が不足しています。'
          : code === 'INSUFFICIENT_POINTS' ? 'MR（MIRAIXポイント）が不足しています。'
          : code === 'BONUS_LOCKED' ? '新規登録特典分のMRはサロンEPへ出金できません。出金可能額の範囲で入力してください。'
          : code === 'duplicate' ? '同じ転送が既に処理されています。残高を確認してください。'
          : `転送に失敗しました（${code}）。残高は履歴で確認できます。`,
        )
        return
      }
      setMsgKind('ok')
      setMsg(direction === 'in'
        ? `${ep.toLocaleString()} EP をMRに移しました。`
        : `${ep.toLocaleString()} EP をサロンへ戻しました。`)
      setAmount('')
      if (typeof data.ep_balance === 'number') setEpBalance(data.ep_balance)
    } finally {
      setBusy(false)
      await Promise.all([loadProfile(), loadHistory()])
    }
  }

  const salonName = GROUP_LABEL[profile.salon_group ?? ''] ?? profile.salon_group

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text mb-1">EPウォレット</h1>
        <p className="text-text-muted text-sm">
          連携元: {salonName}（ID: {profile.salon_login_id}）
        </p>
      </div>

      {/* 新規登録特典バナー（SSO初回作成時のみ表示） */}
      {welcomeBonus > 0 && (
        <div className="flex items-start gap-3 bg-accent/10 border border-accent/40 rounded-lg p-4">
          <Gift size={18} className="text-accent shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-text">
              新規登録特典として {welcomeBonus.toLocaleString()} MR をプレゼントしました🎉
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              期間限定キャンペーンです。MR（MIRAIXポイント）は予測やゲームにそのまま使えます。
              特典分はサロンEPへの出金には使えません（特典を使って増えた分は出金できます）。
            </p>
          </div>
          <button
            type="button"
            aria-label="閉じる"
            onClick={() => setParams({}, { replace: true })}
            className="text-text-muted hover:text-text transition-colors shrink-0"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* 外部サイト免責（サロン側の免責ゲートと同趣旨をMIRAIX側でも明記） */}
      <div className="flex items-start gap-2.5 bg-surface border border-border rounded-lg p-3.5 text-xs text-text-muted">
        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
        <p>
          MIRAIX は LIFAI（LIFAIOV / aisalon）とは関係のない外部サイトです。
          MIRAIXへ転送したEP・MIRAIX上で消費したMRを、LIFAI側で補填・返金することはできません。
        </p>
      </div>

      {/* 残高（サロンEP / MIRAIXポイント） */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 text-text-muted text-xs mb-1">
            <Landmark size={13} />
            <span>{salonName} のEP残高</span>
          </div>
          <p className="text-xl font-bold text-text">
            {epBalance === null ? '—' : epBalance.toLocaleString()}
            <span className="text-xs font-normal text-text-muted ml-1">EP</span>
          </p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center gap-1.5 text-text-muted text-xs mb-1">
            <Coins size={13} />
            <span>MR（MIRAIXポイント）</span>
          </div>
          <p className="text-xl font-bold text-text">
            {Math.floor(profile.points).toLocaleString()}
            <span className="text-xs font-normal text-text-muted ml-1">MR</span>
          </p>
          {locked > 0 && (
            <p className="text-[11px] text-text-muted mt-1">
              うち特典分 {locked.toLocaleString()} MR は出金不可（出金可能 {withdrawable.toLocaleString()} MR）
            </p>
          )}
        </div>
      </div>

      {/* 転送フォーム */}
      <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
        {/* 方向選択 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDirection('in')}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
              direction === 'in'
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border text-text-muted hover:text-text'
            }`}
          >
            <ArrowDownToLine size={15} />
            サロン → MIRAIX
          </button>
          <button
            type="button"
            onClick={() => setDirection('out')}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
              direction === 'out'
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border text-text-muted hover:text-text'
            }`}
          >
            <ArrowUpFromLine size={15} />
            MIRAIX → サロン
          </button>
        </div>
        <p className="text-xs text-text-muted">
          {direction === 'in'
            ? `${salonName} のEPをMRに移して予測やゲームに使えます（1 EP = 1 MR）。`
            : `MRを ${salonName} のEPに戻します（1 MR = 1 EP）。出金可能: ${withdrawable.toLocaleString()} MR${
                locked > 0 ? `（新規登録特典分 ${locked.toLocaleString()} MR は出金不可）` : ''
              }`}
        </p>

        {/* 金額 */}
        <div className="space-y-2">
          <input
            type="number"
            min={MIN_EP}
            max={MAX_EP}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`数量（${MIN_EP}〜${MAX_EP.toLocaleString()}）`}
            className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className="flex-1 py-1.5 rounded-md border border-border text-xs text-text-muted hover:text-text hover:border-accent/50 transition-colors"
              >
                {q.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={busy || !amountOk}
          onClick={transfer}
          className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
        >
          {busy
            ? '転送中…'
            : direction === 'in'
              ? `${amountOk ? `${ep.toLocaleString()} EP を` : ''}MIRAIXに移す`
              : `${amountOk ? `${ep.toLocaleString()} EP を` : ''}サロンに戻す`}
        </button>
        {msg && (
          <p className={`text-sm ${msgKind === 'ok' ? 'text-yes' : 'text-no'}`}>{msg}</p>
        )}
      </div>

      {/* 履歴 */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text">転送履歴</h2>
          <button
            type="button"
            onClick={() => { loadHistory(); loadEpBalance(); loadProfile() }}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text transition-colors"
          >
            <RefreshCw size={12} />
            更新
          </button>
        </div>
        <ul className="space-y-2 text-xs">
          {history.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-text font-medium">
                  {t.direction === 'in' ? 'サロン → MIRAIX' : 'MIRAIX → サロン'}　{Number(t.ep_amount).toLocaleString()} EP
                </p>
                <p className="text-text-muted">{new Date(t.created_at).toLocaleString('ja-JP')}</p>
              </div>
              <span className={`shrink-0 ${t.status === 'completed' ? 'text-yes' : t.status === 'pending' ? 'text-text-muted' : 'text-no'}`}>
                {STATUS_LABEL[t.status] ?? t.status}
              </span>
            </li>
          ))}
          {history.length === 0 && <li className="text-text-muted">まだ履歴がありません。</li>}
        </ul>
      </div>
    </div>
  )
}
