import { create } from 'zustand'
import type { User, Market, Position, Trade, Ad, Comment } from '../types'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

// numeric は PostgREST から文字列で返ることがあるため数値化
function n(v: unknown): number {
  return typeof v === 'number' ? v : Number(v ?? 0)
}

function mapUser(p: any): User {
  return {
    id: p.id,
    name: p.name,
    points: n(p.points),
    xp: n(p.xp),
    role: p.role,
    createdAt: p.created_at,
    lastBonus: p.last_bonus ?? undefined,
    bonusStreak: p.bonus_streak ?? 0,
  }
}
function mapMarket(m: any): Market {
  return {
    id: m.id,
    question: m.question,
    description: m.description,
    deadline: m.deadline,
    status: m.status,
    q_yes: n(m.q_yes),
    q_no: n(m.q_no),
    b: n(m.b),
    resolved: m.resolved ?? null,
    createdBy: m.created_by ?? '',
    createdAt: m.created_at,
    category: m.category,
    volume: n(m.volume),
    imageUrl: m.image_url ?? undefined,
    extendedCount: n(m.extended_count),
    lastExtendedAt: m.last_extended_at ?? null,
    priceHistory: [],
  }
}
function mapPosition(p: any): Position {
  return { userId: p.user_id, marketId: p.market_id, yesShares: n(p.yes_shares), noShares: n(p.no_shares) }
}
function mapTrade(t: any): Trade {
  return {
    id: t.id,
    userId: t.user_id,
    marketId: t.market_id,
    side: t.side,
    action: t.action,
    shares: n(t.shares),
    cost: n(t.cost),
    pricePerShare: n(t.price_per_share),
    timestamp: t.created_at,
  }
}
function mapComment(c: any): Comment {
  return { id: c.id, marketId: c.market_id, userId: c.user_id, body: c.body, createdAt: c.created_at }
}
function mapAd(a: any): Ad {
  return { id: a.id, title: a.title, imageUrl: a.image_url, linkUrl: a.link_url, active: a.active, createdAt: a.created_at }
}

function mapRpcError(msg: string): string {
  if (msg.includes('AUTH_REQUIRED')) return 'ログインしてください'
  if (msg.includes('MARKET_NOT_OPEN')) return 'このマーケットは現在受付中ではありません'
  if (msg.includes('MARKET_CLOSED')) return 'このマーケットは締切済みです'
  if (msg.includes('ALREADY_RESOLVED')) return 'このマーケットは既に解決済みです'
  if (msg.includes('MARKET_NOT_FOUND')) return 'マーケットが見つかりません'
  if (msg.includes('INSUFFICIENT_POINTS')) return 'ポイントが不足しています'
  if (msg.includes('INSUFFICIENT_SHARES')) return '保有シェアが不足しています'
  if (msg.includes('BAD_SHARES')) return '0より大きい枚数を入力してください'
  if (msg.includes('ADMIN_REQUIRED')) return '管理者権限が必要です'
  if (msg.includes('NOT_CLOSED')) return '締切済みの市場のみ延長できます'
  if (msg.includes('DEADLINE_IN_PAST')) return '新しい締切は未来の日時にしてください'
  return msg || 'エラーが発生しました'
}

type StoreState = {
  users: User[]
  markets: Market[]
  positions: Position[]
  trades: Trade[]
  ads: Ad[]
  comments: Comment[]
  currentUserId: string | null
  loaded: boolean
  error: string | null
}

// loadAll で再取得するテーブルの論理名
type TableKey = 'users' | 'markets' | 'positions' | 'trades' | 'comments' | 'ads'

