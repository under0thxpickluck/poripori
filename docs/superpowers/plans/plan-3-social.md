# MIRAIX — Plan 3: Social Features

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ランキング・アクティビティフィード・ユーザープロフィール・検索・ログイン/登録ページを実装する。

**Architecture:** Plan 1・2 の完了が前提。各ページは Server Components。ログイン/登録は NextAuth v5 の `signIn()` / カスタム登録 API を使用。

**Tech Stack:** Next.js 15 App Router, NextAuth v5, shadcn/ui, Tailwind CSS, date-fns

## Global Constraints (継承)

- 禁止語: 賭ける/ベット/配当 — 使用語: 予測/投票/参加/スコア/的中
- TypeScript strict mode

---

## File Map

| ファイル | 役割 |
|---|---|
| `app/api/rankings/route.ts` | GET ランキング |
| `app/api/activities/route.ts` | GET アクティビティ |
| `app/api/search/route.ts` | GET 検索 |
| `app/api/me/route.ts` | GET 自分のプロフィール |
| `app/api/profile/[id]/route.ts` | GET ユーザープロフィール |
| `app/api/auth/register/route.ts` | POST ユーザー登録 |
| `app/(main)/leaderboard/page.tsx` | ランキングページ |
| `app/(main)/activity/page.tsx` | アクティビティページ |
| `app/(main)/profile/[id]/page.tsx` | プロフィールページ |
| `app/(main)/search/page.tsx` | 検索ページ |
| `app/(auth)/login/page.tsx` | ログインページ |
| `app/(auth)/register/page.tsx` | 登録ページ |
| `app/(auth)/layout.tsx` | 認証レイアウト |
| `components/leaderboard/RankingTable.tsx` | ランキングテーブル |
| `components/activity/ActivityFeed.tsx` | アクティビティフィード |
| `components/activity/ActivityItem.tsx` | アクティビティ1件 |

---

## Task 17: ランキング API & ページ

**Files:**
- Create: `app/api/rankings/route.ts`
- Create: `app/(main)/leaderboard/page.tsx`
- Create: `components/leaderboard/RankingTable.tsx`

**Interfaces:**
- Produces: `GET /api/rankings?type=score|accuracy&period=all|month` → `RankingUser[]`

- [ ] **Step 1: `app/api/rankings/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") ?? "score"
  const period = req.nextUrl.searchParams.get("period") ?? "all"

  const dateFilter = period === "month"
    ? { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
    : {}

  const users = await prisma.user.findMany({
    where: { score: { gt: 0 }, ...dateFilter },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      score: true,
      accuracyRate: true,
      badges: { include: { badge: { select: { name: true, iconUrl: true } } }, take: 3 },
      _count: { select: { predictions: true } },
    },
    orderBy: type === "accuracy" ? { accuracyRate: "desc" } : { score: "desc" },
    take: 50,
  })

  const result = users.map((u) => ({
    ...u,
    predictionCount: u._count.predictions,
  }))

  return NextResponse.json(result)
}
```

- [ ] **Step 2: `components/leaderboard/RankingTable.tsx` を作成**

