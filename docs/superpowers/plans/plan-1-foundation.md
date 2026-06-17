# MIRAIX — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js 15プロジェクトを作成し、Prisma/Neon DB・NextAuth v5・型定義・スコア計算・シードデータを完成させる。

**Architecture:** Next.js 15 App Router モノリス。API Routes で全バックエンド処理。Prisma → Neon (PostgreSQL)。NextAuth v5 JWT セッション。

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Prisma 6, Neon PostgreSQL, NextAuth v5 (beta), bcryptjs, Jest, date-fns, lucide-react

## Global Constraints

- 禁止語: 賭ける/ベット/配当/出金/投資/儲かる — 使用語: 予測/投票/参加/スコア/的中/確率
- TypeScript strict mode 有効
- Node.js 24、Next.js 15、Prisma 6、NextAuth v5 beta
- 確率値は DB では 0.0〜1.0、UI では 0〜100% 表示
- ポイント計算は `lib/score.ts` のみで行い、クライアントでは計算しない

---

## File Map

| ファイル | 役割 |
|---|---|
| `prisma/schema.prisma` | 全DBスキーマ定義 |
| `prisma/seed.ts` | 初期データ投入 |
| `lib/prisma.ts` | Prismaクライアントシングルトン |
| `lib/auth.ts` | NextAuth v5 設定 |
| `lib/score.ts` | ポイント計算ロジック |
| `lib/api.ts` | フロント用フェッチユーティリティ |
| `types/index.ts` | 全TypeScript型定義 |
| `middleware.ts` | ルート保護 |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth ハンドラー |
| `__tests__/lib/score.test.ts` | score.ts ユニットテスト |
| `jest.config.ts` | Jest設定 |
| `jest.setup.ts` | Jest セットアップ |

---

## Task 1: プロジェクトスキャフォールド

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json` (create-next-app が生成)
- Create: `jest.config.ts`
- Create: `jest.setup.ts`

**Interfaces:**
- Produces: 動作する Next.js 15 開発サーバー、`npm test` が動く Jest 環境

- [ ] **Step 1: Next.js アプリを作成**

```bash
cd C:\Users\unite\poripori
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

「ディレクトリが空でない」というプロンプトが出たら `y` を入力。

期待される出力:
```
✔ Would you like to proceed? … yes
✔ Creating a new Next.js app in ...
✔ Installing dependencies
Success! Created miraix
```

- [ ] **Step 2: 追加依存パッケージをインストール**

```bash
npm install next-auth@beta @auth/prisma-adapter @prisma/client bcryptjs recharts @tanstack/react-query zustand date-fns lucide-react
npm install -D prisma @types/bcryptjs jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom @types/jest
```

- [ ] **Step 3: shadcn/ui を初期化**

```bash
npx shadcn@latest init --defaults
npx shadcn@latest add button card badge input label separator avatar dropdown-menu textarea
```

- [ ] **Step 4: Jest を設定**

`jest.config.ts` を作成:
```typescript
import type { Config } from "jest"
import nextJest from "next/jest"

const createJestConfig = nextJest({ dir: "./" })

const config: Config = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
}

export default createJestConfig(config)
```

`jest.setup.ts` を作成:
```typescript
import "@testing-library/jest-dom"
```

`package.json` の `scripts` に追加:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 5: 動作確認**

```bash
npm run dev
```

期待: `http://localhost:3000` で Next.js スターターページが表示される。

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 project with shadcn/ui and Jest"
```

---

## Task 2: Prisma スキーマ & DB 接続

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env.local`

**Interfaces:**
- Produces: `prisma.market`, `prisma.user`, `prisma.prediction` 等のPrismaクライアント型

- [ ] **Step 1: Prisma を初期化**

```bash
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: `.env.local` に Neon DATABASE_URL を設定**

Neon (https://neon.tech) でプロジェクトを作成し、接続文字列を取得する。

`.env.local`:
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/miraix?sslmode=require"
NEXTAUTH_SECRET="your-random-secret-min-32-chars"
NEXTAUTH_URL="http://localhost:3000"
```

- [ ] **Step 3: `prisma/schema.prisma` を全テーブル定義で書き換え**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum MarketStatus {
  DRAFT
  UPCOMING
  LIVE
  SUSPENDED
  RESOLVING
  RESOLVED
  CANCELLED
}

