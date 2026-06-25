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
  if (msg.includes('MARKET_NOT_FOUND')) return 'マーケットが見つかりません'
  if (msg.includes('INSUFFICIENT_POINTS')) return 'ポイントが不足しています'
  if (msg.includes('INSUFFICIENT_SHARES')) return '保有シェアが不足しています'
  if (msg.includes('BAD_SHARES')) return '0より大きい枚数を入力してください'
  if (msg.includes('ADMIN_REQUIRED')) return '管理者権限が必要です'
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
}

type StoreActions = {
  currentUser: () => User | null
  syncAuthUser: (u: User | null) => void
  loadAll: () => Promise<void>

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

  currentUser: () => {
    const { users, currentUserId } = get()
    return users.find((u) => u.id === currentUserId) ?? null
  },

  syncAuthUser: (u) =>
    set((s) => {
      if (!u) return { currentUserId: null }
      const exists = s.users.some((x) => x.id === u.id)
      return {
        users: exists ? s.users.map((x) => (x.id === u.id ? { ...x, ...u } : x)) : [...s.users, u],
        currentUserId: u.id,
      }
    }),

  loadAll: async () => {
    const [pr, mk, po, tr, cm, ad] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('markets').select('*').order('created_at', { ascending: true }),
      supabase.from('positions').select('*'),
      supabase.from('trades').select('*').order('created_at', { ascending: true }),
      supabase.from('comments').select('*'),
      supabase.from('ads').select('*'),
    ])
    set({
      users: (pr.data ?? []).map(mapUser),
      markets: (mk.data ?? []).map(mapMarket),
      positions: (po.data ?? []).map(mapPosition),
      trades: (tr.data ?? []).map(mapTrade),
      comments: (cm.data ?? []).map(mapComment),
      ads: (ad.data ?? []).map(mapAd),
      loaded: true,
    })
  },

  buyShares: async (marketId, side, shares) => {
    const { data, error } = await supabase.rpc('buy_shares', {
      p_market_id: marketId,
      p_side: side,
      p_shares: shares,
    })
    if (error) return { success: false, error: mapRpcError(error.message) }
    await get().loadAll()
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
    await get().loadAll()
    await refreshProfile()
    return { success: true, refund: n(data) }
  },

  proposeMarket: async (data) => {
    const uid = get().currentUserId
    if (!uid) return
    await supabase.from('markets').insert({
      question: data.question,
      description: data.description,
      deadline: data.deadline,
      category: data.category,
      image_url: data.imageUrl ?? null,
      created_by: uid,
      status: 'pending',
      b: 100,
    })
    await get().loadAll()
  },

  createMarket: async (data) => {
    const uid = get().currentUserId
    if (!uid) return
    await supabase.from('markets').insert({
      question: data.question,
      description: data.description,
      deadline: data.deadline,
      category: data.category,
      image_url: data.imageUrl ?? null,
      created_by: uid,
      status: 'open',
      b: data.b && data.b > 0 ? data.b : 100,
    })
    await get().loadAll()
  },

  addAd: async (data) => {
    await supabase.from('ads').insert({ title: data.title, image_url: data.imageUrl, link_url: data.linkUrl, active: true })
    await get().loadAll()
  },
  updateAd: async (id, data) => {
    const patch: Record<string, unknown> = {}
    if (data.title !== undefined) patch.title = data.title
    if (data.imageUrl !== undefined) patch.image_url = data.imageUrl
    if (data.linkUrl !== undefined) patch.link_url = data.linkUrl
    await supabase.from('ads').update(patch).eq('id', id)
    await get().loadAll()
  },
  toggleAd: async (id) => {
    const a = get().ads.find((x) => x.id === id)
    await supabase.from('ads').update({ active: !a?.active }).eq('id', id)
    await get().loadAll()
  },
  deleteAd: async (id) => {
    await supabase.from('ads').delete().eq('id', id)
    await get().loadAll()
  },

  approveMarket: async (marketId) => {
    await supabase.from('markets').update({ status: 'open' }).eq('id', marketId)
    await get().loadAll()
  },
  rejectMarket: async (marketId) => {
    await supabase.from('markets').delete().eq('id', marketId)
    await get().loadAll()
  },
  closeMarket: async (marketId) => {
    await supabase.from('markets').update({ status: 'closed' }).eq('id', marketId)
    await get().loadAll()
  },
  resolveMarket: async (marketId, result) => {
    const { error } = await supabase.rpc('resolve_market', { p_market_id: marketId, p_result: result })
    if (!error) {
      await get().loadAll()
      await refreshProfile()
    }
  },

  addPoints: async (userId, amount) => {
    await supabase.rpc('admin_add_points', { p_user: userId, p_amount: amount })
    await get().loadAll()
    await refreshProfile()
  },
  changeRole: async (userId, role) => {
    await supabase.rpc('admin_set_role', { p_user: userId, p_role: role })
    await get().loadAll()
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
    await supabase.from('comments').insert({ market_id: marketId, user_id: uid, body: text })
    await get().loadAll()
  },
  getMarketComments: (marketId) =>
    get()
      .comments.filter((c) => c.marketId === marketId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
}))