type StoreActions = {
  currentUser: () => User | null
  syncAuthUser: (u: User | null) => void
  clearError: () => void
  // only を渡すと該当テーブルのみ再取得（取引のたびに全件取得しないための最適化）
  loadAll: (only?: TableKey[]) => Promise<void>

  buyShares: (marketId: string, side: 'YES' | 'NO', shares: number) => Promise<{ success: boolean; error?: string; cost?: number }>
  sellShares: (marketId: string, side: 'YES' | 'NO', shares: number) => Promise<{ success: boolean; error?: string; refund?: number }>

  proposeMarket: (data: { question: string; description: string; deadline: string; category: string; imageUrl?: string }) => Promise<void>
  createMarket: (data: { question: string; description: string; deadline: string; category: string; imageUrl?: string; b?: number }) => Promise<void>

  addAd: (data: { title: string; imageUrl: string; linkUrl: string }) => Promise<void>
  updateAd: (id: string, data: Partial<Pick<Ad, 'title' | 'imageUrl' | 'linkUrl'>>) => Promise<void>
  toggleAd: (id: string) => Promise<void>
  deleteAd: (id: string) => Promise<void>

  approveMarket: (marketId: string) => Promise<void>
  rejectMarket: (marketId: string) => Promise<void>
  closeMarket: (marketId: string) => Promise<void>
  resolveMarket: (marketId: string, result: 'YES' | 'NO') => Promise<void>
  extendMarket: (marketId: string, newDeadlineISO: string) => Promise<void>

  addPoints: (userId: string, amount: number) => Promise<void>
  changeRole: (userId: string, role: 'user' | 'admin') => Promise<void>

  claimDailyBonus: () => Promise<{ claimed: boolean; amount?: number; streak?: number }>

  getPosition: (userId: string, marketId: string) => Position
  getMarketTrades: (marketId: string) => Trade[]
  getUserTrades: (userId: string) => Trade[]

  addComment: (marketId: string, body: string) => Promise<void>
  getMarketComments: (marketId: string) => Comment[]
}

type Store = StoreState & StoreActions

const refreshProfile = () => useAuth.getState().loadProfile()

