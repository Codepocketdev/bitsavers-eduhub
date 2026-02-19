import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { isAdmin } from '../config/admins'
import { Users, CheckCircle, Clock, ChevronDown, ChevronUp, Loader, Wifi } from 'lucide-react'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const COHORT_TAG = 'bitsavers-cohort'

const C = {
  bg: '#080808', surface: '#0f0f0f', card: '#141414',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

const getCohorts = () => { try { return JSON.parse(localStorage.getItem('bitsavers_cohorts') || '[]') } catch { return [] } }
const saveCohorts = (c) => localStorage.setItem('bitsavers_cohorts', JSON.stringify(c))

// Publish cohort list to Nostr so ALL devices can see it
const publishCohortToNostr = async (cohortData) => {
  const storedNsec = localStorage.getItem('bitsavers_nsec')
  if (!storedNsec) return
  try {
    const skBytes = nsecToBytes(storedNsec)
    const pool = getPool()
    const event = finalizeEvent({
      kind: 30078,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', cohortData.code],
        ['t', COHORT_TAG],
        ['name', cohortData.name],
        ['code', cohortData.code],
      ],
      content: JSON.stringify(cohortData),
    }, skBytes)
    await Promise.any(pool.publish(RELAYS, event))
  } catch(e) { console.error('Failed to publish cohort:', e) }
}

// Fetch all cohorts from Nostr relays
const fetchCohortsFromNostr = () => new Promise((resolve) => {
  const pool = getPool()
  const found = []
  const seen = new Set()
  const sub = pool.subscribe(
    RELAYS,
    { kinds: [30078], '#t': [COHORT_TAG], limit: 100 },
    {
      onevent(e) {
        if (seen.has(e.id)) return
        seen.add(e.id)
        try {
          const data = JSON.parse(e.content)
          if (data.code && data.name) found.push(data)
        } catch {}
      },
      oneose() {
        sub.close()
        resolve(found)
      }
    }
  )
  setTimeout(() => { sub.close(); resolve(found) }, 6000)
})