```typescript
import { RankingUser } from "@/types"
import Link from "next/link"
import { Trophy, Medal } from "lucide-react"

interface Props {
  users: RankingUser[]
  type: "score" | "accuracy"
}

const RANK_COLORS = ["text-yellow-500", "text-gray-400", "text-amber-600"]
const RANK_ICONS = ["🥇", "🥈", "🥉"]

export function RankingTable({ users, type }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-100">
            <th className="text-left py-3 px-2 w-12">順位</th>
            <th className="text-left py-3 px-2">ユーザー</th>
            <th className="text-right py-3 px-2">
              {type === "accuracy" ? "的中率" : "スコア"}
            </th>
            <th className="text-right py-3 px-2">参加数</th>
            <th className="text-right py-3 px-2 hidden md:table-cell">バッジ</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, i) => (
            <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <td className="py-3 px-2">
                <span className={`font-bold text-sm ${RANK_COLORS[i] ?? "text-gray-600"}`}>
                  {i < 3 ? RANK_ICONS[i] : `${i + 1}`}
                </span>
              </td>
              <td className="py-3 px-2">
                <Link href={`/profile/${user.id}`} className="flex items-center gap-2 hover:text-[#3B82F6]">
                  <div className="w-8 h-8 rounded-full bg-[#3B82F6] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {user.name[0]}
                  </div>
                  <span className="text-sm font-medium text-[#0F1117]">{user.name}</span>
                </Link>
              </td>
              <td className="py-3 px-2 text-right">
                <span className="font-bold text-[#0F1117]">
                  {type === "accuracy"
                    ? `${Math.round(user.accuracyRate * 100)}%`
                    : `${user.score.toLocaleString()}pt`}
                </span>
              </td>
              <td className="py-3 px-2 text-right text-sm text-gray-500">
                {user.predictionCount}回
              </td>
              <td className="py-3 px-2 text-right hidden md:table-cell">
                <div className="flex gap-1 justify-end">
                  {user.badges.slice(0, 3).map((b, j) => (
                    <span key={j} title={b.badge.name} className="text-base">
                      {b.badge.name.includes("達人") ? "⭐"
                        : b.badge.name.includes("連続") ? "🔥"
                        : b.badge.name.includes("コメント") ? "💬"
                        : "🏅"}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: `app/(main)/leaderboard/page.tsx` を作成**

```typescript
import { RankingUser } from "@/types"
import { RankingTable } from "@/components/leaderboard/RankingTable"
import Link from "next/link"

interface Props {
  searchParams: Promise<{ type?: string; period?: string }>
}

async function getRankings(type: string, period: string): Promise<RankingUser[]> {
  const res = await fetch(
    `${process.env.NEXTAUTH_URL}/api/rankings?type=${type}&period=${period}`,
    { next: { revalidate: 300 } }
  )
  if (!res.ok) return []
  return res.json()
}

