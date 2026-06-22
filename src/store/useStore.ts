import { create } from 'zustand'
import type { User, Market, Position, Trade, Category, Ad, Comment } from '../types'
import { buyCost, sellRefund, costFn, currentPrice, resolvePayouts } from '../lib/lmsr'

const STORAGE_KEY = 'poripori-v1'

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

function priceAt(qYes: number, qNo: number, b: number) {
  return currentPrice(qYes, qNo, b).yes
}

function generateHistory(
  qYes: number,
  qNo: number,
  b: number,
  createdAt: string,
  steps = 30
): Array<{ t: string; yes: number }> {
  const created = new Date(createdAt).getTime()
  const now = Date.now()
  const history: Array<{ t: string; yes: number }> = []
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps
    const t = new Date(created + (now - created) * ratio).toISOString()
    const qy = qYes * ratio
    const qn = qNo * ratio
    history.push({ t, yes: priceAt(qy, qn, b) })
  }
  return history
}

const SEED_USERS: User[] = [
  { id: 'admin', name: 'Admin', points: 50000, role: 'admin', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'u1', name: '田中 太郎', points: 1240, role: 'user', createdAt: '2026-01-10T00:00:00Z' },
  { id: 'u2', name: '鈴木 花子', points: 890, role: 'user', createdAt: '2026-01-12T00:00:00Z' },
  { id: 'u3', name: '山田 次郎', points: 1580, role: 'user', createdAt: '2026-01-15T00:00:00Z' },
  { id: 'u4', name: '佐藤 美咲', points: 720, role: 'user', createdAt: '2026-01-20T00:00:00Z' },
]

