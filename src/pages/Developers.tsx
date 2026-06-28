import { Link } from 'react-router-dom'
import InfoLayout from '../components/InfoLayout'
import { H2, P, UL, LI, Strong, Callout } from '../components/legal/LegalLayout'
import { COMPANY } from '../lib/company'

export default function Developers() {
  return (
    <InfoLayout
      title="開発者 / API"
      subtitle={`${COMPANY.product} のデータと機能をプログラムから利用するための API を準備しています。`}
    >
      <Callout>
        <Strong>現在プライベートベータの準備中です。</Strong>公開 API はまだ提供していません。早期アクセスをご希望の場合は、下記の窓口までご連絡ください。
      </Callout>

      <H2 id="d1">提供予定の機能</H2>
      <P>公開時には、次のような読み取り中心のエンドポイントを想定しています（内容は変更される場合があります）。</P>
      <UL>
        <LI><Strong>マーケット：</Strong>一覧・詳細・カテゴリ・ステータスの取得</LI>
        <LI><Strong>価格と確率：</Strong>現在価格、価格履歴、出来高</LI>
        <LI><Strong>解決：</Strong>解決結果と判定時刻</LI>
        <LI><Strong>ランキング：</Strong>公開リーダーボード（伏字化された表示名）</LI>
      </UL>

      <H2 id="d2">設計方針</H2>
      <UL>
        <LI>HTTPS による REST、JSON 応答</LI>
        <LI>APIキーによる認証とレート制限</LI>
        <LI>公開データのみを対象とし、個人データは返却しません</LI>
        <LI>仮想ポイントは金銭的価値を持たないため、出金・決済系のエンドポイントは提供しません</LI>
      </UL>

      <H2 id="d3">利用上の注意</H2>
      <P>
        API の利用は <Link to="/legal/terms" className="text-accent hover:underline">利用規約</Link> および{' '}
        <Link to="/legal/market-integrity" className="text-accent hover:underline">市場の健全性ポリシー</Link>{' '}
        に従うものとします。許可のないスクレイピングや過度なアクセスは禁止です。
      </P>

      <H2 id="d4">早期アクセスの申し込み</H2>
      <P>
        ベータ参加・技術的なお問い合わせは{' '}
        <a href={`mailto:${COMPANY.emails.support}`} className="text-accent hover:underline">{COMPANY.emails.support}</a>{' '}
        まで、用途を添えてご連絡ください。提供開始時には本ページで仕様を公開します。
      </P>
    </InfoLayout>
  )
}
