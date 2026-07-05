# ポイント購入ハブ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/wallet`（EPウォレット）を「ポイント購入」ハブに再構成し、決済手段カード（BTC/USDT/MetaMask/クレカ＝整備中ダミー、LIFAI EP＝機能）を並べる。

**Architecture:** 単一ページ `Wallet.tsx` の JSX を再構成する。決済手段セレクター（`useState<'lifai' | null>`）を追加し、LIFAI EP を選んだときだけ既存の残高・転送フォーム・履歴を展開する。サロン連携ゲートを撤廃し、サインイン済みなら未連携でも表示（LIFAI選択時に連携案内）。導線（Navbar / Portfolio）をサインイン済み全員に「ポイント購入」で表示。バックエンドと転送ロジックは無変更。

**Tech Stack:** React 18 + TypeScript + Vite、Tailwind、lucide-react アイコン、自前軽量i18n（`src/lib/i18n.tsx`、日本語キー＋en/zh/ko/es/pt辞書）。

## Global Constraints

- 検証ゲートは `npm run build`（= `tsc && vite build`、型チェック＋ビルド成功）。ページのユニットテストは存在せず追加しない（RTL/jsdom未導入）。挙動確認は `npm run dev` で手動。
- 新規UI文字列はすべて `t('日本語原文')` 経由。日本語がi18nキー（`ja.ts` は存在しない）。翻訳は `src/locales/{en,zh,ko,es,pt}.ts` の `dict` に追加。未訳キーは日本語にフォールバックするため画面は壊れない。
- `supabase/functions/ep-transfer/index.ts`、転送/残高/resumeロジック、出金制限（bonus_locked / migrate-014 / migrate-016）、ルーティングパス `/wallet`、転送レートと入力上限（1〜10,000）は変更しない。
- BTC / USDT / MetaMask は固有名詞のため `t()` を通さず素の文字列で表示。「クレジットカード」「整備中」等は `t()` を通す。
- 既存の import・命名・Tailwind クラス流儀（`bg-surface border border-border rounded-lg` 等）に合わせる。

---

### Task 1: Wallet.tsx をポイント購入ハブへ再構成

**Files:**
- Modify (全面書き換え): `src/pages/Wallet.tsx`

**Interfaces:**
- Consumes: 既存 `useAuth`（`profile`, `loadProfile`）、`supabase`、`IS_LOCAL`、`useT`。既存関数 `transfer()` / `resume()` / `loadHistory` / `loadEpBalance` / `loadDailyQuota` はロジックそのまま流用。
- Produces: ルート `/wallet` のUI。外部から参照される export は `default function Wallet()` のみ（シグネチャ不変）。

- [ ] **Step 1: Wallet.tsx を新しい構成に置き換える**

`src/pages/Wallet.tsx` の全内容を以下に置き換える（ロジック部は既存のまま、JSXの構成と一部ガードのみ変更）:

```tsx
import { useCallback, useEffect, useState } from 'react'
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
    setMsg(null)
    if (!amountOk) {
      setMsgKind('error')
      setMsg(t('{min}〜{max} の整数で入力してください。', { min: MIN_EP, max: MAX_EP.toLocaleString() }))
      return
    }
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
      setBusy(false)
      await Promise.all([loadProfile(), loadHistory(), loadDailyQuota()])
    }
  }

  // 「処理中」で止まった転送の再開。サーバー/GAS側の冪等キー照合により
  // 実行済み分は duplicated 扱いになるだけで、二重減算・二重付与は起きない
  const resume = async (transferId: string) => {
    setMsg(null)
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
```

- [ ] **Step 2: 型チェック＋ビルドで検証**

Run: `npm run build`
Expected: PASS（`tsc` エラーなし、`vite build` 成功）。特に `Bitcoin` / `CircleDollarSign` / `CreditCard` / `Wallet as WalletIcon` / `Sparkles` / `ChevronDown` が lucide-react から解決されること。

- [ ] **Step 3: 手動確認（dev サーバー）**

