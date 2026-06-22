# ポリぽり 本家寄せ + 広告/画像/管理 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ポリぽりSPAを本家Polymarket忠実のダークネイビーへ刷新し、マーケット画像枠・カード間インフィード広告・管理ページ(ダッシュボード/広告管理/マーケット新規作成)を追加する。

**Architecture:** 既存の Vite + React + Zustand(localStorage) 構成を維持。色はTailwindのセマンティックトークン化し、ハードコードを置換。広告/画像はstoreとlocalStorageで完結させ、バックエンドは導入しない（後日まとめて実施）。

**Tech Stack:** Vite, React 18, TypeScript, react-router-dom 6, Zustand 4, TailwindCSS 3, lucide-react, recharts, date-fns

## Global Constraints

- バックエンド/DB/本物の認証は導入しない（localStorageのみ、後日まとめて実施）
- localStorage キーは既存 `poripori-v1` を維持。新フィールド(`ads`, `imageUrl`)は未定義を許容し初期化時に補完する
- 配色は紫グラデーション・発光シャドウ・過剰な角丸を一切使わない（AI感払拭）
- セマンティックカラートークン: `bg=#0E1117`, `surface=#1A1D29`, `surface-hover=#222632`, `border=#222632`, `accent=#2D9CDB`, `accent-hover=#2589C4`, `yes=#27AE60`, `no=#EB5757`, `text=#E6E8EC`, `text-muted=#8A8F98`
- テスト基盤は無いため各タスクは `npm run build`（tsc型チェック+ビルド）成功を検証ゲートとする
- 角丸はカード/パネル `rounded-lg`、ボタン/小要素 `rounded-md` を基準とする
- 装飾的絵文字は使わず lucide-react アイコンを使う

---

## File Structure

| ファイル | 責務 | 操作 |
|---|---|---|
| `tailwind.config.js` | セマンティックカラートークン定義 | Modify |
| `src/index.css` | ベース背景/文字色/スクロールバー | Modify |
| `src/types.ts` | `Market.imageUrl` 追加 / `Ad` 型追加 | Modify |
| `src/components/ImagePicker.tsx` | URL入力+ファイル選択(圧縮base64) 共通入力 | Create |
| `src/components/MarketImage.tsx` | 画像 or カテゴリ別プレースホルダ表示 | Create |
| `src/components/AdCard.tsx` | インフィード広告カード | Create |
| `src/store/useStore.ts` | `ads` state / ad actions / `createMarket` 追加 | Modify |
| `src/components/MarketCard.tsx` | サムネ追加 + 配色刷新 | Modify |
| `src/components/Layout.tsx` | 背景トークン化 | Modify |
| `src/components/Navbar.tsx` | 配色刷新 + 管理リンク更新 | Modify |
| `src/components/LoginModal.tsx` | 配色刷新 | Modify |
| `src/components/TradePanel.tsx` | 配色刷新 | Modify |
| `src/components/PriceChart.tsx` | 配色刷新 | Modify |
| `src/pages/MarketList.tsx` | 配色刷新 + 広告インフィード挿入 | Modify |
| `src/pages/MarketDetail.tsx` | ヘッダー画像 + 配色刷新 | Modify |
| `src/pages/Portfolio.tsx` | 配色刷新 | Modify |
| `src/pages/Ranking.tsx` | 配色刷新 | Modify |
| `src/pages/Propose.tsx` | 画像枠追加 + 配色刷新 | Modify |
| `src/pages/admin/Dashboard.tsx` | 管理ダッシュボード | Create |
| `src/pages/admin/Ads.tsx` | 広告管理(CRUD) | Create |
| `src/pages/admin/MarketNew.tsx` | マーケット新規作成 | Create |
| `src/pages/admin/Markets.tsx` | 配色刷新 | Modify |
| `src/pages/admin/Proposals.tsx` | 配色刷新 | Modify |
| `src/pages/admin/Users.tsx` | 配色刷新 | Modify |
| `src/App.tsx` | 新ルート登録 | Modify |

### 配色置換マッピング（全 Modify ファイル共通）

各ファイルの Tailwind クラスを以下で機械的に置換する。意味が変わる箇所はトークンへ。

