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
    // Load events from localStorage (set by admin)
    try {
      const stored = JSON.parse(localStorage.getItem('bitsavers_events') || '[]')
      setEvents(stored.filter(e => new Date(e.date) >= new Date(Date.now() - 86400000)))
    } catch {}

    // Fetch news posts from Nostr
    const pool = getPool()
    const seen = new Set()
    const batch = []

    const sub = pool.subscribe(
      RELAYS,
      { kinds: [1], '#t': ['bitsavers-news'], since: Math.floor(Date.now()/1000) - 30*86400, limit: 30 },
      {
        onevent(e) {
          if (seen.has(e.id) || !e.content?.trim()) return
          seen.add(e.id)
          batch.push(e)
        },
        oneose() {
          setNews(batch.sort((a,b) => b.created_at - a.created_at))
          setLoading(false)
          sub.close()
        }
      }
    )
    setTimeout(() => setLoading(false), 8000)
    return () => sub.close()
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

