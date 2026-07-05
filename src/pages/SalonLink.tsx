import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { IS_LOCAL } from '../lib/localClient'
import { useAuth } from '../store/useAuth'
import { useT } from '../lib/i18n'

// サロン（LIFAIOV / aisalon）からのSSO受け口。?sso=<token> を検証してセッションを確立する。
export default function SalonLink() {
  const t = useT()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const loadProfile = useAuth((s) => s.loadProfile)
  const [status, setStatus] = useState<'working' | 'error'>('working')
  const [message, setMessage] = useState('サロンアカウントを確認しています…')
  const ran = useRef(false) // StrictMode等での二重実行防止（token_hashは1回しか使えない）

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    // ローカルデモモードには Edge Functions が無い
    if (IS_LOCAL) {
      setStatus('error')
      setMessage('ローカルデモモードではサロン連携は利用できません。')
      return
    }
    const token = params.get('sso')
    if (!token) {
      setStatus('error')
      setMessage('連携トークンがありません。サロンのアーケードからやり直してください。')
      return
    }
    ;(async () => {
      const { data, error } = await supabase.functions.invoke('miraix-sso', { body: { token } })
      // 非2xx時は data が null になり、本文（{ok:false,error}）は error.context にある
      let result = data as { ok?: boolean; error?: string; token_hash?: string; welcome_bonus?: number } | null
      if (!result && error) {
        const ctx = (error as { context?: Response }).context
        if (ctx && typeof ctx.json === 'function') {
          result = await ctx.json().catch(() => null)
        }
      }
      if (error || !result?.ok) {
        const code = result?.error ?? ''
        setStatus('error')
        setMessage(
          code === 'salon_mismatch'
            ? '連携を中止しました。サロンとグループ情報が一致しません（安全のため処理していません）。サロンの運営にお問い合わせください。'
            : code === 'already_linked_other'
              ? 'このメールアドレスは既に別のサロンアカウントと連携されています。'
              : '連携に失敗しました。トークンの有効期限（5分）が切れている場合は、サロンからやり直してください。',
        )
        return
      }
      const { error: vErr } = await supabase.auth.verifyOtp({
        type: 'email',
        token_hash: result.token_hash!,
      })
      if (vErr) {
        setStatus('error')
        setMessage(`サインインに失敗しました: ${vErr.message}`)
        return
      }
      await loadProfile()
      const bonus = Number(result.welcome_bonus ?? 0)
      navigate(bonus > 0 ? `/wallet?welcome=${bonus}` : '/wallet', { replace: true })
    })()
  }, [params, navigate, loadProfile])

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      {status === 'working' && (
        <div className="w-8 h-8 rounded-full border-2 border-border border-t-accent animate-spin" />
      )}
      <p className="text-sm text-text-muted text-center px-4">{t(message)}</p>
      {status === 'error' && (
        <button
          onClick={() => navigate('/', { replace: true })}
          className="px-4 py-2 rounded-lg border border-border text-sm text-text-muted hover:text-text transition-colors"
        >
          {t('ホームへ戻る')}
        </button>
      )}
    </div>
  )
}