| 旧クラス（断片） | 新クラス |
|---|---|
| `bg-[#0c0e1a]` | `bg-bg` |
| `bg-[#13162d]` | `bg-surface` |
| `bg-[#1e2244]` | `bg-surface-hover` |
| `bg-[#1a1d3e]` | `bg-surface-hover` |
| `border-[#2a2d4a]` | `border-border` |
| `divide-[#1e2244]` | `divide-border` |
| `hover:bg-[#1e2244]` | `hover:bg-surface-hover` |
| `hover:bg-[#1a1d3e]` | `hover:bg-surface-hover` |
| `text-white`（本文・見出し） | `text-text` |
| `text-slate-400` | `text-text-muted` |
| `text-slate-500` | `text-text-muted` |
| `indigo-600` / `indigo-500`（背景・ボタン） | `accent` / `accent-hover` |
| `text-indigo-400` / `bg-indigo-600/20` 等のアクセント | `text-accent` / `bg-accent/15` |
| `from-indigo-500 to-purple-600`（グラデ） | 削除し `bg-accent` 単色 |
| `emerald-*`（YES/上昇/的中） | `yes`（例 `text-emerald-400`→`text-yes`, `bg-emerald-500`→`bg-yes`） |
| `red-*`（NO/下落/外れ） | `no`（例 `text-red-400`→`text-no`, `bg-red-500`→`bg-no`） |
| `rounded-2xl` | `rounded-lg` |
| `rounded-xl` | `rounded-lg`（小ボタンは `rounded-md`） |
| `hover:shadow-[0_0_20px_rgba(99,102,241,0.08)]` | 削除（影なし） |
| `shadow-2xl` / その他発光・大型影 | 削除 |

> 注: `yes`/`no`/`accent` はカスタムカラーのため `/15` `/20` の不透明度サフィックスがそのまま使える（Tailwind v3）。`bg-yes/10` 等も有効。

---

## Task 1: デザイントークン整備

**Files:**
- Modify: `tailwind.config.js`
- Modify: `src/index.css`

**Interfaces:**
- Produces: Tailwindユーティリティ `bg-bg`, `bg-surface`, `bg-surface-hover`, `border-border`, `text-text`, `text-text-muted`, `bg-accent`/`text-accent`/`bg-accent-hover`, `bg-yes`/`text-yes`, `bg-no`/`text-no`（以降の全タスクで使用）

