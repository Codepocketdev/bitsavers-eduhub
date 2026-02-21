import { useState, useEffect } from 'react'
import { Plus, Trash2, User, CheckCircle, Loader, RefreshCw } from 'lucide-react'
import { SimplePool } from 'nostr-tools/pool'
import { nip19 } from 'nostr-tools'

const C = {
  bg: '#080808', card: '#141414', border: 'rgba(247,147,26,0.18)',
  accent: '#F7931A', dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const getFollowing = () => { try { return JSON.parse(localStorage.getItem('bitsavers_following') || '[]') } catch { return [] } }
const saveFollowing = (d) => localStorage.setItem('bitsavers_following', JSON.stringify(d))

function Avatar({ profile = {}, pubkey = '' }) {
  const [err, setErr] = useState(false)
  const initials = (profile.name || pubkey || '?').slice(0, 2).toUpperCase()
  if (profile.picture && !err)
    return <img src={profile.picture} alt="" onError={() => setErr(true)} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${C.border}`, flexShrink: 0 }} />
  return (
    <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#000', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

export default function AdminFollowing() {
  const [following, setFollowing] = useState(getFollowing)
  const [profiles, setProfiles] = useState({})
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')
  const [loadingProfiles, setLoadingProfiles] = useState(false)

  const fetchProfiles = (npubs) => {
    const hexList = npubs.map(n => { try { return nip19.decode(n).data } catch { return null } }).filter(Boolean)
    if (!hexList.length) return
    setLoadingProfiles(true)
    const pool = new SimplePool()
    const sub = pool.subscribe(RELAYS, { kinds: [0], authors: hexList, limit: hexList.length }, {
      onevent(e) {
        try {
          const p = JSON.parse(e.content)
          const npub = nip19.npubEncode(e.pubkey)
          setProfiles(prev => ({ ...prev, [npub]: p }))
        } catch {}
      },
      oneose() { sub.close(); setLoadingProfiles(false) }
    })
    setTimeout(() => { sub.close(); setLoadingProfiles(false) }, 8000)
  }

  useEffect(() => {
    if (following.length > 0) fetchProfiles(following)
  }, [])

  const add = async () => {
    const val = input.trim()
    if (!val) return
    // Validate npub
    try { nip19.decode(val) } catch {
      setMsg('err: Invalid npub — must start with npub1…')
      return
    }
    if (following.includes(val)) { setMsg('err: Already in list'); return }
    setAdding(true); setMsg('')
    const updated = [...following, val]
    setFollowing(updated)
    saveFollowing(updated)
    setInput('')
    // Fetch profile for the new npub
    fetchProfiles([val])
    setMsg('ok: Added!')
    setTimeout(() => setMsg(''), 2000)
    setAdding(false)
  }

  const remove = (npub) => {
    const updated = following.filter(n => n !== npub)
    setFollowing(updated)
    saveFollowing(updated)
  }

  const SUGGESTED = [
    { name: 'Jack Dorsey', npub: 'npub1sg6plzptd64u62a878hep2kev88swjh3tw00gjsfl8f237lmu63q0uf63m' },
    { name: 'Marty Bent', npub: 'npub1guh5grefa7vkay4ps6udxg8lrqxg2kgr3qh9n4gduxut64nfxq0q9y6hjy' },
    { name: 'Lyn Alden', npub: 'npub1a2cww4kn9wqte4ry70vyfwqyqvpswksna27rtxd8vty6c74era8sdcw83a' },
    { name: 'Saifedean', npub: 'npub1gdu7w6l6w65qhrdeaf6eyywepwe7v7ezqtugsrxy7hl7ypjsvxksd76nak' },
  ]

  return (
    <div>
      {/* Status */}
      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: 9, marginBottom: 14, fontSize: 13, background: msg.startsWith('ok') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.startsWith('ok') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: msg.startsWith('ok') ? C.green : C.red }}>
          {msg.slice(4)}
        </div>
      )}

      {/* Add npub */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>Add a Nostr Account to Follow</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="npub1…"
            style={{ flex: 1, background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 13px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'monospace' }}
          />
          <button onClick={add} disabled={adding || !input.trim()} style={{ background: C.accent, border: 'none', color: '#000', padding: '12px 18px', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Add
          </button>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
          Paste any Nostr npub. Their notes will appear in the Following tab for all users.
        </div>
      </div>

      {/* Suggested */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Suggested Bitcoin Accounts</div>
        {SUGGESTED.map(s => (
          <div key={s.npub} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{s.name}</div>
            <button
              onClick={() => { setInput(s.npub) }}
              disabled={following.includes(s.npub)}
              style={{ background: following.includes(s.npub) ? 'rgba(34,197,94,0.1)' : C.dim, border: `1px solid ${following.includes(s.npub) ? 'rgba(34,197,94,0.3)' : C.border}`, color: following.includes(s.npub) ? C.green : C.accent, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: following.includes(s.npub) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              {following.includes(s.npub) ? <><CheckCircle size={11} /> Added</> : '+ Use npub'}
            </button>
          </div>
        ))}
      </div>

      {/* Following list */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            Following ({following.length})
          </div>
          {following.length > 0 && (
            <button onClick={() => fetchProfiles(following)} disabled={loadingProfiles} style={{ background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '6px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <RefreshCw size={11} style={{ animation: loadingProfiles ? 'spin 1s linear infinite' : 'none' }} /> Refresh profiles
            </button>
          )}
        </div>

        {following.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 0', color: C.muted }}>
            <User size={28} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.3 }} />
            <div style={{ fontSize: 13 }}>No accounts followed yet</div>
          </div>
        )}

        {following.map(npub => {
          const profile = profiles[npub] || {}
          const shortNpub = npub.slice(0, 14) + '…' + npub.slice(-5)
          return (
            <div key={npub} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
              <Avatar profile={profile} pubkey={npub} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile.name || profile.display_name || 'Loading…'}
                </div>
                {profile.nip05 && <div style={{ fontSize: 11, color: C.accent }}>{profile.nip05}</div>}
                <div style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace' }}>{shortNpub}</div>
              </div>
              <button onClick={() => remove(npub)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: C.red, padding: '8px', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}>
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

