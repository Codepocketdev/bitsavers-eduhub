import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { ADMIN_NPUBS, isAdmin, isSuperAdmin } from '../config/admins'
import { publishProfile, getPool } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import { nip19 } from 'nostr-tools'
import ImageUpload from '../components/ImageUpload'
import AdminAssignments from './AdminAssignments'
import { Users, Newspaper, Calendar, Image, Megaphone, Trash2, Upload, Copy, Crown, Shield, Loader, Send, ClipboardList, CheckCircle, AlertCircle } from 'lucide-react'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

const C = {
  bg: '#080808', surface: '#0f0f0f', card: '#141414',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

const nsecToBytes = (nsec) => {
  const { type, data } = nip19.decode(nsec.trim())
  if (type !== 'nsec') throw new Error('Not an nsec key')
  return data
}

// ─── Section Tab ─────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'admins',      label: 'Admins',      },
  { id: 'news',        label: 'News',        },
  { id: 'events',      label: 'Events',      },
  { id: 'media',       label: 'Media',       },
  { id: 'assignments', label: 'Assignments', },
]

// ─── Shared components ────────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16, ...style }}>
    {children}
  </div>
)

const Input = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>{label}</label>}
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 13px', color: C.text, fontSize: 14, outline: 'none' }} />
  </div>
)

const Textarea = ({ label, value, onChange, placeholder, rows = 4 }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>{label}</label>}
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 13px', color: C.text, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
  </div>
)

const Btn = ({ onClick, children, disabled, variant = 'primary', style = {} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: variant === 'primary' ? C.accent : variant === 'danger' ? 'rgba(239,68,68,0.1)' : C.dim,
    border: variant === 'danger' ? '1px solid rgba(239,68,68,0.3)' : variant === 'outline' ? `1px solid ${C.border}` : 'none',
    color: variant === 'primary' ? C.bg : variant === 'danger' ? C.red : C.accent,
    padding: '10px 18px', borderRadius: 9, fontWeight: 700, fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    ...style
  }}>{children}</button>
)

const StatusMsg = ({ msg }) => {
  if (!msg) return null
  const ok = msg.startsWith('ok:')
  const text = msg.replace(/^(ok|err): /, '')
  return (
    <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, background: ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 9, color: ok ? C.green : C.red, fontSize: 13, marginBottom: 14 }}>
      {ok ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
      {text}
    </div>
  )
}

// ─── Manage Admins ────────────────────────────────────────────────────────────
function ManageAdmins({ user }) {
  const [admins, setAdmins] = useState(() => {
    const stored = localStorage.getItem('bitsavers_admins')
    return stored ? JSON.parse(stored) : ADMIN_NPUBS
  })
  const [newNpub, setNewNpub] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [msg, setMsg] = useState('')

  const saveAdmins = (list) => {
    setAdmins(list)
    localStorage.setItem('bitsavers_admins', JSON.stringify(list))
  }

  const addAdmin = () => {
    const npub = newNpub.trim()
    if (!npub.startsWith('npub1')) { setMsg('err: Must be a valid npub1... key'); return }
    if (admins.includes(npub)) { setMsg('err: Already an admin'); return }
    saveAdmins([...admins, npub])
    setNewNpub(''); setNewLabel('')
    setMsg('ok: Admin added!')
    setTimeout(() => setMsg(''), 2000)
  }

  const removeAdmin = (npub) => {
    if (npub === ADMIN_NPUBS[0]) { setMsg('err: Cannot remove super admin'); setTimeout(() => setMsg(''), 2000); return }
    saveAdmins(admins.filter(a => a !== npub))
    setMsg('ok: Admin removed')
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <div>
      <StatusMsg msg={msg} />
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Add New Admin</div>
        <Input label="Npub" value={newNpub} onChange={setNewNpub} placeholder="npub1..." />
        <Input label="Label (optional)" value={newLabel} onChange={setNewLabel} placeholder="e.g. John - Content Manager" />
        <Btn onClick={addAdmin} disabled={!newNpub.trim()}>+ Add Admin</Btn>
      </Card>

      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Current Admins ({admins.length})</div>
        {admins.map((npub, i) => (
          <div key={npub} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: C.bg, flexShrink: 0 }}>
              {i === 0 ? <Crown size={16} color='#080808' /> : <Shield size={16} color='#080808' />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: i === 0 ? C.accent : C.text, fontWeight: 600 }}>
                {i === 0 ? 'Super Admin' : `Admin ${i + 1}`}
              </div>
              <div style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {npub.slice(0, 20)}…{npub.slice(-8)}
              </div>
            </div>
            {i !== 0 && (
              <Btn onClick={() => removeAdmin(npub)} variant="danger" style={{ padding: '6px 12px', fontSize: 12 }}>Remove</Btn>
            )}
          </div>
        ))}
      </Card>
    </div>
  )
}

