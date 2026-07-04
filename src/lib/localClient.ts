// ============================================================================
// ローカルデモ用バックエンド（VITE_LOCAL_MODE=1 のとき有効）
// ----------------------------------------------------------------------------
// Supabase クライアントと同じ表面（.from(), .rpc(), .auth, .channel()）を実装し、
// すべて localStorage 上で完結させる。LMSR の計算は src/lib/lmsr.ts を再利用。
// これにより本番コード（store / components / realtime）は一切変更せずに、
// メール認証なしで「投稿・投票・解決」をローカルで試せる。
// ============================================================================
import { costFn, currentPrice } from './lmsr'
import { calcRTP, generateMultipliers, GROWTH, ROW_OPTIONS } from './plinko-odds'

export const IS_LOCAL = import.meta.env.VITE_LOCAL_MODE === '1'

// --- 型（DB のカラム名 = snake_case に合わせる。store の mapXxx がそのまま使える）---
type Profile = {
  id: string
  name: string
  points: number
  xp: number
  role: 'user' | 'admin'
  last_bonus: string | null
  bonus_streak: number
  created_at: string
  // サロン連携（ローカルモードでは常に未連携）
  salon_group: string | null
  salon_login_id: string | null
}
type Market = {
  id: string
  question: string
  description: string
  deadline: string
  status: 'pending' | 'open' | 'closed' | 'resolved'
  q_yes: number
  q_no: number
  b: number
  resolved: 'YES' | 'NO' | null
  created_by: string
  category: string
  volume: number
  image_url: string | null
  extended_count: number
  last_extended_at: string | null
  created_at: string
}
type Position = { user_id: string; market_id: string; yes_shares: number; no_shares: number }
type Trade = {
  id: string
  user_id: string
  market_id: string
  side: 'YES' | 'NO'
  action: 'buy' | 'sell'
  shares: number
  cost: number
  price_per_share: number
  created_at: string
}
type PricePoint = { id: number; market_id: string; t: string; yes: number }
type Comment = { id: string; market_id: string; user_id: string; body: string; created_at: string }
type Ad = { id: string; title: string; image_url: string; link_url: string; active: boolean; created_at: string }
type PlinkoConfig = {
  rows_count: number
  multipliers: number[]
  updated_at: string
  updated_by: string | null
}
type PlinkoPlay = {
  id: string
  user_id: string
  bet: number
  rows_count: number
  bucket: number
  multiplier: number
  payout: number
  created_at: string
}

type DB = {
  profiles: Profile[]
  markets: Market[]
  positions: Position[]
  trades: Trade[]
  price_history: PricePoint[]
  comments: Comment[]
  ads: Ad[]
  plinko_config: PlinkoConfig[]
  plinko_plays: PlinkoPlay[]
}

// --- 固定 ID（seed ユーザー）---
export const ADMIN_ID = '00000000-0000-4000-8000-000000000001'
export const AYANO_ID = '00000000-0000-4000-8000-000000000002'

const STORAGE_KEY = 'miraix_local_db_v1'
const CURRENT_KEY = 'miraix_local_current_user'

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)

const nowIso = () => new Date().toISOString()
const daysFromNow = (d: number) => new Date(Date.now() + d * 86400000).toISOString()