enum PredictionType {
  FREE_VOTE
  WEIGHTED_VOTE
}

enum ActivityType {
  PREDICT
  COMMENT
  MARKET_CREATE
  MARKET_RESOLVE
  LIKE
}

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String?
  avatarUrl    String?
  bio          String?
  score        Int      @default(0)
  accuracyRate Float    @default(0)
  isAdmin      Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  predictions Prediction[]
  comments    Comment[]
  activities  Activity[]
  badges      UserBadge[]
  positions   Position[]
  markets     Market[]     @relation("CreatedBy")
}

model Category {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  iconUrl   String?
  sortOrder Int      @default(0)

  markets Market[]
}

model Market {
  id               String       @id @default(cuid())
  title            String
  description      String
  categoryId       String
  imageUrl         String?
  status           MarketStatus @default(DRAFT)
  startAt          DateTime?
  endAt            DateTime
  resolutionRule   String
  resolvedOptionId String?
  createdBy        String
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  category    Category       @relation(fields: [categoryId], references: [id])
  creator     User           @relation("CreatedBy", fields: [createdBy], references: [id])
  options     MarketOption[]
  predictions Prediction[]
  comments    Comment[]
  activities  Activity[]
  positions   Position[]
  resolution  Resolution?
}

model MarketOption {
  id                 String   @id @default(cuid())
  marketId           String
  name               String
  currentProbability Float    @default(0.5)
  yesCount           Int      @default(0)
  noCount            Int      @default(0)
  sortOrder          Int      @default(0)
  createdAt          DateTime @default(now())

  market      Market       @relation(fields: [marketId], references: [id], onDelete: Cascade)
  predictions Prediction[]
  positions   Position[]
}

model Prediction {
  id             String         @id @default(cuid())
  userId         String
  marketId       String
  optionId       String
  predictionType PredictionType @default(FREE_VOTE)
  weight         Int            @default(1)
  isCorrect      Boolean?
  pointsAwarded  Int            @default(0)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  user   User         @relation(fields: [userId], references: [id])
  market Market       @relation(fields: [marketId], references: [id])
  option MarketOption @relation(fields: [optionId], references: [id])

  @@unique([userId, marketId])
}

model Comment {
  id         String   @id @default(cuid())
  userId     String
  marketId   String
  body       String
  parentId   String?
  likesCount Int      @default(0)
  createdAt  DateTime @default(now())

  user    User      @relation(fields: [userId], references: [id])
  market  Market    @relation(fields: [marketId], references: [id])
  parent  Comment?  @relation("Replies", fields: [parentId], references: [id])
  replies Comment[] @relation("Replies")
}

model Activity {
  id         String       @id @default(cuid())
  userId     String
  actionType ActivityType
  marketId   String?
  metadata   Json?
  createdAt  DateTime     @default(now())

  user   User    @relation(fields: [userId], references: [id])
  market Market? @relation(fields: [marketId], references: [id])
}

model Badge {
  id          String      @id @default(cuid())
  name        String
  description String
  iconUrl     String?
  users       UserBadge[]
}

model UserBadge {
  id        String   @id @default(cuid())
  userId    String
  badgeId   String
  createdAt DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id])
  badge Badge @relation(fields: [badgeId], references: [id])
}

model Position {
  id           String   @id @default(cuid())
  userId       String
  marketId     String
  optionId     String
  averagePrice Float
  quantity     Int
  createdAt    DateTime @default(now())

  user   User         @relation(fields: [userId], references: [id])
  market Market       @relation(fields: [marketId], references: [id])
  option MarketOption @relation(fields: [optionId], references: [id])
}

model Resolution {
  id             String   @id @default(cuid())
  marketId       String   @unique
  resultOptionId String
  sourceUrl      String?
  approvedBy     String
  resolvedAt     DateTime @default(now())

  market Market @relation(fields: [marketId], references: [id])
}

