import { useState } from 'react'
import { Twitter, Instagram, Facebook, Github, Linkedin, Mail, Zap, Globe, Save, CheckCircle, Loader } from 'lucide-react'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const SOCIALS_TAG = 'bitsavers-socials'

const publishSocials = async (socials) => {
  const nsec = localStorage.getItem('bitsavers_nsec')
  if (!nsec) throw new Error('No private key')
  const skBytes = nsecToBytes(nsec)
  const pool = getPool()
  const event = finalizeEvent({
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['t', 'bitsavers'], ['t', SOCIALS_TAG]],
    content: 'SOCIALS:' + JSON.stringify(socials),
  }, skBytes)
  await Promise.any(pool.publish(RELAYS, event))
}

const C = {
  bg: '#080808', surface: '#0f0f0f', card: '#141414',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

const ICON_MAP = {
  twitter:   <Twitter size={16} />,
  instagram: <Instagram size={16} />,
  facebook:  <Facebook size={16} />,
  globe:     <Globe size={16} />,
  linkedin:  <Linkedin size={16} />,
  github:    <Github size={16} />,
  mail:      <Mail size={16} />,
  zap:       <Zap size={16} />,
}

const DEFAULT_SOCIALS = [
  { id: 'x',         label: 'X / Twitter', icon: 'twitter',   url: '', placeholder: 'https://x.com/bitsavers' },
  { id: 'instagram', label: 'Instagram',   icon: 'instagram', url: '', placeholder: 'https://instagram.com/bitsavers' },
  { id: 'facebook',  label: 'Facebook',    icon: 'facebook',  url: '', placeholder: 'https://facebook.com/bitsavers' },
  { id: 'tiktok',    label: 'TikTok',      icon: 'globe',     url: '', placeholder: 'https://tiktok.com/@bitsavers' },
  { id: 'linkedin',  label: 'LinkedIn',    icon: 'linkedin',  url: '', placeholder: 'https://linkedin.com/company/bitsavers' },
  { id: 'github',    label: 'GitHub',      icon: 'github',    url: '', placeholder: 'https://github.com/bitsavers' },
  { id: 'email',     label: 'Email',       icon: 'mail',      url: '', placeholder: 'mailto:hello@bitsavers.africa' },
  { id: 'nostr',     label: 'Nostr',       icon: 'zap',       url: '', placeholder: 'https://njump.me/npub1...' },
]

const getSocials = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('bitsavers_socials') || '[]')
    if (!stored.length) return DEFAULT_SOCIALS
    // Merge stored urls into defaults (so new platforms always appear)
    return DEFAULT_SOCIALS.map(d => {
      const found = stored.find(s => s.id === d.id)
      return found ? { ...d, url: found.url } : d
    })
  } catch { return DEFAULT_SOCIALS }
}

export default function AdminSocials() {
  const [socials, setSocials] = useState(getSocials)
  const [saved, setSaved] = useState(false)

  const update = (id, url) => setSocials(prev => prev.map(s => s.id === id ? { ...s, url } : s))

  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await publishSocials(socials)
      localStorage.setItem('bitsavers_socials', JSON.stringify(socials))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch(e) { console.error('Failed to publish socials:', e) }
    setSaving(false)
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>
        Add your social media links below. Leave blank to hide. These appear in the landing page footer and on the Donate page.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {socials.map(s => (
          <div key={s.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ color: C.accent }}>{ICON_MAP[s.icon]}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{s.label}</span>
              {s.url?.trim() && (
                <span style={{ marginLeft: 'auto', fontSize: 10, color: C.green, fontWeight: 600 }}>● LIVE</span>
              )}
            </div>
            <input
              value={s.url}
              onChange={e => update(s.id, e.target.value)}
              placeholder={s.placeholder}
              style={{ width: '100%', boxSizing: 'border-box', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
            />
          </div>
        ))}
      </div>

      {/* Save button */}
      <button onClick={save} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: saved ? 'rgba(34,197,94,0.15)' : C.accent, border: saved ? '1px solid rgba(34,197,94,0.3)' : 'none', color: saved ? C.green : C.bg, padding: '14px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
        {saving ? <><Loader size={16} style={{animation:'spin 1s linear infinite'}} /> Publishing…</> : saved ? <><CheckCircle size={16} /> Saved to Nostr!</> : <><Save size={16} /> Save & Publish to Nostr</>}
      </button>

      {/* Preview */}
      {socials.some(s => s.url?.trim()) && (
        <div style={{ marginTop: 20, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Preview</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {socials.filter(s => s.url?.trim()).map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: C.dim, border: `1px solid ${C.border}`, borderRadius: 20, color: C.accent, fontSize: 12, fontWeight: 600 }}>
                {ICON_MAP[s.icon]} {s.label}
              </div>
            ))}
          </div>
        </div>
      )}
    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

