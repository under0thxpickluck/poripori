# ポリぽり 本家寄せ改修 — 進行状況

**最終更新:** 2026-06-22
**ブランチ:** `claude/prediction-market-lmsr-vecg15`
**ベースコミット:** `7304766`

- 設計書: [`specs/2026-06-22-poripori-polymarket-redesign.md`](specs/2026-06-22-poripori-polymarket-redesign.md)
- 実装計画: [`plans/2026-06-22-poripori-polymarket-redesign.md`](plans/2026-06-22-poripori-polymarket-redesign.md)
- 実行方式: サブエージェント駆動（実装→ビルド→レビュー→次タスク）

---

## 全体サマリー

全9タスク中 **5タスク完了 / 4タスク未着手**

| # | タスク | 状態 | コミット |
|---|---|---|---|
| 1 | デザイントークン整備（tailwind / index.css） | ✅ 完了 | `cb3bdf7` |
| 2 | 全コンポーネント・ページの配色刷新（AI感払拭） | ✅ 完了 | `cf7450f` |
| 3 | ImagePicker + `Market.imageUrl` 型 | ✅ 完了 | `4285631` |
| 4 | マーケット画像表示（カード/詳細/提案） | ✅ 完了 | `7758b44` |
| 5 | Adモデル + store actions + createMarket | ✅ 完了 | `8365cb2` |
| 6 | AdCard + 一覧インフィード広告 | ⏳ 未着手 | — |
| 7 | マーケット新規作成ページ（管理） | ⏳ 未着手 | — |
| 8 | 管理ダッシュボード + 広告管理 + ルート配線 | ⏳ 未着手 | — |
| 9 | 最終ビルド・検証 | ⏳ 未着手 | — |

各タスクは `npm run build`（tsc型チェック含む）成功を検証ゲートとし、実装の重いタスクはレビュアーサブエージェントによるレビューを通過済み。

---

## 完了タスクの詳細

### Task 1 — デザイントークン整備 ✅
- `tailwind.config.js` にセマンティックカラー（bg/surface/surface-hover/border/accent/accent-hover/yes/no/text/text-muted）と角丸を定義
- `src/index.css` のベース背景・文字色・スクロールバーを新テーマへ
- 検証: build OK（diffをブリーフと照合し一致）

### Task 2 — 配色刷新（AI感払拭） ✅
- 14ファイルの紫/インディゴ・グラデーション・発光シャドウ・`rounded-2xl` を排除し、トークンへ統一
- MarketListのサブコピー削除、絵文字→lucideアイコン（CheckCircle2 / AlertTriangle / X）
- レビュー: **Spec PASS / Quality Approved**

### Task 3 — ImagePicker + 型 ✅
- `ImagePicker`（URL入力＋ファイル選択→canvas縮小でbase64化、~200KB上限）
- `Market` 型に `imageUrl?: string` 追加
- 検証: tsc OK（仕様通り）

### Task 4 — マーケット画像表示 ✅
- `MarketImage`（画像 or カテゴリ別プレースホルダ）
- カード左サムネ / 詳細ヘッダー画像 / 提案フォームに画像欄
- レビュー: **Spec PASS / Quality Approved**

### Task 5 — Adモデル + store ✅
- `Ad` 型、`ads` state + CRUD（add/update/toggle/delete）、`createMarket`、imageUrl対応の `proposeMarket`
- 旧localStorageデータへの `ads` バックフィル対応
- レビュー: **Spec PASS / Quality Approved**（back-compat初期化を確認）

---

## 残タスク（6–9）

- **Task 6:** AdCard コンポーネント + 一覧グリッドに6枚ごとのインフィード広告挿入
- **Task 7:** 管理者向けマーケット新規作成ページ（画像付き・即時公開）
- **Task 8:** 管理ダッシュボード + 広告管理ページ + ナビ/ルート配線
- **Task 9:** 最終ビルド・型チェック・AI感残存チェック・手動チェックリスト

---

## レビューで記録された Minor 指摘（最終レビューでトリアージ予定）

- **Task 2:** Ranking.tsx の銀/銅（2位/3位）ボーダー差が `border-border` に統一され消失。LoginModalのユーザー一覧ボタンのhoverが無変化（bg==hover）。Navbarの `hover:bg-white/5` が非トークン（許容範囲）。
- **Task 4:** MarketImageのプレースホルダ・アイコン（size 28）が詳細ヘッダー（h-40）でやや小さい。`size` prop追加を検討。

いずれも Critical/Important ではなく、ブロッカーではない。

---

## スコープ外（今回はやらない）

- バックエンド / DB / 本物の認証（**最後にまとめて実施予定**）
- 画像の外部ストレージ化（現状はlocalStorageにbase64）
