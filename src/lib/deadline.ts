export type DeadlinePreset = '1d' | '3d' | '1w'

const PRESET_MS: Record<DeadlinePreset, number> = {
  '1d': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
}

/** base から preset 分だけ進めた新しい Date を返す（base は破壊しない）。 */
export function addDeadline(base: Date, preset: DeadlinePreset): Date {
  return new Date(base.getTime() + PRESET_MS[preset])
}
