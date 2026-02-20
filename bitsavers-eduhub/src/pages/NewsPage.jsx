import { useState, useEffect } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import { Loader, Calendar, Newspaper, AlertCircle } from 'lucide-react'

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
              <Loader size={18} style={{ animation: 'spin 1s linear infinite', color: C.accent, display: 'inline-block' }} />
              <div style={{ marginTop: 10, fontSize: 13 }}>Fetching announcements…</div>
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
                  <img src={imgMatch[0]} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} onError={e => e.target.style.display='none'} />
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
            <div key={event.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ background: C.dim, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', textAlign: 'center', flexShrink: 0, minWidth: 54 }}>
                  <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, textTransform: 'uppercase' }}>
                    {new Date(event.date).toLocaleString('en', { month: 'short' })}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: C.text, lineHeight: 1 }}>
                    {new Date(event.date).getDate()}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 4 }}>{event.title}</div>
                  {event.instructor && <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Instructor: {event.instructor}</div>}
                  {event.time && <div style={{ fontSize: 12, color: C.accent, fontFamily: 'monospace', marginBottom: 6 }}>{event.time}</div>}
                  {event.description && <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 8 }}>{event.description}</div>}
                  {event.link && (
                    <a href={event.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: C.accent, color: C.bg, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                      Join Event
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