const SEED_MARKETS: Market[] = [
  {
    id: 'm1',
    question: '2026年FIFAワールドカップで日本がベスト4に入るか？',
    description:
      '2026年6月〜7月に開催されるFIFAワールドカップ（北米開催）において、日本代表チームがベスト4（準決勝進出）を達成するか。公式の大会結果に基づき判定する。',
    deadline: '2026-07-15T00:00:00Z',
    status: 'open',
    q_yes: 180,
    q_no: 120,
    b: 100,
    resolved: null,
    createdBy: 'u2',
    createdAt: '2026-01-10T00:00:00Z',
    category: 'Sports',
    volume: 18500,
    priceHistory: generateHistory(180, 120, 100, '2026-01-10T00:00:00Z'),
  },
  {
    id: 'm2',
    question: 'ChatGPT-5は2026年内にリリースされるか？',
    description:
      'OpenAIが「ChatGPT-5」または同等の次世代モデルを2026年12月31日までに一般公開するか。研究プレビューや限定アクセスは含まず、一般向け公開が条件。',
    deadline: '2026-12-31T00:00:00Z',
    status: 'open',
    q_yes: 240,
    q_no: 160,
    b: 100,
    resolved: null,
    createdBy: 'u3',
    createdAt: '2026-02-01T00:00:00Z',
    category: 'AI',
    volume: 31200,
    priceHistory: generateHistory(240, 160, 100, '2026-02-01T00:00:00Z'),
  },
  {
    id: 'm3',
    question: '2026年東京都知事選で現職が再選するか？',
    description:
      '2026年に行われる東京都知事選挙において、現職の都知事が再選を果たすか。選挙管理委員会の正式な開票結果に基づき判定する。',
    deadline: '2026-08-01T00:00:00Z',
    status: 'open',
    q_yes: 90,
    q_no: 210,
    b: 100,
    resolved: null,
    createdBy: 'u1',
    createdAt: '2026-03-05T00:00:00Z',
    category: 'Politics',
    volume: 14800,
    priceHistory: generateHistory(90, 210, 100, '2026-03-05T00:00:00Z'),
  },
  {
    id: 'm4',
    question: 'ビットコインは2026年末までに$200,000を超えるか？',
    description:
      'BTC/USDの価格が2026年12月31日23:59（UTC）時点で$200,000を超えているか。CoinGeckoのBTC価格を参照して判定する。',
    deadline: '2026-12-31T23:59:59Z',
    status: 'open',
    q_yes: 140,
    q_no: 260,
    b: 100,
    resolved: null,
    createdBy: 'u4',
    createdAt: '2026-01-20T00:00:00Z',
    category: 'Crypto',
    volume: 22400,
    priceHistory: generateHistory(140, 260, 100, '2026-01-20T00:00:00Z'),
  },
  {
    id: 'm5',
    question: 'NVIDIAは2026年内に時価総額$5兆を超えるか？',
    description:
      'NVIDIAの時価総額が2026年12月31日までに$5兆（5 Trillion USD）を超えるか。終値ベースで判定する。',
    deadline: '2026-12-31T00:00:00Z',
    status: 'open',
    q_yes: 200,
    q_no: 100,
    b: 100,
    resolved: null,
    createdBy: 'u2',
    createdAt: '2026-04-10T00:00:00Z',
    category: 'Tech',
    volume: 19600,
    priceHistory: generateHistory(200, 100, 100, '2026-04-10T00:00:00Z'),
  },
  {
    id: 'm6',
    question: '次のWWDCでAppleがARグラスを発表するか？',
    description:
      'Apple社がWWDC 2026（6月開催）において「Apple Glass」または同等のARグラス製品を正式発表するか。ティーザーや噂レベルは含まず、製品発表が条件。',
    deadline: '2026-06-30T00:00:00Z',
    status: 'closed',
    q_yes: 80,
    q_no: 320,
    b: 100,
    resolved: null,
    createdBy: 'u3',
    createdAt: '2026-02-15T00:00:00Z',
    category: 'Tech',
    volume: 26000,
    priceHistory: generateHistory(80, 320, 100, '2026-02-15T00:00:00Z'),
  },
  {
    id: 'm7',
    question: '2026年参院選で与党が改選議席の過半数を獲得するか？',
    description:
      '2026年7月に行われる参議院議員通常選挙において、与党（自民党・公明党）が改選議席（125議席）の過半数（63議席以上）を獲得するか。',
    deadline: '2026-07-31T00:00:00Z',
    status: 'resolved',
    q_yes: 200,
    q_no: 100,
    b: 100,
    resolved: 'YES',
    createdBy: 'u1',
    createdAt: '2026-01-05T00:00:00Z',
    category: 'Politics',
    volume: 18300,
    priceHistory: generateHistory(200, 100, 100, '2026-01-05T00:00:00Z'),
  },
  {
    id: 'm8',
    question: 'SpaceXが2026年内にスターシップで月軌道飛行を成功させるか？',
    description:
      'SpaceX社がStarshipを使用して月軌道に到達するミッション（有人・無人問わず）を2026年12月31日までに成功させるか。',
    deadline: '2026-12-31T00:00:00Z',
    status: 'pending',
    q_yes: 0,
    q_no: 0,
    b: 100,
    resolved: null,
    createdBy: 'u3',
    createdAt: '2026-06-18T00:00:00Z',
    category: 'Science',
    volume: 0,
    priceHistory: [],
  },
  {
    id: 'm9',
    question: 'ビットコインは2026年内に15万ドルを突破するか？',
    description:
      'BTC/USDの価格が2026年12月31日までに、主要取引所の終値ベースで一度でも15万ドルを上回るか。',
    deadline: '2026-12-31T00:00:00Z',
    status: 'open',
    q_yes: 140,
    q_no: 160,
    b: 100,
    resolved: null,
    createdBy: 'u1',
    createdAt: '2026-02-01T00:00:00Z',
    category: 'Crypto',
    volume: 24200,
    priceHistory: generateHistory(140, 160, 100, '2026-02-01T00:00:00Z'),
  },
  {
    id: 'm10',
    question: 'OpenAIは2026年内に新しいフラッグシップモデルを発表するか？',
    description:
      'OpenAIが2026年12月31日までに、GPTシリーズの新たなフラッグシップモデルを公式に発表するか。',
    deadline: '2026-12-31T00:00:00Z',
    status: 'open',
    q_yes: 230,
    q_no: 70,
    b: 100,
    resolved: null,
    createdBy: 'u2',
    createdAt: '2026-02-10T00:00:00Z',
    category: 'AI',
    volume: 31800,
    priceHistory: generateHistory(230, 70, 100, '2026-02-10T00:00:00Z'),
  },
  {
    id: 'm11',
    question: 'イーサリアムは2026年内に8000ドルを超えるか？',
    description:
      'ETH/USDの価格が2026年12月31日までに、主要取引所の終値ベースで一度でも8000ドルを上回るか。',
    deadline: '2026-12-31T00:00:00Z',
    status: 'open',
    q_yes: 110,
    q_no: 190,
    b: 100,
    resolved: null,
    createdBy: 'u3',
    createdAt: '2026-02-15T00:00:00Z',
    category: 'Crypto',
    volume: 16400,
    priceHistory: generateHistory(110, 190, 100, '2026-02-15T00:00:00Z'),
  },
  {
    id: 'm12',
    question: '日経平均は2026年内に5万円を超えるか？',
    description:
      '日経平均株価が2026年12月31日までに、終値ベースで一度でも50,000円を上回るか。',
    deadline: '2026-12-31T00:00:00Z',
    status: 'open',
    q_yes: 95,
    q_no: 205,
    b: 100,
    resolved: null,
    createdBy: 'u4',
    createdAt: '2026-03-01T00:00:00Z',
    category: 'Tech',
    volume: 12900,
    priceHistory: generateHistory(95, 205, 100, '2026-03-01T00:00:00Z'),
  },
  {
    id: 'm13',
    question: 'Appleは2026年内にAR/VRの新型デバイスを発売するか？',
    description:
      'Appleが2026年12月31日までに、Vision系を含むAR/VRデバイスの新モデルを正式に発売するか。',
    deadline: '2026-12-31T00:00:00Z',
    status: 'open',
    q_yes: 130,
    q_no: 170,
    b: 100,
    resolved: null,
    createdBy: 'u1',
    createdAt: '2026-03-05T00:00:00Z',
    category: 'Tech',
    volume: 9800,
    priceHistory: generateHistory(130, 170, 100, '2026-03-05T00:00:00Z'),
  },
  {
    id: 'm14',
    question: '2026年の夏は観測史上最も暑い夏になるか？',
    description:
      '気象庁の発表に基づき、2026年6〜8月の日本の平均気温が観測史上最高を記録するか。',
    deadline: '2026-09-15T00:00:00Z',
    status: 'open',
    q_yes: 175,
    q_no: 125,
    b: 100,
    resolved: null,
    createdBy: 'u2',
    createdAt: '2026-04-01T00:00:00Z',
    category: 'Science',
    volume: 7200,
    priceHistory: generateHistory(175, 125, 100, '2026-04-01T00:00:00Z'),
  },
  {
    id: 'm15',
    question: '大谷翔平は2026年シーズンに50本塁打を達成するか？',
    description:
      '大谷翔平選手が2026年のMLBレギュラーシーズンで本塁打50本以上を記録するか。',
    deadline: '2026-10-05T00:00:00Z',
    status: 'open',
    q_yes: 160,
    q_no: 140,
    b: 100,
    resolved: null,
    createdBy: 'u3',
    createdAt: '2026-04-10T00:00:00Z',
    category: 'Sports',
    volume: 21500,
    priceHistory: generateHistory(160, 140, 100, '2026-04-10T00:00:00Z'),
  },
  {
    id: 'm16',
    question: 'GTA VIは2026年内に発売されるか？',
    description:
      'Rockstar Gamesが「Grand Theft Auto VI」を2026年12月31日までに正式リリースするか。',
    deadline: '2026-12-31T00:00:00Z',
    status: 'open',
    q_yes: 85,
    q_no: 215,
    b: 100,
    resolved: null,
    createdBy: 'u4',
    createdAt: '2026-04-20T00:00:00Z',
    category: 'Entertainment',
    volume: 28700,
    priceHistory: generateHistory(85, 215, 100, '2026-04-20T00:00:00Z'),
  },
  {
    id: 'm17',
    question: '生成AIエージェントは2026年内に主要SaaSへ標準搭載されるか？',
    description:
      '主要なSaaS製品（上位10サービスの過半）が2026年内に自律型AIエージェント機能を標準搭載するか。',
    deadline: '2026-12-31T00:00:00Z',
    status: 'open',
    q_yes: 150,
    q_no: 150,
    b: 100,
    resolved: null,
    createdBy: 'u1',
    createdAt: '2026-05-01T00:00:00Z',
    category: 'AI',
    volume: 13600,
    priceHistory: generateHistory(150, 150, 100, '2026-05-01T00:00:00Z'),
  },
  {
    id: 'm18',
    question: '米連邦準備制度（FED）は2026年内に追加利下げを行うか？',
    description:
      'FOMCが2026年12月31日までに政策金利の引き下げを少なくとも1回決定するか。',
    deadline: '2026-12-31T00:00:00Z',
    status: 'open',
    q_yes: 190,
    q_no: 110,
    b: 100,
    resolved: null,
    createdBy: 'u2',
    createdAt: '2026-05-05T00:00:00Z',
    category: 'Politics',
    volume: 17800,
    priceHistory: generateHistory(190, 110, 100, '2026-05-05T00:00:00Z'),
  },
  {
    id: 'm19',
    question: 'ソラナ（SOL）は2026年内に最高値を更新するか？',
    description:
      'SOL/USDが2026年12月31日までに、過去最高値（終値ベース）を更新するか。',
    deadline: '2026-12-31T00:00:00Z',
    status: 'open',
    q_yes: 120,
    q_no: 180,
    b: 100,
    resolved: null,
    createdBy: 'u3',
    createdAt: '2026-05-12T00:00:00Z',
    category: 'Crypto',
    volume: 11200,
    priceHistory: generateHistory(120, 180, 100, '2026-05-12T00:00:00Z'),
  },
  {
    id: 'm20',
    question: '2026年内に有人月面着陸ミッションは実施されるか？',
    description:
      'いずれかの国・組織が2026年12月31日までに有人での月面着陸ミッションを実施するか。',
    deadline: '2026-12-31T00:00:00Z',
    status: 'open',
    q_yes: 60,
    q_no: 240,
    b: 100,
    resolved: null,
    createdBy: 'u4',
    createdAt: '2026-05-20T00:00:00Z',
    category: 'Science',
    volume: 6400,
    priceHistory: generateHistory(60, 240, 100, '2026-05-20T00:00:00Z'),
  },
]

