import { useState, useEffect, useRef } from 'react'
import { nip04, nip19 } from 'nostr-tools'
import { SimplePool } from 'nostr-tools/pool'
import { finalizeEvent } from 'nostr-tools/pure'
import { Send, ArrowLeft, MessageCircle, Loader, ChevronDown, CornerUpLeft, X } from 'lucide-react'

// Include more relays - primal doesn't require auth, good fallback
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.primal.net',
]

const C = {
  bg: '#080808', card: '#141414', border: 'rgba(247,147,26,0.18)',
  accent: '#F7931A', dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e',
}

const REACTIONS = ['⚡', '🟠', '🔥', '💪', '😂', '🎉', '👀', '🙏']

// Coin flip sound using Web Audio API
function playCoinSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.frequency.setValueAtTime(880, ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1)
    g.gain.setValueAtTime(0.3, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    o.start(ctx.currentTime)
    o.stop(ctx.currentTime + 0.3)
  } catch {}
}


// Encode reply into message content
function encodeReply(replyName, replyText, msgText) {
  return `REPLY:${JSON.stringify({ name: replyName, text: replyText })}\n---\n${msgText}`
}

// Decode message — returns { replyName, replyText, text }
function decodeMessage(raw) {
  if (!raw.startsWith('REPLY:')) return { text: raw, replyName: null, replyText: null }
  try {
    const newline = raw.indexOf('\n---\n')
    if (newline === -1) return { text: raw, replyName: null, replyText: null }
    const meta = JSON.parse(raw.slice('REPLY:'.length, newline))
    const text = raw.slice(newline + 5)
    return { text, replyName: meta.name, replyText: meta.text }
  } catch { return { text: raw, replyName: null, replyText: null } }
}


// ── Profile cache (localStorage, 24hr TTL) ────────────────────────────────────
const PROFILE_TTL = 3600000 // 1 hour

function getCachedProfile(pubkey) {
  try {
    const raw = localStorage.getItem('bitsavers_prof_' + pubkey)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > PROFILE_TTL) return null // stale
    return data
  } catch { return null }
}

function setCachedProfile(pubkey, data) {
  try {
    localStorage.setItem('bitsavers_prof_' + pubkey, JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

function getMissingPubkeys(pubkeys) {
  return pubkeys.filter(pk => !getCachedProfile(pk))
}

const shortNpub = n => n ? `${n.slice(0,10)}…${n.slice(-4)}` : ''
const timeAgo = ts => {
  const s = Math.floor(Date.now()/1000) - ts
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s/60) + 'm ago'
  if (s < 86400) return Math.floor(s/3600) + 'h ago'
  return new Date(ts*1000).toLocaleDateString('en-GB',{day:'numeric',month:'short'})
}

function getSkBytes() {
  try {
    const nsec = localStorage.getItem('bitsavers_nsec')
    if (!nsec) return null
    const { type, data } = nip19.decode(nsec.trim())
    return type === 'nsec' ? data : null
  } catch { return null }
}

// ── Shared pool singleton (same pattern as live feed) ────────────────────────
let _pool = null
const getPool = () => {
  if (!_pool) _pool = new SimplePool()
  return _pool
}

// ── Raw WebSocket DM fetcher with NIP-42 AUTH ─────────────────────────────────
// Nostr REQ format: ["REQ", subId, filter1, filter2, ...]  ← filters are SPREAD, NOT an array
function fetchDMsFromRelay(relayUrl, myPubkeyHex, skBytes, filter1, filter2, onEvent, onDone) {
  let ws
  const subId = 'dm-' + Math.random().toString(36).slice(2, 8)
  let done = false
  let authed = false

  const finish = () => {
    if (done) return
    done = true
    try { ws?.close() } catch {}
    onDone()
  }

  const sendReq = () => {
    // CORRECT format: spread filters as separate args in the JSON array
    ws.send(JSON.stringify(['REQ', subId, filter1, filter2]))
  }

  const sendAuth = (challenge) => {
    const authEvent = finalizeEvent({
      kind: 22242,
      created_at: Math.floor(Date.now()/1000),
      tags: [['relay', relayUrl], ['challenge', challenge]],
      content: '',
    }, skBytes)
    ws.send(JSON.stringify(['AUTH', authEvent]))
  }

  try {
    ws = new WebSocket(relayUrl)
    ws.onopen = () => sendReq()

    ws.onmessage = ({ data }) => {
      if (done) return
      let msg
      try { msg = JSON.parse(data) } catch { return }
      const [type, ...rest] = msg

      if (type === 'AUTH') {
        // Relay is requesting auth - sign the challenge
        sendAuth(rest[0])
      }

      if (type === 'OK') {
        // Auth accepted - re-send REQ if not yet authed
        if (!authed) {
          authed = true
          sendReq()
        }
      }

      if (type === 'EVENT') {
        // rest = [subId, event]
        const event = rest[1]
        if (event?.kind === 4) onEvent(event)
      }

      if (type === 'EOSE') {
        finish()
      }

      if (type === 'CLOSED') {
        const reason = (rest[1] || '').toLowerCase()
        // If auth-required but we haven't gotten AUTH challenge yet, wait
        // It'll come as a separate AUTH message
        if (!reason.includes('auth-required')) {
          finish()
        }
      }
    }

    ws.onerror = () => finish()
    ws.onclose = () => finish()
    setTimeout(() => finish(), 12000)
  } catch { finish() }

  return () => { done = true; try { ws?.close() } catch {} }
}

function AvatarIcon({ picture, name, size = 40 }) {
  const [err, setErr] = useState(false)
  const init = (name || '?').slice(0,2).toUpperCase()
  if (picture && !err)
    return <img src={picture} alt={init} onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size*0.35, fontWeight: 700, color: '#000', flexShrink: 0 }}>{init}</div>
}


