import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { tOutside as t } from '../lib/i18n'

type Props = { children: ReactNode }
type State = { hasError: boolean }

// 描画中の例外を捕捉し、画面全体が真っ白になるのを防ぐ。
// ルートごとに key を変えて再マウントすることで、画面遷移時に自動回復する。
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 本番ではここで監視サービス（Sentry等）へ送信する
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-no/15 text-no">
          <AlertTriangle size={24} />
        </div>
        <div>
          <p className="text-text font-semibold">{t('表示中に問題が発生しました')}</p>
          <p className="mt-1 text-sm text-text-muted">
            {t('一時的なエラーの可能性があります。再読み込みをお試しください。')}
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          {t('再読み込み')}
        </button>
      </div>
    )
  }
}
