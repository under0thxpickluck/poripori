import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import InfoLayout from '../components/InfoLayout'
import { COMPANY } from '../lib/company'

type QA = { q: string; a: ReactNode }

const FAQS: { group: string; items: QA[] }[] = [
  {
    group: '基本',
    items: [
      { q: `${COMPANY.product} とは何ですか？`, a: `将来の出来事に「YES／NO」で参加する予測市場です。価格はそのまま「みんなが見込む実現確率」を表し、参加者の売買で常に変動します。${COMPANY.legalName} が運営しています。` },
      { q: '実際のお金を使いますか？', a: 'いいえ。すべて仮想ポイント（pt）で行います。実際の金銭・暗号資産は一切使わず、ポイントの換金・出金もできません。賭博・投資サービスではありません。' },
      { q: '誰が運営していますか？', a: <>{COMPANY.legalName}（{COMPANY.addressInline}）です。詳しくは <Link to="/company" className="text-accent hover:underline">会社概要</Link> をご覧ください。</> },
      { q: '年齢制限はありますか？', a: '18歳以上の方を対象としています。' },
    ],
  },
  {
    group: '取引と価格',
    items: [
      { q: '価格はどのように決まりますか？', a: 'LMSR（対数マーケットスコアリングルール）方式の自動マーケットメイカーが価格を決定します。買いが増えた側の価格（確率）が上がり、反対側が下がります。' },
      { q: 'ポイントはどうやって増えますか？', a: '締切後に結果が確定し、的中した側のシェアが「1シェア=1pt（100¢）」で精算されます。締切前でも、価格が上がったところで途中売却して利益確定・損切りができます。' },
      { q: '勝ち負けの仕組みは？', a: '的中した側のシェアは1枚=100¢（1pt）、外した側は0ptになります。例：YESを60¢で10シェア購入（=600pt）→ 結果YESなら1,000pt受取（+400pt）、結果NOなら0pt（−600pt）。' },
      { q: '手数料はかかりますか？', a: '現在、利用者への金銭的課金は一切ありません。' },
    ],
  },
  {
    group: 'ゲーム要素',
    items: [
      { q: 'レベルとランク、XPとは？', a: 'トレード額や的中の受取に応じてXP（経験値）が貯まり、レベルとランク（ブロンズ〜ダイヤモンド）が上がります。XPは累積で、消費しても下がりません。' },
      { q: 'デイリーボーナスとは？', a: '毎日ログインするとボーナスptを受け取れます。連続ログイン日数が伸びるほど増額します（最大400pt）。' },
      { q: '連勝（🔥）とは？', a: '解決済みマーケットで、直近から連続して的中している回数です。' },
    ],
  },
  {
    group: 'マーケットと解決',
    items: [
      { q: 'マーケットはどのように解決されますか？', a: <>締切後、あらかじめ定められた条件と信頼できる公開情報源に基づき、運営または指定の解決者が結果を判定します。判定が困難な場合は無効化・取引取消で精算されることがあります。詳細は <Link to="/legal/market-integrity" className="text-accent hover:underline">市場の健全性ポリシー</Link> をご覧ください。</> },
      { q: '解決結果に異議があります', a: <>解決から72時間以内に <a href={`mailto:${COMPANY.emails.integrity}`} className="text-accent hover:underline">{COMPANY.emails.integrity}</a> へ、根拠を添えてご連絡ください。誠実に再検証します。</> },
      { q: '自分でマーケットを提案できますか？', a: '「提案する」から質問・解決条件・締切を投稿できます。運営の審査・承認を経て公開されます。条件は「誰が見ても明確」に書いてください。' },
    ],
  },
  {
    group: 'プライバシーとデータ',
    items: [
      { q: '自分の名前は他の人に見えますか？', a: 'ランキングやコメント等の公開表示では、プライバシー保護のため表示名を伏字化しています（先頭1文字＋●●●）。自分自身の画面ではフル表示されます。' },
      { q: 'データはどこに保存されますか？', a: <>残高・ポジション・取引履歴などは主にお使いのブラウザのローカルストレージに保存されます。ブラウザのデータを消去するといつでも削除できます。詳細は <Link to="/legal/privacy" className="text-accent hover:underline">プライバシーポリシー</Link> をご覧ください。</> },
      { q: '困ったときの連絡先は？', a: <><a href={`mailto:${COMPANY.emails.support}`} className="text-accent hover:underline">{COMPANY.emails.support}</a>（一般）へご連絡ください。目的別の窓口は <Link to="/contact" className="text-accent hover:underline">お問い合わせ</Link> ページにまとめています。</> },
    ],
  },
]

export default function Faq() {
  return (
    <InfoLayout title="よくある質問（FAQ）" subtitle={`${COMPANY.product} の使い方やルールに関するよくある質問をまとめました。`}>
      <div className="space-y-8">
        {FAQS.map((section) => (
          <div key={section.group}>
            <h2 className="text-sm font-bold text-accent mb-3">{section.group}</h2>
            <div className="space-y-2">
              {section.items.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-lg border border-border bg-surface overflow-hidden"
                >
                  <summary className="flex items-center justify-between gap-3 px-5 py-3.5 cursor-pointer list-none">
                    <span className="text-sm font-medium text-text">{item.q}</span>
                    <ChevronDown
                      size={16}
                      className="text-text-muted shrink-0 transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div className="px-5 pb-4 text-sm text-text-muted leading-7">{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-border bg-surface p-5 text-sm text-text-muted leading-7">
        探している答えが見つかりませんか？{' '}
        <Link to="/contact" className="text-accent hover:underline">お問い合わせ</Link>{' '}
        からご連絡いただくか、ナビの「使い方」ガイドもご覧ください。
      </div>
    </InfoLayout>
  )
}
