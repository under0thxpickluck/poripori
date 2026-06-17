# MIRAIX — Plan 4: Admin & Mentions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面（マーケット管理・ユーザー管理・解決判定）とメンション予測ページを実装する。

**Architecture:** Plan 1〜3 の完了が前提。管理画面は `/admin` 以下。middleware で `isAdmin=true` のみアクセス可。解決判定時に `lib/score.ts` の `resolveMarket()` を呼び出す。

**Tech Stack:** Next.js 15 App Router, Prisma, NextAuth v5, shadcn/ui

## Global Constraints (継承)

- 管理者ルートは `isAdmin=true` のユーザーのみ（middleware で強制）
- 禁止語: 賭ける/ベット/配当 — 使用語: 予測/投票/参加/スコア/的中
- TypeScript strict mode

---

## File Map

| ファイル | 役割 |
|---|---|
| `app/(main)/admin/layout.tsx` | 管理画面共通レイアウト |
| `app/(main)/admin/page.tsx` | 管理ダッシュボード |
| `app/(main)/admin/markets/page.tsx` | マーケット管理一覧 |
| `app/(main)/admin/markets/new/page.tsx` | マーケット新規作成 |
| `app/(main)/admin/markets/[id]/page.tsx` | マーケット編集・解決 |
| `app/(main)/admin/users/page.tsx` | ユーザー管理 |
| `app/(main)/mentions/page.tsx` | メンション予測ページ |
| `app/api/admin/markets/route.ts` | POST マーケット作成 |
| `app/api/admin/markets/[id]/route.ts` | PUT/DELETE マーケット |
| `app/api/admin/markets/[id]/resolve/route.ts` | POST 解決判定 |
| `app/api/admin/users/route.ts` | GET ユーザー一覧 |
| `app/api/admin/users/[id]/route.ts` | PUT ユーザー管理 |
| `app/api/mentions/route.ts` | GET/POST メンション |

---

## Task 22: 管理 API Routes

**Files:**
- Create: `app/api/admin/markets/route.ts`
- Create: `app/api/admin/markets/[id]/route.ts`
- Create: `app/api/admin/markets/[id]/resolve/route.ts`
- Create: `app/api/admin/users/route.ts`
- Create: `app/api/admin/users/[id]/route.ts`

**Interfaces:**
- Produces: `POST /api/admin/markets { title, description, categoryId, endAt, options[], resolutionRule }` → `{ market }`
- Produces: `PUT /api/admin/markets/:id { status, ... }` → `{ market }`
- Produces: `DELETE /api/admin/markets/:id` → `204`
- Produces: `POST /api/admin/markets/:id/resolve { winningOptionId, sourceUrl }` → `{ ok: true }`
- Produces: `GET /api/admin/users` → `User[]`
- Produces: `PUT /api/admin/users/:id { isAdmin, score }` → `{ user }`

- [ ] **Step 1: 管理者認証ヘルパーを作成**

`lib/admin.ts`:
```typescript
import { auth } from "./auth"
import { NextResponse } from "next/server"

export async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null }
  }
  if (!session.user.isAdmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null }
  }
  return { error: null, session }
}
```

- [ ] **Step 2: `app/api/admin/markets/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"

export async function POST(req: NextRequest) {
  const { error, session } = await requireAdmin()
  if (error) return error

  const {
    title, description, categoryId, endAt,
    resolutionRule, options, imageUrl, status = "LIVE",
  } = await req.json()

  if (!title || !description || !categoryId || !endAt || !options?.length || !resolutionRule) {
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 })
  }

  const market = await prisma.market.create({
    data: {
      title,
      description,
      categoryId,
      imageUrl: imageUrl ?? null,
      status,
      endAt: new Date(endAt),
      resolutionRule,
      createdBy: session!.user.id,
      options: {
        create: options.map((o: { name: string }, i: number) => ({
          name: o.name,
          currentProbability: 1 / options.length,
          sortOrder: i,
        })),
      },
    },
    include: { category: true, options: true },
  })

  await prisma.activity.create({
    data: { userId: session!.user.id, actionType: "MARKET_CREATE", marketId: market.id },
  })

  return NextResponse.json({ market }, { status: 201 })
}
```