const SEED_POSITIONS: Position[] = [
  { userId: 'u1', marketId: 'm1', yesShares: 80, noShares: 30 },
  { userId: 'u2', marketId: 'm1', yesShares: 50, noShares: 20 },
  { userId: 'u3', marketId: 'm1', yesShares: 30, noShares: 40 },
  { userId: 'u4', marketId: 'm1', yesShares: 20, noShares: 30 },

  { userId: 'u1', marketId: 'm2', yesShares: 60, noShares: 40 },
  { userId: 'u2', marketId: 'm2', yesShares: 80, noShares: 30 },
  { userId: 'u3', marketId: 'm2', yesShares: 60, noShares: 50 },
  { userId: 'u4', marketId: 'm2', yesShares: 40, noShares: 40 },

  { userId: 'u1', marketId: 'm3', yesShares: 20, noShares: 80 },
  { userId: 'u2', marketId: 'm3', yesShares: 30, noShares: 50 },
  { userId: 'u3', marketId: 'm3', yesShares: 20, noShares: 40 },
  { userId: 'u4', marketId: 'm3', yesShares: 20, noShares: 40 },

  { userId: 'u1', marketId: 'm4', yesShares: 40, noShares: 60 },
  { userId: 'u2', marketId: 'm4', yesShares: 30, noShares: 80 },
  { userId: 'u3', marketId: 'm4', yesShares: 40, noShares: 70 },
  { userId: 'u4', marketId: 'm4', yesShares: 30, noShares: 50 },

  { userId: 'u1', marketId: 'm7', yesShares: 100, noShares: 0 },
  { userId: 'u2', marketId: 'm7', yesShares: 60, noShares: 20 },
  { userId: 'u3', marketId: 'm7', yesShares: 40, noShares: 60 },
]

