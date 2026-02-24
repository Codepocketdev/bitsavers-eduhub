import { useState } from 'react'
import { Plus, Trash2, Save, TrendingUp, ChevronDown, ChevronUp, GripVertical, Loader, Hash, BarChart2, LineChart as LineChartIcon, Table, List } from 'lucide-react'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const POW_TAG = 'bitsavers-pow'

const C = {
  bg: '#080808', surface: '#0f0f0f', card: '#141414',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

const getPow = () => { try { return JSON.parse(localStorage.getItem('bitsavers_pow') || '[]') } catch { return [] } }
const savePow = (d) => localStorage.setItem('bitsavers_pow', JSON.stringify(d))

const BLOCK_TYPES = [
  { id: 'number', label: 'Number Stat',  icon: <Hash size={13} />,          desc: 'Big number card (e.g. Total Members: 577)' },
  { id: 'bar',    label: 'Bar Chart',    icon: <BarChart2 size={13} />,     desc: 'Horizontal bar chart with labels + values' },
  { id: 'line',   label: 'Line Chart',   icon: <LineChartIcon size={13} />, desc: 'Line graph over time or cohorts' },
  { id: 'table',  label: 'Table',        icon: <Table size={13} />,         desc: 'Two-column table (label / value)' },
  { id: 'list',   label: 'List',         icon: <List size={13} />,          desc: 'Simple key-value list' },
]

const ICON_OPTIONS = ['users', 'globe', 'award', 'trending', 'chart', 'book', 'building']

// ─── Publish helpers ──────────────────────────────────────────────────────────
const publishBlock = async (block) => {
  const nsec = localStorage.getItem('bitsavers_nsec')
  if (!nsec) throw new Error('No private key')
  const skBytes = nsecToBytes(nsec)
  const pool = getPool()
  const event = finalizeEvent({
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['t', 'bitsavers'], ['t', POW_TAG]],
    content: 'POW_BLOCK:' + JSON.stringify(block),
  }, skBytes)
  await Promise.any(pool.publish(RELAYS, event))
}

const publishDelete = async (blockId) => {
  const nsec = localStorage.getItem('bitsavers_nsec')
  if (!nsec) return
  const skBytes = nsecToBytes(nsec)
  const pool = getPool()
  const event = finalizeEvent({
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['t', 'bitsavers'], ['t', POW_TAG]],
    content: 'POW_DELETE:' + JSON.stringify({ id: blockId }),
  }, skBytes)
  await Promise.any(pool.publish(RELAYS, event))
}

