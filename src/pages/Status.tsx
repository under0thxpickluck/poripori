import { CheckCircle2 } from 'lucide-react'
import InfoLayout from '../components/InfoLayout'
import { COMPANY } from '../lib/company'

const COMPONENTS = [
  { name: 'Web アプリ', desc: 'マーケット閲覧・取引のフロントエンド' },
  { name: 'マーケットエンジン (LMSR)', desc: '価格決定・約定処理' },
  { name: 'マーケット解決', desc: '締切後の結果判定・精算' },
  { name: '認証 / アカウント', desc: 'ログイン・セッション' },
  { name: 'データストレージ', desc: 'ローカルストレージ／同期' },
]

const HISTORY = [
  { date: COMPANY.lastUpdated, text: '計画的なメンテナンスや障害は報告されていません。' },
]

export default function Status() {
  return (
    <InfoLayout
      title="システムステータス"
      subtitle={`${COMPANY.product} の各コンポーネントの稼働状況をお知らせします。`}
    >
      <div className="rounded-lg border border-yes/40 bg-yes/5 p-5 mb-6 flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full rounded-full bg-yes opacity-60 animate-ping" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-yes" />
        </span>
        <div>
          <p className="text-base font-bold text-text">すべてのシステムが正常に稼働中</p>
          <p className="text-xs text-text-muted mt-0.5">最終確認: {COMPANY.lastUpdated}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface divide-y divide-border mb-8">
        {COMPONENTS.map((c) => (
          <div key={c.name} className="flex items-center gap-3 px-5 py-3.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text">{c.name}</p>
              <p className="text-xs text-text-muted">{c.desc}</p>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-yes shrink-0">
              <CheckCircle2 size={14} />
              稼働中
            </span>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-bold text-text mt-10 mb-3 pb-2 border-b border-border">過去のインシデント</h2>
      <div className="space-y-3">
        {HISTORY.map((h, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs font-semibold text-text-muted mb-1">{h.date}</p>
            <p className="text-sm text-text-muted leading-7">{h.text}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-text-muted leading-7 mt-8">
        本ステータスページは {COMPANY.legalName} が提供する {COMPANY.product} の稼働状況の目安です。重大な障害が発生した場合は本ページおよびサービス上で告知します。お問い合わせ：{' '}
        <a href={`mailto:${COMPANY.emails.support}`} className="text-accent hover:underline">{COMPANY.emails.support}</a>
      </p>
    </InfoLayout>
  )
}
