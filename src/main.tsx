import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { useTheme } from './store/useTheme'
import { I18nProvider } from './lib/i18n'

// テーマを最初の描画前に適用（FOUC防止）
useTheme.getState()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>
)
