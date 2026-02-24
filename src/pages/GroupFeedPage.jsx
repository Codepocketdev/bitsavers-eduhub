import { useState, useEffect, useRef } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import { nip19 } from 'nostr-tools'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import { ArrowLeft, Users, Send, Loader, Globe, Lock, CheckCircle, ChevronDown, CornerUpLeft, X } from 'lucide-react'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const C = {
  bg: '#080808', card: '#141414', border: 'rgba(247,147,26,0.18)',
  accent: '#F7931A', dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e',
}

// ── Module-level cache per group — survives re-renders and back navigation ────
const groupFeedCache = {}  // { [groupId]: { posts: [], profiles: {}, seenIds: Set } }

const PROTOCOL_PREFIXES = ['GROUP_JOIN:','GROUP_REQUEST:','GROUP:','GROUP_MEMBER:',
  'GROUP_MEMBER_REMOVE:','GROUP_APPROVED:','GROUP_REJECTED:','GROUP_STATE:','GROUP_DELETE:']
const isProtocolEvent = (content) => PROTOCOL_PREFIXES.some(p => content.startsWith(p))

const getGroupCache = (groupId) => {
  if (!groupFeedCache[groupId]) {
    // Hydrate posts from localStorage — strip any protocol events that slipped into cache
    const savedPosts = (() => {
      try {
        const all = JSON.parse(localStorage.getItem(`bitsavers_gposts_${groupId}`) || '[]')
        return all.filter(p => !isProtocolEvent(p.content))
      } catch { return [] }
    })()
    const savedProfiles = (() => { try { return JSON.parse(localStorage.getItem('bitsavers_profile_cache') || '{}') } catch { return {} } })()
    groupFeedCache[groupId] = { posts: savedPosts, profiles: savedProfiles, seenIds: new Set(savedPosts.map(p => p.id)) }
  }
  return groupFeedCache[groupId]
}

const savePostCache = (groupId, posts) => {
  try { localStorage.setItem(`bitsavers_gposts_${groupId}`, JSON.stringify(posts.slice(0, 50))) } catch {}
}

const saveProfileCache = (profiles) => {
  try { localStorage.setItem('bitsavers_profile_cache', JSON.stringify(profiles)) } catch {}
}

const timeAgo = (ts) => {
  const s = Math.floor(Date.now() / 1000) - ts
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s/60)}m`
  if (s < 86400) return `${Math.floor(s/3600)}h`
  return `${Math.floor(s/86400)}d`
}

function Avatar({ profile = {}, size = 38 }) {
  const [err, setErr] = useState(false)
  const initials = (profile.name || '?').slice(0, 2).toUpperCase()
  if (profile.picture && !err)
    return <img src={profile.picture} onError={() => setErr(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${C.border}`, flexShrink: 0 }} />
  return <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.33, fontWeight: 700, color: '#000', flexShrink: 0 }}>{initials}</div>
}

const REACTIONS = ['⚡', '🟠', '🔥', '💪', '😂', '🎉', '👀', '🙏']

function playCoinSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.frequency.setValueAtTime(880, ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1)
    g.gain.setValueAtTime(0.3, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.3)
  } catch {}
}

function parseGroupPost(post) {
  if (post.content?.startsWith('REPLY:')) {
    try {
      const [meta, ...rest] = post.content.split('\n---\n')
      const { name, text } = JSON.parse(meta.slice('REPLY:'.length))
      return { ...post, displayContent: rest.join('\n---\n'), replyToText: text, replyToName: name }
    } catch {}
  }
  return { ...post, displayContent: post.content }
}


