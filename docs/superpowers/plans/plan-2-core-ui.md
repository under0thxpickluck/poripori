# MIRAIX — Plan 2: Core UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** レイアウト・Header・MarketCard・トップページ・マーケット一覧・詳細・投票・コメント・カテゴリページを実装する。

**Architecture:** Plan 1 の完了が前提。全ページは Next.js App Router の Server Components + Client Components で構成。API Route から Prisma 経由でデータ取得。

**Tech Stack:** Next.js 15 App Router, shadcn/ui, Tailwind CSS, Recharts, TanStack Query, lucide-react, date-fns

## Global Constraints (Plan 1 から継承)

- 禁止語: 賭ける/ベット/配当/出金/投資 — 使用語: 予測/投票/参加/スコア/的中
- 確率値は DB では 0.0〜1.0、UI では 0〜100% 表示
- TypeScript strict mode 有効
- カラー: 背景 #FFFFFF、カード #F8F9FA、テキスト #0F1117、青 #3B82F6、緑 #10B981、赤 #EF4444

---

## File Map

| ファイル | 役割 |
|---|---|
| `app/layout.tsx` | ルートレイアウト (Providers 含む) |
| `app/(main)/layout.tsx` | メインレイアウト (Header 含む) |
| `components/providers.tsx` | TanStack Query + SessionProvider |
| `components/layout/Header.tsx` | ヘッダー (検索・カテゴリ・ログイン) |
| `components/ui/StatusBadge.tsx` | ステータスラベル |
| `components/ui/ProbabilityBadge.tsx` | 確率バッジ |
| `components/ui/CategoryChip.tsx` | カテゴリチップ |
| `components/market/PredictionBar.tsx` | YES/NOバー |
| `components/market/MarketCard.tsx` | マーケットカード |
| `components/market/ProbabilityChart.tsx` | Recharts 折れ線 |
| `components/market/OptionVoteButton.tsx` | 投票ボタン |
| `components/comment/CommentList.tsx` | コメント一覧 |
| `components/comment/CommentForm.tsx` | コメント投稿フォーム |
| `components/comment/CommentItem.tsx` | コメント1件 |
| `app/(main)/page.tsx` | トップページ |
| `app/(main)/markets/page.tsx` | マーケット一覧 |
| `app/(main)/markets/[id]/page.tsx` | マーケット詳細 |
| `app/(main)/categories/[slug]/page.tsx` | カテゴリページ |
| `app/api/markets/route.ts` | GET 一覧 |
| `app/api/markets/[id]/route.ts` | GET 詳細 |
| `app/api/categories/route.ts` | GET カテゴリ一覧 |
| `app/api/markets/[id]/predict/route.ts` | POST 投票 |
| `app/api/markets/[id]/comments/route.ts` | GET/POST コメント |

---

## Task 7: Providers & ルートレイアウト

**Files:**
- Create: `components/providers.tsx`
- Modify: `app/layout.tsx`
- Create: `app/(main)/layout.tsx`

**Interfaces:**
- Produces: 全ページで `useSession()`, `useQuery()` が使える

- [ ] **Step 1: `components/providers.tsx` を作成**

```typescript
"use client"
import { SessionProvider } from "next-auth/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
  }))

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SessionProvider>
  )
}
```

- [ ] **Step 2: `app/layout.tsx` を更新**

```typescript
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "MIRAIX — 未来を予測する",
  description: "世界中の出来事を、みんなの予測で可視化する。金銭不要の予測プラットフォーム。",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${inter.className} bg-white text-[#0F1117] antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: `app/(main)/layout.tsx` を作成**

```typescript
import { Header } from "@/components/layout/Header"

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 4: コミット**

```bash
git add app/layout.tsx app/\(main\)/layout.tsx components/providers.tsx
git commit -m "feat: add Providers and root layouts"
```

---

## Task 8: UI 基本コンポーネント & Header

**Files:**
- Create: `components/ui/StatusBadge.tsx`
- Create: `components/ui/ProbabilityBadge.tsx`
- Create: `components/ui/CategoryChip.tsx`
- Create: `components/market/PredictionBar.tsx`
- Create: `components/layout/Header.tsx`

**Interfaces:**
- Produces: `<StatusBadge status />`, `<ProbabilityBadge probability />`, `<CategoryChip label slug />`, `<PredictionBar probability />`, `<Header />`

- [ ] **Step 1: `components/ui/StatusBadge.tsx` を作成**

