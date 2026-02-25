import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { getPool, nsecToBytes } from '../lib/nostr'
import { finalizeEvent } from 'nostr-tools/pure'
import { nip19 } from 'nostr-tools'
import { Award, Download, CheckCircle, Lock, Loader, Key } from 'lucide-react'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const CERT_TAG = 'bitsavers-certificates'
const CLAIMS_TAG = 'bitsavers-cert-claims'

const C = {
  bg: '#080808', card: '#141414', surface: '#0f0f0f',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

function toHex(npub) {
  try {
    if (npub.startsWith('npub1')) return nip19.decode(npub).data
    return npub
  } catch { return npub }
}

async function generateCertificate({ name, nip05, cohort, course, issuedBy, credentialId, issuedDate, avatarUrl, npub }) {
  const QRCode = await import('qrcode')
  const qrData = `https://biteduhub.com/verify?id=${credentialId}&npub=${encodeURIComponent(npub || '')}&cohort=${encodeURIComponent(cohort)}&course=${encodeURIComponent(course)}&issued=${encodeURIComponent(issuedDate)}&name=${encodeURIComponent(name)}`
  const qrDataUrl = await QRCode.default.toDataURL(qrData, {
    width: 160, margin: 1, errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#ffffff' }
  })
  const qrImg = new Image()
  qrImg.src = qrDataUrl
  await new Promise(r => { qrImg.onload = r })

  let avatarImg = null
  if (avatarUrl) {
    try {
      avatarImg = new Image()
      avatarImg.crossOrigin = 'anonymous'
      avatarImg.src = avatarUrl
      await new Promise((res, rej) => { avatarImg.onload = res; avatarImg.onerror = rej; setTimeout(rej, 4000) })
    } catch { avatarImg = null }
  }

  const S = 2, W = 600 * S, H = 460 * S, px = v => v * S
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  const bgGrad = ctx.createLinearGradient(0, 0, W, H)
  bgGrad.addColorStop(0, '#141414'); bgGrad.addColorStop(1, '#0a0a0a')
  ctx.fillStyle = bgGrad
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, px(20)); ctx.fill()

  ctx.strokeStyle = 'rgba(247,147,26,0.4)'; ctx.lineWidth = px(2)
  ctx.beginPath(); ctx.roundRect(px(1), px(1), W - px(2), H - px(2), px(20)); ctx.stroke()

  ctx.strokeStyle = 'rgba(247,147,26,0.1)'; ctx.lineWidth = px(1)
  ctx.beginPath(); ctx.roundRect(px(12), px(12), W - px(24), H - px(24), px(14)); ctx.stroke()

  ctx.fillStyle = 'rgba(247,147,26,0.05)'
  ctx.font = `bold ${px(220)}px Arial`
  ctx.textAlign = 'right'
  ctx.fillText('₿', W - px(10), px(180))
  ctx.textAlign = 'left'

  const topGrad = ctx.createLinearGradient(0, 0, W, px(100))
  topGrad.addColorStop(0, 'rgba(247,147,26,0.2)')
  topGrad.addColorStop(1, 'rgba(247,147,26,0.02)')
  ctx.fillStyle = topGrad
  ctx.beginPath(); ctx.roundRect(0, 0, W, px(100), [px(20), px(20), 0, 0]); ctx.fill()

  ctx.fillStyle = '#F7931A'; ctx.font = `${px(9)}px monospace`
  ctx.letterSpacing = `${px(3)}px`
  ctx.fillText(`${issuedBy.toUpperCase()}  ·  OFFICIAL CERTIFICATE`, px(28), px(32))
  ctx.letterSpacing = '0px'

  const divGrad = ctx.createLinearGradient(px(28), 0, W - px(28), 0)
  divGrad.addColorStop(0, 'transparent'); divGrad.addColorStop(0.3, 'rgba(247,147,26,0.5)')
  divGrad.addColorStop(0.7, 'rgba(247,147,26,0.5)'); divGrad.addColorStop(1, 'transparent')
  ctx.strokeStyle = divGrad; ctx.lineWidth = px(1)
  ctx.beginPath(); ctx.moveTo(px(28), px(44)); ctx.lineTo(W - px(28), px(44)); ctx.stroke()

  ctx.fillStyle = 'rgba(247,147,26,0.65)'; ctx.font = `${px(11)}px monospace`
  ctx.letterSpacing = `${px(2.5)}px`
  ctx.fillText('CERTIFICATE OF COMPLETION', px(28), px(72))
  ctx.letterSpacing = '0px'

  ctx.fillStyle = '#ffffff'; ctx.font = `800 ${px(24)}px Arial`
  const maxW = W - px(56)
  const words = course.split(' '); let line = ''; let titleY = px(118)
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, px(28), titleY); titleY += px(32); line = w
    } else line = test
  }
  ctx.fillText(line, px(28), titleY)

  ctx.fillStyle = '#555'; ctx.font = `${px(11)}px Arial`
  ctx.fillText('This certifies that', px(28), px(155))

  const avR = px(30), avX = px(28) + avR, avY = px(196)
  ctx.save()
  ctx.beginPath(); ctx.arc(avX, avY, avR, 0, Math.PI * 2); ctx.clip()
  if (avatarImg) {
    ctx.drawImage(avatarImg, avX - avR, avY - avR, avR * 2, avR * 2)
  } else {
    const avGrad = ctx.createRadialGradient(avX - avR * 0.3, avY - avR * 0.3, 0, avX, avY, avR)
    avGrad.addColorStop(0, '#f7a030'); avGrad.addColorStop(1, '#b8690f')
    ctx.fillStyle = avGrad; ctx.fill()
    ctx.fillStyle = '#000'; ctx.font = `bold ${px(20)}px Arial`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText((name || '?').slice(0, 2).toUpperCase(), avX, avY)
  }
  ctx.restore()
  ctx.strokeStyle = 'rgba(247,147,26,0.7)'; ctx.lineWidth = px(3)
  ctx.beginPath(); ctx.arc(avX, avY, avR + 2, 0, Math.PI * 2); ctx.stroke()
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'

  const nameX = px(28 + 60 + 16)
  ctx.fillStyle = '#ffffff'; ctx.font = `800 ${px(18)}px Arial`
  ctx.fillText(name.slice(0, 26), nameX, px(186))
  if (nip05) {
    ctx.fillStyle = '#F7931A'; ctx.font = `${px(11)}px monospace`
    ctx.fillText('✓ ' + nip05, nameX, px(204))
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = px(1)
  ctx.beginPath(); ctx.moveTo(px(28), px(232)); ctx.lineTo(W - px(28), px(232)); ctx.stroke()

  const cols = [['ISSUED', issuedDate], ['COHORT', cohort], ['CREDENTIAL ID', credentialId]]
  let colX = px(28), infoY = px(252)
  cols.forEach(([label, value]) => {
    ctx.fillStyle = 'rgba(247,147,26,0.65)'; ctx.font = `${px(10)}px monospace`
    ctx.letterSpacing = `${px(1.5)}px`; ctx.fillText(label, colX, infoY); ctx.letterSpacing = '0px'
    ctx.fillStyle = '#cccccc'; ctx.font = `700 ${px(13)}px Arial`
    ctx.fillText(value, colX, infoY + px(18))
    infoY += px(44)
  })

  const qrSize = px(120), qrX = W - px(28) - qrSize, qrY = H - px(52) - px(16) - qrSize
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); ctx.roundRect(qrX - px(5), qrY - px(5), qrSize + px(10), qrSize + px(10), px(10)); ctx.fill()
  ctx.strokeStyle = 'rgba(247,147,26,0.3)'; ctx.lineWidth = px(1.5)
  ctx.beginPath(); ctx.roundRect(qrX - px(5), qrY - px(5), qrSize + px(10), qrSize + px(10), px(10)); ctx.stroke()
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

  ctx.fillStyle = 'rgba(247,147,26,0.5)'; ctx.font = `${px(9)}px monospace`
  ctx.letterSpacing = `${px(1)}px`
  ctx.textAlign = 'center'
  ctx.fillText('SCAN TO VERIFY', qrX + qrSize / 2, qrY - px(12))
  ctx.letterSpacing = '0px'; ctx.textAlign = 'left'

  const barY = H - px(52), barX = px(18), barW = W - px(36), barH = px(38)
  ctx.fillStyle = 'rgba(247,147,26,0.07)'
  ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, px(10)); ctx.fill()
  ctx.strokeStyle = 'rgba(247,147,26,0.22)'; ctx.lineWidth = px(1)
  ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, px(10)); ctx.stroke()
  ctx.fillStyle = '#22c55e'
  ctx.beginPath(); ctx.arc(barX + px(16), barY + barH / 2, px(5), 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#F7931A'; ctx.font = `700 ${px(11)}px Arial`
  ctx.fillText('VERIFIED  ·  Signed on Nostr  ·  Tamper-proof & permanently on-chain', barX + px(30), barY + barH / 2 + px(4))

  return canvas.toDataURL('image/png')
}

