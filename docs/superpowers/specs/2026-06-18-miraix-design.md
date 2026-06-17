# MIRAIX — 予測マーケット型情報分析プラットフォーム 設計仕様書

**作成日:** 2026-06-18  
**サービス名:** MIRAIX  
**コンセプト:** 金銭を賭けず、未来イベントに対する集合知を可視化する日本向け予測プラットフォーム

---

## 1. アーキテクチャ概要

### 技術スタック

| レイヤー | 技術 |
|---|---|
| フレームワーク | Next.js 15 App Router |
| 言語 | TypeScript |
| UI | shadcn/ui + Tailwind CSS |
| チャート | Recharts |
| 状態管理 | Zustand + TanStack Query |
| ORM | Prisma |
| DB | Neon (PostgreSQL) |
| 認証 | NextAuth.js v5 (Auth.js) |
| デプロイ | Vercel + Neon |

### ディレクトリ構成

```
/app
  /(auth)
    /login/page.tsx
    /register/page.tsx
  /(main)
    /page.tsx                    ← トップページ
    /markets/page.tsx            ← マーケット一覧
    /markets/[id]/page.tsx       ← マーケット詳細
    /categories/[slug]/page.tsx  ← カテゴリ別
    /mentions/page.tsx           ← メンション予測
    /leaderboard/page.tsx        ← ランキング
    /activity/page.tsx           ← アクティビティ
    /profile/[id]/page.tsx       ← ユーザープロフィール
    /search/page.tsx             ← 検索
    /admin/
      /page.tsx                  ← 管理ダッシュボード
      /markets/page.tsx
      /users/page.tsx
      /reports/page.tsx
  /api
    /auth/[...nextauth]/route.ts
    /markets/route.ts
    /markets/[id]/route.ts
    /markets/[id]/predict/route.ts
    /markets/[id]/comments/route.ts
    /markets/[id]/resolve/route.ts
    /categories/route.ts
    /rankings/route.ts
    /activities/route.ts
    /search/route.ts
    /me/route.ts
    /admin/markets/route.ts
    /admin/users/[id]/route.ts
/components
  /layout
    /Header.tsx
    /Sidebar.tsx
    /Footer.tsx
  /market
    /MarketCard.tsx
    /MarketDetail.tsx
    /PredictionBar.tsx
    /PredictionChart.tsx
    /OptionVoteButton.tsx
  /comment
    /CommentList.tsx
    /CommentForm.tsx
    /CommentItem.tsx
  /leaderboard
    /RankingTable.tsx
  /activity
    /ActivityFeed.tsx
    /ActivityItem.tsx
  /ui (shadcn/ui components)
    /StatusBadge.tsx
    /CategoryChip.tsx
    /ProbabilityBadge.tsx
/lib
  /prisma.ts       ← Prismaクライアントシングルトン
  /auth.ts         ← NextAuth設定
  /score.ts        ← ポイント計算ロジック
  /api.ts          ← フロントエンド用フェッチ関数
/types
  /market.ts
  /user.ts
  /prediction.ts
  /activity.ts
/prisma
  /schema.prisma
  /seed.ts
/middleware.ts     ← 認証ガード
```

---

## 2. データベース設計

### Prismaスキーマ（全12テーブル）

```prisma
// ユーザー
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

// カテゴリ
model Category {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  iconUrl   String?
  sortOrder Int      @default(0)

  markets Market[]
}

// マーケット
model Market {
  id              String       @id @default(cuid())
  title           String
  description     String
  categoryId      String
  imageUrl        String?
  status          MarketStatus @default(DRAFT)
  startAt         DateTime?
  endAt           DateTime
  resolutionRule  String
  resolvedOptionId String?
  createdBy       String
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  category   Category       @relation(fields: [categoryId], references: [id])
  creator    User           @relation("CreatedBy", fields: [createdBy], references: [id])
  options    MarketOption[]
  predictions Prediction[]
  comments   Comment[]
  activities Activity[]
  positions  Position[]
  resolution Resolution?
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

// 選択肢
model MarketOption {
  id                 String   @id @default(cuid())
  marketId           String
  name               String
  currentProbability Float    @default(0.5)
  yesCount           Int      @default(0)
  noCount            Int      @default(0)
  sortOrder          Int      @default(0)
  createdAt          DateTime @default(now())

  market      Market       @relation(fields: [marketId], references: [id])
  predictions Prediction[]
  positions   Position[]
}

// 予測
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

enum PredictionType {
  FREE_VOTE
  WEIGHTED_VOTE
}

// コメント
model Comment {
  id        String   @id @default(cuid())
  userId    String
  marketId  String
  body      String
  parentId  String?
  likesCount Int     @default(0)
  createdAt DateTime @default(now())

  user   User     @relation(fields: [userId], references: [id])
  market Market   @relation(fields: [marketId], references: [id])
  parent Comment? @relation("Replies", fields: [parentId], references: [id])
  replies Comment[] @relation("Replies")
}

// アクティビティ
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

enum ActivityType {
  PREDICT
  COMMENT
  MARKET_CREATE
  MARKET_RESOLVE
  LIKE
}

// バッジ
model Badge {
  id          String @id @default(cuid())
  name        String
  description String
  iconUrl     String?

  users UserBadge[]
}

model UserBadge {
  id        String   @id @default(cuid())
  userId    String
  badgeId   String
  createdAt DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id])
  badge Badge @relation(fields: [badgeId], references: [id])
}

// ポジション（研究用オーダーブック）
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

// 解決記録
model Resolution {
  id             String   @id @default(cuid())
  marketId       String   @unique
  resultOptionId String
  sourceUrl      String?
  approvedBy     String
  resolvedAt     DateTime @default(now())

  market Market @relation(fields: [marketId], references: [id])
}

// メンション予測
model MentionMarket {
  id           String   @id @default(cuid())
  eventName    String
  sourceType   String
  targetWord   String
  threshold    Int
  scheduledAt  DateTime
  status       String   @default("UPCOMING")
  result       Int?
  createdAt    DateTime @default(now())
}
```

