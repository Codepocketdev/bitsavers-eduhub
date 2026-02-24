import { useState } from 'react'
import { Plus, Trash2, Save, ChevronDown, ChevronUp, Loader, Youtube, Link, Film, RefreshCw } from 'lucide-react'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import ImageUpload from '../components/ImageUpload'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const BLOG_TAG = 'bitsavers-blog'

const C = {
  bg: '#080808', surface: '#0f0f0f', card: '#141414',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

const getPosts = () => { try { return JSON.parse(localStorage.getItem('bitsavers_blog') || '[]') } catch { return [] } }
const savePosts = d => localStorage.setItem('bitsavers_blog', JSON.stringify(d))

const publishPost = async (post) => {
  const nsec = localStorage.getItem('bitsavers_nsec')
  if (!nsec) throw new Error('No private key')
  const skBytes = nsecToBytes(nsec)
  const pool = getPool()
  const event = finalizeEvent({
    kind: 1, created_at: Math.floor(Date.now() / 1000),
    tags: [['t', 'bitsavers'], ['t', BLOG_TAG]],
    content: 'BLOG_POST:' + JSON.stringify(post),
  }, skBytes)
  await Promise.any(pool.publish(RELAYS, event))
}

const publishDelete = async (id) => {
  const nsec = localStorage.getItem('bitsavers_nsec')
  if (!nsec) return
  const skBytes = nsecToBytes(nsec)
  const pool = getPool()
  const event = finalizeEvent({
    kind: 1, created_at: Math.floor(Date.now() / 1000),
    tags: [['t', 'bitsavers'], ['t', BLOG_TAG]],
    content: 'BLOG_DELETE:' + JSON.stringify({ id }),
  }, skBytes)
  await Promise.any(pool.publish(RELAYS, event))
}

function detectPlatform(url) {
  if (!url) return null
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube'
  // Full TikTok URL with video ID = embeddable
  if (url.match(/tiktok\.com\/@[^/]+\/video\/\d+/)) return 'TikTok'
  // Short TikTok URL = not embeddable, needs full URL
  if (url.includes('tiktok.com') || url.includes('vt.tiktok.com')) return 'TikTok_short'
  if (url.includes('instagram.com')) return 'Instagram'
  if (url.includes('x.com') || url.includes('twitter.com')) return 'X / Twitter'
  if (url.match(/\.(mp4|webm)$/i)) return 'Video file'
  return 'Link'
}

// Auto-fetch metadata from oEmbed APIs
// Resolve short TikTok URL to full canonical URL using allorigins proxy
async function resolveTikTokShortUrl(shortUrl) {
  try {
    // Use allorigins to follow the redirect server-side
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent('https://www.tiktok.com/oembed?url=' + shortUrl)}`
    const res = await fetch(proxyUrl)
    if (!res.ok) return null
    const outer = await res.json()
    const data = JSON.parse(outer.contents)
    // Extract video ID from embed_product_id or html
    let resolvedVideoUrl = null
    if (data.embed_product_id) {
      const author = data.author_url ? data.author_url.replace('https://www.tiktok.com/', '') : 'tiktok'
      resolvedVideoUrl = `https://www.tiktok.com/${author}/video/${data.embed_product_id}`
    } else if (data.html) {
      const vidMatch = data.html.match(/data-video-id=\\"(\d+)\\"/) || data.html.match(/data-video-id="(\d+)"/)
      if (vidMatch) {
        const authorMatch = data.author_url ? data.author_url.match(/tiktok\.com\/@([^/?]+)/) : null
        const author = authorMatch ? authorMatch[1] : 'tiktok'
        resolvedVideoUrl = `https://www.tiktok.com/@${author}/video/${vidMatch[1]}`
      }
    }
    return {
      title: data.title || data.author_name || '',
      thumbnail: data.thumbnail_url || '',
      caption: data.title || '',
      resolvedVideoUrl,
    }
  } catch { return null }
}

