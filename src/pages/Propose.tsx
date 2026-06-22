import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { Category } from '../types'

const CATEGORIES: Exclude<Category, 'All'>[] = [
  'Politics', 'Crypto', 'Sports', 'AI', 'Tech', 'Science', 'Entertainment',
]

const CAT_LABELS: Record<string, string> = {
  Politics: '政治', Crypto: '暗号資産', Sports: 'スポーツ',
  AI: 'AI', Tech: 'テクノロジー', Science: '科学', Entertainment: 'エンタメ',
}

export default function Propose() {
  const { currentUser, proposeMarket } = useStore()
  const user = currentUser()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    question: '',
    description: '',
    deadline: '',
    category: 'AI' as Exclude<Category, 'All'>,
  })
  const [submitted, setSubmitted] = useState(false)

  if (!user) {
    return (
      <div className="text-center py-20 text-text-muted">
        マーケットを提案するにはログインしてください
      </div>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.question.trim() || !form.description.trim() || !form.deadline) return
    proposeMarket(form)
    setSubmitted(true)
    setTimeout(() => navigate('/'), 2000)
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <CheckCircle2 size={48} className="text-yes mx-auto mb-4" />
        <h2 className="text-xl font-bold text-text mb-2">提案を送信しました！</h2>
        <p className="text-text-muted text-sm">管理者が承認すると、マーケットが公開されます。</p>
      </div>
    )
  }

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text mb-1">マーケットを提案する</h1>
        <p className="text-text-muted text-sm">
          提案は管理者が審査後、承認されると公開されます
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-surface border border-border rounded-lg p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              質問 <span className="text-no">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              placeholder="例：2026年内にAGIは実現するか？"
              className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-lg text-sm text-text placeholder-text-muted outline-none transition-colors"
            />
            <p className="text-xs text-text-muted mt-1">{form.question.length}/100</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              解決条件 <span className="text-no">*</span>
            </label>
            <textarea
              required
              maxLength={500}
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="「誰が見ても明確な条件」を詳しく書いてください。&#10;例：〇〇社が公式に△△を発表した場合にYES。&#10;判断の根拠となる情報源も記載してください。"
              className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-lg text-sm text-text placeholder-text-muted outline-none transition-colors resize-none"
            />
            <p className="text-xs text-text-muted mt-1">{form.description.length}/500</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                賭け締切日 <span className="text-no">*</span>
              </label>
              <input
                type="date"
                required
                min={minDateStr}
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value + 'T23:59:59Z' }))}
                className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-lg text-sm text-text outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">
                カテゴリ <span className="text-no">*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as any }))}
                className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-lg text-sm text-text outline-none transition-colors"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CAT_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 flex items-start gap-2">
          <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
          <p className="text-xs text-yellow-400">
            解決条件が曖昧な提案は却下されることがあります。「誰が見ても明確」な条件を書いてください。
          </p>
        </div>

        <button
          type="submit"
          className="w-full py-3 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold transition-colors"
        >
          提案を送信する
        </button>
      </form>
    </div>
  )
}