// ── Live WebSocket subscription — same pattern as CohortsPage ─────────────────
function useLiveCerts() {
  const [certs, setCerts] = useState([])
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)

  const certsRef = useRef({ created_at: 0, data: null })
  const claimsRef = useRef({ created_at: 0, data: null })
  const seenRef = useRef(new Set())
  const eoseCountRef = useRef(0)
  const totalRelays = RELAYS.length

  useEffect(() => {
    const closers = []

    const flush = (live = false) => {
      if (certsRef.current.data) setCerts(certsRef.current.data.filter(c => c.unlocked))
      if (claimsRef.current.data) setClaims(claimsRef.current.data)
      if (live || eoseCountRef.current >= totalRelays) setLoading(false)
    }

    const processEvent = (e) => {
      if (seenRef.current.has(e.id)) return
      seenRef.current.add(e.id)

      if (e.content.startsWith('CERT_REGISTRY:') && e.created_at > certsRef.current.created_at) {
        try {
          certsRef.current = { created_at: e.created_at, data: JSON.parse(e.content.slice('CERT_REGISTRY:'.length)) }
        } catch {}
      }
      if (e.content.startsWith('CERT_CLAIMS:') && e.created_at > claimsRef.current.created_at) {
        try {
          claimsRef.current = { created_at: e.created_at, data: JSON.parse(e.content.slice('CERT_CLAIMS:'.length)) }
        } catch {}
      }
    }

    const openWS = (relayUrl) => {
      let ws, closed = false
      const subId = 'cert-' + Math.random().toString(36).slice(2, 8)

      const connect = () => {
        if (closed) return
        try {
          ws = new WebSocket(relayUrl)
          ws.onopen = () => {
            if (!closed) ws.send(JSON.stringify(['REQ', subId, { kinds: [1], '#t': [CERT_TAG, CLAIMS_TAG], limit: 20 }]))
          }
          ws.onmessage = ({ data }) => {
            if (closed) return
            let msg; try { msg = JSON.parse(data) } catch { return }
            const [type, id, payload] = msg
            if (type === 'EVENT' && id === subId) {
              processEvent(payload)
              flush(true) // live event — update immediately
            }
            if (type === 'EOSE' && id === subId) {
              eoseCountRef.current++
              flush()
            }
          }
          ws.onerror = () => {}
          ws.onclose = () => { if (!closed) setTimeout(connect, 3000) } // auto-reconnect
        } catch {}
      }

      connect()
      return () => { closed = true; try { ws?.close() } catch {} }
    }

    RELAYS.forEach(relay => closers.push(openWS(relay)))
    return () => closers.forEach(c => c())
  }, [])

  return { certs, claims, setClaims, loading }
}

