import { Link } from 'react-router-dom'
import InfoLayout from '../components/InfoLayout'
import { H2, P, UL, LI, Strong, Callout } from '../components/legal/LegalLayout'
import { COMPANY } from '../lib/company'
import { useT } from '../lib/i18n'

export default function Developers() {
  const t = useT()
  return (
    <InfoLayout
      title={t('開発者 / API')}
      subtitle={t('{product} のデータと機能をプログラムから利用するための API を準備しています。', { product: COMPANY.product })}
    >
      <Callout>
        <Strong>{t('現在プライベートベータの準備中です。')}</Strong>{t('公開 API はまだ提供していません。早期アクセスをご希望の場合は、下記の窓口までご連絡ください。')}
      </Callout>

      <H2 id="d1">{t('提供予定の機能')}</H2>
      <P>{t('公開時には、次のような読み取り中心のエンドポイントを想定しています（内容は変更される場合があります）。')}</P>
      <UL>
        <LI><Strong>{t('マーケット：')}</Strong>{t('一覧・詳細・カテゴリ・ステータスの取得')}</LI>
        <LI><Strong>{t('価格と確率：')}</Strong>{t('現在価格、価格履歴、出来高')}</LI>
        <LI><Strong>{t('解決：')}</Strong>{t('解決結果と判定時刻')}</LI>
        <LI><Strong>{t('ランキング：')}</Strong>{t('公開リーダーボード（伏字化された表示名）')}</LI>
      </UL>

      <H2 id="d2">{t('設計方針')}</H2>
      <UL>
        <LI>{t('HTTPS による REST、JSON 応答')}</LI>
        <LI>{t('APIキーによる認証とレート制限')}</LI>
        <LI>{t('公開データのみを対象とし、個人データは返却しません')}</LI>
        <LI>{t('仮想ポイントは金銭的価値を持たないため、出金・決済系のエンドポイントは提供しません')}</LI>
      </UL>

      <H2 id="d3">{t('利用上の注意')}</H2>
      <P>
        {t('API の利用は')} <Link to="/legal/terms" className="text-accent hover:underline">{t('利用規約')}</Link> {t('および')}{' '}
        <Link to="/legal/market-integrity" className="text-accent hover:underline">{t('市場の健全性ポリシー')}</Link>{' '}
        {t('に従うものとします。許可のないスクレイピングや過度なアクセスは禁止です。')}
      </P>

      <H2 id="d4">{t('早期アクセスの申し込み')}</H2>
      <P>
        {t('ベータ参加・技術的なお問い合わせは')}{' '}
        <a href={`mailto:${COMPANY.emails.support}`} className="text-accent hover:underline">{COMPANY.emails.support}</a>{' '}
        {t('まで、用途を添えてご連絡ください。提供開始時には本ページで仕様を公開します。')}
      </P>
    </InfoLayout>
  )
}
