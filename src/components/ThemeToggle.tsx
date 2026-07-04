import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../store/useTheme'
import { useT } from '../lib/i18n'

export default function ThemeToggle() {
  const t = useT()
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? t('ライトモードに切り替え') : t('ダークモードに切り替え')}
      title={isDark ? t('ライトモード') : t('ダークモード')}
      className="w-9 h-9 rounded-lg bg-surface-hover border border-border text-text-muted hover:text-text hover:border-accent/50 flex items-center justify-center transition-colors"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
