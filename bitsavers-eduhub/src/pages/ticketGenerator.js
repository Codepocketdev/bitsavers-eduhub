// Ticket generator — Design C Glass Premium
// Fixed: canvas height is now calculated dynamically so bottom curves never get clipped

async function drawAvatar(ctx, profile, cx, cy, r) {
  if (profile?.picture) {
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = profile.picture
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; setTimeout(rej, 3000) })
      ctx.save()
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip()
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2)
      ctx.restore()
      ctx.strokeStyle = 'rgba(247,147,26,0.5)'; ctx.lineWidth = 4
      ctx.beginPath(); ctx.arc(cx, cy, r + 1, 0, Math.PI * 2); ctx.stroke()
      return
    } catch {}
  }
  // Gradient initials fallback
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r)
  grad.addColorStop(0, '#f7a030'); grad.addColorStop(1, '#b8690f')
  ctx.fillStyle = grad
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(247,147,26,0.5)'; ctx.lineWidth = 4
  ctx.beginPath(); ctx.arc(cx, cy, r + 1, 0, Math.PI * 2); ctx.stroke()
  const initials = (profile?.name || profile?.display_name || '?').slice(0, 2).toUpperCase()
  ctx.fillStyle = '#000'
  ctx.font = `bold ${Math.round(r * 0.9)}px Arial`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(initials, cx, cy + 1)
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
}

