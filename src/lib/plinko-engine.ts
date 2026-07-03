// ============================================================
// MIRAIX PLINKO — 物理シミュレーション+Canvas 描画エンジン
// ------------------------------------------------------------
// school_repo js/plinko.js からの移植。抽選もポイント処理も持たず、
// 「サーバーが決めた着地マス(targetBucket)へ物理的に自然な軌道で
// 玉を落とす」ことだけを担当する。
//  ・玉ごとに「各段で左右どちらへ跳ねるか」のプランを先に作る
//    (右k回・左rows-k回のシャッフル = 終点kで条件付けたランダム
//    ウォークと同じ分布なので、経路の見た目も統計的に自然)
//  ・ペグ衝突時は跳ね返りの向きだけをプランに合わせる
//  ・補正は「現在の段の理想位置」への微小な追従のみ(常に半マス以内)
//  ・ペグ帯を抜けたら短い着地イーズで必ず targetBucket 中心に収まる
// ============================================================

export type Rng = () => number

export type Geometry = {
  rows: number
  D: number
  rowSpacingY: number
  topMargin: number
  centerX: number
  leftWall: number
  rightWall: number
  bucketBarHeight: number
  boardHeight: number
  totalHeight: number
  pegRadius: number
  ballRadius: number
  buckets: number
  lastPegRowY: number
  hopVx: number
}

export type Peg = { x: number; y: number; row: number; hitAt: number }

export type Ball = {
  x: number
  y: number
  vx: number
  vy: number
  trail: { x: number; y: number }[]
  settled: boolean
  targetBucket: number
  targetX: number
  plan: number[]
  path: number[]
  maxY: number
  stuckFor: number
  landing: boolean
  landingStartX: number
  landingStartY: number
  landingElapsed: number
  payload: unknown
}

// ---- 物理定数(school_repo 版と同一) ----
const GRAVITY = 1500 // px/s^2
const PEG_RESTITUTION = 0.55
const WALL_RESTITUTION = 0.65
const MAX_SPEED = 1400
export const SUBSTEP = 1 / 180
const TRAIL_LEN = 8
const STEER_TAU = 0.12 // 理想経路とのズレを詰める目安時間(秒)
const STEER_RATE = 8 // vx を追従速度へ寄せる速さ(1/秒)
const LANDING_EASE_SEC = 0.22 // 着地アニメーションの所要時間
const STUCK_TIMEOUT_SEC = 1.2 // 下方向に進めなくなってからの詰まり判定秒数

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function computeGeometry(rows: number, cssWidth: number): Geometry {
  const bottomPegCount = rows + 2
  const D = cssWidth / (bottomPegCount + 1)
  const rowSpacingY = D * 0.88
  const topMargin = D
  const bucketBarHeight = Math.max(38, D * 0.85)
  const boardHeight = topMargin + (rows - 1) * rowSpacingY + D
  const lastPegRowY = topMargin + (rows - 1) * rowSpacingY
  return {
    rows,
    D,
    rowSpacingY,
    topMargin,
    centerX: cssWidth / 2,
    leftWall: D,
    rightWall: (rows + 2) * D,
    bucketBarHeight,
    boardHeight,
    totalHeight: boardHeight + bucketBarHeight + 6,
    pegRadius: Math.max(2.5, D * 0.09),
    ballRadius: Math.max(4, D * 0.16),
    buckets: rows + 1,
    lastPegRowY,
    // ペグで跳ねた玉が次の段までに半マス(D/2)横へ移動するのに必要な横速度
    hopVx: (0.5 * D) / Math.sqrt((2 * rowSpacingY) / GRAVITY),
  }
}

export function layoutPegs(geom: Geometry): Peg[] {
  const pegs: Peg[] = []
  for (let i = 0; i < geom.rows; i++) {
    const count = 3 + i
    const rowWidth = (count - 1) * geom.D
    const y = geom.topMargin + i * geom.rowSpacingY
    for (let j = 0; j < count; j++) {
      pegs.push({ x: geom.centerX - rowWidth / 2 + j * geom.D, y, row: i, hitAt: -Infinity })
    }
  }
  return pegs
}

/**
 * targetBucket に着地するための段ごとの左右プラン(+1=右, -1=左)。
 * 右 k 回・左 rows-k 回の一様シャッフル = 「終点が k と決まったランダム
 * ウォーク」の条件付き分布そのものなので、途中経路も自然に見える。
 */
function buildPlan(rows: number, targetBucket: number, rng: Rng): number[] {
  const plan: number[] = []
  for (let i = 0; i < rows; i++) plan.push(i < targetBucket ? 1 : -1)
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = plan[i]
    plan[i] = plan[j]
    plan[j] = tmp
  }
  return plan
}

export function createBall(geom: Geometry, targetBucket: number, payload: unknown, rng: Rng): Ball {
  const plan = buildPlan(geom.rows, targetBucket, rng)
  // path[i] = i段目のペグに当たる瞬間の理想x座標(=当たるべきペグのx)。
  // 各決定で半マス(D/2)ずつ動き、path[rows] は必ず targetBucket の中心になる。
  const path = [geom.centerX]
  for (let i = 0; i < geom.rows; i++) {
    path.push(path[i] + plan[i] * geom.D * 0.5)
  }
  return {
    x: geom.centerX + (rng() - 0.5) * geom.D * 0.3,
    y: geom.topMargin * 0.25,
    vx: (rng() - 0.5) * 40,
    vy: 0,
    trail: [],
    settled: false,
    targetBucket,
    targetX: geom.leftWall + (targetBucket + 0.5) * geom.D,
    plan,
    path,
    maxY: -Infinity,
    stuckFor: 0,
    landing: false,
    landingStartX: 0,
    landingStartY: 0,
    landingElapsed: 0,
    payload,
  }
}