const SEED_TRADES: Trade[] = []

const SEED_ADS: Ad[] = [
  {
    id: 'ad1',
    title: '予測市場をはじめよう — 公式ガイド',
    imageUrl: '',
    linkUrl: 'https://example.com/guide',
    active: true,
    createdAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 'ad2',
    title: 'コミュニティに参加する',
    imageUrl: '',
    linkUrl: 'https://example.com/community',
    active: true,
    createdAt: '2026-06-01T00:00:00Z',
  },
]

const SEED_COMMENTS: Comment[] = [
  { id: 'c1', marketId: 'm1', userId: 'u3', body: '直近の親善試合を見る限り、ベスト4は厳しいと思う。NO寄り。', createdAt: '2026-06-10T09:00:00Z' },
  { id: 'c2', marketId: 'm1', userId: 'u2', body: 'グループ次第では十分あり得る。YESを少し持っておく。', createdAt: '2026-06-12T14:30:00Z' },
  { id: 'c3', marketId: 'm2', userId: 'u1', body: '出来高が伸びてきた。価格の動きが面白い。', createdAt: '2026-06-15T20:10:00Z' },
]

function loadState() {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s) return JSON.parse(s)
  } catch {}
  return null
}

type StoreState = {
  users: User[]
  markets: Market[]
  positions: Position[]
  trades: Trade[]
  ads: Ad[]
  comments: Comment[]
  currentUserId: string | null
}

