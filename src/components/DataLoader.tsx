import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { useAuth } from '../store/useAuth'

// 起動時とログイン状態の変化時に Supabase から全データを読み込む
export default function DataLoader() {
  const loadAll = useStore((s) => s.loadAll)
  const sessionUserId = useAuth((s) => s.session?.user.id ?? null)

  useEffect(() => {
    loadAll()
  }, [loadAll, sessionUserId])

  return null
}
