import { useState, useEffect } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import { nip19 } from 'nostr-tools'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import { Users, Plus, Trash2, Shield, Lock, Globe, Loader, CheckCircle, XCircle, Crown } from 'lucide-react'
import ImageUpload from '../components/ImageUpload'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const C = {
  bg: '#080808', card: '#141414', border: 'rgba(247,147,26,0.18)',
  accent: '#F7931A', dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444', yellow: '#eab308',
}

const deletedGroups = () => { try { return JSON.parse(localStorage.getItem('bitsavers_deleted_groups') || '[]') } catch { return [] } }
const getGroups = () => {
  try {
    return JSON.parse(localStorage.getItem('bitsavers_groups') || '[]').filter(g => !deletedGroups().includes(g.id))
  } catch { return [] }
}
const saveGroups = (g) => localStorage.setItem('bitsavers_groups', JSON.stringify(g))

const publishGroup = async (groupData) => {
  const nsec = localStorage.getItem('bitsavers_nsec')
  if (!nsec) return false
  try {
    const skBytes = nsecToBytes(nsec)
    const pool = getPool()
    const ev = finalizeEvent({
      kind: 1, created_at: Math.floor(Date.now() / 1000),
      tags: [['t', 'bitsavers'], ['t', 'bitsavers-group']],
      content: 'GROUP:' + JSON.stringify(groupData),
    }, skBytes)
    await Promise.any(pool.publish(RELAYS, ev))
    return true
  } catch { return false }
}


const publishGroupDelete = async (groupId) => {
  const nsec = localStorage.getItem('bitsavers_nsec')
  if (!nsec) return
  try {
    const skBytes = nsecToBytes(nsec)
    const pool = getPool()
    const ev = finalizeEvent({
      kind: 1, created_at: Math.floor(Date.now() / 1000),
      tags: [['t', 'bitsavers'], ['t', 'bitsavers-group']],
      content: 'GROUP_DELETE:' + JSON.stringify({ id: groupId }),
    }, skBytes)
    await Promise.any(pool.publish(RELAYS, ev))
  } catch {}
}

const BLANK = { name: '', description: '', institution: '', coverImage: '', isPrivate: false, code: '' }

function Input({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 5 }}>{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', background: '#1a1a1a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '11px 13px', color: C.text, fontSize: 13, outline: 'none' }} />
    </div>
  )
}

// ── Single source of truth for user state ────────────────────────────────────
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

