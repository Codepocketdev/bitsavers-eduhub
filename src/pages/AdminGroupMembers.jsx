import { useState } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import { Lock, Globe, Loader, Crown } from 'lucide-react'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const C = {
  bg: '#080808', card: '#141414', border: 'rgba(247,147,26,0.18)',
  accent: '#F7931A', dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444', yellow: '#eab308',
}

const getGroups = () => { try { return JSON.parse(localStorage.getItem('bitsavers_groups') || '[]') } catch { return [] } }
const saveGroups = (g) => localStorage.setItem('bitsavers_groups', JSON.stringify(g))

// ── Cache helpers — single source of truth per group ─────────────────────────
const readMemberCache = (groupId) => {
  try { return JSON.parse(localStorage.getItem(`bitsavers_gmembers_${groupId}`) || '[]') } catch { return [] }
}
const writeMemberCache = (groupId, members) => {
  try {
    localStorage.setItem(`bitsavers_gmembers_${groupId}`, JSON.stringify(members))
    const counts = JSON.parse(localStorage.getItem('bitsavers_group_counts') || '{}')
    counts[groupId] = members.length
    localStorage.setItem('bitsavers_group_counts', JSON.stringify(counts))
  } catch {}
}
const readCounts = () => { try { return JSON.parse(localStorage.getItem('bitsavers_group_counts') || '{}') } catch { return {} } }

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

