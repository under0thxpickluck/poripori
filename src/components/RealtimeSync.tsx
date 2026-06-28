import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { useAuth } from '../store/useAuth'
import { supabase } from '../lib/supabase'

// 他ユーザーの操作（取引・解決・管理操作）による markets / profiles / positions の
// 変化を購読し、該当テーブルだけストアへ取り込む。これによりリロードせずに
// 価格%・残高・配当・市場ステータスがライブ更新される。
// （price_history はチャート、trades はトーストで個別に購読済み）
export default function RealtimeSync() {
  const loadAll = useStore((s) => s.loadAll)

  useEffect(() => {
    // テーブルごとに短くデバウンスし、バースト時の連続フェッチを束ねる
    const timers: Record<string, ReturnType<typeof setTimeout>> = {}
    const schedule = (key: string, fn: () => void) => {
      clearTimeout(timers[key])
      timers[key] = setTimeout(fn, 250)
    }

    const channel = supabase
      .channel('live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'markets' }, () =>
        schedule('markets', () => loadAll(['markets']))
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () =>
        schedule('profiles', () => {
          loadAll(['users']) // ランキング・他ユーザー残高
          useAuth.getState().loadProfile() // 自分の残高（解決配当などで増減）
        })
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positions' }, () =>
        schedule('positions', () => loadAll(['positions']))
      )
      .subscribe()

    return () => {
      Object.values(timers).forEach(clearTimeout)
      supabase.removeChannel(channel)
    }
  }, [loadAll])

  return null
}
