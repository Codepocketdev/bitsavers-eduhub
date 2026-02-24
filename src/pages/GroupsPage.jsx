import { useState, useEffect } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import { nip19 } from 'nostr-tools'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import { Users, Globe, Lock, Search, CheckCircle, Loader, ArrowRight } from 'lucide-react'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

// ── Trusted admin pubkeys — ONLY these can approve group membership ───────────
const SUPER_ADMIN_HEX = (() => {
  try { return nip19.decode('npub10w6ssxk09tz8use8nvw9ujfsl2katfzu6e5lnrdyrxq90xts5qtqj3kz4q').data } catch { return '' }
})()
const isTrustedAdmin = (eventPubkeyHex, group) => {
  if (!eventPubkeyHex) return false
  // Super admin always trusted
  if (eventPubkeyHex === SUPER_ADMIN_HEX) return true
  // Group-level admins stored as hex pubkeys
  return (group?.admins || []).includes(eventPubkeyHex)
}
const C = {
  bg: '#080808', card: '#141414', border: 'rgba(247,147,26,0.18)',
  accent: '#F7931A', dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444', yellow: '#eab308',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const getMemberships = () => { try { return JSON.parse(localStorage.getItem('bitsavers_group_memberships') || '{}') } catch { return {} } }
const saveMemberships = (m) => localStorage.setItem('bitsavers_group_memberships', JSON.stringify(m))
const getPending = () => { try { return JSON.parse(localStorage.getItem('bitsavers_group_pending') || '{}') } catch { return {} } }
const savePending = (p) => localStorage.setItem('bitsavers_group_pending', JSON.stringify(p))
const getCounts = () => {
  try {
    const counts = JSON.parse(localStorage.getItem('bitsavers_group_counts') || '{}')
    // Seed from per-group member cache written by GroupFeedPage so we show cached count immediately
    const groups = JSON.parse(localStorage.getItem('bitsavers_groups') || '[]')
    groups.forEach(g => {
      if (counts[g.id] === undefined) {
        try {
          const cached = JSON.parse(localStorage.getItem(`bitsavers_gmembers_${g.id}`) || '[]')
          if (cached.length) counts[g.id] = cached.length
        } catch {}
      }
    })
    return counts
  } catch { return {} }
}
const saveCounts = (c) => localStorage.setItem('bitsavers_group_counts', JSON.stringify(c))

// ── Module-level cache ────────────────────────────────────────────────────────
const deletedGroups = () => { try { return JSON.parse(localStorage.getItem('bitsavers_deleted_groups') || '[]') } catch { return [] } }

const groupsCache = {
  // Filter deleted groups out of cache on init — same as NewsPage pattern
  list: JSON.parse(localStorage.getItem('bitsavers_groups') || '[]')
    .filter(g => !deletedGroups().includes(g.id)),
}

// Publish GROUP_MEMBER event — the single source of truth for membership + count
const publishMemberEvent = async (groupId, action = 'join') => {
  const nsec = localStorage.getItem('bitsavers_nsec')
  const npub = localStorage.getItem('bitsavers_npub') || ''
  if (!nsec) return
  try {
    const skBytes = nsecToBytes(nsec)
    const pool = getPool()
    const ev = finalizeEvent({
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['t', 'bitsavers'], ['t', `bitsavers-group-member-${groupId}`]],
      content: 'GROUP_MEMBER:' + JSON.stringify({ groupId, npub, action }),
    }, skBytes)
    await Promise.any(pool.publish(RELAYS, ev))
  } catch (e) { console.error('publishMemberEvent failed', e) }
}

// ── Publish a single GROUP_STATE event — the source of truth for user status ──
const publishGroupState = async (groupId, userPubkeyHex, state) => {
  const nsec = localStorage.getItem('bitsavers_nsec')
  if (!nsec) return
  try {
    const skBytes = nsecToBytes(nsec)
    const pool = getPool()
    const ev = finalizeEvent({
      kind: 1, created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['t', 'bitsavers'],
        ['t', `bitsavers-group-state-${groupId}`],
        ['p', userPubkeyHex],
      ],
      content: 'GROUP_STATE:' + JSON.stringify({ state, groupId }),
    }, skBytes)
    await Promise.any(pool.publish(RELAYS, ev))
  } catch {}
}

