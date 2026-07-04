# Mines ネオングリッド・リスタイル Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mines のビジュアル/効果音を「ネオングリッド」（漆黒+シアン/マゼンタのサイバーパンク）へ全面リスタイルする。ロジックは一切変えない。

**Architecture:** スタイルのみの差し替え。CSS ユーティリティ（グリッド背景・走査線・グリッチ）を `index.css` に追加し、各コンポーネントの Tailwind クラスとアイコン・文言を置換。`sounds.ts` は同じ `tone()` 基盤で波形パラメータのみ変更。

**Tech Stack:** 既存のみ（Tailwind / framer-motion / lucide-react / Web Audio）。追加依存ゼロ。

## Global Constraints

- 仕様: `docs/superpowers/specs/2026-07-04-mines-neon-grid-design.md`（承認済み）
- 変更禁止: `useMinesGame.ts` / `mines-math.ts` / RPC / DB / `haptics.ts` / `/admin/mines` / Plinko
- Tile の `aria-label={'マス ' + (index+1)}` は不変（E2E 互換）
- パレット: 背景 `#0a0a12` / パネル `#10101c` / シアン `#00f0ff` / マゼンタ `#ff2ec4` / 危険赤 `#ff2e2e`
- 数値は `font-mono tabular-nums`
- 用語: 「罠」→「トラップ」（UI 文言のみ。コード内変数名は不変）
- `prefers-reduced-motion` で走査線/グリッチ/カウントアップを無効化
- 各タスク後: `npm run build` 成功。最終タスクで `npx vitest run` 全合格

---

### Task 1: CSS 基盤（index.css）

**Files:**
- Modify: `src/index.css`（`.stage-dark` 定義の直後に追記）

**Interfaces:**
- Produces: `.neon-grid-bg`（グリッド線背景）/ `.neon-scanline`（走査線オーバーレイ、要 `position:relative`）/ `.neon-glitch`（罠開示のRGBずれシェイク）/ `@keyframes pp-scan, pp-glitch`

- [x] 以下を `index.css` に追加:

```css
/* ===== Mines ネオングリッド ===== */
.neon-grid-bg {
  background-color: #0a0a12;
  background-image:
    repeating-linear-gradient(0deg, rgba(0, 240, 255, 0.05) 0 1px, transparent 1px 28px),
    repeating-linear-gradient(90deg, rgba(0, 240, 255, 0.05) 0 1px, transparent 1px 28px);
}
.neon-scanline { position: relative; overflow: hidden; }
.neon-scanline::after {
  content: '';
  position: absolute;
  left: 0; right: 0; top: -40%;
  height: 40%;
  background: linear-gradient(to bottom, transparent, rgba(0, 240, 255, 0.06), transparent);
  animation: pp-scan 7s linear infinite;
  pointer-events: none;
}
@keyframes pp-scan {
  from { transform: translateY(0); }
  to { transform: translateY(350%); }
}
.neon-glitch { animation: pp-glitch 0.35s steps(2, jump-none) 1; }
@keyframes pp-glitch {
  0% { transform: translate(0); filter: none; }
  20% { transform: translate(-2px, 1px); filter: drop-shadow(2px 0 0 rgba(255, 46, 46, 0.8)) drop-shadow(-2px 0 0 rgba(0, 240, 255, 0.8)); }
  40% { transform: translate(2px, -1px); filter: drop-shadow(-2px 0 0 rgba(255, 46, 196, 0.8)); }
  60% { transform: translate(-1px, -1px); filter: drop-shadow(2px 0 0 rgba(0, 240, 255, 0.8)); }
  100% { transform: translate(0); filter: none; }
}
@media (prefers-reduced-motion: reduce) {
  .neon-scanline::after { animation: none; opacity: 0; }
  .neon-glitch { animation: none; }
}
```

- [x] `npm run build` 成功を確認

### Task 2: Tile.tsx + Board.tsx（盤面）

**Files:**
- Modify: `src/components/mines/Tile.tsx`
- Modify: `src/components/mines/Board.tsx`

**Interfaces:**
- Consumes: Task 1 の `.neon-glitch`
- Produces: Tile の props / `gemKind` / `TileState` は**シグネチャ不変**

- [x] Tile: GEMS をネオン4色のホロクリスタルへ差し替え（アイコンは lucide のまま種類変更可）:

```tsx
const GEMS = [
  { Icon: Gem, cls: 'text-cyan-300', glow: 'shadow-cyan-400/50' },
  { Icon: Diamond, cls: 'text-fuchsia-400', glow: 'shadow-fuchsia-400/50' },
  { Icon: Hexagon, cls: 'text-lime-300', glow: 'shadow-lime-300/50' },
  { Icon: Sparkles, cls: 'text-yellow-300', glow: 'shadow-yellow-300/50' },
] as const
```

