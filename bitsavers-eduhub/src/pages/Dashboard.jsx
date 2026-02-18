import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { Menu, X, BookOpen, Users, Newspaper, User, LogOut, Zap, Send, RefreshCw, Loader, CheckCircle, AlertCircle, Hash, Globe } from 'lucide-react'
import { SimplePool } from 'nostr-tools/pool'
import { publishProfile, fetchProfile } from '../lib/nostr'
import ImageUpload from '../components/ImageUpload'
import { finalizeEvent } from 'nostr-tools/pure'
import { nip19 } from 'nostr-tools'

// ─── Constants ────────────────────────────────────────────────────────────────
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
]

const C = {
  bg:       '#080808',
  surface:  '#0f0f0f',
  card:     '#141414',
  border:   'rgba(247,147,26,0.18)',
  accent:   '#F7931A',
  dim:      'rgba(247,147,26,0.12)',
  text:     '#F0EBE0',
  muted:    '#666',
  green:    '#22c55e',
  red:      '#ef4444',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const shortKey = (npub) => npub ? `${npub.slice(0,10)}…${npub.slice(-4)}` : ''

const timeAgo = (ts) => {
  const s = Math.floor(Date.now() / 1000) - ts
  if (s < 60)   return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// nsec1... bech32 → raw Uint8Array private key bytes
const nsecToBytes = (nsec) => {
  const { type, data } = nip19.decode(nsec.trim())
  if (type !== 'nsec') throw new Error('Not an nsec key')
  return data // already Uint8Array
}

// ─── Shared pool singleton ────────────────────────────────────────────────────
let _pool = null
const getPool = () => {
  if (!_pool) _pool = new SimplePool()
  return _pool
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ profile = {}, pubkey = '', size = 40 }) {
  const [imgErr, setImgErr] = useState(false)
  const initials = (profile.name || pubkey || '?').slice(0, 2).toUpperCase()

  if (profile.picture && !imgErr) {
    return (
      <img
        src={profile.picture} alt={initials}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${C.border}`, flexShrink: 0 }}
        onError={() => setImgErr(true)}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #F7931A, #b8690f)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: C.bg,
      border: `1.5px solid ${C.border}`,
    }}>{initials}</div>
  )
}

// ─── Post card ────────────────────────────────────────────────────────────────
function PostCard({ event, profiles }) {
  const profile = profiles[event.pubkey] || {}
  const npub = (() => { try { return nip19.npubEncode(event.pubkey) } catch { return '' } })()
  const name = profile.name || profile.display_name || shortKey(npub)

  // Render text with clickable URLs
  const renderContent = (text) => {
    const parts = text.split(/(https?:\/\/[^\s]+)/g)
    return parts.map((p, i) =>
      p.match(/^https?:\/\//)
        ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{ color: C.accent, wordBreak: 'break-all' }}>{p}</a>
        : <span key={i}>{p}</span>
    )
  }

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: 16, marginBottom: 10,
    }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <Avatar profile={profile} pubkey={event.pubkey} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{name}</span>
            {profile.nip05 && (
              <span style={{ fontSize: 11, color: C.accent, display: 'flex', alignItems: 'center', gap: 3 }}>
                <CheckCircle size={11} /> {profile.nip05}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace', marginTop: 2 }}>
            {shortKey(npub)} · {timeAgo(event.created_at)}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 15, color: C.text, lineHeight: 1.65, wordBreak: 'break-word' }}>
        {renderContent(event.content || '')}
      </div>
    </div>
  )
}

// ─── Compose modal ────────────────────────────────────────────────────────────
function ComposeModal({ user, profiles, onClose, onPublished }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('idle') // idle | busy | ok | err
  const [errMsg, setErrMsg] = useState('')
  const taRef = useRef()
  useEffect(() => taRef.current?.focus(), [])

  const publish = async () => {
    if (!text.trim() || status === 'busy') return
    setStatus('busy')
    try {
      const storedNsec = localStorage.getItem('bitsavers_nsec')
      if (!storedNsec) throw new Error('No private key found — please log out and log in again.')

      const skBytes = nsecToBytes(storedNsec)
      const eventTemplate = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'bitsavers'], ['t', 'bitcoin']],
        content: text.trim(),
      }
      const signed = finalizeEvent(eventTemplate, skBytes)
      const pool = getPool()
      // publish to all relays — returns array of promises
      await Promise.any(pool.publish(RELAYS, signed))
      // Mark as seen immediately so the live subscription doesn't show it as "new post"
      feedCache.bitsavers.seenIds.add(signed.id)
      feedCache.bitcoin.seenIds.add(signed.id)
      setStatus('ok')
      setTimeout(() => { onPublished(signed); onClose() }, 800)
    } catch (e) {
      setErrMsg(e.message || 'Publish failed')
      setStatus('err')
    }
  }

  const profile = profiles[user?.pubkey] || {}

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 640, padding: '20px 20px 36px', animation: 'slideUp .25s ease' }}>
        <div style={{ width: 36, height: 4, background: C.border, borderRadius: 2, margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', gap: 12 }}>
          <Avatar profile={profile} pubkey={user?.pubkey} size={44} />
          <div style={{ flex: 1 }}>
            <textarea
              ref={taRef} value={text} onChange={e => setText(e.target.value)}
              placeholder="What's happening in Bitcoin? Share with the community…"
              maxLength={280} rows={4}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: C.text, fontSize: 16, lineHeight: 1.6, resize: 'none', fontFamily: 'inherit' }}
            />
            <div style={{ fontSize: 12, color: C.muted }}>Posts with <span style={{ color: C.accent }}>#bitsavers #bitcoin</span></div>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 14, paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: text.length > 250 ? C.red : C.muted, fontFamily: 'monospace' }}>{280 - text.length}</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {status === 'err' && <span style={{ fontSize: 12, color: C.red, display: 'flex', gap: 4 }}><AlertCircle size={13} />{errMsg}</span>}
            {status === 'ok'  && <span style={{ fontSize: 12, color: C.green, display: 'flex', gap: 4 }}><CheckCircle size={13} />Published!</span>}
            <button onClick={onClose} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.muted, padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
            <button onClick={publish} disabled={!text.trim() || status === 'busy' || status === 'ok'} style={{
              background: text.trim() ? C.accent : 'rgba(247,147,26,0.3)', border: 'none',
              color: text.trim() ? C.bg : C.muted,
              padding: '10px 22px', borderRadius: 10, fontWeight: 800, fontSize: 14,
              cursor: text.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {status === 'busy' ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />Publishing…</> : <><Send size={14} />Publish</>}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ─── Live feed ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'bitsavers', label: '#bitsavers', icon: <Hash size={13} /> },
  { id: 'bitcoin',   label: 'Bitcoin',    icon: <Globe size={13} /> },
]

// ── Per-tab cache lives OUTSIDE the component so it survives tab switches ──
// This is the fix for mobile empty feed on tab switch
const feedCache = {
  bitsavers: { posts: [], profiles: {}, seenIds: new Set() },
  bitcoin:   { posts: [], profiles: {}, seenIds: new Set() },
}

function NostrFeed({ user }) {
  const [tab, setTab] = useState('bitsavers')
  const [posts, setPosts] = useState(feedCache.bitsavers.posts)
  const [profiles, setProfiles] = useState(feedCache.bitsavers.profiles)
  const [loading, setLoading] = useState(feedCache.bitsavers.posts.length === 0)
  const [newPosts, setNewPosts] = useState([])
  const [showCompose, setShowCompose] = useState(false)
  const subRef = useRef(null)
  const isInitial = useRef(feedCache.bitsavers.posts.length === 0)

  // Switch tab — load from cache instantly, no spinner if we have data
  const switchTab = (newTab) => {
    if (newTab === tab) return
    // Save current new posts into cache before switching
    setNewPosts([])
    setTab(newTab)
    const cached = feedCache[newTab]
    setPosts(cached.posts)
    setProfiles(cached.profiles)
    setLoading(cached.posts.length === 0) // only show loader if no cache
    isInitial.current = cached.posts.length === 0
  }

  const fetchProfiles = (pubkeys) => {
    const missing = pubkeys.filter(pk => !feedCache[tab]?.profiles[pk])
    if (!missing.length) return
    const pool = getPool()
    const sub = pool.subscribe(
      RELAYS,
      { kinds: [0], authors: missing, limit: missing.length },
      {
        onevent(e) {
          try {
            const p = JSON.parse(e.content)
            if (feedCache[tab]) feedCache[tab].profiles[e.pubkey] = p
            setProfiles(prev => ({ ...prev, [e.pubkey]: p }))
          } catch {}
        },
        oneose() { sub.close() },
      }
    )
  }

  useEffect(() => {
    const pool = getPool()
    const since = Math.floor(Date.now() / 1000) - 86400
    const filter = tab === 'bitsavers'
      ? { kinds: [1], '#t': ['bitsavers'], since, limit: 50 }
      : { kinds: [1], '#t': ['bitcoin'], since, limit: 50 }

    let batchTimer
    const batch = []
    const cache = feedCache[tab]

    const sub = pool.subscribe(RELAYS, filter, {
      onevent(event) {
        if (cache.seenIds.has(event.id)) return
        if (!event.content?.trim()) return
        cache.seenIds.add(event.id)

        if (isInitial.current) {
          batch.push(event)
          clearTimeout(batchTimer)
          batchTimer = setTimeout(() => {
            const toAdd = batch.splice(0)
            cache.posts = [...cache.posts, ...toAdd]
              .sort((a, b) => b.created_at - a.created_at)
              .slice(0, 100) // cap at 100 per tab
            setPosts([...cache.posts])
            fetchProfiles(toAdd.map(e => e.pubkey))
          }, 300)
        } else {
          // New live post — add to cache too so it persists on tab switch
          cache.posts = [event, ...cache.posts].slice(0, 100)
          setNewPosts(prev => [event, ...prev])
        }
      },
      oneose() {
        isInitial.current = false
        setLoading(false)
        if (batch.length) {
          cache.posts = [...cache.posts, ...batch.splice(0)]
            .sort((a, b) => b.created_at - a.created_at)
            .slice(0, 100)
          setPosts([...cache.posts])
        }
        fetchProfiles(cache.posts.map(e => e.pubkey))
      },
    })

    subRef.current = sub
    const timeout = setTimeout(() => setLoading(false), 10000)

    return () => {
      clearTimeout(batchTimer)
      clearTimeout(timeout)
      sub.close()
    }
  }, [tab])

  const loadNew = () => {
    setPosts(prev => {
      const combined = [...newPosts, ...prev]
      return combined.sort((a, b) => b.created_at - a.created_at)
    })
    fetchProfiles(newPosts.map(e => e.pubkey))
    setNewPosts([])
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 4, marginBottom: 16 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => switchTab(t.id)} style={{
            flex: 1, background: tab === t.id ? C.accent : 'transparent',
            border: 'none', color: tab === t.id ? C.bg : C.muted,
            padding: '9px 8px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* New posts banner */}
      {newPosts.length > 0 && (
        <button onClick={loadNew} style={{
          width: '100%', background: C.dim, border: `1px solid ${C.accent}`,
          color: C.accent, padding: 10, borderRadius: 10, fontWeight: 700,
          fontSize: 13, cursor: 'pointer', marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <RefreshCw size={13} /> {newPosts.length} new post{newPosts.length > 1 ? 's' : ''} — tap to load
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '50px 0', color: C.muted }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
            <Loader size={18} style={{ animation: 'spin 1s linear infinite', color: C.accent }} />
            <span style={{ fontSize: 14 }}>Connecting to Nostr relays…</span>
          </div>
          <div style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{RELAYS[0]} + {RELAYS.length - 1} more</div>
        </div>
      )}

      {/* Empty */}
      {!loading && posts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 6 }}>No posts yet</div>
          <div style={{ fontSize: 13, color: C.muted }}>Be the first — tap + to post with #bitsavers!</div>
        </div>
      )}

      {/* Posts */}
      {posts.map(e => <PostCard key={e.id} event={e} profiles={profiles} />)}

      {/* Floating + button */}
      <button onClick={() => setShowCompose(true)} style={{
        position: 'fixed', bottom: 28, right: 24,
        width: 56, height: 56, borderRadius: '50%',
        background: C.accent, border: 'none', color: C.bg,
        fontSize: 28, fontWeight: 300, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 24px rgba(247,147,26,0.5)', zIndex: 80,
      }}>+</button>

      {showCompose && (
        <ComposeModal
          user={user} profiles={profiles}
          onClose={() => setShowCompose(false)}
          onPublished={(e) => { setPosts(prev => [e, ...prev]) }}
        />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ─── Profile page ─────────────────────────────────────────────────────────────
function ProfilePage({ user }) {
  const profile = user?.profile || {}
  const npub = user?.npub || ''
  const shortNpub = npub ? `${npub.slice(0,12)}…${npub.slice(-6)}` : 'No key'
  const displayName = profile.name || profile.display_name || 'Anonymous'

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile.name || profile.display_name || '')
  const [bio, setBio] = useState(profile.about || '')
  const [picture, setPicture] = useState(profile.picture || '')
  const [website, setWebsite] = useState(profile.website || '')
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [msg, setMsg] = useState('')
  const [showNsec, setShowNsec] = useState(false)
  const [nsecCopied, setNsecCopied] = useState(false)
  const [npubCopied, setNpubCopied] = useState(false)
  const storedNsec = localStorage.getItem('bitsavers_nsec') || ''

  const copyText = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'nsec') { setNsecCopied(true); setTimeout(() => setNsecCopied(false), 2000) }
      if (type === 'npub') { setNpubCopied(true); setTimeout(() => setNpubCopied(false), 2000) }
    } catch { alert('Copy failed — long press the key to copy manually') }
  }

  const save = async () => {
    if (!name.trim()) { setMsg('Display name is required'); return }
    setSaving(true); setMsg('')
    try {
      const storedNsec = localStorage.getItem('bitsavers_nsec')
      if (!storedNsec) throw new Error('No private key — log out and log in again')
      const profileData = { name: name.trim(), display_name: name.trim(), about: bio.trim(), picture: picture.trim(), website: website.trim() }
      await publishProfile(storedNsec, profileData)
      const stored = JSON.parse(localStorage.getItem('bitsavers_user') || '{}')
      localStorage.setItem('bitsavers_user', JSON.stringify({ ...stored, profile: profileData }))
      setMsg('✅ Profile saved!')
      setEditing(false)
      setTimeout(() => window.location.reload(), 900)
    } catch (e) { setMsg('❌ ' + (e.message || 'Failed')) }
    setSaving(false)
  }

  const refreshProfile = async () => {
    if (!user?.pubkey) return
    setRefreshing(true); setMsg('')
    try {
      const fresh = await fetchProfile(user.pubkey)
      const stored = JSON.parse(localStorage.getItem('bitsavers_user') || '{}')
      localStorage.setItem('bitsavers_user', JSON.stringify({ ...stored, profile: fresh }))
      setName(fresh.name || fresh.display_name || '')
      setBio(fresh.about || '')
      setPicture(fresh.picture || '')
      setWebsite(fresh.website || '')
      setMsg('✅ Refreshed from relays!')
    } catch { setMsg('❌ Could not fetch from relays') }
    setRefreshing(false)
  }

  return (
    <div style={{ maxWidth: 500, margin: '0 auto' }}>
      {/* Profile card */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, textAlign: 'center', marginBottom: 14 }}>
        {picture ? (
          <img src={picture} alt={displayName}
            style={{ width: 86, height: 86, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${C.accent}`, margin: '0 auto 14px', display: 'block', boxShadow: '0 0 24px rgba(247,147,26,0.35)' }}
            onError={e => e.target.style.display='none'} />
        ) : (
          <div style={{ width: 86, height: 86, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 800, color: C.bg, margin: '0 auto 14px', boxShadow: '0 0 24px rgba(247,147,26,0.35)' }}>
            {displayName.slice(0,2).toUpperCase()}
          </div>
        )}
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>{displayName}</div>
        {profile.about && <div style={{ fontSize: 13, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>{profile.about}</div>}
        {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.accent }}>{profile.website}</a>}
        {profile.nip05 && <div style={{ fontSize: 12, color: C.accent, marginTop: 6 }}>✅ {profile.nip05}</div>}
        <div style={{ fontSize: 11, color: C.accent, fontFamily: 'monospace', marginTop: 12 }}>{shortNpub}</div>
        <div style={{ background: C.dim, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 10, color: C.muted, fontFamily: 'monospace', wordBreak: 'break-all', marginTop: 10 }}>{npub || 'Not available'}</div>
      </div>

      {/* 🔑 Keys backup card */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          🔑 Your Nostr Keys
          <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>— back these up!</span>
        </div>

        {/* Public key */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.green, fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>PUBLIC KEY — safe to share</div>
          <div style={{ background: '#0a0a0a', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 9, padding: '10px 12px', fontSize: 10, fontFamily: 'monospace', color: '#4ade80', wordBreak: 'break-all', lineHeight: 1.6, marginBottom: 6 }}>
            {npub || 'Not available'}
          </div>
          <button onClick={() => copyText(npub, 'npub')} style={{ background: 'transparent', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {npubCopied ? '✅ Copied!' : '📋 Copy npub'}
          </button>
        </div>

        {/* Private key */}
        <div>
          <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>PRIVATE KEY — NEVER share with anyone!</div>
          <div style={{ position: 'relative', marginBottom: 6 }}>
            <div style={{ background: 'rgba(26,5,5,0.8)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 9, padding: '10px 44px 10px 12px', fontSize: 10, fontFamily: 'monospace', color: '#f87171', wordBreak: 'break-all', lineHeight: 1.6, minHeight: 42, display: 'flex', alignItems: 'center' }}>
              {showNsec ? (storedNsec || 'Not found — log out and log in again') : '••••••••••••••••••••••••••••••••••••••••••••••••'}
            </div>
            <button onClick={() => setShowNsec(!showNsec)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 18, padding: 4 }}>
              {showNsec ? '🙈' : '👁️'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => copyText(storedNsec, 'nsec')} disabled={!storedNsec} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: storedNsec ? 1 : 0.4 }}>
              {nsecCopied ? '✅ Copied!' : '📋 Copy nsec'}
            </button>
          </div>
          <div style={{ marginTop: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#f87171', lineHeight: 1.5 }}>
            ⚠️ Save your nsec in a password manager. If you lose it you lose your account forever — there is no recovery.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <button onClick={() => setEditing(!editing)} style={{ flex: 1, background: editing ? C.dim : C.accent, border: editing ? `1px solid ${C.accent}` : 'none', color: editing ? C.accent : C.bg, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {editing ? 'Cancel' : '✏️ Edit Profile'}
        </button>
        <button onClick={refreshProfile} disabled={refreshing} style={{ flex: 1, background: 'transparent', border: `1px solid ${C.border}`, color: C.accent, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: refreshing ? 0.5 : 1 }}>
          {refreshing ? '⏳ Fetching…' : '🔄 Refresh'}
        </button>
      </div>

      {msg && (
        <div style={{ padding: 12, background: msg.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 10, color: msg.startsWith('✅') ? C.green : C.red, fontSize: 13, marginBottom: 14, textAlign: 'center' }}>
          {msg}
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 18 }}>Edit Profile</div>
          {/* Profile photo upload */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <ImageUpload currentUrl={picture} onUploaded={setPicture} size={80} />
          </div>

          {[['Display Name *', name, setName, 'Your name'], ['Website', website, setWebsite, 'https://…']].map(([label, val, set, ph]) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>{label}</label>
              <input type="text" value={val} onChange={e => set(e.target.value)} placeholder={ph}
                style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 13px', color: C.text, fontSize: 14, outline: 'none' }} />
            </div>
          ))}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell the community about yourself…" rows={3}
              style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 13px', color: C.text, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <button onClick={save} disabled={saving} style={{ width: '100%', background: C.accent, border: 'none', color: C.bg, padding: 14, borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Publishing to Nostr…' : '🚀 Save & Publish'}
          </button>
        </div>
      )}
    </div>
  )
}


// ─── Placeholder pages ────────────────────────────────────────────────────────
const Placeholder = ({ emoji, title, sub }) => (
  <div style={{ textAlign: 'center', paddingTop: 80 }}>
    <div style={{ fontSize: 48, marginBottom: 16 }}>{emoji}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>{title}</div>
    <div style={{ fontSize: 14, color: C.muted }}>{sub}</div>
  </div>
)

// ─── Nav config ───────────────────────────────────────────────────────────────
const NAV = [
  { id: 'feed',      icon: <Zap size={18} />,       label: 'Live Feed' },
  { id: 'courses',   icon: <BookOpen size={18} />,   label: 'Courses' },
  { id: 'community', icon: <Users size={18} />,      label: 'Community' },
  { id: 'news',      icon: <Newspaper size={18} />,  label: 'News' },
  { id: 'profile',   icon: <User size={18} />,       label: 'My Profile' },
]

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, logout } = useAuth()
  const [page, setPage] = useState('feed')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const nav = NAV.find(n => n.id === page)

  const go = (id) => { setPage(id); setDrawerOpen(false) }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>

      {/* Top bar */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 90,
        background: 'rgba(8,8,8,0.96)', backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${C.border}`,
        height: 58, padding: '0 16px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <button onClick={() => setDrawerOpen(true)} style={{ background: 'none', border: 'none', color: C.text, cursor: 'pointer', padding: 6, display: 'flex' }}>
          <Menu size={22} />
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: C.bg, boxShadow: '0 0 12px rgba(247,147,26,0.4)' }}>₿</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', lineHeight: 1 }}>BITSAVERS</div>
            <div style={{ fontSize: 8, color: C.accent, letterSpacing: 1.5, fontWeight: 600 }}>EDUHUB</div>
          </div>
        </div>
        {/* Live dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.muted }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}`, animation: 'livePulse 2s ease infinite' }} />
          LIVE
        </div>
        <div onClick={() => go('profile')} style={{ cursor: 'pointer' }}>
          <Avatar profile={user?.profile || {}} pubkey={user?.pubkey} size={34} />
        </div>
      </header>

      {/* Drawer backdrop */}
      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 140, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)' }}
          onClick={() => setDrawerOpen(false)} />
      )}

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 280,
        background: C.surface, borderRight: `1px solid ${C.border}`,
        zIndex: 150, display: 'flex', flexDirection: 'column',
        transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.26s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Drawer header */}
        <div style={{ padding: '20px 18px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, color: C.bg, boxShadow: '0 0 18px rgba(247,147,26,0.4)' }}>₿</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>BITSAVERS</div>
              <div style={{ fontSize: 9, color: C.accent, letterSpacing: 2 }}>EDUHUB ACADEMY</div>
            </div>
          </div>
          <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* User in drawer */}
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar profile={user?.profile || {}} pubkey={user?.pubkey} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.profile?.name || 'Anonymous'}
            </div>
            <div style={{ fontSize: 11, color: C.accent, fontFamily: 'monospace' }}>
              {user?.npub ? shortKey(user.npub) : 'No key'}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
          {NAV.map(item => (
            <button key={item.id} onClick={() => go(item.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 14px', borderRadius: 10, border: 'none',
              borderLeft: page === item.id ? `3px solid ${C.accent}` : '3px solid transparent',
              background: page === item.id ? C.dim : 'transparent',
              color: page === item.id ? C.accent : C.muted,
              fontWeight: page === item.id ? 700 : 500, fontSize: 15,
              cursor: 'pointer', marginBottom: 2, textAlign: 'left',
            }}>
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '12px 10px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={logout} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderRadius: 10, border: 'none',
            background: 'rgba(239,68,68,0.08)', color: C.red,
            fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}>
            <LogOut size={17} /> Logout
          </button>
        </div>
      </div>

      {/* Page */}
      <main style={{ padding: '16px 16px 80px' }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            {nav?.icon} {nav?.label}
          </h1>
        </div>
        {page === 'feed'      && <NostrFeed user={user} />}
        {page === 'courses'   && <Placeholder emoji="📚" title="Courses" sub="Bitcoin courses coming soon!" />}
        {page === 'community' && <Placeholder emoji="🌍" title="Community" sub="Campus groups launching next!" />}
        {page === 'news'      && <Placeholder emoji="📰" title="News" sub="Bitcoin news feed coming soon!" />}
        {page === 'profile'   && <ProfilePage user={user} />}
      </main>

      <style>{`
        @keyframes livePulse { 0%,100%{opacity:1;box-shadow:0 0 6px #22c55e} 50%{opacity:.6;box-shadow:0 0 12px #22c55e} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}