model MentionMarket {
  id          String   @id @default(cuid())
  eventName   String
  sourceType  String
  targetWord  String
  threshold   Int
  scheduledAt DateTime
  status      String   @default("UPCOMING")
  result      Int?
  createdAt   DateTime @default(now())
}
```

- [ ] **Step 4: マイグレーション実行**

```bash
npx prisma migrate dev --name init
npx prisma generate
```

期待される出力:
```
✔ Generated Prisma Client
Your database is now in sync with your schema.
```

- [ ] **Step 5: コミット**

```bash
git add prisma/ .env.local
git commit -m "feat: add Prisma schema with all 12 tables and Neon connection"
```

---

## Task 3: NextAuth v5 & ミドルウェア

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `middleware.ts`
- Create: `types/next-auth.d.ts`

**Interfaces:**
- Produces: `auth()` — セッション取得関数、`signIn()` / `signOut()`、ルート保護ミドルウェア

- [ ] **Step 1: `lib/auth.ts` を作成**

```typescript
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })
        if (!user || !user.passwordHash) return null
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )
        if (!valid) return null
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          isAdmin: user.isAdmin,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.isAdmin = (user as any).isAdmin
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        ;(session.user as any).isAdmin = token.isAdmin as boolean
      }
      return session
    },
  },
})
```

- [ ] **Step 2: `lib/prisma.ts` を作成**

```typescript
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["error"] : [] })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

- [ ] **Step 3: `app/api/auth/[...nextauth]/route.ts` を作成**

```typescript
import { handlers } from "@/lib/auth"
export const { GET, POST } = handlers
```

- [ ] **Step 4: `types/next-auth.d.ts` を作成**

```typescript
import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface User {
    isAdmin?: boolean
  }
  interface Session {
    user: {
      id: string
      isAdmin: boolean
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    isAdmin: boolean
  }
}
```

- [ ] **Step 5: `middleware.ts` を作成**

```typescript
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  if (pathname.startsWith("/admin")) {
    if (!session?.user?.isAdmin) {
      return NextResponse.redirect(new URL("/login", req.url))
    }
  }

  const protectedPaths = ["/profile"]
  if (protectedPaths.some((p) => pathname.startsWith(p)) && !session) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
```

- [ ] **Step 6: コミット**

```bash
git add lib/auth.ts lib/prisma.ts app/api/auth middleware.ts types/
git commit -m "feat: add NextAuth v5 with JWT sessions and route middleware"
```

---

## Task 4: TypeScript 型定義 & lib ユーティリティ

**Files:**
- Create: `types/index.ts`
- Create: `lib/score.ts`
- Create: `lib/api.ts`

**Interfaces:**
- Produces: `Market`, `User`, `Prediction`, `Comment`, `Activity`, `Category`, `MentionMarket`, `RankingUser` 型
- Produces: `calculatePredictionPoints()`, `resolveMarket()` 関数
- Produces: `apiFetch()` ユーティリティ

- [ ] **Step 1: `types/index.ts` を作成**

```typescript
export type MarketStatus =
  | "DRAFT"
  | "UPCOMING"
  | "LIVE"
  | "SUSPENDED"
  | "RESOLVING"
  | "RESOLVED"
  | "CANCELLED"

export type ActivityType =
  | "PREDICT"
  | "COMMENT"
  | "MARKET_CREATE"
  | "MARKET_RESOLVE"
  | "LIKE"

export type PredictionType = "FREE_VOTE" | "WEIGHTED_VOTE"

export interface Category {
  id: string
  name: string
  slug: string
  iconUrl: string | null
  sortOrder: number
}

export interface MarketOption {
  id: string
  marketId: string
  name: string
  currentProbability: number
  yesCount: number
  noCount: number
  sortOrder: number
}

export interface Market {
  id: string
  title: string
  description: string
  categoryId: string
  category: Category
  imageUrl: string | null
  status: MarketStatus
  startAt: string | null
  endAt: string
  resolutionRule: string
  resolvedOptionId: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  options: MarketOption[]
  _count?: { predictions: number; comments: number }
}

export interface User {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  bio: string | null
  score: number
  accuracyRate: number
  isAdmin: boolean
  createdAt: string
}

export interface Prediction {
  id: string
  userId: string
  marketId: string
  optionId: string
  predictionType: PredictionType
  weight: number
  isCorrect: boolean | null
  pointsAwarded: number
  createdAt: string
}

export interface Comment {
  id: string
  userId: string
  marketId: string
  body: string
  parentId: string | null
  likesCount: number
  createdAt: string
  user: Pick<User, "id" | "name" | "avatarUrl">
  replies?: Comment[]
}

export interface Activity {
  id: string
  userId: string
  actionType: ActivityType
  marketId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  user: Pick<User, "id" | "name" | "avatarUrl">
  market?: Pick<Market, "id" | "title"> | null
}

export interface RankingUser {
  id: string
  name: string
  avatarUrl: string | null
  score: number
  accuracyRate: number
  predictionCount: number
  badges: Array<{ badge: { name: string; iconUrl: string | null } }>
}

export interface MentionMarket {
  id: string
  eventName: string
  sourceType: string
  targetWord: string
  threshold: number
  scheduledAt: string
  status: string
  result: number | null
  createdAt: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}
```

