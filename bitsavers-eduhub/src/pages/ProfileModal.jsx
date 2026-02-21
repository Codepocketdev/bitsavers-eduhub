import { useState, useEffect } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import { nip19 } from 'nostr-tools'
import { X, MessageSquare, Zap, Copy, CheckCircle, ExternalLink } from 'lucide-react'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

const C = {
  card: '#141414', border: 'rgba(247,147,26,0.18)',
  accent: '#F7931A', dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e',
}

function QRCode({ value, size = 200 }) {
  return <img
    src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=141414&color=F7931A&margin=10`}
    alt="QR" style={{ width: size, height: size, borderRadius: 12, display: 'block', margin: '0 auto' }}
  />
}

export default function ProfileModal({ pubkey, onClose, onDM }) {
  const [profile, setProfile] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('profile')
  const [copied, setCopied] = useState(false)

  const npub = (() => { try { return nip19.npubEncode(pubkey) } catch { return '' } })()
  const shortNpub = npub ? `${npub.slice(0,12)}…${npub.slice(-6)}` : ''
  const name = profile.name || profile.display_name || shortNpub
  const lnAddress = profile.lud16 || null

  useEffect(() => {
    if (!pubkey) return
    const pool = new SimplePool()
    const sub = pool.subscribe(RELAYS, { kinds: [0], authors: [pubkey], limit: 1 }, {
      onevent(e) {
        try { setProfile(JSON.parse(e.content)); setLoading(false) } catch {}
      },
      oneose() { sub.close(); setLoading(false) }
    })
    const t = setTimeout(() => { try { sub.close() } catch {} setLoading(false) }, 6000)
    return () => { clearTimeout(t); try { sub.close() } catch {} }
  }, [pubkey])

  const copy = async () => {
    try { await navigator.clipboard.writeText(npub); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, background: C.card, borderRadius: '20px 20px 0 0', border: `1px solid ${C.border}`, padding: '24px 20px 40px', position: 'relative' }}>

        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.06)', border: 'none', color: C.muted, width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={16} />
        </button>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {['profile', 'qr'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px', borderRadius: 9, border: `1px solid ${tab === t ? C.accent : C.border}`, background: tab === t ? C.dim : 'transparent', color: tab === t ? C.accent : C.muted, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              {t === 'qr' ? 'QR Code' : 'Profile'}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#000', overflow: 'hidden', flexShrink: 0, border: `2px solid ${C.border}` }}>
                {profile.picture
                  ? <img src={profile.picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                  : name.slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 2 }}>{loading ? '…' : name}</div>
                {profile.nip05 && <div style={{ fontSize: 11, color: C.accent, display: 'flex', alignItems: 'center', gap: 3 }}><CheckCircle size={10} /> {profile.nip05}</div>}
                {lnAddress && <div style={{ fontSize: 11, color: C.green, marginTop: 2 }}>⚡ {lnAddress}</div>}
              </div>
            </div>

            {profile.about && (
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: 16, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                {profile.about}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, marginBottom: 20 }}>
              <div style={{ flex: 1, fontSize: 11, color: C.muted, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortNpub}</div>
              <button onClick={copy} style={{ background: 'none', border: 'none', color: copied ? C.green : C.muted, cursor: 'pointer', padding: 4, display: 'flex' }}>
                {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { onDM && onDM(pubkey, profile); onClose() }}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: C.dim, border: `1px solid ${C.border}`, color: C.text, padding: '13px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                <MessageSquare size={16} color={C.accent} /> DM
              </button>
              {lnAddress && (
                <a href={`lightning:${lnAddress}`} target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: C.dim, border: `1px solid ${C.border}`, color: C.text, padding: '13px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', textDecoration: 'none' }}>
                  <Zap size={16} color={C.accent} /> Zap
                </a>
              )}
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: C.dim, border: `1px solid ${C.border}`, color: C.text, padding: '13px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', textDecoration: 'none' }}>
                  <ExternalLink size={16} color={C.accent} /> Web
                </a>
              )}
            </div>
          </>
        )}

        {tab === 'qr' && npub && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Scan to find on Nostr</div>
            <QRCode value={npub} size={220} />
            <div style={{ marginTop: 14, fontSize: 11, color: C.muted, fontFamily: 'monospace', wordBreak: 'break-all', padding: '0 12px' }}>{npub}</div>
            <button onClick={copy} style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: C.dim, border: `1px solid ${C.border}`, color: copied ? C.green : C.accent, padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {copied ? <CheckCircle size={14} /> : <Copy size={14} />} {copied ? 'Copied!' : 'Copy npub'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