// ─── Join Cohort (student) ────────────────────────────────────────────────────
function JoinCohort({ user, onJoined }) {
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [joining, setJoining] = useState(false)

  const join = async () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setJoining(true)
    setMsg('')

    // First check localStorage (admin's own device)
    let cohorts = getCohorts()
    let cohort = cohorts.find(c => c.code === trimmed)

    // If not found locally, fetch from Nostr
    if (!cohort) {
      setMsg('Searching Nostr relays…')
      try {
        const nostrCohorts = await fetchCohortsFromNostr()
        // Merge with local, deduplicate by code
        const merged = [...cohorts]
        nostrCohorts.forEach(nc => {
          if (!merged.find(c => c.code === nc.code)) merged.push(nc)
        })
        saveCohorts(merged)
        cohorts = merged
        cohort = merged.find(c => c.code === trimmed)
      } catch(e) {
        console.error(e)
      }
    }

    if (!cohort) {
      setMsg('err: Cohort not found — check the code and try again')
      setJoining(false)
      return
    }

    if ((cohort.students || []).some(s => s.npub === user.npub)) {
      setMsg('err: You are already in this cohort')
      setJoining(false)
      return
    }

    if (!cohort.students) cohort.students = []
    cohort.students.push({ npub: user.npub, name: user.profile?.name || 'Anonymous', joinedAt: Date.now(), submissions: [] })
    saveCohorts(cohorts)
    setMsg('ok: Joined cohort: ' + cohort.name)
    setJoining(false)
    onJoined()
  }

  const isOk = msg.startsWith('ok:')
  const isErr = msg.startsWith('err:')

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>Join a Cohort</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Enter cohort code e.g. BTC001"
          style={{ flex: 1, background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 14px', color: C.text, fontSize: 14, outline: 'none', fontFamily: 'monospace', letterSpacing: 2 }} />
        <button onClick={join} disabled={!code.trim() || joining} style={{ background: C.accent, border: 'none', color: C.bg, padding: '12px 20px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: (!code.trim() || joining) ? 'not-allowed' : 'pointer', opacity: (!code.trim() || joining) ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          {joining ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Searching…</> : 'Join'}
        </button>
      </div>
      {msg && (
        <div style={{ marginTop: 10, fontSize: 13, color: isOk ? C.green : isErr ? C.red : C.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
          {isOk && <CheckCircle size={13} />}
          {msg.replace(/^(ok|err): /, '')}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ─── Student view — their cohort ──────────────────────────────────────────────
function StudentCohortView({ user }) {
  const cohorts = getCohorts()
  const myCohorts = cohorts.filter(c => c.students.some(s => s.npub === user.npub))
  const [refresh, setRefresh] = useState(0)

  if (myCohorts.length === 0) return (
    <JoinCohort user={user} onJoined={() => setRefresh(r => r+1)} />
  )

  return (
    <div>
      <JoinCohort user={user} onJoined={() => setRefresh(r => r+1)} />
      {myCohorts.map(cohort => {
        const me = cohort.students.find(s => s.npub === user.npub)
        const assignments = cohort.assignments || []
        const submitted = me?.submissions || []

        return (
          <div key={cohort.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{cohort.name}</div>
                <div style={{ fontSize: 11, color: C.accent, fontFamily: 'monospace', marginTop: 2 }}>Code: {cohort.code}</div>
              </div>
              <div style={{ background: C.dim, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: C.accent }}>{cohort.students.length}</div>
                <div style={{ fontSize: 10, color: C.muted }}>students</div>
              </div>
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
              Assignments ({submitted.length}/{assignments.length} done)
            </div>

            {assignments.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>No assignments yet.</div>}

            {assignments.map(a => {
              const done = submitted.includes(a.id)
              return (
                <div key={a.id} style={{ background: '#0a0a0a', border: `1px solid ${done ? 'rgba(34,197,94,0.3)' : C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{a.description}</div>
                      {a.dueDate && <div style={{ fontSize: 11, color: C.accent, marginTop: 6, fontFamily: 'monospace' }}>Due: {a.dueDate}</div>}
                    </div>
                    {done
                      ? <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.green, fontSize: 12, fontWeight: 700, flexShrink: 0 }}><CheckCircle size={14} /> Done</div>
                      : <button onClick={() => {
                          const cohorts = getCohorts()
                          const c = cohorts.find(x => x.id === cohort.id)
                          const s = c.students.find(x => x.npub === user.npub)
                          if (s) { s.submissions = [...(s.submissions||[]), a.id]; saveCohorts(cohorts); setRefresh(r=>r+1) }
                        }} style={{ background: C.accent, border: 'none', color: C.bg, padding: '7px 14px', borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
                          Mark Done
                        </button>
                    }
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ─── Admin view — all cohorts ─────────────────────────────────────────────────
function AdminCohortView({ user }) {
  const [cohorts, setCohortsState] = useState(getCohorts)
  const [expanded, setExpanded] = useState(null)
  const [form, setForm] = useState({ name: '', code: '' })
  const [aForm, setAForm] = useState({ title: '', description: '', dueDate: '' })
  const [addingTo, setAddingTo] = useState(null)
  const [msg, setMsg] = useState('')

  const refresh = () => setCohortsState(getCohorts())

  const createCohort = async () => {
    if (!form.name.trim() || !form.code.trim()) { setMsg('err: Name and code required'); return }
    const code = form.code.trim().toUpperCase()
    if (cohorts.find(c => c.code === code)) { setMsg('err: Code already exists'); return }
    const newCohort = { id: Date.now().toString(), name: form.name.trim(), code, students: [], assignments: [], createdAt: Date.now() }
    const updated = [newCohort, ...cohorts]
    saveCohorts(updated); setCohortsState(updated)
    setForm({ name: '', code: '' })
    setMsg('ok: Cohort created! Publishing to Nostr…')
    // Publish to Nostr so students on other devices can find it
    await publishCohortToNostr(newCohort)
    setMsg('ok: Cohort created and published!')
    setTimeout(() => setMsg(''), 3000)
  }

  const addAssignment = (cohortId) => {
    if (!aForm.title.trim()) return
    const updated = cohorts.map(c => {
      if (c.id !== cohortId) return c
      return { ...c, assignments: [...(c.assignments||[]), { id: Date.now().toString(), ...aForm }] }
    })
    saveCohorts(updated); setCohortsState(updated)
    setAForm({ title: '', description: '', dueDate: '' })
    setAddingTo(null)
  }

  const deleteCohort = (id) => {
    const updated = cohorts.filter(c => c.id !== id)
    saveCohorts(updated); setCohortsState(updated)
  }

  return (
    <div>
      {/* Create cohort */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>Create Cohort</div>
        {msg && <div style={{ fontSize: 13, color: msg.startsWith('ok') ? C.green : C.red, marginBottom: 10, display:'flex', alignItems:'center', gap:6 }}>
        {msg.startsWith('ok') ? <CheckCircle size={13}/> : null}
        {msg.replace(/^(ok|err): /,'')}
      </div>}
        <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Cohort name e.g. Bitcoin Basics Jan 2026"
          style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 14px', color: C.text, fontSize: 14, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
        <input value={form.code} onChange={e => setForm(f=>({...f,code:e.target.value.toUpperCase()}))} placeholder="Cohort code e.g. BTC001"
          style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 14px', color: C.accent, fontSize: 14, outline: 'none', fontFamily: 'monospace', letterSpacing: 2, marginBottom: 12, boxSizing: 'border-box' }} />
        <button onClick={createCohort} style={{ width: '100%', background: C.accent, border: 'none', color: C.bg, padding: '13px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          + Create Cohort
        </button>
      </div>

      {/* Cohorts list */}
      {cohorts.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 14 }}>No cohorts yet. Create one above.</div>}

      {cohorts.map(cohort => {
        const isOpen = expanded === cohort.id
        const assignments = cohort.assignments || []
        const submitted = cohort.students.filter(s => (s.submissions||[]).length === assignments.length && assignments.length > 0)
        const pending = cohort.students.filter(s => (s.submissions||[]).length < assignments.length)

        return (
          <div key={cohort.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 14, overflow: 'hidden' }}>
            {/* Cohort header */}
            <div style={{ padding: '18px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }} onClick={() => setExpanded(isOpen ? null : cohort.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{cohort.name}</div>
                <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: C.accent, fontFamily: 'monospace' }}>{cohort.code}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{cohort.students.length} students</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{assignments.length} assignments</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 7, padding: '4px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.green, lineHeight: 1 }}>{submitted.length}</div>
                  <div style={{ fontSize: 9, color: C.green }}>done</div>
                </div>
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: '4px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.red, lineHeight: 1 }}>{pending.length}</div>
                  <div style={{ fontSize: 9, color: C.red }}>pend</div>
                </div>
                {isOpen ? <ChevronUp size={15} color={C.muted} /> : <ChevronDown size={15} color={C.muted} />}
              </div>
            </div>

            {/* Expanded content */}
            {isOpen && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: 20 }}>
                {/* Assignments */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Assignments</div>
                    <button onClick={() => setAddingTo(addingTo === cohort.id ? null : cohort.id)} style={{ background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      + Add Assignment
                    </button>
                  </div>
                  {addingTo === cohort.id && (
                    <div style={{ background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
                      <input value={aForm.title} onChange={e => setAForm(f=>({...f,title:e.target.value}))} placeholder="Assignment title"
                        style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', marginBottom: 8 }} />
                      <textarea value={aForm.description} onChange={e => setAForm(f=>({...f,description:e.target.value}))} placeholder="Description / instructions…" rows={2}
                        style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit', marginBottom: 8 }} />
                      <input type="date" value={aForm.dueDate} onChange={e => setAForm(f=>({...f,dueDate:e.target.value}))}
                        style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 13, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
                      <button onClick={() => addAssignment(cohort.id)} style={{ width: '100%', background: C.accent, border: 'none', color: C.bg, padding: '11px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        Save Assignment
                      </button>
                    </div>
                  )}
                  {assignments.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>No assignments yet.</div>}
                  {assignments.map(a => (
                    <div key={a.id} style={{ background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 14px', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{a.title}</div>
                      {a.description && <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{a.description}</div>}
                      {a.dueDate && <div style={{ fontSize: 11, color: C.accent, marginTop: 4, fontFamily: 'monospace' }}>Due: {a.dueDate}</div>}
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                        {cohort.students.filter(s => (s.submissions||[]).includes(a.id)).length}/{cohort.students.length} submitted
                      </div>
                    </div>
                  ))}
                </div>

                {/* Students */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Students ({cohort.students.length})</div>
                  {cohort.students.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>No students yet. Share code: <span style={{ color: C.accent, fontFamily: 'monospace' }}>{cohort.code}</span></div>}
                  {cohort.students.map(s => {
                    const done = (s.submissions||[]).length
                    const total = assignments.length
                    const pct = total ? Math.round(done/total*100) : 0
                    return (
                      <div key={s.npub} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: C.bg, flexShrink: 0 }}>
                          {(s.name||'?').slice(0,2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s.name || 'Anonymous'}</div>
                          <div style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.npub?.slice(0,20)}…</div>
                          {total > 0 && (
                            <div style={{ marginTop: 4 }}>
                              <div style={{ height: 4, background: C.dim, borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? C.green : C.accent, borderRadius: 2, transition: 'width 0.3s' }} />
                              </div>
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: pct===100 ? C.green : C.muted, fontWeight: 600, flexShrink: 0 }}>
                          {done}/{total}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <button onClick={() => deleteCohort(cohort.id)} style={{ marginTop: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: C.red, padding: '8px 16px', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Delete Cohort
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function CohortsPage({ user }) {
  const admin = isAdmin(user?.npub)
  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Users size={20} color={C.accent} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{admin ? 'Cohort Management' : 'My Cohort'}</div>
          <div style={{ fontSize: 11, color: C.muted }}>
            {admin ? 'Create cohorts, add assignments, track submissions' : 'View your cohort and submit assignments'}
          </div>
        </div>
      </div>
      {admin ? <AdminCohortView user={user} /> : <StudentCohortView user={user} />}
    </div>
  )
}