- [ ] **Step 2: `lib/score.ts` を作成**

```typescript
import { prisma } from "./prisma"

export const POINTS = {
  PARTICIPATION: 1,
  CORRECT: 10,
  EARLY_BONUS: 5,
  MINORITY_BONUS: 10,
  STREAK_BONUS: 3,
  DAILY_LOGIN: 2,
  COMMENT_LIKE: 1,
  SPAM_PENALTY: -20,
} as const

export function calculatePredictionPoints({
  isCorrect,
  probability,
  daysUntilEnd,
  streakCount,
}: {
  isCorrect: boolean
  probability: number
  daysUntilEnd: number
  streakCount: number
}): number {
  if (!isCorrect) return 0
  let points = POINTS.CORRECT
  if (daysUntilEnd >= 7) points += POINTS.EARLY_BONUS
  if (probability <= 0.3) points += POINTS.MINORITY_BONUS
  if (streakCount > 1) points += POINTS.STREAK_BONUS
  return points
}

export async function resolveMarket(
  marketId: string,
  winningOptionId: string,
  approvedBy: string,
  sourceUrl?: string
) {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: { options: true, predictions: { include: { user: true } } },
  })
  if (!market) throw new Error("Market not found")

  const winningOption = market.options.find((o) => o.id === winningOptionId)
  if (!winningOption) throw new Error("Winning option not found")

  await Promise.all(
    market.predictions.map(async (pred) => {
      const isCorrect = pred.optionId === winningOptionId
      const daysUntilEnd = Math.max(
        0,
        (market.endAt.getTime() - pred.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      )
      const recentCorrect = await prisma.prediction.count({
        where: { userId: pred.userId, isCorrect: true, createdAt: { lt: pred.createdAt } },
      })
      const points = calculatePredictionPoints({
        isCorrect,
        probability: winningOption.currentProbability,
        daysUntilEnd,
        streakCount: recentCorrect,
      })
      await prisma.prediction.update({
        where: { id: pred.id },
        data: { isCorrect, pointsAwarded: points },
      })
      if (points > 0) {
        await prisma.user.update({
          where: { id: pred.userId },
          data: { score: { increment: points } },
        })
      }
    })
  )

  const userIds = [...new Set(market.predictions.map((p) => p.userId))]
  await Promise.all(
    userIds.map(async (userId) => {
      const all = await prisma.prediction.findMany({
        where: { userId, isCorrect: { not: null } },
      })
      const accuracy = all.length > 0 ? all.filter((p) => p.isCorrect).length / all.length : 0
      await prisma.user.update({ where: { id: userId }, data: { accuracyRate: accuracy } })
    })
  )

  await prisma.market.update({
    where: { id: marketId },
    data: { status: "RESOLVED", resolvedOptionId: winningOptionId },
  })

  await prisma.resolution.create({
    data: { marketId, resultOptionId: winningOptionId, sourceUrl, approvedBy },
  })
}
```

- [ ] **Step 3: `lib/api.ts` を作成**

```typescript
export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}
```

- [ ] **Step 4: TypeScript コンパイル確認**

```bash
npx tsc --noEmit
```

期待: エラーなし（または `next-auth` の型警告のみ）

- [ ] **Step 5: コミット**

```bash
git add types/ lib/score.ts lib/api.ts
git commit -m "feat: add TypeScript types, score calculation, and API fetch utility"
```

---

## Task 5: Jest 設定 & score.ts ユニットテスト

**Files:**
- Create: `__tests__/lib/score.test.ts`

**Interfaces:**
- Consumes: `calculatePredictionPoints`, `POINTS` from `@/lib/score`
- Produces: 全スコアロジックが検証済み

