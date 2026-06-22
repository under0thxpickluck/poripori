import { X, LogIn, Search, TrendingUp, RefreshCw, Trophy, Lightbulb, FilePlus2 } from 'lucide-react'

type Props = { onClose: () => void }

const STEPS = [
  {
    Icon: LogIn,
    title: '1. ログイン',
    body: 'アカウントを選ぶか、ユーザー名／パスワードでログイン。管理者はデモ用に admin / admin で入れます。',
  },
  {
    Icon: Search,
    title: '2. マーケットを選ぶ',
    body: 'トップの「注目のマーケット」や一覧から探します。⌘K（検索）でマーケットやページを横断検索できます。',
  },
  {
    Icon: TrendingUp,
    title: '3. YES か NO を購入',
    body: '詳細ページの取引パネルで、賭けたい側（YES/NO）と金額（ポイント）またはシェア数を入力して購入します。',
  },
  {
    Icon: RefreshCw,
    title: '4. 価格変動で売買',
    body: 'みんなの取引で確率（価格）が動きます。締切前ならいつでも売却して利益確定・損切りができます。',
  },
  {
    Icon: Trophy,
    title: '5. 結果確定で受取',
    body: '締切後に管理者が結果を判定。的中していれば 1 シェア = 1 ポイントとして受け取れます。',
  },
]

export default function HelpModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[8vh] pb-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-surface border border-border rounded-lg overflow-hidden shadow-2xl max-h-[84vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold text-text">MIRAIX の使い方</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-6">
          {/* 予測市場とは */}
          <section>
            <h3 className="text-sm font-semibold text-text mb-2">予測市場とは？</h3>
            <p className="text-sm text-text-muted leading-relaxed">
              将来の出来事に「YES（はい）」「NO（いいえ）」で参加する市場です。価格はそのまま
              <span className="text-text font-medium">「みんなが見込む実現確率」</span>
              を表し、参加者の売買で常に変動します。正しく予測できればポイントが増えます。
            </p>
          </section>

          {/* 基本の流れ */}
          <section>
            <h3 className="text-sm font-semibold text-text mb-3">基本の流れ</h3>
            <div className="space-y-3">
              {STEPS.map(({ Icon, title, body }) => (
                <div key={title} className="flex gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
                    <Icon size={17} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text">{title}</p>
                    <p className="text-xs text-text-muted leading-relaxed mt-0.5">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 価格の見方 */}
          <section className="bg-surface-hover rounded-lg p-4">
            <h3 className="text-sm font-semibold text-text mb-2">価格の見方</h3>
            <ul className="space-y-1.5 text-xs text-text-muted leading-relaxed">
              <li>
                <span className="text-yes font-semibold">YES 65%</span> … 市場が見込む実現確率は 65%。
              </li>
              <li>
                <span className="text-text font-medium">65¢</span> … 1 シェアの購入コストの目安（的中で 100¢=1pt 受取）。
              </li>
              <li>売買が増えるほど価格が動く <span className="text-text font-medium">LMSR 方式</span> を採用しています。</li>
            </ul>
          </section>

          {/* 提案 */}
          <section className="flex gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
              <FilePlus2 size={17} />
            </div>
            <div>
              <p className="text-sm font-medium text-text">自分でマーケットを提案する</p>
              <p className="text-xs text-text-muted leading-relaxed mt-0.5">
                「提案する」から質問・解決条件・締切を投稿できます。管理者が審査して承認すると公開されます。条件は「誰が見ても明確」に書きましょう。
              </p>
            </div>
          </section>

          {/* ヒント */}
          <section className="border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-text mb-2 flex items-center gap-1.5">
              <Lightbulb size={14} className="text-yellow-400" />
              便利なポイント
            </h3>
            <ul className="space-y-1.5 text-xs text-text-muted leading-relaxed">
              <li>・<span className="text-text font-medium">⌘K</span> でマーケット/ページを瞬時に検索</li>
              <li>・<span className="text-no font-medium">🔥 HOT</span> は直近で急上昇しているマーケット</li>
              <li>・締切 <span className="text-no font-medium">1 時間前</span> になるとカウントダウンが赤くなります</li>
              <li>・資産が増えるとレベル・ランクが上がり、連勝も記録されます</li>
            </ul>
          </section>
        </div>

        <div className="px-6 py-3 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors"
          >
            はじめる
          </button>
        </div>
      </div>
    </div>
  )
}
