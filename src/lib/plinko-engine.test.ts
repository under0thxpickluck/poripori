import { describe, it, expect } from 'vitest'
import { computeGeometry, layoutPegs, createBall, advanceBall, SUBSTEP } from './plinko-engine'

// 再現性のためのシード付き乱数(LCG)
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function dropAndRecord(rows: number, targetBucket: number, seed: number) {
  const geom = computeGeometry(rows, 400)
  const pegs = layoutPegs(geom)
  const rng = makeRng(seed)
  const ball = createBall(geom, targetBucket, null, rng)
  const frames: { x: number; y: number }[] = []
  let simMs = 0
  // 60fps サンプリングで最長 8 秒
  for (let f = 0; f < 480 && !ball.settled; f++) {
    for (let s = 0; s < 3; s++) {
      simMs += SUBSTEP * 1000
      advanceBall(ball, SUBSTEP, geom, pegs, rng, simMs)
      if (ball.settled) break
    }
    frames.push({ x: ball.x, y: ball.y })
  }
  return { geom, ball, frames }
}

describe('plinko-engine 軌道品質', () => {
  const rowsList = [8, 12, 16]
  const seeds = [1, 42, 12345]

  for (const rows of rowsList) {
    it(`${rows}段: 全バケットに自然な軌道で着地する`, () => {
      for (let bucket = 0; bucket <= rows; bucket++) {
        for (const seed of seeds) {
          const { geom, ball, frames } = dropAndRecord(rows, bucket, seed)
          const D = geom.D

          // 必ず時間内に着地する
          expect(ball.settled).toBe(true)

          // 着地位置 = 指定バケットの中心
          const bucketCenter = geom.leftWall + (bucket + 0.5) * D
          expect(Math.abs(ball.x - bucketCenter)).toBeLessThan(D / 2)

          // フレーム間テレポートなし(1フレームで0.8マス以上動かない)
          for (let i = 1; i < frames.length; i++) {
            expect(Math.abs(frames[i].x - frames[i - 1].x)).toBeLessThan(0.8 * D)
          }

          // 持続的な横滑りなし(0.33秒窓での横移動は3マス以内。
          // 修正前の「中央への吸い寄せ」バグでは9マス超が観測されていた)
          for (let i = 20; i < frames.length; i++) {
            expect(Math.abs(frames[i].x - frames[i - 20].x)).toBeLessThan(3.0 * D)
          }
        }
      }
    })
  }
})
