// Mines のゲーム状態・RPC 呼び出し・active ゲーム復元・履歴/統計。
// ロジックはすべてここに集約し、コンポーネントは表示だけを行う。
// 抽選・残高はサーバー（migrate-015 の RPC）権威。地雷位置は終局までクライアントに来ない。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/useAuth'
import { mapRpcError } from '../store/useStore'
import { multiplierAt, nextMultiplier, bustChance, GRID } from '../lib/mines-math'
import { playClick, playGem, playMultiplierUp, playCashout, playBust } from '../lib/sounds'
import { bustBuzz, cashoutBuzz, bigWinBuzz } from '../lib/haptics'

export type GameStatus = 'active' | 'busted' | 'cashed'

export type ActiveGame = {
  id: string
  bet: number
  minesCount: number
  houseEdge: number
  revealed: number[]
  multiplier: number
  status: GameStatus
  /** 終局時のみ（サーバーが公開した地雷位置） */
  mines: number[] | null
  payout: number | null
}

export type FinishedGame = {
  id: string
  bet: number
  mines_count: number
  multiplier: number
  payout: number
  status: GameStatus
  created_at: string
}

type GameRow = {
  id: string
  bet: number | string
  mines_count: number
  house_edge: number | string
  revealed: number[]
  multiplier: number | string
  status: GameStatus
  payout: number | string | null
  mines: number[] | null
  created_at: string
}

/** お祝い演出の段階。multiplier 到達 or Cash Out で発火 */
export type Celebration =
  | { kind: 'cashout'; payout: number; multiplier: number }
  | { kind: 'milestone'; multiplier: number }

function toActive(row: GameRow): ActiveGame {
  return {
    id: row.id,
    bet: Number(row.bet),
    minesCount: row.mines_count,
    houseEdge: Number(row.house_edge),
    revealed: row.revealed ?? [],
    multiplier: Number(row.multiplier),
    status: row.status,
    mines: row.mines,
    payout: row.payout == null ? null : Number(row.payout),
  }
}