- [ ] **Step 3: `app/api/admin/markets/[id]/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error
  const { id } = await params
  const data = await req.json()
  const market = await prisma.market.update({
    where: { id },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.description && { description: data.description }),
      ...(data.status && { status: data.status }),
      ...(data.endAt && { endAt: new Date(data.endAt) }),
      ...(data.resolutionRule && { resolutionRule: data.resolutionRule }),
    },
    include: { category: true, options: true },
  })
  return NextResponse.json({ market })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error
  const { id } = await params
  await prisma.market.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 4: `app/api/admin/markets/[id]/resolve/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { resolveMarket } from "@/lib/score"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAdmin()
  if (error) return error
  const { id: marketId } = await params
  const { winningOptionId, sourceUrl } = await req.json()

  if (!winningOptionId) {
    return NextResponse.json({ error: "winningOptionId required" }, { status: 400 })
  }

  await resolveMarket(marketId, winningOptionId, session!.user.id, sourceUrl)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: `app/api/admin/users/route.ts` を作成**

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, score: true,
      accuracyRate: true, isAdmin: true, createdAt: true,
      _count: { select: { predictions: true, comments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return NextResponse.json(users)
}
```

- [ ] **Step 6: `app/api/admin/users/[id]/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error
  const { id } = await params
  const data = await req.json()

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(typeof data.isAdmin === "boolean" && { isAdmin: data.isAdmin }),
      ...(typeof data.score === "number" && { score: data.score }),
    },
    select: { id: true, name: true, email: true, isAdmin: true, score: true },
  })
  return NextResponse.json({ user })
}
```

- [ ] **Step 7: コミット**

```bash
git add lib/admin.ts app/api/admin/
git commit -m "feat: add admin API routes (markets CRUD, resolve, user management)"
```

---

## Task 23: 管理画面 UI

**Files:**
- Create: `app/(main)/admin/layout.tsx`
- Create: `app/(main)/admin/page.tsx`
- Create: `app/(main)/admin/markets/page.tsx`
- Create: `app/(main)/admin/markets/new/page.tsx`
- Create: `app/(main)/admin/markets/[id]/page.tsx`
- Create: `app/(main)/admin/users/page.tsx`

**Interfaces:**
- Consumes: 全 `/api/admin/*` エンドポイント
- Produces: 管理ダッシュボード、マーケット管理 CRUD、解決判定UI、ユーザー管理

- [ ] **Step 1: `app/(main)/admin/layout.tsx` を作成**

```typescript
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.isAdmin) redirect("/")

  return (
    <div className="flex gap-6">
      <aside className="w-48 flex-shrink-0">
        <div className="bg-[#F8F9FA] rounded-xl p-4 sticky top-24">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">管理メニュー</p>
          <nav className="space-y-1">
            {[
              { href: "/admin", label: "ダッシュボード" },
              { href: "/admin/markets", label: "マーケット管理" },
              { href: "/admin/markets/new", label: "+ 新規作成" },
              { href: "/admin/users", label: "ユーザー管理" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block text-sm text-gray-600 hover:text-[#3B82F6] px-2 py-1.5 rounded-lg hover:bg-white transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: `app/(main)/admin/page.tsx` を作成**

```typescript
import { prisma } from "@/lib/prisma"

export default async function AdminDashboard() {
  const [marketCount, userCount, predictionCount, liveCount] = await Promise.all([
    prisma.market.count(),
    prisma.user.count(),
    prisma.prediction.count(),
    prisma.market.count({ where: { status: "LIVE" } }),
  ])

  const stats = [
    { label: "総マーケット数", value: marketCount, icon: "📊" },
    { label: "ライブ中", value: liveCount, icon: "🔴" },
    { label: "総ユーザー数", value: userCount, icon: "👥" },
    { label: "総予測数", value: predictionCount, icon: "🎯" },
  ]

  const recentMarkets = await prisma.market.findMany({
    include: { category: true, _count: { select: { predictions: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#0F1117]">管理ダッシュボード</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-[#F8F9FA] rounded-xl p-4">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl font-black text-[#0F1117]">{s.value.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="bg-[#F8F9FA] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-[#0F1117] mb-3">最近のマーケット</h2>
        <div className="space-y-2">
          {recentMarkets.map((m) => (
            <div key={m.id} className="flex items-center gap-3 bg-white rounded-lg p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0F1117] line-clamp-1">{m.title}</p>
                <p className="text-xs text-gray-400">{m.category.name} • {m._count.predictions}人参加</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                m.status === "LIVE" ? "bg-green-100 text-green-700"
                : m.status === "RESOLVED" ? "bg-gray-100 text-gray-500"
                : "bg-blue-100 text-blue-700"
              }`}>{m.status}</span>
              <a href={`/admin/markets/${m.id}`} className="text-xs text-[#3B82F6] hover:underline">編集</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `app/(main)/admin/markets/page.tsx` を作成**

```typescript
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { MarketStatus } from "@/types"

const STATUS_LABELS: Record<MarketStatus, string> = {
  DRAFT: "下書き", UPCOMING: "開始前", LIVE: "ライブ",
  SUSPENDED: "停止中", RESOLVING: "判定中",
  RESOLVED: "解決済み", CANCELLED: "中止",
}

export default async function AdminMarketsPage() {
  const markets = await prisma.market.findMany({
    include: {
      category: true,
      _count: { select: { predictions: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0F1117]">マーケット管理</h1>
        <Link
          href="/admin/markets/new"
          className="bg-[#0F1117] text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          + 新規作成
        </Link>
      </div>
      <div className="bg-[#F8F9FA] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-100 bg-white">
              <th className="text-left py-3 px-4">タイトル</th>
              <th className="text-left py-3 px-4 hidden md:table-cell">カテゴリ</th>
              <th className="text-left py-3 px-4">ステータス</th>
              <th className="text-right py-3 px-4">参加数</th>
              <th className="text-right py-3 px-4">操作</th>
            </tr>
          </thead>
          <tbody>
            {markets.map((m) => (
              <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <p className="text-sm font-medium text-[#0F1117] line-clamp-1 max-w-xs">{m.title}</p>
                </td>
                <td className="py-3 px-4 hidden md:table-cell">
                  <span className="text-xs text-gray-500">{m.category.name}</span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-xs font-medium text-gray-600">
                    {STATUS_LABELS[m.status as MarketStatus]}
                  </span>
                </td>
                <td className="py-3 px-4 text-right text-sm text-gray-500">
                  {m._count.predictions}
                </td>
                <td className="py-3 px-4 text-right">
                  <Link href={`/admin/markets/${m.id}`} className="text-xs text-[#3B82F6] hover:underline">
                    編集・解決
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `app/(main)/admin/markets/new/page.tsx` を作成**

```typescript
"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Category } from "@/types"

export default function NewMarketPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState({
    title: "", description: "", categoryId: "",
    endAt: "", resolutionRule: "", status: "LIVE",
    options: [{ name: "" }, { name: "" }],
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(setCategories)
  }, [])

  const handleOptionChange = (i: number, value: string) => {
    const opts = [...form.options]
    opts[i] = { name: value }
    setForm({ ...form, options: opts })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/admin/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push(`/admin/markets/${data.market.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-[#0F1117] mb-6">新規マーケット作成</h1>
      <form onSubmit={handleSubmit} className="space-y-5 bg-[#F8F9FA] rounded-xl p-6">
        <div className="space-y-1">
          <Label className="text-sm">タイトル</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">説明</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required rows={3} />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">カテゴリ</Label>
          <select
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            required
            className="w-full h-10 px-3 text-sm border border-gray-200 rounded-md bg-white"
          >
            <option value="">選択してください</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-sm">選択肢</Label>
          {form.options.map((opt, i) => (
            <Input
              key={i}
              value={opt.name}
              onChange={(e) => handleOptionChange(i, e.target.value)}
              placeholder={`選択肢 ${i + 1}`}
              required
              className="mb-2"
            />
          ))}
          <button
            type="button"
            onClick={() => setForm({ ...form, options: [...form.options, { name: "" }] })}
            className="text-xs text-[#3B82F6] hover:underline"
          >
            + 選択肢を追加
          </button>
        </div>
        <div className="space-y-1">
          <Label className="text-sm">終了日時</Label>
          <Input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} required />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">解決条件</Label>
          <Textarea value={form.resolutionRule} onChange={(e) => setForm({ ...form, resolutionRule: e.target.value })} required rows={2} />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">ステータス</Label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full h-10 px-3 text-sm border border-gray-200 rounded-md bg-white"
          >
            <option value="DRAFT">下書き</option>
            <option value="UPCOMING">開始前</option>
            <option value="LIVE">ライブ</option>
          </select>
        </div>
        {error && <p className="text-sm text-[#EF4444]">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full bg-[#0F1117] hover:bg-gray-800">
          {loading ? "作成中..." : "マーケットを作成"}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: `app/(main)/admin/markets/[id]/page.tsx` を作成（解決判定 UI）**

```typescript
"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Market } from "@/types"

export default function AdminMarketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [market, setMarket] = useState<Market | null>(null)
  const [winningOptionId, setWinningOptionId] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch(`/api/markets/${id}`).then((r) => r.json()).then((m) => {
      setMarket(m)
      setStatus(m.status)
    })
  }, [id])

  const handleStatusChange = async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/markets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    setLoading(false)
    setMessage(res.ok ? "ステータスを更新しました" : "エラーが発生しました")
  }

  const handleResolve = async () => {
    if (!winningOptionId) { setMessage("勝者の選択肢を選んでください"); return }
    if (!confirm("解決判定を実行します。この操作は取り消せません。")) return
    setLoading(true)
    const res = await fetch(`/api/admin/markets/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winningOptionId, sourceUrl }),
    })
    setLoading(false)
    if (res.ok) {
      setMessage("解決判定が完了しました。スコアが付与されました。")
      router.refresh()
    } else {
      const data = await res.json()
      setMessage(data.error ?? "エラーが発生しました")
    }
  }

  const handleDelete = async () => {
    if (!confirm("このマーケットを削除しますか？")) return
    await fetch(`/api/admin/markets/${id}`, { method: "DELETE" })
    router.push("/admin/markets")
  }

  if (!market) return <div className="text-sm text-gray-400">読み込み中...</div>

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-[#0F1117] line-clamp-2">{market.title}</h1>

      {message && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {/* ステータス変更 */}
      <div className="bg-[#F8F9FA] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[#0F1117]">ステータス変更</h2>
        <div className="flex gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="flex-1 h-10 px-3 text-sm border border-gray-200 rounded-md bg-white"
          >
            {["DRAFT","UPCOMING","LIVE","SUSPENDED","RESOLVING","RESOLVED","CANCELLED"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <Button onClick={handleStatusChange} disabled={loading} variant="outline">
            更新
          </Button>
        </div>
      </div>

      {/* 解決判定 */}
      <div className="bg-[#F8F9FA] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[#0F1117]">解決判定</h2>
        <p className="text-xs text-gray-500">
          解決判定を行うと、全参加者にポイントが付与されます。実行後は取り消せません。
        </p>
        <div className="space-y-3">
          <div>
            <Label className="text-sm">正解の選択肢</Label>
            <div className="mt-2 space-y-2">
              {market.options.map((opt) => (
                <label key={opt.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="winner"
                    value={opt.id}
                    checked={winningOptionId === opt.id}
                    onChange={() => setWinningOptionId(opt.id)}
                    className="accent-[#3B82F6]"
                  />
                  <span className="text-sm text-[#0F1117]">
                    {opt.name} ({Math.round(opt.currentProbability * 100)}%)
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">参考URL（任意）</Label>
            <Input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              type="url"
            />
          </div>
          <Button
            onClick={handleResolve}
            disabled={loading || !winningOptionId || market.status === "RESOLVED"}
            className="w-full bg-[#10B981] hover:bg-[#059669] text-white"
          >
            {market.status === "RESOLVED" ? "解決済み" : "解決判定を実行"}
          </Button>
        </div>
      </div>

      {/* 削除 */}
      <div className="bg-red-50 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-red-700 mb-2">危険な操作</h2>
        <Button variant="destructive" onClick={handleDelete} disabled={loading} size="sm">
          マーケットを削除
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: `app/(main)/admin/users/page.tsx` を作成**

```typescript
"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

interface AdminUser {
  id: string; name: string; email: string; score: number
  accuracyRate: number; isAdmin: boolean; createdAt: string
  _count: { predictions: number; comments: number }
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/users").then((r) => r.json()).then(setUsers).finally(() => setLoading(false))
  }, [])

  const toggleAdmin = async (id: string, isAdmin: boolean) => {
    await fetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin: !isAdmin }),
    })
    setUsers(users.map((u) => u.id === id ? { ...u, isAdmin: !isAdmin } : u))
  }

  if (loading) return <div className="text-sm text-gray-400">読み込み中...</div>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#0F1117]">ユーザー管理</h1>
      <div className="bg-[#F8F9FA] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-100 bg-white">
              <th className="text-left py-3 px-4">ユーザー</th>
              <th className="text-right py-3 px-4 hidden md:table-cell">スコア</th>
              <th className="text-right py-3 px-4 hidden md:table-cell">的中率</th>
              <th className="text-right py-3 px-4">参加数</th>
              <th className="text-right py-3 px-4">管理者</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <p className="text-sm font-medium text-[#0F1117]">{u.name}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </td>
                <td className="py-3 px-4 text-right text-sm hidden md:table-cell">{u.score}pt</td>
                <td className="py-3 px-4 text-right text-sm hidden md:table-cell">
                  {Math.round(u.accuracyRate * 100)}%
                </td>
                <td className="py-3 px-4 text-right text-sm text-gray-500">{u._count.predictions}</td>
                <td className="py-3 px-4 text-right">
                  <Button
                    size="sm"
                    variant={u.isAdmin ? "default" : "outline"}
                    onClick={() => toggleAdmin(u.id, u.isAdmin)}
                    className={u.isAdmin ? "bg-[#3B82F6] hover:bg-[#2563EB] text-white" : ""}
                  >
                    {u.isAdmin ? "管理者" : "一般"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: コミット**

```bash
git add app/\(main\)/admin/
git commit -m "feat: add admin dashboard, market management, resolve UI, and user management"
```

---

## Task 24: メンション予測ページ

**Files:**
- Create: `app/api/mentions/route.ts`
- Create: `app/(main)/mentions/page.tsx`

**Interfaces:**
- Produces: `GET /api/mentions` → `MentionMarket[]`
- Produces: `POST /api/mentions` (管理者のみ) → `{ mention }`

- [ ] **Step 1: `app/api/mentions/route.ts` を作成**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"

export async function GET() {
  const mentions = await prisma.mentionMarket.findMany({
    orderBy: { scheduledAt: "asc" },
  })
  return NextResponse.json(mentions)
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const { eventName, sourceType, targetWord, threshold, scheduledAt } = await req.json()
  if (!eventName || !sourceType || !targetWord || !threshold || !scheduledAt) {
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 })
  }

  const mention = await prisma.mentionMarket.create({
    data: { eventName, sourceType, targetWord, threshold, scheduledAt: new Date(scheduledAt) },
  })
  return NextResponse.json({ mention }, { status: 201 })
}
```

- [ ] **Step 2: `app/(main)/mentions/page.tsx` を作成**

```typescript
import { MentionMarket } from "@/types"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { Mic, Youtube, Twitter, FileText, Radio } from "lucide-react"

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  YouTube: <Youtube size={16} className="text-red-500" />,
  X: <Twitter size={16} className="text-[#1DA1F2]" />,
  Podcast: <Mic size={16} className="text-purple-500" />,
  ニュース記事: <FileText size={16} className="text-gray-500" />,
  会見: <Radio size={16} className="text-[#3B82F6]" />,
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  UPCOMING: { label: "開始前", cls: "bg-blue-100 text-blue-700" },
  LIVE: { label: "進行中", cls: "bg-green-100 text-green-700" },
  RESOLVED: { label: "判定済み", cls: "bg-gray-100 text-gray-500" },
  CANCELLED: { label: "中止", cls: "bg-red-100 text-red-500" },
}

async function getMentions(): Promise<MentionMarket[]> {
  const res = await fetch(`${process.env.NEXTAUTH_URL}/api/mentions`, {
    next: { revalidate: 60 },
  })
  if (!res.ok) return []
  return res.json()
}

export default async function MentionsPage() {
  const mentions = await getMentions()

  const upcoming = mentions.filter((m) => m.status === "UPCOMING" || m.status === "LIVE")
  const resolved = mentions.filter((m) => m.status === "RESOLVED" || m.status === "CANCELLED")

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#0F1117]">📢 メンション予測</h1>
        <p className="text-sm text-gray-500 mt-1">
          特定の配信・会見・動画で、ある単語が何回言及されるかを予測します。
        </p>
      </div>

      {/* 説明 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0F1117] mb-2">メンション予測とは？</h2>
        <ul className="text-sm text-gray-600 space-y-1.5 list-disc list-inside">
          <li>YouTubeライブ・X・会見などでの発言を対象にします</li>
          <li>「特定のワードが何回以上言及されるか」を予測します</li>
          <li>イベント終了後、管理者が集計して結果を確定します</li>
          <li>的中するとスコアが付与されます</li>
        </ul>
      </div>

      {/* 進行中・開始前 */}
      <section>
        <h2 className="text-lg font-bold text-[#0F1117] mb-4">進行中・開始前</h2>
        {upcoming.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-[#F8F9FA] rounded-xl">
            現在、進行中のメンション予測はありません
          </div>
        ) : (
          <div className="space-y-4">
            {upcoming.map((m) => (
              <MentionCard key={m.id} mention={m} />
            ))}
          </div>
        )}
      </section>

      {/* 解決済み */}
      {resolved.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-[#0F1117] mb-4">判定済み</h2>
          <div className="space-y-4">
            {resolved.map((m) => (
              <MentionCard key={m.id} mention={m} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function MentionCard({ mention }: { mention: MentionMarket }) {
  const statusCfg = STATUS_CONFIG[mention.status] ?? STATUS_CONFIG.UPCOMING

  return (
    <div className="bg-[#F8F9FA] border border-gray-100 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {SOURCE_ICONS[mention.sourceType]}
            <span className="text-xs text-gray-500 font-medium">{mention.sourceType}</span>
          </div>
          <h3 className="font-semibold text-[#0F1117] text-sm leading-snug">{mention.eventName}</h3>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusCfg.cls}`}>
          {statusCfg.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
          <span className="text-xs text-gray-400 block">予測対象ワード</span>
          <span className="font-bold text-[#0F1117]">「{mention.targetWord}」</span>
        </div>
        <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
          <span className="text-xs text-gray-400 block">閾値</span>
          <span className="font-bold text-[#0F1117]">{mention.threshold}回以上</span>
        </div>
        <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
          <span className="text-xs text-gray-400 block">開始予定</span>
          <span className="font-bold text-[#0F1117] text-xs">
            {format(new Date(mention.scheduledAt), "M月d日 HH:mm", { locale: ja })}
          </span>
        </div>
        {mention.result !== null && (
          <div className="bg-white rounded-lg px-3 py-2 border border-[#10B981]">
            <span className="text-xs text-gray-400 block">実際の言及回数</span>
            <span className="font-bold text-[#10B981]">{mention.result}回</span>
          </div>
        )}
      </div>

      {mention.result !== null && (
        <div className={`mt-3 p-2 rounded-lg text-center text-sm font-medium ${
          mention.result >= mention.threshold
            ? "bg-green-50 text-[#10B981]"
            : "bg-red-50 text-[#EF4444]"
        }`}>
          {mention.result >= mention.threshold
            ? `✓ 閾値達成（${mention.result}回 ≥ ${mention.threshold}回）`
            : `✗ 閾値未達（${mention.result}回 < ${mention.threshold}回）`}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: コミット**

```bash
git add app/api/mentions/ app/\(main\)/mentions/
git commit -m "feat: add mentions API and mention prediction page"
```

---

## Task 25: 最終チェック & ビルド確認

- [ ] **Step 1: TypeScript エラーチェック**

```bash
npx tsc --noEmit
```

期待: エラーなし（または `next-auth` の型警告のみ）

- [ ] **Step 2: テスト実行**

```bash
npm test
```

期待: `calculatePredictionPoints` の全テストが Pass

- [ ] **Step 3: プロダクションビルド確認**

```bash
npm run build
```

期待:
```
✓ Compiled successfully
Route (app) ...
```

- [ ] **Step 4: ローカル動作確認チェックリスト**

```bash
npm run dev
```

| ページ | URL | 確認事項 |
|---|---|---|
| トップ | / | ヒーロー・マーケットカード・カテゴリ表示 |
| 一覧 | /markets | フィルター・ソート動作 |
| 詳細 | /markets/:id | チャート・投票・コメント |
| カテゴリ | /categories/ai | AI関連マーケット表示 |
| ランキング | /leaderboard | スコア・的中率順 |
| アクティビティ | /activity | フィード表示 |
| プロフィール | /profile/:id | 統計・履歴 |
| 検索 | /search?q=AI | 検索結果 |
| ログイン | /login | ログイン動作 |
| 登録 | /register | 登録後自動ログイン |
| 管理(ダッシュ) | /admin | 統計カード |
| 管理(作成) | /admin/markets/new | マーケット作成 |
| 管理(解決) | /admin/markets/:id | 解決判定実行 |
| 管理(ユーザー) | /admin/users | 管理者権限切替 |
| メンション | /mentions | メンションカード表示 |

- [ ] **Step 5: 最終コミット**

```bash
git add -A
git commit -m "feat: complete MIRAIX MVP - all Phase 1 features implemented"
```

---

## Plan 4 完了チェック

- [ ] 管理者アカウント（admin@miraix.jp / admin1234）でログインして `/admin` にアクセスできる
- [ ] 新規マーケット作成 → 一覧に表示される
- [ ] ライブマーケットに投票 → 確率が更新される
- [ ] マーケット解決 → スコアが付与される
- [ ] `/mentions` でメンション予測カードが表示される
- [ ] `npm run build` が成功する

---

## 全プラン完了後の次ステップ

### Phase 2 候補
- メンション自動判定（Whisper API / YouTube Transcript API）
- AI要約機能（Vercel AI Gateway）
- 通報機能
- WebSocketリアルタイム通知（Vercel Queues）

### デプロイ
1. Vercel にリポジトリを接続
2. Neon の DATABASE_URL を Vercel 環境変数に設定
3. NEXTAUTH_SECRET と NEXTAUTH_URL を設定
4. `vercel deploy --prod`
