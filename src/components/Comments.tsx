import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { useStore } from '../store/useStore'
import { displayName } from '../lib/names'
import { format } from 'date-fns'

export default function Comments({ marketId }: { marketId: string }) {
  const { getMarketComments, addComment, currentUser, users } = useStore()
  const user = currentUser()
  const comments = getMarketComments(marketId)
  const [body, setBody] = useState('')

  const name = (id: string) => users.find((u) => u.id === id)?.name ?? '不明'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    addComment(marketId, body)
    setBody('')
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <h2 className="text-sm font-semibold text-text mb-4 flex items-center gap-1.5">
        <MessageSquare size={14} />
        コメント
        <span className="text-text-muted font-normal">({comments.length})</span>
      </h2>

      {user ? (
        <form onSubmit={handleSubmit} className="mb-5">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="コメントを書く..."
            className="w-full px-3 py-2 bg-surface-hover border border-border focus:border-accent rounded-md text-sm text-text placeholder-text-muted outline-none transition-colors resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={!body.trim()}
              className="px-4 py-1.5 rounded-md bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              投稿
            </button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-text-muted mb-5">コメントするにはログインしてください。</p>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-text-muted py-4 text-center">まだコメントはありません。</p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center text-xs text-text shrink-0">
                {name(c.userId).charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text">{displayName(name(c.userId), c.userId, user?.id)}</span>
                  <span className="text-xs text-text-muted">
                    {format(new Date(c.createdAt), 'MM/dd HH:mm')}
                  </span>
                </div>
                <p className="text-sm text-text mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
