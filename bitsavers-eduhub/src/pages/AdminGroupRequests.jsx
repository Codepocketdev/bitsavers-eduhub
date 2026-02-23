import { useState, useEffect } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import { Lock, Loader, CheckCircle, XCircle } from 'lucide-react'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const C = {
  bg: '#080808', card: '#141414', border: 'rgba(247,147,26,0.18)',
  accent: '#F7931A', dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444', yellow: '#eab308',
}
const getGroups = () => { try { return JSON.parse(localStorage.getItem('bitsavers_groups') || '[]') } catch { return [] } }
const saveGroups = (g) => localStorage.setItem('bitsavers_groups', JSON.stringify(g))

const publishGroup = async (groupData) => {
  const nsec = localStorage.getItem('bitsavers_nsec')
  if (!nsec) return
  try {
    const skBytes = nsecToBytes(nsec)
    const pool = getPool()
    const ev = finalizeEvent({
      kind: 1, created_at: Math.floor(Date.now() / 1000),
      tags: [['t', 'bitsavers'], ['t', 'bitsavers-group']],
      content: 'GROUP:' + JSON.stringify(groupData),
    }, skBytes)
    await Promise.any(pool.publish(RELAYS, ev))
  } catch {}
}

// ── Single source of truth for user state ────────────────────────────────────
const publishGroupState = async (groupId, userPubkeyHex, state, skBytes) => {
  try {
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

function Avatar({ profile = {}, size = 36 }) {
  const [err, setErr] = useState(false)
  const initials = (profile.name || '?').slice(0, 2).toUpperCase()
  if (profile.picture && !err)
    return <img src={profile.picture} onError={() => setErr(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${C.border}`, flexShrink: 0 }} />
  return <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.33, fontWeight: 700, color: '#000', flexShrink: 0 }}>{initials}</div>
}

export default function AdminGroupRequests() {
  const [groups, setGroups] = useState(getGroups)
  const [requests, setRequests] = useState({})
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const privateGroups = groups.filter(g => g.isPrivate)
    if (!privateGroups.length) { setLoading(false); return }

    const pool = new SimplePool()
    const incoming = {}   // groupId → raw requests from Nostr
    const stateMap = {}   // pubkey → { state, ts } latest GROUP_STATE per user
    let done = 0
    // Each group fires 2 subs (requests + states), so total = privateGroups.length * 2
    const TOTAL = privateGroups.length * 2

    const maybeFinish = () => {
      done++
      if (done < TOTAL) return

      // Filter: only show if latest GROUP_STATE is "pending" (or no state at all = old request)
      const filtered = {}
      privateGroups.forEach(g => {
        filtered[g.id] = (incoming[g.id] || []).filter(r => {
          const st = stateMap[`${g.id}:${r.pubkey}`]
          if (!st) return true                    // no state event — old request, show it
          if (st.state === 'pending') return true // explicitly pending — show
          return false                            // member/removed/rejected — hide
        })
      })

      setRequests(filtered)
      setLoading(false)

      // Fetch profiles for remaining requesters
      const all = Object.values(filtered).flat().map(r => r.pubkey)
      if (!all.length) return
      const pSub = pool.subscribe(RELAYS, { kinds: [0], authors: all, limit: all.length }, {
        onevent(e) { try { setProfiles(prev => ({ ...prev, [e.pubkey]: JSON.parse(e.content) })) } catch {} },
        oneose() { pSub.close() }
      })
      setTimeout(() => pSub.close(), 6000)
    }

    privateGroups.forEach(g => {
      incoming[g.id] = []

      // ── Sub 1: GROUP_REQUEST events — collect all requesters ──
      const reqSub = pool.subscribe(RELAYS, {
        kinds: [1], '#t': [`bitsavers-group-request-${g.id}`], limit: 200
      }, {
        onevent(e) {
          if (!e.content.startsWith('GROUP_REQUEST:')) return
          try {
            const data = JSON.parse(e.content.slice('GROUP_REQUEST:'.length))
            // Keep latest request per pubkey
            const existing = incoming[g.id].find(r => r.pubkey === e.pubkey)
            if (!existing) {
              incoming[g.id].push({ pubkey: e.pubkey, npub: data.npub || '', timestamp: e.created_at })
            } else if (e.created_at > existing.timestamp) {
              existing.timestamp = e.created_at
            }
          } catch {}
        },
        oneose() { reqSub.close(); maybeFinish() }
      })
      setTimeout(() => reqSub.close(), 8000)

      // ── Sub 2: GROUP_STATE events — keyed by ['p'] tag = the subject user ──
      const stateSub = pool.subscribe(RELAYS, {
        kinds: [1], '#t': [`bitsavers-group-state-${g.id}`], limit: 500
      }, {
        onevent(e) {
          if (!e.content.startsWith('GROUP_STATE:')) return
          try {
            const d = JSON.parse(e.content.slice('GROUP_STATE:'.length))
            if (!d.state) return
            // The ['p'] tag identifies WHO this state is about (not who signed it)
            const subjectPubkey = e.tags.find(t => t[0] === 'p')?.[1]
            if (!subjectPubkey) return
            const key = `${g.id}:${subjectPubkey}`
            if (!stateMap[key] || e.created_at > stateMap[key].ts) {
              stateMap[key] = { state: d.state, ts: e.created_at }
            }
          } catch {}
        },
        oneose() { stateSub.close(); maybeFinish() }
      })
      setTimeout(() => stateSub.close(), 8000)
    })
  }, [])

  const approve = async (group, pubkey, npub) => {
    const updated = groups.map(g => g.id !== group.id ? g : { ...g, members: [...new Set([...(g.members || []), pubkey])] })
    setGroups(updated); saveGroups(updated)
    await publishGroup(updated.find(g => g.id === group.id))
    const nsec = localStorage.getItem('bitsavers_nsec')
    if (nsec) {
      try {
        const skBytes = nsecToBytes(nsec)
        const pool = getPool()
        // GROUP_STATE:member — single source of truth
        await publishGroupState(group.id, pubkey, 'member', skBytes)
        // Keep GROUP_APPROVED for backward compat + GROUP_MEMBER for count
        const ev = finalizeEvent({
          kind: 1, created_at: Math.floor(Date.now() / 1000) + 1,
          tags: [['t', 'bitsavers'], ['t', `bitsavers-group-approved-${group.id}`], ['p', pubkey]],
          content: 'GROUP_APPROVED:' + JSON.stringify({ groupId: group.id, npub, pubkey }),
        }, skBytes)
        await Promise.any(pool.publish(RELAYS, ev))
        const memberEv = finalizeEvent({
          kind: 1, created_at: Math.floor(Date.now() / 1000) + 2,
          tags: [['t', 'bitsavers'], ['t', `bitsavers-group-member-${group.id}`], ['p', pubkey]],
          content: 'GROUP_MEMBER:' + JSON.stringify({ groupId: group.id, npub, action: 'join', approvedBy: 'admin' }),
        }, skBytes)
        await Promise.any(pool.publish(RELAYS, memberEv))
      } catch {}
    }
    setRequests(prev => ({ ...prev, [group.id]: (prev[group.id] || []).filter(r => r.pubkey !== pubkey) }))
  }

  const reject = async (group, pubkey) => {
    // Publish rejection to Nostr so user's app can detect and clear pending state
    const nsec = localStorage.getItem('bitsavers_nsec')
    if (nsec) {
      try {
        const skBytes = nsecToBytes(nsec)
        const pool = getPool()
        // GROUP_STATE:rejected — single source of truth
        await publishGroupState(group.id, pubkey, 'rejected', skBytes)
        // Keep GROUP_REJECTED for backward compat
        const ev = finalizeEvent({
          kind: 1, created_at: Math.floor(Date.now() / 1000) + 1,
          tags: [['t', 'bitsavers'], ['t', `bitsavers-group-rejected-${group.id}`], ['p', pubkey]],
          content: 'GROUP_REJECTED:' + JSON.stringify({ groupId: group.id, pubkey }),
        }, skBytes)
        await Promise.any(pool.publish(RELAYS, ev))
      } catch {}
    }
    setRequests(prev => ({ ...prev, [group.id]: (prev[group.id] || []).filter(r => r.pubkey !== pubkey) }))
  }

  const total = Object.values(requests).flat().length
  const privateGroups = groups.filter(g => g.isPrivate)

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '50px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.muted }}>
      <Loader size={18} style={{ animation: 'spin 1s linear infinite', color: C.accent }} />
      <span style={{ fontSize: 14 }}>Connecting to Nostr relays…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!privateGroups.length) return (
    <div style={{ textAlign: 'center', padding: '50px 0', color: C.muted, fontSize: 14 }}>
      <Lock size={28} color={C.muted} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.3 }} />
      No private groups yet
    </div>
  )

  if (!total) return (
    <div style={{ textAlign: 'center', padding: '50px 0', color: C.muted, fontSize: 14 }}>
      <CheckCircle size={28} color={C.green} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.5 }} />
      No pending requests
    </div>
  )

  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{total} pending request{total !== 1 ? 's' : ''}</div>
      {privateGroups.map(g => {
        const reqs = requests[g.id] || []
        if (!reqs.length) return null
        return (
          <div key={g.id} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.accent, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={12} /> {g.name}
              <span style={{ background: C.dim, border: `1px solid ${C.border}`, color: C.text, fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>{reqs.length}</span>
            </div>
            {reqs.map(r => {
              const profile = profiles[r.pubkey] || {}
              const name = profile.name || profile.display_name || r.pubkey.slice(0, 16) + '…'
              return (
                <div key={r.pubkey} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar profile={profile} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    {profile.nip05 && <div style={{ fontSize: 11, color: C.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.nip05}</div>}
                    <div style={{ fontSize: 11, color: C.muted }}>{new Date(r.timestamp * 1000).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => approve(g, r.pubkey, r.npub)} style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: C.green, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={12} /> Approve
                    </button>
                    <button onClick={() => reject(g, r.pubkey)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: C.red, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <XCircle size={12} /> Reject
                    </button>
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