export default function CertificatesPage() {
  const { user } = useAuth()
  const { certs, claims, setClaims, loading } = useLiveCerts()
  const [claimCode, setClaimCode] = useState('')
  const [claiming, setClaiming] = useState(null)
  const [msg, setMsg] = useState('')
  const [generating, setGenerating] = useState(null)

  const myNpub = user?.npub || ''
  const myHex = user?.pubkey || ''
  const myProfile = user?.profile || {}
  const myName = myProfile.name || myProfile.display_name || myNpub.slice(0, 12) + '…'

  const isClaimed = (certId) => claims.some(c => c.certId === certId && c.npub === myNpub)
  const isEligible = (cert) => {
    const npubs = cert.npubs.split('\n').map(n => n.trim()).filter(Boolean)
    return npubs.some(n => toHex(n) === myHex || n === myNpub)
  }

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const claim = async (cert) => {
    if (!claimCode.trim()) { showMsg('err: Enter the claim code'); return }
    if (claimCode.trim().toUpperCase() !== cert.claimCode.toUpperCase()) { showMsg('err: Invalid claim code'); return }
    if (!isEligible(cert)) { showMsg('err: Your npub is not on the eligible list for this certificate'); return }

    setClaiming(cert.id)
    const newClaim = { certId: cert.id, npub: myNpub, claimedAt: Math.floor(Date.now() / 1000) }
    const updated = [...claims.filter(c => !(c.certId === cert.id && c.npub === myNpub)), newClaim]
    try {
      const nsec = localStorage.getItem('bitsavers_nsec')
      const skBytes = nsecToBytes(nsec)
      const pool = getPool()
      const ev = finalizeEvent({
        kind: 1, created_at: Math.floor(Date.now() / 1000),
        tags: [['t', CLAIMS_TAG]],
        content: 'CERT_CLAIMS:' + JSON.stringify(updated),
      }, skBytes)
      await Promise.any(pool.publish(RELAYS, ev))
      setClaims(updated)
      setClaimCode('')
      showMsg('✓ Certificate claimed! You can now download it.')
    } catch { showMsg('err: Failed to claim. Try again.') }
    setClaiming(null)
  }

  const download = async (cert) => {
    setGenerating(cert.id)
    try {
      const dataUrl = await generateCertificate({
        name: myName,
        nip05: myProfile.nip05 || '',
        cohort: cert.cohort,
        course: cert.course,
        issuedBy: cert.issuedBy || 'BitSavers EduHub',
        credentialId: cert.credentialIds?.[myNpub] || `bsv-${cert.id.slice(-8)}`,
        issuedDate: new Date().toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }),
        avatarUrl: myProfile.picture || '',
        npub: myNpub,
      })
      const a = document.createElement('a')
      a.download = `bitsavers-certificate-${cert.cohort.replace(/\s+/g, '-').toLowerCase()}.png`
      a.href = dataUrl; a.click()
    } catch { showMsg('err: Failed to generate certificate') }
    setGenerating(null)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '50px 0', color: C.muted }}>
      <Loader size={18} style={{ animation: 'spin 1s linear infinite', color: C.accent, display: 'block', margin: '0 auto 10px' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>Certificates</div>
        <div style={{ fontSize: 13, color: C.muted }}>Enter your claim code to unlock and download your certificate</div>
      </div>

      {msg && (
        <div style={{ background: msg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.startsWith('✓') ? C.green : C.red}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: msg.startsWith('✓') ? C.green : C.red }}>
          {msg}
        </div>
      )}

      {certs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Lock size={36} style={{ display: 'block', margin: '0 auto 14px', color: C.muted, opacity: 0.3 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>No certificates available yet</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Check back after your cohort session</div>
        </div>
      )}

      {certs.map(cert => {
        const claimed = isClaimed(cert.id)
        const eligible = isEligible(cert)
        return (
          <div key={cert.id} style={{ background: C.card, border: `1px solid ${claimed ? 'rgba(34,197,94,0.3)' : C.border}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: C.dim, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Award size={22} color={C.accent} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 2 }}>{cert.course}</div>
                <div style={{ fontSize: 12, color: C.accent }}>{cert.cohort}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Issued by {cert.issuedBy}</div>
              </div>
              {claimed && (
                <span style={{ fontSize: 10, fontWeight: 800, background: 'rgba(34,197,94,0.12)', color: C.green, padding: '3px 10px', borderRadius: 20, flexShrink: 0 }}>
                  CLAIMED ✓
                </span>
              )}
            </div>

            {!claimed ? (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    value={claimCode}
                    onChange={e => setClaimCode(e.target.value.toUpperCase())}
                    placeholder="Enter claim code e.g. BSV-XXXX-XXXX"
                    style={{ flex: 1, background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '11px 13px', color: C.accent, fontSize: 13, outline: 'none', fontFamily: 'monospace', letterSpacing: 1 }}
                  />
                  <button onClick={() => claim(cert)} disabled={claiming === cert.id}
                    style={{ background: C.accent, border: 'none', color: '#000', padding: '0 18px', borderRadius: 9, cursor: 'pointer', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {claiming === cert.id ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <><Key size={13} /> Claim</>}
                  </button>
                </div>
                {!eligible && (
                  <div style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Lock size={10} /> Your npub is not on the eligible list for this certificate
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => download(cert)} disabled={generating === cert.id}
                style={{ width: '100%', background: C.accent, border: 'none', color: '#000', padding: '13px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {generating === cert.id
                  ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
                  : <><Download size={15} /> Download Certificate</>}
              </button>
            )}
          </div>
        )
      })}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

