import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import ImagePicker from '../../components/ImagePicker'
import type { Category } from '../../types'

const CATEGORIES: Exclude<Category, 'All'>[] = [
  'Politics', 'Crypto', 'Sports', 'AI', 'Tech', 'Science', 'Entertainment',
]
const CAT_LABELS: Record<string, string> = {
  Politics: '政治', Crypto: '暗号資産', Sports: 'スポーツ',
  AI: 'AI', Tech: 'テクノロジー', Science: '科学', Entertainment: 'エンタメ',
}

export default function MarketNew() {
  const { currentUser, createMarket } = useStore()
  const user = currentUser()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    question: '',
    description: '',
    deadline: '',
    category: 'AI' as Exclude<Category, 'All'>,
    imageUrl: '',
    b: 100,
  })

  if (user?.role !== 'admin') {
    return <div className="text-center py-20 text-no">管理者権限が必要です</div>
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.question.trim() || !form.description.trim() || !form.deadline) return
    createMarket(form)
    navigate('/admin/markets')
  }

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text mb-1">マーケット新規作成</h1>
        <p className="text-text-muted text-sm">承認を経ず、即時に公開されます</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-surface border border-border rounded-lg p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-text mb-2">質問 <span className="text-no">*</span></label>
            <input
              type="text" required maxLength={100}
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              placeholder="例：2026年内にAGIは実現するか？"
              className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-md text-sm text-text placeholder-text-muted outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">解決条件 <span className="text-no">*</span></label>
            <textarea
              required maxLength={500} rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="誰が見ても明確な条件と情報源を記載してください。"
              className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-md text-sm text-text placeholder-text-muted outline-none transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">締切日 <span className="text-no">*</span></label>
              <input
                type="date" required min={minDateStr}
                value={form.deadline.split('T')[0]}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value + 'T23:59:59Z' }))}
                className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-md text-sm text-text outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-2">カテゴリ <span className="text-no">*</span></label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Exclude<Category, 'All'> }))}
                className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-md text-sm text-text outline-none transition-colors"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">流動性パラメータ b</label>
            <input
              type="number" min={10}
              value={form.b}
              onChange={(e) => setForm((f) => ({ ...f, b: Number(e.target.value) }))}
              className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-md text-sm text-text outline-none transition-colors"
            />
            <p className="text-xs text-text-muted mt-1">大きいほど価格が動きにくくなります（既定: 100）</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">画像（任意）</label>
            <ImagePicker value={form.imageUrl} onChange={(v) => setForm((f) => ({ ...f, imageUrl: v }))} />
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 rounded-md bg-accent hover:bg-accent-hover text-white font-semibold transition-colors"
        >
          マーケットを公開する
        </button>
      </form>
    </div>
  )
}
