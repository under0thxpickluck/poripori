import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { IS_LOCAL, createLocalClient } from './localClient'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!IS_LOCAL && (!url || !anonKey)) {
  // 開発時に気づけるよう警告（.env を設定してください）
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が未設定です。.env を確認してください。'
  )
}

// VITE_LOCAL_MODE=1 のときは Supabase の代わりに localStorage ベースのローカル
// バックエンドを使う（メール認証なしで投稿・投票を試すデモ用）。本番では未設定。
export const supabase: SupabaseClient = IS_LOCAL
  ? (createLocalClient() as unknown as SupabaseClient)
  : createClient(url ?? '', anonKey ?? '', {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })

if (IS_LOCAL) console.info('[miraix] ローカルデモモードで起動（VITE_LOCAL_MODE=1）')

// 接続済みかどうか（段階的移行の分岐に使える）
export const isSupabaseConfigured = IS_LOCAL || Boolean(url && anonKey)
