import { useState, useCallback } from 'react'
import { Plus, Save, Trash2, Loader, Trophy, Handshake } from 'lucide-react'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import ImageUpload from '../components/ImageUpload'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const TAG = 'bitsavers-sponsors'

const C = {
  card: '#141414', border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0', muted: '#666',
  green: '#22c55e', red: '#ef4444',
}

const load = () => {
  try { return JSON.parse(localStorage.getItem('bitsavers_sponsors') || '{"sponsors":[],"collaborators":[]}') }
  catch { return { sponsors: [], collaborators: [] } }
}

const newId = () => Date.now().toString() + Math.random().toString(36).slice(2)

const taStyle = {
  width: '100%', boxSizing: 'border-box',
  background: '#0a0a0a', border: '1px solid rgba(247,147,26,0.18)',
  borderRadius: 8, padding: '10px 12px',
  color: '#F0EBE0', fontSize: 13, outline: 'none',
  fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6,
}

// ─── MUST be outside AdminSponsors so React never remounts it on re-render ───
function ItemRow({ item, draft, onDraftChange, onLogoChange, onDelete }) {
  return (
    <div style={{ background: '#0f0f0f', border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0 }}>
          <ImageUpload currentUrl={item.logo} onUploaded={onLogoChange} size={56} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            rows={1}
            value={draft.name}
            onChange={e => onDraftChange('name', e.target.value)}
            placeholder="Name *"
            style={{ ...taStyle, resize: 'none' }}
          />
          <textarea
            rows={3}
            value={draft.description}
            onChange={e => onDraftChange('description', e.target.value)}
            placeholder="Description — type freely"
            style={taStyle}
          />
          <textarea
            rows={1}
            value={draft.url}
            onChange={e => onDraftChange('url', e.target.value)}
            placeholder="Website URL (optional)"
            style={{ ...taStyle, resize: 'none' }}
          />
        </div>
        <button onClick={onDelete} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: C.red, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AdminSponsors() {
  const [items, setItems] = useState(() => {
    const d = load()
    return { sponsors: d.sponsors || [], collaborators: d.collaborators || [] }
  })
  const [drafts, setDrafts] = useState(() => {
    const d = load()
    const all = [...(d.sponsors || []), ...(d.collaborators || [])]
    const out = {}
    all.forEach(i => { out[i.id] = { name: i.name || '', description: i.description || '', url: i.url || '' } })
    return out
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const setDraft = useCallback((id, field, value) => {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }, [])

  const setLogo = useCallback((section, id, logoUrl) => {
    setItems(prev => ({ ...prev, [section]: prev[section].map(i => i.id === id ? { ...i, logo: logoUrl } : i) }))
  }, [])

  const addItem = (section) => {
    const id = newId()
    setItems(prev => ({ ...prev, [section]: [...prev[section], { id, logo: '' }] }))
    setDrafts(prev => ({ ...prev, [id]: { name: '', description: '', url: '' } }))
  }

  const deleteItem = (section, id) => {
    setItems(prev => ({ ...prev, [section]: prev[section].filter(i => i.id !== id) }))
    setDrafts(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  const save = async () => {
    setSaving(true); setMsg('')
    try {
      const merged = {
        sponsors: items.sponsors.map(i => ({ ...i, ...drafts[i.id] })).filter(i => i.name?.trim()),
        collaborators: items.collaborators.map(i => ({ ...i, ...drafts[i.id] })).filter(i => i.name?.trim()),
      }
      const nsec = localStorage.getItem('bitsavers_nsec')
      if (!nsec) throw new Error('No private key')
      const pool = getPool()
      const event = finalizeEvent({
        kind: 1, created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'bitsavers'], ['t', TAG]],
        content: 'SPONSORS:' + JSON.stringify(merged),
      }, nsecToBytes(nsec))
      await Promise.any(pool.publish(RELAYS, event))
      localStorage.setItem('bitsavers_sponsors', JSON.stringify(merged))
      setMsg('ok: Published!')
    } catch(e) { setMsg('err: ' + (e.message || 'Failed')) }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  const renderSection = (title, Icon, section) => (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: C.text }}>
          <Icon size={15} color={C.accent} /> {title}
        </div>
        <button onClick={() => addItem(section)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={13} /> Add
        </button>
      </div>
      {items[section].length === 0 && (
        <div style={{ fontSize: 12, color: C.muted, padding: '12px 0' }}>No {title.toLowerCase()} yet. Click Add.</div>
      )}
      {items[section].map(item => (
        <ItemRow
          key={item.id}
          item={item}
          draft={drafts[item.id] || { name: '', description: '', url: '' }}
          onDraftChange={(field, value) => setDraft(item.id, field, value)}
          onLogoChange={url => setLogo(section, item.id, url)}
          onDelete={() => deleteItem(section, item.id)}
        />
      ))}
    </div>
  )

  return (
    <div>
      {renderSection('Sponsors', Trophy, 'sponsors')}
      {renderSection('Collaborators', Handshake, 'collaborators')}

      {msg && <div style={{ fontSize: 13, color: msg.startsWith('ok') ? C.green : C.red, marginBottom: 12 }}>{msg.replace(/^(ok|err): /, '')}</div>}

      <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.accent, border: 'none', color: '#000', padding: '12px 24px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
        {saving ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={15} />}
        {saving ? 'Publishing…' : 'Save & Publish All'}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

