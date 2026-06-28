export type UserRole = 'user' | 'admin'

export type User = {
  id: string
  name: string
  points: number
  role: UserRole
  createdAt: string
  /** 累積経験値（トレード額＋的中受取で単調増加。レベル算出に使用） */
  xp: number
  /** デイリーボーナス最終受取日（YYYY-MM-DD） */
  lastBonus?: string
  /** 連続ログイン日数 */
  bonusStreak?: number
}

export type MarketStatus = 'pending' | 'open' | 'closed' | 'resolved'

export type Category =
  | 'All'
  | 'Politics'
  | 'Crypto'
  | 'Sports'
  | 'AI'
  | 'Tech'
  | 'Science'
  | 'Entertainment'

export type Market = {
  id: string
  question: string
  description: string
  deadline: string
  status: MarketStatus
  q_yes: number
  q_no: number
  b: number
  resolved: null | 'YES' | 'NO'
  createdBy: string
  createdAt: string
  category: Category
  volume: number
  imageUrl?: string
  /** 締切延長された回数（0 = 未延長） */
  extendedCount: number
  /** 最終延長日時（ISO, 未延長は null） */
  lastExtendedAt: string | null
  priceHistory: Array<{ t: string; yes: number }>
}

export type Position = {
  userId: string
  marketId: string
  yesShares: number
  noShares: number
}

export type Trade = {
  id: string
  userId: string
  marketId: string
  side: 'YES' | 'NO'
  action: 'buy' | 'sell'
  shares: number
  cost: number
  pricePerShare: number
  timestamp: string
}

export type Ad = {
  id: string
  title: string
  imageUrl: string
  linkUrl: string
  active: boolean
  createdAt: string
}

export type Comment = {
  id: string
  marketId: string
  userId: string
  body: string
  createdAt: string
}
