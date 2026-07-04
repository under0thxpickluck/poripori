import { useState } from 'react'
import { X, Mail, LogIn, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useAuth } from '../store/useAuth'
import { useModalBehavior } from '../hooks/useModalBehavior'
import { useT } from '../lib/i18n'

type Props = { onClose: () => void }

export default function LoginModal({ onClose }: Props) {
  const t = useT()
  useModalBehavior(onClose)
  const signInWithEmail = useAuth((s) => s.signInWithEmail)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const addr = email.trim()
    if (!addr) return
    setLoading(true)
    setError('')
    const { error } = await signInWithEmail(addr)
    setLoading(false)
    if (error) setError(error)
    else setSent(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 bg-surface border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="text-lg font-semibold text-text">{t('ログイン / 新規登録')}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text transition-colors">
            <X size={20} />
          </button>
        </div>

        {sent ? (
          <div className="p-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-yes/15 text-yes flex items-center justify-center mb-3">
              <CheckCircle2 size={28} />
            </div>
            <h3 className="text-base font-bold text-text mb-1">{t('メールを確認してください')}</h3>
            <p className="text-sm text-text-muted leading-relaxed">
              <span className="text-text font-medium break-all">{email.trim()}</span> {t('宛にログイン用リンクを送信しました。メール内のリンクを開くとログインが完了します。')}
            </p>
            <p className="text-xs text-text-muted mt-3">
              {t('届かない場合は迷惑メールフォルダをご確認のうえ、しばらく待ってから再送してください。')}
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 text-sm text-accent hover:underline"
            >
              {t('別のメールアドレスで試す')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-3">
            <p className="text-sm text-text-muted leading-relaxed">
              {t('メールアドレスを入力すると、ログイン用のリンク（Magic Link）が届きます。パスワードは不要です。初めての方はそのまま新規登録されます。')}
            </p>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-4 py-3 bg-surface-hover border border-border focus:border-accent rounded-lg text-base text-text placeholder-text-muted outline-none transition-colors"
              />
            </div>
            {error && (
              <p className="flex items-center gap-1.5 text-xs text-no">
                <AlertTriangle size={13} />
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-sm text-white font-semibold transition-colors"
            >
              <LogIn size={16} />
              {loading ? t('送信中…') : t('ログインリンクを送信')}
            </button>
            <p className="text-[11px] text-text-muted text-center pt-1">
              {t('続行することで、利用規約およびプライバシーポリシーに同意したものとみなされます。')}
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
