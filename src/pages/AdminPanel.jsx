import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { ADMIN_NPUBS, isAdmin, isSuperAdmin } from '../config/admins'
import { publishProfile, getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import { nip19 } from 'nostr-tools'
import ImageUpload from '../components/ImageUpload'
import AdminAssignments from './AdminAssignments'
import AdminSubmissions from './AdminSubmissions'
import AdminPoW from './AdminPoW'
import AdminGallery from './AdminGallery'
import AdminLiveClasses from './AdminLiveClasses'
import AdminFollowing from './AdminFollowing'
import AdminCertificates from './AdminCertificates'
import AdminCourses from './AdminCourses'
import AdminRsvp from './AdminRsvp'
import AdminGroups from './AdminGroups'
import AdminGroupMembers from './AdminGroupMembers'
import AdminGroupRequests from './AdminGroupRequests'
import AdminBlog from './AdminBlog'
import AdminSponsors from './AdminSponsors'
import AdminSocials from './AdminSocials'
import { Users, Newspaper, Calendar, Image, Video, Megaphone, Trash2, Upload, Copy, Crown, Shield, Loader, Send, ClipboardList, CheckCircle, AlertCircle, Inbox, Hammer, Share2, BookOpen, Ticket, MapPin, Clock, Link2, User, FileText, Hash, Award, ChevronDown, ChevronUp } from 'lucide-react'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

const C = {
  bg: '#080808', surface: '#0f0f0f', card: '#141414',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

const SECTIONS = [
  { id: 'admins',      label: 'Admins'         },
  { id: 'news',        label: 'News'           },
  { id: 'events',      label: 'Events'         },
  { id: 'cohorts',     label: 'Cohorts'        },
  { id: 'media',       label: 'Blog'           },
  { id: 'assignments', label: 'Assignments'    },
  { id: 'submissions', label: 'Submissions'    },
  { id: 'pow',         label: 'PoW Stats'      },
  { id: 'gallery',     label: 'Gallery'        },
  { id: 'liveclasses', label: 'Live Classes'   },
  { id: 'following',   label: 'Following'      },
  { id: 'courses',     label: 'Courses'        },
  { id: 'rsvp',        label: 'RSVP & Tickets' },
  { id: 'groups',      label: 'Communities'    },
  { id: 'grp-members', label: 'Group Members'  },
  { id: 'grp-requests',label: 'Group Requests' },
  { id: 'socials',     label: 'Socials'        },
  { id: 'certificates',label: 'Certificates'   },
]

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16, ...style }}>
    {children}
  </div>
)

const Input = ({ label, value, onChange, placeholder, type = 'text', icon }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>{icon && <span style={{display:'flex',alignItems:'center',color:C.accent}}>{icon}</span>}{label}</label>}
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
const ADMIN_NOSTR_TAG = 'bitsavers-admins'

async function publishAdminList(list) {
  const pool = getPool()
  const template = { kind: 1, created_at: Math.floor(Date.now() / 1000), tags: [['t', ADMIN_NOSTR_TAG]], content: 'ADMIN_LIST:' + JSON.stringify(list) }
  try {
    const nsec = localStorage.getItem('bitsavers_nsec')
    if (nsec) { const ev = finalizeEvent(template, nsecToBytes(nsec)); await Promise.any(pool.publish(RELAYS, ev)) }
    else if (window.nostr) { const ev = await window.nostr.signEvent(template); await Promise.any(pool.publish(RELAYS, ev)) }
  } catch(e) { console.error('publishAdminList failed:', e) }
}