/** 誘導。戻り値 true のときは着地アニメーション中(物理はスキップ)。 */
function steerBall(ball: Ball, geom: Geometry, dt: number): boolean {
  if (ball.landing) {
    ball.landingElapsed += dt
    const te = easeOutCubic(Math.min(1, ball.landingElapsed / LANDING_EASE_SEC))
    ball.x = lerp(ball.landingStartX, ball.targetX, te)
    ball.y = lerp(ball.landingStartY, geom.boardHeight, te)
    if (te >= 1) ball.settled = true
    return true
  }

  // 詰まり検出: 最深到達点が更新されない時間を数える(総経過時間で判定すると
  // 段数が多い盤面で正常な玉まで途中から着地アニメに切り替わってワープする)
  if (ball.y > ball.maxY) {
    ball.maxY = ball.y
    ball.stuckFor = 0
  } else {
    ball.stuckFor += dt
  }
  const clearedPegs = ball.y > geom.lastPegRowY + geom.pegRadius
  if (clearedPegs || ball.stuckFor > STUCK_TIMEOUT_SEC) {
    ball.landing = true
    ball.landingStartX = ball.x
    ball.landingStartY = Math.min(ball.y, geom.boardHeight)
    ball.landingElapsed = 0
    return true
  }

  // 現在の高さにおける理想経路上のx(プランのジグザグを線分でつないだもの)
  // へ、横速度をそっと寄せる。追従速度はペグで跳ねたときの最大横速度と同じ
  // 上限に抑え、「跳ねより速い横滑り」は起こさない。
  const t = (ball.y - geom.topMargin) / geom.rowSpacingY
  const seg = Math.max(0, Math.min(geom.rows - 1, Math.floor(t)))
  const frac = Math.max(0, Math.min(1, t - seg))
  const idealX = lerp(ball.path[seg], ball.path[seg + 1], frac)
  const maxTrackVx = geom.hopVx * 2.2
  let desiredVx = (idealX - ball.x) / STEER_TAU
  if (desiredVx > maxTrackVx) desiredVx = maxTrackVx
  if (desiredVx < -maxTrackVx) desiredVx = -maxTrackVx
  ball.vx += (desiredVx - ball.vx) * Math.min(1, STEER_RATE * dt)
  return false
}

function stepBall(ball: Ball, dt: number, geom: Geometry, pegs: Peg[], rng: Rng, nowMs: number): void {
  ball.vy += GRAVITY * dt
  if (ball.vx > MAX_SPEED) ball.vx = MAX_SPEED
  if (ball.vx < -MAX_SPEED) ball.vx = -MAX_SPEED
  if (ball.vy > MAX_SPEED) ball.vy = MAX_SPEED

  ball.x += ball.vx * dt
  ball.y += ball.vy * dt

  const r = geom.ballRadius
  if (ball.x - r < geom.leftWall) {
    ball.x = geom.leftWall + r
    ball.vx = Math.abs(ball.vx) * WALL_RESTITUTION
  } else if (ball.x + r > geom.rightWall) {
    ball.x = geom.rightWall - r
    ball.vx = -Math.abs(ball.vx) * WALL_RESTITUTION
  }

  const minDist = r + geom.pegRadius
  const minDistSq = minDist * minDist
  for (const peg of pegs) {
    const dx = ball.x - peg.x
    const dy = ball.y - peg.y
    const distSq = dx * dx + dy * dy
    if (distSq < minDistSq && distSq > 0.0001) {
      const dist = Math.sqrt(distSq)
      const nx = dx / dist
      const ny = dy / dist
      const overlap = minDist - dist
      ball.x += nx * overlap
      ball.y += ny * overlap

      const vDotN = ball.vx * nx + ball.vy * ny
      if (vDotN < 0) {
        ball.vx -= (1 + PEG_RESTITUTION) * vDotN * nx
        ball.vy -= (1 + PEG_RESTITUTION) * vDotN * ny
        // 跳ね返りの「向き」だけをプランに合わせる。丸いペグでの左右は
        // 現実でもほぼコイントスなので、向きの選択自体は不自然に見えない。
        // 大きさは次の段までに半マス移動できる速度(hopVx)を基準に、
        // 揺らぎを持たせつつ上限も設けて暴れすぎを防ぐ。
        const dir = ball.plan[peg.row]
        const mag = Math.min(
          Math.max(Math.abs(ball.vx), geom.hopVx * (0.9 + rng() * 0.5)),
          geom.hopVx * 2.2
        )
        ball.vx = dir * mag
        peg.hitAt = nowMs
      }
    }
  }

  ball.trail.push({ x: ball.x, y: ball.y })
  if (ball.trail.length > TRAIL_LEN) ball.trail.shift()
}

/** 1サブステップ進める。着地完了で ball.settled = true になる。 */
export function advanceBall(ball: Ball, dt: number, geom: Geometry, pegs: Peg[], rng: Rng, nowMs: number): void {
  if (ball.settled) return
  if (steerBall(ball, geom, dt)) return
  stepBall(ball, dt, geom, pegs, rng, nowMs)
}
