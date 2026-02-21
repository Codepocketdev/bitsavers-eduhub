import { useState, useEffect } from 'react'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import { nip19 } from 'nostr-tools'
import { Upload, Trash2, Loader, Plus, X, Image } from 'lucide-react'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const GALLERY_TAG = 'bitsavers-gallery'

const C = {
  bg: '#080808', card: '#141414', border: 'rgba(247,147,26,0.18)',
  accent: '#F7931A', dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

const getGallery = () => { try { return JSON.parse(localStorage.getItem('bitsavers_gallery') || '[]') } catch { return [] } }
const saveGallery = (d) => localStorage.setItem('bitsavers_gallery', JSON.stringify(d))

const Card = ({ children }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
    {children}
  </div>
)

const StatusMsg = ({ msg }) => {
  if (!msg) return null
  const ok = msg.startsWith('ok:')
  return (
    <div style={{ padding: '10px 14px', borderRadius: 9, marginBottom: 14, fontSize: 13,
      background: ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
      border: `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
      color: ok ? C.green : C.red,
    }}>
      {msg.slice(4)}
    </div>
  )
}

async function publishGallery(cohorts, nsec) {
  const skBytes = nsecToBytes(nsec)
  const pool = getPool()
  const event = finalizeEvent({
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['t', 'bitsavers'], ['t', GALLERY_TAG]],
    content: 'GALLERY:' + JSON.stringify(cohorts),
  }, skBytes)
  await Promise.any(pool.publish(RELAYS, event))
}

export default function AdminGallery() {
  const [cohorts, setCohorts] = useState(getGallery)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(null) // cohortId being uploaded
  const [newCohortName, setNewCohortName] = useState('')
  const [adding, setAdding] = useState(false)

  // Fetch latest from Nostr on mount
  useEffect(() => {
    const pool = getPool()
    let latest = { created_at: 0 }
    const sub = pool.subscribe(RELAYS, { kinds: [1], '#t': [GALLERY_TAG], limit: 20 }, {
      onevent(e) {
        if (!e.content.startsWith('GALLERY:')) return
        try {
          if (e.created_at > latest.created_at) {
            latest = { created_at: e.created_at, data: JSON.parse(e.content.slice('GALLERY:'.length)) }
          }
        } catch {}
      },
      oneose() {
        sub.close()
        if (latest.data) { saveGallery(latest.data); setCohorts(latest.data) }
      }
    })
    setTimeout(() => sub.close(), 8000)
    return () => sub.close()
  }, [])

  const addCohort = () => {
    if (!newCohortName.trim()) return
    const updated = [...cohorts, { id: Date.now().toString(), name: newCohortName.trim(), photos: [] }]
    setCohorts(updated)
    saveGallery(updated)
    setNewCohortName('')
    setAdding(false)
  }

  const deleteCohort = (id) => {
    if (!confirm('Delete this cohort and all its photos?')) return
    const updated = cohorts.filter(c => c.id !== id)
    setCohorts(updated)
    saveGallery(updated)
  }

  const uploadPhoto = async (cohortId, file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setMsg('err: Images only'); return }
    if (file.size > 5 * 1024 * 1024) { setMsg('err: Max 5MB per image'); return }

    setUploading(cohortId)
    setMsg('')
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${import.meta.env.VITE_IMGBB_KEY}`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      const json = await res.json()
      const url = json?.data?.display_url
      if (!url) throw new Error('No URL returned')

      const updated = cohorts.map(c => {
        if (c.id !== cohortId) return c
        return { ...c, photos: [...c.photos, { id: Date.now().toString(), url, caption: '' }] }
      })
      setCohorts(updated)
      saveGallery(updated)
      setMsg('ok: Photo uploaded!')
    } catch(e) { setMsg('err: ' + (e.message || 'Upload failed')) }
    setUploading(null)
  }

  const deletePhoto = (cohortId, photoId) => {
    const updated = cohorts.map(c => {
      if (c.id !== cohortId) return c
      return { ...c, photos: c.photos.filter(p => p.id !== photoId) }
    })
    setCohorts(updated)
    saveGallery(updated)
  }

  const updateCaption = (cohortId, photoId, caption) => {
    const updated = cohorts.map(c => {
      if (c.id !== cohortId) return c
      return { ...c, photos: c.photos.map(p => p.id === photoId ? { ...p, caption } : p) }
    })
    setCohorts(updated)
    saveGallery(updated)
  }

  const publish = async () => {
    const nsec = localStorage.getItem('bitsavers_nsec')
    if (!nsec) { setMsg('err: No private key found'); return }
    setSaving(true); setMsg('')
    try {
      await publishGallery(cohorts, nsec)
      setMsg('ok: Gallery published to Nostr!')
    } catch(e) { setMsg('err: ' + (e.message || 'Publish failed')) }
    setSaving(false)
  }

  return (
    <div>
      <StatusMsg msg={msg} />

      {/* Add cohort */}
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>Graduate Cohorts</div>
        {adding ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              value={newCohortName}
              onChange={e => setNewCohortName(e.target.value)}
              placeholder="e.g. JET Cohort 1"
              autoFocus
              style={{ flex: 1, background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none' }}
            />
            <button onClick={addCohort} disabled={!newCohortName.trim()}
              style={{ background: C.accent, border: 'none', color: '#000', padding: '10px 16px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Add
            </button>
            <button onClick={() => setAdding(false)}
              style={{ background: C.dim, border: `1px solid ${C.border}`, color: C.muted, padding: '10px 12px', borderRadius: 9, cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.dim, border: `1px dashed ${C.border}`, color: C.accent, padding: '10px 16px', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
            <Plus size={14} /> Add Cohort
          </button>
        )}
      </Card>

      {/* Cohort cards */}
      {cohorts.map(cohort => (
        <Card key={cohort.id}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{cohort.name}</div>
            <button onClick={() => deleteCohort(cohort.id)}
              style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: C.red, padding: '6px 10px', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>

          {/* Photos grid */}
          {cohort.photos.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
              {cohort.photos.map(photo => (
                <div key={photo.id} style={{ background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                  <img src={photo.url} alt="graduate" style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: 8 }}>
                    <input
                      value={photo.caption || ''}
                      onChange={e => updateCaption(cohort.id, photo.id, e.target.value)}
                      placeholder="Caption…"
                      style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: `1px solid ${C.border}`, color: C.muted, fontSize: 11, outline: 'none', padding: '4px 0', marginBottom: 8 }}
                    />
                    <button onClick={() => deletePhoto(cohort.id, photo.id)}
                      style={{ width: '100%', background: 'rgba(239,68,68,0.1)', border: 'none', color: C.red, padding: '5px', borderRadius: 6, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <Trash2 size={11} /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload button */}
          <label style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            border: `2px dashed ${C.border}`, borderRadius: 10, padding: '16px',
            cursor: uploading === cohort.id ? 'not-allowed' : 'pointer',
            color: C.muted, fontSize: 13, background: C.dim,
          }}>
            {uploading === cohort.id
              ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Uploading…</>
              : <><Upload size={14} /> Add Photo (max 5MB)</>
            }
            <input type="file" accept="image/*" onChange={e => uploadPhoto(cohort.id, e.target.files?.[0])}
              disabled={!!uploading} style={{ display: 'none' }} />
          </label>
        </Card>
      ))}

      {cohorts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>
          <Image size={32} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 6 }}>No cohorts yet</div>
          <div style={{ fontSize: 12 }}>Add a cohort above then upload graduate photos</div>
        </div>
      )}

      {/* Publish button */}
      {cohorts.length > 0 && (
        <button onClick={publish} disabled={saving}
          style={{ width: '100%', background: C.accent, border: 'none', color: '#000', padding: '14px', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {saving ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Publishing…</> : 'Publish Gallery to Nostr'}
        </button>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

