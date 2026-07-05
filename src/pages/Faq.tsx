import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import InfoLayout from '../components/InfoLayout'
import { COMPANY } from '../lib/company'
import { useT, type TFunc } from '../lib/i18n'

type QA = { q: string; a: ReactNode }

function buildFaqs(t: TFunc): { group: string; items: QA[] }[] {
  return [
  {
    group: t('基本'),
    items: [
      { q: t('{p} とは何ですか？', { p: COMPANY.product }), a: t('将来の出来事に「YES／NO」で参加する予測市場です。価格はそのまま「みんなが見込む実現確率」を表し、参加者の売買で常に変動します。{n} が運営しています。', { n: COMPANY.legalName }) },
      { q: t('実際のお金を使いますか？'), a: t('いいえ。すべて仮想ポイント「MR（MIRAIXポイント。画面では pt とも表示）」で行います。実際の金銭・暗号資産は一切使わず、現金・暗号資産への換金はできません。サロン（LIFAIOV / aisalon）会員の方はサロンのEPとMRを相互に移せますが、これもポイント同士の移動であり金銭のやり取りではありません。賭博・投資サービスではありません。') },
      { q: t('誰が運営していますか？'), a: <>{COMPANY.legalName}（{COMPANY.addressInline}）{t('です。詳しくは')} <Link to="/company" className="text-accent hover:underline">{t('会社概要')}</Link> {t('をご覧ください。')}</> },
      { q: t('年齢制限はありますか？'), a: t('18歳以上の方を対象としています。') },
    ],
  },
  {
    group: t('取引と価格'),
    items: [
      { q: t('価格はどのように決まりますか？'), a: t('LMSR（対数マーケットスコアリングルール）方式の自動マーケットメイカーが価格を決定します。買いが増えた側の価格（確率）が上がり、反対側が下がります。') },
      { q: t('ポイントはどうやって増えますか？'), a: t('締切後に結果が確定し、的中した側のシェアが「1シェア=1pt（100¢）」で精算されます。締切前でも、価格が上がったところで途中売却して利益確定・損切りができます。') },
      { q: t('勝ち負けの仕組みは？'), a: t('的中した側のシェアは1枚=100¢（1pt）、外した側は0ptになります。例：YESを60¢で10シェア購入（=600pt）→ 結果YESなら1,000pt受取（+400pt）、結果NOなら0pt（−600pt）。') },
      { q: t('手数料はかかりますか？'), a: t('現在、利用者への金銭的課金は一切ありません。') },
    ],
  },
  {
    group: t('ゲーム要素'),
    items: [
      { q: t('レベルとランク、XPとは？'), a: t('トレード額や的中の受取に応じてXP（経験値）が貯まり、レベルとランク（ブロンズ〜ダイヤモンド）が上がります。XPは累積で、消費しても下がりません。') },
      { q: t('デイリーボーナスとは？'), a: t('毎日ログインするとボーナスptを受け取れます。連続ログイン日数が伸びるほど増額します（最大400pt）。新規登録特典と同様に、ボーナス分のMRはサロンEPへの出金には使えません（ボーナスを使って増えた分は出金できます）。') },
      { q: t('連勝（🔥）とは？'), a: t('解決済みマーケットで、直近から連続して的中している回数です。') },
    ],
  },
  {
    group: t('サロン連携（EPウォレット）'),
    items: [
      { q: t('MIRAIX と LIFAI（LIFAIOV / aisalon）はどういう関係ですか？'), a: t('MIRAIX は LIFAI（LIFAIOV / aisalon）とは関係のない外部サイトです。LIFAI は MIRAIX の運営・内容について一切の責任を負いません。') },
      { q: t('サロンのEPをMIRAIXで使えますか？'), a: <>{t('サロン会員の方は、サロンの LIFAI Arcade から「MIRAIX」を開いて連携すると、')}<Link to="/wallet" className="text-accent hover:underline">{t('EPウォレット')}</Link> {t('でサロンのEPをMRに移して予測やゲームに使えます（1 EP = 1 MR）。MRをEPに戻すこともできます。')}</> },
      { q: t('MIRAIXで消費したEP・MRはLIFAI側で補填されますか？'), a: t('されません。MIRAIXへ転送したEP、およびMIRAIX上で消費・喪失したMRを、LIFAI側で補填・返金することはできません。あらかじめご了承のうえご利用ください。') },
      { q: t('新規登録特典はありますか？'), a: t('期間限定キャンペーンとして、MIRAIXアカウントの新規作成時に 1,000 MR を新規登録特典として付与しています。特典分のMRはサロンEPへの出金には使えません（特典を使って増えた分は出金できます）。キャンペーンは予告なく変更・終了する場合があります。') },
    ],
  },
  {
    group: t('マーケットと解決'),
    items: [
      { q: t('マーケットはどのように解決されますか？'), a: <>{t('締切後、あらかじめ定められた条件と信頼できる公開情報源に基づき、運営または指定の解決者が結果を判定します。判定が困難な場合は無効化・取引取消で精算されることがあります。詳細は')} <Link to="/legal/market-integrity" className="text-accent hover:underline">{t('市場の健全性ポリシー')}</Link> {t('をご覧ください。')}</> },
      { q: t('解決結果に異議があります'), a: <>{t('解決から72時間以内に')} <a href={`mailto:${COMPANY.emails.integrity}`} className="text-accent hover:underline">{COMPANY.emails.integrity}</a> {t('へ、根拠を添えてご連絡ください。誠実に再検証します。')}</> },
      { q: t('自分でマーケットを提案できますか？'), a: t('「提案する」から質問・解決条件・締切を投稿できます。運営の審査・承認を経て公開されます。条件は「誰が見ても明確」に書いてください。') },
    ],
  },
  {
    group: t('プライバシーとデータ'),
    items: [
      { q: t('自分の名前は他の人に見えますか？'), a: t('ランキングやコメント等の公開表示では、プライバシー保護のため表示名を伏字化しています（先頭1文字＋●●●）。自分自身の画面ではフル表示されます。') },
      { q: t('データはどこに保存されますか？'), a: <>{t('残高・ポジション・取引履歴などは主にお使いのブラウザのローカルストレージに保存されます。ブラウザのデータを消去するといつでも削除できます。詳細は')} <Link to="/legal/privacy" className="text-accent hover:underline">{t('プライバシーポリシー')}</Link> {t('をご覧ください。')}</> },
      { q: t('困ったときの連絡先は？'), a: <><a href={`mailto:${COMPANY.emails.support}`} className="text-accent hover:underline">{COMPANY.emails.support}</a>{t('（一般）へご連絡ください。目的別の窓口は')} <Link to="/contact" className="text-accent hover:underline">{t('お問い合わせ')}</Link> {t('ページにまとめています。')}</> },
    ],
  },
  ]
}

export default function Faq() {
  const t = useT()
  const FAQS = buildFaqs(t)
  return (
    <InfoLayout title={t('よくある質問（FAQ）')} subtitle={t('{p} の使い方やルールに関するよくある質問をまとめました。', { p: COMPANY.product })}>
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
        {t('探している答えが見つかりませんか？')}{' '}
        <Link to="/contact" className="text-accent hover:underline">{t('お問い合わせ')}</Link>{' '}
        {t('からご連絡いただくか、ナビの「使い方」ガイドもご覧ください。')}
      </div>
    </InfoLayout>
  )
}