type StoreActions = {
  login: (userId: string) => void
  logout: () => void
  currentUser: () => User | null

  buyShares: (
    marketId: string,
    side: 'YES' | 'NO',
    shares: number
  ) => { success: boolean; error?: string; cost?: number }

  sellShares: (
    marketId: string,
    side: 'YES' | 'NO',
    shares: number
  ) => { success: boolean; error?: string; refund?: number }

  proposeMarket: (data: {
    question: string
    description: string
    deadline: string
    category: string
    imageUrl?: string
  }) => void

  createMarket: (data: {
    question: string
    description: string
    deadline: string
    category: string
    imageUrl?: string
    b?: number
  }) => void

  addAd: (data: { title: string; imageUrl: string; linkUrl: string }) => void
  updateAd: (id: string, data: Partial<Pick<Ad, 'title' | 'imageUrl' | 'linkUrl'>>) => void
  toggleAd: (id: string) => void
  deleteAd: (id: string) => void

  approveMarket: (marketId: string) => void
  rejectMarket: (marketId: string) => void
  closeMarket: (marketId: string) => void
  resolveMarket: (marketId: string, result: 'YES' | 'NO') => void

  addPoints: (userId: string, amount: number) => void
  changeRole: (userId: string, role: 'user' | 'admin') => void
  registerUser: (name: string) => User

  getPosition: (userId: string, marketId: string) => Position
  getMarketTrades: (marketId: string) => Trade[]
  getUserTrades: (userId: string) => Trade[]

  addComment: (marketId: string, body: string) => void
  getMarketComments: (marketId: string) => Comment[]
}

type Store = StoreState & StoreActions

const saved = loadState()