- [x] Tile 状態別クラス置換（既存の join 配列を差し替え）:
  - hidden: `bg-[#10101c] border-cyan-400/20 hover:border-cyan-300/70 hover:bg-cyan-400/10 hover:shadow-[0_0_12px_rgba(0,240,255,0.25)] cursor-pointer`
  - locked: `bg-[#0c0c16] border-white/5 opacity-50`
  - gem: `bg-cyan-400/10 border-cyan-300/40 shadow-lg ${g.glow}`
  - trap: `bg-red-500/10 border-red-400/25 opacity-70`
  - trap-hit: `bg-red-500/25 border-red-400/70 shadow-lg shadow-red-500/40 neon-glitch`
  - pending: `animate-pulse border-cyan-300/60`
- [x] Tile: 罠アイコン Skull → `Bug`（trap-hit は `text-red-400`、trap は `text-red-400/60`）。安全開示に**ネオンリング拡散**を追加（gem 表示 span の兄弟に）:

```tsx
{state === 'gem' && (
  <motion.span
    initial={{ opacity: 0.8, scale: 0.4 }}
    animate={{ opacity: 0, scale: 1.6 }}
    transition={{ duration: 0.5, ease: 'easeOut' }}
    className="absolute inset-0 rounded-xl border-2 border-cyan-300/70 pointer-events-none"
  />
)}
```

- [x] Board: コンテナを電脳空間へ:
  `grid grid-cols-5 gap-2 sm:gap-2.5 p-3 sm:p-4 rounded-2xl border border-cyan-400/25 neon-grid-bg neon-scanline shadow-[inset_0_0_40px_rgba(0,240,255,0.06),0_0_24px_rgba(0,240,255,0.08)]`
- [x] `npm run build` 成功を確認

### Task 3: HUD.tsx（テレメトリパネル）

**Files:**
- Modify: `src/components/mines/HUD.tsx`

**Interfaces:**
- Consumes: props シグネチャ不変（`onStart(bet, mines)` など）

- [x] パネル外枠: `rounded-2xl border border-cyan-400/25 bg-[#10101c]/90 backdrop-blur-md p-4 sm:p-5 space-y-4 relative shadow-[0_0_24px_rgba(0,240,255,0.07)]` + 四隅コーナーブラケット（装飾 span×4、例: 左上 `absolute left-0 top-0 w-3 h-3 border-l-2 border-t-2 border-cyan-300/80 rounded-tl`。`aria-hidden`）
- [x] 倍率3枚: 数字を `font-mono tabular-nums` に。現在倍率のアクティブ色 `text-amber-300 drop-shadow(...)` → `text-cyan-300 drop-shadow-[0_0_10px_rgba(0,240,255,0.55)]`、「次のマス成功で」 `text-emerald-400` → `text-fuchsia-400`
- [x] 文言: 「罠 N 個」→「トラップ N」/「次に罠を踏む確率」→「次にトラップを踏む確率」/「罠の数（多いほど高倍率）」→「トラップ数（多いほど高倍率）」/「掘りはじめる」→「採掘開始」/「準備中…」は維持
- [x] Cash Out ボタン: `bg-gradient-to-r from-cyan-400 via-sky-300 to-fuchsia-400 shadow-lg shadow-cyan-400/30 text-black` + `relative overflow-hidden`、ホバースキャン光:

```tsx
<motion.span
  aria-hidden
  className="absolute inset-y-0 w-1/3 bg-white/30 blur-md -skew-x-12 pointer-events-none"
  initial={{ x: '-150%' }}
  whileHover={undefined}
  animate={{ x: ['-150%', '350%'] }}
  transition={{ duration: 2.4, repeat: Infinity, ease: 'linear', repeatDelay: 1.2 }}
/>
```

  （`useReducedMotion()` が true のときはこの span を描画しない）
- [x] 採掘開始ボタン: `bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-400 shadow-lg shadow-cyan-400/25 text-black`。入力/セレクト/小ボタンの `focus:border-amber-300/50`・`hover:border-white/25` → `focus:border-cyan-300/60`・`hover:border-cyan-300/40`
- [x] `npm run build` 成功を確認

### Task 4: HistoryCards.tsx + CelebrationOverlay.tsx

**Files:**
- Modify: `src/components/mines/HistoryCards.tsx`
- Modify: `src/components/mines/CelebrationOverlay.tsx`

- [x] HistoryCards 統計チップ: `border-cyan-400/20 bg-cyan-400/[0.06] text-text-muted`（アイコン色: Percent=`text-cyan-300` / Trophy=`text-fuchsia-400` / Flame=`text-red-400`）
- [x] 結果チップ: 勝ち `bg-cyan-400/10 text-cyan-300 border-cyan-400/40` / 負け `bg-red-500/10 text-red-400 border-red-400/40`、負け表示 `💥` → `⚠`。title の「罠 N 個」→「トラップ N」
- [x] CelebrationOverlay: amber/emerald → シアン/マゼンタ系（背景 radial は `rgba(0,240,255,…)` と `rgba(255,46,196,…)`、カード枠 `border-cyan-300/40`、cashout 額 `text-cyan-300 drop-shadow-[0_0_18px_rgba(0,240,255,0.6)]`、milestone は `text-fuchsia-400`）。数値は `font-mono`
- [x] cashout 額のデジタルカウントアップ（reduced-motion 時は即値）:

