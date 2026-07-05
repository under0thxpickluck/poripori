import { useState } from 'react'
import { Trash2, ExternalLink } from 'lucide-react'
import { useStore } from '../../store/useStore'
import ImagePicker from '../../components/ImagePicker'
import { useT } from '../../lib/i18n'

export default function Ads() {
  const t = useT()
  const { ads, currentUser, addAd, toggleAd, deleteAd } = useStore()
  const user = currentUser()
  const [form, setForm] = useState({ title: '', imageUrl: '', linkUrl: '' })

  if (user?.role !== 'admin') {
    return <div className="text-center py-20 text-no">{t('管理者権限が必要です')}</div>
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.linkUrl.trim()) return
    addAd(form)
    setForm({ title: '', imageUrl: '', linkUrl: '' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text mb-1">{t('広告管理')}</h1>
        <p className="text-text-muted text-sm">{t('マーケット一覧に挿入されるインフィード広告')}</p>
      </div>

      <form onSubmit={handleAdd} className="bg-surface border border-border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text">{t('新規広告')}</h2>
        <div>
          <label className="block text-sm font-medium text-text mb-2">{t('タイトル')} <span className="text-no">*</span></label>
          <input
            type="text" required maxLength={80}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-md text-sm text-text placeholder-text-muted outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-2">{t('リンクURL')} <span className="text-no">*</span></label>
          <input
            type="url" required
            value={form.linkUrl}
            onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
            placeholder="https://..."
            className="w-full px-4 py-2.5 bg-surface-hover border border-border focus:border-accent rounded-md text-sm text-text placeholder-text-muted outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-2">{t('画像')}</label>
          <ImagePicker value={form.imageUrl} onChange={(v) => setForm((f) => ({ ...f, imageUrl: v }))} />
        </div>
        <button type="submit" className="px-4 py-2 rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors">
          {t('広告を追加')}
        </button>
      </form>

      <div className="space-y-2">
        {ads.length === 0 ? (
          <div className="text-center py-10 text-text-muted">{t('広告がありません')}</div>
        ) : (
          ads.map((ad) => (
            <div key={ad.id} className="flex items-center gap-3 bg-surface border border-border rounded-lg p-3">
              {ad.imageUrl
                ? <img src={ad.imageUrl} alt="" className="w-12 h-12 rounded-md object-cover shrink-0" />
                : <div className="w-12 h-12 rounded-md bg-surface-hover shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text line-clamp-1">{ad.title}</p>
                <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1">
                  <ExternalLink size={11} />{ad.linkUrl}
                </a>
              </div>
              <button
                onClick={() => toggleAd(ad.id)}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  ad.active
                    ? 'bg-yes/15 text-yes border-yes/30'
                    : 'bg-surface-hover text-text-muted border-border'
                }`}
              >
                {ad.active ? t('有効') : t('無効')}
              </button>
              <button onClick={() => deleteAd(ad.id)} className="text-text-muted hover:text-no transition-colors p-1">
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
