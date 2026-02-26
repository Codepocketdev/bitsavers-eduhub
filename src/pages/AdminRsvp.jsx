import { useState, useEffect, useRef } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import { nip19 } from 'nostr-tools'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import { Users, CheckCircle, Clock, QrCode, X, ChevronDown, ChevronUp, Download, Search, Calendar, AlertTriangle, XCircle, Loader, FileDown, Ticket } from 'lucide-react'
import TicketScanner from './TicketScanner'
import { generateTicketId } from './ticketGenerator'

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
  const [verified, setVerified] = useState({})
  const [loading, setLoading] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [scanResult, setScanResult] = useState(null) // null | {status, attendee}
  const [search, setSearch] = useState('')
  const liveSubRef = useRef(null)

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

  // Cleanup live subs on unmount
  useEffect(() => {
    return () => { if (liveSubRef.current) liveSubRef.current() }
  }, [])

  const loadRsvps = (event) => {
    // Close any existing live subs first
    if (liveSubRef.current) { liveSubRef.current(); liveSubRef.current = null }

    setSelectedEvent(event)
    setRsvps([])
    setVerified({})
    setLoading(true)

    const seen = new Set()
    const byPubkey = {}        // pubkey → rsvp
    const verifyEvents = []
    let resetAfter = 0
    let eoseRsvp = 0
    let eoseVerify = 0
    const closers = []

    const flushRsvps = () => {
      const deduped = Object.values(byPubkey)
      setRsvps(deduped)
      setLoading(false)
      // Fetch profiles for any new pubkeys
      const pubkeys = deduped.map(r => r.pubkey).filter(Boolean)
      if (!pubkeys.length) return
      const pool = new SimplePool()
      const pSub = pool.subscribe(RELAYS, { kinds: [0], authors: pubkeys, limit: pubkeys.length }, {
        onevent(e) {
          try { setProfiles(prev => ({ ...prev, [e.pubkey]: JSON.parse(e.content) })) } catch {}
        },
        oneose() { pSub.close() }
      })
      setTimeout(() => pSub.close(), 8000)
    }

    const flushVerify = () => {
      const newVerified = {}
      verifyEvents.forEach(e => {
        try {
          const d = JSON.parse(e.content.slice('VERIFY:'.length))
          if (d.eventId !== event.id) return
          if (d.time <= resetAfter) return
          newVerified[d.npub] = { time: d.time, npub: d.npub, ticketId: d.ticketId }
        } catch {}
      })
      setVerified(newVerified)
    }

    // Raw WebSocket per relay — stays open for live updates
    const openWS = (relayUrl, filter, onEvent, onEose) => {
      let ws, closed = false
      const subId = 'rsvp-' + Math.random().toString(36).slice(2, 8)

      const connect = () => {
        if (closed) return
        try {
          ws = new WebSocket(relayUrl)
          ws.onopen = () => { if (!closed) ws.send(JSON.stringify(['REQ', subId, filter])) }
          ws.onmessage = ({ data }) => {
            if (closed) return
            let msg; try { msg = JSON.parse(data) } catch { return }
            const [type, id, payload] = msg
            if (type === 'EVENT' && id === subId) onEvent(payload)
            if (type === 'EOSE' && id === subId) onEose?.()
          }
          ws.onerror = () => {}
          ws.onclose = () => { if (!closed) setTimeout(connect, 3000) } // auto-reconnect
        } catch {}
      }

      connect()
      return () => { closed = true; try { ws?.close() } catch {} }
    }

    // Sub 1: RSVPs — historical + live
    RELAYS.forEach(relayUrl => {
      closers.push(openWS(
        relayUrl,
        { kinds: [1], '#t': ['bitsavers-rsvp', event.id], limit: 200 },
        (e) => {
          if (seen.has(e.id)) return; seen.add(e.id)
          if (!e.content.startsWith('RSVP:')) return
          try {
            const data = JSON.parse(e.content.slice('RSVP:'.length))
            if (data.eventId !== event.id) return
            if (!byPubkey[e.pubkey] || e.created_at > byPubkey[e.pubkey].timestamp)
              byPubkey[e.pubkey] = { ...data, pubkey: e.pubkey, timestamp: e.created_at }
            flushRsvps() // live update immediately
          } catch {}
        },
        () => { eoseRsvp++; if (eoseRsvp >= RELAYS.length) flushRsvps() }
      ))
    })

    // Sub 2: Verify/Reset — historical + live
    RELAYS.forEach(relayUrl => {
      closers.push(openWS(
        relayUrl,
        { kinds: [1], '#t': ['bitsavers-verify', event.id], limit: 500 },
        (e) => {
          if (seen.has(e.id)) return; seen.add(e.id)
          if (e.content.startsWith('VERIFY_RESET:')) {
            try {
              const d = JSON.parse(e.content.slice('VERIFY_RESET:'.length))
              if (d.eventId === event.id && d.time > resetAfter) { resetAfter = d.time; flushVerify() }
            } catch {}
          } else if (e.content.startsWith('VERIFY:')) {
            verifyEvents.push(e)
            flushVerify() // live scan update immediately
          }
        },
        () => { eoseVerify++; if (eoseVerify >= RELAYS.length) flushVerify() }
      ))
    })

    // Store cleanup fn so we can close when switching events
    liveSubRef.current = () => closers.forEach(c => c())
  }

  const verifyTicket = (scannedData) => {
    setShowScanner(false)

    if (!scannedData.startsWith('bitsavers-ticket:')) {
      setScanResult({ status: 'invalid', msg: 'Not a valid BitSavers ticket' }); return
    }

    // QR format: bitsavers-ticket:eventId:npub:ticketId
    const parts = scannedData.split(':')
    if (parts.length < 4) {
      setScanResult({ status: 'invalid', msg: 'Malformed ticket' }); return
    }
    const [, eventId, npub, ticketId] = parts

    // 1. Wrong event?
    if (eventId !== selectedEvent?.id) {
      setScanResult({ status: 'invalid', msg: `Ticket is for a different event` }); return
    }

    // 2. Old ticket — no npub in QR, try to recover from RSVP list by ticketId
    if (!npub) {
      const match = rsvps.find(r => {
        const computed = r.npub ? generateTicketId(r.npub, eventId) : r.ticketId
        return computed === ticketId || r.ticketId === ticketId
      })
      if (!match || !match.npub) {
        setScanResult({ status: 'invalid', msg: 'Old ticket format — ask attendee to re-download their ticket' }); return
      }
      // Found — treat as if QR had the correct npub
      const recovered = match.npub
      let pubkey = ''; try { pubkey = nip19.decode(recovered).data } catch {}
      if (verified[recovered]) {
        const profile = profiles[pubkey] || {}
        setScanResult({ status: 'already', attendee: { name: profile.name || profile.display_name || recovered.slice(0,14)+'…', picture: profile.picture } })
        return
      }
      const profile = profiles[pubkey] || {}
      const name = profile.name || profile.display_name || recovered.slice(0,16)+'…'
      const newVerified = { ...verified, [recovered]: { time: Date.now(), npub: recovered, ticketId } }
      setVerified(newVerified); saveVerified(newVerified)
      setScanResult({ status: 'success', attendee: { name, picture: profile.picture } })
      return
    }

    // 3. Already checked in?
    if (verified[npub]) {
      let pubkey = ''; try { pubkey = nip19.decode(npub).data } catch {}
      const profile = profiles[pubkey] || {}
      setScanResult({ status: 'already', attendee: { name: profile.name || profile.display_name || npub.slice(0,14)+'…', picture: profile.picture } })
      return
    }

    // 4. Cryptographic check — recompute hash(npub + eventId)
    //    If it matches what's on the QR, ticket is mathematically valid — no Nostr needed
    const expectedId = generateTicketId(npub, eventId)
    if (expectedId !== ticketId) {
      setScanResult({ status: 'invalid', msg: 'Ticket is invalid or has been tampered with' }); return
    }

    // 5. Valid hash — find profile from RSVP list
    let pubkey = ''; try { pubkey = nip19.decode(npub).data } catch {}
    const rsvpMatch = rsvps.find(r => r.npub === npub || r.pubkey === pubkey)
    const profile = profiles[pubkey] || {}
    const name = profile.name || profile.display_name || npub.slice(0,16)+'…'

    if (!rsvpMatch) {
      // Valid ticket math but not in RSVP list — let admin decide
      setScanResult({ status: 'no_rsvp', npub, profile, name, ticketId }); return
    }

    // 6. All good — mark attended
    const newVerified = { ...verified, [npub]: { time: Date.now(), npub, ticketId } }
    setVerified(newVerified)
    saveVerified(newVerified)
    setScanResult({ status: 'success', attendee: { name, picture: profile.picture } })

    // Publish verify to Nostr — supports nsec + NIP-07
    try {
      const template = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'bitsavers-verify'], ['t', selectedEvent.id]],
        content: 'VERIFY:' + JSON.stringify({ ticketId, npub, eventId: selectedEvent.id, time: Date.now() }),
      }
      const p = getPool()
      const nsec = localStorage.getItem('bitsavers_nsec')
      if (nsec) {
        const ev = finalizeEvent(template, nsecToBytes(nsec))
        Promise.any(p.publish(RELAYS, ev)).catch(() => {})
      } else if (window.nostr) {
        window.nostr.signEvent(template).then(ev => p.publish(RELAYS, ev)).catch(() => {})
      }
    } catch {}
  }


  const resetAttendance = async () => {
    if (!selectedEvent) return
    if (!window.confirm('Reset all attendance for this event? This cannot be undone.')) return
    const template = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['t', 'bitsavers-verify'], ['t', selectedEvent.id]],
      content: 'VERIFY_RESET:' + JSON.stringify({ eventId: selectedEvent.id, time: Date.now() }),
    }
    try {
      const p = getPool()
      const nsec = localStorage.getItem('bitsavers_nsec')
      if (nsec) {
        const ev = finalizeEvent(template, nsecToBytes(nsec))
        await Promise.any(p.publish(RELAYS, ev))
      } else if (window.nostr) {
        const ev = await window.nostr.signEvent(template)
        await Promise.any(p.publish(RELAYS, ev))
      }
      setVerified({})
    } catch(e) { console.error(e) }
  }

  const exportCsv = () => {
    const rows = [['Name', 'NIP05', 'npub', 'Ticket ID', 'RSVP Time', 'Status']]
    rsvps.forEach(r => {
      const profile = profiles[r.pubkey] || {}
      const name = profile.name || profile.display_name || 'Unknown'
      const nip05 = profile.nip05 || ''
      const status = (verified[r.npub] || verified[r.ticketId]) ? 'Attended' : 'Pending'
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

  const attended = rsvps.filter(r => verified[r.npub] || verified[r.ticketId])
  const pending = rsvps.filter(r => !verified[r.npub] && !verified[r.ticketId])
  const filtered = rsvps.filter(r => {
    if (!search) return true
    const profile = profiles[r.pubkey] || {}
    const name = (profile.name || profile.display_name || r.npub || '').toLowerCase()
    return name.includes(search.toLowerCase())
  })

  // ── Scanner result modal
  if (scanResult) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${
        scanResult.status === 'success' ? 'rgba(34,197,94,0.4)' :
        scanResult.status === 'already' ? 'rgba(139,92,246,0.4)' :
        scanResult.status === 'no_rsvp' ? 'rgba(234,179,8,0.4)' :
        'rgba(239,68,68,0.4)'
      }`, borderRadius: 20, padding: 30, width: '100%', maxWidth: 380, textAlign: 'center' }}>

        {/* ── SUCCESS ── */}
        {scanResult.status === 'success' && (<>
          <div style={{ display:'flex', justifyContent:'center', marginBottom: 12 }}><CheckCircle size={56} color={C.green} /></div>
          {scanResult.attendee?.picture && <img src={scanResult.attendee.picture} style={{ width: 68, height: 68, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 10px', display: 'block', border: `3px solid ${C.green}` }} />}
          <div style={{ fontSize: 22, fontWeight: 900, color: C.green, marginBottom: 4 }}>Welcome In! ✓</div>
          <div style={{ fontSize: 16, color: C.text, fontWeight: 700, marginBottom: 2 }}>{scanResult.attendee?.name}</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Marked as ATTENDED</div>
        </>)}

        {/* ── ALREADY CHECKED IN ── */}
        {scanResult.status === 'already' && (<>
          <div style={{ display:'flex', justifyContent:'center', marginBottom: 12 }}><AlertTriangle size={56} color="#a78bfa" /></div>
          {scanResult.attendee?.picture && <img src={scanResult.attendee.picture} style={{ width: 68, height: 68, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 10px', display: 'block', border: '3px solid #a78bfa' }} />}
          <div style={{ fontSize: 20, fontWeight: 800, color: '#a78bfa', marginBottom: 4 }}>Already Checked In</div>
          <div style={{ fontSize: 15, color: C.text, fontWeight: 700, marginBottom: 2 }}>{scanResult.attendee?.name}</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>This person is already inside</div>
        </>)}

        {/* ── NO RSVP — valid ticket but not on list ── */}
        {scanResult.status === 'no_rsvp' && (<>
          <div style={{ display:'flex', justifyContent:'center', marginBottom: 12 }}><AlertTriangle size={56} color="#eab308" /></div>
          {scanResult.profile?.picture && <img src={scanResult.profile.picture} style={{ width: 68, height: 68, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 10px', display: 'block', border: '3px solid #eab308' }} />}
          <div style={{ fontSize: 18, fontWeight: 800, color: '#eab308', marginBottom: 4 }}>Valid Ticket — No RSVP</div>
          <div style={{ fontSize: 15, color: C.text, fontWeight: 700, marginBottom: 2 }}>{scanResult.name}</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Ticket is mathematically valid but no RSVP found on Nostr. Relay may not have synced.</div>
          <button onClick={() => {
            const newVerified = { ...verified, [scanResult.npub]: { time: Date.now(), npub: scanResult.npub, ticketId: scanResult.ticketId } }
            setVerified(newVerified); saveVerified(newVerified); setScanResult(null)
          }} style={{ width: '100%', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: C.green, padding: '12px', borderRadius: 11, fontWeight: 800, fontSize: 14, cursor: 'pointer', marginBottom: 8 }}>
            Override — Let In
          </button>
        </>)}

        {/* ── INVALID ── */}
        {scanResult.status === 'invalid' && (<>
          <div style={{ display:'flex', justifyContent:'center', marginBottom: 12 }}><XCircle size={56} color="#ef4444" /></div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444', marginBottom: 8 }}>Invalid Ticket</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>{scanResult.msg}</div>
        </>)}

        <button onClick={() => setScanResult(null)} style={{ width: '100%', background: C.accent, border: 'none', color: '#000', padding: '14px', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
          Scan Next
        </button>
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
          <FileDown size={16} /> Export Attendees CSV</button>
            <button onClick={resetAttendance} style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:C.red, padding:'10px 16px', borderRadius:10, fontWeight:700, fontSize:13, cursor:'pointer', width:'100%', justifyContent:'center', marginBottom:8 }}>Reset Attendance
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
        // Verified by npub — unique per person, no collision
        const computedTicketId = r.npub && selectedEvent?.id
          ? generateTicketId(r.npub, selectedEvent.id)
          : r.ticketId
        const isAttended = verified[r.npub] || verified[computedTicketId]
        const name = profile.name || profile.display_name || (r.npub ? r.npub.slice(0, 16) + '…' : 'Unknown')
        return (
          <div key={r.npub || r.ticketId} style={{ background: C.card, border: `1px solid ${isAttended ? 'rgba(34,197,94,0.3)' : C.border}`, borderRadius: 14, padding: 16, marginBottom: 10 }}>
            {/* Header row — same as PostCard in live feed */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              <Avatar profile={profile} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{name}</span>
                  {profile.nip05 && (
                    <span style={{ fontSize: 11, color: C.accent, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <CheckCircle size={11} /> {profile.nip05}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  {r.npub ? r.npub.slice(0, 10) + '…' + r.npub.slice(-4) : ''} · {new Date(r.timestamp * 1000).toLocaleString()}
                </div>
              </div>
              {/* Attended / Pending badge */}
              <div style={{ flexShrink: 0, alignSelf: 'flex-start' }}>
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
            {/* Ticket ID row */}
            {computedTicketId && (
              <div style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace', background: C.dim, padding: '4px 10px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Ticket size={11} />{computedTicketId}
              </div>
            )}
          </div>
        )
      })}
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