function seed(): DB {
  const profiles: Profile[] = [
    {
      id: ADMIN_ID,
      name: 'Admin',
      points: 100000,
      xp: 5000,
      role: 'admin',
      last_bonus: null,
      bonus_streak: 0,
      created_at: nowIso(),
      salon_group: null,
      salon_login_id: null,
    },
    {
      id: AYANO_ID,
      name: 'ayanoniconico1128',
      points: 5000,
      xp: 1200,
      role: 'user',
      last_bonus: null,
      bonus_streak: 0,
      created_at: nowIso(),
      salon_group: null,
      salon_login_id: null,
    },
  ]

  const mk = (
    question: string,
    description: string,
    category: string,
    days: number
  ): Market => ({
    id: uid(),
    question,
    description,
    deadline: daysFromNow(days),
    status: 'open',
    q_yes: 0,
    q_no: 0,
    b: 100,
    resolved: null,
    created_by: ADMIN_ID,
    category,
    volume: 0,
    image_url: null,
    extended_count: 0,
    last_extended_at: null,
    created_at: nowIso(),
  })

  const markets: Market[] = [
    mk('2026年末までにビットコインは20万ドルを超える？', '対象は主要取引所の現物終値。', 'Crypto', 187),
    mk('次の国政選挙で与党は過半数を維持する？', '公示日時点の議席数で判定。', 'Politics', 126),
    mk('AGI（汎用人工知能）は2030年までに実現すると主要AI研究者が宣言する？', '主要ラボの公式発表を基準とする。', 'AI', 1280),
  ]

  const price_history: PricePoint[] = markets.map((m, i) => ({
    id: i + 1,
    market_id: m.id,
    t: m.created_at,
    yes: currentPrice(m.q_yes, m.q_no, m.b).yes,
  }))

  // migrate-011 の既定値と同じ生成則(8段95%⇔16段90%の線形補間)
  const plinko_config: PlinkoConfig[] = ROW_OPTIONS.map((rows) => {
    const t = (rows - ROW_OPTIONS[0]) / (ROW_OPTIONS[ROW_OPTIONS.length - 1] - ROW_OPTIONS[0])
    return {
      rows_count: rows,
      multipliers: generateMultipliers(rows, 0.95 + (0.9 - 0.95) * t, GROWTH),
      updated_at: nowIso(),
      updated_by: null,
    }
  })

  return {
    profiles,
    markets,
    positions: [],
    trades: [],
    price_history,
    comments: [],
    ads: [],
    plinko_config,
    plinko_plays: [],
  }
}

// --- 永続化 ---
function load(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      // 保存済みデータに後から追加されたテーブルが無いことがあるので seed から補う
      const parsed = JSON.parse(raw) as Partial<DB>
      const base = seed()
      const merged = { ...base, ...parsed } as DB
      for (const k of Object.keys(base) as Array<keyof DB>) {
        if (!Array.isArray(merged[k])) (merged as Record<string, unknown>)[k] = base[k]
      }
      return merged
    }
  } catch {
    /* ignore */
  }
  const fresh = seed()
  save(fresh)
  return fresh
}
function save(d: DB) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d))
  } catch {
    /* ignore */
  }
}

const db: DB = IS_LOCAL ? load() : seed()
let priceSeq = db.price_history.reduce((m, p) => Math.max(m, p.id), 0)

// --- 現在ユーザー（= auth.uid 相当）---
let currentUserId: string | null =
  (IS_LOCAL && typeof localStorage !== 'undefined' && localStorage.getItem(CURRENT_KEY)) || ADMIN_ID
function persistCurrent() {
  try {
    if (currentUserId) localStorage.setItem(CURRENT_KEY, currentUserId)
    else localStorage.removeItem(CURRENT_KEY)
  } catch {
    /* ignore */
  }
}

// ============================================================================
// Realtime（最小実装）: postgres_changes を購読し、ローカル変更を配信する
// ============================================================================
type Sub = {
  table: string
  event: string
  filter?: { col: string; val: string }
  cb: (payload: { new: Record<string, unknown>; eventType: string }) => void
}
let subs: Sub[] = []

function parseFilter(f?: string): { col: string; val: string } | undefined {
  if (!f) return undefined
  const m = f.match(/^(\w+)=eq\.(.+)$/)
  return m ? { col: m[1], val: m[2] } : undefined
}

function emit(table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', row: Record<string, unknown>) {
  for (const s of subs) {
    if (s.table !== table) continue
    if (s.event !== '*' && s.event !== eventType) continue
    if (s.filter && String(row[s.filter.col]) !== s.filter.val) continue
    try {
      s.cb({ new: row, eventType })
    } catch {
      /* ignore */
    }
  }
}

// ============================================================================
// auth（メール認証なし・即ログイン）
// ============================================================================
type Session = { user: { id: string; email: string }; access_token: string } | null
const authListeners: Array<(event: string, session: Session) => void> = []

function emailFor(id: string): string {
  const p = db.profiles.find((x) => x.id === id)
  return (p?.name ?? 'user') + '@local'
}
function sessionFor(id: string | null): Session {
  return id ? { user: { id, email: emailFor(id) }, access_token: 'local-demo' } : null
}
function fireAuth(event: string) {
  const s = sessionFor(currentUserId)
  authListeners.forEach((cb) => cb(event, s))
}

