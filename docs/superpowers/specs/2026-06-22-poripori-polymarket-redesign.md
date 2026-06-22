# ポリぽり — 本家Polymarket寄せ + 広告/画像/管理 改修 設計仕様書

**作成日:** 2026-06-22
**対象ブランチ:** claude/prediction-market-lmsr-vecg15
**サービス名:** ポリぽり（変更なし）

---

## 1. 背景と目的

現状の「ポリぽり」は Vite + React + Zustand(localStorage) のクライアント完結型 SPA で、LMSR 方式の予測市場が動作している。ただし見た目が **紫/インディゴのグラデーション + 発光シャドウ + 過剰な角丸** で、いわゆる「AI生成アプリ感」が強い。

本改修では以下を行う：

1. **ビジュアル刷新** — 本家 Polymarket に忠実なダークネイビー基調へ。グラデ・発光・過剰な角丸を全廃し、AI感を払拭する。
2. **画像枠の追加** — マーケットにサムネイル/ヘッダー画像。URL入力 + ファイル選択(base64) 両対応。
3. **広告枠の追加** — マーケット一覧のカード間インフィード広告。
4. **管理ページの追加** — 広告管理 / ダッシュボード / マーケット新規作成。

### スコープ外（今回やらない）

- バックエンド / DB / 本物の認証 — **最後にまとめて実施予定**。今回は全てクライアント側(localStorage)で完結させ、後でAPI差し替えしやすい構造にとどめる。
- コメント / アクティビティフィード / メンション予測などの新機能。

---

## 2. ビジュアル刷新（AI感の払拭）

### 2.1 デザイントークン

本家ダークネイビー忠実。`tailwind.config.js` に意味的な色を定義し、ハードコードを置き換える。

| トークン | 値 | 用途 |
|---|---|---|
| `bg` | `#0E1117` | ページ背景（単色ネイビー） |
| `surface` | `#1A1D29` | カード・パネル背景 |
| `surface-hover` | `#222632` | ホバー時 |
| `border` | `#222632` | 境界線 |
| `accent` | `#2D9CDB` | アクセント（単色ブルー） |
| `accent-hover` | `#2589C4` | アクセントホバー |
| `yes` | `#27AE60` | YES / 上昇 / 的中 |
| `no` | `#EB5757` | NO / 下落 / 外れ |
| `text` | `#E6E8EC` | 主要テキスト |
| `text-muted` | `#8A8F98` | 補助テキスト |

### 2.2 置き換え方針（AI感の原因 → 改修後）

| 現状（AI感の原因） | 改修後 |
|---|---|
| 背景 `#0c0e1a` + 紫青グラデ | `bg` 単色ネイビー |
| ロゴが `bg-gradient-to-br from-indigo-500 to-purple-600` の四角 | フラットな単色マーク（角丸 `rounded-md`、`accent` 単色） |
| `hover:shadow-[0_0_20px_rgba(99,102,241,0.08)]`（発光） | 影は使わない。`border` のホバー色変化のみ |
| indigo / purple の混在 | `accent` 単色ブルーに統一 |
| `rounded-2xl` / `rounded-xl`（過剰な角丸） | `rounded-lg`(8px) を基準、ボタンは `rounded-md` |
| 見出しの絵文字（📢 🏆 🎯 など） | lucide アイコンに統一。装飾的絵文字は使わない |
| 「結果を予測してポイントを稼ごう」等の宣伝コピー | 中立・プロダクト的な文言（例: 「予測市場」のみ、サブコピー削除 or 簡潔に） |

### 2.3 影響ファイル

- `tailwind.config.js` — トークン追加
- `src/index.css` — 背景色等のベース
- `src/components/Layout.tsx`, `Navbar.tsx`, `MarketCard.tsx`, `LoginModal.tsx`, `TradePanel.tsx`, `PriceChart.tsx`
- `src/pages/*` 全ページ — 配色クラスの置き換え

トークン化により、各ファイルでは `bg-[#13162d]` のようなハードコードを `bg-surface` 等へ置換する。

---

## 3. 画像枠

### 3.1 データモデル

`src/types.ts` の `Market` に追加：

```ts
imageUrl?: string  // 外部URL または data:image/...;base64,... を格納
```

### 3.2 ImagePicker コンポーネント（新規）

`src/components/ImagePicker.tsx`

- props: `value: string | undefined`, `onChange: (v: string) => void`, `aspect?: 'square' | 'wide'`
- UI: 「画像URLを入力」テキスト入力 ＋ 「ファイルを選択」ボタン ＋ プレビュー領域
- ファイル選択時: `FileReader` で読み込み → canvas で最大辺 400px に縮小 + JPEG品質圧縮 → base64 化して `onChange`
- localStorage 肥大化を避けるため、圧縮後サイズの上限（例: ~200KB）を超える場合は警告して拒否
- 値が空のときはプレースホルダ表示

