import { useState, useEffect, useRef } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import { RefreshCw, Play, Calendar, User, ExternalLink } from 'lucide-react'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const BLOG_TAG = 'bitsavers-blog'

const C = {
  bg: '#080808', surface: '#0f0f0f', card: '#141414',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e',
}

// ─── Auto-pause video when scrolled out of view ───────────────────────────────
function AutoPauseVideo({ src, style = {} }) {
  const ref = useRef()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (!entry.isIntersecting) el.pause() },
      { threshold: 0.2 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <video
      ref={ref} controls
      style={{ width: '100%', borderRadius: 12, maxHeight: 320, background: '#000', display: 'block', ...style }}
      onPlay={e => {
        document.querySelectorAll('video').forEach(v => { if (v !== e.target) v.pause() })
      }}
    >
      <source src={src} />
    </video>
  )
}

// ─── Detect platform + extract ID ────────────────────────────────────────────
function parseUrl(url) {
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
  if (yt) return { platform: 'youtube', id: yt[1] }
  // Full TikTok URL with video ID = embeddable iframe
  const tt = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/)
  if (tt) return { platform: 'tiktok', id: tt[1] }
  // Short or unknown TikTok URL = show thumbnail card with link
  if (url.includes('tiktok.com') || url.includes('vt.tiktok.com')) return { platform: 'tiktok_short' }
  if (url.includes('instagram.com')) return { platform: 'instagram' }
  if (url.includes('x.com') || url.includes('twitter.com')) return { platform: 'twitter' }
  if (url.match(/\.(mp4|webm|ogg)$/i)) return { platform: 'video' }
  return { platform: 'link' }
}

// ─── YouTube player ───────────────────────────────────────────────────────────
function YouTubeEmbed({ id }) {
  const [playing, setPlaying] = useState(false)
  const containerRef = useRef()

  useEffect(() => {
    if (!playing) return
    const el = containerRef.current
    if (!el) return
    // When scrolled out of view — reset to thumbnail (stops audio)
    const observer = new IntersectionObserver(
      ([entry]) => { if (!entry.isIntersecting) setPlaying(false) },
      { threshold: 0.2 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [playing])

  return (
    <div ref={containerRef} style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
      {!playing ? (
        <div onClick={() => setPlaying(true)} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}>
          <img
            src={`https://img.youtube.com/vi/${id}/maxresdefault.jpg`}
            onError={e => { e.target.src = `https://img.youtube.com/vi/${id}/hqdefault.jpg` }}
            alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 32px rgba(247,147,26,0.6)' }}>
              <Play size={28} fill="#000" color="#000" style={{ marginLeft: 4 }} />
            </div>
          </div>
        </div>
      ) : (
        <iframe
          src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          allow="autoplay; encrypted-media; fullscreen" allowFullScreen
        />
      )}
    </div>
  )
}

// ─── TikTok embed ─────────────────────────────────────────────────────────────
function TikTokEmbed({ id, url }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.2 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ borderRadius: 12, overflow: 'hidden', background: '#000', display: 'flex', justifyContent: 'center' }}>
      {visible ? (
        <iframe
          src={`https://www.tiktok.com/embed/v2/${id}`}
          style={{ width: '100%', height: 500, border: 'none', maxWidth: 360 }}
          allowFullScreen allow="encrypted-media"
        />
      ) : (
        <div style={{ width: '100%', height: 500, maxWidth: 360, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Play size={40} color="#555" />
        </div>
      )}
    </div>
  )
}

// ─── Instagram card ───────────────────────────────────────────────────────────
function InstagramCard({ url, thumbnail, title }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none', borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)', padding: 2 }}>
      <div style={{ borderRadius: 10, overflow: 'hidden', background: C.card }}>
        {thumbnail && (
          <img src={thumbnail} alt="" style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} onError={e => e.target.style.display = 'none'} />
        )}
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title || 'Watch on Instagram'}</div>
          <ExternalLink size={16} color={C.muted} />
        </div>
      </div>
    </a>
  )
}

// ─── Twitter/X card ───────────────────────────────────────────────────────────
function TwitterCard({ url, thumbnail }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none', borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}`, background: C.card }}>
      {thumbnail && (
        <img src={thumbnail} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} onError={e => e.target.style.display = 'none'} />
      )}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>View on X / Twitter</div>
        <ExternalLink size={16} color={C.muted} />
      </div>
    </a>
  )
}

// ─── Media renderer ───────────────────────────────────────────────────────────
function MediaBlock({ post }) {
  const parsed = parseUrl(post.videoUrl)
  if (!parsed) {
    // No video — just show thumbnail if available
    return post.thumbnail
      ? <img src={post.thumbnail} alt="" style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 12, display: 'block' }} onError={e => e.target.style.display='none'} />
      : null
  }

  if (parsed.platform === 'youtube') return <YouTubeEmbed id={parsed.id} />
  if (parsed.platform === 'tiktok') return <TikTokEmbed id={parsed.id} url={post.videoUrl} />
  if (parsed.platform === 'tiktok_short') return (
    <a href={post.videoUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
      {post.thumbnail && <img src={post.thumbnail} alt="" style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 12, display: 'block' }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: C.dim, border: `1px solid ${C.border}`, borderRadius: 12, marginTop: post.thumbnail ? 8 : 0, color: C.accent, fontSize: 13, fontWeight: 600 }}>
        <Play size={14} /> Watch on TikTok
      </div>
    </a>
  )
  if (parsed.platform === 'instagram') return <InstagramCard url={post.videoUrl} thumbnail={post.thumbnail} title={post.oembedTitle} />
  if (parsed.platform === 'twitter') return <TwitterCard url={post.videoUrl} thumbnail={post.thumbnail} />
  if (parsed.platform === 'video') return <AutoPauseVideo src={post.videoUrl} />
  return null
}

