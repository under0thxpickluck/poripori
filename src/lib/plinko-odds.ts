// Plinko 倍率テーブル生成。school_repo js/plinko.js からの移植。
// 本番の配当計算は Supabase の plinko_config を参照する(このモジュールは
// 管理画面のプレビュー生成と、seed 値がこのアルゴリズム由来であることの
// テストに使う)。

export const ROW_OPTIONS = [8, 10, 12, 14, 16] as const
export const GROWTH = 2.0 // 中央→端にかけての倍率の伸び方

export function binomCoeffs(n: number): number[] {
  const c = [1]
  for (let k = 1; k <= n; k++) {
    c.push((c[k - 1] * (n - k + 1)) / k)
  }
  return c
}

function roundMultiplier(x: number): number {
  if (x >= 10) return Math.round(x)
  if (x >= 1) return Math.round(x * 10) / 10
  return Math.round(x * 100) / 100
}

/** 行数 rows から、狙った還元率にほぼ一致する対称な倍率テーブルを作る */
export function generateMultipliers(rows: number, targetRTP: number, growth: number = GROWTH): number[] {
  const mid = rows / 2
  const coeffs = binomCoeffs(rows)
  const total = Math.pow(2, rows)
  const raw: number[] = []
  for (let k = 0; k <= rows; k++) {
    raw[k] = Math.pow(growth, Math.abs(k - mid))
  }
  const rawWeighted = coeffs.reduce((s, c, k) => s + c * raw[k], 0)
  const scale = (targetRTP * total) / rawWeighted
  const mult = raw.map((r) => roundMultiplier(r * scale))

  // 丸め誤差を中央マス(複数なら中央2マス)だけで吸収し、RTPをほぼ正確に合わせる
  const isEven = rows % 2 === 0
  const centerIdx = isEven ? [rows / 2] : [(rows - 1) / 2, (rows + 1) / 2]
  const centerWeight = centerIdx.reduce((s, k) => s + coeffs[k], 0)
  const fixedSum = coeffs.reduce((s, c, k) => (centerIdx.includes(k) ? s : s + c * mult[k]), 0)
  const neededCenterTotal = targetRTP * total - fixedSum
  const centerMult = Math.max(0, Math.round((neededCenterTotal / centerWeight) * 100) / 100)
  centerIdx.forEach((k) => (mult[k] = centerMult))

  return mult
}

export function calcRTP(rows: number, mult: number[]): number {
  const coeffs = binomCoeffs(rows)
  const total = Math.pow(2, rows)
  return coeffs.reduce((s, c, k) => s + c * mult[k], 0) / total
}