```typescript
import { MarketStatus } from "@/types"

const cfg: Record<MarketStatus, { label: string; cls: string }> = {
  DRAFT:     { label: "下書き",   cls: "bg-gray-100 text-gray-600" },
  UPCOMING:  { label: "開始前",   cls: "bg-blue-100 text-blue-700" },
  LIVE:      { label: "ライブ",   cls: "bg-green-100 text-green-700" },
  SUSPENDED: { label: "停止中",   cls: "bg-orange-100 text-orange-700" },
  RESOLVING: { label: "判定中",   cls: "bg-yellow-100 text-yellow-700" },
  RESOLVED:  { label: "解決済み", cls: "bg-gray-100 text-gray-500" },
  CANCELLED: { label: "中止",     cls: "bg-red-100 text-red-500" },
}

export function StatusBadge({ status }: { status: MarketStatus }) {
  const { label, cls } = cfg[status]
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${cls}`}>
      {status === "LIVE" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse" />}
      {label}
    </span>
  )
}
```

- [ ] **Step 2: `components/ui/ProbabilityBadge.tsx` を作成**

```typescript
export function ProbabilityBadge({ probability }: { probability: number }) {
  const pct = Math.round(probability * 100)
  const color =
    probability >= 0.6 ? "text-[#10B981]"
    : probability <= 0.4 ? "text-[#EF4444]"
    : "text-[#3B82F6]"
  return <span className={`font-bold text-sm ${color}`}>{pct}%</span>
}
```

- [ ] **Step 3: `components/ui/CategoryChip.tsx` を作成**

```typescript
"use client"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

export function CategoryChip({ label, slug }: { label: string; slug: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentCat = searchParams.get("category") ?? ""
  const isActive = slug === "" ? currentCat === "" : currentCat === slug
  const href = slug === "" ? "/markets" : `/markets?category=${slug}`

  return (
    <Link
      href={href}
      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        isActive
          ? "bg-[#0F1117] text-white"
          : "bg-[#F8F9FA] text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
    </Link>
  )
}
```

- [ ] **Step 4: `components/market/PredictionBar.tsx` を作成**

```typescript
export function PredictionBar({ probability }: { probability: number }) {
  const yes = Math.round(probability * 100)
  const no = 100 - yes
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-200">
      <div className="bg-[#3B82F6] transition-all" style={{ width: `${yes}%` }} />
      <div className="bg-[#EF4444] transition-all" style={{ width: `${no}%` }} />
    </div>
  )
}
```

- [ ] **Step 5: `components/layout/Header.tsx` を作成**

```typescript
"use client"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, LogOut, User } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, Suspense } from "react"
import { CategoryChip } from "@/components/ui/CategoryChip"

const CATEGORIES = [
  { label: "すべて", slug: "" },
  { label: "政治", slug: "politics" },
  { label: "スポーツ", slug: "sports" },
  { label: "暗号資産", slug: "crypto" },
  { label: "経済", slug: "economics" },
  { label: "AI", slug: "ai" },
  { label: "テクノロジー", slug: "technology" },
  { label: "エンタメ", slug: "entertainment" },
  { label: "天気", slug: "weather" },
  { label: "メンション", slug: "mentions" },
  { label: "選挙", slug: "election" },
]

function CategoryBar() {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {CATEGORIES.map((c) => (
        <CategoryChip key={c.slug} label={c.label} slug={c.slug} />
      ))}
    </div>
  )
}