function Avatar({ profile = {}, size = 36 }) {
  const [err, setErr] = useState(false)
  const initials = (profile.name || '?').slice(0, 2).toUpperCase()
  if (profile.picture && !err)
    return <img src={profile.picture} onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${C.border}`, flexShrink: 0 }} />
  return <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.33, fontWeight: 700, color: '#000', flexShrink: 0 }}>{initials}</div>
}

export default function AdminGroupMembers() {
  const [groups, setGroups] = useState(getGroups)
  const [selected, setSelected] = useState(null)
  const [members, setMembers] = useState([])
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(false)
  const [counts, setCounts] = useState(readCounts)

  const resolveFromNostr = (g) => {
    setLoading(true)
    const profileCache = (() => { try { return JSON.parse(localStorage.getItem('bitsavers_profile_cache') || '{}') } catch { return {} } })()

    const joinTs = {}
    const removeTs = {}
    ;(g.members || []).forEach(pk => { joinTs[pk] = 0 })

    const pool = new SimplePool()
    const sub = pool.subscribe(RELAYS, {
      kinds: [1], '#t': [`bitsavers-group-member-${g.id}`], limit: 500
    }, {
      onevent(e) {
        if (e.content.startsWith('GROUP_MEMBER:')) {
          try {
            const d = JSON.parse(e.content.slice('GROUP_MEMBER:'.length))
            if (d.action === 'join' && e.created_at > (joinTs[e.pubkey] ?? -1))
              joinTs[e.pubkey] = e.created_at
          } catch {}
        } else if (e.content.startsWith('GROUP_MEMBER_REMOVE:')) {
          try {
            const d = JSON.parse(e.content.slice('GROUP_MEMBER_REMOVE:'.length))
            if (d.pubkey && e.created_at > (removeTs[d.pubkey] ?? -1))
              removeTs[d.pubkey] = e.created_at
          } catch {}
        }
      },
      oneose() {
        sub.close()
        const final = Object.keys(joinTs).filter(pk =>
          !removeTs[pk] || joinTs[pk] > removeTs[pk]
        )
        writeMemberCache(g.id, final)
        setMembers(final)
        setCounts(prev => ({ ...prev, [g.id]: final.length }))

        const missing = final.filter(pk => !profileCache[pk])
        if (!missing.length) {
          const p = {}; final.forEach(pk => { if (profileCache[pk]) p[pk] = profileCache[pk] })
          setProfiles(p); setLoading(false); return
        }
        const pSub = pool.subscribe(RELAYS, { kinds: [0], authors: missing, limit: missing.length }, {
          onevent(e) {
            try {
              const p = JSON.parse(e.content)
              profileCache[e.pubkey] = p
              localStorage.setItem('bitsavers_profile_cache', JSON.stringify(profileCache))
              setProfiles(prev => ({ ...prev, [e.pubkey]: p }))
            } catch {}
          },
          oneose() { pSub.close(); setLoading(false) }
        })
        setTimeout(() => { pSub.close(); setLoading(false) }, 8000)
      }
    })
    setTimeout(() => { sub.close(); setLoading(false) }, 10000)
  }

  const selectGroup = (g) => {
    setSelected(g)
    setProfiles({})
    const cached = readMemberCache(g.id)
    const profileCache = (() => { try { return JSON.parse(localStorage.getItem('bitsavers_profile_cache') || '{}') } catch { return {} } })()

    if (cached.length) {
      setMembers(cached)
      const p = {}; cached.forEach(pk => { if (profileCache[pk]) p[pk] = profileCache[pk] })
      setProfiles(p)
      setLoading(false)
    } else {
      setMembers([])
      resolveFromNostr(g)
    }
  }

  const removeMember = async (pubkey) => {
    const newMembers = members.filter(pk => pk !== pubkey)
    const newAdmins = (selected.admins || []).filter(a => a !== pubkey)

    setMembers(newMembers)
    setCounts(prev => ({ ...prev, [selected.id]: newMembers.length }))
    writeMemberCache(selected.id, newMembers)

    const updatedGroup = { ...selected, members: newMembers, admins: newAdmins }
    setSelected(updatedGroup)
    const updatedGroups = groups.map(g => g.id === selected.id ? updatedGroup : g)
    setGroups(updatedGroups); saveGroups(updatedGroups)
    await publishGroup(updatedGroup)

    const nsec = localStorage.getItem('bitsavers_nsec')
    if (nsec) {
      try {
        const skBytes = nsecToBytes(nsec)
        const pool = getPool()
        const ev = finalizeEvent({
          kind: 1, created_at: Math.floor(Date.now() / 1000),
          tags: [['t', 'bitsavers'], ['t', `bitsavers-group-member-${selected.id}`], ['p', pubkey]],
          content: 'GROUP_MEMBER_REMOVE:' + JSON.stringify({ groupId: selected.id, pubkey }),
        }, skBytes)
        await Promise.any(pool.publish(RELAYS, ev))
      } catch {}
    }

    setTimeout(() => resolveFromNostr({ ...selected, members: newMembers, admins: newAdmins }), 3000)
  }

  const toggleAdmin = async (pubkey) => {
    const admins = (selected.admins || []).includes(pubkey)
      ? (selected.admins || []).filter(a => a !== pubkey)
      : [...(selected.admins || []), pubkey]
    const updatedGroup = { ...selected, admins }
    setSelected(updatedGroup)
    const updatedGroups = groups.map(g => g.id === selected.id ? updatedGroup : g)
    setGroups(updatedGroups); saveGroups(updatedGroups)
    await publishGroup(updatedGroup)
  }

  // ── Group list ─────────────────────────────────────────────────────────────
  if (!selected) return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>Select a group to manage its members</div>
      {groups.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>No groups yet</div>}
      {groups.map(g => {
        const cachedCount = counts[g.id] ?? (readMemberCache(g.id).length || (g.members || []).length)
        return (
          <div key={g.id} onClick={() => selectGroup(g)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{g.name}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                {cachedCount} member{cachedCount !== 1 ? 's' : ''} · {(g.admins || []).length} admin{(g.admins || []).length !== 1 ? 's' : ''}
              </div>
            </div>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, flexShrink: 0, background: g.isPrivate ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)', color: g.isPrivate ? C.yellow : C.green, border: `1px solid ${g.isPrivate ? 'rgba(234,179,8,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
              {g.isPrivate ? <><Lock size={9} /> Private</> : <><Globe size={9} /> Public</>}
            </span>
          </div>
        )
      })}
    </div>
  )

  // ── Group detail ───────────────────────────────────────────────────────────
  const admins = selected.admins || []
  const displayCount = counts[selected.id] ?? members.length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => { setSelected(null); setMembers([]) }}
          style={{ background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '8px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{selected.name}</div>
          <div style={{ fontSize: 12, color: C.muted }}>
            {displayCount} member{displayCount !== 1 ? 's' : ''} · {admins.length} admin{admins.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button onClick={() => resolveFromNostr(selected)}
          style={{ background: C.dim, border: `1px solid ${C.border}`, color: C.muted, padding: '8px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
          ↻ Refresh
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '30px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.muted }}>
          <Loader size={16} style={{ animation: 'spin 1s linear infinite', color: C.accent }} />
          <span style={{ fontSize: 13 }}>Loading…</span>
        </div>
      )}

      {!loading && members.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 14 }}>No members yet</div>
      )}

      {members.map(pubkey => {
        const profile = profiles[pubkey] || {}
        const name = profile.name || profile.display_name || pubkey.slice(0, 16) + '…'
        const isAdmin = admins.includes(pubkey)
        return (
          <div key={pubkey} style={{ background: C.card, border: `1px solid ${isAdmin ? 'rgba(247,147,26,0.3)' : C.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar profile={profile} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                {isAdmin && <Crown size={12} color={C.accent} style={{ flexShrink: 0 }} />}
              </div>
              {profile.nip05 && <div style={{ fontSize: 11, color: C.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.nip05}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => toggleAdmin(pubkey)}
                style={{ background: isAdmin ? C.dim : 'transparent', border: `1px solid ${isAdmin ? C.accent : C.border}`, color: isAdmin ? C.accent : C.muted, padding: '6px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                {isAdmin ? 'Remove Admin' : 'Make Admin'}
              </button>
              <button onClick={() => removeMember(pubkey)}
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: C.red, padding: '6px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                Remove
              </button>
            </div>
          </div>
        )
      })}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
