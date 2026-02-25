import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import { Award, Plus, Trash2, Eye, EyeOff, Loader, Copy, RefreshCw } from 'lucide-react'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const CERT_TAG = 'bitsavers-certificates'

const C = {
  bg: '#080808', card: '#141414', surface: '#0f0f0f',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

function generateCode() {
  return 'BSV-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase()
}

function publishCerts(certs, nsec) {
  const skBytes = nsecToBytes(nsec)
  const pool = getPool()
  const ev = finalizeEvent({
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['t', CERT_TAG]],
    content: 'CERT_REGISTRY:' + JSON.stringify(certs),
  }, skBytes)
  pool.publish(RELAYS, ev)
}

const EMPTY = { id: '', cohort: '', course: '', issuedBy: 'BitSavers EduHub', claimCode: '', unlocked: false, npubs: '' }

export default function AdminCertificates() {
  const { user } = useAuth()
  const [certs, setCerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [msg, setMsg] = useState('')
  const [showCode, setShowCode] = useState({})
  const nsec = localStorage.getItem('bitsavers_nsec')

  useEffect(() => {
    const pool = getPool()
    let latest = { created_at: 0 }
    const sub = pool.subscribe(RELAYS, { kinds: [1], '#t': [CERT_TAG], limit: 10 }, {
      onevent(e) {
        if (e.content.startsWith('CERT_REGISTRY:') && e.created_at > latest.created_at) {
          try { latest = { created_at: e.created_at, data: JSON.parse(e.content.slice('CERT_REGISTRY:'.length)) } } catch {}
        }
      },
      oneose() {
        if (latest.data) setCerts(latest.data)
        setLoading(false); sub.close()
      }
    })
    setTimeout(() => { sub.close(); setLoading(false) }, 8000)
    return () => sub.close()
  }, [])

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const save = () => {
    if (!editing.cohort.trim() || !editing.course.trim()) { showMsg('err: Cohort and course required'); return }
    const entry = { ...editing, id: editing.id || Date.now().toString(), claimCode: editing.claimCode || generateCode() }
    const updated = editing.id && certs.find(c => c.id === editing.id)
      ? certs.map(c => c.id === editing.id ? entry : c)
      : [...certs, entry]
    setCerts(updated)
    publishCerts(updated, nsec)
    setEditing(null)
    showMsg('✓ Saved!')
  }

  const toggle = (id) => {
    const updated = certs.map(c => c.id === id ? { ...c, unlocked: !c.unlocked } : c)
    setCerts(updated)
    publishCerts(updated, nsec)
    showMsg(updated.find(c => c.id === id).unlocked ? '✓ Certificate unlocked for students' : 'Certificate locked')
  }

  const remove = (id) => {
    const updated = certs.filter(c => c.id !== id)
    setCerts(updated)
    publishCerts(updated, nsec)
    showMsg('Deleted')
  }

  const copy = (text) => { navigator.clipboard.writeText(text); showMsg('✓ Copied!') }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '50px 0', color: C.muted }}>
      <Loader size={18} style={{ animation: 'spin 1s linear infinite', color: C.accent, display: 'block', margin: '0 auto 10px' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (editing) return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 20 }}>
        {editing.id && certs.find(c => c.id === editing.id) ? 'Edit Certificate' : 'New Certificate'}
      </div>

      {[
        ['Cohort Name', 'cohort', 'e.g. Cohort 8'],
        ['Course / Programme', 'course', 'e.g. Bitcoin for Beginners'],
        ['Issued By', 'issuedBy', 'e.g. BitSavers EduHub'],
      ].map(([label, key, ph]) => (
        <div key={key} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
          <input value={editing[key]} onChange={e => setEditing(p => ({ ...p, [key]: e.target.value }))} placeholder={ph}
            style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '11px 13px', color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
      ))}

      {/* Claim code */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Claim Code</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={editing.claimCode} onChange={e => setEditing(p => ({ ...p, claimCode: e.target.value }))} placeholder="Auto-generated if left empty"
            style={{ flex: 1, background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '11px 13px', color: C.accent, fontSize: 13, outline: 'none', fontFamily: 'monospace' }} />
          <button onClick={() => setEditing(p => ({ ...p, claimCode: generateCode() }))}
            style={{ background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '0 14px', borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={14} />
          </button>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>Share this code with your cohort via WhatsApp or DM</div>
      </div>

      {/* Eligible npubs */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Eligible NPUBs (one per line)</div>
        <textarea value={editing.npubs} onChange={e => setEditing(p => ({ ...p, npubs: e.target.value }))} placeholder={'npub1abc...\nnpub1xyz...'} rows={6}
          style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '11px 13px', color: C.text, fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'monospace', boxSizing: 'border-box' }} />
        <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>
          {editing.npubs.split('\n').filter(n => n.trim()).length} npub{editing.npubs.split('\n').filter(n => n.trim()).length !== 1 ? 's' : ''} added
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setEditing(null)} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, color: C.muted, padding: '12px', borderRadius: 9, cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
        <button onClick={save} style={{ flex: 2, background: C.accent, border: 'none', color: '#000', padding: '12px', borderRadius: 9, cursor: 'pointer', fontWeight: 800, fontSize: 14 }}>Save Certificate</button>
      </div>
    </div>
  )

  return (
    <div>
      {msg && (
        <div style={{ background: msg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.startsWith('✓') ? C.green : C.red}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: msg.startsWith('✓') ? C.green : C.red }}>
          {msg}
        </div>
      )}

      <button onClick={() => setEditing({ ...EMPTY })} style={{ width: '100%', background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '13px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
        <Plus size={16} /> New Certificate
      </button>

      {certs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px 0', color: C.muted }}>
          <Award size={36} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>No certificates yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Create one and unlock it for your cohort</div>
        </div>
      )}

      {certs.map(cert => (
        <div key={cert.id} style={{ background: C.card, border: `1px solid ${cert.unlocked ? 'rgba(34,197,94,0.3)' : C.border}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 2 }}>{cert.course}</div>
              <div style={{ fontSize: 12, color: C.accent }}>{cert.cohort}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                {cert.npubs.split('\n').filter(n => n.trim()).length} eligible students
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: cert.unlocked ? 'rgba(34,197,94,0.12)' : 'rgba(100,100,100,0.12)', color: cert.unlocked ? C.green : C.muted }}>
                {cert.unlocked ? 'UNLOCKED' : 'LOCKED'}
              </span>
            </div>
          </div>

          {/* Claim code row */}
          <div style={{ background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>CLAIM CODE</div>
              <div style={{ fontSize: 13, fontFamily: 'monospace', color: C.accent, letterSpacing: 1 }}>
                {showCode[cert.id] ? cert.claimCode : '••••••••••••••'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setShowCode(p => ({ ...p, [cert.id]: !p[cert.id] }))}
                style={{ background: C.dim, border: `1px solid ${C.border}`, color: C.muted, padding: '5px 8px', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {showCode[cert.id] ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
              <button onClick={() => copy(cert.claimCode)}
                style={{ background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Copy size={11} /> Copy
              </button>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => toggle(cert.id)} style={{ flex: 1, background: cert.unlocked ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${cert.unlocked ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, color: cert.unlocked ? C.red : C.green, padding: '9px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              {cert.unlocked ? <><EyeOff size={12} /> Lock</> : <><Eye size={12} /> Unlock</>}
            </button>
            <button onClick={() => setEditing(cert)} style={{ flex: 1, background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '9px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
              Edit
            </button>
            <button onClick={() => remove(cert.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: C.red, padding: '9px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