// ── Live subscription — keeps WebSocket open after EOSE for real-time DMs ────
function subscribeLiveDMs(relayUrl, myPubkeyHex, skBytes, filter1, filter2, onEvent) {
  let ws, closed = false, authed = false
  const subId = 'dm-live-' + Math.random().toString(36).slice(2, 8)

  const sendReq = () => ws.send(JSON.stringify(['REQ', subId, filter1, filter2]))
  const sendAuth = (challenge) => {
    const authEvent = finalizeEvent({
      kind: 22242, created_at: Math.floor(Date.now()/1000),
      tags: [['relay', relayUrl], ['challenge', challenge]], content: '',
    }, skBytes)
    ws.send(JSON.stringify(['AUTH', authEvent]))
  }

  const connect = () => {
    if (closed) return
    try {
      ws = new WebSocket(relayUrl)
      ws.onopen = () => { if (!closed) sendReq() }
      ws.onmessage = ({ data }) => {
        if (closed) return
        let msg; try { msg = JSON.parse(data) } catch { return }
        const [type, ...rest] = msg
        if (type === 'AUTH') sendAuth(rest[0])
        if (type === 'OK' && !authed) { authed = true; sendReq() }
        if (type === 'EVENT' && rest[1]?.kind === 4) onEvent(rest[1])
        // EOSE — intentionally NOT closing, stay alive for new messages
      }
      ws.onerror = () => {}
      ws.onclose = () => { if (!closed) setTimeout(connect, 3000) } // reconnect
    } catch {}
  }

  connect()
  return () => { closed = true; try { ws?.close() } catch {} }
}


// Parse message — extracts quoted reply if present
function parseMessage({ id, rawText, isMine, ts }) {
  if (rawText?.startsWith('REPLY:')) {
    try {
      const [meta, ...rest] = rawText.split('\n---\n')
      const { name, text: replyText } = JSON.parse(meta.slice('REPLY:'.length))
      return { id, text: rest.join('\n---\n'), isMine, ts, replyToText: replyText, replyToName: name }
    } catch {}
  }
  return { id, text: rawText, isMine, ts }
}

