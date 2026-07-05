import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowDownToLine, ArrowUpFromLine, RefreshCw, Landmark, Coins, Gift, X, AlertTriangle,
  Bitcoin, CircleDollarSign, CreditCard, Wallet as WalletIcon, Sparkles, ChevronDown,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { IS_LOCAL } from '../lib/localClient'
import { useAuth } from '../store/useAuth'
import { useT } from '../lib/i18n'

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

// 整備中の決済手段（押下無反応のダミー）。BTC/USDT/MetaMask は固有名詞なので t() を通さない
const PLACEHOLDER_METHODS = [
  { key: 'btc', label: 'BTC', translate: false, Icon: Bitcoin },
  { key: 'usdt', label: 'USDT', translate: false, Icon: CircleDollarSign },
  { key: 'metamask', label: 'MetaMask', translate: false, Icon: WalletIcon },
  { key: 'card', label: 'クレジットカード', translate: true, Icon: CreditCard },
] as const

// ポイント購入ハブ: 決済手段の一つとして LIFAI EP 連携（サロンEP⇄MR転送）を提供
export default function Wallet() {
  const t = useT()
  const { profile, loadProfile } = useAuth()
  const [params, setParams] = useSearchParams()
  const welcomeBonus = Number(params.get('welcome') ?? 0)
  const [method, setMethod] = useState<'lifai' | null>(null)
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  // 送信中フラグの同期版。busy(state) は再描画まで反映されないため、
  // 反映前の高速二連打で transfer()/resume() が二重に走る（別 idempotencyKey → 二重転送）のを塞ぐ
  const submittingRef = useRef(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [msgKind, setMsgKind] = useState<'ok' | 'error'>('ok')
  const [epBalance, setEpBalance] = useState<number | null>(null)
  const [history, setHistory] = useState<Transfer[]>([])
  // 出金の日次上限（migrate-014）。null = 未取得
  const [dailyLimit, setDailyLimit] = useState<number | null>(null)
  const [todayOut, setTodayOut] = useState(0)
  const linked = Boolean(profile?.salon_login_id)

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('ep_transfers')
      .select('id, direction, ep_amount, points_delta, status, created_at')
      .order('created_at', { ascending: false })
      .limit(30)
    setHistory((data as Transfer[]) ?? [])
  }, [])

  // 出金日次上限と当日消費分（JST基準。サーバー側 ep_begin_withdraw と同じ集計ルール）
  const loadDailyQuota = useCallback(async () => {
    const { data: cfg } = await supabase.from('ep_config').select('daily_withdraw_ep').eq('id', 1).maybeSingle()
    if (cfg) setDailyLimit(Number(cfg.daily_withdraw_ep))
    // JSTの当日0時をUTCに直して当日分の出金(pending/completed)を集計
    const now = new Date()
    const jstMidnightUtcMs = Math.floor((now.getTime() + 9 * 3600_000) / 86400_000) * 86400_000 - 9 * 3600_000
    const { data: outs } = await supabase
      .from('ep_transfers')
      .select('ep_amount, status')
      .eq('direction', 'out')
      .in('status', ['pending', 'completed'])
      .gte('created_at', new Date(jstMidnightUtcMs).toISOString())
    setTodayOut((outs ?? []).reduce((s, r) => s + Number(r.ep_amount), 0))
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
    loadDailyQuota()
  }, [linked, loadHistory, loadEpBalance, loadDailyQuota])

  if (!profile) {
    return <p className="py-24 text-center text-sm text-text-muted">{t('サインインしてください。')}</p>
  }

  const ep = Number(amount)
  const amountOk = Number.isInteger(ep) && ep >= MIN_EP && ep <= MAX_EP
  // 特典ロック枠: この分はサロンEPへ出金不可（特典で増えた分・入金分は出金可）
  const locked = Math.max(0, Math.floor(Number(profile.bonus_locked ?? 0)))
  const withdrawable = Math.max(0, Math.floor(profile.points) - locked)
  const salonName = GROUP_LABEL[profile.salon_group ?? ''] ?? profile.salon_group

  const transfer = async () => {
    if (submittingRef.current) return
    setMsg(null)
    if (!amountOk) {
      setMsgKind('error')
      setMsg(t('{min}〜{max} の整数で入力してください。', { min: MIN_EP, max: MAX_EP.toLocaleString() }))
      return
    }
    submittingRef.current = true
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('ep-transfer', {
        body: { direction, amount: ep, idempotencyKey: crypto.randomUUID() },
      })
      // 非2xx時は data が null になり、本文（{ok:false,error}）は error.context にある
      let result = data as { ok?: boolean; error?: string; ep_balance?: number } | null
      if (!result && error) {
        const ctx = (error as { context?: Response }).context
        if (ctx && typeof ctx.json === 'function') {
          result = await ctx.json().catch(() => null)
        }
      }
      if (error || !result?.ok) {
        const code = result?.error ?? error?.message ?? 'unknown'
        setMsgKind('error')
        setMsg(
          code === 'insufficient_ep' ? t('サロンのEP残高が不足しています。')
          : code === 'INSUFFICIENT_POINTS' ? t('MR（MIRAIXポイント）が不足しています。')
          : code === 'BONUS_LOCKED' ? t('新規登録特典分のMRはサロンEPへ出金できません。出金可能額の範囲で入力してください。')
          : code === 'duplicate' ? t('同じ転送が既に処理されています。残高を確認してください。')
          : code === 'DAILY_LIMIT' ? t('本日の出金上限に達しました。残り枠は明日（日本時間0時）リセットされます。')
          : code === 'REGION_BLOCKED' ? t('ご申告の居住国では本サービスをご利用いただけません。')
          : code === 'busy' ? t('サロン側が混み合っています。しばらく待ってから再度お試しください。')
          : code === 'gas_unreachable_pending' ? t('サロンとの通信が確認できませんでした。この転送は「処理中」として記録されています。残高に反映されない場合は運営にお問い合わせください（再送はしないでください）。')
          : code === 'credit_failed_revert_failed' ? t('転送に失敗し、EPの自動返却も確認できませんでした。運営にお問い合わせください。')
          : t('転送に失敗しました（{code}）。残高は履歴で確認できます。', { code }),
        )
        return
      }
      setMsgKind('ok')
      setMsg(direction === 'in'
        ? t('{n} EP をMRに移しました。', { n: ep.toLocaleString() })
        : t('{n} EP をサロンへ戻しました。', { n: ep.toLocaleString() }))
      setAmount('')
      if (typeof result.ep_balance === 'number') setEpBalance(result.ep_balance)
    } finally {
      submittingRef.current = false
      setBusy(false)
      await Promise.all([loadProfile(), loadHistory(), loadDailyQuota()])
    }
  }

  // 「処理中」で止まった転送の再開。サーバー/GAS側の冪等キー照合により
  // 実行済み分は duplicated 扱いになるだけで、二重減算・二重付与は起きない
  const resume = async (transferId: string) => {
    if (submittingRef.current) return
    setMsg(null)
    submittingRef.current = true
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('ep-transfer', {
        body: { direction: 'resume', transferId },
      })
      let result = data as { ok?: boolean; error?: string; ep_balance?: number } | null
      if (!result && error) {
        const ctx = (error as { context?: Response }).context
        if (ctx && typeof ctx.json === 'function') {
          result = await ctx.json().catch(() => null)
        }
      }
      if (error || !result?.ok) {
        const code = result?.error ?? error?.message ?? 'unknown'
        setMsgKind(code === 'not_pending' ? 'ok' : 'error')
        setMsg(
          code === 'not_pending' ? t('この転送は既に処理済みです。履歴を更新しました。')
          : code === 'resume_unsupported' ? t('この転送は自動再開できません。運営にお問い合わせください。')
          : code === 'gas_unreachable_pending' ? t('サロンとの通信がまだ確認できません。時間をおいて再度お試しください。')
          : code === 'insufficient_ep' ? t('サロンのEP残高が不足しているため、この転送は失敗として確定しました。')
          : t('再開に失敗しました（{code}）。', { code }),
        )
        return
      }
      setMsgKind('ok')
      setMsg(t('止まっていた転送を完了しました。'))
      if (typeof result.ep_balance === 'number') setEpBalance(result.ep_balance)
    } finally {
      submittingRef.current = false
      setBusy(false)
      await Promise.all([loadProfile(), loadHistory(), loadDailyQuota()])
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* ヘッダー: 現在のMR残高を常時表示 */}
      <div>
        <h1 className="text-2xl font-bold text-text mb-1">{t('ポイント購入')}</h1>
        <p className="text-text-muted text-sm">
          {t('現在のMR残高: {n} MR', { n: Math.floor(profile.points).toLocaleString() })}
        </p>
      </div>

      {/* 新規登録特典バナー（SSO初回作成時のみ表示） */}
      {welcomeBonus > 0 && (
        <div className="flex items-start gap-3 bg-accent/10 border border-accent/40 rounded-lg p-4">
          <Gift size={18} className="text-accent shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-text">
              {t('新規登録特典として {n} MR をプレゼントしました🎉', { n: welcomeBonus.toLocaleString() })}
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              {t('期間限定キャンペーンです。MR（MIRAIXポイント）は予測やゲームにそのまま使えます。特典分はサロンEPへの出金には使えません（特典を使って増えた分は出金できます）。')}
            </p>
          </div>
          <button
            type="button"
            aria-label={t('閉じる')}
            onClick={() => setParams({}, { replace: true })}
            className="text-text-muted hover:text-text transition-colors shrink-0"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* 購入方法セレクター */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-text">{t('購入方法')}</h2>

        {/* 整備中のダミー手段（押下無反応） */}
        {PLACEHOLDER_METHODS.map((m) => (
          <div
            key={m.key}
            aria-disabled="true"
            className="flex items-center justify-between bg-surface border border-border rounded-lg p-4 opacity-50 cursor-not-allowed select-none"
          >
            <div className="flex items-center gap-3">
              <m.Icon size={18} className="text-text-muted" />
              <span className="text-sm font-medium text-text">{m.translate ? t(m.label) : m.label}</span>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full border border-border text-text-muted">
              {t('整備中')}
            </span>
          </div>
        ))}

        {/* LIFAI EP連携（選択可能・展開トグル） */}
        <button
          type="button"
          onClick={() => setMethod((prev) => (prev === 'lifai' ? null : 'lifai'))}
          className={`w-full flex items-center justify-between rounded-lg p-4 border transition-colors ${
            method === 'lifai' ? 'border-accent bg-accent/10' : 'border-border bg-surface hover:border-accent/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <Sparkles size={18} className={method === 'lifai' ? 'text-accent' : 'text-text-muted'} />
            <span className="text-sm font-medium text-text">{t('LIFAI EP連携')}</span>
          </div>
          <ChevronDown
            size={16}
            className={`text-text-muted transition-transform ${method === 'lifai' ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* LIFAI EP を選択したときの詳細 */}
      {method === 'lifai' && (
        IS_LOCAL ? (
          <p className="py-6 text-center text-sm text-text-muted">
            {t('ローカルデモモードではLIFAI EP連携は利用できません。')}
          </p>
        ) : !linked ? (
          <div className="bg-surface border border-border rounded-lg p-5 text-center space-y-3">
            <p className="text-sm text-text-muted">
              {t('サロン連携がありません。LIFAIOV / aisalon の LIFAI Arcade から「MIRAIX」を開いてください。')}
            </p>
            <Link to="/" className="inline-block text-sm text-accent hover:underline">{t('ホームへ戻る')}</Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 連携元 */}
            <p className="text-text-muted text-sm">
              {t('連携元')}: {salonName}（ID: {profile.salon_login_id}）
            </p>

            {/* 外部サイト免責（サロン側の免責ゲートと同趣旨をMIRAIX側でも明記） */}
            <div className="flex items-start gap-2.5 bg-surface border border-border rounded-lg p-3.5 text-xs text-text-muted">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <p>
                {t('MIRAIX は LIFAI（LIFAIOV / aisalon）とは関係のない外部サイトです。MIRAIXへ転送したEP・MIRAIX上で消費したMRを、LIFAI側で補填・返金することはできません。')}
              </p>
            </div>

            {/* 残高（サロンEP / MIRAIXポイント） */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface border border-border rounded-lg p-4">
                <div className="flex items-center gap-1.5 text-text-muted text-xs mb-1">
                  <Landmark size={13} />
                  <span>{t('{s} のEP残高', { s: salonName ?? '' })}</span>
                </div>
                <p className="text-xl font-bold text-text">
                  {epBalance === null ? '—' : epBalance.toLocaleString()}
                  <span className="text-xs font-normal text-text-muted ml-1">EP</span>
                </p>
              </div>
              <div className="bg-surface border border-border rounded-lg p-4">
                <div className="flex items-center gap-1.5 text-text-muted text-xs mb-1">
                  <Coins size={13} />
                  <span>{t('MR（MIRAIXポイント）')}</span>
                </div>
                <p className="text-xl font-bold text-text">
                  {Math.floor(profile.points).toLocaleString()}
                  <span className="text-xs font-normal text-text-muted ml-1">MR</span>
                </p>
                {locked > 0 && (
                  <p className="text-[11px] text-text-muted mt-1">
                    {t('うち特典・ボーナス・ゲーム獲得分 {l} MR は出金不可（出金可能 {w} MR）', { l: locked.toLocaleString(), w: withdrawable.toLocaleString() })}
                  </p>
                )}
                <p className="text-[11px] text-text-muted mt-1">
                  {t('ゲーム（Mines・Plinko）で増えた分は出金対象外です（出金可能額に含まれません）。')}
                </p>
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
                  {t('サロン → MIRAIX')}
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
                  {t('MIRAIX → サロン')}
                </button>
              </div>
              <p className="text-xs text-text-muted">
                {direction === 'in'
                  ? t('{s} のEPをMRに移して予測やゲームに使えます（1 EP = 1 MR）。', { s: salonName ?? '' })
                  : `${t('MRを {s} のEPに戻します（1 MR = 1 EP）。出金可能: {w} MR', { s: salonName ?? '', w: withdrawable.toLocaleString() })}${
                      locked > 0 ? t('（特典・ボーナス分 {l} MR は出金不可）', { l: locked.toLocaleString() }) : ''
                    }${
                      dailyLimit != null
                        ? t('／本日の出金残り枠: {n} MR', { n: Math.max(0, dailyLimit - todayOut).toLocaleString() })
                        : ''
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
                  placeholder={t('数量（{min}〜{max}）', { min: MIN_EP, max: MAX_EP.toLocaleString() })}
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
                  ? t('転送中…')
                  : direction === 'in'
                    ? `${amountOk ? t('{n} EP を', { n: ep.toLocaleString() }) : ''}${t('MIRAIXに移す')}`
                    : `${amountOk ? t('{n} EP を', { n: ep.toLocaleString() }) : ''}${t('サロンに戻す')}`}
              </button>
              {msg && (
                <p className={`text-sm ${msgKind === 'ok' ? 'text-yes' : 'text-no'}`}>{msg}</p>
              )}
            </div>

            {/* 履歴 */}
            <div className="bg-surface border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-text">{t('転送履歴')}</h2>
                <button
                  type="button"
                  onClick={() => { loadHistory(); loadEpBalance(); loadProfile() }}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-text transition-colors"
                >
                  <RefreshCw size={12} />
                  {t('更新')}
                </button>
              </div>
              <ul className="space-y-2 text-xs">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-text font-medium">
                        {h.direction === 'in' ? t('サロン → MIRAIX') : t('MIRAIX → サロン')}　{Number(h.ep_amount).toLocaleString()} EP
                      </p>
                      <p className="text-text-muted">{new Date(h.created_at).toLocaleString()}</p>
                    </div>
                    <span className={`shrink-0 ${h.status === 'completed' ? 'text-yes' : h.status === 'pending' ? 'text-text-muted' : 'text-no'}`}>
                      {STATUS_LABEL[h.status] ? t(STATUS_LABEL[h.status]) : h.status}
                    </span>
                    {h.status === 'pending' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => resume(h.id)}
                        className="shrink-0 px-2 py-1 rounded-md border border-accent/50 text-accent hover:bg-accent/10 disabled:opacity-40 transition-colors"
                      >
                        {t('再開')}
                      </button>
                    )}
                  </li>
                ))}
                {history.length === 0 && <li className="text-text-muted">{t('まだ履歴がありません。')}</li>}
              </ul>
            </div>
          </div>
        )
      )}
    </div>
  )
}