- [ ] **Step 1: テストファイルを作成**

```typescript
// __tests__/lib/score.test.ts
import { calculatePredictionPoints, POINTS } from "@/lib/score"

describe("calculatePredictionPoints", () => {
  it("不正解の場合は 0 を返す", () => {
    expect(
      calculatePredictionPoints({
        isCorrect: false,
        probability: 0.5,
        daysUntilEnd: 10,
        streakCount: 0,
      })
    ).toBe(0)
  })

  it("正解の場合は基本ポイント (10pt) を返す", () => {
    expect(
      calculatePredictionPoints({
        isCorrect: true,
        probability: 0.5,
        daysUntilEnd: 3,
        streakCount: 0,
      })
    ).toBe(POINTS.CORRECT)
  })

  it("7日以上前の予測は早期ボーナス (+5pt) を加算", () => {
    expect(
      calculatePredictionPoints({
        isCorrect: true,
        probability: 0.5,
        daysUntilEnd: 7,
        streakCount: 0,
      })
    ).toBe(POINTS.CORRECT + POINTS.EARLY_BONUS)
  })

  it("確率 0.3 以下の的中は少数派ボーナス (+10pt) を加算", () => {
    expect(
      calculatePredictionPoints({
        isCorrect: true,
        probability: 0.3,
        daysUntilEnd: 3,
        streakCount: 0,
      })
    ).toBe(POINTS.CORRECT + POINTS.MINORITY_BONUS)
  })

  it("確率 0.31 は少数派ボーナスを付与しない", () => {
    expect(
      calculatePredictionPoints({
        isCorrect: true,
        probability: 0.31,
        daysUntilEnd: 3,
        streakCount: 0,
      })
    ).toBe(POINTS.CORRECT)
  })

  it("streakCount > 1 で連続的中ボーナス (+3pt) を加算", () => {
    expect(
      calculatePredictionPoints({
        isCorrect: true,
        probability: 0.5,
        daysUntilEnd: 3,
        streakCount: 2,
      })
    ).toBe(POINTS.CORRECT + POINTS.STREAK_BONUS)
  })

  it("全ボーナスが重複適用される", () => {
    expect(
      calculatePredictionPoints({
        isCorrect: true,
        probability: 0.25,
        daysUntilEnd: 10,
        streakCount: 3,
      })
    ).toBe(
      POINTS.CORRECT + POINTS.EARLY_BONUS + POINTS.MINORITY_BONUS + POINTS.STREAK_BONUS
    )
  })
})
```

- [ ] **Step 2: テストが失敗することを確認（TDD）**

```bash
npm test -- __tests__/lib/score.test.ts
```

期待: `lib/score` が存在するため Pass するが、もしエラーが出たら Task 4 の `lib/score.ts` を確認する。

- [ ] **Step 3: テストが全て通ることを確認**

```bash
npm test
```

期待:
```
PASS  __tests__/lib/score.test.ts
  calculatePredictionPoints
    ✓ 不正解の場合は 0 を返す
    ✓ 正解の場合は基本ポイント (10pt) を返す
    ...
Tests: 7 passed, 7 total
```

- [ ] **Step 4: コミット**

```bash
git add __tests__/
git commit -m "test: add unit tests for score calculation logic"
```

---

## Task 6: シードデータ

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (prisma.seed スクリプト追加)

**Interfaces:**
- Produces: DB にカテゴリ11件・マーケット15件・ユーザー6名・バッジ4種が投入された状態

- [ ] **Step 1: `package.json` に seed スクリプトを追加**

