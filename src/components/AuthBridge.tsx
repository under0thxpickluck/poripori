import { useEffect } from 'react'
import { useAuth } from '../store/useAuth'
import { useStore } from '../store/useStore'

// Supabaseの認証プロフィールを、アプリ既存ストアの「現在ユーザー」に同期する橋渡し。
// （段階移行用：認証は本物、マーケット/取引は次ステップでSupabaseへ）
export default function AuthBridge() {
  const profile = useAuth((s) => s.profile)
  const syncAuthUser = useStore((s) => s.syncAuthUser)

  useEffect(() => {
    if (profile) {
      syncAuthUser({
        id: profile.id,
        name: profile.name,
        points: profile.points,
        xp: profile.xp,
        role: profile.role,
        createdAt: profile.created_at,
        lastBonus: profile.last_bonus ?? undefined,
        bonusStreak: profile.bonus_streak,
      })
    } else {
      syncAuthUser(null)
    }
  }, [profile, syncAuthUser])

  return null
}
