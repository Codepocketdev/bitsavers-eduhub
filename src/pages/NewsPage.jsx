import { useState, useEffect } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import { nip19 } from 'nostr-tools'
import { nsecToBytes } from '../lib/nostr'
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure'
import { generateTicket, generateTicketId } from './ticketGenerator'
import { Loader, Calendar, Newspaper, AlertCircle, CheckCircle, MapPin, Clock, Users, Download, Ticket } from 'lucide-react'

const C = {
  bg: '#080808', surface: '#0f0f0f', card: '#141414',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e',
}

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

let _pool = null
const getPool = () => { if (!_pool) _pool = new SimplePool(); return _pool }

const timeAgo = (ts) => {
  const s = Math.floor(Date.now() / 1000) - ts
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return new Date(ts * 1000).toLocaleDateString()
}


// ─── RSVP storage ─────────────────────────────────────────────────────────────
const getRsvps = () => { try { return JSON.parse(localStorage.getItem('bitsavers_rsvps') || '{}') } catch { return {} } }
const isRsvped = (id) => { const r = getRsvps()[id]; return r === true || (r && r.rsvped) }
const getStoredTicketId = (eventId) => { const r = getRsvps()[eventId]; return (r && r.ticketId) || null }
const cacheRsvp = (eventId, ticketId) => {
  const rsvps = getRsvps()
  rsvps[eventId] = { rsvped: true, ticketId }
  localStorage.setItem('bitsavers_rsvps', JSON.stringify(rsvps))
}
const clearRsvpCache = (eventId) => {
  const rsvps = getRsvps()
  delete rsvps[eventId]
  localStorage.setItem('bitsavers_rsvps', JSON.stringify(rsvps))
}

