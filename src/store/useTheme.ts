import { create } from 'zustand'

export type Theme = 'dark' | 'light'

const KEY = 'poripori-theme'

function getInitial(): Theme {
  const saved = localStorage.getItem(KEY)
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function apply(theme: Theme) {
  const el = document.documentElement
  el.classList.toggle('light', theme === 'light')
}

type ThemeState = {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
}

export const useTheme = create<ThemeState>((set, get) => {
  const initial = getInitial()
  apply(initial)
  return {
    theme: initial,
    setTheme: (t) => {
      localStorage.setItem(KEY, t)
      apply(t)
      set({ theme: t })
    },
    toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  }
})
