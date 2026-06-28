import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type Profile = {
  id: string
  name: string
  points: number
  xp: number
  role: 'user' | 'admin'
  last_bonus: string | null
  bonus_streak: number
  created_at: string
}

type AuthState = {
  session: Session | null
  profile: Profile | null
  ready: boolean
  // メールに Magic Link を送信
  signInWithEmail: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  loadProfile: () => Promise<void>
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  ready: false,

  signInWithEmail: async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    return { error: error?.message ?? null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    // 管理者パスワードのロック解除状態も破棄（別ユーザーへの引き継ぎ防止）
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('admin_unlocked')
    set({ session: null, profile: null })
  },

  loadProfile: async () => {
    const uid = get().session?.user.id
    if (!uid) {
      set({ profile: null })
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    set({ profile: (data as Profile | null) ?? null })
  },
}))

// 起動時にセッションを復元し、以後の認証状態変化を購読
supabase.auth.getSession().then(({ data }) => {
  useAuth.setState({ session: data.session, ready: true })
  if (data.session) useAuth.getState().loadProfile()
})

supabase.auth.onAuthStateChange((_event, session) => {
  useAuth.setState({ session, ready: true })
  useAuth.getState().loadProfile()
})