function Avatar({ profile = {}, size = 36 }) {
  const [err, setErr] = useState(false)
  const initials = (profile.name || '?').slice(0, 2).toUpperCase()
  if (profile.picture && !err)
    return <img src={profile.picture} onError={() => setErr(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${C.border}`, flexShrink: 0 }} />
  return <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.33, fontWeight: 700, color: '#000', flexShrink: 0 }}>{initials}</div>
}

// ── TAB: Groups ───────────────────────────────────────────────────────────────
function GroupsTab({ groups, setGroups }) {
  const [form, setForm] = useState(BLANK)
  const [editingId, setEditingId] = useState(null)
  const [msg, setMsg] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [memberCounts, setMemberCounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bitsavers_group_counts') || '{}') } catch { return {} }
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Fetch accurate member counts — GROUP_STATE wins, GROUP_MEMBER as fallback
  useEffect(() => {
    if (!groups.length) return
    const pool = new SimplePool()
    groups.forEach(g => {
      const joinTs = {}
      const removeTs = {}
      const stateMap = {}
      let doneSubs = 0
      ;(g.members || []).forEach(pk => { joinTs[pk] = 0 })

      const onBothDone = () => {
        doneSubs++
        if (doneSubs < 2) return
        const allPks = new Set([...Object.keys(stateMap), ...Object.keys(joinTs)])
        const count = [...allPks].filter(pk => {
          const st = stateMap[pk]
          if (st) return st.state === 'member'
          return joinTs[pk] !== undefined && (!removeTs[pk] || joinTs[pk] > removeTs[pk])
        }).length
        setMemberCounts(prev => {
          const updated = { ...prev, [g.id]: count }
          localStorage.setItem('bitsavers_group_counts', JSON.stringify(updated))
          return updated
        })
      }

      pool.subscribe(RELAYS, { kinds: [1], '#t': [`bitsavers-group-state-${g.id}`], limit: 500 }, {
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

      pool.subscribe(RELAYS, { kinds: [1], '#t': [`bitsavers-group-member-${g.id}`], limit: 500 }, {
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
        oneose() { onBothDone() }
      })
    })
    setTimeout(() => pool.destroy?.(), 12000)
  }, [groups.length])

  const saveGroup = async () => {
    if (!form.name.trim()) { setMsg('err: Group name required'); return }
    if (form.isPrivate && !form.code.trim()) { setMsg('err: Private group needs an invite code'); return }
    setPublishing(true); setMsg('Publishing…')
    const groupData = editingId
      ? { ...groups.find(g => g.id === editingId), ...form }
      : { id: Date.now().toString(), ...form, members: [], admins: [], createdAt: Date.now() }
    const updated = editingId ? groups.map(g => g.id === editingId ? groupData : g) : [groupData, ...groups]
    setGroups(updated); saveGroups(updated)
    const ok = await publishGroup(groupData)
    // On new group creation — publish admin's join event so they're counted as a member
    if (!editingId) {
      try {
        const skBytes = nsecToBytes(localStorage.getItem('bitsavers_nsec'))
        const pool = getPool()
        const npub = localStorage.getItem('bitsavers_npub') || ''
        const joinEv = finalizeEvent({
          kind: 1, created_at: Math.floor(Date.now() / 1000),
          tags: [['t', 'bitsavers'], ['t', `bitsavers-group-member-${groupData.id}`]],
          content: 'GROUP_MEMBER:' + JSON.stringify({ groupId: groupData.id, npub, action: 'join' }),
        }, skBytes)
        await Promise.any(pool.publish(RELAYS, joinEv))
        const memberships = (() => { try { return JSON.parse(localStorage.getItem('bitsavers_group_memberships') || '{}') } catch { return {} } })()
        memberships[groupData.id] = true
        localStorage.setItem('bitsavers_group_memberships', JSON.stringify(memberships))
      } catch {}
    }
    setMsg(ok ? 'ok: Saved!' : 'ok: Saved locally')
    setForm(BLANK); setEditingId(null); setPublishing(false)
    setTimeout(() => setMsg(''), 3000)
  }

  const deleteGroup = async (id) => {
    // NewsPage pattern: write to deleted list + remove from stored list immediately
    const del = deletedGroups()
    if (!del.includes(id)) localStorage.setItem('bitsavers_deleted_groups', JSON.stringify([...del, id]))
    const updated = groups.filter(g => g.id !== id)
    setGroups(updated); saveGroups(updated)
    await publishGroupDelete(id)
  }

  const startEdit = (g) => {
    setEditingId(g.id)
    setForm({ name: g.name || '', description: g.description || '', institution: g.institution || '', coverImage: g.coverImage || '', isPrivate: g.isPrivate || false, code: g.code || '' })
  }

  return (
    <div>
      {/* Form */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={15} color={C.accent} /> {editingId ? 'Edit Group' : 'Create New Group'}
        </div>
        <Input label="Group Name" value={form.name} onChange={v => set('name', v)} placeholder="e.g. Nairobi Bitcoin Cohort 1" />
        <Input label="Institution" value={form.institution} onChange={v => set('institution', v)} placeholder="e.g. University of Nairobi" />
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 5 }}>Description</div>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="What is this group about?"
            style={{ width: '100%', background: '#1a1a1a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '11px 13px', color: C.text, fontSize: 13, outline: 'none', resize: 'vertical' }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 8 }}>Cover Image (optional)</div>
          <ImageUpload currentUrl={form.coverImage} onUploaded={url => set('coverImage', url)} size={70} />
        </div>
        {/* Privacy */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 8 }}>Group Type</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[{ val: false, icon: <Globe size={13} />, label: 'Public' }, { val: true, icon: <Lock size={13} />, label: 'Private' }].map(opt => (
              <button key={String(opt.val)} onClick={() => set('isPrivate', opt.val)}
                style={{ flex: 1, padding: '10px', borderRadius: 9, border: `1px solid ${form.isPrivate === opt.val ? C.accent : C.border}`, background: form.isPrivate === opt.val ? C.dim : 'transparent', color: form.isPrivate === opt.val ? C.accent : C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>
        {form.isPrivate && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 5 }}>Invite Code</div>
            <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="e.g. NAIROBI2026"
              style={{ width: '100%', background: '#1a1a1a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '11px 13px', color: C.accent, fontSize: 14, outline: 'none', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Share with members to join instantly</div>
          </div>
        )}
        {msg && (
          <div style={{ padding: '10px 14px', borderRadius: 9, marginBottom: 12, fontSize: 13, fontWeight: 600,
            background: msg.startsWith('ok') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color: msg.startsWith('ok') ? C.green : C.red,
            border: `1px solid ${msg.startsWith('ok') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>{msg.replace(/^(ok|err): /, '')}</div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={saveGroup} disabled={publishing || !form.name.trim()}
            style={{ flex: 1, background: C.accent, border: 'none', color: '#000', padding: '13px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: publishing ? 0.7 : 1 }}>
            {publishing ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={15} />}
            {publishing ? 'Saving…' : editingId ? 'Save Changes' : 'Create Group'}
          </button>
          {editingId && (
            <button onClick={() => { setEditingId(null); setForm(BLANK) }}
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: C.red, padding: '13px 18px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Groups list */}
      {groups.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 14 }}>No groups yet — create one above</div>
      )}
      {groups.map(g => (
        <div key={g.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
          {g.coverImage && <img src={g.coverImage} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{g.name}</div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: g.isPrivate ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)', color: g.isPrivate ? C.yellow : C.green, border: `1px solid ${g.isPrivate ? 'rgba(234,179,8,0.3)' : 'rgba(34,197,94,0.3)'}`, flexShrink: 0 }}>
                  {g.isPrivate ? <><Lock size={9} /> Private</> : <><Globe size={9} /> Public</>}
                </span>
              </div>
              {g.institution && <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>{g.institution}</div>}
              <div style={{ fontSize: 12, color: C.muted }}>{memberCounts[g.id] ?? (g.members || []).length} members · {(g.admins || []).length} admins</div>
              {g.isPrivate && g.code && <div style={{ fontSize: 11, color: C.accent, marginTop: 4, fontFamily: 'monospace', letterSpacing: 1 }}>Code: {g.code}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => startEdit(g)} style={{ background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Edit</button>
              <button onClick={() => deleteGroup(g.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: C.red, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Delete</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── TAB: Members ──────────────────────────────────────────────────────────────
function MembersTab({ groups, setGroups }) {
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(false)

  const loadProfiles = async (members) => {
    if (!members.length) return
    setLoading(true)
    const pool = new SimplePool()
    const sub = pool.subscribe(RELAYS, { kinds: [0], authors: members, limit: members.length }, {
      onevent(e) {
        try { setProfiles(prev => ({ ...prev, [e.pubkey]: JSON.parse(e.content) })) } catch {}
      },
      oneose() { sub.close(); setLoading(false) }
    })
    setTimeout(() => { sub.close(); setLoading(false) }, 8000)
  }

  const selectGroup = (g) => {
    setSelectedGroup(g)
    setProfiles({})
    loadProfiles(g.members || [])
  }

  const removeMember = async (pubkey) => {
    const updated = groups.map(g => {
      if (g.id !== selectedGroup.id) return g
      return { ...g, members: (g.members || []).filter(m => m !== pubkey), admins: (g.admins || []).filter(a => a !== pubkey) }
    })
    setGroups(updated); saveGroups(updated)
    const updatedGroup = updated.find(g => g.id === selectedGroup.id)
    setSelectedGroup(updatedGroup)
    await publishGroup(updatedGroup)
    // GROUP_STATE:removed — single source of truth, supersedes any member state
    await publishGroupState(selectedGroup.id, pubkey, 'removed')
    // Also publish GROUP_MEMBER_REMOVE for count tracking
    const nsec = localStorage.getItem('bitsavers_nsec')
    if (nsec) {
      try {
        const skBytes = nsecToBytes(nsec)
        const pool = getPool()
        const ev = finalizeEvent({
          kind: 1, created_at: Math.floor(Date.now() / 1000) + 1,
          tags: [['t', 'bitsavers'], ['t', `bitsavers-group-member-${selectedGroup.id}`], ['p', pubkey]],
          content: 'GROUP_MEMBER_REMOVE:' + JSON.stringify({ groupId: selectedGroup.id, pubkey }),
        }, skBytes)
        await Promise.any(pool.publish(RELAYS, ev))
      } catch {}
    }
  }

  const toggleAdmin = async (pubkey) => {
    const updated = groups.map(g => {
      if (g.id !== selectedGroup.id) return g
      const admins = (g.admins || []).includes(pubkey)
        ? (g.admins || []).filter(a => a !== pubkey)
        : [...(g.admins || []), pubkey]
      return { ...g, admins }
    })
    setGroups(updated); saveGroups(updated)
    const updatedGroup = updated.find(g => g.id === selectedGroup.id)
    setSelectedGroup(updatedGroup)
    await publishGroup(updatedGroup)
  }

  if (!selectedGroup) return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>Select a group to manage its members</div>
      {groups.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 14 }}>No groups created yet</div>}
      {groups.map(g => (
        <div key={g.id} onClick={() => selectGroup(g)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{g.name}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {(g.members || []).length} members · {(g.admins || []).length} admins
            </div>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, flexShrink: 0, background: g.isPrivate ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)', color: g.isPrivate ? C.yellow : C.green, border: `1px solid ${g.isPrivate ? 'rgba(234,179,8,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
            {g.isPrivate ? <><Lock size={9} /> Private</> : <><Globe size={9} /> Public</>}
          </span>
        </div>
      ))}
    </div>
  )

  const members = selectedGroup.members || []
  const admins = selectedGroup.admins || []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => setSelectedGroup(null)} style={{ background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '8px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{selectedGroup.name}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{members.length} members · {admins.length} admins</div>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '30px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.muted }}>
          <Loader size={16} style={{ animation: 'spin 1s linear infinite', color: C.accent }} />
          <span style={{ fontSize: 13 }}>Loading member profiles…</span>
        </div>
      )}

      {members.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 14 }}>No members yet</div>
      )}

      {members.map(pubkey => {
        const profile = profiles[pubkey] || {}
        const name = profile.name || profile.display_name || pubkey.slice(0, 16) + '…'
        const nip05 = profile.nip05 || ''
        const isAdmin = admins.includes(pubkey)
        return (
          <div key={pubkey} style={{ background: C.card, border: `1px solid ${isAdmin ? 'rgba(247,147,26,0.3)' : C.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar profile={profile} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                {isAdmin && <Crown size={12} color={C.accent} style={{ flexShrink: 0 }} />}
              </div>
              {nip05 && <div style={{ fontSize: 11, color: C.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{nip05}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => toggleAdmin(pubkey)}
                style={{ background: isAdmin ? 'rgba(247,147,26,0.1)' : C.dim, border: `1px solid ${isAdmin ? C.accent : C.border}`, color: isAdmin ? C.accent : C.muted, padding: '6px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
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
    </div>
  )
}

// ── TAB: Requests ─────────────────────────────────────────────────────────────
function RequestsTab({ groups, setGroups }) {
  const [requests, setRequests] = useState({}) // { groupId: [{pubkey, npub, timestamp}] }
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!groups.length) { setLoading(false); return }
    const pool = new SimplePool()
    const incoming = {}

    const subs = groups
      .filter(g => g.isPrivate)
      .map(g => {
        incoming[g.id] = []
        return pool.subscribe(RELAYS, { kinds: [1], '#t': [`bitsavers-group-request-${g.id}`], limit: 200 }, {
          onevent(e) {
            if (!e.content.startsWith('GROUP_REQUEST:')) return
            try {
              const data = JSON.parse(e.content.slice('GROUP_REQUEST:'.length))
              const approved = groups.find(gr => gr.id === g.id)?.members || []
              if (approved.includes(e.pubkey)) return // already a member
              if (!incoming[g.id].find(r => r.pubkey === e.pubkey)) {
                incoming[g.id].push({ pubkey: e.pubkey, npub: data.npub || '', timestamp: e.created_at })
              }
            } catch {}
          }
        })
      })

    setTimeout(() => {
      subs.forEach(s => s.close())
      setRequests({ ...incoming })
      setLoading(false)
      const allPubkeys = Object.values(incoming).flat().map(r => r.pubkey)
      if (!allPubkeys.length) return
      const pSub = pool.subscribe(RELAYS, { kinds: [0], authors: allPubkeys, limit: allPubkeys.length }, {
        onevent(e) { try { setProfiles(prev => ({ ...prev, [e.pubkey]: JSON.parse(e.content) })) } catch {} },
        oneose() { pSub.close() }
      })
      setTimeout(() => pSub.close(), 6000)
    }, 6000)
  }, [groups.length])

  const approve = async (group, pubkey, npub) => {
    const updated = groups.map(g => {
      if (g.id !== group.id) return g
      return { ...g, members: [...new Set([...(g.members || []), pubkey])] }
    })
    setGroups(updated); saveGroups(updated)
    await publishGroup(updated.find(g => g.id === group.id))

    const nsec = localStorage.getItem('bitsavers_nsec')
    if (nsec) {
      try {
        const skBytes = nsecToBytes(nsec)
        const pool = getPool()
        const ev = finalizeEvent({
          kind: 1, created_at: Math.floor(Date.now() / 1000),
          tags: [['t', 'bitsavers'], ['t', `bitsavers-group-approved-${group.id}`], ['p', pubkey]],
          content: 'GROUP_APPROVED:' + JSON.stringify({ groupId: group.id, npub, pubkey }),
        }, skBytes)
        await Promise.any(pool.publish(RELAYS, ev))
      } catch {}
    }
    setRequests(prev => ({ ...prev, [group.id]: (prev[group.id] || []).filter(r => r.pubkey !== pubkey) }))
  }

  const reject = (groupId, pubkey) => {
    setRequests(prev => ({ ...prev, [groupId]: (prev[groupId] || []).filter(r => r.pubkey !== pubkey) }))
  }

  const total = Object.values(requests).flat().length
  const privateGroups = groups.filter(g => g.isPrivate)

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '50px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.muted }}>
      <Loader size={18} style={{ animation: 'spin 1s linear infinite', color: C.accent }} />
      <span style={{ fontSize: 14 }}>Connecting to Nostr relays…</span>
    </div>
  )

  if (privateGroups.length === 0) return (
    <div style={{ textAlign: 'center', padding: '50px 0', color: C.muted, fontSize: 14 }}>
      <Lock size={28} color={C.muted} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.3 }} />
      No private groups yet — create one to see join requests here
    </div>
  )

  if (total === 0) return (
    <div style={{ textAlign: 'center', padding: '50px 0', color: C.muted, fontSize: 14 }}>
      <CheckCircle size={28} color={C.green} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.5 }} />
      No pending requests
    </div>
  )

  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{total} pending request{total !== 1 ? 's' : ''} across {privateGroups.length} private group{privateGroups.length !== 1 ? 's' : ''}</div>
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
              const name = profile.name || profile.display_name || r.npub?.slice(0, 16) + '…' || r.pubkey.slice(0, 16) + '…'
              const nip05 = profile.nip05 || ''
              return (
                <div key={r.pubkey} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar profile={profile} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    {nip05 && <div style={{ fontSize: 11, color: C.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nip05}</div>}
                    <div style={{ fontSize: 11, color: C.muted }}>{new Date(r.timestamp * 1000).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => approve(g, r.pubkey, r.npub)}
                      style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: C.green, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={12} /> Approve
                    </button>
                    <button onClick={() => reject(g.id, r.pubkey)}
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: C.red, padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <XCircle size={12} /> Reject
                    </button>
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

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminGroups() {
  const [groups, setGroups] = useState(getGroups)
  const [tab, setTab] = useState('groups')

  const pendingCount = groups
    .filter(g => g.isPrivate)
    .reduce((sum, g) => sum + (g._pendingCount || 0), 0)

  const tabs = [
    { id: 'groups',   label: 'Groups' },
    { id: 'members',  label: 'Members' },
    { id: 'requests', label: 'Requests' },
  ]

  return (
    <div>
      {/* Internal tabs */}
      <div style={{ display: 'flex', gap: 4, background: C.card, border: `1px solid ${C.border}`, borderRadius: 11, padding: 4, marginBottom: 18 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: '10px 6px', borderRadius: 8, border: 'none', background: tab === t.id ? C.accent : 'transparent', color: tab === t.id ? '#000' : C.muted, fontWeight: tab === t.id ? 800 : 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'groups'   && <GroupsTab   groups={groups} setGroups={setGroups} />}
      {tab === 'members'  && <MembersTab  groups={groups} setGroups={setGroups} />}
      {tab === 'requests' && <RequestsTab groups={groups} setGroups={setGroups} />}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

