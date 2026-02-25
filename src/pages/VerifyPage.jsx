import { useState, useEffect, useRef } from 'react'
import { CheckCircle, XCircle, Award, User, BookOpen, Calendar, Hash, ExternalLink } from 'lucide-react'
import { getPool } from '../lib/nostr'
import { SimplePool } from 'nostr-tools/pool'
import { nip19 } from 'nostr-tools'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const CERT_TAG = 'bitsavers-certificates'
const CLAIMS_TAG = 'bitsavers-cert-claims'

const C = {
  bg: '#080808', card: '#141414',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.08)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

export default function VerifyPage() {
  const [params, setParams] = useState({})
  const [status, setStatus] = useState('loading') // loading | verified | invalid
  const [profile, setProfile] = useState(null)
  const resolved = useRef(false)

  useEffect(() => {
    // Parse URL params
    const p = new URLSearchParams(window.location.search)
    const data = {
      id: p.get('id') || '',
      npub: p.get('npub') || '',
      cohort: p.get('cohort') || '',
      course: p.get('course') || '',
      issued: p.get('issued') || '',
      name: p.get('name') || '',
    }
    setParams(data)
    if (!data.id || !data.npub) { setStatus('invalid'); return }

    // Verify against Nostr — check cert exists + claim exists
    const pool = new SimplePool()
    let certs = null, claims = null
    let latestC = { created_at: 0 }, latestCl = { created_at: 0 }

    const sub = pool.subscribe(RELAYS, { kinds: [1], '#t': [CERT_TAG, CLAIMS_TAG], limit: 20 }, {
      onevent(e) {
        if (e.content.startsWith('CERT_REGISTRY:') && e.created_at > latestC.created_at) {
          try { latestC = { created_at: e.created_at, data: JSON.parse(e.content.slice('CERT_REGISTRY:'.length)) } } catch {}
        }
        if (e.content.startsWith('CERT_CLAIMS:') && e.created_at > latestCl.created_at) {
          try { latestCl = { created_at: e.created_at, data: JSON.parse(e.content.slice('CERT_CLAIMS:'.length)) } } catch {}
        }
      },
      oneose() {
        certs = latestC.data || []
        claims = latestCl.data || []
        const certMatch = certs.find(c => `bsv-${c.id.slice(-8)}` === data.id)
        const claimMatch = claims.find(cl => cl.npub === data.npub && certMatch && cl.certId === certMatch.id)
        resolved.current = true
        setStatus(certMatch && claimMatch ? 'verified' : 'invalid')
        sub.close()
      }
    })

    // Fetch Nostr profile
    try {
      const hex = nip19.decode(data.npub).data
      const psub = pool.subscribe(RELAYS, { kinds: [0], authors: [hex], limit: 1 }, {
        onevent(e) { try { setProfile(JSON.parse(e.content)) } catch {} },
        oneose() { psub.close() }
      })
    } catch {}

    setTimeout(() => { if (!resolved.current) { sub.close(); setStatus('invalid') } }, 10000)
    return () => sub.close()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Arial, sans-serif' }}>
      
      {/* Logo */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.accent }}>₿</div>
        <div style={{ fontSize: 13, color: C.muted, letterSpacing: 3, textTransform: 'uppercase', marginTop: 4 }}>BitSavers EduHub</div>
      </div>

      <div style={{ width: '100%', maxWidth: 480, background: C.card, border: `1px solid ${status === 'verified' ? 'rgba(34,197,94,0.4)' : status === 'invalid' ? 'rgba(239,68,68,0.3)' : C.border}`, borderRadius: 20, overflow: 'hidden' }}>
        
        {/* Status banner */}
        <div style={{ padding: '20px 24px', background: status === 'verified' ? 'rgba(34,197,94,0.08)' : status === 'invalid' ? 'rgba(239,68,68,0.08)' : C.dim, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          {status === 'loading' && (
            <>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid ${C.accent}`, borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Verifying Certificate…</div>
                <div style={{ fontSize: 12, color: C.muted }}>Checking Nostr relays</div>
              </div>
            </>
          )}
          {status === 'verified' && (
            <>
              <CheckCircle size={28} color='#22c55e' />
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#22c55e' }}>Certificate Verified ✓</div>
                <div style={{ fontSize: 12, color: C.muted }}>This certificate is authentic and tamper-proof</div>
              </div>
            </>
          )}
          {status === 'invalid' && (
            <>
              <XCircle size={28} color={C.red} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.red }}>Could Not Verify</div>
                <div style={{ fontSize: 12, color: C.muted }}>This certificate was not found on Nostr</div>
              </div>
            </>
          )}
        </div>

        {/* Certificate details */}
        <div style={{ padding: 24 }}>
          {/* Avatar + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.accent}`, flexShrink: 0, background: C.dim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {profile?.picture
                ? <img src={profile.picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 20, fontWeight: 800, color: C.accent }}>{(params.name || '?').slice(0, 2).toUpperCase()}</span>
              }
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{profile?.name || profile?.display_name || params.name}</div>
              {profile?.nip05 && <div style={{ fontSize: 12, color: C.accent, marginTop: 2 }}>✓ {profile.nip05}</div>}
              {params.npub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontFamily: 'monospace' }}>{params.npub.slice(0, 16)}…</div>}
            </div>
          </div>

          {/* Info rows */}
          {[
            [<Award size={14} />, 'Certificate', 'Certificate of Completion'],
            [<BookOpen size={14} />, 'Course', params.course],
            [<User size={14} />, 'Cohort', params.cohort],
            [<Calendar size={14} />, 'Issued', params.issued],
            [<Hash size={14} />, 'Credential ID', params.id],
          ].map(([icon, label, value]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
              <div style={{ color: C.accent, flexShrink: 0 }}>{icon}</div>
              <div style={{ fontSize: 11, color: C.muted, width: 90, flexShrink: 0, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{value}</div>
            </div>
          ))}

          {/* Nostr link */}
          {params.npub && (
            <a href={`https://njump.me/${params.npub}`} target="_blank" rel="noopener noreferrer"
              style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '12px', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
              <ExternalLink size={14} /> View Nostr Profile
            </a>
          )}
        </div>
      </div>

      <div style={{ marginTop: 20, fontSize: 11, color: C.muted, textAlign: 'center', letterSpacing: 1 }}>
        POWERED BY NOSTR · BITEDUHUB.COM
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

