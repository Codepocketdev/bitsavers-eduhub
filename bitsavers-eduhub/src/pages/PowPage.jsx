import { useState, useEffect } from 'react'
import { TrendingUp, Users, Globe, Award, RefreshCw, BarChart2, BookOpen, Building2 } from 'lucide-react'
import { getPool } from '../lib/nostr'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const POW_TAG = 'bitsavers-pow'

const C = {
  bg: '#080808', surface: '#0f0f0f', card: '#141414',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

const ICONS = {
  users: <Users size={20} />, globe: <Globe size={20} />,
  award: <Award size={20} />, trending: <TrendingUp size={20} />,
  chart: <BarChart2 size={20} />, book: <BookOpen size={20} />,
  building: <Building2 size={20} />,
}

const getPowData = () => {
  try { return JSON.parse(localStorage.getItem('bitsavers_pow') || '[]') } catch { return [] }
}
const savePowData = (d) => localStorage.setItem('bitsavers_pow', JSON.stringify(d))

// ─── Mini bar chart ───────────────────────────────────────────────────────────
function BarChart({ rows }) {
  if (!rows?.length) return null
  const max = Math.max(...rows.map(r => Number(r.value) || 0))
  return (
    <div style={{ marginTop: 12 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: C.muted, width: 90, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
          <div style={{ flex: 1, height: 8, background: 'rgba(247,147,26,0.1)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${max > 0 ? (Number(r.value)/max)*100 : 0}%`, background: C.accent, borderRadius: 4, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, width: 40, textAlign: 'right', flexShrink: 0 }}>{r.value}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Line chart (SVG) ─────────────────────────────────────────────────────────
function LineChart({ rows }) {
  if (!rows?.length) return null
  const W = 320, H = 120, PAD = 20
  const values = rows.map(r => Number(r.value) || 0)
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => {
    const x = PAD + (i / Math.max(values.length - 1, 1)) * (W - PAD * 2)
    const y = PAD + (1 - v / max) * (H - PAD * 2)
    return [x, y]
  })
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')
  const areaD = `${pathD} L ${pts[pts.length-1][0]} ${H} L ${pts[0][0]} ${H} Z`

  return (
    <div style={{ marginTop: 12, overflowX: 'auto' }}>
      <svg width={W} height={H} style={{ display: 'block', margin: '0 auto' }}>
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F7931A" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#F7931A" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#lg)" />
        <path d={pathD} fill="none" stroke={C.accent} strokeWidth="2" strokeLinejoin="round" />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="4" fill={C.accent} stroke={C.bg} strokeWidth="2" />
        ))}
      </svg>
      {/* X labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 20px 0', overflowX: 'auto' }}>
        {rows.map((r, i) => (
          <div key={i} style={{ fontSize: 9, color: C.muted, textAlign: 'center', minWidth: 30 }}>{r.label}</div>
        ))}
      </div>
    </div>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────
function TableBlock({ rows, columns }) {
  if (!rows?.length) return null
  const cols = columns || ['label', 'value']
  return (
    <div style={{ marginTop: 12, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '6px 8px', fontSize: 11, color: C.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, borderBottom: `1px solid ${C.border}` }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid rgba(247,147,26,0.06)` }}>
              <td style={{ padding: '8px 8px', color: C.text }}>{r.label}</td>
              <td style={{ padding: '8px 8px', color: C.accent, fontWeight: 700, textAlign: 'right' }}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Stat number card ─────────────────────────────────────────────────────────
function StatCard({ block }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px', flex: 1, minWidth: 140 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: C.accent }}>
        {ICONS[block.icon] || ICONS.trending}
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{block.label}</span>
      </div>
      <div style={{ fontSize: 36, fontWeight: 900, color: C.accent, lineHeight: 1 }}>{block.value}</div>
      {block.subtitle && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{block.subtitle}</div>}
    </div>
  )
}

// ─── Full block card ──────────────────────────────────────────────────────────
function BlockCard({ block }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ color: C.accent }}>{ICONS[block.icon] || ICONS.chart}</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{block.label}</span>
      </div>
      {block.subtitle && <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{block.subtitle}</div>}

      {block.type === 'bar'   && <BarChart rows={block.rows} />}
      {block.type === 'line'  && <LineChart rows={block.rows} />}
      {block.type === 'table' && <TableBlock rows={block.rows} columns={block.columns} />}
      {block.type === 'list'  && (
        <div style={{ marginTop: 10 }}>
          {(block.rows || []).map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid rgba(247,147,26,0.06)`, fontSize: 13 }}>
              <span style={{ color: C.text }}>{r.label}</span>
              <span style={{ color: C.accent, fontWeight: 700 }}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main PoW Page ────────────────────────────────────────────────────────────
export default function PowPage() {
  const [blocks, setBlocks] = useState(getPowData)
  const [fetching, setFetching] = useState(false)
  const [lastSync, setLastSync] = useState(null)

  const fetchFromNostr = () => {
    setFetching(true)
    const pool = getPool()
    const seen = new Set()
    // latest per block id — same pattern as assessments
    const byId = {}

    const sub = pool.subscribe(
      RELAYS,
      { kinds: [1], '#t': [POW_TAG], limit: 200 },
      {
        onevent(e) {
          if (seen.has(e.id)) return
          seen.add(e.id)
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
          sub.close()
          const result = Object.values(byId)
            .filter(b => !b._deleted)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
          if (result.length > 0) {
            savePowData(result)
            setBlocks(result)
          }
          setFetching(false)
          setLastSync(new Date())
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

      {/* Stat number cards — 2 per row */}
      {statBlocks.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {statBlocks.map(b => <StatCard key={b.id} block={b} />)}
        </div>
      )}

      {/* Chart / table / list blocks */}
      {chartBlocks.map(b => <BlockCard key={b.id} block={b} />)}

      {blocks.length === 0 && !fetching && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted }}>
          <TrendingUp size={36} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>No stats published yet</div>
          <div style={{ fontSize: 13 }}>Admin can add stats from the Admin Panel → PoW tab</div>
        </div>
      )}
    </div>
  )
}