```tsx
function CountUp({ value }: { value: number }) {
  const reduced = useReducedMotion()
  const [n, setN] = useState(reduced ? value : 0)
  useEffect(() => {
    if (reduced) { setN(value); return }
    const t0 = performance.now()
    const dur = 700
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, reduced])
  return <>{n.toLocaleString()}</>
}
```

  （`+{celebration.payout.toLocaleString()}` → `+<CountUp value={celebration.payout} />`）
- [x] `npm run build` 成功を確認

### Task 5: Mines.tsx + GameCorner.tsx（コピー・導線）

**Files:**
- Modify: `src/pages/Mines.tsx`
- Modify: `src/components/GameCorner.tsx`（Mines カードのみ）

- [x] Mines.tsx ヘッダー: アイコン `Gem` → `Cpu`（import 変更）、囲い `bg-emerald-400/15 text-emerald-400 border-emerald-400/20` → `bg-cyan-400/15 text-cyan-300 border-cyan-400/25`。説明文「罠を避けて宝石を掘り当てよう」→「グリッドに潜むトラップを避けて、データを採掘せよ」
- [x] フッター注記: 「罠の数が多いほど…」→「トラップの数が多いほど…」
- [x] GameCorner Mines カード: `Icon: Gem` → `Cpu`、title「罠を避けて、宝石を掘り当てろ」→「グリッドに潜むトラップを避けろ」、desc「Mines 💎 開けるほど倍率アップ、引き際はキミ次第」→「Mines 🕹 開けるほど倍率アップ、引き際はキミ次第」、色 `emerald` 系 → `iconCls: 'bg-cyan-400/20 text-cyan-300'` / `cardCls: 'border-cyan-400/30 from-cyan-400/15 hover:border-cyan-400/60'` / `arrowCls: 'text-cyan-300'`
- [x] `npm run build` 成功を確認

### Task 6: sounds.ts（シンセ化。API・関数名は不変）

**Files:**
- Modify: `src/lib/sounds.ts`（各 play 関数の tone パラメータのみ変更）

- [x] 差し替え:

```ts
/** タイルを押した瞬間のブリップ（矩形波） */
export function playClick() {
  tone({ freq: 1800, type: 'square', duration: 0.025, gain: 0.018 })
}

/** データ採掘成功。開示数 k で音程上昇（維持）+ 5度と1オクターブのシンセアルペジオ */
export function playGem(k: number) {
  const base = 480 * Math.pow(1.06, Math.min(k, 20))
  tone({ freq: base, type: 'sawtooth', duration: 0.09, gain: 0.035 })
  tone({ freq: base * 1.5, type: 'square', duration: 0.07, gain: 0.02, delay: 0.04 })
  tone({ freq: base * 2, type: 'triangle', duration: 0.09, gain: 0.025, delay: 0.08 })
}

/** 倍率アップのFM風ピコ */
export function playMultiplierUp() {
  tone({ freq: 1400, to: 2100, type: 'square', duration: 0.06, gain: 0.02 })
}

/** Cash Out 成功（2音上昇シンセ + 高域キラ） */
export function playCashout() {
  tone({ freq: 620, type: 'sawtooth', duration: 0.1, gain: 0.05 })
  tone({ freq: 930, type: 'sawtooth', duration: 0.14, gain: 0.045, delay: 0.08 })
  tone({ freq: 1860, type: 'sine', duration: 0.18, gain: 0.02, delay: 0.12 })
}

/** トラップ（ビットクラッシュ風: 矩形波の急降下 + 低域ノイズ層） */
export function playBust() {
  tone({ freq: 220, to: 40, type: 'square', duration: 0.2, gain: 0.05 })
  tone({ freq: 120, to: 30, type: 'sawtooth', duration: 0.26, gain: 0.05, delay: 0.01 })
  tone({ freq: 3200, to: 300, type: 'square', duration: 0.08, gain: 0.015 })
}
```

- [x] `npm run build` 成功を確認

### Task 7: 総合検証 + ドキュメント + コミット

- [x] `npx vitest run` 全合格（ロジック不変のため既存 74+ 件がそのまま通ること）
- [x] `npm run build` + `npx tsc --noEmit`
- [x] デモモード実機確認: dev サーバー + headless Chrome で 360px/390px、ダーク/ライト、開示・Cash Out・バーストのスクリーンショット取得と目視確認（既存 E2E スクリプトが `aria-label="マス N"` のまま通ることも確認）
- [x] 仕様書 `2026-07-04-mines-neon-grid-design.md` に「実装完了」追記
- [x] コミット: `git add`（対象7ファイル+CSS+docs）→ `feat(mines): ネオングリッドUIへ全面リスタイル`
