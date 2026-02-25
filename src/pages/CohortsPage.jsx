import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { isAdmin } from '../config/admins'
import { Users, CheckCircle, Loader, ChevronDown, ChevronUp } from 'lucide-react'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import { npubEncode, decode as nip19decode } from 'nostr-tools/nip19'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const COHORT_TAG = 'bitsavers-cohorts'

const C = {
  bg: '#080808', surface: '#0f0f0f', card: '#141414',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

const publishKind1 = async (content, tags) => {
  const pool = getPool()
  const template = { kind: 1, created_at: Math.floor(Date.now() / 1000), tags, content }
  try {
    const nsec = localStorage.getItem('bitsavers_nsec')
    if (nsec) {
      const ev = finalizeEvent(template, nsecToBytes(nsec))
      await Promise.any(pool.publish(RELAYS, ev))
    } else if (window.nostr) {
      const ev = await window.nostr.signEvent(template)
      await Promise.any(pool.publish(RELAYS, ev))
    }
  } catch(e) { console.error('publishKind1 failed:', e) }
}

const npubToHex = (npub) => { try { return nip19decode(npub).data } catch { return null } }

const profileCache = {}
const fetchProfiles = (hexKeys, onDone) => {
  const missing = hexKeys.filter(h => !profileCache[h])
  if (!missing.length) { onDone?.(); return }
  const pool = getPool()
  const sub = pool.subscribe(RELAYS, { kinds: [0], authors: missing, limit: missing.length + 5 }, {
    onevent(e) {
      try {
        const p = JSON.parse(e.content)
        profileCache[e.pubkey] = { name: p.display_name || p.name || null, picture: p.picture || null }
      } catch {}
    },
    oneose() { sub.close(); onDone?.() }
  })
  setTimeout(() => { sub.close(); onDone?.() }, 5000)
}

function useNostrCohorts(myNpub) {
  const [cohorts, setCohorts] = useState({})
  const [joins, setJoins] = useState({})
  const [loading, setLoading] = useState(true)

  // useRef so ALL WebSocket closures share the SAME object — no stale copies
  const cohortsMapRef = useRef({})
  const joinsMapRef = useRef({})
  const deletedRef = useRef(new Set())
  const seenRef = useRef(new Set())
  const eoseCountRef = useRef(0)
  const totalRelays = RELAYS.length * 2

  useEffect(() => {
    if (!myNpub) return
    const closers = []

    const flush = (live = false) => {
      deletedRef.current.forEach(code => { delete joinsMapRef.current[code] })
      setCohorts({ ...cohortsMapRef.current })
      setJoins({ ...joinsMapRef.current })
      if (live || eoseCountRef.current >= totalRelays) setLoading(false)
    }

    const processEvent = (e) => {
      if (seenRef.current.has(e.id)) return
      seenRef.current.add(e.id)
      const t = e.content

      if (t.startsWith('COHORT_CREATE:')) {
        try {
          const d = JSON.parse(t.slice('COHORT_CREATE:'.length))
          if (d.code && d.name && !deletedRef.current.has(d.code)) {
            if (!cohortsMapRef.current[d.code] || e.created_at > cohortsMapRef.current[d.code]._ts)
              cohortsMapRef.current[d.code] = { ...d, _ts: e.created_at }
          }
        } catch {}

      } else if (t.startsWith('COHORT_DELETE:')) {
        const code = t.slice('COHORT_DELETE:'.length).trim()
        deletedRef.current.add(code)
        delete cohortsMapRef.current[code]
        delete joinsMapRef.current[code]

      } else {
        const m = t.match(/^(joined|left)-([A-Z0-9]+)-([^ |]+)[| ](.+)$/)
        if (m) {
          const [, action, code, npub, name] = m
          if (!joinsMapRef.current[code]) joinsMapRef.current[code] = {}
          const existing = joinsMapRef.current[code][npub]
          if (!existing || e.created_at > existing.ts)
            joinsMapRef.current[code][npub] = { npub, name: name.trim(), action, ts: e.created_at }
        }
      }
    }

    const openWS = (relayUrl, filter) => {
      let ws, closed = false
      const subId = 'coh-' + Math.random().toString(36).slice(2, 8)
      const connect = () => {
        if (closed) return
        try {
          ws = new WebSocket(relayUrl)
          ws.onopen = () => { if (!closed) ws.send(JSON.stringify(['REQ', subId, filter])) }
          ws.onmessage = ({ data }) => {
            if (closed) return
            let msg; try { msg = JSON.parse(data) } catch { return }
            const [type, id, payload] = msg
            if (type === 'EVENT' && id === subId) { processEvent(payload); flush(true) }
            if (type === 'EOSE' && id === subId) { eoseCountRef.current++; flush() }
          }
          ws.onerror = () => {}
          ws.onclose = () => { if (!closed) setTimeout(connect, 3000) }
        } catch {}
      }
      connect()
      return () => { closed = true; try { ws?.close() } catch {} }
    }

    RELAYS.forEach(relayUrl => {
      closers.push(openWS(relayUrl, { kinds: [1], '#t': [COHORT_TAG], limit: 500 }))
      closers.push(openWS(relayUrl, { kinds: [1], '#t': ['bitsavers-cohort'], limit: 500 }))
    })

    return () => closers.forEach(c => c())
  }, [myNpub])

  const myJoined = Object.values(cohorts).filter(c => {
    const me = (joins[c.code] || {})[myNpub]
    return me && me.action === 'joined'
  })

  const memberCount = (code) =>
    Object.values(joins[code] || {}).filter(m => m.action === 'joined').length

  const getMembers = (code) =>
    Object.values(joins[code] || {}).filter(m => m.action === 'joined')

  const injectCohort = (cohort) => {
    cohortsMapRef.current[cohort.code] = { ...cohort, _ts: Math.floor(Date.now() / 1000) }
    setCohorts({ ...cohortsMapRef.current })
  }

  const removeCohort = (code) => {
    deletedRef.current.add(code)
    delete cohortsMapRef.current[code]
    setCohorts({ ...cohortsMapRef.current })
  }

  return { cohorts: Object.values(cohorts), myJoined, loading, memberCount, getMembers, injectCohort, removeCohort }
}

function JoinCohort({ user, cohorts, loading, onJoin }) {
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [joining, setJoining] = useState(false)

  const join = async () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setJoining(true)
    const cohort = cohorts.find(c => c.code === trimmed)
    if (!cohort) { setMsg('err: Cohort not found or no longer active'); setJoining(false); return }
    await publishKind1(
      `joined-${cohort.code}-${user.npub}|${user.profile?.name || 'Anonymous'}`,
      [['t', `bitsavers-${cohort.code}`], ['t', 'bitsavers-cohort']]
    )
    setMsg('ok: Joined ' + cohort.name)
    setCode('')
    onJoin()
    setJoining(false)
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>Join a Cohort</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Enter cohort code e.g. BTC001"
          style={{ flex: 1, background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 14px', color: C.text, fontSize: 14, outline: 'none', fontFamily: 'monospace', letterSpacing: 2 }} />
        <button onClick={join} disabled={!code.trim() || joining || loading}
          style={{ background: C.accent, border: 'none', color: C.bg, padding: '12px 20px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: (!code.trim() || joining) ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          {joining ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Joining…</> : 'Join'}
        </button>
      </div>
      {msg && (
        <div style={{ marginTop: 10, fontSize: 13, color: msg.startsWith('ok:') ? C.green : C.red, display: 'flex', alignItems: 'center', gap: 6 }}>
          {msg.startsWith('ok:') && <CheckCircle size={13} />}
          {msg.replace(/^(ok|err): /, '')}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function StudentCohortView({ user, onProfileClick }) {
  const [leaving, setLeaving] = useState(null)
  const [tick, setTick] = useState(0)
  const { cohorts, myJoined, loading, memberCount } = useNostrCohorts(user.npub)

  const allAssessments = (() => { try { return JSON.parse(localStorage.getItem('bitsavers_assessments') || '[]') } catch { return [] } })()
  const results = (() => { try { return JSON.parse(localStorage.getItem('bitsavers_results') || '[]') } catch { return [] } })()

  const leave = async (cohort) => {
    setLeaving(cohort.code)
    await publishKind1(
      `left-${cohort.code}-${user.npub}|${user.profile?.name || 'Anonymous'}`,
      [['t', `bitsavers-${cohort.code}`], ['t', 'bitsavers-cohort']]
    )
    setLeaving(null)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <Loader size={20} style={{ animation: 'spin 1s linear infinite', color: C.accent }} />
      <div style={{ color: C.muted, marginTop: 10, fontSize: 13 }}>Syncing from Nostr…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div>
      <JoinCohort user={user} cohorts={cohorts} loading={loading} onJoin={() => setTick(t => t + 1)} />
      {myJoined.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 0', color: C.muted, fontSize: 13 }}>
          You haven't joined any cohort yet. Enter a cohort code above.
        </div>
      )}
      {myJoined.map(cohort => {
        const assignments = allAssessments.filter(a => a.cohortId === cohort.id)
        const myResults = results.filter(r => r.npub === user.npub && assignments.some(a => a.id === r.assessmentId))
        const count = memberCount(cohort.code)
        return (
          <div key={cohort.code} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{cohort.name}</div>
                <div style={{ fontSize: 11, color: C.accent, fontFamily: 'monospace', marginTop: 2 }}>Code: {cohort.code}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ background: C.dim, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.accent, lineHeight: 1 }}>{count}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>students</div>
                </div>
                <button onClick={() => leave(cohort)} disabled={leaving === cohort.code}
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: C.red, padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {leaving === cohort.code ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                  Leave
                </button>
              </div>
            </div>
            <div style={{ background: '#0a0a0a', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Assessments</span>
                <span style={{ fontSize: 12, color: C.muted }}>{myResults.length}/{assignments.length} done</span>
              </div>
              <div style={{ height: 6, background: C.dim, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: assignments.length ? `${(myResults.length / assignments.length) * 100}%` : '0%', background: C.accent, borderRadius: 3, transition: 'width 0.5s' }} />
              </div>
            </div>
            {assignments.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '12px 0' }}>No assessments yet — check back soon.</div>}
            {assignments.map(a => {
              const done = !!results.find(r => r.npub === user.npub && r.assessmentId === a.id)
              return (
                <div key={a.id} style={{ background: '#0a0a0a', border: `2px solid ${done ? 'rgba(34,197,94,0.3)' : C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{a.description}</div>
                      {a.dueDate && <div style={{ fontSize: 11, color: C.accent, marginTop: 6, fontFamily: 'monospace' }}>Due: {a.dueDate}</div>}
                    </div>
                    {done
                      ? <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.green, fontSize: 12, fontWeight: 700 }}><CheckCircle size={14} /> Done</div>
                      : <button style={{ background: C.accent, border: 'none', color: C.bg, padding: '7px 14px', borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Mark Done</button>
                    }
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function AdminCohortView({ user, onProfileClick }) {
  const [form, setForm] = useState({ name: '', code: '' })
  const [msg, setMsg] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [profiles, setProfiles] = useState(profileCache)
  const [creating, setCreating] = useState(false)
  const { cohorts, loading, memberCount, getMembers, injectCohort, removeCohort } = useNostrCohorts(user.npub)

  const allAssessments = (() => { try { return JSON.parse(localStorage.getItem('bitsavers_assessments') || '[]') } catch { return [] } })()
  const results = (() => { try { return JSON.parse(localStorage.getItem('bitsavers_results') || '[]') } catch { return [] } })()

  useEffect(() => {
    if (!expanded) return
    const members = getMembers(expanded)
    const hexKeys = members.map(m => npubToHex(m.npub)).filter(Boolean)
    if (hexKeys.length) fetchProfiles(hexKeys, () => setProfiles({ ...profileCache }))
  }, [expanded, cohorts])

  const create = async () => {
    if (!form.name.trim() || !form.code.trim()) { setMsg('err: Name and code required'); return }
    const code = form.code.trim().toUpperCase()
    if (cohorts.find(c => c.code === code)) { setMsg('err: Code already exists'); return }
    setCreating(true)
    const cohort = { id: Date.now().toString(), name: form.name.trim(), code, createdAt: Date.now() }
    injectCohort(cohort) // optimistic — appears instantly
    await publishKind1('COHORT_CREATE:' + JSON.stringify(cohort), [['t', COHORT_TAG]])
    setForm({ name: '', code: '' })
    setMsg('ok: Cohort created!')
    setCreating(false)
    setTimeout(() => setMsg(''), 3000)
  }

  const remove = async (code) => {
    removeCohort(code) // optimistic — disappears instantly
    await publishKind1('COHORT_DELETE:' + code, [['t', COHORT_TAG]])
    if (expanded === code) setExpanded(null)
  }

  return (
    <div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>Create Cohort</div>
        {msg && (
          <div style={{ fontSize: 13, color: msg.startsWith('ok') ? C.green : C.red, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            {msg.startsWith('ok') && <CheckCircle size={13} />}{msg.replace(/^(ok|err): /, '')}
          </div>
        )}
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Cohort name e.g. Bitcoin Basics Jan 2026"
          style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 14px', color: C.text, fontSize: 14, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
        <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="Cohort code e.g. BTC001"
          style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 14px', color: C.accent, fontSize: 14, outline: 'none', fontFamily: 'monospace', letterSpacing: 2, marginBottom: 12, boxSizing: 'border-box' }} />
        <button onClick={create} disabled={creating}
          style={{ width: '100%', background: C.accent, border: 'none', color: C.bg, padding: '13px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {creating ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Publishing…</> : '+ Create Cohort'}
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 30, color: C.muted, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Loader size={16} style={{ animation: 'spin 1s linear infinite', color: C.accent }} /> Syncing from Nostr…
        </div>
      )}

      {!loading && cohorts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 14 }}>No cohorts yet. Create one above.</div>
      )}

      {cohorts.map(cohort => {
        const isOpen = expanded === cohort.code
        const members = getMembers(cohort.code)
        const assignments = allAssessments.filter(a => a.cohortId === cohort.id)
        const submitted = members.filter(m => results.some(r => r.npub === m.npub && assignments.some(a => a.id === r.assessmentId)))
        const pending = members.filter(m => !results.some(r => r.npub === m.npub && assignments.some(a => a.id === r.assessmentId)))
        const count = memberCount(cohort.code)

        return (
          <div key={cohort.code} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 14, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }} onClick={() => setExpanded(isOpen ? null : cohort.code)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{cohort.name}</div>
                <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: C.accent, fontFamily: 'monospace' }}>{cohort.code}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{count} students</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{assignments.length} assessments</span>
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

            {isOpen && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: 20 }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Assessments ({assignments.length})</div>
                  {assignments.length === 0
                    ? <div style={{ fontSize: 13, color: C.muted, background: C.dim, borderRadius: 9, padding: '12px 14px' }}>No assessments assigned yet. Go to <strong style={{ color: C.accent }}>Admin Panel → Assignments</strong>.</div>
                    : assignments.map(a => (
                        <div key={a.id} style={{ background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 14px', marginBottom: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{a.title}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{results.filter(r => r.assessmentId === a.id).length}/{count} submitted</div>
                        </div>
                      ))
                  }
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Students ({count})</div>
                  {count === 0 && <div style={{ fontSize: 13, color: C.muted }}>No students yet. Share code: <span style={{ color: C.accent, fontFamily: 'monospace' }}>{cohort.code}</span></div>}
                  {members.map(m => {
                    const hexKey = npubToHex(m.npub)
                    const prof = (hexKey && profiles[hexKey]) || {}
                    const name = prof.name || m.name || 'Anonymous'
                    const done = results.filter(r => r.npub === m.npub && assignments.some(a => a.id === r.assessmentId)).length
                    return (
                      <div key={m.npub} onClick={() => hexKey && onProfileClick?.(hexKey, prof)}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#000', flexShrink: 0, overflow: 'hidden' }}>
                          {prof.picture ? <img src={prof.picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} /> : name.slice(0,2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{name}</div>
                          <div style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.npub?.slice(0,24)}…</div>
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, flexShrink: 0 }}>{done}/{assignments.length}</div>
                      </div>
                    )
                  })}
                </div>

                <button onClick={() => remove(cohort.code)}
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: C.red, padding: '8px 16px', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Delete Cohort
                </button>
              </div>
            )}
          </div>
        )
      })}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function CohortsPage({ user, onProfileClick }) {
  const admin = isAdmin(user?.npub)
  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Users size={20} color={C.accent} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{admin ? 'Cohort Management' : 'My Cohort'}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{admin ? 'Create cohorts, add assignments, track submissions' : 'View your cohort and submit assignments'}</div>
        </div>
      </div>
      {admin
        ? <AdminCohortView user={user} onProfileClick={onProfileClick} />
        : <StudentCohortView user={user} onProfileClick={onProfileClick} />
      }
    </div>
  )
}