export function Header() {
  const { data: session } = useSession()
  const router = useRouter()
  const [q, setQ] = useState("")

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        <Link href="/" className="text-xl font-black text-[#0F1117] tracking-tight">
          MIRAIX
        </Link>
        <form onSubmit={handleSearch} className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="マーケットを検索..."
            className="pl-9 h-9 text-sm bg-[#F8F9FA] border-0"
          />
        </form>
        <div className="flex items-center gap-2 ml-auto">
          {session ? (
            <div className="flex items-center gap-2">
              <Link href={`/profile/${session.user.id}`} className="flex items-center gap-1.5 text-sm font-medium hover:text-[#3B82F6]">
                <div className="w-7 h-7 rounded-full bg-[#3B82F6] flex items-center justify-center text-white text-xs font-bold">
                  {session.user.name?.[0] ?? "U"}
                </div>
                <span className="hidden md:block">{session.user.name}</span>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
                <LogOut size={15} />
              </Button>
            </div>
          ) : (
            <>
              <Link href="/login"><Button variant="ghost" size="sm">ログイン</Button></Link>
              <Link href="/register"><Button size="sm" className="bg-[#0F1117] hover:bg-gray-800">新規登録</Button></Link>
            </>
          )}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 pb-2">
        <Suspense>
          <CategoryBar />
        </Suspense>
      </div>
    </header>
  )
}
```

- [ ] **Step 6: コミット**

```bash
git add components/
git commit -m "feat: add StatusBadge, ProbabilityBadge, CategoryChip, PredictionBar, Header"
```

---

## Task 9: Markets API Routes

**Files:**
- Create: `app/api/markets/route.ts`
- Create: `app/api/markets/[id]/route.ts`
- Create: `app/api/categories/route.ts`

**Interfaces:**
- Produces: `GET /api/markets?category=&status=&sort=&page=&limit=` → `{ markets: Market[], total, page, limit }`
- Produces: `GET /api/markets/:id` → `Market` (options・_count 含む)
- Produces: `GET /api/categories` → `Category[]`

- [ ] **Step 1: `app/api/markets/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { MarketStatus } from "@/types"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const status = searchParams.get("status") as MarketStatus | null
  const category = searchParams.get("category")
  const sort = searchParams.get("sort") ?? "createdAt"
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20"))

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (category) where.category = { slug: category }

  const orderBy =
    sort === "popular" ? { predictions: { _count: "desc" as const } }
    : sort === "comments" ? { comments: { _count: "desc" as const } }
    : { createdAt: "desc" as const }

  const [markets, total] = await Promise.all([
    prisma.market.findMany({
      where,
      include: {
        category: true,
        options: { orderBy: { sortOrder: "asc" } },
        _count: { select: { predictions: true, comments: true } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.market.count({ where }),
  ])

  return NextResponse.json({ markets, total, page, limit })
}
```

- [ ] **Step 2: `app/api/markets/[id]/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const market = await prisma.market.findUnique({
    where: { id },
    include: {
      category: true,
      options: { orderBy: { sortOrder: "asc" } },
      _count: { select: { predictions: true, comments: true } },
      creator: { select: { id: true, name: true, avatarUrl: true } },
    },
  })
  if (!market) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(market)
}
```

- [ ] **Step 3: `app/api/categories/route.ts` を作成**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } })
  return NextResponse.json(categories)
}
```

- [ ] **Step 4: 動作確認**

```bash
npm run dev
curl "http://localhost:3000/api/markets" | head -c 300
curl "http://localhost:3000/api/categories"
```

期待: JSON でマーケットとカテゴリが返る。

- [ ] **Step 5: コミット**

```bash
git add app/api/markets/ app/api/categories/
git commit -m "feat: add markets and categories API routes"
```

---

## Task 10: MarketCard コンポーネント

**Files:**
- Create: `components/market/MarketCard.tsx`

**Interfaces:**
- Consumes: `Market` 型 (options・_count・category 含む)
- Produces: `<MarketCard market />` — クリックで `/markets/:id` へ遷移

- [ ] **Step 1: `components/market/MarketCard.tsx` を作成**

```typescript
import { Market } from "@/types"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { ProbabilityBadge } from "@/components/ui/ProbabilityBadge"
import { PredictionBar } from "./PredictionBar"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ja } from "date-fns/locale"
import { Users, MessageCircle, Clock } from "lucide-react"

export function MarketCard({ market }: { market: Market }) {
  const topOption = market.options[0]

  return (
    <Link href={`/markets/${market.id}`} className="block">
      <div className="bg-[#F8F9FA] rounded-xl p-4 hover:shadow-md transition-all border border-gray-100 h-full">
        {market.imageUrl && (
          <img
            src={market.imageUrl}
            alt={market.title}
            className="w-full h-28 object-cover rounded-lg mb-3"
          />
        )}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-sm text-[#0F1117] line-clamp-2 flex-1 leading-snug">
            {market.title}
          </h3>
          <StatusBadge status={market.status} />
        </div>
        <p className="text-xs text-gray-500 mb-3">{market.category.name}</p>

        {topOption && (
          <div className="mb-3 space-y-1.5">
            {market.options.map((opt) => (
              <div key={opt.id}>
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-xs text-gray-700">{opt.name}</span>
                  <ProbabilityBadge probability={opt.currentProbability} />
                </div>
                <PredictionBar probability={opt.currentProbability} />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-gray-400 pt-2 border-t border-gray-100">
          <span className="flex items-center gap-1">
            <Users size={11} />
            {market._count?.predictions ?? 0}人参加
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle size={11} />
            {market._count?.comments ?? 0}
          </span>
          <span className="flex items-center gap-1 ml-auto">
            <Clock size={11} />
            {formatDistanceToNow(new Date(market.endAt), { locale: ja, addSuffix: true })}
          </span>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add components/market/MarketCard.tsx
git commit -m "feat: add MarketCard component"
```

---

## Task 11: トップページ

**Files:**
- Modify: `app/(main)/page.tsx`

**Interfaces:**
- Consumes: `GET /api/markets?status=LIVE&limit=6`, `GET /api/categories`
- Produces: ヒーロー + 注目マーケット6件 + カテゴリ一覧

- [ ] **Step 1: `app/(main)/page.tsx` を作成**

```typescript
import { Market, Category } from "@/types"
import { MarketCard } from "@/components/market/MarketCard"
import Link from "next/link"

async function getFeaturedMarkets(): Promise<Market[]> {
  const res = await fetch(`${process.env.NEXTAUTH_URL}/api/markets?status=LIVE&limit=6`, {
    next: { revalidate: 60 },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.markets
}

async function getCategories(): Promise<Category[]> {
  const res = await fetch(`${process.env.NEXTAUTH_URL}/api/categories`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) return []
  return res.json()
}

export default async function HomePage() {
  const [markets, categories] = await Promise.all([
    getFeaturedMarkets(),
    getCategories(),
  ])

  return (
    <div className="space-y-12">
      {/* ヒーロー */}
      <section className="text-center py-16 bg-gradient-to-b from-gray-50 to-white rounded-2xl">
        <h1 className="text-4xl md:text-5xl font-black text-[#0F1117] mb-4 leading-tight">
          世界中の出来事を、<br />
          <span className="text-[#3B82F6]">みんなの予測</span>で可視化する。
        </h1>
        <p className="text-gray-500 text-lg mb-8 max-w-xl mx-auto">
          金銭不要。スコアと的中率で競う、日本発の予測プラットフォーム。
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/markets"
            className="bg-[#0F1117] text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
          >
            マーケットを見る
          </Link>
          <Link
            href="/register"
            className="bg-white border border-gray-200 text-[#0F1117] px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            無料で参加
          </Link>
        </div>
      </section>

      {/* 注目マーケット */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#0F1117]">🔥 注目マーケット</h2>
          <Link href="/markets" className="text-sm text-[#3B82F6] hover:underline">すべて見る →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets.map((m) => <MarketCard key={m.id} market={m} />)}
        </div>
      </section>

      {/* カテゴリ */}
      <section>
        <h2 className="text-xl font-bold text-[#0F1117] mb-4">カテゴリから探す</h2>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/markets?category=${cat.slug}`}
              className="bg-[#F8F9FA] border border-gray-100 rounded-xl p-4 text-center hover:shadow-md transition-all"
            >
              <div className="text-2xl mb-1">
                {cat.slug === "politics" ? "🏛️"
                  : cat.slug === "sports" ? "⚽"
                  : cat.slug === "crypto" ? "₿"
                  : cat.slug === "economics" ? "📈"
                  : cat.slug === "ai" ? "🤖"
                  : cat.slug === "technology" ? "💻"
                  : cat.slug === "entertainment" ? "🎬"
                  : cat.slug === "weather" ? "🌤️"
                  : cat.slug === "election" ? "🗳️"
                  : "📌"}
              </div>
              <p className="text-xs font-medium text-[#0F1117]">{cat.name}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: 動作確認**

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開き、ヒーローセクション・マーケットカード・カテゴリが表示されることを確認。

- [ ] **Step 3: コミット**

```bash
git add app/\(main\)/page.tsx
git commit -m "feat: add top page with hero, featured markets, and categories"
```

---

## Task 12: マーケット一覧ページ

**Files:**
- Create: `app/(main)/markets/page.tsx`

**Interfaces:**
- Consumes: `GET /api/markets?category=&status=&sort=&page=`
- Produces: フィルター付きマーケット一覧

- [ ] **Step 1: `app/(main)/markets/page.tsx` を作成**

```typescript
import { Market } from "@/types"
import { MarketCard } from "@/components/market/MarketCard"
import Link from "next/link"

interface Props {
  searchParams: Promise<{ category?: string; status?: string; sort?: string; page?: string }>
}

async function getMarkets(params: Awaited<Props["searchParams"]>): Promise<{ markets: Market[]; total: number }> {
  const url = new URL(`${process.env.NEXTAUTH_URL}/api/markets`)
  if (params.category) url.searchParams.set("category", params.category)
  if (params.status) url.searchParams.set("status", params.status)
  if (params.sort) url.searchParams.set("sort", params.sort)
  url.searchParams.set("page", params.page ?? "1")
  url.searchParams.set("limit", "20")
  const res = await fetch(url.toString(), { next: { revalidate: 30 } })
  if (!res.ok) return { markets: [], total: 0 }
  return res.json()
}

const FILTERS = [
  { label: "すべて", status: "" },
  { label: "ライブ", status: "LIVE" },
  { label: "開始前", status: "UPCOMING" },
  { label: "解決済み", status: "RESOLVED" },
]

const SORTS = [
  { label: "新着順", value: "createdAt" },
  { label: "人気順", value: "popular" },
  { label: "コメント順", value: "comments" },
]

export default async function MarketsPage({ searchParams }: Props) {
  const params = await searchParams
  const { markets, total } = await getMarkets(params)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0F1117]">マーケット一覧</h1>
        <span className="text-sm text-gray-500">{total}件</span>
      </div>

      {/* フィルター */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.status}
            href={`/markets?${new URLSearchParams({ ...params, status: f.status, page: "1" })}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              (params.status ?? "") === f.status
                ? "bg-[#0F1117] text-white border-[#0F1117]"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
        <div className="ml-auto flex gap-2">
          {SORTS.map((s) => (
            <Link
              key={s.value}
              href={`/markets?${new URLSearchParams({ ...params, sort: s.value, page: "1" })}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                (params.sort ?? "createdAt") === s.value
                  ? "bg-[#0F1117] text-white border-[#0F1117]"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {/* グリッド */}
      {markets.length === 0 ? (
        <div className="text-center py-20 text-gray-400">マーケットが見つかりませんでした</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets.map((m) => <MarketCard key={m.id} market={m} />)}
        </div>
      )}

      {/* ページネーション */}
      {total > 20 && (
        <div className="flex justify-center gap-2 pt-4">
          {Array.from({ length: Math.ceil(total / 20) }, (_, i) => i + 1).slice(0, 10).map((p) => (
            <Link
              key={p}
              href={`/markets?${new URLSearchParams({ ...params, page: String(p) })}`}
              className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium border transition-colors ${
                (parseInt(params.page ?? "1")) === p
                  ? "bg-[#0F1117] text-white border-[#0F1117]"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add app/\(main\)/markets/page.tsx
git commit -m "feat: add market list page with filters and pagination"
```

---

## Task 13: ProbabilityChart (Recharts)

**Files:**
- Create: `components/market/ProbabilityChart.tsx`

**Interfaces:**
- Produces: `<ProbabilityChart data optionName />` — 確率推移折れ線グラフ
- `data: { date: string; probability: number }[]` — dateはISO文字列

- [ ] **Step 1: `components/market/ProbabilityChart.tsx` を作成**

```typescript
"use client"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts"
import { format } from "date-fns"
import { ja } from "date-fns/locale"

interface DataPoint { date: string; probability: number }

interface Props {
  data: DataPoint[]
  optionName: string
}

export function ProbabilityChart({ data, optionName }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    probability: Math.round(d.probability * 100),
  }))

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => format(new Date(v), "M/d", { locale: ja })}
          tick={{ fontSize: 11, fill: "#6B7280" }}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: "#6B7280" }}
          width={36}
        />
        <Tooltip
          formatter={(v: number) => [`${v}%`, optionName]}
          labelFormatter={(l) => format(new Date(l), "yyyy/M/d HH:mm", { locale: ja })}
          contentStyle={{ fontSize: 12, border: "1px solid #E5E7EB" }}
        />
        <ReferenceLine y={50} stroke="#E5E7EB" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="probability"
          stroke="#3B82F6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#3B82F6" }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add components/market/ProbabilityChart.tsx
git commit -m "feat: add ProbabilityChart with Recharts"
```

---

## Task 14: マーケット詳細ページ & 投票 API

**Files:**
- Create: `app/(main)/markets/[id]/page.tsx`
- Create: `components/market/OptionVoteButton.tsx`
- Create: `app/api/markets/[id]/predict/route.ts`

**Interfaces:**
- Consumes: `GET /api/markets/:id`
- Produces: `POST /api/markets/:id/predict { optionId }` → `{ prediction }`

- [ ] **Step 1: `app/api/markets/[id]/predict/route.ts` を作成**

```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: marketId } = await params
  const body = await req.json()
  const { optionId } = body

  if (!optionId) return NextResponse.json({ error: "optionId required" }, { status: 400 })

  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: { options: true },
  })
  if (!market || market.status !== "LIVE") {
    return NextResponse.json({ error: "Market not available for prediction" }, { status: 400 })
  }

  const option = market.options.find((o) => o.id === optionId)
  if (!option) return NextResponse.json({ error: "Invalid option" }, { status: 400 })

  const prediction = await prisma.prediction.upsert({
    where: { userId_marketId: { userId: session.user.id, marketId } },
    create: { userId: session.user.id, marketId, optionId },
    update: { optionId, updatedAt: new Date() },
  })

  // 全選択肢の確率を再計算
  const totalVotes = await prisma.prediction.count({ where: { marketId } })
  await Promise.all(
    market.options.map(async (o) => {
      const votes = await prisma.prediction.count({ where: { marketId, optionId: o.id } })
      await prisma.marketOption.update({
        where: { id: o.id },
        data: {
          currentProbability: totalVotes > 0 ? votes / totalVotes : 1 / market.options.length,
          yesCount: votes,
        },
      })
    })
  )

  await prisma.activity.create({
    data: {
      userId: session.user.id,
      actionType: "PREDICT",
      marketId,
      metadata: { optionId, optionName: option.name },
    },
  })

  await prisma.user.update({
    where: { id: session.user.id },
    data: { score: { increment: 1 } },
  })

  return NextResponse.json({ prediction })
}
```

- [ ] **Step 2: `components/market/OptionVoteButton.tsx` を作成**

```typescript
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { MarketOption } from "@/types"
import { PredictionBar } from "./PredictionBar"

interface Props {
  marketId: string
  option: MarketOption
  isSelected: boolean
  onVoteSuccess: () => void
}

export function OptionVoteButton({ marketId, option, isSelected, onVoteSuccess }: Props) {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleVote = async () => {
    if (!session) { router.push("/login"); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/markets/${marketId}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId: option.id }),
      })
      if (res.ok) onVoteSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={`border rounded-xl p-4 cursor-pointer transition-all ${
        isSelected ? "border-[#3B82F6] bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"
      }`}
      onClick={handleVote}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium text-sm text-[#0F1117]">{option.name}</span>
        <span className={`font-bold text-lg ${isSelected ? "text-[#3B82F6]" : "text-gray-700"}`}>
          {Math.round(option.currentProbability * 100)}%
        </span>
      </div>
      <PredictionBar probability={option.currentProbability} />
      <div className="flex justify-between items-center mt-2">
        <span className="text-xs text-gray-400">{option.yesCount}人が予測</span>
        {isSelected && (
          <span className="text-xs font-medium text-[#3B82F6]">✓ あなたの予測</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `app/(main)/markets/[id]/page.tsx` を作成**

```typescript
import { Market } from "@/types"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { ProbabilityChart } from "@/components/market/ProbabilityChart"
import { MarketDetailClient } from "./MarketDetailClient"
import { formatDistanceToNow, format } from "date-fns"
import { ja } from "date-fns/locale"
import { Users, MessageCircle, Clock, ExternalLink } from "lucide-react"

interface Props { params: Promise<{ id: string }> }

export default async function MarketDetailPage({ params }: Props) {
  const { id } = await params
  const [session, market] = await Promise.all([
    auth(),
    prisma.market.findUnique({
      where: { id },
      include: {
        category: true,
        options: { orderBy: { sortOrder: "asc" } },
        _count: { select: { predictions: true, comments: true } },
        creator: { select: { id: true, name: true } },
      },
    }),
  ])

  if (!market) notFound()

  const userPrediction = session?.user?.id
    ? await prisma.prediction.findUnique({
        where: { userId_marketId: { userId: session.user.id, marketId: id } },
      })
    : null

  // 簡易確率推移データ（現在値から過去7日分をシミュレート）
  const chartData = Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString(),
    probability: Math.max(0.05, Math.min(0.95,
      market.options[0].currentProbability + (Math.random() - 0.5) * 0.1
    )),
  }))

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-500">{market.category.name}</span>
          <StatusBadge status={market.status} />
        </div>
        <h1 className="text-2xl font-bold text-[#0F1117] leading-tight">{market.title}</h1>
        <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
          <span className="flex items-center gap-1.5"><Users size={14} />{market._count.predictions}人参加</span>
          <span className="flex items-center gap-1.5"><MessageCircle size={14} />{market._count.comments}コメント</span>
          <span className="flex items-center gap-1.5 ml-auto">
            <Clock size={14} />
            {formatDistanceToNow(new Date(market.endAt), { locale: ja, addSuffix: true })}終了
          </span>
        </div>
      </div>

      {/* チャート */}
      <div className="bg-[#F8F9FA] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-[#0F1117] mb-3">確率推移</h2>
        <ProbabilityChart data={chartData} optionName={market.options[0]?.name ?? ""} />
      </div>

      {/* 投票 (Client Component) */}
      <MarketDetailClient
        market={market as unknown as Market}
        userPredictionOptionId={userPrediction?.optionId ?? null}
      />

      {/* 解決条件 */}
      <div className="bg-[#F8F9FA] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-[#0F1117] mb-2">解決条件</h2>
        <p className="text-sm text-gray-600">{market.resolutionRule}</p>
        <div className="mt-3 text-xs text-gray-400">
          <p>終了日: {format(new Date(market.endAt), "yyyy年M月d日 HH:mm", { locale: ja })}</p>
          <p>作成者: {market.creator.name}</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `app/(main)/markets/[id]/MarketDetailClient.tsx` を作成**

```typescript
"use client"
import { useState } from "react"
import { Market } from "@/types"
import { OptionVoteButton } from "@/components/market/OptionVoteButton"
import { CommentList } from "@/components/comment/CommentList"
import { CommentForm } from "@/components/comment/CommentForm"

interface Props {
  market: Market
  userPredictionOptionId: string | null
}

export function MarketDetailClient({ market, userPredictionOptionId }: Props) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(userPredictionOptionId)
  const [options, setOptions] = useState(market.options)

  const handleVoteSuccess = async () => {
    const res = await fetch(`/api/markets/${market.id}`)
    if (res.ok) {
      const updated = await res.json()
      setOptions(updated.options)
    }
  }

  return (
    <div className="space-y-6">
      {/* 投票エリア */}
      <div>
        <h2 className="text-sm font-semibold text-[#0F1117] mb-3">
          {market.status === "LIVE" ? "あなたの予測は？" : "予測結果"}
        </h2>
        <div className="space-y-3">
          {options.map((opt) => (
            <OptionVoteButton
              key={opt.id}
              marketId={market.id}
              option={opt}
              isSelected={selectedOptionId === opt.id}
              onVoteSuccess={() => {
                setSelectedOptionId(opt.id)
                handleVoteSuccess()
              }}
            />
          ))}
        </div>
        {market.status === "LIVE" && (
          <p className="text-xs text-gray-400 mt-2 text-center">
            1日1回予測を変更できます。スコアが付与されます。
          </p>
        )}
      </div>

      {/* コメント */}
      <div>
        <h2 className="text-sm font-semibold text-[#0F1117] mb-3">コメント</h2>
        <CommentForm marketId={market.id} />
        <CommentList marketId={market.id} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 動作確認**

```bash
npm run dev
```

ブラウザで `http://localhost:3000/markets` → 任意のマーケットカードをクリック → 詳細ページが表示されることを確認。

- [ ] **Step 6: コミット**

```bash
git add app/\(main\)/markets/\[id\]/ app/api/markets/\[id\]/predict/ components/market/OptionVoteButton.tsx
git commit -m "feat: add market detail page with voting"
```

---

## Task 15: コメント機能

**Files:**
- Create: `app/api/markets/[id]/comments/route.ts`
- Create: `components/comment/CommentList.tsx`
- Create: `components/comment/CommentForm.tsx`
- Create: `components/comment/CommentItem.tsx`

**Interfaces:**
- Produces: `GET /api/markets/:id/comments` → `Comment[]`
- Produces: `POST /api/markets/:id/comments { body }` → `Comment`

- [ ] **Step 1: `app/api/markets/[id]/comments/route.ts` を作成**

```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const comments = await prisma.comment.findMany({
    where: { marketId: id, parentId: null },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      replies: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  return NextResponse.json(comments)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: marketId } = await params
  const { body, parentId } = await req.json()
  if (!body?.trim()) return NextResponse.json({ error: "Body required" }, { status: 400 })
  if (body.length > 500) return NextResponse.json({ error: "Too long" }, { status: 400 })

  const comment = await prisma.comment.create({
    data: { userId: session.user.id, marketId, body: body.trim(), parentId: parentId ?? null },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  })

  await prisma.activity.create({
    data: { userId: session.user.id, actionType: "COMMENT", marketId },
  })

  return NextResponse.json(comment, { status: 201 })
}
```

- [ ] **Step 2: `components/comment/CommentItem.tsx` を作成**

```typescript
import { Comment } from "@/types"
import { formatDistanceToNow } from "date-fns"
import { ja } from "date-fns/locale"

export function CommentItem({ comment }: { comment: Comment }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-[#3B82F6] flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
        {comment.user.name?.[0] ?? "?"}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-[#0F1117]">{comment.user.name}</span>
          <span className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(comment.createdAt), { locale: ja, addSuffix: true })}
          </span>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{comment.body}</p>
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-100">
            {comment.replies.map((r) => <CommentItem key={r.id} comment={r} />)}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `components/comment/CommentList.tsx` を作成**

```typescript
"use client"
import { useEffect, useState } from "react"
import { Comment } from "@/types"
import { CommentItem } from "./CommentItem"

export function CommentList({ marketId }: { marketId: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/markets/${marketId}/comments`)
      .then((r) => r.json())
      .then(setComments)
      .finally(() => setLoading(false))
  }, [marketId])

  if (loading) return <div className="text-sm text-gray-400 py-4">読み込み中...</div>
  if (comments.length === 0) return <div className="text-sm text-gray-400 py-4">まだコメントはありません</div>

  return (
    <div className="space-y-4 mt-4">
      {comments.map((c) => <CommentItem key={c.id} comment={c} />)}
    </div>
  )
}
```

- [ ] **Step 4: `components/comment/CommentForm.tsx` を作成**

```typescript
"use client"
import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

export function CommentForm({ marketId }: { marketId: string }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [body, setBody] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) { router.push("/login"); return }
    if (!body.trim()) return
    setLoading(true)
    try {
      await fetch(`/api/markets/${marketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      })
      setBody("")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={session ? "コメントを入力..." : "コメントするにはログインが必要です"}
        disabled={!session || loading}
        maxLength={500}
        rows={3}
        className="text-sm resize-none"
      />
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400">{body.length}/500</span>
        <Button type="submit" size="sm" disabled={!body.trim() || loading}>
          投稿
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 5: コミット**

```bash
git add app/api/markets/\[id\]/comments/ components/comment/
git commit -m "feat: add comment API and comment components"
```

---

## Task 16: カテゴリページ

**Files:**
- Create: `app/(main)/categories/[slug]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/markets?category=:slug`
- Produces: カテゴリ絞り込みマーケット一覧ページ

- [ ] **Step 1: `app/(main)/categories/[slug]/page.tsx` を作成**

```typescript
import { Market } from "@/types"
import { MarketCard } from "@/components/market/MarketCard"
import { notFound } from "next/navigation"

interface Props { params: Promise<{ slug: string }> }

async function getMarketsByCategory(slug: string) {
  const res = await fetch(
    `${process.env.NEXTAUTH_URL}/api/markets?category=${slug}&limit=20`,
    { next: { revalidate: 60 } }
  )
  if (!res.ok) return null
  return res.json() as Promise<{ markets: Market[]; total: number }>
}

const CATEGORY_LABELS: Record<string, string> = {
  politics: "政治", sports: "スポーツ", crypto: "暗号資産",
  economics: "経済", ai: "AI", technology: "テクノロジー",
  entertainment: "エンタメ", weather: "天気", mentions: "メンション",
  election: "選挙", other: "その他",
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params
  const label = CATEGORY_LABELS[slug]
  if (!label) notFound()

  const data = await getMarketsByCategory(slug)
  if (!data) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F1117]">{label}</h1>
        <p className="text-sm text-gray-500 mt-1">{data.total}件のマーケット</p>
      </div>
      {data.markets.length === 0 ? (
        <div className="text-center py-20 text-gray-400">このカテゴリにはまだマーケットがありません</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.markets.map((m) => <MarketCard key={m.id} market={m} />)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: コミット**

```bash
git add app/\(main\)/categories/
git commit -m "feat: add category page"
```

---

## Plan 2 完了チェック

- [ ] `http://localhost:3000` でトップページが正常表示
- [ ] `http://localhost:3000/markets` でマーケット一覧・フィルターが動作
- [ ] 任意のマーケット詳細ページでチャート・投票・コメントが表示
- [ ] ログイン後に投票ができ、確率が更新される
- [ ] `http://localhost:3000/categories/ai` でAIカテゴリのマーケットが表示

**次のプラン:** `plan-3-social.md` — ランキング・アクティビティ・プロフィール・検索・ログイン/登録
