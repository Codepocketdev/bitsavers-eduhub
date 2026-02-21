import { useState, useEffect, useRef } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import { nip19 } from 'nostr-tools'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import { Users, CheckCircle, Clock, QrCode, X, ChevronDown, ChevronUp, Download, Search, Calendar, AlertTriangle, XCircle, Loader, FileDown } from 'lucide-react'
import TicketScanner from './TicketScanner'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const C = {
  bg: '#080808', card: '#141414', border: 'rgba(247,147,26,0.18)',
  accent: '#F7931A', dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444', yellow: '#eab308',
}

const getEvents = () => { try { return JSON.parse(localStorage.getItem('bitsavers_events') || '[]') } catch { return [] } }
const getVerified = () => { try { return JSON.parse(localStorage.getItem('bitsavers_verified') || '{}') } catch { return {} } }
const saveVerified = (d) => localStorage.setItem('bitsavers_verified', JSON.stringify(d))

function Avatar({ profile = {}, size = 36 }) {
  const [err, setErr] = useState(false)
  const initials = (profile.name || '?').slice(0, 2).toUpperCase()
  if (profile.picture && !err)
    return <img src={profile.picture} onError={() => setErr(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${C.border}`, flexShrink: 0 }} />
  return <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.33, fontWeight: 700, color: '#000', flexShrink: 0 }}>{initials}</div>
}

export default function AdminRsvp() {
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [rsvps, setRsvps] = useState([]) // { npub, name, picture, ticketId, timestamp }
  const [profiles, setProfiles] = useState({})
  const [verified, setVerified] = useState(getVerified)
  const [loading, setLoading] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [scanResult, setScanResult] = useState(null) // null | {status, attendee}
  const [search, setSearch] = useState('')

  // Load events from localStorage (same source as NewsPage)
  useEffect(() => {
    const pool = new SimplePool()
    let latest = { created_at: 0 }
    const sub = pool.subscribe(RELAYS, { kinds: [1], '#t': ['bitsavers-events'], limit: 20 }, {
      onevent(e) {
        if (!e.content.startsWith('EVENT:')) return
        try {
          if (e.created_at > latest.created_at)
            latest = { created_at: e.created_at, data: JSON.parse(e.content.slice('EVENT:'.length)) }
        } catch {}
      },
      oneose() {
        sub.close()
        if (latest.data) setEvents(Array.isArray(latest.data) ? latest.data : [latest.data])
        else setEvents(getEvents())
      }
    })
    setTimeout(() => { sub.close(); setEvents(getEvents()) }, 8000)
    return () => sub.close()
  }, [])

  const loadRsvps = (event) => {
    setSelectedEvent(event)
    setRsvps([])
    setLoading(true)
    const pool = new SimplePool()
    const seenEventIds = new Set()
    // byPubkey: e.pubkey is always unique per person, always present — single source of truth
    const byPubkey = {}

    const sub = pool.subscribe(RELAYS, {
      kinds: [1], '#t': ['bitsavers-rsvp', event.id], limit: 200
    }, {
      onevent(e) {
        if (seenEventIds.has(e.id)) return
        if (!e.content.startsWith('RSVP:')) return
        seenEventIds.add(e.id)
        try {
          const data = JSON.parse(e.content.slice('RSVP:'.length))
          if (data.eventId !== event.id) return
          // Keep only the latest event per pubkey — one row per person, always
          if (!byPubkey[e.pubkey] || e.created_at > byPubkey[e.pubkey].timestamp) {
            byPubkey[e.pubkey] = { ...data, pubkey: e.pubkey, timestamp: e.created_at }
          }
        } catch {}
      },
      oneose() {
        sub.close()
        const deduped = Object.values(byPubkey)
        setRsvps(deduped)
        setLoading(false)
        // Fetch profiles
        const pubkeys = deduped.map(r => r.pubkey).filter(Boolean)
        if (!pubkeys.length) return
        const pSub = pool.subscribe(RELAYS, { kinds: [0], authors: pubkeys, limit: pubkeys.length }, {
          onevent(e) {
            try {
              const p = JSON.parse(e.content)
              setProfiles(prev => ({ ...prev, [e.pubkey]: p }))
            } catch {}
          },
          oneose() { pSub.close() }
        })
        setTimeout(() => pSub.close(), 8000)
      }
    })
    setTimeout(() => { sub.close(); setLoading(false) }, 10000)
  }

  const verifyTicket = async (scannedData) => {
    setShowScanner(false)

    if (!scannedData.startsWith('bitsavers-ticket:')) {
      setScanResult({ status: 'invalid', msg: 'Not a valid BitSavers ticket' })
      return
    }

    const parts = scannedData.split(':')
    if (parts.length < 4) { setScanResult({ status: 'invalid', msg: 'Malformed ticket' }); return }

    const [, eventId, npub, ticketId] = parts

    if (eventId !== selectedEvent?.id) {
      setScanResult({ status: 'invalid', msg: 'Ticket is for a different event' })
      return
    }

    // Fast path — already scanned today
    if (verified[ticketId]) {
      const att = rsvps.find(r => r.ticketId === ticketId) || {}
      const profile = profiles[att.pubkey] || {}
      setScanResult({ status: 'already', attendee: { name: profile.name || profile.display_name || npub.slice(0, 14) + '…', picture: profile.picture } })
      return
    }

    // Show verifying state while we check Nostr
    setScanResult({ status: 'verifying' })

    // Verify against Nostr — Nostr is source of truth
    // Ticket is only valid if npub actually published this ticketId to relay
    let nostrVerified = false
    let attendeeProfile = {}

    try {
      const pool = new SimplePool()
      let pubkey = ''
      try { pubkey = nip19.decode(npub).data } catch {}

      if (pubkey) {
        await new Promise((resolve) => {
          const sub = pool.subscribe(RELAYS, {
            kinds: [1],
            authors: [pubkey],
            '#t': ['bitsavers-rsvp', eventId],
            limit: 10,
          }, {
            onevent(e) {
              try {
                const data = JSON.parse(e.content.slice('RSVP:'.length))
                if (data.ticketId === ticketId && data.eventId === eventId) {
                  nostrVerified = true
                  attendeeProfile = profiles[pubkey] || {}
                  sub.close()
                  resolve()
                }
              } catch {}
            },
            oneose() { sub.close(); resolve() }
          })
          setTimeout(() => { sub.close(); resolve() }, 8000)
        })
      }
    } catch (e) { console.error('Nostr verify error', e) }

    // Fallback to local RSVP list if relay was slow/offline
    if (!nostrVerified) {
      const localMatch = rsvps.find(r => r.ticketId === ticketId)
      if (!localMatch) {
        setScanResult({ status: 'invalid', msg: 'Ticket not found — not a valid RSVP' })
        return
      }
      attendeeProfile = profiles[localMatch.pubkey] || {}
    }

    const name = attendeeProfile.name || attendeeProfile.display_name || npub.slice(0, 16) + '…'

    // Mark verified locally
    const newVerified = { ...verified, [ticketId]: { time: Date.now(), npub } }
    setVerified(newVerified)
    saveVerified(newVerified)

    // Publish verify event to Nostr
    try {
      const nsec = localStorage.getItem('bitsavers_nsec')
      if (nsec) {
        const skBytes = nsecToBytes(nsec)
        const pool = new SimplePool()
        const ev = finalizeEvent({
          kind: 1,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['t', 'bitsavers'], ['t', 'bitsavers-verify'], ['t', selectedEvent.id]],
          content: 'VERIFY:' + JSON.stringify({ ticketId, npub, eventId: selectedEvent.id, time: Date.now() }),
        }, skBytes)
        await Promise.any(pool.publish(RELAYS, ev))
      }
    } catch {}

    setScanResult({ status: 'success', attendee: { name, picture: attendeeProfile.picture } })
  }

  const exportCsv = () => {
    const rows = [['Name', 'NIP05', 'npub', 'Ticket ID', 'RSVP Time', 'Status']]
    rsvps.forEach(r => {
      const profile = profiles[r.pubkey] || {}
      const name = profile.name || profile.display_name || 'Unknown'
      const nip05 = profile.nip05 || ''
      const status = verified[r.ticketId] ? 'Attended' : 'Pending'
      const time = new Date(r.timestamp * 1000).toLocaleString()
      // Derive npub from pubkey if not stored directly
      let npub = r.npub || ''
      if (!npub && r.pubkey) {
        try { npub = nip19.npubEncode(r.pubkey) } catch {}
      }
      rows.push([name, nip05, npub, r.ticketId || '', time, status])
    })
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedEvent.title.replace(/[^a-z0-9]/gi,'_')}_attendees.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const attended = rsvps.filter(r => verified[r.ticketId])
  const pending = rsvps.filter(r => !verified[r.ticketId])
  const filtered = rsvps.filter(r => {
    if (!search) return true
    const profile = profiles[r.pubkey] || {}
    const name = (profile.name || profile.display_name || r.npub || '').toLowerCase()
    return name.includes(search.toLowerCase())
  })

  // ── Scanner result modal
  if (scanResult) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 30, width: '100%', maxWidth: 380, textAlign: 'center' }}>
        {scanResult.status === 'success' && (
          <>
            <div style={{ display:"flex", justifyContent:"center", marginBottom: 16 }}><CheckCircle size={64} color={C.green} /></div>
            {scanResult.attendee?.picture && <img src={scanResult.attendee.picture} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 14px', display: 'block', border: `3px solid ${C.green}` }} />}
            <div style={{ fontSize: 22, fontWeight: 900, color: C.green, marginBottom: 6 }}>Valid Ticket!</div>
            <div style={{ fontSize: 16, color: C.text, fontWeight: 700, marginBottom: 4 }}>{scanResult.attendee?.name}</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Marked as ATTENDED</div>
          </>
        )}
        {scanResult.status === 'already' && (
          <>
            <div style={{ display:"flex", justifyContent:"center", marginBottom: 16 }}><AlertTriangle size={64} color={C.yellow} /></div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.yellow, marginBottom: 6 }}>Already Checked In</div>
            <div style={{ fontSize: 14, color: C.text, marginBottom: 4 }}>{scanResult.attendee?.name}</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>This ticket was already scanned</div>
          </>
        )}
        {scanResult.status === 'verifying' && (
          <>
            <div style={{ display:'flex', justifyContent:'center', marginBottom: 16 }}>
              <Loader size={48} color={C.accent} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>Verifying on Nostr…</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Checking ticket against relay</div>
            <style>{String.raw`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </>
        )}
        {scanResult.status === 'verifying' && (
          <>
            <div style={{ display:'flex', justifyContent:'center', marginBottom: 20 }}>
              <Loader size={52} color={C.accent} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>Verifying on Nostr…</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Checking ticket against relay</div>
            <style>{String.raw`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </>
        )}
        {scanResult.status === 'invalid' && (
          <>
            <div style={{ display:"flex", justifyContent:"center", marginBottom: 16 }}><XCircle size={64} color={C.red} /></div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.red, marginBottom: 8 }}>Invalid Ticket</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>{scanResult.msg}</div>
          </>
        )}
        {scanResult.status !== 'verifying' && (
          <button onClick={() => setScanResult(null)} style={{ width: '100%', background: C.accent, border: 'none', color: '#000', padding: '14px', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
            Scan Next
          </button>
        )}
      </div>
    </div>
  )

  // ── Event list (no event selected)
  if (!selectedEvent) return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Select an event to manage RSVPs</div>
      {events.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>
          <Calendar size={32} color={C.muted} style={{ display:'block', margin:'0 auto 10px' }} />
          <div style={{ fontSize: 14 }}>No events found</div>
        </div>
      )}
      {events.map(ev => (
        <div key={ev.id} onClick={() => loadRsvps(ev)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, marginBottom: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: C.dim, borderRadius: 10, padding: '8px 12px', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: C.accent, fontWeight: 800, textTransform: 'uppercase' }}>{new Date(ev.date).toLocaleString('en', { month: 'short' })}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.text, lineHeight: 1 }}>{new Date(ev.date).getDate()}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{ev.title}</div>
            {ev.time && <div style={{ fontSize: 12, color: C.muted }}>{ev.time}</div>}
          </div>
          <ChevronDown size={16} color={C.muted} />
        </div>
      ))}
    </div>
  )

  // ── RSVP list for selected event
  return (
    <div>
      {showScanner && <TicketScanner onScan={verifyTicket} onClose={() => setShowScanner(false)} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => setSelectedEvent(null)} style={{ background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '8px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          ← Back
        </button>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 800, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedEvent.title}</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total RSVPs', val: rsvps.length, color: C.accent },
          { label: 'Attended', val: attended.length, color: C.green },
          { label: 'Pending', val: pending.length, color: C.yellow },
        ].map(s => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <button onClick={() => setShowScanner(true)} style={{ width: '100%', background: C.accent, border: 'none', color: '#000', padding: '14px', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <QrCode size={18} /> Scan Ticket at Door
        </button>
        <button onClick={exportCsv} style={{ width: '100%', background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '13px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <FileDown size={16} /> Export Attendees CSV
        </button>
      </div>



      {/* Search */}
      {rsvps.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search attendees…"
            style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 12px 11px 34px', color: C.text, fontSize: 13, outline: 'none' }} />
        </div>
      )}

      {/* Attendee list */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.muted }}>
            <Loader size={18} style={{ animation: 'spin 1s linear infinite', color: C.accent }} />
            <span style={{ fontSize: 14 }}>Connecting to Nostr relays…</span>
          </div>
          <style>{String.raw`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {!loading && rsvps.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Users size={32} style={{ display: 'block', margin: '0 auto 12px', color: C.muted, opacity: 0.3 }} />
          <div style={{ fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 4 }}>No RSVPs yet</div>
          <div style={{ fontSize: 12, color: C.muted }}>Share the event to get people registering</div>
        </div>
      )}

      {filtered.map(r => {
        const profile = profiles[r.pubkey] || {}
        const isAttended = verified[r.ticketId]
        const name = profile.name || profile.display_name || (r.npub ? r.npub.slice(0, 16) + '…' : 'Unknown')
        return (
          <div key={r.ticketId} style={{ background: C.card, border: `1px solid ${isAttended ? 'rgba(34,197,94,0.3)' : C.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar profile={profile} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
              {profile.nip05 && <div style={{ fontSize: 11, color: C.accent }}>{profile.nip05}</div>}
              <div style={{ fontSize: 11, color: C.muted }}>
                {new Date(r.timestamp * 1000).toLocaleString()}
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              {isAttended ? (
                <span style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: C.green, padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle size={11} /> Attended
                </span>
              ) : (
                <span style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', color: C.yellow, padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} /> Pending
                </span>
              )}
            </div>
          </div>
        )
      })}
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