// ─── Row editor (for charts/tables/lists) ─────────────────────────────────────
function RowEditor({ rows, onChange, labelPlaceholder = 'Label', valuePlaceholder = 'Value' }) {
  const addRow = () => onChange([...rows, { label: '', value: '' }])
  const updateRow = (i, key, val) => {
    const next = [...rows]
    next[i] = { ...next[i], [key]: val }
    onChange(next)
  }
  const removeRow = (i) => onChange(rows.filter((_, j) => j !== i))

  return (
    <div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <input
            value={row.label} onChange={e => updateRow(i, 'label', e.target.value)}
            placeholder={labelPlaceholder}
            style={{ flex: 2, background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none' }}
          />
          <input
            value={row.value} onChange={e => updateRow(i, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            style={{ flex: 1, background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none' }}
          />
          <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', padding: 4, flexShrink: 0 }}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button onClick={addRow} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
        <Plus size={13} /> Add Row
      </button>
    </div>
  )
}

// ─── Single block editor ──────────────────────────────────────────────────────
function BlockEditor({ block, onSave, onDelete, isNew }) {
  const [b, setB] = useState(block)
  const [open, setOpen] = useState(isNew)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const set = (k, v) => setB(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    if (!b.label?.trim()) { setMsg('err: Label required'); return }
    if (b.type === 'number' && !b.value?.toString().trim()) { setMsg('err: Value required'); return }
    setSaving(true); setMsg('')
    try {
      const final = { ...b, updatedAt: Date.now() }
      await publishBlock(final)
      // Update localStorage
      const all = getPow()
      const idx = all.findIndex(x => x.id === final.id)
      if (idx >= 0) all[idx] = final; else all.push(final)
      savePow(all)
      onSave(final)
      setMsg('ok: Published!')
      setTimeout(() => setMsg(''), 3000)
    } catch(e) { setMsg('err: ' + (e.message || 'Failed')) }
    setSaving(false)
  }

  const del = async () => {
    if (!confirm(`Delete "${b.label}"?`)) return
    setSaving(true)
    try {
      await publishDelete(b.id)
      const all = getPow().filter(x => x.id !== b.id)
      savePow(all)
      onDelete(b.id)
    } catch(e) { setMsg('err: ' + (e.message || 'Failed')) }
    setSaving(false)
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer' }} onClick={() => setOpen(p => !p)}>
        <GripVertical size={14} color={C.muted} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{b.label || 'Untitled block'}</div>
          <div style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>{BLOCK_TYPES.find(t => t.id === b.type)?.icon} {BLOCK_TYPES.find(t => t.id === b.type)?.label || b.type}</div>
        </div>
        {open ? <ChevronUp size={15} color={C.muted} /> : <ChevronDown size={15} color={C.muted} />}
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px 16px' }}>
          {/* Type selector */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {BLOCK_TYPES.map(t => (
                <button key={t.id} onClick={() => set('type', t.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: `1px solid ${b.type === t.id ? C.accent : C.border}`, background: b.type === t.id ? C.dim : 'transparent', color: b.type === t.id ? C.accent : C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Label / Title</label>
            <input value={b.label || ''} onChange={e => set('label', e.target.value)} placeholder="e.g. Total Members"
              style={{ width: '100%', boxSizing: 'border-box', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', color: C.text, fontSize: 14, outline: 'none' }} />
          </div>

          {/* Subtitle */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Subtitle (optional)</label>
            <input value={b.subtitle || ''} onChange={e => set('subtitle', e.target.value)} placeholder="e.g. across 9 cohorts"
              style={{ width: '100%', boxSizing: 'border-box', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
          </div>

          {/* Icon picker */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Icon</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ICON_OPTIONS.map(ic => (
                <button key={ic} onClick={() => set('icon', ic)} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${b.icon === ic ? C.accent : C.border}`, background: b.icon === ic ? C.dim : 'transparent', color: b.icon === ic ? C.accent : C.muted, fontSize: 12, cursor: 'pointer' }}>
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Number type — value input */}
          {b.type === 'number' && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Value</label>
              <input value={b.value || ''} onChange={e => set('value', e.target.value)} placeholder="e.g. 577"
                style={{ width: '100%', boxSizing: 'border-box', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', color: C.accent, fontSize: 24, fontWeight: 900, outline: 'none' }} />
            </div>
          )}

          {/* Chart/table/list — rows editor */}
          {['bar','line','table','list'].includes(b.type) && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                {b.type === 'line' ? 'Data Points' : 'Rows'} (Label + Value)
              </label>
              <RowEditor
                rows={b.rows || []}
                onChange={rows => set('rows', rows)}
                labelPlaceholder={b.type === 'line' ? 'e.g. Cohort 1' : 'e.g. Kenya'}
                valuePlaceholder="e.g. 459"
              />
            </div>
          )}

          {/* Order */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Display Order</label>
            <input type="number" value={b.order ?? 0} onChange={e => set('order', parseInt(e.target.value) || 0)} min="0"
              style={{ width: 80, background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', color: C.text, fontSize: 13, outline: 'none' }} />
            <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>Lower = shown first</span>
          </div>

          {/* Status */}
          {msg && (
            <div style={{ fontSize: 12, color: msg.startsWith('ok') ? C.green : C.red, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              {msg.replace(/^(ok|err): /, '')}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={save} disabled={saving} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: C.accent, border: 'none', color: '#000', padding: '11px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {saving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
              {saving ? 'Publishing…' : 'Save & Publish'}
            </button>
            <button onClick={del} disabled={saving} style={{ flex: 1, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: C.red, padding: '11px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main AdminPoW ────────────────────────────────────────────────────────────
export default function AdminPoW() {
  const [blocks, setBlocks] = useState(getPow)
  const [msg, setMsg] = useState('')

  const addBlock = (type) => {
    const newBlock = {
      id: Date.now().toString(),
      type,
      label: '',
      subtitle: '',
      icon: type === 'number' ? 'trending' : 'chart',
      value: '',
      rows: [],
      order: blocks.length,
      createdAt: Date.now(),
    }
    setBlocks(prev => [...prev, newBlock])
  }

  const onSave = (updated) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === updated.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next }
      return [...prev, updated]
    })
  }

  const onDelete = (id) => setBlocks(prev => prev.filter(b => b.id !== id))

  return (
    <div>
      {/* Add block buttons */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={15} color={C.accent} /> Add New Block
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {BLOCK_TYPES.map(t => (
            <button key={t.id} onClick={() => addBlock(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={13} /> {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
          Each block is published to Nostr — visible to all users instantly
        </div>
      </div>

      {/* Blocks list */}
      {blocks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 13 }}>
          No PoW blocks yet. Add your first stat above.
        </div>
      )}

      {[...blocks].sort((a, b) => (a.order || 0) - (b.order || 0)).map(block => (
        <BlockEditor
          key={block.id}
          block={block}
          onSave={onSave}
          onDelete={onDelete}
          isNew={!block.label}
        />
      ))}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