---

## 3. API設計

### 公開エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/markets | 一覧取得（フィルター・ページネーション） |
| GET | /api/markets/:id | 詳細取得 |
| GET | /api/categories | カテゴリ一覧 |
| GET | /api/rankings | ランキング |
| GET | /api/activities | アクティビティフィード |
| GET | /api/search | キーワード検索 |

### 認証が必要なエンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| GET | /api/me | 自分のプロフィール |
| POST | /api/markets/:id/predict | 投票 |
| PUT | /api/predictions/:id | 予測変更（1日1回） |
| POST | /api/markets/:id/comments | コメント投稿 |
| PUT | /api/comments/:id | コメント編集 |
| DELETE | /api/comments/:id | コメント削除 |
| POST | /api/comments/:id/like | いいね |

### 管理者エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| POST | /api/admin/markets | マーケット作成 |
| PUT | /api/admin/markets/:id | 編集 |
| DELETE | /api/admin/markets/:id | 削除 |
| POST | /api/admin/markets/:id/resolve | 解決判定 |
| GET | /api/admin/reports | 通報一覧 |
| PUT | /api/admin/users/:id | ユーザー管理 |

---

## 4. 認証設計

- **方式:** NextAuth.js v5（Auth.js）
- **プロバイダー:** Credentials（メール/パスワード）+ Google OAuth
- **セッション:** JWT（DB不要でVercel Edge対応）
- **ルート保護:** `middleware.ts` でパターンマッチング

```
保護対象ルート:
/profile/*  → 要ログイン
/admin/*    → 要管理者権限
/api/me     → 要ログイン
/api/markets/*/predict → 要ログイン
/api/admin/* → 要管理者権限
```

---

## 5. ポイント計算ロジック（`lib/score.ts`）

| イベント | 付与ポイント |
|---|---|
| 投票参加 | +1pt |
| 的中 | +10pt |
| 早期予測ボーナス（終了7日前以上） | +5pt |
| 少数派的中ボーナス（確率30%以下を的中） | +10pt |
| 連続的中ボーナス | +3pt |
| 連続ログイン | +2pt/日 |
| コメントいいね獲得 | +1pt/いいね |
| 荒らし・不正報告確定 | -20pt |

解決時に `score.ts` の `resolveMarket()` を呼び出し、全投票者を一括精算。

---

## 6. UIデザイン方針

### カラーパレット

```
背景:       #FFFFFF
カード:     #F8F9FA
テキスト:   #0F1117
青(YES):   #3B82F6
緑(的中):  #10B981
赤(NO):    #EF4444
黄(警告):  #F59E0B
グレー:    #6B7280
```

### 主要UIコンポーネント

- **MarketCard** — 確率バッジ・ステータスラベル・YES/NOバー・参加数・期限
- **ProbabilityChart** — 確率推移の折れ線グラフ（Recharts）
- **PredictionBar** — YES/NOのプログレスバー（青/赤）
- **StatusBadge** — LIVE(緑点滅)・終了間近(黄)・解決済み(グレー)
- **CategoryChip** — 横スクロール可能なカテゴリタブ
- **Header** — ロゴ・検索バー・カテゴリチップ・ログインボタン

---

## 7. Phase 1 実装スコープ

### 実装する機能

| 機能 | 優先度 |
|---|---|
| トップページ（ヒーロー・注目マーケット・カテゴリ） | 必須 |
| マーケット一覧（フィルター・ソート） | 必須 |
| マーケット詳細（確率チャート・投票・コメント） | 必須 |
| カテゴリページ | 必須 |
| ランキングページ | 必須 |
| アクティビティフィード | 必須 |
| ユーザープロフィール | 必須 |
| 検索ページ | 必須 |
| ログイン/登録 | 必須 |
| 管理画面（マーケット管理・解決判定） | 必須 |
| メンション予測（UI + 手動承認） | 必須 |

### 実装しない機能（Phase 2以降）

- WebSocketリアルタイム通知
- AI自動生成・ニュース連携
- 文字起こし自動判定
- メール通知
- モバイルアプリ

---

## 8. シードデータ

`prisma/seed.ts` で以下のサンプルデータを投入:

- カテゴリ: 政治・スポーツ・暗号資産・経済・AI・テクノロジー・エンタメ・天気・メンション・選挙・その他
- マーケット: 各カテゴリ3〜5件（LIVE・UPCOMING・RESOLVEDが混在）
- ユーザー: 管理者1名 + 一般ユーザー5名
- バッジ: 予測の達人・連続的中者・コメント王・早期参加者 等

---

## 9. 注意事項（法的・倫理的）

- 金銭・賭博的表現を一切使用しない
- 「予測」「投票」「参加」「スコア」「的中」「確率」「分析」の語彙に統一
- 「賭ける」「ベット」「配当」「出金」「投資」は使用禁止
- マーケット説明文に「研究・教育目的」の明記を推奨
- 実運用前に法律専門家へ確認すること（賭博規制・金融商品規制・資金決済法）