export default async function LeaderboardPage({ searchParams }: Props) {
  const { type = "score", period = "all" } = await searchParams
  const users = await getRankings(type, period)

  const typeLinks = [
    { label: "スコア順", value: "score" },
    { label: "的中率順", value: "accuracy" },
  ]
  const periodLinks = [
    { label: "全期間", value: "all" },
    { label: "今月", value: "month" },
  ]

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#0F1117]">🏆 ランキング</h1>

      <div className="flex flex-wrap gap-4">
        <div className="flex gap-2">
          {typeLinks.map((l) => (
            <Link
              key={l.value}
              href={`/leaderboard?type=${l.value}&period=${period}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                type === l.value
                  ? "bg-[#0F1117] text-white border-[#0F1117]"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          {periodLinks.map((l) => (
            <Link
              key={l.value}
              href={`/leaderboard?type=${type}&period=${l.value}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                period === l.value
                  ? "bg-[#3B82F6] text-white border-[#3B82F6]"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-[#F8F9FA] rounded-xl p-4">
        <RankingTable users={users} type={type as "score" | "accuracy"} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: コミット**

```bash
git add app/api/rankings/ app/\(main\)/leaderboard/ components/leaderboard/
git commit -m "feat: add rankings API and leaderboard page"
```

---

## Task 18: アクティビティフィード

**Files:**
- Create: `app/api/activities/route.ts`
- Create: `app/(main)/activity/page.tsx`
- Create: `components/activity/ActivityItem.tsx`
- Create: `components/activity/ActivityFeed.tsx`

**Interfaces:**
- Produces: `GET /api/activities?type=&limit=` → `Activity[]`

- [ ] **Step 1: `app/api/activities/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type")
  const limit = Math.min(50, parseInt(req.nextUrl.searchParams.get("limit") ?? "30"))

  const where = type ? { actionType: type as any } : {}

  const activities = await prisma.activity.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      market: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return NextResponse.json(activities)
}
```

- [ ] **Step 2: `components/activity/ActivityItem.tsx` を作成**

```typescript
import { Activity } from "@/types"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ja } from "date-fns/locale"

const ACTION_LABELS: Record<string, string> = {
  PREDICT: "が予測に参加",
  COMMENT: "がコメント",
  MARKET_CREATE: "がマーケットを作成",
  MARKET_RESOLVE: "のマーケットが解決",
  LIKE: "がいいね",
}

const ACTION_ICONS: Record<string, string> = {
  PREDICT: "🎯",
  COMMENT: "💬",
  MARKET_CREATE: "📊",
  MARKET_RESOLVE: "✅",
  LIKE: "👍",
}

export function ActivityItem({ activity }: { activity: Activity }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50">
      <span className="text-xl flex-shrink-0 mt-0.5">{ACTION_ICONS[activity.actionType]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#0F1117]">
          <Link href={`/profile/${activity.user.id}`} className="font-medium hover:text-[#3B82F6]">
            {activity.user.name}
          </Link>
          {ACTION_LABELS[activity.actionType]}
          {activity.market && (
            <>
              {" — "}
              <Link href={`/markets/${activity.market.id}`} className="text-[#3B82F6] hover:underline truncate">
                {activity.market.title}
              </Link>
            </>
          )}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {formatDistanceToNow(new Date(activity.createdAt), { locale: ja, addSuffix: true })}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `components/activity/ActivityFeed.tsx` を作成**

```typescript
import { Activity } from "@/types"
import { ActivityItem } from "./ActivityItem"

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return <div className="text-center py-10 text-gray-400 text-sm">アクティビティはまだありません</div>
  }
  return (
    <div>
      {activities.map((a) => <ActivityItem key={a.id} activity={a} />)}
    </div>
  )
}
```

- [ ] **Step 4: `app/(main)/activity/page.tsx` を作成**

```typescript
import { Activity } from "@/types"
import { ActivityFeed } from "@/components/activity/ActivityFeed"
import Link from "next/link"

interface Props {
  searchParams: Promise<{ type?: string }>
}

const FILTERS = [
  { label: "すべて", value: "" },
  { label: "予測参加", value: "PREDICT" },
  { label: "コメント", value: "COMMENT" },
  { label: "マーケット作成", value: "MARKET_CREATE" },
  { label: "解決", value: "MARKET_RESOLVE" },
]

async function getActivities(type: string): Promise<Activity[]> {
  const url = new URL(`${process.env.NEXTAUTH_URL}/api/activities`)
  if (type) url.searchParams.set("type", type)
  const res = await fetch(url.toString(), { next: { revalidate: 30 } })
  if (!res.ok) return []
  return res.json()
}

export default async function ActivityPage({ searchParams }: Props) {
  const { type = "" } = await searchParams
  const activities = await getActivities(type)

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-[#0F1117]">アクティビティ</h1>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/activity?type=${f.value}` : "/activity"}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              type === f.value
                ? "bg-[#0F1117] text-white border-[#0F1117]"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <div className="bg-[#F8F9FA] rounded-xl p-4">
        <ActivityFeed activities={activities} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: コミット**

```bash
git add app/api/activities/ app/\(main\)/activity/ components/activity/
git commit -m "feat: add activities API and activity feed page"
```

---

## Task 19: ユーザープロフィールページ

**Files:**
- Create: `app/api/me/route.ts`
- Create: `app/api/profile/[id]/route.ts`
- Create: `app/(main)/profile/[id]/page.tsx`

**Interfaces:**
- Produces: `GET /api/profile/:id` → `User` + predictions + comments + badges
- Produces: `GET /api/me` → 認証済みユーザーの詳細

- [ ] **Step 1: `app/api/me/route.ts` を作成**

```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, avatarUrl: true,
      bio: true, score: true, accuracyRate: true, isAdmin: true, createdAt: true,
      badges: { include: { badge: true } },
      _count: { select: { predictions: true, comments: true } },
    },
  })
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(user)
}
```

- [ ] **Step 2: `app/api/profile/[id]/route.ts` を作成**

```typescript
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, avatarUrl: true, bio: true,
      score: true, accuracyRate: true, createdAt: true,
      badges: { include: { badge: true } },
      _count: { select: { predictions: true, comments: true } },
      predictions: {
        include: {
          market: { select: { id: true, title: true, status: true } },
          option: { select: { name: true, currentProbability: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  })
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(user)
}
```

- [ ] **Step 3: `app/(main)/profile/[id]/page.tsx` を作成**

```typescript
import { notFound } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { MarketStatus } from "@/types"

interface Props { params: Promise<{ id: string }> }

async function getProfile(id: string) {
  const res = await fetch(`${process.env.NEXTAUTH_URL}/api/profile/${id}`, {
    next: { revalidate: 60 },
  })
  if (!res.ok) return null
  return res.json()
}

export default async function ProfilePage({ params }: Props) {
  const { id } = await params
  const user = await getProfile(id)
  if (!user) notFound()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="bg-[#F8F9FA] rounded-xl p-6 flex items-start gap-4">
        <div className="w-16 h-16 rounded-full bg-[#3B82F6] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
          {user.name[0]}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#0F1117]">{user.name}</h1>
          {user.bio && <p className="text-sm text-gray-500 mt-1">{user.bio}</p>}
          <p className="text-xs text-gray-400 mt-1">
            {format(new Date(user.createdAt), "yyyy年M月", { locale: ja })}から参加
          </p>
        </div>
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "スコア", value: `${user.score.toLocaleString()}pt` },
          { label: "的中率", value: `${Math.round(user.accuracyRate * 100)}%` },
          { label: "参加数", value: `${user._count.predictions}回` },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#F8F9FA] rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-[#0F1117]">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* バッジ */}
      {user.badges.length > 0 && (
        <div className="bg-[#F8F9FA] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-[#0F1117] mb-3">獲得バッジ</h2>
          <div className="flex flex-wrap gap-2">
            {user.badges.map((ub: any) => (
              <div key={ub.badge.id} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5">
                <span className="text-base">🏅</span>
                <div>
                  <p className="text-xs font-medium text-[#0F1117]">{ub.badge.name}</p>
                  <p className="text-xs text-gray-400">{ub.badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 予測履歴 */}
      <div className="bg-[#F8F9FA] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-[#0F1117] mb-3">最近の予測</h2>
        {user.predictions.length === 0 ? (
          <p className="text-sm text-gray-400">まだ予測はありません</p>
        ) : (
          <div className="space-y-3">
            {user.predictions.map((pred: any) => (
              <div key={pred.id} className="flex items-center gap-3 p-3 bg-white rounded-lg">
                <div className="flex-1 min-w-0">
                  <Link href={`/markets/${pred.market.id}`} className="text-sm font-medium text-[#0F1117] hover:text-[#3B82F6] line-clamp-1">
                    {pred.market.title}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">予測: {pred.option.name}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={pred.market.status as MarketStatus} />
                  {pred.isCorrect === true && <span className="text-xs font-medium text-[#10B981]">✓ 的中</span>}
                  {pred.isCorrect === false && <span className="text-xs font-medium text-[#EF4444]">✗ 外れ</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: コミット**

```bash
git add app/api/me/ app/api/profile/ app/\(main\)/profile/
git commit -m "feat: add profile API and user profile page"
```

---

## Task 20: 検索ページ

**Files:**
- Create: `app/api/search/route.ts`
- Create: `app/(main)/search/page.tsx`

**Interfaces:**
- Produces: `GET /api/search?q=` → `{ markets: Market[] }`

- [ ] **Step 1: `app/api/search/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim()
  if (!q || q.length < 2) return NextResponse.json({ markets: [] })

  const markets = await prisma.market.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
      status: { not: "DRAFT" },
    },
    include: {
      category: true,
      options: { orderBy: { sortOrder: "asc" } },
      _count: { select: { predictions: true, comments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  })

  return NextResponse.json({ markets, total: markets.length })
}
```

- [ ] **Step 2: `app/(main)/search/page.tsx` を作成**

```typescript
import { Market } from "@/types"
import { MarketCard } from "@/components/market/MarketCard"

interface Props {
  searchParams: Promise<{ q?: string }>
}

async function searchMarkets(q: string): Promise<Market[]> {
  const res = await fetch(
    `${process.env.NEXTAUTH_URL}/api/search?q=${encodeURIComponent(q)}`,
    { next: { revalidate: 0 } }
  )
  if (!res.ok) return []
  const data = await res.json()
  return data.markets
}

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams
  const markets = q.length >= 2 ? await searchMarkets(q) : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F1117]">検索</h1>
        {q && (
          <p className="text-sm text-gray-500 mt-1">
            「{q}」の検索結果: {markets.length}件
          </p>
        )}
      </div>

      {!q && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">🔍</p>
          <p>ヘッダーの検索バーでキーワードを入力してください</p>
        </div>
      )}

      {q && markets.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          「{q}」に一致するマーケットは見つかりませんでした
        </div>
      )}

      {markets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets.map((m) => <MarketCard key={m.id} market={m} />)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: コミット**

```bash
git add app/api/search/ app/\(main\)/search/
git commit -m "feat: add search API and search page"
```

---

## Task 21: ログイン / 登録ページ

**Files:**
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/register/page.tsx`
- Create: `app/api/auth/register/route.ts`

**Interfaces:**
- Produces: `POST /api/auth/register { name, email, password }` → `{ user }` or `{ error }`
- Produces: ログイン後 `/` にリダイレクト

- [ ] **Step 1: `app/(auth)/layout.tsx` を作成**

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-[#0F1117]">MIRAIX</h1>
          <p className="text-sm text-gray-500 mt-1">未来を予測する</p>
        </div>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `app/api/auth/register/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json()

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "すべての項目を入力してください" }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "パスワードは8文字以上にしてください" }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "このメールアドレスは既に使われています" }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { name: name.trim(), email: email.trim().toLowerCase(), passwordHash },
    select: { id: true, name: true, email: true },
  })

  return NextResponse.json({ user }, { status: 201 })
}
```

- [ ] **Step 3: `app/(auth)/login/page.tsx` を作成**

```typescript
"use client"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    const res = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    })
    setLoading(false)
    if (res?.error) {
      setError("メールアドレスまたはパスワードが正しくありません")
    } else {
      router.push("/")
      router.refresh()
    }
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
      <h2 className="text-xl font-bold text-[#0F1117] mb-6">ログイン</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="email" className="text-sm">メールアドレス</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
            required
            className="h-10"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password" className="text-sm">パスワード</Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
            required
            className="h-10"
          />
        </div>
        {error && <p className="text-sm text-[#EF4444]">{error}</p>}
        <Button type="submit" className="w-full bg-[#0F1117] hover:bg-gray-800" disabled={loading}>
          {loading ? "ログイン中..." : "ログイン"}
        </Button>
      </form>
      <p className="text-sm text-gray-500 text-center mt-4">
        アカウントをお持ちでない方は{" "}
        <Link href="/register" className="text-[#3B82F6] hover:underline">新規登録</Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 4: `app/(auth)/register/page.tsx` を作成**