export const useStore = create<Store>((set, get) => {
  const base: StoreState = {
    users: SEED_USERS,
    markets: SEED_MARKETS,
    positions: SEED_POSITIONS,
    trades: SEED_TRADES,
    ads: SEED_ADS,
    comments: SEED_COMMENTS,
    currentUserId: null,
  }
  const initial: StoreState = saved
    ? {
        ...base,
        ...saved,
        // 旧localStorageにも新しいシード案件を補完（既存IDは保持）
        markets: [
          ...saved.markets,
          ...SEED_MARKETS.filter((sm) => !saved.markets.some((m: Market) => m.id === sm.id)),
        ],
        ads: saved.ads ?? SEED_ADS,
        comments: saved.comments ?? SEED_COMMENTS,
      }
    : base

  const persist = (state: StoreState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {}
  }

  const update = (fn: (s: StoreState) => Partial<StoreState>) => {
    set((s) => {
      const next = { ...s, ...fn(s) }
      persist(next)
      return next
    })
  }

  return {
    ...initial,

    currentUser: () => {
      const { users, currentUserId } = get()
      return users.find((u) => u.id === currentUserId) ?? null
    },

    login: (userId) => update(() => ({ currentUserId: userId })),
    logout: () => update(() => ({ currentUserId: null })),

    buyShares: (marketId, side, shares) => {
      const { markets, users, positions, trades, currentUserId } = get()
      const user = users.find((u) => u.id === currentUserId)
      const market = markets.find((m) => m.id === marketId)

      if (!user) return { success: false, error: 'ログインしてください' }
      if (!market) return { success: false, error: 'マーケットが見つかりません' }
      if (market.status !== 'open') return { success: false, error: 'このマーケットは現在受付中ではありません' }
      if (shares <= 0) return { success: false, error: '0より大きい枚数を入力してください' }

      const cost = buyCost(market, side, shares)
      if (user.points < cost) return { success: false, error: 'ポイントが不足しています' }

      const price = cost / shares
      const now = new Date().toISOString()
      const newQYes = side === 'YES' ? market.q_yes + shares : market.q_yes
      const newQNo = side === 'NO' ? market.q_no + shares : market.q_no
      const newYesPrice = currentPrice(newQYes, newQNo, market.b).yes

      const trade: Trade = {
        id: genId(),
        userId: user.id,
        marketId,
        side,
        action: 'buy',
        shares,
        cost,
        pricePerShare: price,
        timestamp: now,
      }

      const existingPos = positions.find(
        (p) => p.userId === user.id && p.marketId === marketId
      )

      update((s) => ({
        users: s.users.map((u) =>
          u.id === user.id ? { ...u, points: u.points - cost } : u
        ),
        markets: s.markets.map((m) =>
          m.id === marketId
            ? {
                ...m,
                q_yes: newQYes,
                q_no: newQNo,
                volume: m.volume + cost,
                priceHistory: [...m.priceHistory, { t: now, yes: newYesPrice }],
              }
            : m
        ),
        positions: existingPos
          ? s.positions.map((p) =>
              p.userId === user.id && p.marketId === marketId
                ? {
                    ...p,
                    yesShares: side === 'YES' ? p.yesShares + shares : p.yesShares,
                    noShares: side === 'NO' ? p.noShares + shares : p.noShares,
                  }
                : p
            )
          : [
              ...s.positions,
              {
                userId: user.id,
                marketId,
                yesShares: side === 'YES' ? shares : 0,
                noShares: side === 'NO' ? shares : 0,
              },
            ],
        trades: [...s.trades, trade],
      }))

      return { success: true, cost }
    },

    sellShares: (marketId, side, shares) => {
      const { markets, users, positions, trades, currentUserId } = get()
      const user = users.find((u) => u.id === currentUserId)
      const market = markets.find((m) => m.id === marketId)
      const pos = positions.find((p) => p.userId === currentUserId && p.marketId === marketId)

      if (!user) return { success: false, error: 'ログインしてください' }
      if (!market) return { success: false, error: 'マーケットが見つかりません' }
      if (market.status !== 'open') return { success: false, error: 'このマーケットは現在受付中ではありません' }
      if (shares <= 0) return { success: false, error: '0より大きい枚数を入力してください' }

      const held = side === 'YES' ? (pos?.yesShares ?? 0) : (pos?.noShares ?? 0)
      if (held < shares) return { success: false, error: '保有シェアが不足しています' }

      const refund = sellRefund(market, side, shares)
      const price = refund / shares
      const now = new Date().toISOString()
      const newQYes = side === 'YES' ? market.q_yes - shares : market.q_yes
      const newQNo = side === 'NO' ? market.q_no - shares : market.q_no
      const newYesPrice = currentPrice(newQYes, newQNo, market.b).yes

      const trade: Trade = {
        id: genId(),
        userId: user.id,
        marketId,
        side,
        action: 'sell',
        shares,
        cost: refund,
        pricePerShare: price,
        timestamp: now,
      }

      update((s) => ({
        users: s.users.map((u) =>
          u.id === user.id ? { ...u, points: u.points + refund } : u
        ),
        markets: s.markets.map((m) =>
          m.id === marketId
            ? {
                ...m,
                q_yes: newQYes,
                q_no: newQNo,
                priceHistory: [...m.priceHistory, { t: now, yes: newYesPrice }],
              }
            : m
        ),
        positions: s.positions.map((p) =>
          p.userId === user.id && p.marketId === marketId
            ? {
                ...p,
                yesShares: side === 'YES' ? p.yesShares - shares : p.yesShares,
                noShares: side === 'NO' ? p.noShares - shares : p.noShares,
              }
            : p
        ),
        trades: [...s.trades, trade],
      }))

      return { success: true, refund }
    },

    proposeMarket: (data) => {
      const { currentUserId } = get()
      if (!currentUserId) return
      const now = new Date().toISOString()
      const market: Market = {
        id: genId(),
        question: data.question,
        description: data.description,
        deadline: data.deadline,
        status: 'pending',
        q_yes: 0,
        q_no: 0,
        b: 100,
        resolved: null,
        createdBy: currentUserId,
        createdAt: now,
        category: data.category as Market['category'],
        volume: 0,
        imageUrl: data.imageUrl,
        priceHistory: [],
      }
      update((s) => ({ markets: [...s.markets, market] }))
    },

    createMarket: (data) => {
      const { currentUserId } = get()
      if (!currentUserId) return
      const now = new Date().toISOString()
      const b = data.b && data.b > 0 ? data.b : 100
      const market: Market = {
        id: genId(),
        question: data.question,
        description: data.description,
        deadline: data.deadline,
        status: 'open',
        q_yes: 0,
        q_no: 0,
        b,
        resolved: null,
        createdBy: currentUserId,
        createdAt: now,
        category: data.category as Market['category'],
        volume: 0,
        imageUrl: data.imageUrl,
        priceHistory: [{ t: now, yes: 0.5 }],
      }
      update((s) => ({ markets: [...s.markets, market] }))
    },

    addAd: (data) =>
      update((s) => ({
        ads: [
          ...s.ads,
          {
            id: genId(),
            title: data.title,
            imageUrl: data.imageUrl,
            linkUrl: data.linkUrl,
            active: true,
            createdAt: new Date().toISOString(),
          },
        ],
      })),

    updateAd: (id, data) =>
      update((s) => ({
        ads: s.ads.map((a) => (a.id === id ? { ...a, ...data } : a)),
      })),

    toggleAd: (id) =>
      update((s) => ({
        ads: s.ads.map((a) => (a.id === id ? { ...a, active: !a.active } : a)),
      })),

    deleteAd: (id) =>
      update((s) => ({
        ads: s.ads.filter((a) => a.id !== id),
      })),

    approveMarket: (marketId) => {
      update((s) => ({
        markets: s.markets.map((m) =>
          m.id === marketId ? { ...m, status: 'open', priceHistory: [{ t: new Date().toISOString(), yes: 0.5 }] } : m
        ),
      }))
    },

    rejectMarket: (marketId) => {
      update((s) => ({
        markets: s.markets.filter((m) => m.id !== marketId),
      }))
    },

    closeMarket: (marketId) => {
      update((s) => ({
        markets: s.markets.map((m) =>
          m.id === marketId ? { ...m, status: 'closed' } : m
        ),
      }))
    },

    resolveMarket: (marketId, result) => {
      const { markets, positions } = get()
      const market = markets.find((m) => m.id === marketId)
      if (!market) return

      const marketPositions = positions.filter((p) => p.marketId === marketId)
      const payouts = resolvePayouts(marketPositions, result)

      update((s) => ({
        markets: s.markets.map((m) =>
          m.id === marketId ? { ...m, status: 'resolved', resolved: result } : m
        ),
        users: s.users.map((u) =>
          payouts[u.id] != null ? { ...u, points: u.points + payouts[u.id] } : u
        ),
      }))
    },

    addPoints: (userId, amount) => {
      update((s) => ({
        users: s.users.map((u) =>
          u.id === userId ? { ...u, points: u.points + amount } : u
        ),
      }))
    },

    changeRole: (userId, role) => {
      update((s) => ({
        users: s.users.map((u) => (u.id === userId ? { ...u, role } : u)),
      }))
    },

    registerUser: (name) => {
      const newUser: User = {
        id: genId(),
        name,
        points: 1000,
        role: 'user',
        createdAt: new Date().toISOString(),
      }
      update((s) => ({ users: [...s.users, newUser], currentUserId: newUser.id }))
      return newUser
    },

    getPosition: (userId, marketId) => {
      return (
        get().positions.find((p) => p.userId === userId && p.marketId === marketId) ?? {
          userId,
          marketId,
          yesShares: 0,
          noShares: 0,
        }
      )
    },

    getMarketTrades: (marketId) => get().trades.filter((t) => t.marketId === marketId),
    getUserTrades: (userId) => get().trades.filter((t) => t.userId === userId),

    addComment: (marketId, body) => {
      const { currentUserId } = get()
      const text = body.trim()
      if (!currentUserId || !text) return
      update((s) => ({
        comments: [
          ...s.comments,
          {
            id: genId(),
            marketId,
            userId: currentUserId,
            body: text,
            createdAt: new Date().toISOString(),
          },
        ],
      }))
    },

    getMarketComments: (marketId) =>
      get()
        .comments.filter((c) => c.marketId === marketId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }
})