// ─── Thread (full WhatsApp-style conversation) ────────────────────────────────
function Thread({ myPubkeyHex, peer, peerProfile, onBack }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [replyTo, setReplyTo] = useState(null) // { id, text, isMine }
  const [reactions, setReactions] = useState({}) // { msgId: [emoji, ...] }
  const [showReactions, setShowReactions] = useState(null) // msgId
  const [swipingId, setSwipingId] = useState(null)
  const swipeStartX = useRef(null)
  const bottomRef = useRef(null)
  const scrollRef = useRef(null)
  const [showJump, setShowJump] = useState(false)
  const userScrolledUp = useRef(false)
  const seenRef = useRef(new Set())
  const msgsRef = useRef([])
  const skBytes = getSkBytes()

  const peerNpub = (() => { try { return nip19.npubEncode(peer) } catch { return '' } })()
  const peerName = peerProfile?.name || peerProfile?.display_name || shortNpub(peerNpub)

  useEffect(() => {
    if (!myPubkeyHex || !peer || !skBytes) { setLoading(false); return }

    let doneCount = 0
    const total = RELAYS.length

    const onEvent = async (e) => {
      if (seenRef.current.has(e.id)) return
      // Filter: only this conversation
      const isMine = e.pubkey === myPubkeyHex
      if (isMine) {
        const pTag = e.tags.find(t => t[0] === 'p')?.[1]
        if (pTag !== peer) return
      } else {
        if (e.pubkey !== peer) return
      }
      seenRef.current.add(e.id)
      let decrypted
      try { decrypted = await nip04.decrypt(skBytes, isMine ? peer : e.pubkey, e.content) }
      catch { decrypted = '[could not decrypt]' }
      const decoded = decodeMessage(decrypted)
      msgsRef.current = [...msgsRef.current, { id: e.id, text: decoded.text, replyToName: decoded.replyName, replyToText: decoded.replyText, isMine, ts: e.created_at }]
        .sort((a,b) => a.ts - b.ts)
      setMessages([...msgsRef.current])
    }

    const onDone = () => { doneCount++; if (doneCount >= total) setLoading(false) }

    // Filter for this specific conversation
    const filterSent     = { kinds: [4], authors: [myPubkeyHex], '#p': [peer], limit: 500 }
    const filterReceived = { kinds: [4], authors: [peer], '#p': [myPubkeyHex], limit: 500 }

    // ── History fetch (closes after EOSE) ──
    const closers = RELAYS.map(relay =>
      fetchDMsFromRelay(relay, myPubkeyHex, skBytes, filterSent, filterReceived, onEvent, onDone)
    )

    // ── Live subscription — stays open, streams new messages in real-time ──
    const now = Math.floor(Date.now() / 1000)
    const liveFilterSent     = { kinds: [4], authors: [myPubkeyHex], '#p': [peer], since: now }
    const liveFilterReceived = { kinds: [4], authors: [peer], '#p': [myPubkeyHex], since: now }
    const liveClosers = RELAYS.map(relay =>
      subscribeLiveDMs(relay, myPubkeyHex, skBytes, liveFilterSent, liveFilterReceived, onEvent)
    )

    return () => {
      closers.forEach(c => c?.())
      liveClosers.forEach(c => c?.())
    }
  }, [myPubkeyHex, peer])

  const handleScroll = (e) => {
    const el = e.target
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const scrolledUp = distFromBottom > 200
    setShowJump(scrolledUp)
    userScrolledUp.current = scrolledUp
  }

  useEffect(() => {
    if (!userScrolledUp.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!text.trim() || sending || !skBytes || !peer) return
    setSending(true)
    try {
      const finalText = replyTo ? encodeReply(replyTo.senderName, replyTo.text, text.trim()) : text.trim()
      const encrypted = await nip04.encrypt(skBytes, peer, finalText)
      const event = finalizeEvent({
        kind: 4, created_at: Math.floor(Date.now()/1000),
        tags: [['p', peer]], content: encrypted,
      }, skBytes)
      // Publish to all relays
      RELAYS.forEach(relayUrl => {
        try {
          const ws = new WebSocket(relayUrl)
          ws.onopen = () => {
            ws.send(JSON.stringify(['EVENT', event]))
            setTimeout(() => { try { ws.close() } catch {} }, 3000)
          }
        } catch {}
      })
      // Mark as seen immediately so live sub skips it when relay echoes it back
      seenRef.current.add(event.id)
      // Add sent message immediately to UI
      const newMsg = { id: event.id, text: text.trim(), isMine: true, ts: event.created_at, replyToText: replyTo?.text || null, replyToName: replyTo?.senderName || null }
      msgsRef.current = [...msgsRef.current, newMsg]
      setMessages([...msgsRef.current])
      setText('')
      setReplyTo(null)
      playCoinSound()
    } catch(e) { alert('Failed: ' + e.message) }
    setSending(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', padding: '0 16px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 14, paddingBottom: 14, borderBottom: `1px solid ${C.border}`, marginBottom: 8, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 4, display: 'flex' }}>
          <ArrowLeft size={20} />
        </button>
        <AvatarIcon picture={peerProfile?.picture} name={peerName} size={40} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{peerName}</div>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace' }}>{shortNpub(peerNpub)}</div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8, position: 'relative' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '30px 0', color: C.muted, fontSize: 13 }}>
            <Loader size={14} style={{ animation: 'spin 1s linear infinite', color: C.accent }} />
            Connecting to Nostr relays…
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 13 }}>No messages yet — say hello!</div>
        )}
        {messages.map(m => {
          const msgReactions = reactions[m.id] || []
          return (
            <div key={m.id}
              style={{ display: 'flex', flexDirection: 'column', alignItems: m.isMine ? 'flex-end' : 'flex-start', paddingLeft: m.isMine ? 50 : 0, paddingRight: m.isMine ? 0 : 50 }}
              onTouchStart={e => { swipeStartX.current = e.touches[0].clientX }}
              onTouchMove={e => {
                if (swipeStartX.current === null) return
                const dx = e.touches[0].clientX - swipeStartX.current
                if (dx > 50) { setReplyTo({ id: m.id, text: m.text, isMine: m.isMine, senderName: m.isMine ? 'You' : peerName }); swipeStartX.current = null }
              }}
              onTouchEnd={() => { swipeStartX.current = null }}
            >
              {/* Bubble */}
              <div
                onDoubleClick={() => setReplyTo({ id: m.id, text: m.text, isMine: m.isMine, senderName: m.isMine ? 'You' : peerName })}
                onClick={() => setShowReactions(showReactions === m.id ? null : m.id)}
                style={{ padding: '10px 14px', borderRadius: m.isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: m.isMine ? C.accent : C.card, border: m.isMine ? 'none' : `1px solid ${C.border}`, cursor: 'pointer' }}
              >
                {/* Quoted reply block */}
                {m.replyToText && (
                  <div style={{ background: m.isMine ? 'rgba(0,0,0,0.15)' : 'rgba(247,147,26,0.08)', borderLeft: `3px solid ${m.isMine ? 'rgba(0,0,0,0.3)' : C.accent}`, borderRadius: 6, padding: '5px 9px', marginBottom: 7 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: m.isMine ? 'rgba(0,0,0,0.45)' : C.accent, marginBottom: 2 }}>{m.replyToName}</div>
                    <div style={{ fontSize: 12, color: m.isMine ? 'rgba(0,0,0,0.4)' : C.muted, lineHeight: 1.4 }}>{m.replyToText.slice(0, 80)}{m.replyToText.length > 80 ? '…' : ''}</div>
                  </div>
                )}
                <div style={{ fontSize: 14, color: m.isMine ? '#080808' : C.text, lineHeight: 1.5, wordBreak: 'break-word' }}>{m.text}</div>
                <div style={{ fontSize: 10, color: m.isMine ? 'rgba(0,0,0,0.45)' : C.muted, marginTop: 4, textAlign: 'right' }}>{timeAgo(m.ts)}</div>
              </div>

              {/* Reactions display */}
              {msgReactions.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap', justifyContent: m.isMine ? 'flex-end' : 'flex-start' }}>
                  {[...new Set(msgReactions)].map(emoji => (
                    <span key={emoji} style={{ fontSize: 13, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '2px 6px', cursor: 'pointer' }}
                      onClick={() => setReactions(prev => ({ ...prev, [m.id]: [...(prev[m.id] || []), emoji] }))}>
                      {emoji} {msgReactions.filter(r => r === emoji).length}
                    </span>
                  ))}
                </div>
              )}

              {/* Emoji picker */}
              {showReactions === m.id && (
                <div style={{ display: 'flex', gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, padding: '6px 10px', marginTop: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                  {REACTIONS.map(emoji => (
                    <span key={emoji} style={{ fontSize: 20, cursor: 'pointer' }}
                      onClick={() => { setReactions(prev => ({ ...prev, [m.id]: [...(prev[m.id] || []), emoji] })); setShowReactions(null) }}>
                      {emoji}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      {showJump && (
        <button onClick={() => {
          userScrolledUp.current = false
          setShowJump(false)
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        }}
          style={{ position: 'sticky', bottom: 70, alignSelf: 'flex-end', marginRight: 4, background: C.accent, border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.4)', flexShrink: 0 }}>
          <ChevronDown size={18} color="#000" />
        </button>
      )}
      </div>

      {/* Input */}
      {/* Reply preview bar */}
      {replyTo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: C.card, borderTop: `1px solid ${C.border}`, borderRadius: '8px 8px 0 0' }}>
          <CornerUpLeft size={14} color={C.accent} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.accent, marginBottom: 1 }}>{replyTo.senderName}</div>
            <div style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyTo.text.slice(0, 80)}{replyTo.text.length > 80 ? '…' : ''}</div>
          </div>
          <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 2, display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: replyTo ? 'none' : `1px solid ${C.border}`, flexShrink: 0 }}>
        <textarea value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Write a message…" rows={2}
          style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
        />
        <button onClick={send} disabled={!text.trim() || sending}
          style={{ background: C.accent, border: 'none', color: '#080808', width: 48, borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !text.trim() || sending ? 0.5 : 1, flexShrink: 0 }}>
          <Send size={18} />
        </button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ─── Inbox ────────────────────────────────────────────────────────────────────
function Inbox({ myPubkeyHex, onOpen }) {
  const [conversations, setConversations] = useState({})
  const [profiles, setProfiles] = useState({})
  const [newNpub, setNewNpub] = useState('')
  const [loading, setLoading] = useState(true)
  const seenRef = useRef(new Set())
  const convRef = useRef({})
  const skBytes = getSkBytes()

  useEffect(() => {
    if (!myPubkeyHex || !skBytes) { setLoading(false); return }
    let doneCount = 0
    const total = RELAYS.length

    const onEvent = async (e) => {
      if (seenRef.current.has(e.id)) return
      seenRef.current.add(e.id)
      const isMine = e.pubkey === myPubkeyHex
      const peerPubkey = isMine ? e.tags.find(t => t[0] === 'p')?.[1] : e.pubkey
      if (!peerPubkey || peerPubkey === myPubkeyHex) return

      let decrypted
      try { decrypted = await nip04.decrypt(skBytes, isMine ? peerPubkey : e.pubkey, e.content) }
      catch { decrypted = '[encrypted]' }

      // Strip REPLY prefix for inbox preview
      let previewText = decrypted
      if (previewText?.startsWith('REPLY:')) {
        try {
          const parts = previewText.split('\n---\n')
          previewText = parts.slice(1).join('\n---\n') || previewText
        } catch {}
      }
      if (!convRef.current[peerPubkey] || e.created_at > convRef.current[peerPubkey].ts) {
        convRef.current[peerPubkey] = { lastMsg: previewText, ts: e.created_at, isMine }
        setConversations({ ...convRef.current })
      }
    }

    const onDone = () => { doneCount++; if (doneCount >= total) setLoading(false) }

    // Inbox: all my DMs (sent and received)
    const filterSent     = { kinds: [4], authors: [myPubkeyHex], limit: 500 }
    const filterReceived = { kinds: [4], '#p': [myPubkeyHex], limit: 500 }

    const closers = RELAYS.map(relay =>
      fetchDMsFromRelay(relay, myPubkeyHex, skBytes, filterSent, filterReceived, onEvent, onDone)
    )

    // ── Live subscription — keeps inbox updated without refresh ──
    const now = Math.floor(Date.now() / 1000)
    const liveSent     = { kinds: [4], authors: [myPubkeyHex], since: now }
    const liveReceived = { kinds: [4], '#p': [myPubkeyHex], since: now }
    const liveClosers = RELAYS.map(relay =>
      subscribeLiveDMs(relay, myPubkeyHex, skBytes, liveSent, liveReceived, onEvent)
    )

    return () => {
      closers.forEach(c => c?.())
      liveClosers.forEach(c => c?.())
    }
  }, [myPubkeyHex])

  // Fetch profiles — exact same pattern as live feed
  useEffect(() => {
    const allPubkeys = Object.keys(conversations)
    if (!allPubkeys.length) return

    // Load cached profiles instantly into state first
    const fromCache = {}
    allPubkeys.forEach(pk => {
      const cached = getCachedProfile(pk)
      if (cached) fromCache[pk] = cached
    })
    if (Object.keys(fromCache).length) {
      setProfiles(prev => ({ ...prev, ...fromCache }))
    }

    // Only hit relays for pubkeys not in cache
    const missing = getMissingPubkeys(allPubkeys)
    if (!missing.length) return

    const pool = getPool()
    const sub = pool.subscribe(
      RELAYS,
      { kinds: [0], authors: missing, limit: missing.length },
      {
        onevent(e) {
          try {
            const p = JSON.parse(e.content)
            setCachedProfile(e.pubkey, p) // save to 1hr cache
            setProfiles(prev => ({ ...prev, [e.pubkey]: p }))
          } catch {}
        },
        oneose() { sub.close() },
      }
    )
  }, [Object.keys(conversations).join(',')])

  const startNew = () => {
    const val = newNpub.trim()
    if (!val) return
    try {
      const { type, data: pubkey } = nip19.decode(val)
      if (type !== 'npub') { alert('Paste a valid npub1… key'); return }
      onOpen(pubkey, profiles[pubkey] || {})
      setNewNpub('')
    } catch { alert('Invalid npub') }
  }

  const sorted = Object.entries(conversations).sort((a,b) => b[1].ts - a[1].ts)

  return (
    <div>
      <div style={{ marginBottom: 20, padding: 14, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14 }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>New Message</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newNpub} onChange={e => setNewNpub(e.target.value)}
            placeholder="Paste npub1… of recipient"
            style={{ flex: 1, background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'monospace' }} />
          <button onClick={startNew} disabled={!newNpub.trim()}
            style={{ background: C.accent, border: 'none', color: '#000', padding: '10px 16px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: !newNpub.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}>
            Open
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '50px 0', color: C.muted }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
            <Loader size={18} style={{ animation: 'spin 1s linear infinite', color: C.accent }} />
            <span style={{ fontSize: 14 }}>Connecting to Nostr relays…</span>
          </div>
          <div style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted }}>{RELAYS[0]} + {RELAYS.length - 1} more</div>
        </div>
      )}

      {!loading && sorted.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px 0', color: C.muted }}>
          <MessageCircle size={32} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>No messages yet</div>
          <div style={{ fontSize: 13 }}>Tap a profile anywhere to DM, or paste an npub above</div>
        </div>
      )}

      {sorted.map(([pubkey, conv]) => {
        const prof = profiles[pubkey] || {}
        const npub = (() => { try { return nip19.npubEncode(pubkey) } catch { return '' } })()
        const name = prof.name || prof.display_name || shortNpub(npub)
        return (
          <div key={pubkey} onClick={() => onOpen(pubkey, prof)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 10, cursor: 'pointer' }}>
            <AvatarIcon picture={prof.picture} name={name} size={46} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>{name}</div>
              <div style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {conv.isMine && <span style={{ color: C.accent }}>You: </span>}{conv.lastMsg}
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{timeAgo(conv.ts)}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function MessagesPage({ user, initialPeer, initialProfile }) {
  const [activePeer, setActivePeer] = useState(initialPeer || null)
  const [activePeerProfile, setActivePeerProfile] = useState(initialProfile || {})
  const myPubkeyHex = user?.pubkey || null

  if (!myPubkeyHex || !getSkBytes()) {
    return <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted, fontSize: 14 }}>Log in with your private key to use messages.</div>
  }

  return (
    <>
      <Inbox myPubkeyHex={myPubkeyHex} onOpen={(pk, prof) => { setActivePeer(pk); setActivePeerProfile(prof) }} />
      {activePeer && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: C.bg,
          display: 'flex', flexDirection: 'column',
          overflowY: 'hidden',
        }}>
          <Thread
            myPubkeyHex={myPubkeyHex}
            peer={activePeer}
            peerProfile={activePeerProfile}
            onBack={() => setActivePeer(null)}
          />
        </div>
      )}
    </>
  )
}

