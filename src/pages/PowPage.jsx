import { useState, useEffect } from 'react'
import { TrendingUp, Users, Globe, Award, RefreshCw, BarChart2, BookOpen, Building2, GraduationCap, X } from 'lucide-react'
import { getPool } from '../lib/nostr'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const POW_TAG = 'bitsavers-pow'
const GALLERY_TAG = 'bitsavers-gallery'

const C = {
  bg: '#080808', card: '#141414', border: 'rgba(247,147,26,0.18)',
  accent: '#F7931A', dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e',
}

const getPowData = () => { try { return JSON.parse(localStorage.getItem('bitsavers_pow') || '[]') } catch { return [] } }
const savePowData = (d) => localStorage.setItem('bitsavers_pow', JSON.stringify(d))
const getGallery = () => { try { return JSON.parse(localStorage.getItem('bitsavers_gallery') || '[]') } catch { return [] } }
const saveGallery = (d) => localStorage.setItem('bitsavers_gallery', JSON.stringify(d))

// ─── PoW chart components (unchanged) ────────────────────────────────────────
function BarChart({ rows }) {
  if (!rows?.length) return null
  const max = Math.max(...rows.map(r => Number(r.value) || 0))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted, marginBottom: 4 }}>
            <span>{r.label}</span><span style={{ color: C.accent, fontWeight: 700 }}>{r.value}</span>
          </div>
          <div style={{ background: 'rgba(247,147,26,0.08)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
            <div style={{ width: `${max ? (Number(r.value)/max)*100 : 0}%`, height: '100%', background: C.accent, borderRadius: 4, transition: 'width 0.6s ease' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function LineChart({ rows }) {
  if (!rows?.length) return null
  const vals = rows.map(r => Number(r.value) || 0)
  const max = Math.max(...vals), min = Math.min(...vals)
  const range = max - min || 1
  const W = 300, H = 120, pad = 20
  const pts = rows.map((r, i) => {
    const x = pad + (i / (rows.length - 1 || 1)) * (W - pad * 2)
    const y = H - pad - ((Number(r.value) - min) / range) * (H - pad * 2)
    return `${x},${y}`
  })
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 200 }}>
        <polyline points={pts.join(' ')} fill="none" stroke={C.accent} strokeWidth="2" strokeLinejoin="round" />
        {rows.map((r, i) => {
          const [x, y] = pts[i].split(',')
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="4" fill={C.accent} />
              <text x={x} y={H - 4} textAnchor="middle" fontSize="9" fill={C.muted}>{r.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function TableBlock({ rows, columns }) {
  if (!rows?.length) return null
  const cols = columns?.length ? columns : Object.keys(rows[0])
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>{cols.map(c => <th key={c} style={{ padding: '6px 10px', color: C.accent, fontWeight: 700, textAlign: 'left', borderBottom: `1px solid ${C.border}` }}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid rgba(247,147,26,0.06)` }}>
              {cols.map(c => <td key={c} style={{ padding: '7px 10px', color: C.text }}>{r[c] ?? ''}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatCard({ block }) {
  const icons = { users: <Users size={20} />, globe: <Globe size={20} />, award: <Award size={20} />, chart: <BarChart2 size={20} />, book: <BookOpen size={20} />, building: <Building2 size={20} /> }
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: C.dim, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent }}>
          {icons[block.icon] || <TrendingUp size={20} />}
        </div>
        <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{block.label}</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: C.accent }}>{block.value}</div>
      {block.subtitle && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{block.subtitle}</div>}
    </div>
  )
}

function BlockCard({ block }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>{block.label}</div>
      {block.type === 'bar'   && <BarChart rows={block.rows} />}
      {block.type === 'line'  && <LineChart rows={block.rows} />}
      {block.type === 'table' && <TableBlock rows={block.rows} columns={block.columns} />}
      {block.type === 'list'  && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {block.rows?.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: C.dim, borderRadius: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: C.bg }}>{i+1}</div>
              <span style={{ fontSize: 13, color: C.text }}>{r.label}</span>
              {r.value && <span style={{ marginLeft: 'auto', fontSize: 12, color: C.accent, fontWeight: 700 }}>{r.value}</span>}
            </div>
          ))}
        </div>
      )}
      {block.subtitle && <div style={{ fontSize: 11, color: C.muted, marginTop: 12 }}>{block.subtitle}</div>}
    </div>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ photo, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <X size={18} />
      </button>
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '85vh' }}>
        <img src={photo.url} alt={photo.caption || 'Graduate'} style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 12, objectFit: 'contain', display: 'block' }} />
        {photo.caption && <div style={{ textAlign: 'center', color: C.muted, fontSize: 13, marginTop: 12 }}>{photo.caption}</div>}
      </div>
    </div>
  )
}

// ─── Graduates Gallery Section ────────────────────────────────────────────────
function GraduatesSection({ cohorts }) {
  const [lightbox, setLightbox] = useState(null)
  if (!cohorts.length) return null

  return (
    <div style={{ marginTop: 32 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: C.dim, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent }}>
          <GraduationCap size={20} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>Our Graduates</div>
          <div style={{ fontSize: 12, color: C.muted }}>BitSavers EduHub alumni</div>
        </div>
      </div>

      {cohorts.map(cohort => (
        cohort.photos?.length > 0 && (
          <div key={cohort.id} style={{ marginBottom: 28 }}>
            {/* Cohort label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ height: 1, flex: 1, background: C.border }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: 1, padding: '4px 12px', background: C.dim, border: `1px solid ${C.border}`, borderRadius: 20 }}>
                {cohort.name}
              </div>
              <div style={{ height: 1, flex: 1, background: C.border }} />
            </div>

            {/* Photos grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {cohort.photos.map(photo => (
                <div key={photo.id} onClick={() => setLightbox(photo)} style={{ cursor: 'pointer', borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}`, aspectRatio: '1', background: '#0a0a0a', position: 'relative' }}>
                  <img src={photo.url} alt={photo.caption || cohort.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.2s' }}
                    onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
                    onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                  />
                  {photo.caption && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', padding: '16px 8px 8px', fontSize: 10, color: '#fff' }}>
                      {photo.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      ))}

      {lightbox && <Lightbox photo={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}

// ─── Main PoW Page ────────────────────────────────────────────────────────────
export default function PowPage() {
  const [blocks, setBlocks] = useState(getPowData)
  const [gallery, setGallery] = useState(getGallery)
  const [fetching, setFetching] = useState(false)
  const [lastSync, setLastSync] = useState(null)

  const fetchFromNostr = () => {
    setFetching(true)
    const pool = getPool()
    let doneCount = 0
    const checkDone = () => { doneCount++; if (doneCount >= 2) { setFetching(false); setLastSync(new Date()) } }

    // ── Subscription 1: PoW stats (exact same pattern as original) ────────────
    const seenPow = new Set()
    const byId = {}
    const subPow = pool.subscribe(
      RELAYS,
      { kinds: [1], '#t': [POW_TAG], limit: 200 },
      {
        onevent(e) {
          if (seenPow.has(e.id)) return
          seenPow.add(e.id)
          try {
            if (e.content.startsWith('POW_BLOCK:')) {
              const data = JSON.parse(e.content.slice('POW_BLOCK:'.length))
              if (!data.id) return
              if (!byId[data.id] || e.created_at > byId[data.id].created_at) {
                byId[data.id] = { ...data, created_at: e.created_at }
              }
            } else if (e.content.startsWith('POW_DELETE:')) {
              const { id } = JSON.parse(e.content.slice('POW_DELETE:'.length))
              if (!id) return
              if (!byId[id] || e.created_at > byId[id].created_at) {
                byId[id] = { id, _deleted: true, created_at: e.created_at }
              }
            }
          } catch {}
        },
        oneose() {
          subPow.close()
          const result = Object.values(byId)
            .filter(b => !b._deleted)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
          if (result.length > 0) { savePowData(result); setBlocks(result) }
          checkDone()
        }
      }
    )

    // ── Subscription 2: Gallery (latest-wins, same logic) ─────────────────────
    const seenGallery = new Set()
    let latestGallery = { created_at: 0 }
    const subGallery = pool.subscribe(
      RELAYS,
      { kinds: [1], '#t': [GALLERY_TAG], limit: 20 },
      {
        onevent(e) {
          if (seenGallery.has(e.id)) return
          seenGallery.add(e.id)
          try {
            if (e.content.startsWith('GALLERY:')) {
              if (e.created_at > latestGallery.created_at) {
                latestGallery = { created_at: e.created_at, data: JSON.parse(e.content.slice('GALLERY:'.length)) }
              }
            }
          } catch {}
        },
        oneose() {
          subGallery.close()
          if (latestGallery.data) { saveGallery(latestGallery.data); setGallery(latestGallery.data) }
          checkDone()
        }
      }
    )
    setTimeout(() => { sub.close(); setFetching(false) }, 10000)
  }

  useEffect(() => { fetchFromNostr() }, [])

  const statBlocks = blocks.filter(b => b.type === 'number')
  const chartBlocks = blocks.filter(b => b.type !== 'number')

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>Proof of Work</div>
          <div style={{ fontSize: 13, color: C.muted }}>BitSavers EduHub impact stats</div>
        </div>
        <button onClick={fetchFromNostr} disabled={fetching} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <RefreshCw size={13} style={{ animation: fetching ? 'spin 1s linear infinite' : 'none' }} />
          {fetching ? 'Syncing…' : 'Refresh'}
        </button>
      </div>
      {lastSync && <div style={{ fontSize: 10, color: C.muted, marginBottom: 16 }}>Last synced: {lastSync.toLocaleTimeString()}</div>}

      {/* Stat number cards */}
      {statBlocks.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {statBlocks.map(b => <StatCard key={b.id} block={b} />)}
        </div>
      )}

      {/* Chart / table / list blocks */}
      {chartBlocks.map(b => <BlockCard key={b.id} block={b} />)}

      {blocks.length === 0 && !fetching && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>
          <TrendingUp size={36} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>No stats published yet</div>
          <div style={{ fontSize: 13 }}>Admin can add stats from the Admin Panel → PoW tab</div>
        </div>
      )}

      {/* Graduates Gallery */}
      <GraduatesSection cohorts={gallery} />

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

