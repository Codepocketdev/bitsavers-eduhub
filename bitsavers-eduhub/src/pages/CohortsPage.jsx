import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { isAdmin } from '../config/admins'
import { Users, CheckCircle, Clock, ChevronDown, ChevronUp, Loader, Wifi } from 'lucide-react'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import { npubEncode, decode as nip19decode } from 'nostr-tools/nip19'

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

// ── Kind:1 member trigger system ─────────────────────────────────────────────
// Borrows the exact feed cache pattern from NostrFeed:
//   - Cache lives OUTSIDE components as module-level object (survives re-renders)
//   - seenIds Set deduplicates events
//   - Subscription writes directly to cache, state is just [...cache.data]
//   - No effect dependencies that change on re-render

// Join  → kind:1  "joined-JET-npub1xxx|Display Name"  #t bitsavers-JET
// Leave → kind:1  "left-JET-npub1xxx|Display Name"    #t bitsavers-JET

// Module-level cache — NEVER resets on re-render
const memberCache = {}
// memberCache['JET'] = { byNpub: {}, seenIds: Set }

// Profile cache — hex pubkey → { name, picture } — survives re-renders
const profileCache = {}

// Fetch kind:0 profiles for a list of hex pubkeys, store in profileCache
const fetchNostrProfiles = (hexPubkeys, onDone) => {
  const missing = hexPubkeys.filter(h => !profileCache[h])
  if (!missing.length) { onDone && onDone(); return }
  const pool = getPool()
  const sub = pool.subscribe(
    RELAYS,
    { kinds: [0], authors: missing, limit: missing.length + 5 },
    {
      onevent(e) {
        try {
          const p = JSON.parse(e.content)
          profileCache[e.pubkey] = {
            name: p.display_name || p.name || null,
            picture: p.picture || null,
          }
        } catch {}
      },
      oneose() { sub.close(); onDone && onDone() }
    }
  )
  setTimeout(() => { sub.close(); onDone && onDone() }, 5000)
}

// Convert npub → hex pubkey
const npubToHex = (npub) => {
  try { return nip19decode(npub).data } catch { return null }
}

const MEMBER_CACHE_KEY = (code) => `bitsavers_mc_${code}`

const getMemberCache = (cohortCode) => {
  if (!memberCache[cohortCode]) {
    // Seed from localStorage on first access — survives page refresh
    let byNpub = {}
    try {
      const stored = localStorage.getItem(MEMBER_CACHE_KEY(cohortCode))
      if (stored) byNpub = JSON.parse(stored)
    } catch {}
    memberCache[cohortCode] = { byNpub, seenIds: new Set(), sub: null }
  }
  return memberCache[cohortCode]
}

const persistMemberCache = (cohortCode) => {
  try {
    const cache = memberCache[cohortCode]
    if (!cache) return
    localStorage.setItem(MEMBER_CACHE_KEY(cohortCode), JSON.stringify(cache.byNpub))
  } catch {}
}

const parseTrigger = (text, cohortCode, pubkeyHex) => {
  const t = text.trim()
  // Determine action from content — support both old (space) and new (pipe) formats
  const isJoin = t.startsWith(`joined-${cohortCode}-`) || t.startsWith(`joined-${cohortCode} `)
  const isLeft = t.startsWith(`left-${cohortCode}-`)  || t.startsWith(`left-${cohortCode} `)
  if (!isJoin && !isLeft) return null
  const action = isJoin ? 'joined' : 'left'
  // Use e.pubkey (hex) as the reliable key — convert to npub for display
  let npub
  try { npub = npubEncode(pubkeyHex) } catch { npub = pubkeyHex }
  // Extract name — try pipe format first, then space format
  const pipeMatch = t.match(/\|(.+)$/)
  const spaceMatch = t.match(/npub1[a-z0-9]+\s+(.+)$/)
  const name = pipeMatch?.[1]?.trim() || spaceMatch?.[1]?.trim() || 'Anonymous'
  return { action, npub, name }
}

