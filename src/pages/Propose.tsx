import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Circle, Clock, BarChart2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { Category } from '../types'
import ImagePicker from '../components/ImagePicker'
import MarketImage from '../components/MarketImage'

const CATEGORIES: Exclude<Category, 'All'>[] = [
  'Politics', 'Crypto', 'Sports', 'AI', 'Tech', 'Science', 'Entertainment',
]

const CAT_LABELS: Record<string, string> = {
  Politics: '政治', Crypto: '暗号資産', Sports: 'スポーツ',
  AI: 'AI', Tech: 'テクノロジー', Science: '科学', Entertainment: 'エンタメ',
}

const CAT_CHIP: Record<string, string> = {
  Politics: 'text-blue-400', Crypto: 'text-orange-400', Sports: 'text-green-400',
  AI: 'text-purple-400', Tech: 'text-cyan-400', Science: 'text-sky-400', Entertainment: 'text-pink-400',
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
    imageUrl: '',
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
  const deadlineDate = form.deadline ? form.deadline.split('T')[0] : ''

  const checks = [
    { ok: form.question.trim().length >= 8, label: '質問が具体的（8文字以上）' },
    { ok: form.description.trim().length >= 30, label: '解決条件が明確（30文字以上）' },
    { ok: !!form.deadline, label: '締切日が設定されている' },
    { ok: /https?:\/\/|公式|情報源|発表|基準/.test(form.description), label: '判定の根拠・情報源がある' },
  ]
  const allOk = checks.every((c) => c.ok)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text mb-1">マーケットを提案する</h1>
        <p className="text-text-muted text-sm">提案は管理者が審査後、承認されると公開されます</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* フォーム */}
        <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-5">
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

            <div>
              <label className="block text-sm font-medium text-text mb-2">
                カテゴリ <span className="text-no">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, category: c }))}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      form.category === c
                        ? 'bg-accent/20 border-accent/60 text-accent'
                        : 'border-border text-text-muted hover:text-text hover:border-accent/40'
                    }`}
                  >
                    {CAT_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">
                賭け締切日 <span className="text-no">*</span>
              </label>
              <input
                type="date"
                required
                min={minDateStr}
                value={deadlineDate}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value + 'T23:59:59Z' }))}
                className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-lg text-sm text-text outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">画像（任意）</label>
              <ImagePicker value={form.imageUrl} onChange={(v) => setForm((f) => ({ ...f, imageUrl: v }))} />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold transition-colors"
          >
            提案を送信する
          </button>
        </form>

        {/* プレビュー & チェックリスト */}
        <div className="lg:col-span-2">
          <div className="sticky top-20 space-y-4">
            <div>
              <p className="text-xs font-semibold text-text-muted mb-2">プレビュー</p>
              <div className="bg-surface border border-border rounded-lg p-5">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-surface-hover ${CAT_CHIP[form.category]}`}>
                  {form.category}
                </span>
                <div className="flex gap-3 mt-3 mb-4">
                  <MarketImage src={form.imageUrl} category={form.category} className="w-12 h-12 rounded-md shrink-0" />
                  <p className="text-sm font-medium text-text leading-snug line-clamp-3">
                    {form.question || 'ここに質問が表示されます'}
                  </p>
                </div>
                <div className="flex gap-2 mb-3">
                  <div className="flex-1 py-2 rounded-lg bg-yes/10 border border-yes/20 text-yes text-sm font-semibold text-center">
                    YES 50¢
                  </div>
                  <div className="flex-1 py-2 rounded-lg bg-no/10 border border-no/20 text-no text-sm font-semibold text-center">
                    NO 50¢
                  </div>
                </div>
                <div className="flex rounded-full overflow-hidden h-1 mb-4">
                  <div className="bg-yes" style={{ width: '50%' }} />
                  <div className="bg-no flex-1" />
                </div>
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span className="flex items-center gap-1"><BarChart2 size={11} />0 pt</span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {deadlineDate || '締切未設定'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-lg p-5">
              <p className="text-xs font-semibold text-text mb-3">良い質問のチェック</p>
              <div className="space-y-2">
                {checks.map((c) => (
                  <div key={c.label} className="flex items-center gap-2">
                    {c.ok ? (
                      <CheckCircle2 size={15} className="text-yes shrink-0" />
                    ) : (
                      <Circle size={15} className="text-text-muted shrink-0" />
                    )}
                    <span className={`text-xs ${c.ok ? 'text-text' : 'text-text-muted'}`}>{c.label}</span>
                  </div>
                ))}
              </div>
              {!allOk && (
                <div className="mt-3 flex items-start gap-2 text-xs text-yellow-400">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  曖昧な条件は却下されることがあります。
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
