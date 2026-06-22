import { useRef, useState } from 'react'
import { ImageIcon, Link2, Upload, X } from 'lucide-react'

type Props = {
  value: string | undefined
  onChange: (v: string) => void
  aspect?: 'square' | 'wide'
}

const MAX_EDGE = 400
const MAX_BYTES = 200 * 1024 // 圧縮後 ~200KB 上限

function compressToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas context unavailable'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })
}

export default function ImagePicker({ value, onChange, aspect = 'wide' }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const aspectClass = aspect === 'square' ? 'aspect-square w-32' : 'aspect-[16/9] w-full max-w-sm'

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError('')
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await compressToDataUrl(file)
      if (dataUrl.length > MAX_BYTES * 1.37) {
        setError('画像が大きすぎます。別の画像を選んでください。')
        return
      }
      onChange(dataUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : '画像処理に失敗しました')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="画像URLを入力（https://...）"
          className="w-full pl-9 pr-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-md text-sm text-text placeholder-text-muted outline-none transition-colors"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-hover border border-border text-text-muted hover:text-text text-xs transition-colors"
        >
          <Upload size={13} />
          画像を選択
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-text-muted hover:text-no text-xs transition-colors"
          >
            <X size={13} />
            クリア
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </div>

      {error && <p className="text-xs text-no">{error}</p>}

      <div className={`${aspectClass} rounded-lg border border-border bg-surface-hover overflow-hidden flex items-center justify-center`}>
        {value ? (
          <img src={value} alt="プレビュー" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={28} className="text-text-muted" />
        )}
      </div>
    </div>
  )
}