`package.json` の `prisma` セクションを追加（`scripts` の後ろ）:
```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

ts-node をインストール:
```bash
npm install -D ts-node
```

- [ ] **Step 2: `prisma/seed.ts` を作成**

```typescript
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  // カテゴリ
  const categories = await Promise.all([
    prisma.category.upsert({ where: { slug: "politics" }, update: {}, create: { name: "政治", slug: "politics", sortOrder: 1 } }),
    prisma.category.upsert({ where: { slug: "sports" }, update: {}, create: { name: "スポーツ", slug: "sports", sortOrder: 2 } }),
    prisma.category.upsert({ where: { slug: "crypto" }, update: {}, create: { name: "暗号資産", slug: "crypto", sortOrder: 3 } }),
    prisma.category.upsert({ where: { slug: "economics" }, update: {}, create: { name: "経済", slug: "economics", sortOrder: 4 } }),
    prisma.category.upsert({ where: { slug: "ai" }, update: {}, create: { name: "AI", slug: "ai", sortOrder: 5 } }),
    prisma.category.upsert({ where: { slug: "technology" }, update: {}, create: { name: "テクノロジー", slug: "technology", sortOrder: 6 } }),
    prisma.category.upsert({ where: { slug: "entertainment" }, update: {}, create: { name: "エンタメ", slug: "entertainment", sortOrder: 7 } }),
    prisma.category.upsert({ where: { slug: "weather" }, update: {}, create: { name: "天気", slug: "weather", sortOrder: 8 } }),
    prisma.category.upsert({ where: { slug: "mentions" }, update: {}, create: { name: "メンション", slug: "mentions", sortOrder: 9 } }),
    prisma.category.upsert({ where: { slug: "election" }, update: {}, create: { name: "選挙", slug: "election", sortOrder: 10 } }),
    prisma.category.upsert({ where: { slug: "other" }, update: {}, create: { name: "その他", slug: "other", sortOrder: 11 } }),
  ])

  // バッジ
  await Promise.all([
    prisma.badge.upsert({ where: { id: "badge-1" }, update: {}, create: { id: "badge-1", name: "予測の達人", description: "的中率80%以上を達成" } }),
    prisma.badge.upsert({ where: { id: "badge-2" }, update: {}, create: { id: "badge-2", name: "連続的中者", description: "5回連続的中" } }),
    prisma.badge.upsert({ where: { id: "badge-3" }, update: {}, create: { id: "badge-3", name: "コメント王", description: "コメント100件投稿" } }),
    prisma.badge.upsert({ where: { id: "badge-4" }, update: {}, create: { id: "badge-4", name: "早期参加者", description: "終了10日以上前に予測" } }),
  ])

  // 管理者ユーザー
  const adminHash = await bcrypt.hash("admin1234", 10)
  const admin = await prisma.user.upsert({
    where: { email: "admin@miraix.jp" },
    update: {},
    create: {
      name: "管理者",
      email: "admin@miraix.jp",
      passwordHash: adminHash,
      isAdmin: true,
      score: 1000,
      accuracyRate: 0.85,
    },
  })

  // 一般ユーザー
  const userHash = await bcrypt.hash("user1234", 10)
  const users = await Promise.all(
    ["田中太郎", "山田花子", "鈴木一郎", "佐藤美咲", "中村健"].map((name, i) =>
      prisma.user.upsert({
        where: { email: `user${i + 1}@miraix.jp` },
        update: {},
        create: {
          name,
          email: `user${i + 1}@miraix.jp`,
          passwordHash: userHash,
          score: Math.floor(Math.random() * 500),
          accuracyRate: 0.4 + Math.random() * 0.4,
        },
      })
    )
  )

  const allUsers = [admin, ...users]
  const now = new Date()

  // マーケット（各カテゴリ1〜2件）
  const marketsData = [
    {
      title: "次の衆議院選挙で自民党は過半数を獲得するか",
      categorySlug: "politics",
      status: "LIVE" as const,
      endAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      options: [{ name: "獲得する", prob: 0.62 }, { name: "獲得しない", prob: 0.38 }],
    },
    {
      title: "WBC 2026 日本は3連覇を達成するか",
      categorySlug: "sports",
      status: "UPCOMING" as const,
      endAt: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
      options: [{ name: "達成する", prob: 0.71 }, { name: "達成しない", prob: 0.29 }],
    },
    {
      title: "ビットコインは2026年中に500万円を超えるか",
      categorySlug: "crypto",
      status: "LIVE" as const,
      endAt: new Date("2026-12-31"),
      options: [{ name: "超える", prob: 0.44 }, { name: "超えない", prob: 0.56 }],
    },
    {
      title: "日本のGDP成長率は2026年に2%を超えるか",
      categorySlug: "economics",
      status: "LIVE" as const,
      endAt: new Date("2027-01-31"),
      options: [{ name: "超える", prob: 0.33 }, { name: "超えない", prob: 0.67 }],
    },
    {
      title: "GPT-5はClaude 4を性能で上回るか",
      categorySlug: "ai",
      status: "LIVE" as const,
      endAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
      options: [{ name: "上回る", prob: 0.48 }, { name: "上回らない", prob: 0.52 }],
    },
    {
      title: "Appleは2026年に折り畳みiPhoneを発売するか",
      categorySlug: "technology",
      status: "LIVE" as const,
      endAt: new Date("2026-12-31"),
      options: [{ name: "発売する", prob: 0.57 }, { name: "発売しない", prob: 0.43 }],
    },
    {
      title: "2026年の紅白歌合戦でYOASOBIが出場するか",
      categorySlug: "entertainment",
      status: "UPCOMING" as const,
      endAt: new Date("2026-12-31"),
      options: [{ name: "出場する", prob: 0.78 }, { name: "出場しない", prob: 0.22 }],
    },
    {
      title: "東京の2026年夏は平均気温35度を超える日が10日以上あるか",
      categorySlug: "weather",
      status: "UPCOMING" as const,
      endAt: new Date("2026-09-30"),
      options: [{ name: "10日以上", prob: 0.65 }, { name: "9日以下", prob: 0.35 }],
    },
    {
      title: "都知事選2026: 現職が再選するか",
      categorySlug: "election",
      status: "LIVE" as const,
      endAt: new Date("2026-07-31"),
      options: [{ name: "再選する", prob: 0.59 }, { name: "落選する", prob: 0.41 }],
    },
    {
      title: "2026年のノーベル物理学賞はAI研究者が受賞するか",
      categorySlug: "other",
      status: "UPCOMING" as const,
      endAt: new Date("2026-10-15"),
      options: [{ name: "受賞する", prob: 0.28 }, { name: "受賞しない", prob: 0.72 }],
    },
  ]

  for (const m of marketsData) {
    const cat = categories.find((c) => c.slug === m.categorySlug)!
    const creator = allUsers[Math.floor(Math.random() * allUsers.length)]
    const market = await prisma.market.create({
      data: {
        title: m.title,
        description: `このマーケットは研究・教育目的で作成されています。${m.title}について、みんなで予測しましょう。`,
        categoryId: cat.id,
        status: m.status,
        endAt: m.endAt,
        resolutionRule: "公式発表または信頼できる情報源による確認後、管理者が判定します。",
        createdBy: creator.id,
        options: {
          create: m.options.map((o, i) => ({
            name: o.name,
            currentProbability: o.prob,
            sortOrder: i,
          })),
        },
      },
    })

    // ダミー予測データ
    for (const user of allUsers.slice(0, 3)) {
      const optionIndex = Math.random() > 0.5 ? 0 : 1
      await prisma.prediction.create({
        data: {
          userId: user.id,
          marketId: market.id,
          optionId: (await prisma.marketOption.findFirst({
            where: { marketId: market.id, sortOrder: optionIndex },
          }))!.id,
        },
      }).catch(() => {})
    }
  }

  // メンション予測サンプル
  await prisma.mentionMarket.createMany({
    data: [
      { eventName: "首相記者会見（2026/7/1）", sourceType: "会見", targetWord: "インフレ", threshold: 5, scheduledAt: new Date("2026-07-01T14:00:00Z") },
      { eventName: "Apple WWDC 2026", sourceType: "YouTube", targetWord: "AI", threshold: 20, scheduledAt: new Date("2026-06-10T18:00:00Z") },
    ],
    skipDuplicates: true,
  })

  console.log("✅ Seed complete")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 3: シード実行**

```bash
npx prisma db seed
```

期待:
```
✅ Seed complete
```

- [ ] **Step 4: Prisma Studio でデータ確認**

```bash
npx prisma studio
```

ブラウザで `http://localhost:5555` を開き、各テーブルにデータが入っていることを確認。

- [ ] **Step 5: コミット**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: add seed data with categories, markets, users, and badges"
```

---

## Plan 1 完了チェック

- [ ] `npm run dev` でサーバーが起動する
- [ ] `npm test` で score テストが全て Pass する
- [ ] `npx prisma studio` でDBデータが確認できる
- [ ] TypeScript エラーがない (`npx tsc --noEmit`)

**次のプラン:** `plan-2-core-ui.md` — レイアウト・Header・MarketCard・各ページ・投票・コメント
