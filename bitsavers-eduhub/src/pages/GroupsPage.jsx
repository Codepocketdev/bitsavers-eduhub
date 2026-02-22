import { useState, useEffect } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import { Users, Globe, Lock, Search, CheckCircle, Loader, ArrowRight } from 'lucide-react'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
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
const getCounts = () => { try { return JSON.parse(localStorage.getItem('bitsavers_group_counts') || '{}') } catch { return {} } }
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

  // ── Verify my membership from Nostr on every load ───────────────────────────
  useEffect(() => {
    if (!myPubkey || !groups.length) return
    const pool = new SimplePool()

    groups.forEach(g => {
      // Super admin who created this group — always a member, skip verify
      const creatorMap = window._bitsaversCreatorMap || {}
      if (creatorMap[g.id] === myPubkey) {
        const currentM = getMemberships()
        if (!currentM[g.id]) {
          currentM[g.id] = true
          saveMemberships(currentM)
          setMemberships(prev => ({ ...prev, [g.id]: true }))
        }
        return // no need to query Nostr for creator
      }

      let myJoinTs = 0    // latest join timestamp for me
      let myRemoveTs = 0  // latest remove timestamp for me

      pool.subscribe(RELAYS, {
        kinds: [1],
        '#t': [`bitsavers-group-member-${g.id}`],
        limit: 100,
      }, {
        onevent(e) {
          // My own join events
          if (e.pubkey === myPubkey && e.content.startsWith('GROUP_MEMBER:')) {
            try {
              const d = JSON.parse(e.content.slice('GROUP_MEMBER:'.length))
              if (d.action === 'join' && e.created_at > myJoinTs)
                myJoinTs = e.created_at
            } catch {}
          }
          // Admin remove events tagged with my pubkey
          if (e.content.startsWith('GROUP_MEMBER_REMOVE:')) {
            const pTag = e.tags?.find(t => t[0] === 'p' && t[1] === myPubkey)
            if (pTag) {
              try {
                if (e.created_at > myRemoveTs) myRemoveTs = e.created_at
              } catch {}
            }
          }
        },
        oneose() {
          // Decide once — latest event wins
          const isMember = myJoinTs > 0 && (myRemoveTs === 0 || myJoinTs > myRemoveTs)
          const wasRemoved = myRemoveTs > 0 && myRemoveTs >= myJoinTs

          if (isMember) {
            const currentM = getMemberships()
            if (!currentM[g.id]) {
              currentM[g.id] = true
              saveMemberships(currentM)
              setMemberships(prev => ({ ...prev, [g.id]: true }))
            }
          } else if (wasRemoved) {
            const currentM = getMemberships()
            if (currentM[g.id]) {
              delete currentM[g.id]
              saveMemberships(currentM)
              setMemberships(prev => { const n = { ...prev }; delete n[g.id]; return n })
            }
            const currentP = getPending()
            if (currentP[g.id]) {
              delete currentP[g.id]
              savePending(currentP)
              setPending(prev => { const n = { ...prev }; delete n[g.id]; return n })
            }
          }
          // If neither — no join event found at all — leave localStorage state as-is
        }
      })
    })

    // Check approvals for pending groups
    const pendingGroups = Object.keys(getPending())
    pendingGroups.forEach(groupId => {
      pool.subscribe(RELAYS, {
        kinds: [1], '#t': [`bitsavers-group-approved-${groupId}`], '#p': [myPubkey], limit: 5
      }, {
        onevent(e) {
          if (!e.content.startsWith('GROUP_APPROVED:')) return
          const newM = { ...getMemberships(), [groupId]: true }
          setMemberships(newM); saveMemberships(newM)
          const newP = getPending(); delete newP[groupId]
          setPending({ ...newP }); savePending(newP)
          // Publish member event so count is accurate
          publishMemberEvent(groupId, 'join')
        },
        oneose() {}
      })

      // Rejections
      pool.subscribe(RELAYS, {
        kinds: [1], '#t': [`bitsavers-group-rejected-${groupId}`], '#p': [myPubkey], limit: 5
      }, {
        onevent(e) {
          if (!e.content.startsWith('GROUP_REJECTED:')) return
          const newP = getPending(); delete newP[groupId]
          setPending({ ...newP }); savePending(newP)
        },
        oneose() {}
      })
    })

    setTimeout(() => pool.destroy?.(), 10000)
  }, [groups.length, myPubkey])

  // ── Fetch member counts from Nostr ──────────────────────────────────────────
  // Count = unique pubkeys with GROUP_MEMBER join events minus GROUP_MEMBER_REMOVE events
  useEffect(() => {
    if (!groups.length) return
    const pool = new SimplePool()

    groups.forEach(g => {
      // Seed from BOTH group.members[] AND resolved member cache (whichever has more)
      const joinTs = {}
      const removeTs = {}
      ;(g.members || []).forEach(pk => { joinTs[pk] = 0 })
      // Also seed from the resolved cache written by AdminGroupMembers/GroupFeedPage
      const cachedMembers = (() => { try { return JSON.parse(localStorage.getItem(`bitsavers_gmembers_${g.id}`) || '[]') } catch { return [] } })()
      cachedMembers.forEach(pk => { if (!joinTs[pk]) joinTs[pk] = 0 })

      pool.subscribe(RELAYS, {
        kinds: [1], '#t': [`bitsavers-group-member-${g.id}`], limit: 500
      }, {
        onevent(e) {
          if (e.content.startsWith('GROUP_MEMBER:')) {
            try {
              const d = JSON.parse(e.content.slice('GROUP_MEMBER:'.length))
              if (d.action === 'join' && e.created_at > (joinTs[e.pubkey] || 0))
                joinTs[e.pubkey] = e.created_at
            } catch {}
          } else if (e.content.startsWith('GROUP_MEMBER_REMOVE:')) {
            try {
              const d = JSON.parse(e.content.slice('GROUP_MEMBER_REMOVE:'.length))
              if (d.pubkey && e.created_at > (removeTs[d.pubkey] || 0))
                removeTs[d.pubkey] = e.created_at
            } catch {}
          }
        },
        oneose() {
          const count = Object.keys(joinTs).filter(pk =>
            !removeTs[pk] || joinTs[pk] > removeTs[pk]
          ).length
          setMemberCounts(prev => {
            const updated = { ...prev, [g.id]: count }
            saveCounts(updated)
            return updated
          })
        }
      })
    })

    setTimeout(() => pool.destroy?.(), 12000)
  }, [groups.length])

  // ── Join public group ───────────────────────────────────────────────────────
  const joinPublic = async (group) => {
    setJoining(p => ({ ...p, [group.id]: true }))
    await publishMemberEvent(group.id, 'join')
    const newM = { ...getMemberships(), [group.id]: true }
    setMemberships(newM); saveMemberships(newM)
    // Bump count immediately
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
        const ev = finalizeEvent({
          kind: 1, created_at: Math.floor(Date.now() / 1000),
          tags: [['t', 'bitsavers'], ['t', `bitsavers-group-request-${group.id}`]],
          content: 'GROUP_REQUEST:' + JSON.stringify({ groupId: group.id, npub: myNpub }),
        }, skBytes)
        await Promise.any(pool.publish(RELAYS, ev))
      } catch {}
    }
    const newP = { ...getPending(), [group.id]: true }
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

              {/* ── Action button ── */}
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

