import { useState, useEffect, useRef } from 'react'
import { Users, CheckCircle, Loader } from 'lucide-react'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

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

function useCohorts() {
  const getCached  = () => { try { return JSON.parse(localStorage.getItem('bitsavers_cohorts') || '{}') } catch { return {} } }
  const getDeleted = () => { try { return JSON.parse(localStorage.getItem('bitsavers_deleted_cohorts') || '[]') } catch { return [] } }

  const [cohorts, setCohorts] = useState(() => {
    const cached  = getCached()
    const deleted = getDeleted()
    return Object.values(cached).filter(c => !deleted.includes(c.code))
  })
  const [joins, setJoins] = useState({})
  const [loading, setLoading] = useState(true)

  // Live ref so join() always reads the latest cohorts, not a stale closure
  const cohortsRef = useRef([])
  useEffect(() => { cohortsRef.current = cohorts }, [cohorts])

  useEffect(() => {
    const cohortsMap = (() => {
      const cached  = getCached()
      const deleted = getDeleted()
      return Object.fromEntries(Object.entries(cached).filter(([code]) => !deleted.includes(code)))
    })()
    const joinsMap   = {}
    const deletedSet = new Set(getDeleted())
    const seen       = new Set()
    const closers    = []

    const flush = () => {
      const list = Object.values(cohortsMap)
      cohortsRef.current = list   // keep ref fresh immediately, before React re-render
      setCohorts(list)
      setJoins({ ...joinsMap })
      setLoading(false)
    }

    const processEvent = (e) => {
      if (seen.has(e.id)) return
      seen.add(e.id)
      const t = e.content

      if (t.startsWith('COHORT_CREATE:')) {
        try {
          const d = JSON.parse(t.slice('COHORT_CREATE:'.length))
          if (d.code && d.name && !deletedSet.has(d.code)) {
            const existing = cohortsMap[d.code]
            if (!existing || e.created_at > (existing._ts || 0)) {
              cohortsMap[d.code] = { ...d, _ts: e.created_at }
              const stored = getCached()
              stored[d.code] = { ...d, _ts: e.created_at }
              localStorage.setItem('bitsavers_cohorts', JSON.stringify(stored))
            }
          }
        } catch {}

      } else if (t.startsWith('COHORT_DELETE:')) {
        const code = t.slice('COHORT_DELETE:'.length).trim()
        deletedSet.add(code)
        delete cohortsMap[code]
        delete joinsMap[code]
        const stored = getCached(); delete stored[code]
        localStorage.setItem('bitsavers_cohorts', JSON.stringify(stored))
        const del = getDeleted()
        if (!del.includes(code)) localStorage.setItem('bitsavers_deleted_cohorts', JSON.stringify([...del, code]))

      } else {
        const m = t.match(/^(joined|left)-([A-Z0-9]+)-([^ |]+)[| ](.+)$/)
        if (m) {
          const [, action, code, npub, name] = m
          if (!joinsMap[code]) joinsMap[code] = {}
          const ex = joinsMap[code][npub]
          if (!ex || e.created_at > ex.ts)
            joinsMap[code][npub] = { npub, name: name.trim(), action, ts: e.created_at }
        }
      }
    }

    const openWS = (url, filter) => {
      let ws, closed = false
      const subId = 'coh-' + Math.random().toString(36).slice(2, 8)
      const go = () => {
        if (closed) return
        ws = new WebSocket(url)
        ws.onopen = () => ws.send(JSON.stringify(['REQ', subId, filter]))
        ws.onmessage = ({ data }) => {
          try {
            const msg = JSON.parse(data)
            if (msg[0] === 'EVENT' && msg[1] === subId) { processEvent(msg[2]); flush() }
            if (msg[0] === 'EOSE') flush()
          } catch {}
        }
        ws.onclose = () => { if (!closed) setTimeout(go, 3000) }
      }
      go()
      closers.push(() => { closed = true; ws?.close() })
    }

    RELAYS.forEach(r => openWS(r, { kinds: [1], '#t': ['bitsavers-cohorts'], limit: 500 }))
    RELAYS.forEach(r => openWS(r, { kinds: [1], '#t': ['bitsavers-cohort'],  limit: 500 }))
    setTimeout(() => setLoading(false), 8000)
    return () => closers.forEach(c => c())
  }, [])

  const memberCount = (code) => Object.values(joins[code] || {}).filter(m => m.action === 'joined').length
  const isJoined    = (code, npub) => { const m = (joins[code] || {})[npub]; return m?.action === 'joined' }

  const optimisticJoin = (code, npub, name) => {
    setJoins(prev => ({
      ...prev,
      [code]: { ...(prev[code] || {}), [npub]: { npub, name, action: 'joined', ts: Math.floor(Date.now() / 1000) } }
    }))
  }

  const optimisticLeave = (code, npub) => {
    setJoins(prev => ({
      ...prev,
      [code]: { ...(prev[code] || {}), [npub]: { ...(prev[code]?.[npub] || {}), action: 'left' } }
    }))
  }

  return { cohorts, cohortsRef, joins, loading, memberCount, isJoined, optimisticJoin, optimisticLeave }
}

