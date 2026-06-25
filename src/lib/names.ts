// 公開表示用の名前マスキング：先頭1文字＋固定●●●（文字数も隠す）
// 例: 田中 太郎 → 田●●●, Admin → A●●●
export function maskName(name: string): string {
  const t = (name ?? '').trim()
  if (!t) return '●●●'
  return Array.from(t)[0] + '●●●'
}

// 自分自身はフル表示、他人はマスキング
export function displayName(
  name: string,
  userId?: string | null,
  currentUserId?: string | null
): string {
  if (userId && currentUserId && userId === currentUserId) return name
  return maskName(name)
}
