import InfoLayout from '../components/InfoLayout'
import { H2, P, UL, LI, Strong } from '../components/legal/LegalLayout'
import { COMPANY } from '../lib/company'

export default function Press() {
  return (
    <InfoLayout
      title="プレス / メディア"
      subtitle={`${COMPANY.legalName} および ${COMPANY.product} に関する報道関係者向けの情報です。`}
    >
      <H2 id="pr1">会社概要（ボイラープレート）</H2>
      <P>
        {COMPANY.legalName} は、集合知をリアルタイムの明快なシグナルに変えるツールを開発しています。主力プロダクトの {COMPANY.product} は、{COMPANY.productDesc}であり、人々が将来の出来事を予測し、コミュニティの取引によって確率が動く様子を体験できます。すべて仮想ポイントで行われ、実際の金銭リスクはありません。
      </P>

      <H2 id="pr2">ファクトシート</H2>
      <UL>
        <LI><Strong>正式名称：</Strong>{COMPANY.legalName}</LI>
        <LI><Strong>形態：</Strong>{COMPANY.incorporation}</LI>
        <LI><Strong>本社所在地：</Strong>{COMPANY.addressInline}</LI>
        <LI><Strong>プロダクト：</Strong>{COMPANY.product}（{COMPANY.productDesc}）</LI>
        <LI><Strong>提供形態：</Strong>仮想ポイント制・無料。実金銭の取引なし。</LI>
        <LI><Strong>ウェブサイト：</Strong><a href={COMPANY.website} className="text-accent hover:underline">{COMPANY.website}</a></LI>
      </UL>

      <H2 id="pr3">ブランドの使用について</H2>
      <P>
        {COMPANY.product} および {COMPANY.legalName} の名称・ロゴは当社の商標です。報道・紹介の目的での引用は、内容を改変せず、出所を明示する範囲で行ってください。ロゴデータの提供をご希望の場合は、下記メディア窓口までご連絡ください。誤認を招く使用、提携・推奨を示唆する使用はご遠慮ください。
      </P>

      <H2 id="pr4">メディアに関するお問い合わせ</H2>
      <P>
        取材・掲載・ロゴ素材のご請求は{' '}
        <a href={`mailto:${COMPANY.emails.support}`} className="text-accent hover:underline">{COMPANY.emails.support}</a>{' '}
        宛にご連絡ください。原則として数営業日以内に返信します。
      </P>

      <H2 id="pr5">注記</H2>
      <P>
        {COMPANY.product} は教育・娯楽目的のサービスであり、仮想ポイントのみを使用します。実金銭の取引・賭博・投資サービスではありません。詳細は「リスク開示・免責」および「利用規約」をご参照ください。
      </P>
    </InfoLayout>
  )
}