export async function generateTicket({ event, profile, npub, ticketId }) {
  // ── QR Code ──
  const QRCode = await import('qrcode')
  const ticketData = `bitsavers-ticket:${event.id}:${npub}:${ticketId}`
  const qrDataUrl = await QRCode.default.toDataURL(ticketData, {
    width: 240, margin: 1, errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#ffffff' }
  })
  const qrImg = new Image()
  qrImg.src = qrDataUrl
  await new Promise(r => { qrImg.onload = r })

  const S = 2           // 2x retina scale
  const W = 340 * S     // 680px canvas width
  const px = (v) => v * S

  // ── Pre-calculate all section heights so canvas is sized correctly ──
  const hPad = px(22)

  // Header height: top padding + brand + gap + title (1 or 2 lines) + gap + loc row + bottom padding
  const titleText = event.title || 'BitSavers Event'
  const titleLineH = px(30)
  // Estimate title lines (rough: ~18 chars per line at 26px bold on 296px wide)
  const charsPerLine = Math.floor((W - hPad * 2) / px(14.5))
  const titleLines = Math.ceil(titleText.length / charsPerLine)
  const headerH =
    px(22)                          // top padding
    + px(10) + px(10)              // brand text + margin
    + titleLines * titleLineH       // title (may wrap)
    + px(8)                         // gap after title
    + px(9 + 2 + 13)               // loc labels + values
    + px(18)                        // bottom padding

  const midH = px(16 + 44 + 16)   // top pad + avatar + bottom pad

  const qrBoxSize = px(160)
  const qrSecH = px(18) + qrBoxSize + px(20)  // top pad + qr box + bottom pad

  const statusH = px(38)
  const statusSecH = statusH + px(20)          // status bar + bottom margin

  // ── TOTAL HEIGHT — this is the key fix ──
  const TOTAL_H = headerH + midH + qrSecH + statusSecH + px(8) // +8 extra breathing room for border-radius

  // ── Create canvas at exact needed size ──
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = TOTAL_H
  const ctx = canvas.getContext('2d')

  // ── Background with proper rounded rect ──
  const bgGrad = ctx.createLinearGradient(0, 0, W, TOTAL_H)
  bgGrad.addColorStop(0, '#141414'); bgGrad.addColorStop(1, '#0a0a0a')
  ctx.fillStyle = bgGrad
  ctx.beginPath(); ctx.roundRect(0, 0, W, TOTAL_H, px(24)); ctx.fill()

  // Card border
  ctx.strokeStyle = 'rgba(247,147,26,0.25)'; ctx.lineWidth = px(1)
  ctx.beginPath(); ctx.roundRect(px(0.5), px(0.5), W - px(1), TOTAL_H - px(1), px(24)); ctx.stroke()

  // ₿ watermark
  ctx.fillStyle = 'rgba(247,147,26,0.04)'
  ctx.font = `bold ${px(160)}px Arial`
  ctx.textAlign = 'right'
  ctx.fillText('₿', W + px(20), -px(20) + px(160))
  ctx.textAlign = 'left'

  // ──────────────────────────────────────────
  // HEADER
  // ──────────────────────────────────────────
  const headerGrad = ctx.createLinearGradient(0, 0, W, headerH)
  headerGrad.addColorStop(0, 'rgba(247,147,26,0.15)')
  headerGrad.addColorStop(1, 'rgba(247,147,26,0.03)')
  ctx.fillStyle = headerGrad
  ctx.beginPath(); ctx.roundRect(0, 0, W, headerH, [px(24), px(24), 0, 0]); ctx.fill()

  // Header bottom border
  ctx.strokeStyle = 'rgba(247,147,26,0.1)'; ctx.lineWidth = px(1)
  ctx.beginPath(); ctx.moveTo(0, headerH); ctx.lineTo(W, headerH); ctx.stroke()

  let y = px(22)

  // Brand
  ctx.fillStyle = '#F7931A'
  ctx.font = `${px(10)}px monospace`
  ctx.letterSpacing = `${px(3)}px`
  ctx.fillText('Bitsavers Eduhub · Official', hPad, y + px(10))
  ctx.letterSpacing = '0px'
  y += px(10 + 10)

  // Event title (word-wrapped)
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 ${px(26)}px Arial`
  const maxW = W - hPad * 2
  const words = titleText.split(' ')
  let line = ''
  let titleY = y + px(26)
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, hPad, titleY); titleY += titleLineH; line = w
    } else line = test
  }
  ctx.fillText(line, hPad, titleY)
  y = titleY + px(8)

  // loc-row: DATE / TIME / VENUE
  const locItems = [
    ['DATE', new Date(event.date).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })],
    ...(event.time ? [['TIME', event.time]] : []),
    ...(event.location ? [['VENUE', event.location.slice(0, 14) + (event.location.length > 14 ? '…' : '')]] : []),
  ]
  let locX = hPad
  locItems.forEach(([label, value], i) => {
    ctx.fillStyle = 'rgba(247,147,26,0.6)'
    ctx.font = `${px(9)}px monospace`
    ctx.letterSpacing = `${px(1.5)}px`
    ctx.fillText(label, locX, y + px(9))
    ctx.letterSpacing = '0px'
    ctx.fillStyle = '#cccccc'
    ctx.font = `700 ${px(13)}px Arial`
    ctx.fillText(value, locX, y + px(9 + 2 + 13))
    const valW = ctx.measureText(value).width
    locX += valW + px(14)
    if (i < locItems.length - 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.fillRect(locX, y, px(1), px(26))
      locX += px(14)
    }
  })

  // ──────────────────────────────────────────
  // MIDDLE — avatar + name
  // ──────────────────────────────────────────
  const midStartY = headerH
  y = midStartY + px(16)

  const avR = px(22)
  const avCx = hPad + avR
  const avCy = y + avR
  await drawAvatar(ctx, profile, avCx, avCy, avR)

  const nameX = hPad + px(44 + 14)
  const attendeeName = profile?.name || profile?.display_name || (npub ? npub.slice(0, 18) + '…' : 'Attendee')
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 ${px(16)}px Arial`
  ctx.fillText(attendeeName.slice(0, 24), nameX, y + px(16))

  if (profile?.nip05) {
    ctx.fillStyle = '#F7931A'
    ctx.font = `${px(11)}px monospace`
    ctx.fillText('✓ ' + profile.nip05, nameX, y + px(16 + 2 + 13))
  }

  // Middle bottom separator
  const midEndY = midStartY + midH
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = px(1)
  ctx.beginPath(); ctx.moveTo(0, midEndY); ctx.lineTo(W, midEndY); ctx.stroke()

  // ──────────────────────────────────────────
  // QR SECTION
  // ──────────────────────────────────────────
  const qrSecY = midEndY
  y = qrSecY + px(18)

  const qrPad = px(6)
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); ctx.roundRect(hPad, y, qrBoxSize, qrBoxSize, px(12)); ctx.fill()
  ctx.drawImage(qrImg, hPad + qrPad, y + qrPad, qrBoxSize - qrPad * 2, qrBoxSize - qrPad * 2)

  // QR info column
  const infoX = hPad + qrBoxSize + px(16)
  let infoY = y + px(4)

  ctx.fillStyle = '#444'
  ctx.font = `${px(9)}px Arial`
  ctx.letterSpacing = `${px(1.5)}px`
  ctx.fillText('TICKET ID', infoX, infoY)
  ctx.letterSpacing = '0px'
  infoY += px(16)

  ctx.fillStyle = '#F7931A'
  ctx.font = `${px(13)}px monospace`
  const tidChars = ticketId.match(/.{1,8}/g) || [ticketId]
  tidChars.forEach(chunk => { ctx.fillText(chunk, infoX, infoY); infoY += px(16) })
  infoY += px(10)

  ctx.fillStyle = '#444'
  ctx.font = `${px(9)}px Arial`
  ctx.letterSpacing = `${px(1.5)}px`
  ctx.fillText('NPUB', infoX, infoY)
  ctx.letterSpacing = '0px'
  infoY += px(14)

  const shortNpub = npub ? npub.slice(0, 10) + '…' + npub.slice(-4) : ''
  ctx.fillStyle = '#F7931A'
  ctx.font = `${px(11)}px monospace`
  ctx.fillText(shortNpub, infoX, infoY)
  infoY += px(18)

  ctx.fillStyle = '#555'
  ctx.font = `${px(10)}px Arial`
  ctx.fillText('Scan to verify', infoX, infoY)

  // ──────────────────────────────────────────
  // STATUS BAR — now guaranteed to fit inside the canvas
  // ──────────────────────────────────────────
  const statusY = qrSecY + qrSecH  // starts right after QR section
  const statusX = hPad
  const statusW = W - hPad * 2

  ctx.fillStyle = 'rgba(247,147,26,0.08)'
  ctx.beginPath(); ctx.roundRect(statusX, statusY, statusW, statusH, px(10)); ctx.fill()
  ctx.strokeStyle = 'rgba(247,147,26,0.2)'; ctx.lineWidth = px(1)
  ctx.beginPath(); ctx.roundRect(statusX, statusY, statusW, statusH, px(10)); ctx.stroke()

  // Yellow dot
  ctx.fillStyle = '#eab308'
  ctx.beginPath(); ctx.arc(statusX + px(14 + 4), statusY + statusH / 2, px(4), 0, Math.PI * 2); ctx.fill()

  // Status text
  ctx.fillStyle = '#F7931A'
  ctx.font = `700 ${px(11)}px Arial`
  ctx.fillText('PENDING · General Admission', statusX + px(14 + 4 + 10), statusY + statusH / 2 + px(4))

  // ── Download ──
  const link = document.createElement('a')
  link.download = `bitsavers-ticket-${ticketId.slice(0, 8)}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

export function generateTicketId(npub, eventId) {
  const str = npub + ':' + eventId
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const hash = (4294967296 * (2097151 & h2) + (h1 >>> 0))
  return Math.abs(hash).toString(36).padStart(10, '0')
}