const auth = {
  getSession: async () => ({ data: { session: sessionFor(currentUserId) }, error: null }),
  onAuthStateChange: (cb: (event: string, session: Session) => void) => {
    authListeners.push(cb)
    return {
      data: {
        subscription: {
          unsubscribe() {
            const i = authListeners.indexOf(cb)
            if (i >= 0) authListeners.splice(i, 1)
          },
        },
      },
    }
  },
  signInWithOtp: async () => ({ data: { user: null, session: null }, error: null }),
  signOut: async () => {
    currentUserId = null
    persistCurrent()
    fireAuth('SIGNED_OUT')
    return { error: null }
  },
}

// 外部（DevAccountSwitcher）から使うヘルパ
export function switchLocalUser(id: string) {
  currentUserId = id
  persistCurrent()
  fireAuth('SIGNED_IN')
}
export function getLocalUsers() {
  return db.profiles.map((p) => ({ id: p.id, name: p.name, role: p.role }))
}
export function getCurrentLocalUserId() {
  return currentUserId
}
export function resetLocalDb() {
  const fresh = seed()
  ;(Object.keys(fresh) as Array<keyof DB>).forEach((k) => {
    // 参照を保ったまま中身を入れ替える
    ;(db[k] as unknown[]).length = 0
    ;(db[k] as unknown[]).push(...(fresh[k] as unknown[]))
  })
  priceSeq = db.price_history.reduce((m, p) => Math.max(m, p.id), 0)
  save(db)
  currentUserId = ADMIN_ID
  persistCurrent()
  fireAuth('SIGNED_IN')
}

// ============================================================================
// クエリビルダ（.from(table).select()/.insert()/.update()/.delete()）
// ============================================================================
type Result = { data: unknown; error: { message: string } | null }

class Query implements PromiseLike<Result> {
  private filters: Array<[string, unknown]> = []
  private orderBy: { col: string; asc: boolean } | null = null
  private isSingle = false

  constructor(
    private table: keyof DB,
    private op: 'select' | 'insert' | 'update' | 'delete',
    private payload?: unknown
  ) {}

  select(_cols?: string) {
    this.op = 'select'
    return this
  }
  eq(col: string, val: unknown) {
    this.filters.push([col, val])
    return this
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, asc: opts?.ascending !== false }
    return this
  }
  single() {
    this.isSingle = true
    return this
  }

  private rows(): Record<string, unknown>[] {
    return db[this.table] as unknown as Record<string, unknown>[]
  }
  private match(r: Record<string, unknown>) {
    return this.filters.every(([c, v]) => r[c] === v)
  }

  private run(): Result {
    try {
      switch (this.op) {
        case 'select': {
          let out = this.rows().filter((r) => this.match(r))
          if (this.orderBy) {
            const { col, asc } = this.orderBy
            out = [...out].sort((a, b) => {
              const av = a[col] as never
              const bv = b[col] as never
              return (av < bv ? -1 : av > bv ? 1 : 0) * (asc ? 1 : -1)
            })
          }
          return { data: this.isSingle ? out[0] ?? null : out, error: null }
        }
        case 'insert': {
          const list = Array.isArray(this.payload) ? this.payload : [this.payload]
          const inserted: Record<string, unknown>[] = []
          for (const raw of list as Record<string, unknown>[]) {
            const row = this.withDefaults({ ...raw })
            this.rows().push(row)
            inserted.push(row)
            emit(this.table, 'INSERT', row)
            if (this.table === 'markets' && row.status === 'open') this.seedPrice(row)
          }
          save(db)
          return { data: inserted, error: null }
        }
        case 'update': {
          const patch = this.payload as Record<string, unknown>
          for (const r of this.rows()) {
            if (!this.match(r)) continue
            const wasOpen = r.status === 'open'
            Object.assign(r, patch)
            emit(this.table, 'UPDATE', r)
            if (this.table === 'markets' && !wasOpen && r.status === 'open') this.seedPrice(r)
          }
          save(db)
          return { data: null, error: null }
        }
        case 'delete': {
          const arr = this.rows()
          const keep: Record<string, unknown>[] = []
          for (const r of arr) {
            if (this.match(r)) emit(this.table, 'DELETE', r)
            else keep.push(r)
          }
          arr.length = 0
          arr.push(...keep)
          save(db)
          return { data: null, error: null }
        }
      }
    } catch (e) {
      return { data: null, error: { message: (e as Error).message ?? String(e) } }
    }
  }

  private withDefaults(row: Record<string, unknown>): Record<string, unknown> {
    if (row.id == null && this.table !== 'price_history') row.id = uid()
    if (row.created_at == null && this.table !== 'price_history' && this.table !== 'positions')
      row.created_at = nowIso()
    if (this.table === 'markets') {
      row.q_yes ??= 0
      row.q_no ??= 0
      row.volume ??= 0
      row.resolved ??= null
      row.b ??= 100
    }
    return row
  }

  private seedPrice(m: Record<string, unknown>) {
    const point: PricePoint = {
      id: ++priceSeq,
      market_id: m.id as string,
      t: nowIso(),
      yes: currentPrice(Number(m.q_yes), Number(m.q_no), Number(m.b)).yes,
    }
    db.price_history.push(point)
    emit('price_history', 'INSERT', point as unknown as Record<string, unknown>)
  }

  // PromiseLike: await / .then() で実行される
  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    _onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, _onrejected)
  }
}