async function fetchOEmbed(url) {
  try {
    const platform = detectPlatform(url)
    
    // Short TikTok URL — resolve via proxy
    if (platform === 'TikTok_short') {
      return await resolveTikTokShortUrl(url)
    }

    let apiUrl = null
    if (platform === 'YouTube') {
      apiUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    } else if (platform === 'TikTok') {
      apiUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
    } else if (platform === 'X / Twitter') {
      apiUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`
    }

    if (!apiUrl) return null
    const res = await fetch(apiUrl)
    if (!res.ok) return null
    const data = await res.json()
    return {
      title: data.title || data.author_name || '',
      thumbnail: data.thumbnail_url || '',
      caption: data.title || '',
      resolvedVideoUrl: null,
    }
  } catch { return null }
}

// ─── Single post editor ───────────────────────────────────────────────────────
function PostEditor({ post, onSave, onDelete, isNew }) {
  const [p, setP] = useState(post)
  const [open, setOpen] = useState(isNew)
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [msg, setMsg] = useState('')

  const set = (k, v) => setP(prev => ({ ...prev, [k]: v }))

  const handleUrlChange = async (url) => {
    set('videoUrl', url)
  }

  const autoFetch = async () => {
    if (!p.videoUrl?.trim()) return
    setFetching(true)
    const meta = await fetchOEmbed(p.videoUrl)
    if (meta) {
      setP(prev => ({
        ...prev,
        title: prev.title || meta.title,
        thumbnail: prev.thumbnail || meta.thumbnail,
        oembedTitle: meta.title,
        oembedCaption: meta.caption,
        videoUrl: meta.resolvedVideoUrl || prev.videoUrl,
      }))
      setMsg('ok: Metadata fetched!')
      setTimeout(() => setMsg(''), 3000)
    } else {
      setMsg('err: Could not fetch metadata (paste title manually)')
      setTimeout(() => setMsg(''), 3000)
    }
    setFetching(false)
  }

  const save = async () => {
    if (!p.title?.trim()) { setMsg('err: Title required'); return }
    setSaving(true); setMsg('')
    try {
      const final = { ...p, updatedAt: Date.now() }
      await publishPost(final)
      const all = getPosts()
      const idx = all.findIndex(x => x.id === final.id)
      if (idx >= 0) all[idx] = final; else all.push(final)
      savePosts(all)
      onSave(final)
      setMsg('ok: Published!')
      setTimeout(() => setMsg(''), 3000)
    } catch(e) { setMsg('err: ' + (e.message || 'Failed')) }
    setSaving(false)
  }

  const del = async () => {
    if (!confirm(`Delete "${p.title}"?`)) return
    setSaving(true)
    try {
      await publishDelete(p.id)
      const all = getPosts().filter(x => x.id !== p.id)
      savePosts(all)
      onDelete(p.id)
    } catch(e) { setMsg('err: ' + (e.message || 'Failed')) }
    setSaving(false)
  }

  const platform = detectPlatform(p.videoUrl)

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer' }} onClick={() => setOpen(x => !x)}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{p.title || 'Untitled post'}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {p.category && <span style={{ color: C.accent, marginRight: 8 }}>{p.category}</span>}
            {platform && <span>{platform}</span>}
          </div>
        </div>
        {open ? <ChevronUp size={15} color={C.muted} /> : <ChevronDown size={15} color={C.muted} />}
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 16 }}>

          {/* Video URL + Auto-fetch */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Video / Post URL</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input value={p.videoUrl || ''} onChange={e => handleUrlChange(e.target.value)}
                  placeholder="YouTube, TikTok, Instagram, X link..."
                  style={{ width: '100%', boxSizing: 'border-box', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
              </div>
              <button onClick={autoFetch} disabled={fetching || !p.videoUrl?.trim()} title="Auto-fetch title & thumbnail"
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '10px 12px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                <RefreshCw size={13} style={{ animation: fetching ? 'spin 1s linear infinite' : 'none' }} />
                {fetching ? '…' : 'Fetch'}
              </button>
            </div>
            {platform && platform !== 'TikTok_short' && <div style={{ fontSize: 11, color: C.green, marginTop: 4 }}>✓ {platform} detected — click Fetch to auto-fill title & thumbnail</div>}
            {platform === 'TikTok_short' && (
              <div style={{ fontSize: 11, color: C.green, marginTop: 4, lineHeight: 1.6 }}>
                ✓ TikTok short URL detected — click Fetch to resolve and embed the video
              </div>
            )}
          </div>

          {/* Title */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Title *</label>
            <input value={p.title || ''} onChange={e => set('title', e.target.value)} placeholder="e.g. Bitcoin Basics — Week 1"
              style={{ width: '100%', boxSizing: 'border-box', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', color: C.text, fontSize: 14, outline: 'none' }} />
          </div>

          {/* Author + Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Author</label>
              <input value={p.author || ''} onChange={e => set('author', e.target.value)} placeholder="e.g. Martin"
                style={{ width: '100%', boxSizing: 'border-box', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Category</label>
              <input value={p.category || ''} onChange={e => set('category', e.target.value)} placeholder="e.g. Education"
                style={{ width: '100%', boxSizing: 'border-box', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Caption / Description</label>
            <textarea value={p.description || ''} onChange={e => set('description', e.target.value)} placeholder="Write a caption or description..."
              rows={3} style={{ width: '100%', boxSizing: 'border-box', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          {/* Thumbnail */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              Thumbnail {p.thumbnail ? '✓' : '(auto-filled or upload)'}
            </label>
            {p.thumbnail && (
              <img src={p.thumbnail} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 9, marginBottom: 8, display: 'block' }} onError={e => e.target.style.display = 'none'} />
            )}
            <ImageUpload currentUrl={p.thumbnail} onUploaded={url => set('thumbnail', url)} size={56} />
          </div>

          {msg && <div style={{ fontSize: 12, color: msg.startsWith('ok') ? C.green : C.red, marginBottom: 10 }}>{msg.replace(/^(ok|err): /, '')}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={save} disabled={saving} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: C.accent, border: 'none', color: '#000', padding: '11px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {saving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
              {saving ? 'Publishing…' : 'Save & Publish'}
            </button>
            <button onClick={del} disabled={saving} style={{ flex: 1, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: C.red, padding: '11px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main AdminBlog ───────────────────────────────────────────────────────────
export default function AdminBlog() {
  const [posts, setPosts] = useState(getPosts)

  const addPost = () => {
    const newPost = { id: Date.now().toString(), title: '', author: '', category: '', description: '', videoUrl: '', thumbnail: '', createdAt: Date.now() }
    setPosts(prev => [newPost, ...prev])
  }

  const onSave = (updated) => {
    setPosts(prev => {
      const idx = prev.findIndex(p => p.id === updated.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next }
      return [updated, ...prev]
    })
  }

  const onDelete = (id) => setPosts(prev => prev.filter(p => p.id !== id))

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <button onClick={addPost} style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.accent, border: 'none', color: '#000', padding: '11px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          <Plus size={15} /> New Blog Post
        </button>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
          Paste a URL then click Fetch to auto-fill title + thumbnail. Supports YouTube, TikTok, X and Instagram.
        </div>
      </div>

      {posts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 13 }}>No posts yet. Click "New Blog Post" to get started.</div>
      )}

      {posts.map(post => <PostEditor key={post.id} post={post} onSave={onSave} onDelete={onDelete} isNew={!post.title} />)}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

