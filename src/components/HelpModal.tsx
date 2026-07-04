import { X, LogIn, Search, TrendingUp, RefreshCw, Trophy, Lightbulb, FilePlus2, Coins, Scale } from 'lucide-react'
import { useModalBehavior } from '../hooks/useModalBehavior'

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
  useModalBehavior(onClose)
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

          {/* ポイント制 */}
          <section className="flex gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
              <Coins size={17} />
            </div>
            <div>
              <p className="text-sm font-medium text-text">ポイント（MR）制について</p>
              <p className="text-xs text-text-muted leading-relaxed mt-0.5">
                取引はすべて仮想ポイント「MR（MIRAIXポイント。画面では pt とも表示）」で行います。
                新規アカウントには<span className="text-text font-medium">期間限定の新規登録特典として 1,000 MR</span> が付与されます（キャンペーンは予告なく変更・終了する場合があります）。
                MRでシェアを購入し、的中すると増え、外すと減ります。残高や総資産はランキング・レベル・ランクに反映されます（実際のお金は一切使いません）。
              </p>
            </div>
          </section>

          {/* 勝ち負けの仕組み */}
          <section className="bg-surface-hover rounded-lg p-4">
            <h3 className="text-sm font-semibold text-text mb-2 flex items-center gap-1.5">
              <Scale size={14} className="text-accent" />
              勝ち負けの仕組み
            </h3>
            <p className="text-xs text-text-muted leading-relaxed mb-3">
              締切後、結果が <span className="text-yes font-medium">YES</span> か{' '}
              <span className="text-no font-medium">NO</span> に確定します。
              <span className="text-text font-medium">的中した側のシェアは 1 枚 = 100¢（1pt）</span>で精算され、
              外した側のシェアは <span className="text-text font-medium">0pt</span> になります。
            </p>

            <p className="text-[11px] text-text-muted mb-1.5">例：YES を 60¢ で 10 シェア購入（= 600pt 支払い）</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-yes/30 bg-yes/10 p-2.5">
                <p className="text-xs font-semibold text-yes mb-0.5">結果が YES（的中）</p>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  10 枚 × 100¢ = <span className="text-text font-medium">1,000pt</span> 受取
                  <br />
                  損益 <span className="text-yes font-bold">+400pt</span>
                </p>
              </div>
              <div className="rounded-md border border-no/30 bg-no/10 p-2.5">
                <p className="text-xs font-semibold text-no mb-0.5">結果が NO（外れ）</p>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  受取 <span className="text-text font-medium">0pt</span>
                  <br />
                  損益 <span className="text-no font-bold">−600pt</span>
                </p>
              </div>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed mt-3">
              締切前に価格が上がったところで <span className="text-text font-medium">途中売却</span> すれば、結果を待たずに利益確定（または損切り）もできます。
            </p>
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
              <li>・<span className="text-text font-medium">⌘K</span>（スマホは下部の「検索」）でマーケット/ページを瞬時に検索</li>
              <li>・<span className="text-no font-medium">🔥 HOT</span> は直近で急上昇しているマーケット</li>
              <li>・締切 <span className="text-no font-medium">1 時間前</span> になるとカウントダウンが赤くなります</li>
              <li>・トレードや的中で <span className="text-text font-medium">XP</span> が貯まりレベル・ランクが上がります（連勝も記録）</li>
              <li>・<span className="text-text font-medium">毎日ログイン</span>でデイリーボーナス。連続日数で増額します</li>
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
