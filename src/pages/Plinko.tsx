import { useCallback, useEffect, useRef, useState } from 'react'
import { Dices, LogIn } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import { mapRpcError } from '../store/useStore'
import { createPlinkoEngine, type PlinkoEngine } from '../lib/plinko-engine'
import { calcRTP } from '../lib/plinko-odds'
import LoginModal from '../components/LoginModal'
import { useT } from '../lib/i18n'

type PlayResult = { bucket: number; multiplier: number; payout: number; balance: number }
type BallPayload = PlayResult & { bet: number }
type HistoryEntry = { multiplier: number; bet: number; payout: number }

const MIN_BET = 1
const MAX_BET = 10000
const HISTORY_LIMIT = 12

function clampBet(v: number): number {
  if (!Number.isFinite(v)) return MIN_BET
  return Math.min(MAX_BET, Math.max(MIN_BET, Math.round(v)))
}

export default function Plinko() {
  const t = useT()
  const session = useAuth((s) => s.session)
  const profile = useAuth((s) => s.profile)
  const loadProfile = useAuth((s) => s.loadProfile)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<PlinkoEngine | null>(null)
  const [config, setConfig] = useState<Record<number, number[]> | null>(null)
  const [rows, setRows] = useState(12)
  const [bet, setBet] = useState(10)
  const [balance, setBalance] = useState<number | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [error, setError] = useState('')
  const [dropping, setDropping] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  // 倍率テーブル(plinko_config)を取得。サーバーの配当計算と必ず一致する。
  useEffect(() => {
    supabase
      .from('plinko_config')
      .select('rows_count, multipliers')
      .then(({ data }) => {
        if (!data) return
        const map: Record<number, number[]> = {}
        for (const row of data) map[row.rows_count] = (row.multipliers as (number | string)[]).map(Number)
        setConfig(map)
      })
  }, [])

  // 飛行中の玉がないときだけ profile の残高と同期(飛行中はローカルで増減)
  useEffect(() => {
    if (profile && (engineRef.current?.ballsInFlight() ?? 0) === 0) {
      setBalance(profile.points)
    }
    if (!profile) setBalance(null)
  }, [profile])

  const handleLanded = useCallback(
    (r: { bucket: number; payload: unknown }) => {
      const res = r.payload as BallPayload | null
      if (!res) return
      setHistory((h) => [{ multiplier: res.multiplier, bet: res.bet, payout: res.payout }, ...h].slice(0, HISTORY_LIMIT))
      setBalance((b) => (b == null ? b : Math.round((b + res.payout) * 100) / 100))
      if ((engineRef.current?.ballsInFlight() ?? 0) === 0) loadProfile()
    },
    [loadProfile]
  )

  // 盤面(rows/config)が決まったらエンジンを生成。変更時は作り直す。
  useEffect(() => {
    const canvas = canvasRef.current
    const multipliers = config?.[rows]
    if (!canvas || !multipliers) return
    const engine = createPlinkoEngine(canvas, { rows, multipliers, onBallLanded: handleLanded })
    engineRef.current = engine
    const onResize = () => engine.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      engine.destroy()
      engineRef.current = null
    }
  }, [config, rows, handleLanded])

  async function handleDrop() {
    if (!session || dropping) return
    const b = clampBet(bet)
    setBet(b)
    setError('')
    setDropping(true)
    const { data, error } = await supabase.rpc('plinko_play', { p_bet: b, p_rows: rows })
    setDropping(false)
    if (error) {
      setError(mapRpcError(error.message))
      return
    }
    const res = data as PlayResult
    setBalance((x) => (x == null ? x : Math.round((x - b) * 100) / 100))
    engineRef.current?.drop(res.bucket, { ...res, bet: b } satisfies BallPayload)
  }

  const multipliers = config?.[rows]
  const rtp = multipliers ? calcRTP(rows, multipliers) : null

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent/20 text-accent flex items-center justify-center">
          <Dices size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">Plinko</h1>
          <p className="text-text-muted text-sm">
            {t('たまには運任せ。ポイントを賭けて玉を落とそう')}
            {rtp != null && <span className="ml-2">{t('還元率')} {(rtp * 100).toFixed(1)}%</span>}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-text-muted">{t('残高')}</p>
          <p className="text-lg font-bold text-text">
            {balance != null ? `${balance.toLocaleString()} pt` : '—'}
          </p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-3 mb-4">
        <canvas ref={canvasRef} className="w-full block" />
      </div>

      <div className="bg-surface border border-border rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">{t('ベット(pt)')}</label>
            <div className="flex gap-1">
              <input
                type="number"
                min={MIN_BET}
                max={MAX_BET}
                value={bet}
                onChange={(e) => setBet(Number(e.target.value))}
                onBlur={() => setBet(clampBet(bet))}
                className="w-24 px-2 py-2 bg-surface-hover border border-border rounded-lg text-sm text-text outline-none"
              />
              <button onClick={() => setBet(clampBet(bet / 2))} className="px-2 py-1 text-xs rounded-lg border border-border text-text-muted hover:text-text">1/2</button>
              <button onClick={() => setBet(clampBet(bet * 2))} className="px-2 py-1 text-xs rounded-lg border border-border text-text-muted hover:text-text">x2</button>
              <button onClick={() => setBet(clampBet(balance ?? MIN_BET))} className="px-2 py-1 text-xs rounded-lg border border-border text-text-muted hover:text-text">MAX</button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">{t('段数')}</label>
            <select
              value={rows}
              onChange={(e) => setRows(parseInt(e.target.value, 10))}
              className="px-2 py-2 bg-surface-hover border border-border rounded-lg text-sm text-text outline-none"
            >
              {config &&
                Object.keys(config)
                  .map(Number)
                  .sort((a, b) => a - b)
                  .map((r) => (
                    <option key={r} value={r}>
                      {t('{n} 段', { n: r })}
                    </option>
                  ))}
            </select>
          </div>
          {session ? (
            <button
              onClick={handleDrop}
              disabled={dropping || !config || balance == null || balance < MIN_BET}
              className="ml-auto px-8 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              DROP
            </button>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-bold transition-colors"
            >
              <LogIn size={15} /> {t('ログインして遊ぶ')}
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-no">{t(error)}</p>}
      </div>

      {history.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {history.map((h, i) => {
            const win = h.payout - h.bet >= 0
            return (
              <span
                key={i}
                className={`text-xs px-2 py-1 rounded-full border ${
                  win ? 'bg-yes/10 text-yes border-yes/30' : 'bg-no/10 text-no border-no/30'
                }`}
              >
                {h.multiplier >= 10 ? h.multiplier.toFixed(0) : h.multiplier.toFixed(h.multiplier < 1 ? 2 : 1)}x
              </span>
            )
          })}
        </div>
      )}

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  )
}