const getActiveMembers = (cohortCode) => {
  const cache = getMemberCache(cohortCode)
  return Object.values(cache.byNpub).filter(m => m.action === 'joined')
}

const publishMemberEvent = async (cohortCode, npub, name, action) => {
  const storedNsec = localStorage.getItem('bitsavers_nsec')
  if (!storedNsec) return
  try {
    const skBytes = nsecToBytes(storedNsec)
    const pool = getPool()
    const event = finalizeEvent({
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', `bitsavers-${cohortCode}`],
        ['t', 'bitsavers-cohort'],
      ],
      content: `${action}-${cohortCode}-${npub}|${name}`,
    }, skBytes)
    await Promise.any(pool.publish(RELAYS, event))
    console.log(`✓ ${action} published for ${cohortCode}`)

    // Write into module-level cache + persist to localStorage immediately (optimistic)
    const cache = getMemberCache(cohortCode)
    cache.byNpub[npub] = { npub, name, action, created_at: Math.floor(Date.now()/1000) }
    persistMemberCache(cohortCode)
  } catch(e) { console.error('publishMemberEvent failed:', e) }
}

// Query every relay independently and merge — so one slow/missing relay can't drop members
// Returns cleanup fn
const openMemberSub = (cohortCode, onUpdate) => {
  const cache = getMemberCache(cohortCode)
  const subs = []
  let batchTimer
  let eoseCount = 0

  const processEvent = (e) => {
    if (cache.seenIds.has(e.id)) return
    cache.seenIds.add(e.id)
    const parsed = parseTrigger(e.content, cohortCode, e.pubkey)
    if (!parsed) return
    const { npub, name, action } = parsed
    if (!cache.byNpub[npub] || e.created_at > cache.byNpub[npub].created_at) {
      cache.byNpub[npub] = { npub, name, action, created_at: e.created_at }
    }
  }

  const emit = () => {
    persistMemberCache(cohortCode)
    onUpdate(getActiveMembers(cohortCode).length)
  }

  // Open one WebSocket per relay independently — no shared pool EOSE cutoff
  RELAYS.forEach(relayUrl => {
    try {
      const ws = new WebSocket(relayUrl)
      const subId = `bm-${cohortCode}-${Math.random().toString(36).slice(2,8)}`
      let isInitial = true

      ws.onopen = () => {
        ws.send(JSON.stringify(['REQ', subId,
          { kinds: [1], '#t': [`bitsavers-${cohortCode}`], limit: 500 }
        ]))
      }

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data)
          if (data[0] === 'EVENT' && data[1] === subId) {
            processEvent(data[2])
            if (isInitial) {
              clearTimeout(batchTimer)
              batchTimer = setTimeout(() => { emit() }, 400)
            } else {
              emit() // live event — update immediately
            }
          } else if (data[0] === 'EOSE' && data[1] === subId) {
            isInitial = false
            eoseCount++
            clearTimeout(batchTimer)
            emit() // emit after each relay's EOSE so count updates progressively
          }
        } catch {}
      }

      ws.onerror = () => {}
      subs.push({ ws, subId })
    } catch {}
  })

  return {
    cleanup: () => {
      clearTimeout(batchTimer)
      subs.forEach(({ ws, subId }) => {
        try { ws.send(JSON.stringify(['CLOSE', subId])) } catch {}
        try { ws.close() } catch {}
      })
    }
  }
}