function from(table: keyof DB) {
  return {
    select: (cols?: string) => new Query(table, 'select', cols),
    insert: (rows: unknown) => new Query(table, 'insert', rows),
    update: (patch: unknown) => new Query(table, 'update', patch),
    delete: () => new Query(table, 'delete'),
  }
}

// ============================================================================
// RPC（サーバ権威の操作を再現。lmsr.ts と schema.sql のロジックに準拠）
// ============================================================================
function profile(id: string) {
  return db.profiles.find((p) => p.id === id)
}
function requireAuth(): string {
  if (!currentUserId) throw new Error('AUTH_REQUIRED')
  return currentUserId
}
function requireAdmin() {
  const me = profile(requireAuth())
  if (!me || me.role !== 'admin') throw new Error('ADMIN_REQUIRED')
}

async function rpc(name: string, params: Record<string, unknown>): Promise<Result> {
  try {
    switch (name) {
      case 'buy_shares':
        return { data: tradeShares('buy', params), error: null }
      case 'sell_shares':
        return { data: tradeShares('sell', params), error: null }
      case 'resolve_market':
        resolveMarket(params.p_market_id as string, params.p_result as 'YES' | 'NO')
        return { data: null, error: null }
      case 'extend_market':
        extendMarket(params.p_market_id as string, params.p_new_deadline as string)
        return { data: null, error: null }
      case 'admin_add_points':
        requireAdmin()
        adminAddPoints(params.p_user as string, Number(params.p_amount))
        return { data: null, error: null }
      case 'admin_set_role':
        requireAdmin()
        adminSetRole(params.p_user as string, params.p_role as 'user' | 'admin')
        return { data: null, error: null }
      case 'claim_daily_bonus':
        return { data: claimDailyBonus(), error: null }
      case 'plinko_play':
        return { data: plinkoPlay(params), error: null }
      case 'admin_plinko_set_multipliers':
        adminPlinkoSetMultipliers(params)
        return { data: null, error: null }
      default:
        return { data: null, error: { message: 'UNKNOWN_RPC:' + name } }
    }
  } catch (e) {
    return { data: null, error: { message: (e as Error).message ?? String(e) } }
  }
}