### 3.3 表示箇所

- **MarketCard** — 左側に正方形サムネ（`imageUrl` 無しはカテゴリ別プレースホルダ：カテゴリ色 + lucide アイコン）
- **MarketDetail** — ヘッダーにワイド画像（無ければプレースホルダ）
- **AdminMarketForm**（新規作成）/ 提案フォーム — ImagePicker で設定

---

## 4. 広告枠（カード間インフィード）

### 4.1 データモデル

`src/types.ts` に追加：

```ts
export type Ad = {
  id: string
  title: string
  imageUrl: string
  linkUrl: string
  active: boolean
  createdAt: string
}
```

store(`useStore.ts`) に：

- state: `ads: Ad[]`（seed で 2〜3 件）
- actions: `addAd`, `updateAd`, `deleteAd`, `toggleAd`
- localStorage 永続化は既存の `persist` に乗せる

設定値（表示間隔）はコード定数 `AD_INTERVAL = 6`（6カードごとに1広告）とする。MVPでは管理画面からの間隔変更は行わない（YAGNI）。

### 4.2 表示ロジック

- `src/components/AdCard.tsx`（新規）— 広告カード。「広告 / PR」ラベル、`imageUrl`、`title`、クリックで `linkUrl` を `target="_blank" rel="noopener noreferrer"` で開く
- MarketList のグリッドで、アクティブ広告を `AD_INTERVAL` 枚ごとに循環挿入
- アクティブ広告が 0 件なら何も挿入しない
- 広告カードはマーケットカードと同じグリッドセル寸法

---

## 5. 管理ページ追加

すべて `role === 'admin'` のみアクセス可。非管理者は一覧へリダイレクト（既存の admin ページと同じガードパターンを踏襲）。

### 5.1 ダッシュボード `/admin`

`src/pages/admin/Dashboard.tsx`（新規）

- 統計カード4枚: 総マーケット数 / 総ユーザー数 / 総出来高(volume合計) / 承認待ち数
- 最近のマーケット5件（タイトル・カテゴリ・ステータス・参加状況・編集リンク）
- すべて store から算出

### 5.2 広告管理 `/admin/ads`

`src/pages/admin/Ads.tsx`（新規）

- 広告一覧（サムネ・タイトル・リンク・有効/無効トグル・削除）
- 「+ 新規広告」フォーム（ImagePicker 使用、title / linkUrl 入力）
- store の ad actions を呼ぶ

### 5.3 マーケット新規作成 `/admin/markets/new`

`src/pages/admin/MarketNew.tsx`（新規）

- 提案を待たず管理者が直接作成
- フォーム: question / description / category(select) / deadline(datetime-local) / 画像(ImagePicker) / 初期 `b`
- 作成時 `status: 'open'`、初期 priceHistory を 0.5 で開始
- store に `createMarket`（管理者直接作成）を追加。既存の `proposeMarket`(pending) とは別アクション

### 5.4 ナビゲーション更新

`Navbar.tsx` の `ADMIN_LINKS` を更新：

```
ダッシュボード /admin
承認待ち       /admin/proposals
マーケット管理 /admin/markets
+ 新規作成     /admin/markets/new
広告管理       /admin/ads
ユーザー管理   /admin/users
```

`App.tsx` に新ルートを追加。

---

## 6. 後方互換 / 移行

- localStorage キーは既存 `poripori-v1` を維持。既存保存データには `ads` や `imageUrl` が無いため、store 初期化時に `ads` 未定義なら seed を補い、`imageUrl` 未定義は許容（optional）。
- 既存マーケットは画像なし→プレースホルダ表示で問題なく動作する。

---

## 7. テスト/検証方針

今回は UI 改修中心のためユニットテストは追加しない（既存にテスト基盤なし）。検証は手動で行う：

- `npm run build` が成功する（tsc 型チェック含む）
- 一覧で広告がカード間に挿入される / 広告0件で挿入されない
- 画像のURL入力・ファイル選択がプレビューされ保存される
- 管理3ページが管理者のみ表示・動作する
- 配色: 紫グラデ・発光が画面から消えていること

---

## 8. 実装順序（概略）

1. デザイントークン整備（tailwind / index.css）と既存コンポーネントの配色置換
2. ImagePicker + Market 画像枠（型・カード・詳細・フォーム）
3. Ad モデル + store actions + AdCard + 一覧インフィード
4. 管理ページ3種（ダッシュボード / 広告管理 / マーケット新規作成）+ ナビ/ルート更新
5. ビルド確認・手動検証