Run: `npm run dev` して `/wallet` を開く。
Expected:
- ヘッダーが「ポイント購入」、現在のMR残高が表示される。
- BTC / USDT / MetaMask / クレジットカードの4カードが淡色＋「整備中」バッジで並び、クリックしても何も起きない（展開もエラーも遷移も無し）。
- 「LIFAI EP連携」を押すと下に詳細が展開。もう一度押すと閉じる。
  - 連携済みユーザー: 免責・残高2枚・転送フォーム・履歴が表示され、転送が従来どおり動く。
  - 未連携ユーザー: 「サロン連携がありません…」案内＋ホームへのリンク。

- [ ] **Step 4: コミット**

```bash
git add src/pages/Wallet.tsx
git commit -m "$(cat <<'EOF'
feat(wallet): /walletをポイント購入ハブ化(決済手段UI+LIFAI EP展開)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018fXPHUNVXMcXgTafH9aDCS
EOF
)"
```

---

### Task 2: 導線（Navbar / Portfolio）をサインイン済み全員に「ポイント購入」で表示

**Files:**
- Modify: `src/components/Navbar.tsx:76-87`
- Modify: `src/pages/Portfolio.tsx:145-161`

**Interfaces:**
- Consumes: Navbar 既存 `user`（`currentUser()`）。Portfolio 既存 `user`（`currentUser()`）。表示条件を `salonLinked` / `salonProfile?.salon_login_id` から `user` に変更。
- Produces: `/wallet` への導線（ラベル「ポイント購入」）。

- [ ] **Step 1: Navbar の EPウォレット導線を差し替え**

`src/components/Navbar.tsx` の該当ブロック（現状）:

```tsx
            {salonLinked && (
              <Link
                to="/wallet"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/wallet'
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-muted hover:text-text hover:bg-white/5'
                }`}
              >
                {t('EPウォレット')}
              </Link>
            )}
