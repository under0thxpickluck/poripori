import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type PricePoint = { t: string; yes: number }

// マーケットの価格履歴を取得し、Realtimeで新しい点を追記購読する
export function usePriceHistory(marketId: string) {
  const [points, setPoints] = useState<PricePoint[]>([])

  useEffect(() => {
    let active = true
    setPoints([])

    supabase
      .from('price_history')
      .select('t,yes')
      .eq('market_id', marketId)
      .order('t', { ascending: true })
      .then(({ data }) => {
        if (active && data) setPoints(data.map((d) => ({ t: d.t as string, yes: Number(d.yes) })))
      })

    const channel = supabase
      .channel(`price_history:${marketId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'price_history', filter: `market_id=eq.${marketId}` },
        (payload) => {
          const r = payload.new as { t: string; yes: number }
          setPoints((prev) => [...prev, { t: r.t, yes: Number(r.yes) }])
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [marketId])

  return points
}