// ─── Join Cohort (student) ────────────────────────────────────────────────────
function JoinCohort({ user, onJoined }) {
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [joining, setJoining] = useState(false)

  const join = async () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setJoining(true)
    setMsg('Searching…')

    let cohorts = getCohorts()
    let cohort = cohorts.find(c => c.code === trimmed)

    if (!cohort) {
      try {
        const nostrCohorts = await fetchCohortsFromNostr()
        nostrCohorts.forEach(nc => {
          if (!cohorts.find(c => c.code === nc.code)) cohorts.push(nc)
        })
        saveCohorts(cohorts)
        cohort = cohorts.find(c => c.code === trimmed)
      } catch(e) { console.error(e) }
    }

    if (!cohort) {
      setMsg('err: Cohort not found — check the code')
      setJoining(false)
      return
    }

    if (!cohort.students) cohort.students = []
    if (cohort.students.some(s => s.npub === user.npub)) {
      setMsg('err: You are already in this cohort')
      setJoining(false)
      return
    }

    const studentEntry = { npub: user.npub, name: user.profile?.name || 'Anonymous', joinedAt: Date.now(), submissions: [] }
    cohort.students.push(studentEntry)
    saveCohorts(cohorts)

    // Publish join event to Nostr so admin sees it from any device
    setMsg('Publishing join to Nostr…')
    await publishMemberEvent(cohort.code, user.npub, studentEntry.name, 'joined')

    setMsg('ok: Joined: ' + cohort.name)
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
  const [refresh, setRefresh] = useState(0)
  const [memberCounts, setMemberCounts] = useState({})
  const [leaving, setLeaving] = useState(null)
  const cohorts = getCohorts()
  const myCohorts = cohorts.filter(c => (c.students || []).some(s => s.npub === user.npub))

  // Store sub refs per cohort code — like feed's subRef
  const subRefs = useRef({})

  useEffect(() => {
    if (myCohorts.length === 0) return

    myCohorts.forEach(cohort => {
      // Show module-level cache count immediately — no async, no flash to zero
      const current = getActiveMembers(cohort.code).length
      setMemberCounts(prev => ({ ...prev, [cohort.code]: current }))

      // Don't re-open if already subscribed for this code
      if (subRefs.current[cohort.code]) return

      const { sub, cleanup } = openMemberSub(cohort.code, (count) => {
        setMemberCounts(prev =>
          prev[cohort.code] === count ? prev : { ...prev, [cohort.code]: count }
        )
      })
      subRefs.current[cohort.code] = cleanup
    })

    return () => {
      // Only close on unmount, not on re-render — same philosophy as feed
      Object.values(subRefs.current).forEach(fn => fn())
      subRefs.current = {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCohorts.length]) // re-run only when number of cohorts changes, not on count update


  const leaveCohort = async (cohort) => {
    setLeaving(cohort.code)
    // Publish leave event to Nostr
    await publishMemberEvent(cohort.code, user.npub, user.profile?.name || 'Anonymous', 'left')
    // Remove from local storage
    const updated = cohorts.map(c => {
      if (c.code !== cohort.code) return c
      return { ...c, students: (c.students || []).filter(s => s.npub !== user.npub) }
    })
    saveCohorts(updated)
    setLeaving(null)
    setRefresh(r => r + 1)
  }

  // Fetch assessments for my cohorts
  const allAssessments = (() => { try { return JSON.parse(localStorage.getItem('bitsavers_assessments') || '[]') } catch { return [] } })()
  const results = (() => { try { return JSON.parse(localStorage.getItem('bitsavers_results') || '[]') } catch { return [] } })()

  if (myCohorts.length === 0) return (
    <JoinCohort user={user} onJoined={() => setRefresh(r => r+1)} />
  )

  return (
    <div>
      <JoinCohort user={user} onJoined={() => setRefresh(r => r+1)} />
      {myCohorts.map(cohort => {
        const assignments = allAssessments.filter(a => a.cohortId === cohort.id)
        const myResults = results.filter(r => r.npub === user.npub && assignments.some(a => a.id === r.assessmentId))
        const realCount = memberCounts[cohort.code] ?? (cohort.students || []).length

        return (
          <div key={cohort.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, marginBottom: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{cohort.name}</div>
                <div style={{ fontSize: 11, color: C.accent, fontFamily: 'monospace', marginTop: 2 }}>Code: {cohort.code}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <button
                  onClick={() => setRefresh(r => r + 1)}
                  title="Refresh member count"
                  style={{ background: C.dim, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', textAlign: 'center', cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 18, fontWeight: 900, color: C.accent, lineHeight: 1 }}>
                    {memberCounts[cohort.code] === undefined ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : memberCounts[cohort.code]}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted }}>students</div>
                </button>
                <button
                  onClick={() => leaveCohort(cohort)}
                  disabled={leaving === cohort.code}
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: C.red, padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  {leaving === cohort.code ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                  Leave
                </button>
              </div>
            </div>

            {/* Progress */}
            <div style={{ background: '#0a0a0a', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Assessments</span>
                <span style={{ fontSize: 12, color: C.muted }}>{myResults.length}/{assignments.length} done</span>
              </div>
              <div style={{ height: 6, background: C.dim, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: assignments.length ? `${(myResults.length/assignments.length)*100}%` : '0%', background: C.accent, borderRadius: 3, transition: 'width 0.5s' }} />
              </div>
            </div>

            {assignments.length === 0 && (
              <div style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '12px 0' }}>No assessments yet — check back soon.</div>
            )}

            {assignments.map(a => {
              const myResult = results.find(r => r.npub === user.npub && r.assessmentId === a.id)
              const done = !!myResult
              return (
                <div key={a.id} style={{ background: '#0a0a0a', border: `2px solid ${done ? 'rgba(34,197,94,0.3)' : C.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
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

// Merge Nostr members into local localStorage cohort record
const mergeMembersLocal = (cohort, members) => {
  const cs = getCohorts()
  const c = cs.find(x => x.id === cohort.id)
  if (!c) return
  if (!c.students) c.students = []
  let changed = false
  members.forEach(m => {
    if (!c.students.find(s => s.npub === m.npub)) {
      c.students.push({ npub: m.npub, name: m.name, joinedAt: Date.now(), submissions: [] })
      changed = true
    }
  })
  if (changed) saveCohorts(cs)
}

// ─── Admin view — all cohorts ─────────────────────────────────────────────────
function AdminCohortView({ user }) {
  const [cohorts, setCohortsState] = useState(getCohorts)
  const [expanded, setExpanded] = useState(null)
  const [form, setForm] = useState({ name: '', code: '' })
  const [msg, setMsg] = useState('')
  const [memberCounts, setMemberCounts] = useState({})
  const [loadingMembers, setLoadingMembers] = useState({})
  const [profiles, setProfiles] = useState(profileCache) // hex → {name, picture}

  const adminSubRef = useRef(null) // like feed's subRef

  useEffect(() => {
    // Close previous sub when switching cohorts — mirrors feed's [tab] dep cleanup
    if (adminSubRef.current) { adminSubRef.current(); adminSubRef.current = null }
    if (!expanded) return

    const cohort = getCohorts().find(c => c.id === expanded)
    if (!cohort) return

    // Show module-level cache instantly — no flash
    const current = getActiveMembers(cohort.code)
    setMemberCounts(prev => ({ ...prev, [cohort.code]: current.length }))
    setLoadingMembers(prev => ({ ...prev, [cohort.code]: current.length === 0 }))
    mergeMembersLocal(cohort, current)
    // Fetch profiles for cached members immediately
    if (current.length > 0) {
      const hexKeys = current.map(m => npubToHex(m.npub)).filter(Boolean)
      fetchNostrProfiles(hexKeys, () => setProfiles({ ...profileCache }))
    }

    const { cleanup } = openMemberSub(cohort.code, (count) => {
      setMemberCounts(prev =>
        prev[cohort.code] === count ? prev : { ...prev, [cohort.code]: count }
      )
      setLoadingMembers(prev => ({ ...prev, [cohort.code]: false }))
      const active = getActiveMembers(cohort.code)
      mergeMembersLocal(cohort, active)
      // Fetch Nostr profiles for all members
      const hexKeys = active.map(m => npubToHex(m.npub)).filter(Boolean)
      fetchNostrProfiles(hexKeys, () => setProfiles({ ...profileCache }))
    })

    adminSubRef.current = cleanup
    return () => { if (adminSubRef.current) { adminSubRef.current(); adminSubRef.current = null } }
  }, [expanded]) // single dep, mirrors feed's [tab]

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
        // Pull assessments from the assessments store (set via Admin Panel → Assignments)
        const allAssessments = (() => { try { return JSON.parse(localStorage.getItem('bitsavers_assessments') || '[]') } catch { return [] } })()
        const assignments = allAssessments.filter(a => a.cohortId === cohort.id)
        const results = (() => { try { return JSON.parse(localStorage.getItem('bitsavers_results') || '[]') } catch { return [] } })()
        const submittedStudents = cohort.students.filter(s => results.some(r => r.npub === s.npub && assignments.some(a => a.id === r.assessmentId)))
        const pendingStudents = cohort.students.filter(s => !results.some(r => r.npub === s.npub && assignments.some(a => a.id === r.assessmentId)))

        return (
          <div key={cohort.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 14, overflow: 'hidden' }}>
            {/* Cohort header */}
            <div style={{ padding: '18px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }} onClick={() => setExpanded(isOpen ? null : cohort.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{cohort.name}</div>
                <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: C.accent, fontFamily: 'monospace' }}>{cohort.code}</span>
                  <span style={{ fontSize: 11, color: C.muted, display:'flex', alignItems:'center', gap:4 }}>
                    {loadingMembers[cohort.code]
                      ? <><Loader size={10} style={{animation:'spin 1s linear infinite'}}/> fetching…</>
                      : <>{memberCounts[cohort.code] ?? cohort.students.length} students</>
                    }
                  </span>
                  <span style={{ fontSize: 11, color: C.muted }}>{assignments.length} assessments</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 7, padding: '4px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.green, lineHeight: 1 }}>{submittedStudents.length}</div>
                  <div style={{ fontSize: 9, color: C.green }}>done</div>
                </div>
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: '4px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.red, lineHeight: 1 }}>{pendingStudents.length}</div>
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
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
                    Assessments ({assignments.length})
                  </div>
                  {assignments.length === 0 && (
                    <div style={{ fontSize: 13, color: C.muted, background: C.dim, borderRadius: 9, padding: '12px 14px' }}>
                      No assessments assigned yet. Go to <strong style={{ color: C.accent }}>Admin Panel → Assignments</strong> to create one for this cohort.
                    </div>
                  )}
                  {assignments.map(a => {
                    const aResults = results.filter(r => r.assessmentId === a.id)
                    return (
                      <div key={a.id} style={{ background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 14px', marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{a.title}</div>
                          {a.timer && <span style={{ fontSize: 11, color: C.red, fontFamily: 'monospace' }}>{a.timer}min</span>}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                          {aResults.length}/{cohort.students.length} submitted · {(a.questions||[]).length} questions
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Students */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Students ({cohort.students.length})</div>
                  {cohort.students.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>No students yet. Share code: <span style={{ color: C.accent, fontFamily: 'monospace' }}>{cohort.code}</span></div>}
                  {cohort.students.map(s => {
                    const done = results.filter(r => r.npub === s.npub && assignments.some(a => a.id === r.assessmentId)).length
                    const total = assignments.length
                    const pct = total ? Math.round(done/total*100) : 0
                    const hexKey = npubToHex(s.npub)
                    const prof = (hexKey && profiles[hexKey]) || {}
                    const displayName = prof.name || s.name || 'Anonymous'
                    const avatar = prof.picture
                    const initials = displayName.slice(0,2).toUpperCase()
                    return (
                      <div key={s.npub} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: C.bg, flexShrink: 0, overflow: 'hidden' }}>
                          {avatar
                            ? <img src={avatar} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display='none' }} />
                            : initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{displayName}</div>
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

