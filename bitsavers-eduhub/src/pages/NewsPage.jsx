import { useState, useEffect } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import { nip19 } from 'nostr-tools'
import { nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
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
// isRsvped checks localStorage cache only — source of truth is Nostr
const isRsvped = (id) => { const r = getRsvps()[id]; return r === true || (r && r.rsvped) }
// getStoredTicketId — returns cached ticketId if exists (deterministic so same value always)
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

  const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

  const toggleRsvp = async () => {
    const next = !rsvped

    // Once RSVPed the button is locked — this branch should never fire
    if (!next) return

    // RSVP flow
    setAnimate(true)
    setTimeout(() => setAnimate(false), 600)
    setPublishing(true)
    setPublishError(false)

    try {
      const nsec = localStorage.getItem('bitsavers_nsec')
      const npub = localStorage.getItem('bitsavers_npub') || ''

      // Deterministic ticketId — same npub+eventId always = same ticket, no Date.now()
      const ticketId = generateTicketId(npub, event.id)

      // Check if already cached (user re-RSVPing after clearing storage)
      const existing = getStoredTicketId(event.id)
      if (existing && existing !== ticketId) {
        // Shouldn't happen with deterministic hash, but safety check
        console.warn('TicketId mismatch — using deterministic one')
      }

      if (!nsec) {
        // No nsec — can't publish, just show as RSVPed locally
        setRsvped(true)
        cacheRsvp(event.id, ticketId)
        setTicketReady(true)
        setPublishing(false)
        return
      }

      // Publish to Nostr FIRST — source of truth
      const skBytes = nsecToBytes(nsec)
      const pool = getPool()
      const nostrEvent = finalizeEvent({
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'bitsavers'], ['t', 'bitsavers-rsvp'], ['t', event.id]],
        content: 'RSVP:' + JSON.stringify({ eventId: event.id, ticketId, npub, timestamp: Date.now() }),
      }, skBytes)

      await Promise.any(pool.publish(RELAYS, nostrEvent))

      // Only after Nostr confirms — cache locally and unlock download
      cacheRsvp(event.id, ticketId)
      setRsvped(true)
      setTicketReady(true)

    } catch (e) {
      console.error('RSVP publish failed', e)
      setPublishError(true)
      // Still mark RSVPed locally so UI doesn't confuse user
      const npub = localStorage.getItem('bitsavers_npub') || ''
      const ticketId = generateTicketId(npub, event.id)
      cacheRsvp(event.id, ticketId)
      setRsvped(true)
      setTicketReady(true)
    }

    setPublishing(false)
  }

  const downloadTicket = async () => {
    const npub = localStorage.getItem('bitsavers_npub') || ''
    // Always regenerate deterministic ticketId — same result every time
    const ticketId = generateTicketId(npub, event.id)
    let profile = {}
    try { profile = JSON.parse(localStorage.getItem('bitsavers_profile') || '{}') } catch {}
    await generateTicket({ event, profile, npub, ticketId })
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${rsvped ? 'rgba(34,197,94,0.3)' : C.border}`, borderRadius: 16, marginBottom: 14, overflow: 'hidden', transition: 'border-color 0.3s' }}>
      {/* Top accent bar if RSVPed */}
      {rsvped && <div style={{ height: 3, background: 'linear-gradient(90deg,#22c55e,#16a34a)', width: '100%' }} />}

      {/* Cover image */}
      {event.imageUrl && (
        <img src={event.imageUrl} alt={event.title} style={{ width: '100%', display: 'block', borderRadius: '16px 16px 0 0' }} />
      )}

      <div style={{ padding: 18 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 14 }}>
          {/* Date block */}
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

          {/* Info */}
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

        {/* Meta row */}
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

        {/* Action buttons */}
        {!isPast && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {/* RSVP button */}
              <button
                onClick={rsvped ? undefined : toggleRsvp}
                disabled={publishing}
                style={{
                  flex: 1, padding: '12px', borderRadius: 11, fontWeight: 800, fontSize: 14,
                  cursor: rsvped ? 'default' : publishing ? 'not-allowed' : 'pointer',
                  background: rsvped ? 'rgba(34,197,94,0.15)' : C.accent,
                  color: rsvped ? C.green : '#000',
                  border: rsvped ? '1px solid rgba(34,197,94,0.4)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transform: animate ? 'scale(1.04)' : 'scale(1)', transition: 'all 0.2s',
                  opacity: publishing ? 0.7 : 1,
                  userSelect: 'none',
                }}>
                {publishing ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={15} fill={rsvped ? C.green : 'none'} />}
                {publishing ? 'Registering…' : rsvped ? "You're going!" : 'RSVP'}
              </button>

              {/* Join/Link button */}
              {event.link && (
                <a href={event.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <button style={{ padding: '12px 18px', borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: 'pointer', background: C.dim, border: `1px solid ${C.border}`, color: C.accent, display: 'flex', alignItems: 'center', gap: 6 }}>
                    Join
                  </button>
                </a>
              )}
            </div>

            {/* Download ticket button — shows after RSVP */}
            {ticketReady && (
              <button onClick={downloadTicket} style={{ width: '100%', padding: '11px', borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: 'pointer', background: 'rgba(247,147,26,0.08)', border: `1px solid rgba(247,147,26,0.3)`, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Download size={14} /> Download Ticket
              </button>
            )}
          </div>
        )}

        {/* Past event — just show link */}
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
  const [news, setNews] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('news')

  useEffect(() => {
    const deletedEvents = () => { try { return JSON.parse(localStorage.getItem('bitsavers_deleted_events') || '[]') } catch { return [] } }
    const deletedNews   = () => { try { return JSON.parse(localStorage.getItem('bitsavers_deleted_news')   || '[]') } catch { return [] } }
    const cutoff = Date.now() - 86400000

    // ── 1. Show localStorage instantly ──────────────────────────────────────
    try {
      const stored = JSON.parse(localStorage.getItem('bitsavers_events') || '[]')
      setEvents(stored.filter(e => !deletedEvents().includes(e.id) && new Date(e.date) >= new Date(cutoff)))
    } catch {}

    // ── 2. Fetch events from Nostr (one-time) ───────────────────────────────
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
            // Handle EVENT_DELETE signal
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
            // Handle normal event note
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
        oneose() {} // keep open for live deletes
      }
    )

    // ── 3. Fetch news from Nostr (one-time batch) ───────────────────────────
    const pool2 = getPool()
    const seen = new Set()
    const batch = []

    const newsSub = pool2.subscribe(
      RELAYS,
      { kinds: [1], '#t': ['bitsavers-news'], since: Math.floor(Date.now()/1000) - 30*86400, limit: 50 },
      {
        onevent(e) {
          if (seen.has(e.id) || !e.content?.trim()) return
          seen.add(e.id)
          // Handle NEWS_DELETE signal
          if (e.content.startsWith('NEWS_DELETE:')) {
            try {
              const { id } = JSON.parse(e.content.slice('NEWS_DELETE:'.length))
              if (!id) return
              const del = deletedNews()
              if (!del.includes(id)) localStorage.setItem('bitsavers_deleted_news', JSON.stringify([...del, id]))
              localStorage.setItem('bitsavers_news', JSON.stringify(
                JSON.parse(localStorage.getItem('bitsavers_news') || '[]').filter(n => n.id !== id)
              ))
              setNews(prev => prev.filter(n => n.id !== id))
            } catch {}
            return
          }
          // Skip internal protocol notes
          if (e.content.includes('DATA:{') || e.content.startsWith('DELETED:')) return
          // Skip if this news ID was deleted
          if (deletedNews().includes(e.id)) return
          batch.push(e)
        },
        oneose() {
          setNews(batch.sort((a,b) => b.created_at - a.created_at))
          setLoading(false)
        }
      }
    )

    setTimeout(() => setLoading(false), 8000)
    return () => { evSub.close(); newsSub.close() }
  }, [])

  const parseNewsContent = (content) => {
    const lines = content.split('\n\n')
    const title = lines[0] || ''
    const body = lines.slice(1).join('\n\n')
    return { title, body }
  }

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
          {news.map(item => {
            const { title, body } = parseNewsContent(item.content)
            // Check for image URL in content
            const imgMatch = item.content.match(/https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)/i)
            return (
              <div key={item.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 14, overflow: 'hidden' }}>
                {imgMatch && (
                  <img src={imgMatch[0]} alt="" style={{ width: '100%', display: 'block' }} onError={e => e.target.style.display='none'} />
                )}
                <div style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ background: C.accent, color: C.bg, fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20, letterSpacing: 0.5 }}>ANNOUNCEMENT</span>
                    <span style={{ fontSize: 11, color: C.muted }}>{timeAgo(item.created_at)}</span>
                  </div>
                  {title && <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 8, lineHeight: 1.3 }}>{title}</div>}
                  {body && <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.7 }}>{body}</div>}
                </div>
              </div>
            )
          })}
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