// ─── Event Card ───────────────────────────────────────────────────────────────
function EventCard({ event }) {
  const [rsvped, setRsvped] = useState(isRsvped(event.id))
  const [animate, setAnimate] = useState(false)
  const isPast = new Date(event.date) < new Date()

  const [publishing, setPublishing] = useState(false)
  const [ticketReady, setTicketReady] = useState(isRsvped(event.id))
  const [publishError, setPublishError] = useState(false)
  const [checkingNostr, setCheckingNostr] = useState(!isRsvped(event.id))

  const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

  useEffect(() => {
    if (isRsvped(event.id)) { setCheckingNostr(false); return }

    const nsec = localStorage.getItem('bitsavers_nsec')
    if (!nsec) { setCheckingNostr(false); return }

    let pubkey = ''
    try {
      const skBytes = nsecToBytes(nsec)
      pubkey = getPublicKey(skBytes)
    } catch { setCheckingNostr(false); return }

    const pool = new SimplePool()
    const sub = pool.subscribe(RELAYS, {
      kinds: [1],
      authors: [pubkey],
      '#t': ['bitsavers-rsvp', event.id],
      limit: 5,
    }, {
      onevent(e) {
        try {
          const data = JSON.parse(e.content.slice('RSVP:'.length))
          if (data.eventId === event.id) {
            const npub = nip19.npubEncode(pubkey)
            const ticketId = generateTicketId(npub, event.id)
            cacheRsvp(event.id, ticketId)
            setRsvped(true)
            setTicketReady(true)
            setCheckingNostr(false)
            sub.close()
          }
        } catch {}
      },
      oneose() {
        setCheckingNostr(false)
        sub.close()
      }
    })
    setTimeout(() => { sub.close(); setCheckingNostr(false) }, 6000)

    return () => sub.close()
  }, [event.id])

  const toggleRsvp = async () => {
    const next = !rsvped
    if (!next) return

    setAnimate(true)
    setTimeout(() => setAnimate(false), 600)
    setPublishing(true)
    setPublishError(false)

    try {
      const nsec = localStorage.getItem('bitsavers_nsec')
      let npub = localStorage.getItem('bitsavers_npub') || ''
      if (nsec && !npub) {
        try {
          const skBytes = nsecToBytes(nsec)
          const pubkey = getPublicKey(skBytes)
          npub = nip19.npubEncode(pubkey)
        } catch {}
      }

      const ticketId = generateTicketId(npub, event.id)

      if (!nsec) {
        setRsvped(true)
        cacheRsvp(event.id, ticketId)
        setTicketReady(true)
        setPublishing(false)
        return
      }

      const skBytes = nsecToBytes(nsec)
      const pool = getPool()
      const nostrEvent = finalizeEvent({
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'bitsavers'], ['t', 'bitsavers-rsvp'], ['t', event.id]],
        content: 'RSVP:' + JSON.stringify({ eventId: event.id, ticketId, npub, timestamp: Date.now() }),
      }, skBytes)

      await Promise.any(pool.publish(RELAYS, nostrEvent))

      cacheRsvp(event.id, ticketId)
      setRsvped(true)
      setTicketReady(true)

    } catch (e) {
      console.error('RSVP publish failed', e)
      setPublishError(true)
      let npub2 = localStorage.getItem('bitsavers_npub') || ''
      if (!npub2 && nsec) {
        try { const sk = nsecToBytes(nsec); npub2 = nip19.npubEncode(getPublicKey(sk)) } catch {}
      }
      const ticketId = generateTicketId(npub2, event.id)
      cacheRsvp(event.id, ticketId)
      setRsvped(true)
      setTicketReady(true)
    }

    setPublishing(false)
  }

  const downloadTicket = async () => {
    const nsec = localStorage.getItem('bitsavers_nsec')
    let npub = '', pubkey = ''
    try {
      const skBytes = nsecToBytes(nsec)
      pubkey = getPublicKey(skBytes)
      npub = nip19.npubEncode(pubkey)
    } catch {
      npub = localStorage.getItem('bitsavers_npub') || ''
    }
    const ticketId = generateTicketId(npub, event.id)

    let profile = {}
    try { profile = JSON.parse(localStorage.getItem('bitsavers_profile') || '{}') } catch {}

    if (!profile.picture && pubkey) {
      try {
        const pool = new SimplePool()
        const metaEvent = await new Promise((resolve) => {
          const sub = pool.subscribe(RELAYS, { kinds: [0], authors: [pubkey], limit: 1 }, {
            onevent(e) { sub.close(); resolve(e) },
            oneose() { sub.close(); resolve(null) }
          })
          setTimeout(() => { sub.close(); resolve(null) }, 4000)
        })
        if (metaEvent) {
          const meta = JSON.parse(metaEvent.content)
          profile = { ...profile, ...meta }
        }
      } catch {}
    }

    await generateTicket({ event, profile, npub, ticketId })
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${rsvped ? 'rgba(34,197,94,0.3)' : C.border}`, borderRadius: 16, marginBottom: 14, overflow: 'hidden', transition: 'border-color 0.3s' }}>
      {rsvped && <div style={{ height: 3, background: 'linear-gradient(90deg,#22c55e,#16a34a)', width: '100%' }} />}

      {event.imageUrl && (
        <img src={event.imageUrl} alt={event.title} style={{ width: '100%', display: 'block', borderRadius: '16px 16px 0 0' }} />
      )}

      <div style={{ padding: 18 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ background: isPast ? 'rgba(255,255,255,0.04)' : C.dim, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', textAlign: 'center', flexShrink: 0, minWidth: 56 }}>
            <div style={{ fontSize: 10, color: C.accent, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
              {new Date(event.date).toLocaleString('en', { month: 'short' })}
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: isPast ? C.muted : C.text, lineHeight: 1 }}>
              {new Date(event.date).getDate()}
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>
              {new Date(event.date).toLocaleString('en', { weekday: 'short' })}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: isPast ? C.muted : C.text, lineHeight: 1.3 }}>{event.title}</div>
              {isPast && <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 20, flexShrink: 0 }}>PAST</span>}
            </div>
            {event.instructor && (
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>by {event.instructor}</div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: event.description ? 10 : 14 }}>
          {event.time && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.accent }}>
              <Clock size={12} /> {event.time}
            </div>
          )}
          {event.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.muted }}>
              <MapPin size={12} /> {event.location}
            </div>
          )}
        </div>

        {event.description && (
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 14 }}>{event.description}</div>
        )}

        {!isPast && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={rsvped || checkingNostr ? undefined : toggleRsvp}
                disabled={publishing || checkingNostr}
                style={{
                  flex: 1, padding: '12px', borderRadius: 11, fontWeight: 800, fontSize: 14,
                  cursor: rsvped ? 'default' : (publishing || checkingNostr) ? 'not-allowed' : 'pointer',
                  background: rsvped ? 'rgba(34,197,94,0.15)' : checkingNostr ? C.dim : C.accent,
                  color: rsvped ? C.green : checkingNostr ? C.muted : '#000',
                  border: rsvped ? '1px solid rgba(34,197,94,0.4)' : checkingNostr ? `1px solid ${C.border}` : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transform: animate ? 'scale(1.04)' : 'scale(1)', transition: 'all 0.2s',
                  opacity: publishing ? 0.7 : 1,
                  userSelect: 'none',
                }}>
                {checkingNostr
                  ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Checking…</>
                  : publishing
                    ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Registering…</>
                    : <><CheckCircle size={15} fill={rsvped ? C.green : 'none'} /> {rsvped ? "You're going!" : 'RSVP'}</>
                }
              </button>

              {event.link && (
                <a href={event.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <button style={{ padding: '12px 18px', borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: 'pointer', background: C.dim, border: `1px solid ${C.border}`, color: C.accent, display: 'flex', alignItems: 'center', gap: 6 }}>
                    Join
                  </button>
                </a>
              )}
            </div>

            {ticketReady && (
              <button onClick={downloadTicket} style={{ width: '100%', padding: '11px', borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: 'pointer', background: 'rgba(247,147,26,0.08)', border: `1px solid rgba(247,147,26,0.3)`, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Download size={14} /> Download Ticket
              </button>
            )}
          </div>
        )}

        {isPast && event.link && (
          <a href={event.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <button style={{ width: '100%', padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', background: C.dim, border: `1px solid ${C.border}`, color: C.muted }}>
              View Recording / Details
            </button>
          </a>
        )}
      </div>
    </div>
  )
}

export default function NewsPage() {
  const [news, setNews] = useState(() => {
    // Show cached announcements instantly — Nostr will update/replace in background
    try {
      const deleted = JSON.parse(localStorage.getItem('bitsavers_deleted_announcements') || '[]')
      const cached = JSON.parse(localStorage.getItem('bitsavers_announcements') || '[]')
      return cached.filter(n => !deleted.includes(n.id))
    } catch { return [] }
  })
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('news')

  useEffect(() => {
    const deletedEvents = () => { try { return JSON.parse(localStorage.getItem('bitsavers_deleted_events') || '[]') } catch { return [] } }
    const cutoff = Date.now() - 86400000

    // ── 1. Show localStorage events instantly ────────────────────────────────
    try {
      const stored = JSON.parse(localStorage.getItem('bitsavers_events') || '[]')
      setEvents(stored.filter(e => !deletedEvents().includes(e.id) && new Date(e.date) >= new Date(cutoff)))
    } catch {}

    // ── 2. Fetch events from Nostr ───────────────────────────────────────────
    const pool = getPool()
    const seenEvIds = new Set()
    const evSub = pool.subscribe(
      RELAYS,
      { kinds: [1], '#t': ['bitsavers-event'], since: Math.floor(Date.now()/1000) - 365*86400, limit: 100 },
      {
        onevent(ev) {
          if (seenEvIds.has(ev.id)) return
          seenEvIds.add(ev.id)
          try {
            if (ev.content.startsWith('EVENT_DELETE:')) {
              const { id } = JSON.parse(ev.content.slice('EVENT_DELETE:'.length))
              if (!id) return
              const del = deletedEvents()
              if (!del.includes(id)) localStorage.setItem('bitsavers_deleted_events', JSON.stringify([...del, id]))
              const stored = JSON.parse(localStorage.getItem('bitsavers_events') || '[]')
              localStorage.setItem('bitsavers_events', JSON.stringify(stored.filter(e => e.id !== id)))
              setEvents(prev => prev.filter(e => e.id !== id))
              return
            }
            const dataMatch = ev.content.match(/DATA:(\{.*\})/)
            if (!dataMatch) return
            const data = JSON.parse(dataMatch[1])
            if (!data.id || !data.title || !data.date) return
            if (deletedEvents().includes(data.id)) return
            if (new Date(data.date) < new Date(cutoff)) return
            const all = JSON.parse(localStorage.getItem('bitsavers_events') || '[]')
            if (!all.find(e => e.id === data.id)) localStorage.setItem('bitsavers_events', JSON.stringify([data, ...all]))
            setEvents(prev => prev.find(e => e.id === data.id) ? prev : [...prev, data].sort((a,b) => new Date(a.date) - new Date(b.date)))
          } catch {}
        },
        oneose() {}
      }
    )

    // ── 3. Live WebSocket for announcements — show immediately, no batching ──
    const newsSeen = new Set()
    const newsClosers = []

    const openNewsWS = (relayUrl) => {
      let ws, closed = false
      const subId = 'ann-' + Math.random().toString(36).slice(2, 8)
      const connect = () => {
        ws = new WebSocket(relayUrl)
        ws.onopen = () => ws.send(JSON.stringify(['REQ', subId, {
          kinds: [1], '#t': ['bitsavers-announcement'],
          since: Math.floor(Date.now() / 1000) - 90 * 86400, limit: 100
        }]))
        ws.onmessage = ({ data }) => {
          try {
            const msg = JSON.parse(data)
            if (msg[0] === 'EVENT') {
              const e = msg[2]
              if (newsSeen.has(e.id)) return
              newsSeen.add(e.id)
              if (e.content.startsWith('ANNOUNCEMENT_DELETE:')) {
                try {
                  const { id } = JSON.parse(e.content.slice('ANNOUNCEMENT_DELETE:'.length))
                  // Persist deletion blocklist
                  const del = JSON.parse(localStorage.getItem('bitsavers_deleted_announcements') || '[]')
                  if (!del.includes(id)) localStorage.setItem('bitsavers_deleted_announcements', JSON.stringify([...del, id]))
                  // Remove from localStorage cache
                  const cached = JSON.parse(localStorage.getItem('bitsavers_announcements') || '[]')
                  localStorage.setItem('bitsavers_announcements', JSON.stringify(cached.filter(n => n.id !== id)))
                  setNews(prev => prev.filter(n => n.id !== id))
                } catch {}
                return
              }
              if (!e.content.startsWith('ANNOUNCEMENT:')) return
              try {
                const d = JSON.parse(e.content.slice('ANNOUNCEMENT:'.length))
                // Skip if previously deleted
                const deleted = JSON.parse(localStorage.getItem('bitsavers_deleted_announcements') || '[]')
                if (deleted.includes(d.id)) return
                // Save to localStorage cache so next load is instant
                const cached = JSON.parse(localStorage.getItem('bitsavers_announcements') || '[]')
                if (!cached.find(n => n.id === d.id)) {
                  localStorage.setItem('bitsavers_announcements', JSON.stringify([d, ...cached].slice(0, 50)))
                }
                setNews(prev => {
                  if (prev.find(n => n.id === d.id)) return prev
                  return [d, ...prev].sort((a, b) => b.publishedAt - a.publishedAt)
                })
                setLoading(false)
              } catch {}
            }
            if (msg[0] === 'EOSE') {
              // Hide spinner as soon as any relay responds
              setLoading(false)
            }
          } catch {}
        }
        ws.onclose = () => { if (!closed) setTimeout(connect, 3000) }
      }
      connect()
      newsClosers.push(() => { closed = true; ws?.close() })
    }

    RELAYS.forEach(openNewsWS)

    setTimeout(() => setLoading(false), 8000)
    return () => { evSub.close(); newsClosers.forEach(c => c()) }
  }, [])

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 4, marginBottom: 16 }}>
        {[['news', 'Announcements'], ['events', 'Events']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, background: tab === id ? C.accent : 'transparent',
            border: 'none', color: tab === id ? C.bg : C.muted,
            padding: '9px 8px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      {/* Announcements */}
      {tab === 'news' && (
        <>
          {loading && (
            <div style={{ textAlign: 'center', padding: '50px 0', color: C.muted }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
                <Loader size={18} style={{ animation: 'spin 1s linear infinite', color: C.accent }} />
                <span style={{ fontSize: 14 }}>Connecting to Nostr relays…</span>
              </div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted }}>wss://relay.damus.io + 2 more</div>
            </div>
          )}
          {!loading && news.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ display:'flex', justifyContent:'center', marginBottom: 12 }}><Newspaper size={40} color={C.muted} /></div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 6 }}>No announcements yet</div>
              <div style={{ fontSize: 13, color: C.muted }}>Check back soon for updates from the team.</div>
            </div>
          )}
          {news.map(item => (
            <div key={item.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 14, overflow: 'hidden' }}>
              {item.imageUrl && (
                <img src={item.imageUrl} alt="" style={{ width: '100%', display: 'block', maxHeight: 240, objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
              )}
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ background: C.accent, color: C.bg, fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20, letterSpacing: 0.5 }}>ANNOUNCEMENT</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{timeAgo(item.publishedAt)}</span>
                </div>
                {item.title && <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 8, lineHeight: 1.3 }}>{item.title}</div>}
                {item.body && <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.7 }}>{item.body}</div>}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Events */}
      {tab === 'events' && (
        <>
          {events.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ display:'flex', justifyContent:'center', marginBottom: 12 }}><Calendar size={40} color={C.muted} /></div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 6 }}>No upcoming events</div>
              <div style={{ fontSize: 13, color: C.muted }}>Events will appear here when scheduled by the team.</div>
            </div>
          )}
          {events.sort((a,b) => new Date(a.date) - new Date(b.date)).map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