function tradeShares(action: 'buy' | 'sell', params: Record<string, unknown>): number {
  const me = requireAuth()
  const marketId = params.p_market_id as string
  const side = params.p_side as 'YES' | 'NO'
  const shares = Number(params.p_shares)
  if (side !== 'YES' && side !== 'NO') throw new Error('BAD_SIDE')
  if (!(shares > 0)) throw new Error('BAD_SHARES')

  const m = db.markets.find((x) => x.id === marketId)
  if (!m) throw new Error('MARKET_NOT_FOUND')
  if (m.status !== 'open') throw new Error('MARKET_NOT_OPEN')
  if (Date.now() >= new Date(m.deadline).getTime()) throw new Error('MARKET_CLOSED')

  const p = profile(me)!
  let pos = db.positions.find((x) => x.user_id === me && x.market_id === marketId)

  const newQYes = m.q_yes + (action === 'buy' && side === 'YES' ? shares : action === 'sell' && side === 'YES' ? -shares : 0)
  const newQNo = m.q_no + (action === 'buy' && side === 'NO' ? shares : action === 'sell' && side === 'NO' ? -shares : 0)

  let delta: number // buy=cost(支払), sell=refund(受取)
  if (action === 'buy') {
    delta = costFn(newQYes, newQNo, m.b) - costFn(m.q_yes, m.q_no, m.b)
    if (p.points < delta) throw new Error('INSUFFICIENT_POINTS')
    p.points -= delta
    p.xp += delta
  } else {
    const held = side === 'YES' ? pos?.yes_shares ?? 0 : pos?.no_shares ?? 0
    if (held < shares) throw new Error('INSUFFICIENT_SHARES')
    delta = costFn(m.q_yes, m.q_no, m.b) - costFn(newQYes, newQNo, m.b)
    p.points += delta // 売却では XP を加算しない
  }

  m.q_yes = newQYes
  m.q_no = newQNo
  m.volume += delta

  if (!pos) {
    pos = { user_id: me, market_id: marketId, yes_shares: 0, no_shares: 0 }
    db.positions.push(pos)
  }
  const sign = action === 'buy' ? 1 : -1
  if (side === 'YES') pos.yes_shares += sign * shares
  else pos.no_shares += sign * shares

  const trade: Trade = {
    id: uid(),
    user_id: me,
    market_id: marketId,
    side,
    action,
    shares,
    cost: delta,
    price_per_share: shares > 0 ? delta / shares : 0,
    created_at: nowIso(),
  }
  db.trades.push(trade)

  const point: PricePoint = {
    id: ++priceSeq,
    market_id: marketId,
    t: nowIso(),
    yes: currentPrice(newQYes, newQNo, m.b).yes,
  }
  db.price_history.push(point)

  save(db)
  emit('profiles', 'UPDATE', p as unknown as Record<string, unknown>)
  emit('markets', 'UPDATE', m as unknown as Record<string, unknown>)
  emit('positions', 'UPDATE', pos as unknown as Record<string, unknown>)
  emit('trades', 'INSERT', trade as unknown as Record<string, unknown>)
  emit('price_history', 'INSERT', point as unknown as Record<string, unknown>)
  return delta
}

function resolveMarket(marketId: string, result: 'YES' | 'NO') {
  requireAdmin()
  if (result !== 'YES' && result !== 'NO') throw new Error('BAD_RESULT')
  const m = db.markets.find((x) => x.id === marketId)
  if (!m) throw new Error('MARKET_NOT_FOUND')
  if (m.status === 'resolved') throw new Error('ALREADY_RESOLVED')

  for (const pos of db.positions.filter((x) => x.market_id === marketId)) {
    const payout = result === 'YES' ? pos.yes_shares : pos.no_shares
    if (payout > 0) {
      const p = profile(pos.user_id)
      if (p) {
        p.points += payout
        p.xp += payout
        emit('profiles', 'UPDATE', p as unknown as Record<string, unknown>)
      }
    }
  }
  m.status = 'resolved'
  m.resolved = result
  save(db)
  emit('markets', 'UPDATE', m as unknown as Record<string, unknown>)
}

function extendMarket(marketId: string, newDeadlineISO: string) {
  requireAdmin()
  const m = db.markets.find((x) => x.id === marketId)
  if (!m) throw new Error('MARKET_NOT_FOUND')
  if (m.status !== 'closed') throw new Error('NOT_CLOSED')
  if (new Date(newDeadlineISO).getTime() <= Date.now()) throw new Error('DEADLINE_IN_PAST')

  m.status = 'open'
  m.deadline = newDeadlineISO
  m.extended_count = (m.extended_count ?? 0) + 1
  m.last_extended_at = nowIso()

  // 本番の seed_initial_price トリガー相当（closed→open でチャート継続点を打つ）
  const point: PricePoint = {
    id: ++priceSeq,
    market_id: marketId,
    t: nowIso(),
    yes: currentPrice(m.q_yes, m.q_no, m.b).yes,
  }
  db.price_history.push(point)

  save(db)
  emit('markets', 'UPDATE', m as unknown as Record<string, unknown>)
  emit('price_history', 'INSERT', point as unknown as Record<string, unknown>)
}