```typescript
"use client"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: "", email: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }

      await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      })
      router.push("/")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
      <h2 className="text-xl font-bold text-[#0F1117] mb-6">新規登録</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="name" className="text-sm">ユーザー名</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="田中太郎"
            required
            className="h-10"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="email" className="text-sm">メールアドレス</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
            required
            className="h-10"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password" className="text-sm">パスワード（8文字以上）</Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
            minLength={8}
            required
            className="h-10"
          />
        </div>
        {error && <p className="text-sm text-[#EF4444]">{error}</p>}
        <Button type="submit" className="w-full bg-[#0F1117] hover:bg-gray-800" disabled={loading}>
          {loading ? "登録中..." : "アカウントを作成"}
        </Button>
      </form>
      <p className="text-sm text-gray-500 text-center mt-4">
        既にアカウントをお持ちの方は{" "}
        <Link href="/login" className="text-[#3B82F6] hover:underline">ログイン</Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 5: 動作確認**

```bash
npm run dev
```

1. `http://localhost:3000/register` でアカウント作成
2. `http://localhost:3000/login` でログイン
3. ヘッダーにユーザー名が表示されることを確認

- [ ] **Step 6: コミット**

```bash
git add app/\(auth\)/ app/api/auth/register/
git commit -m "feat: add login and register pages with NextAuth credentials"
```

---

## Plan 3 完了チェック

- [ ] `http://localhost:3000/leaderboard` でランキングが表示
- [ ] `http://localhost:3000/activity` でアクティビティフィードが表示
- [ ] `http://localhost:3000/profile/:id` でプロフィールが表示
- [ ] `http://localhost:3000/search?q=AI` で検索結果が表示
- [ ] 新規登録 → ログイン → ログアウトが正常動作

**次のプラン:** `plan-4-admin-mentions.md` — 管理画面・マーケット解決・メンション予測