// ─── Blog post card ───────────────────────────────────────────────────────────
function PostCard({ post }) {
  const [expanded, setExpanded] = useState(false)
  const date = new Date(post.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, marginBottom: 16, overflow: 'hidden' }}>
      {/* Media block at top */}
      <div style={{ padding: '14px 14px 0' }}>
        <MediaBlock post={post} />
      </div>

      <div style={{ padding: '14px 16px 16px' }}>
        {/* Category */}
        {post.category && (
          <div style={{ display: 'inline-block', background: C.dim, border: `1px solid ${C.border}`, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
            {post.category}
          </div>
        )}

        {/* Title */}
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 8, lineHeight: 1.3 }}>{post.title}</div>

        {/* Meta */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.muted }}>
            <Calendar size={11} /> {date}
          </div>
          {post.author && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.muted }}>
              <User size={11} /> {post.author}
            </div>
          )}
        </div>

        {/* Description / caption */}
        {post.description && (
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, margin: 0 }}>
            {expanded || post.description.length < 140
              ? post.description
              : post.description.slice(0, 140) + '…'}
            {post.description.length >= 140 && (
              <span onClick={() => setExpanded(p => !p)} style={{ color: C.accent, cursor: 'pointer', fontWeight: 600, marginLeft: 4 }}>
                {expanded ? ' less' : ' more'}
              </span>
            )}
          </p>
        )}

        {/* Auto-fetched caption from oEmbed */}
        {post.oembedCaption && !post.description && (
          <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>
            {expanded || post.oembedCaption.length < 140
              ? post.oembedCaption
              : post.oembedCaption.slice(0, 140) + '…'}
            {post.oembedCaption.length >= 140 && (
              <span onClick={() => setExpanded(p => !p)} style={{ color: C.accent, cursor: 'pointer', fontWeight: 600, marginLeft: 4 }}>
                {expanded ? ' less' : ' more'}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Main BlogPage ────────────────────────────────────────────────────────────
export default function BlogPage() {
  const [posts, setPosts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bitsavers_blog') || '[]') } catch { return [] }
  })
  const [fetching, setFetching] = useState(false)
  const [filter, setFilter] = useState('all')

  const fetchPosts = () => {
    setFetching(true)
    const pool = new SimplePool()
    const seen = new Set()
    const byId = {}
    let eoseCount = 0

    RELAYS.forEach(relay => {
      const sub = pool.subscribe([relay], { kinds: [1], '#t': [BLOG_TAG], limit: 100 }, {
        onevent(e) {
          if (seen.has(e.id)) return
          seen.add(e.id)
          try {
            if (e.content.startsWith('BLOG_POST:')) {
              const data = JSON.parse(e.content.slice('BLOG_POST:'.length))
              if (!data.id) return
              if (!byId[data.id] || e.created_at > byId[data.id].created_at) {
                byId[data.id] = { ...data, created_at: e.created_at }
              }
            } else if (e.content.startsWith('BLOG_DELETE:')) {
              const { id } = JSON.parse(e.content.slice('BLOG_DELETE:'.length))
              if (!byId[id] || e.created_at > byId[id].created_at) {
                byId[id] = { id, _deleted: true, created_at: e.created_at }
              }
            }
          } catch {}
        },
        oneose() {
          sub.close()
          eoseCount++
          if (eoseCount >= RELAYS.length) {
            const result = Object.values(byId).filter(p => !p._deleted).sort((a, b) => b.createdAt - a.createdAt)
            if (result.length > 0) {
              localStorage.setItem('bitsavers_blog', JSON.stringify(result))
              setPosts(result)
            }
            setFetching(false)
          }
        }
      })
    })
    setTimeout(() => setFetching(false), 10000)
  }

  useEffect(() => { fetchPosts() }, [])

  const categories = ['all', ...new Set(posts.map(p => p.category).filter(Boolean))]
  const filtered = filter === 'all' ? posts : posts.filter(p => p.category === filter)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 2 }}>Blog</div>
          <div style={{ fontSize: 13, color: C.muted }}>Bitcoin education & community updates</div>
        </div>
        <button onClick={fetchPosts} disabled={fetching} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <RefreshCw size={13} style={{ animation: fetching ? 'spin 1s linear infinite' : 'none' }} />
          {fetching ? 'Syncing…' : 'Refresh'}
        </button>
      </div>

      {categories.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {categories.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{ padding: '5px 14px', borderRadius: 20, border: `1px solid ${filter === c ? C.accent : C.border}`, background: filter === c ? C.dim : 'transparent', color: filter === c ? C.accent : C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
              {c}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && !fetching && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted }}>
          <Play size={36} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>No posts yet</div>
          <div style={{ fontSize: 13 }}>Admin can add content from Admin Panel → Blog tab</div>
        </div>
      )}

      {filtered.map(post => <PostCard key={post.id} post={post} />)}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

