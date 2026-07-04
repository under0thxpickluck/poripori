// 軽量 i18n(追加依存ゼロ)。docs/superpowers/specs/2026-07-05-i18n-design.md
//
// - キー = コード内の日本語原文。`t('残高')` のように使う
// - ja は辞書不要(キーをそのまま返す)。他言語は Record<原文, 訳文> の辞書
// - 訳が無いキーは日本語原文にフォールバック(画面は壊れない)
// - 変数は {n} プレースホルダ: t('罠 {n} 個', { n: 3 })
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { dict as en } from '../locales/en'
import { dict as zh } from '../locales/zh'
import { dict as ko } from '../locales/ko'
import { dict as es } from '../locales/es'
import { dict as pt } from '../locales/pt'

export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
] as const

export type Lang = (typeof LANGS)[number]['code']

const DICTS: Record<Exclude<Lang, 'ja'>, Record<string, string>> = { en, zh, ko, es, pt }

const LANG_KEY = 'miraix_lang'

function resolveInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved && LANGS.some((l) => l.code === saved)) return saved as Lang
  } catch {
    /* ignore */
  }
  if (typeof navigator !== 'undefined') {
    const nav = (navigator.language || '').toLowerCase()
    for (const { code } of LANGS) {
      if (nav === code || nav.startsWith(code + '-')) return code
    }
  }
  return 'en' // 標準は英語
}

export type TFunc = (key: string, vars?: Record<string, string | number>) => string

type I18nCtx = { lang: Lang; setLang: (l: Lang) => void; t: TFunc }

const Ctx = createContext<I18nCtx | null>(null)

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(resolveInitialLang)

  const value = useMemo<I18nCtx>(() => {
    const dict = lang === 'ja' ? null : DICTS[lang]
    return {
      lang,
      setLang: (l: Lang) => {
        setLangState(l)
        try {
          localStorage.setItem(LANG_KEY, l)
        } catch {
          /* ignore */
        }
      },
      t: (key, vars) => interpolate(dict?.[key] ?? key, vars),
    }
  }, [lang])

  useEffect(() => {
    _registerT(value.t)
  }, [value])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

export function useT(): TFunc {
  return useI18n().t
}

/** React の外(zustand ストア等)から現在言語の t を使うためのフック外アクセス。
 *  Provider がマウント時に登録する。未登録時は日本語原文を返す。 */
let currentT: TFunc = (key, vars) => interpolate(key, vars)
export function _registerT(t: TFunc) {
  currentT = t
}
export function tOutside(key: string, vars?: Record<string, string | number>): string {
  return currentT(key, vars)
}
