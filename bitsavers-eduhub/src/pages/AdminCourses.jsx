import { useState, useEffect } from 'react'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import { nip19 } from 'nostr-tools'
import { Plus, Trash2, Loader, Upload, Edit2, X, CheckCircle, BookOpen, ExternalLink } from 'lucide-react'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const COURSES_TAG = 'bitsavers-courses'

const C = {
  bg: '#080808', card: '#141414', border: 'rgba(247,147,26,0.18)',
  accent: '#F7931A', dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

const getCourses = () => { try { return JSON.parse(localStorage.getItem('bitsavers_courses') || '[]') } catch { return [] } }
const saveCourses = (d) => localStorage.setItem('bitsavers_courses', JSON.stringify(d))

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16, ...style }}>
    {children}
  </div>
)

const LEVELS = ['Beginner', 'Intermediate', 'Advanced']
const CATEGORIES = ['Bitcoin Basics', 'Lightning Network', 'Mining', 'Security', 'Development', 'Economics', 'Other']

const EMPTY = {
  id: '', title: '', description: '', instructor: '', level: 'Beginner',
  category: 'Bitcoin Basics', duration: '', price: 'Free', priceAmount: '',
  image: '', link: '', linkLabel: 'Register Now', tags: '', published: true
}

async function publishCourses(courses, nsec) {
  const skBytes = nsecToBytes(nsec)
  const pool = getPool()
  const event = finalizeEvent({
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['t', 'bitsavers'], ['t', COURSES_TAG]],
    content: 'COURSES:' + JSON.stringify(courses),
  }, skBytes)
  await Promise.any(pool.publish(RELAYS, event))
}

