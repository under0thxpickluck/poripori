import { useState } from 'react'
import { Globe, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '../store/useAuth'
import { supabase } from '../lib/supabase'
import { mapRpcError } from '../store/useStore'
import { useT } from '../lib/i18n'

/** 同意文の版。文言を改定したらこの値を上げる(全ユーザーに再同意を要求する) */
export const CONSENT_VERSION = 'v1-2026-07-05'

// ISO 3166-1 alpha-2 の全国コード。表示名は Intl.DisplayNames(英語)で解決する
const COUNTRY_CODES = ('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ ' +
  'NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ ' +
  'UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' ')

const COUNTRIES: Array<{ code: string; name: string }> = (() => {
  let display: Intl.DisplayNames | null = null
  try {
    display = new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    /* 未対応環境ではコードをそのまま表示 */
  }
  return COUNTRY_CODES
    .map((code) => ({ code, name: display?.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
})()

/** 英文が正文(仕様書 §3.3)。翻訳・要約は参考情報の位置づけ */
const CONSENT_CLAUSES: string[] = [
  'MIRAIX Points ("MR") are virtual points provided solely for entertainment purposes within this site. MR is not money, electronic money, or a financial instrument of any kind.',
  'The mini-games on this site (including Mines and Plinko) are entertainment features. Any MR gained through these games is locked as non-withdrawable and can never be transferred or exchanged outside this site, including to partner salon EP.',
  'This service is not available to residents of Japan. If you declare that you reside in Japan, you will not be able to participate in this service.',
  'You must truthfully declare your country of residence. Deliberately false or misleading declarations are prohibited.',
  'If we recognise that a declaration is false, we may restrict, suspend or terminate the relevant account and any associated features without prior notice.',
  'We may, at any time and at our sole discretion, require you to complete identity verification (KYC), including the submission of government-issued identification documents. Failure to cooperate may result in restriction of features.',
  'You are solely responsible for ensuring that your use of this site complies with all laws and regulations applicable in your country or region of residence.',
  'Transfers between MR and partner salon points (EP) are provided on an as-is basis. Consumed EP or MR will not be compensated or restored under any circumstances.',
  'We may amend these terms from time to time. Continued use of the site after an amendment requires renewed agreement.',
  'You confirm that you are of legal age to use this service in your jurisdiction of residence.',
  'This English text is the governing version of this notice. Any translations or summaries are provided for convenience only.',
]

/**
 * 居住国申告 + 確認事項(英文)への同意ゲート。
 * ログイン済みで現行版の同意記録が無いユーザーにブロッキング表示する(記録のみ・機能制限なし)。
 */
export default function ResidencyGate() {
  const t = useT()
  const profile = useAuth((s) => s.profile)
  const loadProfile = useAuth((s) => s.loadProfile)
  const signOut = useAuth((s) => s.signOut)

  const [residency, setResidency] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!profile) return null

  // 日本居住を申告済み: 参加不可(全画面遮断。解除は運営対応のみ)
  if (profile.residency === 'JP') {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl p-6 text-center space-y-4">
          <span className="mx-auto w-12 h-12 rounded-full bg-no/15 text-no flex items-center justify-center">
            <Globe size={22} />
          </span>
          <h2 className="text-lg font-bold text-text">Service Unavailable in Your Region</h2>
          <p className="text-sm text-text leading-relaxed">
            Based on your declared country of residence (Japan), this service is not available to you.
          </p>
          <p className="text-xs text-text-muted leading-relaxed">
            {t('ご申告いただいた居住国（日本）では、本サービスをご利用いただけません。誤って選択した場合は運営までお問い合わせください。')}
          </p>
          <button
            type="button"
            onClick={() => signOut()}
            className="mx-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border text-text-muted hover:text-text text-sm transition-colors"
          >
            <LogOut size={14} />
            {t('サインアウト')} ／ Sign out
          </button>
        </div>
      </div>
    )
  }

  if (profile.residency_consent_version === CONSENT_VERSION) return null

  const submit = async () => {
    if (!residency || !agreed || busy) return
    setBusy(true)
    setError('')
    try {
      const { error: err } = await supabase.rpc('declare_residency', {
        p_residency: residency,
        p_version: CONSENT_VERSION,
      })
      if (err) {
        setError(mapRpcError(err.message))
        return
      }
      await loadProfile()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-5 pb-3">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="w-9 h-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
              <Globe size={18} />
            </span>
            <h2 className="text-lg font-bold text-text">Residency Declaration &amp; Terms of Participation</h2>
          </div>
          <p className="text-[11px] text-text-muted">
            {t('以下の英文が正文です')}（The English text below is the governing version）
          </p>
        </div>

        <div className="mx-5 rounded-lg border border-border bg-bg/60 p-4 overflow-y-auto max-h-[42vh] text-[13px] leading-relaxed text-text space-y-2.5">
          <p className="text-text-muted">Please read and agree to the following before using MIRAIX.</p>
          <ol className="list-decimal pl-5 space-y-2">
            {CONSENT_CLAUSES.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label htmlFor="residency-country" className="block text-xs font-semibold text-text mb-1.5">
              Country of residence ／ {t('居住国')}
            </label>
            <select
              id="residency-country"
              value={residency}
              onChange={(e) => setResidency(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-bg text-sm text-text outline-none focus:border-accent"
            >
              <option value="">Select your country of residence…</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          <label className="flex items-start gap-2 text-xs text-text cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 accent-current"
            />
            <span>
              I have read and agree to all of the above.
              <span className="text-text-muted">（{t('上記すべてを読み、同意します')}）</span>
            </span>
          </label>

          {error && <p className="text-xs text-no">{t(error)}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={submit}
              disabled={!residency || !agreed || busy}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ShieldCheck size={15} />
              {busy ? t('送信中…') : `${t('同意して利用を続ける')} ／ Agree & Continue`}
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-text-muted hover:text-text text-xs transition-colors"
            >
              <LogOut size={13} />
              {t('同意しない')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