// ─── Publish News ─────────────────────────────────────────────────────────────
function PublishNews({ user }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [msg, setMsg] = useState('')
  const [newsList, setNewsList] = useState(() => {
    const stored = localStorage.getItem('bitsavers_news')
    return stored ? JSON.parse(stored) : []
  })

  const publish = async () => {
    if (!title.trim() || !content.trim()) { setMsg('err: Title and content required'); return }
    setPublishing(true); setMsg('')
    try {
      const storedNsec = localStorage.getItem('bitsavers_nsec')
      if (!storedNsec) throw new Error('No private key found')
      const skBytes = nsecToBytes(storedNsec)
      const pool = getPool()
      const event = finalizeEvent({
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'bitsavers'], ['t', 'bitsavers-news'], ['subject', title.trim()]],
        content: `${title.trim()}\n\n${content.trim()}${imageUrl ? '\n\n' + imageUrl : ''}`,
      }, skBytes)
      await Promise.any(pool.publish(RELAYS, event))

      const newsItem = { id: event.id, title: title.trim(), content: content.trim(), imageUrl, publishedAt: event.created_at }
      const updated = [newsItem, ...newsList].slice(0, 50)
      setNewsList(updated)
      localStorage.setItem('bitsavers_news', JSON.stringify(updated))

      setTitle(''); setContent(''); setImageUrl('')
      setMsg('ok: News published to Nostr!')
    } catch (e) { setMsg('err: ' + (e.message || 'Failed to publish')) }
    setPublishing(false)
  }

  const deleteNews = (id) => {
    const updated = newsList.filter(n => n.id !== id)
    setNewsList(updated)
    localStorage.setItem('bitsavers_news', JSON.stringify(updated))
  }

  return (
    <div>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Megaphone size={16} color={C.accent} /> Publish Announcement</div>
        <Input label="Title" value={title} onChange={setTitle} placeholder="e.g. New Course: Lightning Network 101" />
        <Textarea label="Content" value={content} onChange={setContent} placeholder="Write your announcement here…" rows={5} />
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 10 }}>Cover Image (optional)</label>
          <ImageUpload currentUrl={imageUrl} onUploaded={setImageUrl} size={70} />
        </div>
        <StatusMsg msg={msg} />
        <Btn onClick={publish} disabled={publishing || !title.trim() || !content.trim()}>
          {publishing ? 'Publishing…' : 'Publish News'}
        </Btn>
      </Card>

      {newsList.length > 0 && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Published News ({newsList.length})</div>
          {newsList.map(item => (
            <div key={item.id} style={{ padding: '14px 0', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{item.content.slice(0, 100)}…</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6, fontFamily: 'monospace' }}>
                    {new Date(item.publishedAt * 1000).toLocaleDateString()}
                  </div>
                </div>
                <Btn onClick={() => deleteNews(item.id)} variant="danger" style={{ padding: '6px 12px', fontSize: 12, flexShrink: 0 }}>Delete</Btn>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

// ─── Events ───────────────────────────────────────────────────────────────────
function ManageEvents({ user }) {
  const [events, setEvents] = useState(() => {
    const stored = localStorage.getItem('bitsavers_events')
    return stored ? JSON.parse(stored) : []
  })
  const [form, setForm] = useState({ title: '', instructor: '', date: '', time: '', description: '', link: '' })
  const [msg, setMsg] = useState('')

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const addEvent = () => {
    if (!form.title.trim() || !form.date) { setMsg('err: Title and date required'); return }
    const newEvent = { id: Date.now().toString(), ...form, createdAt: Date.now() }
    const updated = [newEvent, ...events]
    setEvents(updated)
    localStorage.setItem('bitsavers_events', JSON.stringify(updated))
    setForm({ title: '', instructor: '', date: '', time: '', description: '', link: '' })
    setMsg('ok: Event added!')
    setTimeout(() => setMsg(''), 2000)
  }

  const deleteEvent = (id) => {
    const updated = events.filter(e => e.id !== id)
    setEvents(updated)
    localStorage.setItem('bitsavers_events', JSON.stringify(updated))
  }

  return (
    <div>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Calendar size={16} color={C.accent} /> Add New Event</div>
        <Input label="Event Title" value={form.title} onChange={v => set('title', v)} placeholder="e.g. Bitcoin Wallets Masterclass" />
        <Input label="Instructor" value={form.instructor} onChange={v => set('instructor', v)} placeholder="e.g. Alex Wambui" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Date" value={form.date} onChange={v => set('date', v)} type="date" />
          <Input label="Time" value={form.time} onChange={v => set('time', v)} type="time" />
        </div>
        <Textarea label="Description" value={form.description} onChange={v => set('description', v)} placeholder="What will be covered?" rows={3} />
        <Input label="Join Link (optional)" value={form.link} onChange={v => set('link', v)} placeholder="https://meet.jit.si/..." />
        <StatusMsg msg={msg} />
        <Btn onClick={addEvent} disabled={!form.title.trim() || !form.date}>+ Add Event</Btn>
      </Card>

      {events.length > 0 && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Upcoming Events ({events.length})</div>
          {events.sort((a, b) => new Date(a.date) - new Date(b.date)).map(event => (
            <div key={event.id} style={{ padding: '14px 0', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ background: C.dim, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, color: C.accent, fontWeight: 700, fontFamily: 'monospace' }}>
                      {event.date} {event.time && `· ${event.time}`}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>{event.title}</div>
                  {event.instructor && <div style={{ fontSize: 12, color: C.muted }}>Instructor: {event.instructor}</div>}
                  {event.description && <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{event.description.slice(0, 80)}…</div>}
                  {event.link && <a href={event.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.accent, marginTop: 4, display: 'block' }}>Join Link →</a>}
                </div>
                <Btn onClick={() => deleteEvent(event.id)} variant="danger" style={{ padding: '6px 12px', fontSize: 12, flexShrink: 0 }}>Delete</Btn>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

// ─── Media Library ────────────────────────────────────────────────────────────
function MediaLibrary() {
  const [images, setImages] = useState(() => {
    const stored = localStorage.getItem('bitsavers_media')
    return stored ? JSON.parse(stored) : []
  })
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState('')

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setMsg('err: Images only'); return }
    if (file.size > 5 * 1024 * 1024) { setMsg('err: Max 5MB'); return }

    setUploading(true); setMsg('')
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${import.meta.env.VITE_IMGBB_KEY}`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      const json = await res.json()
      const url = json?.data?.display_url
      if (!url) throw new Error('No URL returned')

      const newImg = { id: Date.now().toString(), url, name: file.name, uploadedAt: Date.now() }
      const updated = [newImg, ...images]
      setImages(updated)
      localStorage.setItem('bitsavers_media', JSON.stringify(updated))
      setMsg('ok: Image uploaded!')
    } catch (err) { setMsg('err: ' + (err.message || 'Upload failed')) }
    setUploading(false)
    e.target.value = ''
  }

  const copyUrl = async (url, id) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(id)
      setTimeout(() => setCopied(''), 2000)
    } catch { alert('Copy failed') }
  }

  const deleteImage = (id) => {
    const updated = images.filter(i => i.id !== id)
    setImages(updated)
    localStorage.setItem('bitsavers_media', JSON.stringify(updated))
  }

  return (
    <div>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Upload Image</div>
        <StatusMsg msg={msg} />
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          border: `2px dashed ${C.border}`, borderRadius: 12, padding: '24px',
          cursor: uploading ? 'not-allowed' : 'pointer', color: C.muted,
          fontSize: 14, background: C.dim, transition: 'border-color 0.2s',
        }}>
          {uploading ? <><Loader size={15} style={{animation:'spin 1s linear infinite'}}/> Uploading…</> : <><Upload size={15}/> Tap to select image (max 5MB)</>}
          <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
        </label>
      </Card>

      {images.length > 0 && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Media Library ({images.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {images.map(img => (
              <div key={img.id} style={{ background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                <img src={img.url} alt={img.name} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
                <div style={{ padding: '8px 8px 10px' }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.name}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => copyUrl(img.url, img.id)} style={{ flex: 1, background: C.dim, border: 'none', color: C.accent, padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      {copied === img.id ? <><span style={{color:C.green}}>Copied</span></> : <><Copy size={11}/> Copy</>}
                    </button>
                    <button onClick={() => deleteImage(img.id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: C.red, padding: '5px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                      <Trash2 size={12}/>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Main Admin Panel ─────────────────────────────────────────────────────────
// spin keyframe injected via style tag in render
export default function AdminPanel({ user }) {
  const [section, setSection] = useState('admins')

  // Check if user is admin
  if (!user?.npub || !isAdmin(user.npub)) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ marginBottom: 16, display:'flex', justifyContent:'center' }}><AlertCircle size={48} color={C.red} /></div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>Access Denied</div>
        <div style={{ fontSize: 14, color: C.muted }}>You don't have admin privileges.</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          {isSuperAdmin(user.npub) ? <Crown size={20} color='#080808' /> : <Shield size={20} color='#080808' />}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>Admin Panel</div>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: 'monospace' }}>
            {isSuperAdmin(user.npub) ? 'Super Admin' : 'Admin'} · {user.npub.slice(0, 12)}…
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 20 }}>
        {SECTIONS.map(s => {
          const icons = { admins: <Users size={14}/>, news: <Newspaper size={14}/>, events: <Calendar size={14}/>, media: <Image size={14}/>, assignments: <ClipboardList size={14}/> }
          return (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              background: section === s.id ? C.accent : C.card,
              border: `1px solid ${section === s.id ? C.accent : C.border}`,
              color: section === s.id ? C.bg : C.muted,
              padding: '10px 6px', borderRadius: 10, fontWeight: 700,
              fontSize: 11, cursor: 'pointer', textAlign: 'center', lineHeight: 1.4,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              {icons[s.id]}
              {s.label}
            </button>
          )
        })}
      </div>

      {/* Section content */}
      {section === 'admins' && <ManageAdmins user={user} />}
      {section === 'news'   && <PublishNews user={user} />}
      {section === 'events' && <ManageEvents user={user} />}
      {section === 'media'       && <MediaLibrary />}
      {section === 'assignments' && <AdminAssignments />}
    </div>
  )
}