export const useStore = create<Store>((set, get) => ({
  users: [],
  markets: [],
  positions: [],
  trades: [],
  ads: [],
  comments: [],
  currentUserId: null,
  loaded: false,
  error: null,

  currentUser: () => {
    const { users, currentUserId } = get()
    return users.find((u) => u.id === currentUserId) ?? null
  },

  clearError: () => set({ error: null }),

  syncAuthUser: (u) =>
    set((s) => {
      if (!u) return { currentUserId: null }
      const exists = s.users.some((x) => x.id === u.id)
      return {
        users: exists ? s.users.map((x) => (x.id === u.id ? { ...x, ...u } : x)) : [...s.users, u],
        currentUserId: u.id,
      }
    }),

  loadAll: async (only) => {
    const want = (k: TableKey) => !only || only.includes(k)
    const [pr, mk, po, tr, cm, ad] = await Promise.all([
      want('users') ? supabase.from('profiles').select('*') : null,
      want('markets') ? supabase.from('markets').select('*').order('created_at', { ascending: true }) : null,
      want('positions') ? supabase.from('positions').select('*') : null,
      want('trades') ? supabase.from('trades').select('*').order('created_at', { ascending: true }) : null,
      want('comments') ? supabase.from('comments').select('*') : null,
      want('ads') ? supabase.from('ads').select('*') : null,
    ])
    const patch: Partial<StoreState> = { loaded: true }
    if (pr) patch.users = (pr.data ?? []).map(mapUser)
    if (mk) patch.markets = (mk.data ?? []).map(mapMarket)
    if (po) patch.positions = (po.data ?? []).map(mapPosition)
    if (tr) patch.trades = (tr.data ?? []).map(mapTrade)
    if (cm) patch.comments = (cm.data ?? []).map(mapComment)
    if (ad) patch.ads = (ad.data ?? []).map(mapAd)
    set(patch)
  },

  buyShares: async (marketId, side, shares) => {
    const { data, error } = await supabase.rpc('buy_shares', {
      p_market_id: marketId,
      p_side: side,
      p_shares: shares,
    })
    if (error) return { success: false, error: mapRpcError(error.message) }
    await get().loadAll(['users', 'markets', 'positions', 'trades'])
    await refreshProfile()
    return { success: true, cost: n(data) }
  },

  sellShares: async (marketId, side, shares) => {
    const { data, error } = await supabase.rpc('sell_shares', {
      p_market_id: marketId,
      p_side: side,
      p_shares: shares,
    })
    if (error) return { success: false, error: mapRpcError(error.message) }
    await get().loadAll(['users', 'markets', 'positions', 'trades'])
    await refreshProfile()
    return { success: true, refund: n(data) }
  },

  proposeMarket: async (data) => {
    const uid = get().currentUserId
    if (!uid) return
    const { error } = await supabase.from('markets').insert({
      question: data.question,
      description: data.description,
      deadline: data.deadline,
      category: data.category,
      image_url: data.imageUrl ?? null,
      created_by: uid,
      status: 'pending',
      b: 100,
    })
    if (error) return set({ error: mapRpcError(error.message) })
    await get().loadAll(['markets'])
  },

  createMarket: async (data) => {
    const uid = get().currentUserId
    if (!uid) return
    const { error } = await supabase.from('markets').insert({
      question: data.question,
      description: data.description,
      deadline: data.deadline,
      category: data.category,
      image_url: data.imageUrl ?? null,
      created_by: uid,
      status: 'open',
      b: data.b && data.b > 0 ? data.b : 100,
    })
    if (error) return set({ error: mapRpcError(error.message) })
    await get().loadAll(['markets'])
  },

  addAd: async (data) => {
    const { error } = await supabase.from('ads').insert({ title: data.title, image_url: data.imageUrl, link_url: data.linkUrl, active: true })
    if (error) return set({ error: mapRpcError(error.message) })
    await get().loadAll(['ads'])
  },
  updateAd: async (id, data) => {
    const patch: Record<string, unknown> = {}
    if (data.title !== undefined) patch.title = data.title
    if (data.imageUrl !== undefined) patch.image_url = data.imageUrl
    if (data.linkUrl !== undefined) patch.link_url = data.linkUrl
    const { error } = await supabase.from('ads').update(patch).eq('id', id)
    if (error) return set({ error: mapRpcError(error.message) })
    await get().loadAll(['ads'])
  },
  toggleAd: async (id) => {
    const a = get().ads.find((x) => x.id === id)
    const { error } = await supabase.from('ads').update({ active: !a?.active }).eq('id', id)
    if (error) return set({ error: mapRpcError(error.message) })
    await get().loadAll(['ads'])
  },
  deleteAd: async (id) => {
    const { error } = await supabase.from('ads').delete().eq('id', id)
    if (error) return set({ error: mapRpcError(error.message) })
    await get().loadAll(['ads'])
  },

  approveMarket: async (marketId) => {
    const { error } = await supabase.from('markets').update({ status: 'open' }).eq('id', marketId)
    if (error) return set({ error: mapRpcError(error.message) })
    await get().loadAll(['markets'])
  },
  rejectMarket: async (marketId) => {
    const { error } = await supabase.from('markets').delete().eq('id', marketId)
    if (error) return set({ error: mapRpcError(error.message) })
    await get().loadAll(['markets'])
  },
  closeMarket: async (marketId) => {
    const { error } = await supabase.from('markets').update({ status: 'closed' }).eq('id', marketId)
    if (error) return set({ error: mapRpcError(error.message) })
    await get().loadAll(['markets'])
  },
  resolveMarket: async (marketId, result) => {
    const { error } = await supabase.rpc('resolve_market', { p_market_id: marketId, p_result: result })
    if (error) return set({ error: mapRpcError(error.message) })
    await get().loadAll(['users', 'markets'])
    await refreshProfile()
  },
  extendMarket: async (marketId, newDeadlineISO) => {
    const { error } = await supabase.rpc('extend_market', {
      p_market_id: marketId,
      p_new_deadline: newDeadlineISO,
    })
    if (error) return set({ error: mapRpcError(error.message) })
    await get().loadAll(['markets'])
  },

  addPoints: async (userId, amount) => {
    const { error } = await supabase.rpc('admin_add_points', { p_user: userId, p_amount: amount })
    if (error) return set({ error: mapRpcError(error.message) })
    await get().loadAll(['users'])
    await refreshProfile()
  },
  changeRole: async (userId, role) => {
    const { error } = await supabase.rpc('admin_set_role', { p_user: userId, p_role: role })
    if (error) return set({ error: mapRpcError(error.message) })
    await get().loadAll(['users'])
  },

  claimDailyBonus: async () => {
    const { data, error } = await supabase.rpc('claim_daily_bonus')
    if (error || !data) return { claimed: false }
    await refreshProfile()
    return data as { claimed: boolean; amount?: number; streak?: number }
  },

  getPosition: (userId, marketId) =>
    get().positions.find((p) => p.userId === userId && p.marketId === marketId) ?? {
      userId,
      marketId,
      yesShares: 0,
      noShares: 0,
    },
  getMarketTrades: (marketId) => get().trades.filter((t) => t.marketId === marketId),
  getUserTrades: (userId) => get().trades.filter((t) => t.userId === userId),

  addComment: async (marketId, body) => {
    const uid = get().currentUserId
    const text = body.trim()
    if (!uid || !text) return
    const { error } = await supabase.from('comments').insert({ market_id: marketId, user_id: uid, body: text })
    if (error) return set({ error: mapRpcError(error.message) })
    await get().loadAll(['comments'])
  },
  getMarketComments: (marketId) =>
    get()
      .comments.filter((c) => c.marketId === marketId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
}))