export default function CohortsPage({ user }) {
  const { cohorts, cohortsRef, loading, memberCount, isJoined, optimisticJoin, optimisticLeave } = useCohorts()
  const [code, setCode]       = useState('')
  const [joinMsg, setJoinMsg] = useState('')
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(null)

  const allAssessments = (() => { try { return JSON.parse(localStorage.getItem('bitsavers_assessments') || '[]') } catch { return [] } })()
  const results        = (() => { try { return JSON.parse(localStorage.getItem('bitsavers_results')      || '[]') } catch { return [] } })()

  const myCohorts = cohorts.filter(c => isJoined(c.code, user?.npub))

  const join = async () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setJoining(true); setJoinMsg('')

    // Read from ref — always has the latest fetched list even if React state hasn't re-rendered yet
    const cohort = cohortsRef.current.find(c => c.code === trimmed)
    if (!cohort) { setJoinMsg('err: Cohort not found'); setJoining(false); return }
    if (isJoined(cohort.code, user.npub)) { setJoinMsg('err: Already a member'); setJoining(false); return }

    // Show the cohort card immediately, don't wait for Nostr echo
    optimisticJoin(cohort.code, user.npub, user.profile?.name || 'Anonymous')

    await publishKind1(
      `joined-${cohort.code}-${user.npub}|${user.profile?.name || 'Anonymous'}`,
      [['t', `bitsavers-${cohort.code}`], ['t', 'bitsavers-cohort']]
    )
    setJoinMsg('ok: Joined ' + cohort.name)
    setCode('')
    setJoining(false)
  }

  const leave = async (cohort) => {
    setLeaving(cohort.code)
    optimisticLeave(cohort.code, user.npub)
    await publishKind1(
      `left-${cohort.code}-${user.npub}|${user.profile?.name || 'Anonymous'}`,
      [['t', `bitsavers-${cohort.code}`], ['t', 'bitsavers-cohort']]
    )
    setLeaving(null)
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Users size={20} color={C.accent} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>My Cohort</div>
          <div style={{ fontSize: 11, color: C.muted }}>Join a cohort and track your assignments</div>
        </div>
      </div>

      {/* Join box */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Join a Cohort</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && join()}
            placeholder="Enter cohort code e.g. BTC001"
            style={{ flex: 1, background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 14px', color: C.text, fontSize: 14, outline: 'none', fontFamily: 'monospace', letterSpacing: 2 }}
          />
          {/* Removed `loading` from disabled — user can join as soon as they type */}
          <button onClick={join} disabled={!code.trim() || joining}
            style={{ background: C.accent, border: 'none', color: C.bg, padding: '12px 20px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: (!code.trim() || joining) ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            {joining ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Joining…</> : 'Join'}
          </button>
        </div>
        {loading && (
          <div style={{ marginTop: 8, fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Loader size={10} style={{ animation: 'spin 1s linear infinite' }} /> Syncing cohorts from Nostr…
          </div>
        )}
        {joinMsg && (
          <div style={{ marginTop: 10, fontSize: 13, color: joinMsg.startsWith('ok:') ? C.green : C.red, display: 'flex', alignItems: 'center', gap: 6 }}>
            {joinMsg.startsWith('ok:') && <CheckCircle size={13} />}
            {joinMsg.replace(/^(ok|err): /, '')}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && myCohorts.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Loader size={20} style={{ animation: 'spin 1s linear infinite', color: C.accent }} />
          <div style={{ color: C.muted, marginTop: 10, fontSize: 13 }}>Syncing from Nostr…</div>
        </div>
      )}

      {/* Not joined yet */}
      {!loading && myCohorts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 0', color: C.muted, fontSize: 13 }}>
          You haven't joined any cohort yet. Enter a cohort code above.
        </div>
      )}

      {/* My cohorts */}
      {myCohorts.map(cohort => {
        const assignments = allAssessments.filter(a => a.cohortId === cohort.id)
        const myResults   = results.filter(r => r.npub === user.npub && assignments.some(a => a.id === r.assessmentId))
        const count       = memberCount(cohort.code)

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

            {/* Progress bar */}
            <div style={{ background: '#0a0a0a', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Assessments</span>
                <span style={{ fontSize: 12, color: C.muted }}>{myResults.length}/{assignments.length} done</span>
              </div>
              <div style={{ height: 6, background: C.dim, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: assignments.length ? `${(myResults.length / assignments.length) * 100}%` : '0%', background: C.accent, borderRadius: 3, transition: 'width 0.5s' }} />
              </div>
            </div>

            {assignments.length === 0 && (
              <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '12px 0' }}>No assessments yet — check back soon.</div>
            )}

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