export default function AdminCourses() {
  const [courses, setCourses] = useState(getCourses)
  const [editing, setEditing] = useState(null) // null | EMPTY | course object
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploading, setUploading] = useState(false)

  // Fetch from Nostr on mount
  useEffect(() => {
    const pool = getPool()
    let latest = { created_at: 0 }
    const sub = pool.subscribe(RELAYS, { kinds: [1], '#t': [COURSES_TAG], limit: 10 }, {
      onevent(e) {
        if (!e.content.startsWith('COURSES:')) return
        try {
          if (e.created_at > latest.created_at)
            latest = { created_at: e.created_at, data: JSON.parse(e.content.slice('COURSES:'.length)) }
        } catch {}
      },
      oneose() {
        sub.close()
        if (latest.data) { saveCourses(latest.data); setCourses(latest.data) }
      }
    })
    setTimeout(() => sub.close(), 8000)
    return () => sub.close()
  }, [])

  const uploadImage = async (file) => {
    if (!file?.type.startsWith('image/')) { setMsg('err: Images only'); return null }
    if (file.size > 5 * 1024 * 1024) { setMsg('err: Max 5MB'); return null }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${import.meta.env.VITE_IMGBB_KEY}`, { method: 'POST', body: formData })
      const json = await res.json()
      return json?.data?.display_url || null
    } catch { return null }
    finally { setUploading(false) }
  }

  const startNew = () => setEditing({ ...EMPTY, id: Date.now().toString() })

  const save = async () => {
    if (!editing.title.trim()) { setMsg('err: Title is required'); return }
    const updated = editing.id && courses.find(c => c.id === editing.id)
      ? courses.map(c => c.id === editing.id ? editing : c)
      : [...courses, editing]
    setCourses(updated)
    saveCourses(updated)
    setEditing(null)
    setSaving(true)
    setMsg('ok: Saving and publishing…')
    try {
      await publishCourses(updated, localStorage.getItem('bitsavers_nsec'))
      setMsg('ok: Course saved and published to Nostr!')
    } catch {
      setMsg('ok: Course saved locally — hit Publish below to sync to all devices')
    }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  const deleteCourse = async (id) => {
    if (!confirm('Delete this course?')) return
    const updated = courses.filter(c => c.id !== id)
    setCourses(updated)
    saveCourses(updated)
    try { await publishCourses(updated, localStorage.getItem('bitsavers_nsec')) } catch {}
  }

  const publish = async () => {
    const nsec = localStorage.getItem('bitsavers_nsec')
    if (!nsec) { setMsg('err: No private key found'); return }
    setPublishing(true); setMsg('')
    try {
      await publishCourses(courses, nsec)
      setMsg('ok: Courses published to Nostr!')
    } catch (e) { setMsg('err: ' + (e.message || 'Publish failed')) }
    setPublishing(false)
  }

  const StatusMsg = () => {
    if (!msg) return null
    const ok = msg.startsWith('ok:')
    return (
      <div style={{ padding: '10px 14px', borderRadius: 9, marginBottom: 14, fontSize: 13,
        background: ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
        color: ok ? C.green : C.red }}>
        {msg.slice(4)}
      </div>
    )
  }

  // ── Edit Form ──────────────────────────────────────────────────────────────
  if (editing) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{editing.id && courses.find(c => c.id === editing.id) ? 'Edit Course' : 'New Course'}</div>
        <button onClick={() => setEditing(null)} style={{ background: C.dim, border: `1px solid ${C.border}`, color: C.muted, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <X size={13} /> Cancel
        </button>
      </div>

      <StatusMsg />

      <Card>
        {/* Cover image */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 8 }}>Cover Image</label>
          {editing.image && (
            <img src={editing.image} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 10, marginBottom: 10, border: `1px solid ${C.border}` }} />
          )}
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: `2px dashed ${C.border}`, borderRadius: 10, padding: '14px', cursor: uploading ? 'not-allowed' : 'pointer', color: C.muted, fontSize: 13, background: C.dim }}>
            {uploading ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Uploading…</> : <><Upload size={14} /> {editing.image ? 'Change Image' : 'Upload Cover Image'}</>}
            <input type="file" accept="image/*" disabled={uploading} onChange={async e => {
              const url = await uploadImage(e.target.files?.[0])
              if (url) setEditing(prev => ({ ...prev, image: url }))
              e.target.value = ''
            }} style={{ display: 'none' }} />
          </label>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Course Title *</label>
          <input value={editing.title} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Bitcoin for Beginners"
            style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 13px', color: C.text, fontSize: 14, outline: 'none' }} />
        </div>

        {/* Description */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Description</label>
          <textarea value={editing.description} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} placeholder="What will students learn?" rows={4}
            style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 13px', color: C.text, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

        {/* Instructor + Duration row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Instructor</label>
            <input value={editing.instructor} onChange={e => setEditing(p => ({ ...p, instructor: e.target.value }))} placeholder="e.g. hodlcurator"
              style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 13px', color: C.text, fontSize: 13, outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Duration</label>
            <input value={editing.duration} onChange={e => setEditing(p => ({ ...p, duration: e.target.value }))} placeholder="e.g. 4 weeks"
              style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 13px', color: C.text, fontSize: 13, outline: 'none' }} />
          </div>
        </div>

        {/* Level + Category row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Level</label>
            <select value={editing.level} onChange={e => setEditing(p => ({ ...p, level: e.target.value }))}
              style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 13px', color: C.text, fontSize: 13, outline: 'none' }}>
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Category</label>
            <select value={editing.category} onChange={e => setEditing(p => ({ ...p, category: e.target.value }))}
              style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 13px', color: C.text, fontSize: 13, outline: 'none' }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Price */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 8 }}>Price</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: editing.price === 'Paid' ? 10 : 0 }}>
            {['Free', 'Paid'].map(p => (
              <button key={p} onClick={() => setEditing(prev => ({ ...prev, price: p }))}
                style={{ flex: 1, background: editing.price === p ? C.accent : C.dim, border: `1px solid ${editing.price === p ? C.accent : C.border}`, color: editing.price === p ? '#000' : C.muted, padding: '10px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {p}
              </button>
            ))}
          </div>
          {editing.price === 'Paid' && (
            <input value={editing.priceAmount} onChange={e => setEditing(p => ({ ...p, priceAmount: e.target.value }))} placeholder="e.g. 10000 sats or $10"
              style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 13px', color: C.text, fontSize: 13, outline: 'none' }} />
          )}
        </div>

        {/* CTA Link */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Registration / Info Link</label>
          <input value={editing.link} onChange={e => setEditing(p => ({ ...p, link: e.target.value }))} placeholder="https://…"
            style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 13px', color: C.text, fontSize: 13, outline: 'none', marginBottom: 8 }} />
          <input value={editing.linkLabel} onChange={e => setEditing(p => ({ ...p, linkLabel: e.target.value }))} placeholder="Button label e.g. Register Now"
            style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 13px', color: C.text, fontSize: 13, outline: 'none' }} />
        </div>

        {/* Tags */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Tags <span style={{ fontWeight: 400 }}>(comma separated)</span></label>
          <input value={editing.tags} onChange={e => setEditing(p => ({ ...p, tags: e.target.value }))} placeholder="e.g. bitcoin, savings, africa"
            style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 13px', color: C.text, fontSize: 13, outline: 'none' }} />
        </div>

        <button onClick={save} style={{ width: '100%', background: C.accent, border: 'none', color: '#000', padding: '14px', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <CheckCircle size={16} /> Save Course
        </button>
      </Card>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── Course List ─────────────────────────────────────────────────────────────
  return (
    <div>
      <StatusMsg />

      <button onClick={startNew} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: C.dim, border: `2px dashed ${C.border}`, color: C.accent, padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 16 }}>
        <Plus size={16} /> Create New Course
      </button>

      {courses.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>
          <BookOpen size={32} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 6 }}>No courses yet</div>
          <div style={{ fontSize: 12 }}>Create your first course above</div>
        </div>
      )}

      {courses.map(course => (
        <Card key={course.id}>
          <div style={{ display: 'flex', gap: 12 }}>
            {course.image && (
              <img src={course.image} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, flexShrink: 0, border: `1px solid ${C.border}` }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 4 }}>{course.title}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, background: C.dim, padding: '3px 8px', borderRadius: 20 }}>{course.level}</span>
                <span style={{ fontSize: 10, color: C.muted, background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 20 }}>{course.category}</span>
                <span style={{ fontSize: 10, color: course.price === 'Free' ? C.green : C.accent, background: course.price === 'Free' ? 'rgba(34,197,94,0.1)' : C.dim, padding: '3px 8px', borderRadius: 20 }}>
                  {course.price === 'Free' ? 'Free' : course.priceAmount || 'Paid'}
                </span>
              </div>
              {course.instructor && <div style={{ fontSize: 11, color: C.muted }}>by {course.instructor} {course.duration && `· ${course.duration}`}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => setEditing(course)} style={{ flex: 1, background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '9px', borderRadius: 9, fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Edit2 size={12} /> Edit
            </button>
            <button onClick={() => deleteCourse(course.id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: C.red, padding: '9px 14px', borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </Card>
      ))}

      {courses.length > 0 && (
        <button onClick={publish} disabled={publishing} style={{ width: '100%', background: C.accent, border: 'none', color: '#000', padding: '14px', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: publishing ? 'not-allowed' : 'pointer', opacity: publishing ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {publishing ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Publishing…</> : 'Publish Courses to Nostr'}
        </button>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

