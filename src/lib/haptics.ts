// Vibration API ラッパー。navigator.vibrate が無い環境では自動的に no-op。
// 演出の補助であり、失敗しても呼び出し側の処理を一切妨げない（fire-and-forget）。

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern)
    }
  } catch {
    /* ignore */
  }
}

/** 罠を踏んだ瞬間（150〜200ms の単発） */
export function bustBuzz() {
  vibrate(180)
}

/** Cash Out 成功（短い振動を2回） */
export function cashoutBuzz() {
  vibrate([30, 60, 30])
}

/** 高倍率開示時の短いフィードバック */
export function bigWinBuzz() {
  vibrate(20)
}