export default function GroupsPage({ user, onOpenGroup }) {
  const [groups, setGroups] = useState(groupsCache.list)
  const [loading, setLoading] = useState(groupsCache.list.length === 0)
  const [search, setSearch] = useState('')
  const [memberships, setMemberships] = useState(getMemberships)
  const [pending, setPending] = useState(getPending)
  const [memberCounts, setMemberCounts] = useState(getCounts)
  const [codeInput, setCodeInput] = useState({})
  const [codeError, setCodeError] = useState({})
  const [joining, setJoining] = useState({})
  const [verifying, setVerifying] = useState({}) // per-group Nostr confirmation in progress

  const myPubkey = user?.pubkey || ''
  const myNpub = localStorage.getItem('bitsavers_npub') || ''


  // ── Load groups from Nostr ──────────────────────────────────────────────────
  useEffect(() => {
    const pool = new SimplePool()
    const allGroups = {}
    const creatorMap = {} // groupId → creator pubkey
    window._bitsaversCreatorMap = window._bitsaversCreatorMap || {}

    const sub = pool.subscribe(RELAYS, { kinds: [1], '#t': ['bitsavers-group'], limit: 100 }, {
      onevent(e) {
        if (e.content.startsWith('GROUP:')) {
          try {
            const data = JSON.parse(e.content.slice('GROUP:'.length))
            // NewsPage pattern: skip if this ID is in the deleted list
            if (deletedGroups().includes(data.id)) return
            if (!allGroups[data.id] || e.created_at > (allGroups[data.id]._ts || 0)) {
              allGroups[data.id] = { ...data, _ts: e.created_at }
              creatorMap[data.id] = e.pubkey
              window._bitsaversCreatorMap[data.id] = e.pubkey
            }
          } catch {}
        } else if (e.content.startsWith('GROUP_DELETE:')) {
          try {
            const { id } = JSON.parse(e.content.slice('GROUP_DELETE:'.length))
            // Add to persistent deleted list — same as NewsPage
            const del = deletedGroups()
            if (!del.includes(id)) localStorage.setItem('bitsavers_deleted_groups', JSON.stringify([...del, id]))
            // Remove from local cache immediately
            localStorage.setItem('bitsavers_groups', JSON.stringify(
              JSON.parse(localStorage.getItem('bitsavers_groups') || '[]').filter(g => g.id !== id)
            ))
            delete allGroups[id]
            setGroups(prev => prev.filter(g => g.id !== id))
          } catch {}
        }
      },
      oneose() {
        sub.close()
        const merged = {}
        groupsCache.list.forEach(g => { merged[g.id] = g })
        Object.values(allGroups).filter(g => g.name).forEach(g => {
          if (!merged[g.id] || g._ts > (merged[g.id]._ts || 0)) merged[g.id] = g
        })
        const final = Object.values(merged).filter(g => g.name)
        groupsCache.list = final
        localStorage.setItem('bitsavers_groups', JSON.stringify(final))
        setGroups(final)
        setLoading(false)

        // Auto-membership: group creator gets local membership — they still join + get counted normally
        if (myPubkey) {
          const currentM = getMemberships()
          let changed = false
          final.forEach(g => {
            if (creatorMap[g.id] === myPubkey && !currentM[g.id]) {
              currentM[g.id] = true; changed = true
            }
          })
          if (changed) { saveMemberships(currentM); setMemberships({ ...currentM }) }
        }
      }
    })
    setTimeout(() => { sub.close(); setLoading(false) }, 8000)
    return () => sub.close()
  }, [])

  // ── Verify state from Nostr — single GROUP_STATE query per group ────────────
  useEffect(() => {
    if (!myPubkey || !groups.length) return
    const pool = new SimplePool()

    // Mark all groups as verifying
    const verifyingNow = {}
    groups.forEach(g => {
      const creatorMap = window._bitsaversCreatorMap || {}
      if (creatorMap[g.id] !== myPubkey) verifyingNow[g.id] = true
    })
    setVerifying(verifyingNow)

    groups.forEach(g => {
      // Creator is always a member
      const creatorMap = window._bitsaversCreatorMap || {}
      if (creatorMap[g.id] === myPubkey) {
        const m = getMemberships()
        if (!m[g.id]) { m[g.id] = true; saveMemberships(m); setMemberships(prev => ({ ...prev, [g.id]: true })) }
        setVerifying(prev => { const n={...prev}; delete n[g.id]; return n })
        return
      }

      let latestTs = 0
      let latestState = null
      let latestPubkey = null

      pool.subscribe(RELAYS, {
        kinds: [1],
        '#t': [`bitsavers-group-state-${g.id}`],
        '#p': [myPubkey],
        limit: 50,
      }, {
        onevent(e) {
          if (!e.content.startsWith('GROUP_STATE:')) return
          // Confirm the ['p'] tag subject is actually me
          const subjectPubkey = e.tags.find(t => t[0] === 'p')?.[1]
          if (subjectPubkey !== myPubkey) return
          // Only trust: my own events OR trusted admin events
          const isOwnEvent = e.pubkey === myPubkey
          const isAdminEvent = isTrustedAdmin(e.pubkey, g)
          if (!isOwnEvent && !isAdminEvent) return
          try {
            const d = JSON.parse(e.content.slice('GROUP_STATE:'.length))
            if (!d.state) return
            if (e.created_at > latestTs ||
               (e.created_at === latestTs && isAdminEvent)) {
              latestTs = e.created_at
              latestState = d.state
            }
          } catch {}
        },
        oneose() {
          const m = getMemberships()
          const p = getPending()

          if (!latestState) {
            // No state event on Nostr — leave cache as-is (relay miss protection)
            setVerifying(prev => { const n={...prev}; delete n[g.id]; return n })
            return
          }

          // Apply the latest confirmed state
          if (latestState === 'member') {
            m[g.id] = true; delete p[g.id]
          } else if (latestState === 'pending') {
            delete m[g.id]; p[g.id] = { requestTs: latestTs }
          } else if (latestState === 'removed' || latestState === 'rejected') {
            delete m[g.id]; delete p[g.id]
          }

          saveMemberships(m); setMemberships({ ...m })
          savePending(p); setPending({ ...p })
          setVerifying(prev => { const n={...prev}; delete n[g.id]; return n })
        }
      })
    })

    setTimeout(() => pool.destroy?.(), 12000)
  }, [groups.length, myPubkey])

  // ── Fetch member counts — GROUP_STATE wins, GROUP_MEMBER as fallback ─────────
  useEffect(() => {
    if (!groups.length) return
    const pool = new SimplePool()

    groups.forEach(g => {
      const joinTs = {}
      const removeTs = {}
      const stateMap = {} // pubkey → { state, ts }
      let doneSubs = 0

      const onBothDone = () => {
        doneSubs++
        if (doneSubs < 2) return
        const allPks = new Set([...Object.keys(stateMap), ...Object.keys(joinTs)])
        const count = [...allPks].filter(pk => {
          const st = stateMap[pk]
          if (st) return st.state === 'member'
          return joinTs[pk] !== undefined && (!removeTs[pk] || joinTs[pk] > removeTs[pk])
        }).length
        // Only update if count changed — never overwrite cached count with 0
        setMemberCounts(prev => {
          if (count === 0 && (prev[g.id] || 0) > 0) return prev // keep cached, Nostr may still be loading
          if (count === prev[g.id]) return prev // no change, skip re-render
          const updated = { ...prev, [g.id]: count }
          saveCounts(updated)
          return updated
        })
      }

      // ── Q1: GROUP_STATE events — definitive per-user state ──
      pool.subscribe(RELAYS, {
        kinds: [1], '#t': [`bitsavers-group-state-${g.id}`], limit: 500
      }, {
        onevent(e) {
          if (!e.content.startsWith('GROUP_STATE:')) return
          try {
            const d = JSON.parse(e.content.slice('GROUP_STATE:'.length))
            if (!d.state) return
            const subjectPk = e.tags.find(t => t[0] === 'p')?.[1]
            if (!subjectPk) return
            if (!stateMap[subjectPk] || e.created_at > stateMap[subjectPk].ts)
              stateMap[subjectPk] = { state: d.state, ts: e.created_at }
          } catch {}
        },
        oneose() { onBothDone() }
      })

      // ── Q2: GROUP_MEMBER events — legacy fallback ──
      pool.subscribe(RELAYS, {
        kinds: [1], '#t': [`bitsavers-group-member-${g.id}`], limit: 500
      }, {
        onevent(e) {
          if (e.content.startsWith('GROUP_MEMBER:')) {
            try {
              const d = JSON.parse(e.content.slice('GROUP_MEMBER:'.length))
              const memberPk = d.pubkey || e.pubkey
              if (d.action === 'join' && e.created_at > (joinTs[memberPk] || 0))
                joinTs[memberPk] = e.created_at
            } catch {}
          } else if (e.content.startsWith('GROUP_MEMBER_REMOVE:')) {
            try {
              const d = JSON.parse(e.content.slice('GROUP_MEMBER_REMOVE:'.length))
              if (d.pubkey && e.created_at > (removeTs[d.pubkey] || 0))
                removeTs[d.pubkey] = e.created_at
            } catch {}
          }
        },
        oneose() { onBothDone() }
      })
    })

    setTimeout(() => pool.destroy?.(), 12000)
  }, [groups.length])

  // ── Join public group ───────────────────────────────────────────────────────
  const joinPublic = async (group) => {
    setJoining(p => ({ ...p, [group.id]: true }))
    await publishGroupState(group.id, myPubkey, 'member')
    await publishMemberEvent(group.id, 'join') // keep for member count
    const newM = { ...getMemberships(), [group.id]: true }
    setMemberships(newM); saveMemberships(newM)
    setMemberCounts(prev => {
      const updated = { ...prev, [group.id]: (prev[group.id] || 0) + 1 }
      saveCounts(updated); return updated
    })
    setJoining(p => ({ ...p, [group.id]: false }))
  }

  // ── Request to join private group ───────────────────────────────────────────
  const requestJoin = async (group) => {
    setJoining(p => ({ ...p, [group.id]: true }))
    const nsec = localStorage.getItem('bitsavers_nsec')
    if (nsec) {
      try {
        const skBytes = nsecToBytes(nsec)
        const pool = getPool()
        // Publish GROUP_STATE:pending — single source of truth for user status
        const ev = finalizeEvent({
          kind: 1, created_at: Math.floor(Date.now() / 1000),
          tags: [['t', 'bitsavers'], ['t', `bitsavers-group-state-${group.id}`], ['p', myPubkey]],
          content: 'GROUP_STATE:' + JSON.stringify({ state: 'pending', groupId: group.id, npub: myNpub }),
        }, skBytes)
        await Promise.any(pool.publish(RELAYS, ev))
        // Also publish old GROUP_REQUEST for AdminGroupRequests panel to pick up
        const reqEv = finalizeEvent({
          kind: 1, created_at: Math.floor(Date.now() / 1000),
          tags: [['t', 'bitsavers'], ['t', `bitsavers-group-request-${group.id}`], ['p', myPubkey]],
          content: 'GROUP_REQUEST:' + JSON.stringify({ groupId: group.id, npub: myNpub }),
        }, skBytes)
        await Promise.any(pool.publish(RELAYS, reqEv))
      } catch {}
    }
    const requestTs = Math.floor(Date.now() / 1000)
    const newP = { ...getPending(), [group.id]: { requestTs } }
    setPending(newP); savePending(newP)
    setJoining(p => ({ ...p, [group.id]: false }))
  }

  // ── Join private group with code ────────────────────────────────────────────
  const joinWithCode = async (group) => {
    const code = (codeInput[group.id] || '').trim().toUpperCase()
    if (!code) return
    if (code !== (group.code || '').toUpperCase()) {
      setCodeError(p => ({ ...p, [group.id]: 'Wrong code — try again' })); return
    }
    setCodeError(p => ({ ...p, [group.id]: '' }))
    await joinPublic(group) // same flow as public once code is validated
  }

  const filtered = groups.filter(g => !search || (g.name + g.institution + g.description).toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 4px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.text, marginBottom: 4 }}>Communities</div>
        <div style={{ fontSize: 13, color: C.muted }}>Join a group to connect with your cohort</div>
      </div>

      <div style={{ position: 'relative', marginBottom: 18 }}>
        <Search size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search groups…"
          style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 11, padding: '12px 12px 12px 36px', color: C.text, fontSize: 13, outline: 'none' }} />
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '50px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.muted }}>
          <Loader size={18} style={{ animation: 'spin 1s linear infinite', color: C.accent }} />
          <span style={{ fontSize: 14 }}>Connecting to Nostr relays…</span>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Users size={40} color={C.muted} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: 15, color: C.muted }}>No groups yet</div>
        </div>
      )}

      {filtered.map(group => {
        const isMember = !!memberships[group.id]
        const isPending = !!pending[group.id]
        const isJoining = !!joining[group.id]
        const isVerifying = !!verifying[group.id]
        const count = memberCounts[group.id] ?? (group.members || []).length

        return (
          <div key={group.id} style={{ background: C.card, border: `1px solid ${isMember ? 'rgba(34,197,94,0.3)' : C.border}`, borderRadius: 16, marginBottom: 14, overflow: 'hidden' }}>
            {group.coverImage && <img src={group.coverImage} alt={group.name} style={{ width: '100%', display: 'block' }} />}

            <div style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 3 }}>{group.name}</div>
                  {group.institution && <div style={{ fontSize: 12, color: C.muted }}>{group.institution}</div>}
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '4px 9px', borderRadius: 20, flexShrink: 0,
                  background: group.isPrivate ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)',
                  color: group.isPrivate ? C.yellow : C.green,
                  border: `1px solid ${group.isPrivate ? 'rgba(234,179,8,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
                  {group.isPrivate ? <><Lock size={9} /> Private</> : <><Globe size={9} /> Public</>}
                </span>
              </div>

              {group.description && <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 12 }}>{group.description}</div>}

              <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
                <Users size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                {count} member{count !== 1 ? 's' : ''}
              </div>

              {/* ── Verifying badge — shows while Nostr confirms, doesn't hide buttons ── */}
              {isVerifying && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 11, color: C.muted }}>
                  <Loader size={11} style={{ animation: 'spin 1s linear infinite', color: C.accent, flexShrink: 0 }} />
                  Confirming with Nostr…
                </div>
              )}

              {/* ── Action button — shows cached state immediately, updates when Nostr confirms ── */}
              {isMember ? (
                <button onClick={() => onOpenGroup(group)}
                  style={{ width: '100%', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: C.green, padding: '13px', borderRadius: 11, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <CheckCircle size={15} /> Open Group <ArrowRight size={14} />
                </button>
              ) : isPending ? (
                <div style={{ textAlign: 'center', padding: '13px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 11, fontSize: 13, fontWeight: 700, color: C.yellow }}>
                  Request sent — waiting for approval
                </div>
              ) : group.isPrivate ? (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input value={codeInput[group.id] || ''} onChange={e => setCodeInput(p => ({ ...p, [group.id]: e.target.value.toUpperCase() }))}
                      placeholder="Enter invite code"
                      style={{ flex: 1, background: '#1a1a1a', border: `1px solid ${codeError[group.id] ? 'rgba(239,68,68,0.5)' : C.border}`, borderRadius: 9, padding: '11px 13px', color: C.accent, fontSize: 13, outline: 'none', letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase' }} />
                    <button onClick={() => joinWithCode(group)} disabled={isJoining}
                      style={{ background: C.accent, border: 'none', color: '#000', padding: '11px 16px', borderRadius: 9, fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>
                      {isJoining ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Join'}
                    </button>
                  </div>
                  {codeError[group.id] && <div style={{ fontSize: 12, color: C.red, marginBottom: 8 }}>{codeError[group.id]}</div>}
                  <button onClick={() => requestJoin(group)} disabled={isJoining}
                    style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, padding: '11px', borderRadius: 9, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                    Request to Join Instead
                  </button>
                </div>
              ) : (
                <button onClick={() => joinPublic(group)} disabled={isJoining}
                  style={{ width: '100%', background: C.accent, border: 'none', color: '#000', padding: '13px', borderRadius: 11, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {isJoining ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <><Users size={15} /> Join Group</>}
                </button>
              )}
            </div>
          </div>
        )
      })}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