export function useMinesGame() {
  const session = useAuth((s) => s.session)
  const profile = useAuth((s) => s.profile)
  const loadProfile = useAuth((s) => s.loadProfile)

  const [houseEdge, setHouseEdge] = useState(0.95)
  const [game, setGame] = useState<ActiveGame | null>(null)
  const [finished, setFinished] = useState<FinishedGame[]>([])
  const [busy, setBusy] = useState(false)
  const [pendingCell, setPendingCell] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [celebration, setCelebration] = useState<Celebration | null>(null)
  // 10x / 20x のマイルストーンは1ゲーム1回ずつ
  const milestonesFired = useRef<Set<number>>(new Set())

  const uid = session?.user?.id ?? null

  const loadAll = useCallback(async () => {
    const { data: cfg } = await supabase.from('mines_config').select('*').eq('id', 1).single()
    if (cfg) setHouseEdge(Number((cfg as { house_edge: number | string }).house_edge))
    if (!uid) return
    const { data } = await supabase
      .from('mines_games')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    const rows = (data as GameRow[] | null) ?? []
    const active = rows.find((r) => r.status === 'active')
    setGame(active ? toActive(active) : null)
    setFinished(
      rows
        .filter((r) => r.status !== 'active')
        .slice(0, 100)
        .map((r) => ({
          id: r.id,
          bet: Number(r.bet),
          mines_count: r.mines_count,
          multiplier: Number(r.multiplier),
          payout: Number(r.payout ?? 0),
          status: r.status,
          created_at: r.created_at,
        })),
    )
  }, [uid])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const start = useCallback(
    async (bet: number, minesCount: number) => {
      if (busy) return
      setError('')
      setBusy(true)
      playClick()
      try {
        const { data, error: err } = await supabase.rpc('mines_start', { p_bet: bet, p_mines: minesCount })
        if (err) {
          setError(mapRpcError(err.message))
          return
        }
        const g = data as { id: string; bet: number; mines_count: number; house_edge: number; balance: number }
        milestonesFired.current = new Set()
        setGame({
          id: g.id,
          bet: Number(g.bet),
          minesCount: g.mines_count,
          houseEdge: Number(g.house_edge),
          revealed: [],
          multiplier: 1,
          status: 'active',
          mines: null,
          payout: null,
        })
        await loadProfile()
      } finally {
        setBusy(false)
      }
    },
    [busy, loadProfile],
  )

  const reveal = useCallback(
    async (cell: number) => {
      if (!game || game.status !== 'active' || busy || game.revealed.includes(cell)) return
      setError('')
      setBusy(true)
      setPendingCell(cell)
      playClick()
      try {
        const { data, error: err } = await supabase.rpc('mines_reveal', { p_game: game.id, p_cell: cell })
        if (err) {
          setError(mapRpcError(err.message))
          return
        }
        const r = data as {
          safe: boolean
          status: GameStatus
          multiplier: number
          revealed: number[]
          payout?: number
          balance?: number
          mines?: number[]
        }
        if (!r.safe) {
          playBust()
          bustBuzz()
          setGame({ ...game, status: 'busted', mines: r.mines ?? null, payout: 0 })
          await Promise.all([loadProfile(), loadAll()])
          return
        }
        const k = r.revealed.length
        playGem(k)
        const mult = Number(r.multiplier)
        if (mult >= 2) playMultiplierUp()
        if (mult >= 5) bigWinBuzz()
        for (const milestone of [10, 20]) {
          if (mult >= milestone && !milestonesFired.current.has(milestone)) {
            milestonesFired.current.add(milestone)
            setCelebration({ kind: 'milestone', multiplier: mult })
          }
        }
        if (r.status === 'cashed') {
          // 全安全マス開放 → サーバー側で自動キャッシュアウト済み
          playCashout()
          cashoutBuzz()
          setGame({ ...game, revealed: r.revealed, multiplier: mult, status: 'cashed', mines: r.mines ?? null, payout: Number(r.payout ?? 0) })
          setCelebration({ kind: 'cashout', payout: Number(r.payout ?? 0), multiplier: mult })
          await Promise.all([loadProfile(), loadAll()])
          return
        }
        setGame({ ...game, revealed: r.revealed, multiplier: mult })
      } finally {
        setPendingCell(null)
        setBusy(false)
      }
    },
    [game, busy, loadProfile, loadAll],
  )

  const cashout = useCallback(async () => {
    if (!game || game.status !== 'active' || busy || game.revealed.length < 1) return
    setError('')
    setBusy(true)
    try {
      const { data, error: err } = await supabase.rpc('mines_cashout', { p_game: game.id })
      if (err) {
        setError(mapRpcError(err.message))
        return
      }
      const r = data as { payout: number; multiplier: number; mines: number[] }
      playCashout()
      cashoutBuzz()
      setGame({ ...game, status: 'cashed', mines: r.mines ?? null, payout: Number(r.payout) })
      setCelebration({ kind: 'cashout', payout: Number(r.payout), multiplier: Number(r.multiplier) })
      await Promise.all([loadProfile(), loadAll()])
    } finally {
      setBusy(false)
    }
  }, [game, busy, loadProfile, loadAll])

  const clearBoard = useCallback(() => {
    if (game && game.status !== 'active') setGame(null)
  }, [game])

  // 統計（直近100終局から導出）
  const stats = useMemo(() => {
    if (finished.length === 0) return { winRate: null as number | null, best: 0, streak: 0 }
    const wins = finished.filter((g) => g.status === 'cashed')
    let streak = 0
    for (const g of finished) {
      if (g.status === 'cashed') streak++
      else break
    }
    return {
      winRate: wins.length / finished.length,
      best: wins.reduce((m, g) => Math.max(m, g.multiplier), 0),
      streak,
    }
  }, [finished])

  // 表示用の派生値
  const derived = useMemo(() => {
    if (!game) return null
    const k = game.revealed.length
    return {
      k,
      current: k === 0 ? 1 : multiplierAt(game.minesCount, k, game.houseEdge),
      next: nextMultiplier(game.minesCount, k, game.houseEdge),
      bust: bustChance(game.minesCount, k),
      expected: Math.round(game.bet * game.multiplier * 100) / 100,
      safeLeft: GRID - game.minesCount - k,
    }
  }, [game])

  return {
    session, profile,
    houseEdge, game, finished, stats, derived,
    busy, pendingCell, error, celebration,
    start, reveal, cashout, clearBoard,
    dismissCelebration: () => setCelebration(null),
  }
}
