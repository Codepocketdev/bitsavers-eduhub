import { useState, useEffect } from 'react'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import { Award, Plus, Trash2, Eye, EyeOff, Loader, Copy, RefreshCw, Users, Check, ChevronDown } from 'lucide-react'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const CERT_TAG = 'bitsavers-certificates'
const COHORT_TAG = 'bitsavers-cohorts'

const C = {
  bg: '#080808', card: '#141414', surface: '#0f0f0f',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

function generateCode() {
  return 'BSV-' + Math.random().toString(36).slice(2,6).toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase()
}

function publishCerts(certs, nsec) {
  const skBytes = nsecToBytes(nsec)
  const pool = getPool()
  const ev = finalizeEvent({
    kind: 1, created_at: Math.floor(Date.now() / 1000),
    tags: [['t', CERT_TAG]],
    content: 'CERT_REGISTRY:' + JSON.stringify(certs),
  }, skBytes)
  pool.publish(RELAYS, ev)
}

// Fetch all cohorts — kind 1 COHORT_CREATE/DELETE
function fetchCohorts() {
  return new Promise(resolve => {
    const pool = getPool()
    const byCode = {}, deleted = new Set(), seen = new Set()
    const sub = pool.subscribe(RELAYS, { kinds: [1], '#t': [COHORT_TAG], limit: 200 }, {
      onevent(e) {
        if (seen.has(e.id)) return; seen.add(e.id)
        const t = e.content
        if (t.startsWith('COHORT_CREATE:')) {
          try {
            const d = JSON.parse(t.slice('COHORT_CREATE:'.length))
            if (d.code && d.name) {
              if (!byCode[d.code] || e.created_at > byCode[d.code]._ts)
                byCode[d.code] = { ...d, _ts: e.created_at }
            }
          } catch {}
        } else if (t.startsWith('COHORT_DELETE:')) {
          deleted.add(t.slice('COHORT_DELETE:'.length).trim())
        }
      },
      oneose() {
        sub.close()
        resolve(Object.values(byCode).filter(c => !deleted.has(c.code)).map(({ _ts, ...c }) => c))
      }
    })
    setTimeout(() => {
      sub.close()
      resolve(Object.values(byCode).filter(c => !deleted.has(c.code)).map(({ _ts, ...c }) => c))
    }, 6000)
  })
}

// Fetch members of a cohort by code
function fetchMembers(cohortCode) {
  return new Promise(resolve => {
    const pool = getPool()
    const byNpub = {}, seen = new Set()
    const sub = pool.subscribe(RELAYS, { kinds: [1], '#t': [`bitsavers-${cohortCode}`], limit: 500 }, {
      onevent(e) {
        if (seen.has(e.id)) return; seen.add(e.id)
        const t = e.content || ''
        const m = t.match(/^(joined|left)-[^-]+-([^ |]+)[| ](.+)$/)
        if (!m) return
        const [, action, npub, name] = m
        if (!byNpub[npub] || e.created_at > byNpub[npub].ts)
          byNpub[npub] = { npub, name: name.trim(), action, ts: e.created_at }
      },
      oneose() { sub.close(); resolve(Object.values(byNpub).filter(m => m.action === 'joined')) }
    })
    setTimeout(() => { sub.close(); resolve(Object.values(byNpub).filter(m => m.action === 'joined')) }, 8000)
  })
}

const EMPTY = { id: '', cohort: '', cohortCode: '', course: '', issuedBy: 'BitSavers EduHub', claimCode: '', unlocked: false, npubs: '' }

export default function AdminCertificates() {
  const [certs, setCerts] = useState([])
  const [cohorts, setCohorts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [members, setMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [selected, setSelected] = useState(new Set())
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
      oneose() { if (latest.data) setCerts(latest.data); setLoading(false); sub.close() }
    })
    fetchCohorts().then(setCohorts)
    setTimeout(() => { sub.close(); setLoading(false) }, 8000)
    return () => sub.close()
  }, [])

  const showMsg = m => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const selectCohort = async (cohort) => {
    setEditing(p => ({ ...p, cohort: cohort.name, cohortCode: cohort.code }))
    setLoadingMembers(true)
    setMembers([])
    setSelected(new Set())
    const m = await fetchMembers(cohort.code)
    setMembers(m)
    setLoadingMembers(false)
  }

  const toggle = (npub) => setSelected(p => { const n = new Set(p); n.has(npub) ? n.delete(npub) : n.add(npub); return n })

  const applySelected = () => {
    setEditing(p => ({ ...p, npubs: [...selected].join('\n') }))
    showMsg(`✓ ${selected.size} students added`)
  }

  const save = () => {
    if (!editing.cohort.trim() || !editing.course.trim()) { showMsg('err: Cohort and course required'); return }
    const entry = { ...editing, id: editing.id || Date.now().toString(), claimCode: editing.claimCode || generateCode() }
    const updated = editing.id && certs.find(c => c.id === editing.id)
      ? certs.map(c => c.id === editing.id ? entry : c)
      : [...certs, entry]
    setCerts(updated); publishCerts(updated, nsec); setEditing(null); showMsg('✓ Saved!')
  }

  const toggleLock = (id) => {
    const updated = certs.map(c => c.id === id ? { ...c, unlocked: !c.unlocked } : c)
    setCerts(updated); publishCerts(updated, nsec)
    showMsg(updated.find(c => c.id === id).unlocked ? '✓ Unlocked for students' : 'Locked')
  }

  const remove = (id) => { const u = certs.filter(c => c.id !== id); setCerts(u); publishCerts(u, nsec); showMsg('Deleted') }
  const copy = (t) => { navigator.clipboard.writeText(t); showMsg('✓ Copied!') }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '50px 0', color: C.muted }}>
      <Loader size={18} style={{ animation: 'spin 1s linear infinite', color: C.accent, display: 'block', margin: '0 auto 10px' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── Edit form ───────────────────────────────────────────────────────────────
  if (editing) return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 20 }}>
        {editing.id && certs.find(c => c.id === editing.id) ? 'Edit Certificate' : 'New Certificate'}
      </div>

      {msg && <div style={{ background: msg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.startsWith('✓') ? C.green : C.red}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: msg.startsWith('✓') ? C.green : C.red }}>{msg}</div>}

      {/* Cohort dropdown */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Select Cohort</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, overflow: 'hidden' }}>
          {cohorts.length === 0 && <div style={{ padding: '12px 14px', fontSize: 13, color: C.muted }}>No cohorts found</div>}
          {cohorts.map(c => (
            <div key={c.code} onClick={() => selectCohort(c)}
              style={{ padding: '12px 14px', cursor: 'pointer', background: editing.cohortCode === c.code ? C.dim : 'transparent', borderLeft: editing.cohortCode === c.code ? `3px solid ${C.accent}` : '3px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{c.name}</div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>{c.code}</div>
              </div>
              {editing.cohortCode === c.code && <Check size={14} color={C.accent} />}
            </div>
          ))}
        </div>
      </div>

      {/* Course */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Course / Programme</div>
        <input value={editing.course} onChange={e => setEditing(p => ({ ...p, course: e.target.value }))} placeholder="e.g. Bitcoin for Beginners"
          style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '11px 13px', color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Issued By */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Issued By</div>
        <input value={editing.issuedBy} onChange={e => setEditing(p => ({ ...p, issuedBy: e.target.value }))} placeholder="BitSavers EduHub"
          style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '11px 13px', color: C.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Claim code */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Claim Code</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={editing.claimCode} onChange={e => setEditing(p => ({ ...p, claimCode: e.target.value }))} placeholder="Auto-generated if empty"
            style={{ flex: 1, background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '11px 13px', color: C.accent, fontSize: 13, outline: 'none', fontFamily: 'monospace' }} />
          <button onClick={() => setEditing(p => ({ ...p, claimCode: generateCode() }))}
            style={{ background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '0 14px', borderRadius: 9, cursor: 'pointer' }}>
            <RefreshCw size={14} />
          </button>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>Share this with your cohort via WhatsApp or DM</div>
      </div>

      {/* Eligible students */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          Eligible Students
        </div>

        {loadingMembers && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.muted, fontSize: 13, padding: '12px 0' }}>
            <Loader size={14} style={{ animation: 'spin 1s linear infinite', color: C.accent }} /> Loading cohort members…
          </div>
        )}

        {!loadingMembers && members.length === 0 && editing.cohortCode && (
          <div style={{ fontSize: 13, color: C.muted, padding: '10px 0' }}>No members found in this cohort yet</div>
        )}

        {!loadingMembers && members.length > 0 && (
          <>
            <div style={{ background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
              {/* Header */}
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: C.muted }}>{members.length} members</span>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={() => setSelected(new Set(members.map(m => m.npub)))}
                    style={{ fontSize: 11, color: C.green, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Select All</button>
                  <button onClick={() => setSelected(new Set())}
                    style={{ fontSize: 11, color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
                </div>
              </div>
              {/* List */}
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {members.map(m => (
                  <div key={m.npub} onClick={() => toggle(m.npub)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: `1px solid rgba(255,255,255,0.03)`, cursor: 'pointer', background: selected.has(m.npub) ? 'rgba(247,147,26,0.07)' : 'transparent' }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${selected.has(m.npub) ? C.accent : C.border}`, background: selected.has(m.npub) ? C.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {selected.has(m.npub) && <Check size={12} color="#000" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.npub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={applySelected} disabled={selected.size === 0}
              style={{ width: '100%', background: selected.size > 0 ? C.accent : 'rgba(247,147,26,0.2)', border: 'none', color: selected.size > 0 ? '#000' : '#666', padding: '11px', borderRadius: 9, cursor: selected.size > 0 ? 'pointer' : 'not-allowed', fontWeight: 800, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Check size={14} /> Apply {selected.size} Selected Students
            </button>
          </>
        )}

        {/* Summary of applied */}
        {editing.npubs.split('\n').filter(n => n.trim()).length > 0 && (
          <div style={{ fontSize: 12, color: C.green, marginBottom: 6 }}>
            ✓ {editing.npubs.split('\n').filter(n => n.trim()).length} students in eligible list
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setEditing(null)} style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, color: C.muted, padding: '12px', borderRadius: 9, cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
        <button onClick={save} style={{ flex: 2, background: C.accent, border: 'none', color: '#000', padding: '12px', borderRadius: 9, cursor: 'pointer', fontWeight: 800, fontSize: 14 }}>Save Certificate</button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── List view ───────────────────────────────────────────────────────────────
  return (
    <div>
      {msg && (
        <div style={{ background: msg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.startsWith('✓') ? C.green : C.red}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: msg.startsWith('✓') ? C.green : C.red }}>
          {msg}
        </div>
      )}

      <button onClick={() => { setEditing({ ...EMPTY }); setMembers([]); setSelected(new Set()) }}
        style={{ width: '100%', background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '13px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
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
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{cert.course}</div>
              <div style={{ fontSize: 12, color: C.accent, marginTop: 2 }}>{cert.cohort}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                {cert.npubs?.split('\n').filter(n => n.trim()).length || 0} eligible students
              </div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: cert.unlocked ? 'rgba(34,197,94,0.12)' : 'rgba(100,100,100,0.12)', color: cert.unlocked ? C.green : C.muted, flexShrink: 0 }}>
              {cert.unlocked ? 'UNLOCKED' : 'LOCKED'}
            </span>
          </div>

          {/* Claim code */}
          <div style={{ background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>CLAIM CODE</div>
              <div style={{ fontSize: 13, fontFamily: 'monospace', color: C.accent, letterSpacing: 1 }}>
                {showCode[cert.id] ? cert.claimCode : '••••••••••••••'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setShowCode(p => ({ ...p, [cert.id]: !p[cert.id] }))}
                style={{ background: C.dim, border: `1px solid ${C.border}`, color: C.muted, padding: '5px 8px', borderRadius: 7, cursor: 'pointer' }}>
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
            <button onClick={() => toggleLock(cert.id)} style={{ flex: 1, background: cert.unlocked ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${cert.unlocked ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, color: cert.unlocked ? C.red : C.green, padding: '9px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              {cert.unlocked ? <><EyeOff size={12} /> Lock</> : <><Eye size={12} /> Unlock</>}
            </button>
            <button onClick={() => { setEditing(cert); setMembers([]); setSelected(new Set()) }} style={{ flex: 1, background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '9px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>Edit</button>
            <button onClick={() => remove(cert.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: C.red, padding: '9px 12px', borderRadius: 8, cursor: 'pointer' }}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