export default function GroupFeedPage({ group, user, onBack }) {
  const [tab, setTab] = useState('feed')
  const cache = getGroupCache(group.id)
  const [posts, setPosts] = useState(cache.posts)
  const [profiles, setProfiles] = useState(cache.profiles)
  const [members, setMembers] = useState(() => {
    // Hydrate from localStorage member cache if available
    try { return JSON.parse(localStorage.getItem(`bitsavers_gmembers_${group.id}`) || '[]') } catch { return [] }
  })
  const [memberProfiles, setMemberProfiles] = useState(cache.profiles)
  const [loading, setLoading] = useState(cache.posts.length === 0)
  const [compose, setCompose] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [reactions, setReactions] = useState({})
  const [showReactions, setShowReactions] = useState(null)
  const swipeStartX = useRef(null)
  const [swipeOffsets, setSwipeOffsets] = useState({})
  const poolRef = useRef(null)
  const bottomRef = useRef(null)
  const scrollRef = useRef(null)
  const [showJump, setShowJump] = useState(false)
  // Track whether user has manually scrolled up so we don't hijack their scroll position
  const userScrolledUp = useRef(false)

  const groupTag = `bitsavers-group-${group.id}`
  const myPubkey = user?.pubkey || ''

  // Scroll to bottom on first load (instant, before paint)
  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 100)
  }, [])

  // Auto-scroll to bottom when new posts arrive — but only if user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledUp.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [posts])

  // Show jump button when user scrolls up; track manual scroll position
  const handleScroll = (e) => {
    const el = e.target
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const scrolledUp = distFromBottom > 200
    setShowJump(scrolledUp)
    userScrolledUp.current = scrolledUp
  }

  useEffect(() => {
    const cache = getGroupCache(group.id)
    const pool = new SimplePool()
    poolRef.current = pool
    const since = Math.floor(Date.now() / 1000) - 86400 * 30

    const sub = pool.subscribe(RELAYS, {
      kinds: [1], '#t': [groupTag], since, limit: 100
    }, {
      onevent(e) {
        if (cache.seenIds.has(e.id)) return
        if (isProtocolEvent(e.content)) return
        cache.seenIds.add(e.id)
        const post = { id: e.id, pubkey: e.pubkey, content: e.content, created_at: e.created_at }
        // ✅ Keep sorted oldest → newest (old at top, new at bottom like a chat)
        cache.posts = [...cache.posts, post].sort((a, b) => a.created_at - b.created_at)
        savePostCache(group.id, cache.posts)
        setPosts([...cache.posts])
      },
      oneose() {
        sub.close()
        setLoading(false)

        // ── Live sub — stays open, streams new posts in real time ──
        const now = Math.floor(Date.now() / 1000)
        pool.subscribe(RELAYS, { kinds: [1], '#t': [groupTag], since: now }, {
          onevent(e) {
            if (cache.seenIds.has(e.id)) return
            if (isProtocolEvent(e.content)) return
            cache.seenIds.add(e.id)
            const post = { id: e.id, pubkey: e.pubkey, content: e.content, created_at: e.created_at }
            cache.posts = [...cache.posts, post].sort((a, b) => a.created_at - b.created_at)
            savePostCache(group.id, cache.posts)
            setPosts([...cache.posts])
            // Fetch profile if missing
            if (!cache.profiles[e.pubkey]) {
              const pSub = pool.subscribe(RELAYS, { kinds: [0], authors: [e.pubkey], limit: 1 }, {
                onevent(pe) {
                  try {
                    const p = JSON.parse(pe.content)
                    cache.profiles[pe.pubkey] = p
                    saveProfileCache(cache.profiles)
                    setProfiles(prev => ({ ...prev, [pe.pubkey]: p }))
                  } catch {}
                },
                oneose() { pSub.close() }
              })
            }
          }
          // intentionally no oneose — keep alive
        })

        // Only fetch profiles we don't already have cached
        const pubkeys = [...new Set(cache.posts.map(p => p.pubkey))].filter(pk => !cache.profiles[pk])
        if (!pubkeys.length) return
        const pSub = pool.subscribe(RELAYS, { kinds: [0], authors: pubkeys, limit: pubkeys.length }, {
          onevent(e) {
            try {
              const p = JSON.parse(e.content)
              cache.profiles[e.pubkey] = p
              saveProfileCache(cache.profiles)
              setProfiles(prev => ({ ...prev, [e.pubkey]: p }))
              setMemberProfiles(prev => ({ ...prev, [e.pubkey]: p }))
            } catch {}
          },
          oneose() { pSub.close() }
        })
        setTimeout(() => pSub.close(), 6000)
      }
    })

    // ── Load members: GROUP_STATE = source of truth, GROUP_MEMBER = fallback ──
    const joinTs = {}    // pubkey → latest join ts
    const removeTs = {}  // pubkey → latest remove ts
    const stateMap = {}  // pubkey → { state, ts } from GROUP_STATE events
    let doneSubs = 0

    const onBothDone = () => {
      doneSubs++
      if (doneSubs < 2) return
      // GROUP_STATE wins — latest definitive signal from admin or user
      // Fall back to joinTs/removeTs for users without a GROUP_STATE event yet
      const allPks = new Set([...Object.keys(stateMap), ...Object.keys(joinTs)])
      const finalMembers = [...allPks].filter(pk => {
        const st = stateMap[pk]
        if (st) return st.state === 'member'
        return joinTs[pk] !== undefined && (!removeTs[pk] || joinTs[pk] > removeTs[pk])
      })
      setMembers(finalMembers)
      try { localStorage.setItem(`bitsavers_gmembers_${group.id}`, JSON.stringify(finalMembers)) } catch {}
      // Also write to shared count cache so GroupsPage cards show correct count immediately
      try {
        const counts = JSON.parse(localStorage.getItem('bitsavers_group_counts') || '{}')
        counts[group.id] = finalMembers.length
        localStorage.setItem('bitsavers_group_counts', JSON.stringify(counts))
      } catch {}

      const missing = finalMembers.filter(pk => !cache.profiles[pk])
      if (!missing.length) { setMemberProfiles({ ...cache.profiles }); return }
      const pSub = pool.subscribe(RELAYS, { kinds: [0], authors: missing, limit: missing.length }, {
        onevent(e) {
          try {
            const p = JSON.parse(e.content)
            cache.profiles[e.pubkey] = p
            saveProfileCache(cache.profiles)
            setMemberProfiles(prev => ({ ...prev, [e.pubkey]: p }))
          } catch {}
        },
        oneose() { pSub.close() }
      })
      setTimeout(() => pSub.close(), 8000)
    }

    // ── Q1: GROUP_STATE events ──
    const stateSub = pool.subscribe(RELAYS, {
      kinds: [1], '#t': [`bitsavers-group-state-${group.id}`], limit: 500
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
      oneose() { stateSub.close(); onBothDone() }
    })
    setTimeout(() => stateSub.close(), 10000)

    // ── Q2: GROUP_MEMBER events — legacy fallback ──
    const mSub = pool.subscribe(RELAYS, {
      kinds: [1], '#t': [`bitsavers-group-member-${group.id}`], limit: 500
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
      oneose() { mSub.close(); onBothDone() }
    })
    setTimeout(() => mSub.close(), 10000)

    setTimeout(() => { sub.close(); setLoading(false) }, 10000)
    return () => { sub.close() }
  }, [group.id])

  const publishPost = async () => {
    if (!compose.trim()) return
    setPublishing(true)
    const nsec = localStorage.getItem('bitsavers_nsec')
    if (!nsec) { setPublishing(false); return }
    try {
      const skBytes = nsecToBytes(nsec)
      const pool = getPool()
      const tags = [['t', groupTag]]
      const msgBody = replyTo
        ? `REPLY:${JSON.stringify({ name: replyTo.senderName, text: replyTo.text.slice(0, 80) })}\n---\n${compose.trim()}`
        : compose.trim()
      const ev = finalizeEvent({
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: msgBody,
      }, skBytes)
      await Promise.any(pool.publish(RELAYS, ev))
      const newPost = { id: ev.id, pubkey: ev.pubkey, content: ev.content, created_at: ev.created_at }
      // ✅ Append and sort so the new post lands at the bottom (newest last)
      cache.posts = [...cache.posts, newPost].sort((a, b) => a.created_at - b.created_at)
      cache.seenIds.add(ev.id)
      savePostCache(group.id, cache.posts)
      setPosts([...cache.posts])
      setCompose('')
      setReplyTo(null)
      playCoinSound()
      // Always scroll to bottom after sending your own message
      userScrolledUp.current = false
    } catch (e) { console.error(e) }
    setPublishing(false)
  }

  const tabs = [
    { id: 'feed', label: 'Feed' },
    { id: 'members', label: `Members (${members.length})` },
    { id: 'about', label: 'About' },
  ]

  // Group avatar — use cover image or initials
  const groupInitials = (group.name || 'G').slice(0, 2).toUpperCase()

  return (
    <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.bg, position: 'relative' }}>

      {/* ── WhatsApp-style header — always fixed ── */}
      <div style={{ flexShrink: 0, background: C.card, borderBottom: `1px solid ${C.border}`, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={22} />
        </button>
        {group.coverImage
          ? <img src={group.coverImage} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${C.border}` }} />
          : <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#000', flexShrink: 0 }}>{groupInitials}</div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</div>
          {group.institution && <div style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.institution}</div>}
        </div>
        {group.isPrivate && (
          <Lock size={14} color="#eab308" style={{ flexShrink: 0 }} />
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 0, background: C.card, borderBottom: `1px solid ${C.border}` }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: '12px 6px', border: 'none', borderBottom: `2px solid ${tab === t.id ? C.accent : 'transparent'}`, background: 'transparent', color: tab === t.id ? C.accent : C.muted, fontWeight: tab === t.id ? 800 : 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Scrollable content area ── */}
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '12px 4px 0', position: 'relative' }}>

      {/* ── FEED TAB ── */}
      {tab === 'feed' && (
        <>
          <div style={{ paddingBottom: 12 }}>

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: C.muted }}>
                <Loader size={18} style={{ animation: 'spin 1s linear infinite', color: C.accent }} />
                <span style={{ fontSize: 14 }}>Connecting to Nostr relays…</span>
              </div>
            </div>
          )}

          {!loading && posts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 0', color: C.muted }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>
                <Send size={32} color={C.muted} style={{ display: 'block', margin: '0 auto', opacity: 0.3 }} />
              </div>
              <div style={{ fontSize: 14 }}>No posts yet — be the first!</div>
            </div>
          )}

          {posts.map(rawPost => {
            const post = parseGroupPost(rawPost)
            const isMine = post.pubkey === myPubkey
            const profile = profiles[post.pubkey] || {}
            const name = profile.name || profile.display_name || post.pubkey.slice(0, 10) + '…'
            const imgMatch = post.displayContent?.match(/https?:\/\/\S+\.(jpg|jpeg|png|gif|webp)/i)
            const text = post.displayContent?.replace(/https?:\/\/\S+/g, '').trim()
            return (
              <div key={post.id}
                style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', marginBottom: 12 }}
                onTouchStart={e => { swipeStartX.current = e.touches[0].clientX }}
                onTouchMove={e => {
                  if (swipeStartX.current === null) return
                  const dx = e.touches[0].clientX - swipeStartX.current
                  if (dx > 0 && dx < 80) {
                    setSwipeOffsets(prev => ({ ...prev, [post.id]: Math.min(dx * 0.4, 24) }))
                  }
                  if (dx > 50) {
                    const senderName = isMine ? 'You' : (profiles[post.pubkey]?.name || profiles[post.pubkey]?.display_name || 'them')
                    setReplyTo({ id: post.id, text: text || '', senderName })
                    setSwipeOffsets(prev => ({ ...prev, [post.id]: 0 }))
                    swipeStartX.current = null
                  }
                }}
                onTouchEnd={() => {
                  swipeStartX.current = null
                  setSwipeOffsets(prev => ({ ...prev, [post.id]: 0 }))
                }}
              >
              <div style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, width: '100%', paddingLeft: isMine ? 50 : 0, paddingRight: isMine ? 0 : 50, transform: `translateX(${swipeOffsets[post.id] || 0}px)`, transition: swipeOffsets[post.id] ? 'none' : 'transform 0.2s ease' }}>
                {/* Avatar — others only, bottom aligned */}
                {!isMine && (
                  <div style={{ flexShrink: 0, marginBottom: 2 }}>
                    <Avatar profile={profile} size={34} />
                  </div>
                )}

                {/* Bubble container */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMine ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                }}>
                  {/* Bubble */}
                  <div
                    onClick={() => setShowReactions(showReactions === post.id ? null : post.id)}
                    onDoubleClick={() => {
                      const senderName = isMine ? 'You' : (profiles[post.pubkey]?.name || profiles[post.pubkey]?.display_name || 'them')
                      setReplyTo({ id: post.id, text: text || '', senderName })
                    }}
                    style={{ padding: '10px 14px', borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: isMine ? C.accent : C.card, border: isMine ? 'none' : `1px solid ${C.border}`, cursor: 'pointer' }}
                  >
                    {/* Name inside bubble — others only */}
                    {!isMine && (
                      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 5 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: C.accent }}>{name}</span>
                        {profile.nip05 && <span style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{profile.nip05}</span>}
                      </div>
                    )}
                    {/* Quoted reply block */}
                    {post.replyToText && (
                      <div style={{ background: isMine ? 'rgba(0,0,0,0.15)' : 'rgba(247,147,26,0.08)', borderLeft: `3px solid ${isMine ? 'rgba(0,0,0,0.3)' : C.accent}`, borderRadius: 6, padding: '5px 9px', marginBottom: 7 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: isMine ? 'rgba(0,0,0,0.45)' : C.accent, marginBottom: 2 }}>{post.replyToName}</div>
                        <div style={{ fontSize: 12, color: isMine ? 'rgba(0,0,0,0.4)' : C.muted, lineHeight: 1.4 }}>{post.replyToText.slice(0, 80)}{post.replyToText.length > 80 ? '…' : ''}</div>
                      </div>
                    )}
                    {text && <div style={{ fontSize: 14, color: isMine ? '#080808' : C.text, lineHeight: 1.6, wordBreak: 'break-word', marginBottom: imgMatch ? 8 : 0 }}>{text}</div>}
                    {imgMatch && <img src={imgMatch[0]} alt="" style={{ width: '100%', maxWidth: 260, borderRadius: 8, display: 'block' }} onError={e => e.target.style.display = 'none'} />}
                    <div style={{ fontSize: 10, color: isMine ? 'rgba(0,0,0,0.45)' : C.muted, marginTop: 4, textAlign: 'right' }}>{timeAgo(post.created_at)}</div>
                  </div>
                </div>
              </div>
              {/* Reactions display */}
              {(reactions[post.id] || []).length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap', justifyContent: isMine ? 'flex-end' : 'flex-start', paddingLeft: isMine ? 50 : 0, paddingRight: isMine ? 0 : 50 }}>
                  {[...new Set(reactions[post.id])].map(emoji => (
                    <span key={emoji} style={{ fontSize: 13, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '2px 6px', cursor: 'pointer' }}
                      onClick={() => setReactions(prev => ({ ...prev, [post.id]: [...(prev[post.id] || []), emoji] }))}>
                      {emoji} {reactions[post.id].filter(r => r === emoji).length}
                    </span>
                  ))}
                </div>
              )}
              {/* Emoji picker */}
              {showReactions === post.id && (
                <div style={{ display: 'flex', gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, padding: '6px 10px', marginTop: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', alignSelf: isMine ? 'flex-end' : 'flex-start' }}>
                  {REACTIONS.map(emoji => (
                    <span key={emoji} style={{ fontSize: 20, cursor: 'pointer' }}
                      onClick={() => { setReactions(prev => ({ ...prev, [post.id]: [...(prev[post.id] || []), emoji] })); setShowReactions(null) }}>
                      {emoji}
                    </span>
                  ))}
                </div>
              )}
              </div>
            )
          })}
          </div>

          {/* ── Compose ── */}
          <div style={{ position: 'sticky', bottom: 0, background: C.bg, paddingBottom: 12, paddingTop: 6 }}>
          {replyTo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: C.card, border: `1px solid ${C.border}`, borderBottom: 'none', borderRadius: '10px 10px 0 0' }}>
              <CornerUpLeft size={13} color={C.accent} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.accent }}>{replyTo.senderName}</div>
                <div style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyTo.text.slice(0, 80)}</div>
              </div>
              <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 2, display: 'flex' }}><X size={13} /></button>
            </div>
          )}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <textarea
                value={compose}
                onChange={e => setCompose(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); publishPost() } }}
                placeholder={`Message ${group.name}…`}
                rows={1}
                style={{ flex: 1, background: 'transparent', border: 'none', color: C.text, fontSize: 14, outline: 'none', resize: 'none', lineHeight: 1.6, maxHeight: 120, overflowY: 'auto' }}
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
              />
              <button onClick={publishPost} disabled={publishing || !compose.trim()}
                style={{ background: compose.trim() ? C.accent : C.dim, border: 'none', color: compose.trim() ? '#000' : C.muted, padding: '10px 16px', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: compose.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, transition: 'all 0.2s' }}>
                {publishing ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── MEMBERS TAB ── */}
      {tab === 'members' && (
        <div>
          {members.length === 0 && (
            <div style={{ textAlign: 'center', padding: '50px 0', color: C.muted, fontSize: 14 }}>No members yet</div>
          )}
          {members.map(pubkey => {
            const profile = memberProfiles[pubkey] || {}
            const name = profile.name || profile.display_name || pubkey.slice(0, 16) + '…'
            const isAdmin = (group.admins || []).includes(pubkey)
            return (
              <div key={pubkey} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar profile={profile} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                  {profile.nip05 && <div style={{ fontSize: 11, color: C.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.nip05}</div>}
                </div>
                {isAdmin && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: C.dim, color: C.accent, border: `1px solid ${C.border}`, flexShrink: 0 }}>Admin</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── ABOUT TAB ── */}
      {tab === 'about' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 14 }}>{group.name}</div>
          {group.institution && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 3 }}>INSTITUTION</div>
              <div style={{ fontSize: 14, color: C.text }}>{group.institution}</div>
            </div>
          )}
          {group.description && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 3 }}>ABOUT</div>
              <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.7 }}>{group.description}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 3 }}>TYPE</div>
            <div style={{ fontSize: 14, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
              {group.isPrivate ? <><Lock size={13} color="#eab308" /> Private Group</> : <><Globe size={13} color={C.green} /> Public Group</>}
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 3 }}>MEMBERS</div>
            <div style={{ fontSize: 14, color: C.text }}>{members.length} member{members.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      )}

        <div ref={bottomRef} style={{ height: 1 }} />
      </div> {/* end scrollable area */}

      {/* Jump to bottom button */}
      {showJump && (
        <button onClick={() => {
          userScrolledUp.current = false
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        }}
          style={{ position: 'absolute', bottom: 90, right: 20, zIndex: 10, background: C.accent, border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
          <ChevronDown size={20} color="#000" />
        </button>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