```

を次に置き換える（条件を `user` に、ラベルを「ポイント購入」に）:

```tsx
            {user && (
              <Link
                to="/wallet"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/wallet'
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-muted hover:text-text hover:bg-white/5'
                }`}
              >
                {t('ポイント購入')}
              </Link>
            )}
```

注: `salonLinked` は他で使われていなければ未使用変数になる。その場合 `const salonLinked = useAuth((s) => Boolean(s.profile?.salon_login_id))`（37行目）を削除して `tsc` の未使用エラーを避ける。他で使用されていれば残す。

- [ ] **Step 2: Portfolio の EPウォレット導線を差し替え**

`src/pages/Portfolio.tsx` の該当ブロック（現状）:

```tsx
      {/* EPウォレット導線（サロン連携ユーザーのみ。モバイルはここが入口） */}
      {salonProfile?.salon_login_id && (
        <Link
          to="/wallet"
          className="flex items-center justify-between bg-surface border border-border rounded-lg p-4 hover:border-accent/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0">
              <ArrowLeftRight size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">{t('EPウォレット')}</p>
              <p className="text-xs text-text-muted">{t('サロンEP ⇄ MIRAIXポイントの転送・履歴')}</p>
            </div>
          </div>
          <span className="text-xs text-accent font-medium shrink-0">{t('開く')} →</span>
        </Link>
      )}
```

を次に置き換える（条件を `user` に、文言を購入ハブ向けに更新）:

```tsx
      {/* ポイント購入導線（サインイン済み全員。モバイルはここが入口） */}
      {user && (
        <Link
          to="/wallet"
          className="flex items-center justify-between bg-surface border border-border rounded-lg p-4 hover:border-accent/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0">
              <ArrowLeftRight size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">{t('ポイント購入')}</p>
              <p className="text-xs text-text-muted">{t('暗号通貨・LIFAI EP連携でポイントを購入')}</p>
            </div>
          </div>
          <span className="text-xs text-accent font-medium shrink-0">{t('開く')} →</span>
        </Link>
      )}
```

注: この差し替え後 `salonProfile` が他で未使用なら、`const salonProfile = useAuth((s) => s.profile)`（24行目）を削除する。使用が残るなら残す。

- [ ] **Step 3: 型チェック＋ビルドで検証**

Run: `npm run build`
Expected: PASS。未使用変数（`salonLinked` / `salonProfile`）エラーが出たら Step 1/2 の注記どおり削除して再ビルド。

- [ ] **Step 4: 手動確認**

Run: `npm run dev`
Expected: サインイン済みなら未連携でも、PCヘッダーとポートフォリオ画面に「ポイント購入」導線が出て `/wallet` に遷移する。サインアウト状態では導線が出ない。

- [ ] **Step 5: コミット**

```bash
git add src/components/Navbar.tsx src/pages/Portfolio.tsx
git commit -m "$(cat <<'EOF'
feat(nav): ポイント購入導線をサインイン済み全員に表示

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018fXPHUNVXMcXgTafH9aDCS
EOF
)"
```

---

### Task 3: 新規i18nキーの翻訳を5辞書に追加

**Files:**
- Modify: `src/locales/en.ts`
- Modify: `src/locales/zh.ts`
- Modify: `src/locales/ko.ts`
- Modify: `src/locales/es.ts`
- Modify: `src/locales/pt.ts`

**Interfaces:**
- Consumes: Task 1/2 で導入した日本語キー。
- Produces: 各 `dict` に新規キーの訳を追加（未訳でも日本語フォールバックで壊れないが、EN標準に合わせ全訳を入れる）。

新規キー（Task 1/2 で追加された日本語原文）:
`ポイント購入` / `購入方法` / `整備中` / `クレジットカード` / `LIFAI EP連携` / `現在のMR残高: {n} MR` / `ローカルデモモードではLIFAI EP連携は利用できません。` / `暗号通貨・LIFAI EP連携でポイントを購入`

（`サロン連携がありません。…` `ホームへ戻る` `連携元` 等の再利用キーは既存辞書にあるため追加不要。Step 2 で確認する。）

- [ ] **Step 1: en.ts に追加**

`src/locales/en.ts` の `dict` 内（既存の Navbar セクション付近、`'EPウォレット': 'EP Wallet',` の直後など）に追記:

```ts
  'ポイント購入': 'Buy points',
  '購入方法': 'Payment method',
  '整備中': 'Coming soon',
  'クレジットカード': 'Credit card',
  'LIFAI EP連携': 'LIFAI EP',
  '現在のMR残高: {n} MR': 'Current MR balance: {n} MR',
  'ローカルデモモードではLIFAI EP連携は利用できません。': 'LIFAI EP is unavailable in local demo mode.',
  '暗号通貨・LIFAI EP連携でポイントを購入': 'Buy points with crypto or LIFAI EP',
```

- [ ] **Step 2: 再利用キーの存在確認**

Run: `git grep -n "'サロン連携がありません" src/locales/en.ts` および `git grep -n "'ホームへ戻る'" src/locales/en.ts`
Expected: どちらもヒットする（既存訳あり）。ヒットしなければ en.ts に相当訳を追加（`'ホームへ戻る': 'Back to home',` 等）。

- [ ] **Step 3: zh.ts に追加**

`src/locales/zh.ts` の `dict` に追記:

```ts
  'ポイント購入': '购买积分',
  '購入方法': '支付方式',
  '整備中': '筹备中',
  'クレジットカード': '信用卡',
  'LIFAI EP連携': 'LIFAI EP 关联',
  '現在のMR残高: {n} MR': '当前 MR 余额：{n} MR',
  'ローカルデモモードではLIFAI EP連携は利用できません。': '本地演示模式下无法使用 LIFAI EP 关联。',
  '暗号通貨・LIFAI EP連携でポイントを購入': '通过加密货币或 LIFAI EP 购买积分',
```

- [ ] **Step 4: ko.ts に追加**

`src/locales/ko.ts` の `dict` に追記:

```ts
  'ポイント購入': '포인트 구매',
  '購入方法': '결제 수단',
  '整備中': '준비 중',
  'クレジットカード': '신용카드',
  'LIFAI EP連携': 'LIFAI EP 연동',
  '現在のMR残高: {n} MR': '현재 MR 잔액: {n} MR',
  'ローカルデモモードではLIFAI EP連携は利用できません。': '로컬 데모 모드에서는 LIFAI EP 연동을 사용할 수 없습니다.',
  '暗号通貨・LIFAI EP連携でポイントを購入': '암호화폐 또는 LIFAI EP로 포인트 구매',
```

- [ ] **Step 5: es.ts に追加**

`src/locales/es.ts` の `dict` に追記:

```ts
  'ポイント購入': 'Comprar puntos',
  '購入方法': 'Método de pago',
  '整備中': 'Próximamente',
  'クレジットカード': 'Tarjeta de crédito',
  'LIFAI EP連携': 'LIFAI EP',
  '現在のMR残高: {n} MR': 'Saldo MR actual: {n} MR',
  'ローカルデモモードではLIFAI EP連携は利用できません。': 'LIFAI EP no está disponible en el modo demo local.',
  '暗号通貨・LIFAI EP連携でポイントを購入': 'Compra puntos con cripto o LIFAI EP',
```

- [ ] **Step 6: pt.ts に追加**

`src/locales/pt.ts` の `dict` に追記:

```ts
  'ポイント購入': 'Comprar pontos',
  '購入方法': 'Método de pagamento',
  '整備中': 'Em breve',
  'クレジットカード': 'Cartão de crédito',
  'LIFAI EP連携': 'LIFAI EP',
  '現在のMR残高: {n} MR': 'Saldo de MR atual: {n} MR',
  'ローカルデモモードではLIFAI EP連携は利用できません。': 'O LIFAI EP não está disponível no modo demo local.',
  '暗号通貨・LIFAI EP連携でポイントを購入': 'Compre pontos com cripto ou LIFAI EP',
```

- [ ] **Step 7: 型チェック＋ビルドで検証**

Run: `npm run build`
Expected: PASS（辞書は `Record<string, string>` なので型崩れなし）。

- [ ] **Step 8: 手動確認（言語切替）**

Run: `npm run dev` → 言語スイッチャーで en/zh/ko/es/pt に切替、`/wallet` を確認。
Expected: 「ポイント購入」「購入方法」「整備中」「クレジットカード」「LIFAI EP連携」等が各言語で表示される。日本語のままフォールバックしているキーが無いこと（意図した固有名詞 BTC/USDT/MetaMask を除く）。

- [ ] **Step 9: コミット**

```bash
git add src/locales/en.ts src/locales/zh.ts src/locales/ko.ts src/locales/es.ts src/locales/pt.ts
git commit -m "$(cat <<'EOF'
feat(i18n): ポイント購入ハブの文言を5言語に翻訳

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018fXPHUNVXMcXgTafH9aDCS
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- 決済手段5種（BTC/USDT/MetaMask/クレカ整備中＋LIFAI EP機能）→ Task 1 `PLACEHOLDER_METHODS` ＋ LIFAI ボタン。✓
- 整備中は押下無反応 → Task 1 のダミーカードは `<div>`（onClickなし）。✓
- LIFAI EP選択で展開 → Task 1 `method === 'lifai'` 分岐。✓
- ゲート撤廃（案B、未連携でも表示・LIFAI選択時に案内、IS_LOCAL表示） → Task 1 の3分岐。✓
- ヘッダー「ポイント購入」＋MR残高常時表示 → Task 1。✓
- 導線をサインイン済み全員に「ポイント購入」で表示 → Task 2。✓
- バックエンド・転送ロジック・出金制限・レート不変 → Task 1 はロジック未改変（JSX再構成のみ）。✓
- i18n（EN標準＋各言語） → Task 3。✓（※スペックは「ja」も列挙していたが `ja.ts` は存在せず日本語がキー。翻訳対象は en/zh/ko/es/pt の5辞書が正。）

**Placeholder scan:** プレースホルダ無し。全コード・全コマンド・全訳を明記。

**Type consistency:** `method` は `'lifai' | null` で一貫。`setMethod((prev) => …)` の更新関数、既存 `transfer`/`resume`/loaders のシグネチャは元コードのまま。import 名 `Wallet as WalletIcon` を JSX で `WalletIcon` として使用（衝突なし）。導線の表示条件は Task 2 で `user` に統一。

## Execution Handoff

省略（下記メッセージで案内）。