function ManageAdmins({ user }) {
  const [admins, setAdmins] = useState(ADMIN_NPUBS)
  const [newNpub, setNewNpub] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [adminProfiles, setAdminProfiles] = useState({})

  useEffect(() => {
    if (!admins.length) return
    const hexKeys = admins.map(npub => { try { return nip19.decode(npub).data } catch { return null } }).filter(Boolean)
    if (!hexKeys.length) return
    const pool = getPool()
    const sub = pool.subscribe(RELAYS, { kinds: [0], authors: hexKeys, limit: hexKeys.length + 5 }, {
      onevent(e) { try { const p = JSON.parse(e.content); setAdminProfiles(prev => ({ ...prev, [e.pubkey]: { name: p.display_name || p.name, picture: p.picture } })) } catch {} },
      oneose() { sub.close() }
    })
    setTimeout(() => sub.close(), 5000)
    return () => sub.close()
  }, [admins.length])

  useEffect(() => {
    const pool = getPool()
    let latest = { created_at: 0 }
    const sub = pool.subscribe(RELAYS, { kinds: [1], '#t': [ADMIN_NOSTR_TAG], limit: 20 }, {
      onevent(e) { if (e.content.startsWith('ADMIN_LIST:') && e.created_at > latest.created_at) { try { latest = { created_at: e.created_at, data: JSON.parse(e.content.slice('ADMIN_LIST:'.length)) } } catch {} } },
      oneose() {
        if (latest.data) { const merged = [...new Set([...ADMIN_NPUBS, ...latest.data])]; setAdmins(merged); localStorage.setItem('bitsavers_admins', JSON.stringify(merged)) }
        setLoading(false); sub.close()
      }
    })
    setTimeout(() => { sub.close(); setLoading(false) }, 8000)
    return () => sub.close()
  }, [])

  const saveAdmins = async (list) => { setAdmins(list); localStorage.setItem('bitsavers_admins', JSON.stringify(list)); await publishAdminList(list) }

  const addAdmin = async () => {
    const npub = newNpub.trim()
    if (!npub.startsWith('npub1')) { setMsg('err: Must be a valid npub1... key'); return }
    if (admins.includes(npub)) { setMsg('err: Already an admin'); return }
    await saveAdmins([...admins, npub]); setNewNpub(''); setNewLabel('')
    setMsg('ok: Admin added and published to Nostr!'); setTimeout(() => setMsg(''), 3000)
  }

  const removeAdmin = async (npub) => {
    if (npub === ADMIN_NPUBS[0]) { setMsg('err: Cannot remove super admin'); setTimeout(() => setMsg(''), 2000); return }
    await saveAdmins(admins.filter(a => a !== npub)); setMsg('ok: Admin removed'); setTimeout(() => setMsg(''), 2000)
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
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>
          {loading ? <span style={{display:'flex',alignItems:'center',gap:8}}><Loader size={14} style={{animation:'spin 1s linear infinite',color:C.accent}}/>Syncing admins from Nostr…</span> : `Current Admins (${admins.length})`}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        {admins.map((npub) => {
          const hexKey = (() => { try { return nip19.decode(npub).data } catch { return null } })()
          const prof = hexKey ? (adminProfiles[hexKey] || {}) : {}
          const name = prof.name || prof.display_name || (npub.slice(0,10) + '…')
          const isSuper = npub === ADMIN_NPUBS[0]
          return (
            <div key={npub} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#000', flexShrink: 0, overflow: 'hidden', border: `2px solid ${isSuper ? C.accent : 'rgba(247,147,26,0.3)'}` }}>
                {prof.picture ? <img src={prof.picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} /> : name.slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {name}{isSuper && <span style={{ fontSize: 10, background: 'rgba(247,147,26,0.15)', color: C.accent, padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>SUPER</span>}
                </div>
                <div style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{npub}</div>
              </div>
              {!isSuper && <Btn onClick={() => removeAdmin(npub)} variant="danger" style={{ padding: '6px 12px', fontSize: 12, flexShrink: 0 }}>Remove</Btn>}
            </div>
          )
        })}
      </Card>
    </div>
  )
}

// ─── Publish News ─────────────────────────────────────────────────────────────
const publishAnnouncementDelete = async (id) => {
  const storedNsec = localStorage.getItem('bitsavers_nsec')
  if (!storedNsec) return
  try {
    const skBytes = nsecToBytes(storedNsec)
    const pool = getPool()
    const event = finalizeEvent({ kind: 1, created_at: Math.floor(Date.now() / 1000), tags: [['t', 'bitsavers'], ['t', 'bitsavers-announcement']], content: 'ANNOUNCEMENT_DELETE:' + JSON.stringify({ id }) }, skBytes)
    await Promise.any(pool.publish(RELAYS, event))
  } catch(e) { console.error('Failed to publish announcement delete:', e) }
}

function PublishNews({ user }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [msg, setMsg] = useState('')
  const [list, setList] = useState(() => {
    try {
      const deleted = JSON.parse(localStorage.getItem('bitsavers_deleted_announcements') || '[]')
      const cached  = JSON.parse(localStorage.getItem('bitsavers_announcements') || '[]')
      return cached.filter(n => !deleted.includes(n.id))
    } catch { return [] }
  })
  const [loadingList, setLoadingList] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bitsavers_announcements') || '[]').length === 0 } catch { return true }
  })

  useEffect(() => {
    const seen = new Set()
    const closers = []
    const openWS = (relayUrl) => {
      let ws, closed = false
      const subId = 'adm-ann-' + Math.random().toString(36).slice(2, 8)
      const connect = () => {
        ws = new WebSocket(relayUrl)
        ws.onopen = () => ws.send(JSON.stringify(['REQ', subId, { kinds: [1], '#t': ['bitsavers-announcement'], since: Math.floor(Date.now() / 1000) - 90 * 86400, limit: 100 }]))
        ws.onmessage = ({ data }) => {
          try {
            const msg = JSON.parse(data)
            if (msg[0] === 'EVENT') {
              const e = msg[2]
              if (seen.has(e.id)) return
              seen.add(e.id)
              if (e.content.startsWith('ANNOUNCEMENT_DELETE:')) {
                try {
                  const { id } = JSON.parse(e.content.slice('ANNOUNCEMENT_DELETE:'.length))
                  const del = JSON.parse(localStorage.getItem('bitsavers_deleted_announcements') || '[]')
                  if (!del.includes(id)) localStorage.setItem('bitsavers_deleted_announcements', JSON.stringify([...del, id]))
                  setList(prev => prev.filter(n => n.id !== id))
                } catch {}
                return
              }
              if (!e.content.startsWith('ANNOUNCEMENT:')) return
              try {
                const d = JSON.parse(e.content.slice('ANNOUNCEMENT:'.length))
                const deleted = JSON.parse(localStorage.getItem('bitsavers_deleted_announcements') || '[]')
                if (deleted.includes(d.id)) return
                const cached = JSON.parse(localStorage.getItem('bitsavers_announcements') || '[]')
                if (!cached.find(n => n.id === d.id)) localStorage.setItem('bitsavers_announcements', JSON.stringify([d, ...cached].slice(0, 50)))
                setList(prev => { if (prev.find(n => n.id === d.id)) return prev; return [d, ...prev].sort((a, b) => b.publishedAt - a.publishedAt) })
                setLoadingList(false)
              } catch {}
            }
            if (msg[0] === 'EOSE') setLoadingList(false)
          } catch {}
        }
        ws.onclose = () => { if (!closed) setTimeout(connect, 3000) }
      }
      connect()
      closers.push(() => { closed = true; ws?.close() })
    }
    RELAYS.forEach(openWS)
    setTimeout(() => setLoadingList(false), 8000)
    return () => closers.forEach(c => c())
  }, [])

  const publish = async () => {
    if (!title.trim() || !body.trim()) { setMsg('err: Title and content required'); return }
    setPublishing(true); setMsg('')
    try {
      const storedNsec = localStorage.getItem('bitsavers_nsec')
      if (!storedNsec) throw new Error('No private key found')
      const skBytes = nsecToBytes(storedNsec)
      const pool = getPool()
      const id = Date.now().toString()
      const publishedAt = Math.floor(Date.now() / 1000)
      const announcement = { id, title: title.trim(), body: body.trim(), imageUrl, publishedAt }
      const event = finalizeEvent({ kind: 1, created_at: publishedAt, tags: [['t', 'bitsavers'], ['t', 'bitsavers-announcement']], content: 'ANNOUNCEMENT:' + JSON.stringify(announcement) }, skBytes)
      await Promise.any(pool.publish(RELAYS, event))
      const cached = JSON.parse(localStorage.getItem('bitsavers_announcements') || '[]')
      localStorage.setItem('bitsavers_announcements', JSON.stringify([announcement, ...cached].slice(0, 50)))
      setList(prev => [announcement, ...prev])
      setTitle(''); setBody(''); setImageUrl('')
      setMsg('ok: Announcement published to Nostr!')
    } catch (e) { setMsg('err: ' + (e.message || 'Failed to publish')) }
    setPublishing(false)
    setTimeout(() => setMsg(''), 3000)
  }

  const deleteAnnouncement = async (id) => {
    const del = JSON.parse(localStorage.getItem('bitsavers_deleted_announcements') || '[]')
    if (!del.includes(id)) localStorage.setItem('bitsavers_deleted_announcements', JSON.stringify([...del, id]))
    const cached = JSON.parse(localStorage.getItem('bitsavers_announcements') || '[]')
    localStorage.setItem('bitsavers_announcements', JSON.stringify(cached.filter(n => n.id !== id)))
    setList(prev => prev.filter(n => n.id !== id))
    await publishAnnouncementDelete(id)
  }

  return (
    <div>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Megaphone size={16} color={C.accent} /> Publish Announcement</div>
        <Input label="Title" value={title} onChange={setTitle} placeholder="e.g. New Course: Lightning Network 101" />
        <Textarea label="Content" value={body} onChange={setBody} placeholder="Write your announcement here…" rows={5} />
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 10 }}>Cover Image (optional)</label>
          <ImageUpload currentUrl={imageUrl} onUploaded={setImageUrl} size={70} />
        </div>
        <StatusMsg msg={msg} />
        <Btn onClick={publish} disabled={publishing || !title.trim() || !body.trim()}>{publishing ? 'Publishing…' : 'Publish Announcement'}</Btn>
      </Card>
      {(loadingList || list.length > 0) && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            {loadingList ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite', color: C.accent }} /> Loading from Nostr…</> : `Published Announcements (${list.length})`}
          </div>
          {list.map(item => (
            <div key={item.id} style={{ padding: '14px 0', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{item.body?.slice(0, 100)}…</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6, fontFamily: 'monospace' }}>{new Date(item.publishedAt * 1000).toLocaleDateString()}</div>
                </div>
                <Btn onClick={() => deleteAnnouncement(item.id)} variant="danger" style={{ padding: '6px 12px', fontSize: 12, flexShrink: 0 }}>Delete</Btn>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

// ─── Admin Cohorts ────────────────────────────────────────────────────────────
function AdminCohorts() {
  const getCached  = () => { try { return JSON.parse(localStorage.getItem('bitsavers_cohorts') || '{}') } catch { return {} } }
  const getDeleted = () => { try { return JSON.parse(localStorage.getItem('bitsavers_deleted_cohorts') || '[]') } catch { return [] } }

  const [form, setForm]       = useState({ name: '', code: '' })
  const [msg, setMsg]         = useState('')
  const [creating, setCreating] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [joins, setJoins]     = useState({})
  const [loadingNostr, setLoadingNostr] = useState(true)

  // ── Instant load from localStorage ────────────────────────────────────────
  const [cohorts, setCohorts] = useState(() => {
    const cached  = getCached()
    const deleted = getDeleted()
    return Object.values(cached).filter(c => !deleted.includes(c.code))
  })

  // ── Sync from Nostr in background ─────────────────────────────────────────
  useEffect(() => {
    const cohortsMap = (() => {
      const cached  = getCached()
      const deleted = getDeleted()
      return Object.fromEntries(Object.entries(cached).filter(([code]) => !deleted.includes(code)))
    })()
    const joinsMap   = {}
    const deletedSet = new Set(getDeleted())
    const seen       = new Set()
    const closers    = []

    const flush = () => {
      setCohorts(Object.values(cohortsMap))
      setJoins({ ...joinsMap })
      setLoadingNostr(false)
    }

    const processEvent = (e) => {
      if (seen.has(e.id)) return
      seen.add(e.id)
      const t = e.content

      if (t.startsWith('COHORT_CREATE:')) {
        try {
          const d = JSON.parse(t.slice('COHORT_CREATE:'.length))
          if (d.code && d.name && !deletedSet.has(d.code)) {
            const existing = cohortsMap[d.code]
            if (!existing || e.created_at > (existing._ts || 0)) {
              cohortsMap[d.code] = { ...d, _ts: e.created_at }
              const stored = getCached(); stored[d.code] = { ...d, _ts: e.created_at }
              localStorage.setItem('bitsavers_cohorts', JSON.stringify(stored))
            }
          }
        } catch {}

      } else if (t.startsWith('COHORT_DELETE:')) {
        const code = t.slice('COHORT_DELETE:'.length).trim()
        deletedSet.add(code)
        delete cohortsMap[code]; delete joinsMap[code]
        const stored = getCached(); delete stored[code]
        localStorage.setItem('bitsavers_cohorts', JSON.stringify(stored))
        const del = getDeleted()
        if (!del.includes(code)) localStorage.setItem('bitsavers_deleted_cohorts', JSON.stringify([...del, code]))

      } else {
        const m = t.match(/^(joined|left)-([A-Z0-9]+)-([^ |]+)[| ](.+)$/)
        if (m) {
          const [, action, code, npub, name] = m
          if (!joinsMap[code]) joinsMap[code] = {}
          const ex = joinsMap[code][npub]
          if (!ex || e.created_at > ex.ts)
            joinsMap[code][npub] = { npub, name: name.trim(), action, ts: e.created_at }
        }
      }
    }

    const openWS = (url, filter) => {
      let ws, closed = false
      const subId = 'ac-' + Math.random().toString(36).slice(2, 8)
      const go = () => {
        if (closed) return
        ws = new WebSocket(url)
        ws.onopen = () => ws.send(JSON.stringify(['REQ', subId, filter]))
        ws.onmessage = ({ data }) => {
          try {
            const msg = JSON.parse(data)
            if (msg[0] === 'EVENT' && msg[1] === subId) { processEvent(msg[2]); flush() }
            if (msg[0] === 'EOSE') flush()
          } catch {}
        }
        ws.onclose = () => { if (!closed) setTimeout(go, 3000) }
      }
      go()
      closers.push(() => { closed = true; ws?.close() })
    }

    RELAYS.forEach(r => openWS(r, { kinds: [1], '#t': ['bitsavers-cohorts'], limit: 500 }))
    RELAYS.forEach(r => openWS(r, { kinds: [1], '#t': ['bitsavers-cohort'],  limit: 500 }))
    setTimeout(() => setLoadingNostr(false), 8000)
    return () => closers.forEach(c => c())
  }, [])

  const publishCohort = async (content, tags) => {
    const nsec = localStorage.getItem('bitsavers_nsec')
    if (!nsec) return
    const pool = getPool()
    const ev = finalizeEvent({ kind: 1, created_at: Math.floor(Date.now() / 1000), tags, content }, nsecToBytes(nsec))
    await Promise.any(pool.publish(RELAYS, ev))
  }

  const create = async () => {
    if (!form.name.trim() || !form.code.trim()) { setMsg('err: Name and code required'); return }
    const code = form.code.trim().toUpperCase()
    if (cohorts.find(c => c.code === code)) { setMsg('err: Code already exists'); return }
    setCreating(true)
    const cohort = { id: Date.now().toString(), name: form.name.trim(), code, createdAt: Date.now() }
    // Write to localStorage immediately
    const stored = getCached(); stored[code] = { ...cohort, _ts: Math.floor(Date.now() / 1000) }
    localStorage.setItem('bitsavers_cohorts', JSON.stringify(stored))
    setCohorts(prev => [...prev, cohort])
    await publishCohort('COHORT_CREATE:' + JSON.stringify(cohort), [['t', 'bitsavers-cohorts']])
    setForm({ name: '', code: '' }); setMsg('ok: Cohort created!'); setCreating(false)
    setTimeout(() => setMsg(''), 3000)
  }

  const remove = async (code) => {
    // Remove from localStorage immediately
    const stored = getCached(); delete stored[code]
    localStorage.setItem('bitsavers_cohorts', JSON.stringify(stored))
    const del = getDeleted()
    if (!del.includes(code)) localStorage.setItem('bitsavers_deleted_cohorts', JSON.stringify([...del, code]))
    setCohorts(prev => prev.filter(c => c.code !== code))
    if (expanded === code) setExpanded(null)
    await publishCohort('COHORT_DELETE:' + code, [['t', 'bitsavers-cohorts']])
  }

  const memberCount = (code) => Object.values(joins[code] || {}).filter(m => m.action === 'joined').length
  const getMembers  = (code) => Object.values(joins[code] || {}).filter(m => m.action === 'joined')
  const allAssessments = (() => { try { return JSON.parse(localStorage.getItem('bitsavers_assessments') || '[]') } catch { return [] } })()
  const results        = (() => { try { return JSON.parse(localStorage.getItem('bitsavers_results')      || '[]') } catch { return [] } })()

  return (
    <div>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={16} color={C.accent} /> Create Cohort
        </div>
        <StatusMsg msg={msg} />
        <Input label="Cohort Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Bitcoin Basics Jan 2026" />
        <Input label="Cohort Code" value={form.code} onChange={v => setForm(f => ({ ...f, code: v.toUpperCase() }))} placeholder="e.g. BTC001" />
        <Btn onClick={create} disabled={creating || !form.name.trim() || !form.code.trim()}>
          {creating ? 'Publishing…' : '+ Create Cohort'}
        </Btn>
      </Card>

      {loadingNostr && cohorts.length === 0 && (
        <div style={{ textAlign: 'center', padding: 30, color: C.muted, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Loader size={15} style={{ animation: 'spin 1s linear infinite', color: C.accent }} /> Syncing from Nostr…
        </div>
      )}
      {!loadingNostr && cohorts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 14 }}>No cohorts yet. Create one above.</div>
      )}

      {cohorts.map(cohort => {
        const isOpen     = expanded === cohort.code
        const members    = getMembers(cohort.code)
        const count      = memberCount(cohort.code)
        const assignments = allAssessments.filter(a => a.cohortId === cohort.id)
        const submitted  = members.filter(m => results.some(r => r.npub === m.npub && assignments.some(a => a.id === r.assessmentId)))
        const pending    = members.filter(m => !results.some(r => r.npub === m.npub && assignments.some(a => a.id === r.assessmentId)))

        return (
          <div key={cohort.code} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 14, overflow: 'hidden' }}>
            <div onClick={() => setExpanded(isOpen ? null : cohort.code)}
              style={{ padding: '18px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{cohort.name}</div>
                <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: C.accent, fontFamily: 'monospace' }}>{cohort.code}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{count} students</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{assignments.length} assessments</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 7, padding: '4px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.green }}>{submitted.length}</div>
                  <div style={{ fontSize: 9, color: C.green }}>done</div>
                </div>
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: '4px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.red }}>{pending.length}</div>
                  <div style={{ fontSize: 9, color: C.red }}>pend</div>
                </div>
                {isOpen ? <ChevronUp size={15} color={C.muted} /> : <ChevronDown size={15} color={C.muted} />}
              </div>
            </div>

            {isOpen && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: 20 }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Assessments ({assignments.length})</div>
                  {assignments.length === 0
                    ? <div style={{ fontSize: 13, color: C.muted, background: C.dim, borderRadius: 9, padding: '10px 14px' }}>None yet — go to Assignments tab to add.</div>
                    : assignments.map(a => (
                        <div key={a.id} style={{ background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 14px', marginBottom: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{a.title}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{results.filter(r => r.assessmentId === a.id).length}/{count} submitted</div>
                        </div>
                      ))
                  }
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Students ({count})</div>
                  {count === 0
                    ? <div style={{ fontSize: 13, color: C.muted }}>None yet. Share code: <span style={{ color: C.accent, fontFamily: 'monospace' }}>{cohort.code}</span></div>
                    : members.map(m => (
                        <div key={m.npub} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#000', flexShrink: 0 }}>
                            {(m.name || '?').slice(0,2).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{m.name || 'Anonymous'}</div>
                            <div style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.npub?.slice(0,24)}…</div>
                          </div>
                          <div style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>
                            {results.filter(r => r.npub === m.npub && assignments.some(a => a.id === r.assessmentId)).length}/{assignments.length}
                          </div>
                        </div>
                      ))
                  }
                </div>
                <Btn onClick={() => remove(cohort.code)} variant="danger">Delete Cohort</Btn>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Events ───────────────────────────────────────────────────────────────────
const publishEventToNostr = async (eventData) => {
  const storedNsec = localStorage.getItem('bitsavers_nsec')
  if (!storedNsec) return false
  try {
    const skBytes = nsecToBytes(storedNsec)
    const pool = getPool()
    const lines = ['📅 ' + eventData.title, eventData.date + (eventData.time ? ' at ' + eventData.time : ''), eventData.instructor ? 'Instructor: ' + eventData.instructor : '', eventData.location ? '📍 ' + eventData.location : '', eventData.description || '', eventData.link ? 'Join: ' + eventData.link : '', 'DATA:' + JSON.stringify(eventData)].filter(Boolean)
    const ev = finalizeEvent({ kind: 1, created_at: Math.floor(Date.now() / 1000), tags: [['t', 'bitsavers'], ['t', 'bitsavers-event'], ['subject', eventData.title]], content: lines.join('\n') }, skBytes)
    await Promise.any(pool.publish(RELAYS, ev))
    const updated = JSON.parse(localStorage.getItem('bitsavers_events') || '[]')
    const idx = updated.findIndex(e => e.id === eventData.id)
    if (idx >= 0) { updated[idx].nostrId = ev.id; localStorage.setItem('bitsavers_events', JSON.stringify(updated)) }
    return true
  } catch(e) { console.error('publishEventToNostr failed:', e); return false }
}

const publishEventDelete = async (eventId) => {
  const storedNsec = localStorage.getItem('bitsavers_nsec')
  if (!storedNsec) return
  try {
    const skBytes = nsecToBytes(storedNsec)
    const pool = getPool()
    const event = finalizeEvent({ kind: 1, created_at: Math.floor(Date.now() / 1000), tags: [['t', 'bitsavers'], ['t', 'bitsavers-event']], content: 'EVENT_DELETE:' + JSON.stringify({ id: eventId }) }, skBytes)
    await Promise.any(pool.publish(RELAYS, event))
  } catch(e) { console.error('Failed to publish event delete:', e) }
}

const BLANK_EVENT_FORM = { title: '', instructor: '', date: '', time: '', location: '', description: '', link: '', imageUrl: '' }

function ManageEvents({ user }) {
  const [events, setEvents] = useState(() => { const s = localStorage.getItem('bitsavers_events'); return s ? JSON.parse(s) : [] })
  const [form, setForm]     = useState(BLANK_EVENT_FORM)
  const [editingId, setEditingId] = useState(null)
  const [msg, setMsg]       = useState('')
  const [publishing, setPublishing] = useState(false)
  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const saveEvent = async () => {
    if (!form.title.trim() || !form.date) { setMsg('err: Title and date required'); return }
    setPublishing(true); setMsg('Publishing to Nostr…')
    if (editingId) {
      const updated = events.map(e => e.id === editingId ? { ...e, ...form } : e)
      setEvents(updated); localStorage.setItem('bitsavers_events', JSON.stringify(updated))
      const ok = await publishEventToNostr({ ...events.find(e => e.id === editingId), ...form })
      setMsg(ok ? 'ok: Event updated!' : 'ok: Saved locally'); setEditingId(null)
    } else {
      const newEvent = { id: Date.now().toString(), ...form, createdAt: Date.now() }
      const updated = [newEvent, ...events]
      setEvents(updated); localStorage.setItem('bitsavers_events', JSON.stringify(updated))
      const ok = await publishEventToNostr(newEvent)
      setMsg(ok ? 'ok: Event published!' : 'ok: Saved locally')
    }
    setForm(BLANK_EVENT_FORM); setPublishing(false); setTimeout(() => setMsg(''), 3000)
  }

  const startEdit = (event) => { setEditingId(event.id); setForm({ title: event.title || '', instructor: event.instructor || '', date: event.date || '', time: event.time || '', description: event.description || '', link: event.link || '', location: event.location || '', imageUrl: event.imageUrl || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const cancelEdit = () => { setEditingId(null); setForm(BLANK_EVENT_FORM); setMsg('') }

  const deleteEvent = async (id) => {
    const updated = events.filter(e => e.id !== id)
    setEvents(updated); localStorage.setItem('bitsavers_events', JSON.stringify(updated))
    const deleted = JSON.parse(localStorage.getItem('bitsavers_deleted_events') || '[]')
    if (!deleted.includes(id)) localStorage.setItem('bitsavers_deleted_events', JSON.stringify([...deleted, id]))
    await publishEventDelete(id)
    if (editingId === id) cancelEdit()
  }

  return (
    <div>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Calendar size={16} color={C.accent} />{editingId ? 'Edit Event' : 'Add New Event'}</div>
        <Input label="Event Title" icon={<Hash size={11}/>} value={form.title} onChange={v => set('title', v)} placeholder="e.g. Bitcoin Wallets Masterclass" />
        <Input label="Instructor" icon={<User size={11}/>} value={form.instructor} onChange={v => set('instructor', v)} placeholder="e.g. Alex Wambui" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Date" icon={<Calendar size={11}/>} value={form.date} onChange={v => set('date', v)} type="date" />
          <Input label="Time" icon={<Clock size={11}/>} value={form.time} onChange={v => set('time', v)} type="time" />
        </div>
        <Input label="Venue / Location" icon={<MapPin size={11}/>} value={form.location} onChange={v => set('location', v)} placeholder="e.g. Nairobi Hub, Room 3" />
        <Textarea label="Description" value={form.description} onChange={v => set('description', v)} placeholder="What will be covered?" rows={3} />
        <Input label="Join Link (optional)" icon={<Link2 size={11}/>} value={form.link} onChange={v => set('link', v)} placeholder="https://meet.jit.si/..." />
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}><span style={{display:'flex',alignItems:'center',color:C.accent}}><Image size={11}/></span>Cover Image (optional)</label>
          <ImageUpload currentUrl={form.imageUrl} onUploaded={url => set('imageUrl', url)} size={70} />
        </div>
        <StatusMsg msg={msg} />
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={saveEvent} disabled={!form.title.trim() || !form.date || publishing} style={{ flex: 1 }}>
            {publishing ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite', marginRight: 6 }} />Publishing…</> : editingId ? 'Save Changes' : '+ Add Event'}
          </Btn>
          {editingId && <Btn onClick={cancelEdit} variant="danger">Cancel</Btn>}
        </div>
      </Card>
      {events.length > 0 && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Events ({events.length})</div>
          {events.sort((a, b) => new Date(a.date) - new Date(b.date)).map(event => (
            <div key={event.id} style={{ padding: '14px 0', borderBottom: `1px solid ${C.border}` }}>
              {event.imageUrl && <img src={event.imageUrl} alt={event.title} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 10, border: `1px solid ${C.border}` }} />}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ background: C.dim, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, color: C.accent, fontWeight: 700, fontFamily: 'monospace', display: 'inline-block', marginBottom: 6 }}>{event.date}{event.time && ` · ${event.time}`}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>{event.title}</div>
                  {event.instructor && <div style={{ fontSize: 12, color: C.muted }}>Instructor: {event.instructor}</div>}
                  {event.description && <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{event.description.slice(0, 80)}{event.description.length > 80 ? '…' : ''}</div>}
                  {event.link && <a href={event.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.accent, marginTop: 4, display: 'block' }}>Join Link →</a>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <Btn onClick={() => startEdit(event)} style={{ padding: '6px 14px', fontSize: 12 }}>Edit</Btn>
                  <Btn onClick={() => deleteEvent(event.id)} variant="danger" style={{ padding: '6px 14px', fontSize: 12 }}>Delete</Btn>
                </div>
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
  const [images, setImages] = useState(() => { const s = localStorage.getItem('bitsavers_media'); return s ? JSON.parse(s) : [] })
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
      const formData = new FormData(); formData.append('image', file)
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${import.meta.env.VITE_IMGBB_KEY}`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      const json = await res.json()
      const url = json?.data?.display_url
      if (!url) throw new Error('No URL returned')
      const newImg = { id: Date.now().toString(), url, name: file.name, uploadedAt: Date.now() }
      const updated = [newImg, ...images]; setImages(updated); localStorage.setItem('bitsavers_media', JSON.stringify(updated))
      setMsg('ok: Image uploaded!')
    } catch (err) { setMsg('err: ' + (err.message || 'Upload failed')) }
    setUploading(false); e.target.value = ''
  }

  const copyUrl = async (url, id) => { try { await navigator.clipboard.writeText(url); setCopied(id); setTimeout(() => setCopied(''), 2000) } catch { alert('Copy failed') } }
  const deleteImage = (id) => { const updated = images.filter(i => i.id !== id); setImages(updated); localStorage.setItem('bitsavers_media', JSON.stringify(updated)) }

  return (
    <div>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Upload Image</div>
        <StatusMsg msg={msg} />
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: `2px dashed ${C.border}`, borderRadius: 12, padding: '24px', cursor: uploading ? 'not-allowed' : 'pointer', color: C.muted, fontSize: 14, background: C.dim }}>
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
                      {copied === img.id ? <span style={{color:C.green}}>Copied</span> : <><Copy size={11}/> Copy</>}
                    </button>
                    <button onClick={() => deleteImage(img.id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: C.red, padding: '5px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}><Trash2 size={12}/></button>
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
export default function AdminPanel({ user }) {
  const [section, setSection] = useState('admins')

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
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          {isSuperAdmin(user.npub) ? <Crown size={20} color='#080808' /> : <Shield size={20} color='#080808' />}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>Admin Panel</div>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: 'monospace' }}>{isSuperAdmin(user.npub) ? 'Super Admin' : 'Admin'} · {user.npub.slice(0, 12)}…</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 20 }}>
        {SECTIONS.map(s => {
          const icons = { admins: <Users size={14}/>, news: <Newspaper size={14}/>, events: <Calendar size={14}/>, cohorts: <Users size={14}/>, media: <BookOpen size={14}/>, assignments: <ClipboardList size={14}/>, submissions: <Inbox size={14}/>, pow: <Hammer size={14}/>, gallery: <Image size={14}/>, liveclasses: <Video size={14}/>, following: <Users size={14}/>, courses: <BookOpen size={14}/>, rsvp: <Ticket size={14}/>, groups: <Users size={14}/>, 'grp-members': <Users size={14}/>, 'grp-requests': <Shield size={14}/>, socials: <Share2 size={14}/>, certificates: <Award size={14}/> }
          return (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              background: section === s.id ? C.accent : C.card,
              border: `1px solid ${section === s.id ? C.accent : C.border}`,
              color: section === s.id ? C.bg : C.muted,
              padding: '10px 6px', borderRadius: 10, fontWeight: 700,
              fontSize: 11, cursor: 'pointer', textAlign: 'center', lineHeight: 1.4,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              {icons[s.id]}{s.label}
            </button>
          )
        })}
      </div>

      {section === 'admins'      && <ManageAdmins user={user} />}
      {section === 'news'        && <PublishNews user={user} />}
      {section === 'events'      && <ManageEvents user={user} />}
      {section === 'cohorts'     && <AdminCohorts />}
      {section === 'media'       && <AdminBlog />}
      {section === 'assignments' && <AdminAssignments />}
      {section === 'submissions' && <AdminSubmissions />}
      {section === 'pow'         && <AdminPoW />}
      {section === 'gallery'     && <AdminGallery />}
      {section === 'liveclasses' && <AdminLiveClasses />}
      {section === 'following'   && <AdminFollowing />}
      {section === 'certificates'&& <AdminCertificates />}
      {section === 'courses'     && <AdminCourses />}
      {section === 'rsvp'        && <AdminRsvp />}
      {section === 'groups'      && <AdminGroups />}
      {section === 'grp-members' && <AdminGroupMembers />}
      {section === 'grp-requests'&& <AdminGroupRequests />}
      {section === 'socials'     && <AdminSocials />}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