function adminAddPoints(userId: string, amount: number) {
  const p = profile(userId)
  if (!p) return
  p.points += amount
  p.xp += Math.max(amount, 0)
  save(db)
  emit('profiles', 'UPDATE', p as unknown as Record<string, unknown>)
}
function adminSetRole(userId: string, role: 'user' | 'admin') {
  if (role !== 'user' && role !== 'admin') throw new Error('BAD_ROLE')
  const p = profile(userId)
  if (!p) return
  p.role = role
  save(db)
  emit('profiles', 'UPDATE', p as unknown as Record<string, unknown>)
}
// migrate-011 の plinko_play と同じ検証・抽選・精算(XP は加算しない)
function plinkoPlay(params: Record<string, unknown>) {
  const me = requireAuth()
  const bet = Number(params.p_bet)
  const rows = Number(params.p_rows)
  if (!Number.isFinite(bet) || bet < 1 || bet > 10000) throw new Error('BAD_BET')
  const cfg = db.plinko_config.find((c) => c.rows_count === rows)
  if (!cfg) throw new Error('BAD_ROWS')
  const p = profile(me)
  if (!p) throw new Error('PROFILE_NOT_FOUND')
  if (p.points < bet) throw new Error('INSUFFICIENT_POINTS')

  let bucket = 0
  for (let i = 0; i < rows; i++) if (Math.random() < 0.5) bucket++
  const multiplier = cfg.multipliers[bucket]
  const payout = Math.round(bet * multiplier * 100) / 100
  p.points = Math.round((p.points + payout - bet) * 100) / 100

  const play: PlinkoPlay = {
    id: uid(),
    user_id: me,
    bet,
    rows_count: rows,
    bucket,
    multiplier,
    payout,
    created_at: nowIso(),
  }
  db.plinko_plays.push(play)
  save(db)
  emit('profiles', 'UPDATE', p as unknown as Record<string, unknown>)
  emit('plinko_plays', 'INSERT', play as unknown as Record<string, unknown>)
  return { bucket, multiplier, payout, balance: p.points }
}

// migrate-011 の admin_plinko_set_multipliers と同じ検証(RTP 10%〜150%)
function adminPlinkoSetMultipliers(params: Record<string, unknown>) {
  requireAdmin()
  const rows = Number(params.p_rows)
  const cfg = db.plinko_config.find((c) => c.rows_count === rows)
  if (!cfg) throw new Error('BAD_ROWS')
  const raw = params.p_multipliers
  if (!Array.isArray(raw) || raw.length !== rows + 1) throw new Error('BAD_MULTIPLIERS')
  const mult = raw.map(Number)
  if (mult.some((m) => !Number.isFinite(m) || m < 0)) throw new Error('BAD_MULTIPLIERS')
  const rtp = calcRTP(rows, mult)
  if (rtp < 0.1 || rtp > 1.5) throw new Error('RTP_OUT_OF_RANGE')
  cfg.multipliers = mult
  cfg.updated_at = nowIso()
  cfg.updated_by = currentUserId
  save(db)
  emit('plinko_config', 'UPDATE', cfg as unknown as Record<string, unknown>)
}

function claimDailyBonus() {
  const p = profile(requireAuth())!
  const today = new Date().toISOString().slice(0, 10)
  if (p.last_bonus === today) return { claimed: false }
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  p.bonus_streak = p.last_bonus === yesterday ? (p.bonus_streak ?? 0) + 1 : 1
  const amount = 100 + Math.min(p.bonus_streak - 1, 6) * 50
  p.points += amount
  p.xp += amount
  p.last_bonus = today
  save(db)
  emit('profiles', 'UPDATE', p as unknown as Record<string, unknown>)
  return { claimed: true, amount, streak: p.bonus_streak }
}

// ============================================================================
// クライアント本体
// ============================================================================
export function createLocalClient() {
  return {
    from,
    rpc,
    auth,
    channel(_name: string) {
      const own: Sub[] = []
      const ch = {
        on(
          _type: string,
          opts: { event: string; schema: string; table: string; filter?: string },
          cb: Sub['cb']
        ) {
          const s: Sub = { table: opts.table, event: opts.event, filter: parseFilter(opts.filter), cb }
          own.push(s)
          subs.push(s)
          return ch
        },
        subscribe() {
          return ch
        },
        _own: own,
      }
      return ch
    },
    removeChannel(ch: { _own?: Sub[] }) {
      if (ch?._own) subs = subs.filter((s) => !ch._own!.includes(s))
    },
  }
}
