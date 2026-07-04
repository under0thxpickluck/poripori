import { useState } from 'react'
import { Globe, Check } from 'lucide-react'
import { LANGS, useI18n } from '../lib/i18n'

/** 言語切替ドロップダウン(Navbar 用。未ログインでも使える) */
export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={t('言語')}
        title={t('言語')}
        className="w-9 h-9 rounded-lg bg-surface-hover border border-border text-text-muted hover:text-text hover:border-accent/50 flex items-center justify-center transition-colors"
      >
        <Globe size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-40 bg-surface border border-border rounded-lg overflow-hidden py-1">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setLang(l.code)
                  setOpen(false)
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                  lang === l.code ? 'text-accent font-semibold' : 'text-text-muted hover:text-text hover:bg-white/5'
                }`}
              >
                {l.label}
                {lang === l.code && <Check size={14} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
