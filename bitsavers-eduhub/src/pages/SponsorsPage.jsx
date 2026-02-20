import { useState, useEffect } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import { RefreshCw, ExternalLink, Trophy, Handshake, Building2 } from 'lucide-react'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const TAG = 'bitsavers-sponsors'

const C = {
  card: '#141414', border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0', muted: '#666',
}

export default function SponsorsPage() {
  const [data, setData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bitsavers_sponsors') || '{"sponsors":[],"collaborators":[]}') }
    catch { return { sponsors: [], collaborators: [] } }
  })
  const [fetching, setFetching] = useState(false)

  const fetchData = () => {
    setFetching(true)
    const pool = new SimplePool()
    const seen = new Set()
    let latest = { created_at: 0, data: null }
    let eoseCount = 0

    RELAYS.forEach(relay => {
      const sub = pool.subscribe([relay], { kinds: [1], '#t': [TAG], limit: 10 }, {
        onevent(e) {
          if (seen.has(e.id) || !e.content.startsWith('SPONSORS:')) return
          seen.add(e.id)
          try {
            if (e.created_at > latest.created_at)
              latest = { created_at: e.created_at, data: JSON.parse(e.content.slice('SPONSORS:'.length)) }
          } catch {}
        },
        oneose() {
          sub.close(); eoseCount++
          if (eoseCount >= RELAYS.length) {
            if (latest.data) { localStorage.setItem('bitsavers_sponsors', JSON.stringify(latest.data)); setData(latest.data) }
            setFetching(false)
          }
        }
      })
    })
    setTimeout(() => setFetching(false), 8000)
  }

  useEffect(() => { fetchData() }, [])

  const sponsors = data.sponsors?.filter(s => s.name) || []
  const collaborators = data.collaborators?.filter(c => c.name) || []

  const Card = ({ item }) => (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
      {item.logo
        ? <img src={item.logo} alt={item.name} style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: 12, background: '#fff', padding: 6 }} onError={e => e.target.style.display = 'none'} />
        : <div style={{ width: 80, height: 80, borderRadius: 12, background: C.dim, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={32} color={C.accent} />
          </div>
      }
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>{item.name}</div>
        {item.description && <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{item.description}</div>}
      </div>
      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.accent, fontWeight: 600, textDecoration: 'none' }}>
          Visit <ExternalLink size={12} />
        </a>
      )}
    </div>
  )

  const SectionHeader = ({ Icon, title }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
      <Icon size={15} color={C.accent} /> {title}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 2 }}>Partners</div>
          <div style={{ fontSize: 13, color: C.muted }}>Organizations supporting Bitcoin education in Africa</div>
        </div>
        <button onClick={fetchData} disabled={fetching} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <RefreshCw size={13} style={{ animation: fetching ? 'spin 1s linear infinite' : 'none' }} />
          {fetching ? 'Syncing…' : 'Refresh'}
        </button>
      </div>

      {sponsors.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <SectionHeader Icon={Trophy} title="Sponsors" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
            {sponsors.map((s, i) => <Card key={i} item={s} />)}
          </div>
        </div>
      )}

      {collaborators.length > 0 && (
        <div>
          <SectionHeader Icon={Handshake} title="Collaborators" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
            {collaborators.map((c, i) => <Card key={i} item={c} />)}
          </div>
        </div>
      )}

      {sponsors.length === 0 && collaborators.length === 0 && !fetching && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted }}>
          <Handshake size={36} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>No partners yet</div>
          <div style={{ fontSize: 13 }}>Admin can add sponsors & collaborators from Admin Panel → Partners tab</div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