- [ ] **Step 1: `tailwind.config.js` を全置換**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0E1117',
        surface: '#1A1D29',
        'surface-hover': '#222632',
        border: '#222632',
        accent: '#2D9CDB',
        'accent-hover': '#2589C4',
        yes: '#27AE60',
        no: '#EB5757',
        text: '#E6E8EC',
        'text-muted': '#8A8F98',
      },
      borderRadius: {
        lg: '8px',
        md: '6px',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: `src/index.css` を全置換**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

body {
  background-color: #0E1117;
  color: #E6E8EC;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: #1A1D29;
}

::-webkit-scrollbar-thumb {
  background: #222632;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #2D313D;
}

input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
```

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: `✓ built` でエラーなし（既存の `bg-[#...]` クラスはまだ残っているが任意値クラスなのでビルドは通る）

- [ ] **Step 4: コミット**

```bash
git add tailwind.config.js src/index.css
git commit -m "feat: add semantic color tokens for Polymarket-style theme"
```

---

## Task 2: 全コンポーネント・ページの配色刷新

既存の全 `.tsx`（Task 3以降で新規作成するものを除く）に対し、上記「配色置換マッピング」を適用する。グラデーション・発光シャドウ・`rounded-2xl` を排除し、トークンへ統一する。

**Files:**
- Modify: `src/components/Layout.tsx`
- Modify: `src/components/Navbar.tsx`
- Modify: `src/components/MarketCard.tsx`
- Modify: `src/components/LoginModal.tsx`
- Modify: `src/components/TradePanel.tsx`
- Modify: `src/components/PriceChart.tsx`
- Modify: `src/pages/MarketList.tsx`
- Modify: `src/pages/MarketDetail.tsx`
- Modify: `src/pages/Portfolio.tsx`
- Modify: `src/pages/Ranking.tsx`
- Modify: `src/pages/Propose.tsx`
- Modify: `src/pages/admin/Markets.tsx`
- Modify: `src/pages/admin/Proposals.tsx`
- Modify: `src/pages/admin/Users.tsx`

**Interfaces:**
- Consumes: Task 1 のトークン

- [ ] **Step 1: `Layout.tsx` の背景をトークン化**

`bg-[#0c0e1a]` → `bg-bg` に置換（1箇所）。

- [ ] **Step 2: `Navbar.tsx` を刷新**

ロゴのグラデ四角を単色に置換。該当ブロックを次へ：

```tsx
<Link to="/" className="flex items-center gap-2 shrink-0">
  <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center">
    <TrendingUp size={14} className="text-white" />
  </div>
  <span className="font-bold text-text tracking-tight text-lg">ポリぽり</span>
</Link>
```

加えて Navbar 内の残りクラスをマッピングで置換：`bg-[#0c0e1a]/95`→`bg-bg/95`、`border-[#2a2d4a]`→`border-border`、`text-slate-400`→`text-text-muted`、`text-white`→`text-text`、`bg-indigo-600/20 text-indigo-400`→`bg-accent/15 text-accent`、`bg-amber-500/20 text-amber-400`(管理リンクのアクティブ)→`bg-accent/15 text-accent`、`bg-[#1e2244]`→`bg-surface-hover`、`hover:border-indigo-500/50`→`hover:border-accent/50`、`bg-indigo-500/30 text-indigo-400`(アバター)→`bg-accent/20 text-accent`、`bg-[#13162d]`→`bg-surface`、`bg-indigo-600 hover:bg-indigo-500`(ログインボタン)→`bg-accent hover:bg-accent-hover`、`text-red-400 hover:bg-red-500/10`→`text-no hover:bg-no/10`、`rounded-xl`→`rounded-lg`。

> ADMIN_LINKS 配列の更新は Task 8 で行う（ここでは配色のみ）。

- [ ] **Step 3: `MarketCard.tsx` を刷新（画像は Task 4 で追加。ここでは配色のみ）**

置換内容：
- ルート `Link` の `className` を:
  `block bg-surface hover:bg-surface-hover border border-border hover:border-accent/40 rounded-lg p-5 transition-colors duration-200 group`
  （`hover:shadow-[...]`（発光）と `transition-all` を削除し `transition-colors` に）
- `CATEGORY_COLORS` の各値の `-400` 系はそのまま可（カテゴリ色は多色で意図的）。ただし `text-slate-400 bg-slate-400/10`(デフォルト) は `text-text-muted bg-surface-hover` に。
- `STATUS_BADGE`: `bg-slate-500/20 text-slate-400`→`bg-surface-hover text-text-muted`、`bg-emerald-500/20 text-emerald-400`→`bg-yes/20 text-yes`、`bg-yellow-500/20 text-yellow-400`→そのまま（承認待ちの黄は維持）
- 質問文 `text-white ... group-hover:text-indigo-100`→`text-text ... group-hover:text-text`
- YESボタン `bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20`→`bg-yes/10 border-yes/20 text-yes hover:bg-yes/20`
- NOボタン `bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20`→`bg-no/10 border-no/20 text-no hover:bg-no/20`
- バー `bg-emerald-500`→`bg-yes`、`bg-red-500`→`bg-no`
- 出来高/締切 `text-slate-500`→`text-text-muted`
- 結果バッジ `bg-emerald-500/15 text-emerald-400`→`bg-yes/15 text-yes`、`bg-red-500/15 text-red-400`→`bg-no/15 text-no`
- `pending` 文言 `text-slate-500`→`text-text-muted`

- [ ] **Step 4: `LoginModal.tsx`, `TradePanel.tsx`, `PriceChart.tsx` を刷新**

各ファイルにマッピングを適用。特に注意：
- `PriceChart.tsx`: recharts の `stroke`/`fill` に色16進が直書きされている場合、YES線は `#27AE60`、グリッド/軸は `#222632`/`#8A8F98` に変更（紫 `#6366f1` 等を使っていれば `#2D9CDB` に）。
- `TradePanel.tsx`: 売買ボタンの emerald/red を yes/no トークンへ、indigo を accent へ。
- `LoginModal.tsx`: モーダル背景 `bg-[#13162d]`→`bg-surface`、ボタン indigo→accent、`shadow-2xl` 削除、`rounded-2xl`→`rounded-lg`。

- [ ] **Step 5: ページ群を刷新**

`MarketList.tsx`, `MarketDetail.tsx`, `Portfolio.tsx`, `Ranking.tsx`, `Propose.tsx`, `admin/Markets.tsx`, `admin/Proposals.tsx`, `admin/Users.tsx` にマッピングを適用。
- 見出し下のサブコピー「結果を予測してポイントを稼ごう」（MarketList.tsx）は削除し、`<h1>` の `予測市場` のみ残す。
- `Propose.tsx` の絵文字 `✅`/`⚠` は lucide の `CheckCircle2`/`AlertTriangle` に置換（import 追加）。
- `admin/Markets.tsx` の解決キャンセル `✕` は lucide `X` に置換。
- アクセント `indigo` は全て `accent`、emerald→yes、red→no、slate-400/500→text-muted。

- [ ] **Step 6: 紫グラデ・発光の残存チェック**

Run: `npx tsc --noEmit`
さらに目視/検索で `gradient`, `shadow-[`, `indigo`, `purple`, `rounded-2xl` が src 配下に残っていないことを確認（カテゴリ色の多色指定を除く）。残っていれば修正。

- [ ] **Step 7: ビルド確認**

Run: `npm run build`
Expected: エラーなしでビルド成功

- [ ] **Step 8: コミット**

```bash
git add src/
git commit -m "refactor: apply Polymarket dark theme, remove gradients and glow"
```

---

## Task 3: ImagePicker コンポーネント + Market.imageUrl 型

**Files:**
- Modify: `src/types.ts`
- Create: `src/components/ImagePicker.tsx`

**Interfaces:**
- Produces: `Market.imageUrl?: string`
- Produces: `ImagePicker` コンポーネント
  `props: { value: string | undefined; onChange: (v: string) => void; aspect?: 'square' | 'wide' }`

- [ ] **Step 1: `src/types.ts` の `Market` に `imageUrl` を追加**

`Market` 型の `volume: number` の下に追記：

```ts
  volume: number
  imageUrl?: string
  priceHistory: Array<{ t: string; yes: number }>
```

- [ ] **Step 2: `src/components/ImagePicker.tsx` を作成**

```tsx
import { useRef, useState } from 'react'
import { ImageIcon, Link2, Upload, X } from 'lucide-react'

type Props = {
  value: string | undefined
  onChange: (v: string) => void
  aspect?: 'square' | 'wide'
}

const MAX_EDGE = 400
const MAX_BYTES = 200 * 1024 // 圧縮後 ~200KB 上限

function compressToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas context unavailable'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })
}

export default function ImagePicker({ value, onChange, aspect = 'wide' }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const aspectClass = aspect === 'square' ? 'aspect-square w-32' : 'aspect-[16/9] w-full max-w-sm'

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError('')
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await compressToDataUrl(file)
      if (dataUrl.length > MAX_BYTES * 1.37) {
        setError('画像が大きすぎます。別の画像を選んでください。')
        return
      }
      onChange(dataUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : '画像処理に失敗しました')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="画像URLを入力（https://...）"
          className="w-full pl-9 pr-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-md text-sm text-text placeholder-text-muted outline-none transition-colors"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-hover border border-border text-text-muted hover:text-text text-xs transition-colors"
        >
          <Upload size={13} />
          画像を選択
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-text-muted hover:text-no text-xs transition-colors"
          >
            <X size={13} />
            クリア
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </div>

      {error && <p className="text-xs text-no">{error}</p>}

      <div className={`${aspectClass} rounded-lg border border-border bg-surface-hover overflow-hidden flex items-center justify-center`}>
        {value ? (
          <img src={value} alt="プレビュー" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={28} className="text-text-muted" />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/types.ts src/components/ImagePicker.tsx
git commit -m "feat: add ImagePicker (URL + file upload with compression) and Market.imageUrl"
```

---

## Task 4: マーケット画像の表示

**Files:**
- Create: `src/components/MarketImage.tsx`
- Modify: `src/components/MarketCard.tsx`
- Modify: `src/pages/MarketDetail.tsx`
- Modify: `src/pages/Propose.tsx`

**Interfaces:**
- Consumes: `Market.imageUrl`（Task 3）, `ImagePicker`（Task 3）
- Produces: `MarketImage` コンポーネント
  `props: { src?: string; category: string; className?: string }`

- [ ] **Step 1: `src/components/MarketImage.tsx` を作成**

画像があれば表示、無ければカテゴリ色 + アイコンのプレースホルダ。

```tsx
import { Landmark, Bitcoin, Trophy, Bot, Cpu, FlaskConical, Clapperboard, HelpCircle } from 'lucide-react'

type Props = { src?: string; category: string; className?: string }

const CAT_ICON: Record<string, typeof HelpCircle> = {
  Politics: Landmark,
  Crypto: Bitcoin,
  Sports: Trophy,
  AI: Bot,
  Tech: Cpu,
  Science: FlaskConical,
  Entertainment: Clapperboard,
}

const CAT_BG: Record<string, string> = {
  Politics: 'bg-blue-500/15 text-blue-400',
  Crypto: 'bg-orange-500/15 text-orange-400',
  Sports: 'bg-green-500/15 text-green-400',
  AI: 'bg-purple-500/15 text-purple-400',
  Tech: 'bg-cyan-500/15 text-cyan-400',
  Science: 'bg-sky-500/15 text-sky-400',
  Entertainment: 'bg-pink-500/15 text-pink-400',
}

export default function MarketImage({ src, category, className = '' }: Props) {
  if (src) {
    return <img src={src} alt="" className={`object-cover ${className}`} />
  }
  const Icon = CAT_ICON[category] ?? HelpCircle
  const bg = CAT_BG[category] ?? 'bg-surface-hover text-text-muted'
  return (
    <div className={`flex items-center justify-center ${bg} ${className}`}>
      <Icon size={28} />
    </div>
  )
}
```

> 注: カテゴリのプレースホルダ色は多色を意図的に許可（本家もカテゴリ色を持つ）。これは「紫グラデ排除」の対象外。

- [ ] **Step 2: `MarketCard.tsx` にサムネを追加**

`import MarketImage from './MarketImage'` を追加。質問文ブロックの直前（カテゴリ/ステータス行の直後）に左サムネ + 質問の横並びへ変更。具体的には、カテゴリ行と質問 `<p>` を次の構造で囲む：

```tsx
<div className="flex gap-3 mb-4">
  <MarketImage
    src={market.imageUrl}
    category={market.category}
    className="w-12 h-12 rounded-md shrink-0"
  />
  <p className="text-sm font-medium text-text leading-snug line-clamp-3 group-hover:text-text transition-colors">
    {market.question}
  </p>
</div>
```

（既存の質問 `<p>` の `mb-4` はラッパ側へ移したので削除する。）

- [ ] **Step 3: `MarketDetail.tsx` にヘッダー画像を追加**

`import MarketImage from '../components/MarketImage'` を追加。マーケットタイトル表示ブロックの先頭に、ワイドのヘッダー画像を挿入：

```tsx
<MarketImage
  src={market.imageUrl}
  category={market.category}
  className="w-full h-40 rounded-lg mb-4"
/>
```

（既存レイアウトのタイトル `<h1>` の直前に置く。）

- [ ] **Step 4: `Propose.tsx` に画像枠を追加**

`import ImagePicker from '../components/ImagePicker'` を追加。`form` state に `imageUrl: ''` を追加：

```tsx
const [form, setForm] = useState({
  question: '',
  description: '',
  deadline: '',
  category: 'AI' as Exclude<Category, 'All'>,
  imageUrl: '',
})
```

カテゴリ select のブロックの後（フォームパネル内）に画像欄を追加：

```tsx
<div>
  <label className="block text-sm font-medium text-text mb-2">画像（任意）</label>
  <ImagePicker value={form.imageUrl} onChange={(v) => setForm((f) => ({ ...f, imageUrl: v }))} />
</div>
```

> `proposeMarket` は Task 5 で `imageUrl` を受け取れるよう拡張する。このタスクでは form に値を持たせるところまで。

- [ ] **Step 5: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add src/components/MarketImage.tsx src/components/MarketCard.tsx src/pages/MarketDetail.tsx src/pages/Propose.tsx
git commit -m "feat: show market thumbnail/header images with category placeholders"
```

---

## Task 5: Ad モデル + store actions + createMarket + proposeMarket拡張

**Files:**
- Modify: `src/types.ts`
- Modify: `src/store/useStore.ts`

**Interfaces:**
- Produces: `Ad` 型
  ```ts
  type Ad = { id: string; title: string; imageUrl: string; linkUrl: string; active: boolean; createdAt: string }
  ```
- Produces: store state `ads: Ad[]`
- Produces: store actions:
  - `addAd(data: { title: string; imageUrl: string; linkUrl: string }): void`
  - `updateAd(id: string, data: Partial<Pick<Ad, 'title' | 'imageUrl' | 'linkUrl'>>): void`
  - `toggleAd(id: string): void`
  - `deleteAd(id: string): void`
  - `createMarket(data: { question: string; description: string; deadline: string; category: string; imageUrl?: string; b?: number }): void`
- Produces: 拡張された `proposeMarket(data: { question; description; deadline; category; imageUrl? })`

- [ ] **Step 1: `src/types.ts` に `Ad` 型を追加**

ファイル末尾に追記：

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

- [ ] **Step 2: `useStore.ts` の import と seed と state を更新**

import 行に `Ad` を追加：

```ts
import type { User, Market, Position, Trade, Category, Ad } from '../types'
```

`SEED_TRADES` の下に seed 広告を追加：

```ts
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
```

`StoreState` 型に `ads: Ad[]` を追加：

```ts
type StoreState = {
  users: User[]
  markets: Market[]
  positions: Position[]
  trades: Trade[]
  ads: Ad[]
  currentUserId: string | null
}
```

`StoreActions` 型に追記：

```ts
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
```

（既存の `proposeMarket` 宣言は上記の拡張版で置き換える。）

- [ ] **Step 3: 初期 state に ads を補完（後方互換）**

`const initial: StoreState = saved ?? {...}` を次に置き換える（saved に ads が無い旧データへ補完）：

```ts
const base: StoreState = {
  users: SEED_USERS,
  markets: SEED_MARKETS,
  positions: SEED_POSITIONS,
  trades: SEED_TRADES,
  ads: SEED_ADS,
  currentUserId: null,
}
const initial: StoreState = saved ? { ...base, ...saved, ads: saved.ads ?? SEED_ADS } : base
```

- [ ] **Step 4: `proposeMarket` を imageUrl 対応に更新**

既存の `proposeMarket` 内 `const market: Market = {...}` の `volume: 0,` の下に `imageUrl: data.imageUrl,` を追加。

- [ ] **Step 5: `createMarket` と ad actions を実装**

`proposeMarket` アクションの直後に追加：

```ts
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
```

- [ ] **Step 6: `...initial` 展開の確認**

`return { ...initial, ... }` で `ads` が初期 state として展開されることを確認（`initial` に ads が含まれるため自動で入る）。

- [ ] **Step 7: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 8: コミット**

```bash
git add src/types.ts src/store/useStore.ts
git commit -m "feat: add Ad model, ad CRUD actions, createMarket, image-aware proposeMarket"
```

---

## Task 6: AdCard + 一覧インフィード挿入

**Files:**
- Create: `src/components/AdCard.tsx`
- Modify: `src/pages/MarketList.tsx`

**Interfaces:**
- Consumes: store `ads`（Task 5）, `Ad` 型
- Produces: `AdCard` コンポーネント `props: { ad: Ad }`

- [ ] **Step 1: `src/components/AdCard.tsx` を作成**

```tsx
import { ExternalLink } from 'lucide-react'
import MarketImage from './MarketImage'
import type { Ad } from '../types'

export default function AdCard({ ad }: { ad: Ad }) {
  return (
    <a
      href={ad.linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-surface hover:bg-surface-hover border border-border hover:border-accent/40 rounded-lg p-5 transition-colors duration-200 group relative"
    >
      <span className="absolute top-3 right-3 text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-hover text-text-muted border border-border">
        広告
      </span>
      <div className="flex gap-3 mb-4">
        {ad.imageUrl ? (
          <img src={ad.imageUrl} alt="" className="w-12 h-12 rounded-md shrink-0 object-cover" />
        ) : (
          <MarketImage category="" className="w-12 h-12 rounded-md shrink-0" />
        )}
        <p className="text-sm font-medium text-text leading-snug line-clamp-3 pr-8">{ad.title}</p>
      </div>
      <div className="flex items-center gap-1 text-xs text-accent">
        <ExternalLink size={11} />
        <span>詳しく見る</span>
      </div>
    </a>
  )
}
```

- [ ] **Step 2: `MarketList.tsx` に広告インフィードを実装**

import を追加：

```tsx
import AdCard from '../components/AdCard'
```

コンポーネント先頭の `const { markets } = useStore()` を次に変更：

```tsx
const { markets, ads } = useStore()
```

`AD_INTERVAL` 定数をファイル上部（CATEGORIES 定義の近く）に追加：

```tsx
const AD_INTERVAL = 6
```

グリッド描画部分（`open.map(...)` のブロック）を、広告を `AD_INTERVAL` 枚ごとに挿入する形へ置き換える：

```tsx
{open.length === 0 ? (
  <div className="text-center py-20 text-text-muted">
    <p className="text-lg">マーケットが見つかりません</p>
    <p className="text-sm mt-1">別のカテゴリやキーワードで検索してみてください</p>
  </div>
) : (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {(() => {
      const activeAds = ads.filter((a) => a.active)
      const cells: React.ReactNode[] = []
      open.forEach((m, i) => {
        cells.push(<MarketCard key={m.id} market={m} />)
        if (activeAds.length > 0 && (i + 1) % AD_INTERVAL === 0) {
          const ad = activeAds[Math.floor(i / AD_INTERVAL) % activeAds.length]
          cells.push(<AdCard key={`ad-${i}-${ad.id}`} ad={ad} />)
        }
      })
      return cells
    })()}
  </div>
)}
```

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 4: 手動確認**

Run: `npm run dev`
- 一覧でマーケット6枚ごとに「広告」ラベル付きカードが入ること
- 管理で全広告を無効化（Task 8後）すると挿入されないこと（このタスクでは seed の active:true により表示される）

- [ ] **Step 5: コミット**

```bash
git add src/components/AdCard.tsx src/pages/MarketList.tsx
git commit -m "feat: insert in-feed ad cards into market list"
```

---

## Task 7: マーケット新規作成ページ（管理者）

**Files:**
- Create: `src/pages/admin/MarketNew.tsx`

**Interfaces:**
- Consumes: store `createMarket`（Task 5）, `ImagePicker`（Task 3）

- [ ] **Step 1: `src/pages/admin/MarketNew.tsx` を作成**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import ImagePicker from '../../components/ImagePicker'
import type { Category } from '../../types'

const CATEGORIES: Exclude<Category, 'All'>[] = [
  'Politics', 'Crypto', 'Sports', 'AI', 'Tech', 'Science', 'Entertainment',
]
const CAT_LABELS: Record<string, string> = {
  Politics: '政治', Crypto: '暗号資産', Sports: 'スポーツ',
  AI: 'AI', Tech: 'テクノロジー', Science: '科学', Entertainment: 'エンタメ',
}

export default function MarketNew() {
  const { currentUser, createMarket } = useStore()
  const user = currentUser()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    question: '',
    description: '',
    deadline: '',
    category: 'AI' as Exclude<Category, 'All'>,
    imageUrl: '',
    b: 100,
  })

  if (user?.role !== 'admin') {
    return <div className="text-center py-20 text-no">管理者権限が必要です</div>
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.question.trim() || !form.description.trim() || !form.deadline) return
    createMarket(form)
    navigate('/admin/markets')
  }

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text mb-1">マーケット新規作成</h1>
        <p className="text-text-muted text-sm">承認を経ず、即時に公開されます</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-surface border border-border rounded-lg p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-text mb-2">質問 <span className="text-no">*</span></label>
            <input
              type="text" required maxLength={100}
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              placeholder="例：2026年内にAGIは実現するか？"
              className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-md text-sm text-text placeholder-text-muted outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">解決条件 <span className="text-no">*</span></label>
            <textarea
              required maxLength={500} rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="誰が見ても明確な条件と情報源を記載してください。"
              className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-md text-sm text-text placeholder-text-muted outline-none transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">締切日 <span className="text-no">*</span></label>
              <input
                type="date" required min={minDateStr}
                value={form.deadline.split('T')[0]}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value + 'T23:59:59Z' }))}
                className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-md text-sm text-text outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-2">カテゴリ <span className="text-no">*</span></label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Exclude<Category, 'All'> }))}
                className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-md text-sm text-text outline-none transition-colors"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">流動性パラメータ b</label>
            <input
              type="number" min={10}
              value={form.b}
              onChange={(e) => setForm((f) => ({ ...f, b: Number(e.target.value) }))}
              className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-md text-sm text-text outline-none transition-colors"
            />
            <p className="text-xs text-text-muted mt-1">大きいほど価格が動きにくくなります（既定: 100）</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">画像（任意）</label>
            <ImagePicker value={form.imageUrl} onChange={(v) => setForm((f) => ({ ...f, imageUrl: v }))} />
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 rounded-md bg-accent hover:bg-accent-hover text-white font-semibold transition-colors"
        >
          マーケットを公開する
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: エラーなし（ルート未登録なのでまだ画面遷移はできない。Task 8 で登録）

- [ ] **Step 3: コミット**

```bash
git add src/pages/admin/MarketNew.tsx
git commit -m "feat: add admin market creation page"
```

---

## Task 8: 管理ダッシュボード + 広告管理 + ルート/ナビ配線

**Files:**
- Create: `src/pages/admin/Dashboard.tsx`
- Create: `src/pages/admin/Ads.tsx`
- Modify: `src/components/Navbar.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: store `markets`, `users`, `ads`, `addAd`, `updateAd`, `toggleAd`, `deleteAd`（Task 5）, `ImagePicker`（Task 3）, `MarketNew`（Task 7）

- [ ] **Step 1: `src/pages/admin/Dashboard.tsx` を作成**

```tsx
import { Link } from 'react-router-dom'
import { BarChart3, Users, TrendingUp, Clock } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { marketPrice } from '../../lib/lmsr'

export default function Dashboard() {
  const { markets, users, currentUser } = useStore()
  const user = currentUser()
  if (user?.role !== 'admin') {
    return <div className="text-center py-20 text-no">管理者権限が必要です</div>
  }

  const totalVolume = markets.reduce((s, m) => s + m.volume, 0)
  const pending = markets.filter((m) => m.status === 'pending').length
  const stats = [
    { label: '総マーケット数', value: markets.length.toLocaleString(), Icon: BarChart3 },
    { label: '総ユーザー数', value: users.length.toLocaleString(), Icon: Users },
    { label: '総出来高', value: `${totalVolume.toLocaleString()} pt`, Icon: TrendingUp },
    { label: '承認待ち', value: pending.toLocaleString(), Icon: Clock },
  ]
  const recent = [...markets].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text">管理ダッシュボード</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, Icon }) => (
          <div key={label} className="bg-surface border border-border rounded-lg p-4">
            <Icon size={18} className="text-accent mb-2" />
            <div className="text-2xl font-bold text-text">{value}</div>
            <div className="text-xs text-text-muted mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold text-text mb-3">最近のマーケット</h2>
        <div className="space-y-2">
          {recent.map((m) => (
            <div key={m.id} className="flex items-center gap-3 bg-surface-hover rounded-md p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text line-clamp-1">{m.question}</p>
                <p className="text-xs text-text-muted">
                  {m.category} ・ {m.status} ・ YES {Math.round(marketPrice(m).yes * 100)}%
                </p>
              </div>
              <Link to="/admin/markets" className="text-xs text-accent hover:underline shrink-0">管理</Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `src/pages/admin/Ads.tsx` を作成**

```tsx
import { useState } from 'react'
import { Trash2, ExternalLink } from 'lucide-react'
import { useStore } from '../../store/useStore'
import ImagePicker from '../../components/ImagePicker'

export default function Ads() {
  const { ads, currentUser, addAd, toggleAd, deleteAd } = useStore()
  const user = currentUser()
  const [form, setForm] = useState({ title: '', imageUrl: '', linkUrl: '' })

  if (user?.role !== 'admin') {
    return <div className="text-center py-20 text-no">管理者権限が必要です</div>
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.linkUrl.trim()) return
    addAd(form)
    setForm({ title: '', imageUrl: '', linkUrl: '' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text mb-1">広告管理</h1>
        <p className="text-text-muted text-sm">マーケット一覧に挿入されるインフィード広告</p>
      </div>

      <form onSubmit={handleAdd} className="bg-surface border border-border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text">新規広告</h2>
        <div>
          <label className="block text-sm font-medium text-text mb-2">タイトル <span className="text-no">*</span></label>
          <input
            type="text" required maxLength={80}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-md text-sm text-text placeholder-text-muted outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-2">リンクURL <span className="text-no">*</span></label>
          <input
            type="url" required
            value={form.linkUrl}
            onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
            placeholder="https://..."
            className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-md text-sm text-text placeholder-text-muted outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-2">画像</label>
          <ImagePicker value={form.imageUrl} onChange={(v) => setForm((f) => ({ ...f, imageUrl: v }))} />
        </div>
        <button type="submit" className="px-4 py-2 rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors">
          広告を追加
        </button>
      </form>

      <div className="space-y-2">
        {ads.length === 0 ? (
          <div className="text-center py-10 text-text-muted">広告がありません</div>
        ) : (
          ads.map((ad) => (
            <div key={ad.id} className="flex items-center gap-3 bg-surface border border-border rounded-lg p-3">
              {ad.imageUrl
                ? <img src={ad.imageUrl} alt="" className="w-12 h-12 rounded-md object-cover shrink-0" />
                : <div className="w-12 h-12 rounded-md bg-surface-hover shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text line-clamp-1">{ad.title}</p>
                <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1">
                  <ExternalLink size={11} />{ad.linkUrl}
                </a>
              </div>
              <button
                onClick={() => toggleAd(ad.id)}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  ad.active
                    ? 'bg-yes/15 text-yes border-yes/30'
                    : 'bg-surface-hover text-text-muted border-border'
                }`}
              >
                {ad.active ? '有効' : '無効'}
              </button>
              <button onClick={() => deleteAd(ad.id)} className="text-text-muted hover:text-no transition-colors p-1">
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `Navbar.tsx` の `ADMIN_LINKS` を更新**

```tsx
const ADMIN_LINKS = [
  { to: '/admin', label: 'ダッシュボード' },
  { to: '/admin/proposals', label: '承認待ち' },
  { to: '/admin/markets', label: 'マーケット管理' },
  { to: '/admin/markets/new', label: '新規作成' },
  { to: '/admin/ads', label: '広告管理' },
  { to: '/admin/users', label: 'ユーザー管理' },
]
```

> 注: `/admin` は完全一致でないとマーケット管理等でもアクティブ判定されるが、既存の `location.pathname === l.to` は完全一致なので問題なし。

- [ ] **Step 4: `App.tsx` に新ルートを登録**

import を追加：

```tsx
import AdminDashboard from './pages/admin/Dashboard'
import AdminAds from './pages/admin/Ads'
import AdminMarketNew from './pages/admin/MarketNew'
```

`Routes` 内の admin ルート群に追加（`/admin/markets/new` は `/admin/markets` より前に置く）：

```tsx
<Route path="/admin" element={<AdminDashboard />} />
<Route path="/admin/proposals" element={<AdminProposals />} />
<Route path="/admin/markets/new" element={<AdminMarketNew />} />
<Route path="/admin/markets" element={<AdminMarkets />} />
<Route path="/admin/ads" element={<AdminAds />} />
<Route path="/admin/users" element={<AdminUsers />} />
```

- [ ] **Step 5: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 6: 手動確認**

Run: `npm run dev`、Admin ユーザーでログイン（LoginModal で Admin を選択）：
- `/admin` で統計4枚 + 最近のマーケットが表示
- `/admin/ads` で広告追加・有効/無効・削除ができる
- 広告を無効化すると一覧から該当広告が消える
- `/admin/markets/new` でマーケット作成 → 一覧に即時表示

- [ ] **Step 7: コミット**

```bash
git add src/pages/admin/Dashboard.tsx src/pages/admin/Ads.tsx src/components/Navbar.tsx src/App.tsx
git commit -m "feat: add admin dashboard, ad management, wire routes and nav"
```

---

## Task 9: 最終ビルド・検証

**Files:** なし（検証のみ）

- [ ] **Step 1: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 2: プロダクションビルド**

Run: `npm run build`
Expected: `✓ built` 成功

- [ ] **Step 3: AI感の残存チェック**

src 配下に `gradient`, `purple`, `indigo`, `shadow-[`, `rounded-2xl` が残っていないことを確認（MarketImage のカテゴリ多色プレースホルダは許容）。残っていれば修正してコミット。

- [ ] **Step 4: 手動チェックリスト**

Run: `npm run dev`

| 項目 | 確認 |
|---|---|
| 一覧 | ダークネイビー、紫グラデ/発光なし、6枚ごとに広告 |
| カード | 左サムネ（画像 or カテゴリプレースホルダ） |
| 詳細 | ヘッダー画像、配色刷新 |
| 提案 | 画像枠が動作 |
| 管理ダッシュボード | 統計4枚 + 最近のマーケット |
| 広告管理 | CRUD + 有効/無効が一覧に反映 |
| マーケット新規作成 | 画像付きで即時公開 |
| ログイン/取引/ポートフォリオ/ランキング | 配色刷新済み・既存機能維持 |

- [ ] **Step 5: 最終コミット（修正があれば）**

```bash
git add -A
git commit -m "chore: final build verification and theme cleanup"
```

---

## 完了チェック

- [ ] `npm run build` 成功
- [ ] 紫グラデ・発光・過剰な角丸が画面から消えている
- [ ] マーケットに画像枠（URL/ファイル両対応）
- [ ] 一覧にインフィード広告、広告0件で非挿入
- [ ] 管理: ダッシュボード / 広告管理 / マーケット新規作成 が動作

## 次ステップ（今回スコープ外）

- バックエンド + DB + 本物の認証（最後にまとめて実施）
- 画像の外部ストレージ化（localStorage base64 からの移行）
