/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** '1' のとき、Supabase の代わりに localStorage ベースのローカルデモ用バックエンドを使う */
  readonly VITE_LOCAL_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
