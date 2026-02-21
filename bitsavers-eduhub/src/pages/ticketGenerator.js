// Ticket generator — creates a downloadable PNG ticket
// Uses canvas API + qrcode library

export async function generateTicket({ event, profile, npub, ticketId }) {
  // Generate QR code data URL using qrcode library
  const QRCode = await import('qrcode')
  const ticketData = `bitsavers-ticket:${event.id}:${npub}:${ticketId}`
  const qrDataUrl = await QRCode.default.toDataURL(ticketData, {
    width: 180, margin: 1,
    color: { dark: '#000000', light: '#ffffff' }
  })

  // Create canvas
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 420
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, 800, 420)

  // Orange left accent bar
  ctx.fillStyle = '#F7931A'
  ctx.fillRect(0, 0, 8, 420)

  // Bitcoin orange gradient header
  const grad = ctx.createLinearGradient(0, 0, 800, 0)
  grad.addColorStop(0, '#1a1a1a')
  grad.addColorStop(1, '#0a0a0a')
  ctx.fillStyle = grad
  ctx.fillRect(8, 0, 792, 100)

  // Header border bottom
  ctx.fillStyle = 'rgba(247,147,26,0.3)'
  ctx.fillRect(8, 99, 792, 1)

  // BitSavers logo text
  ctx.fillStyle = '#F7931A'
  ctx.font = 'bold 28px Arial'
  ctx.fillText('BITSAVERS EDUHUB', 30, 42)

  ctx.fillStyle = 'rgba(247,147,26,0.6)'
  ctx.font = '13px Arial'
  ctx.fillText('OFFICIAL EVENT TICKET', 32, 64)

  // Ticket ID top right
  ctx.fillStyle = '#444'
  ctx.font = '11px monospace'
  ctx.textAlign = 'right'
  ctx.fillText(`#${ticketId.slice(0, 12).toUpperCase()}`, 770, 42)
  ctx.textAlign = 'left'

  // Dotted separator
  ctx.setLineDash([6, 6])
  ctx.strokeStyle = 'rgba(247,147,26,0.2)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(30, 115); ctx.lineTo(590, 115); ctx.stroke()
  ctx.setLineDash([])

  // Event name
  ctx.fillStyle = '#F0EBE0'
  ctx.font = 'bold 26px Arial'
  const title = event.title || 'BitSavers Event'
  ctx.fillText(title.length > 36 ? title.slice(0, 36) + '…' : title, 30, 155)

  // Event details — label + value pairs, clean no-emoji style
  const detailY = [190, 215, 240]
  const details = [
    ['DATE', new Date(event.date).toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })],
    ...(event.time ? [['TIME', event.time]] : []),
    ...(event.location ? [['VENUE', event.location]] : []),
  ]
  details.forEach(([label, value], i) => {
    ctx.fillStyle = 'rgba(247,147,26,0.5)'
    ctx.font = 'bold 9px Arial'
    ctx.fillText(label, 30, detailY[i] - 2)
    ctx.fillStyle = '#aaa'
    ctx.font = '13px Arial'
    ctx.fillText(value.length > 55 ? value.slice(0, 55) + '…' : value, 30, detailY[i] + 12)
  })

  // Divider
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fillRect(30, 265, 560, 1)

  // Attendee section
  ctx.fillStyle = 'rgba(247,147,26,0.7)'
  ctx.font = 'bold 11px Arial'
  ctx.fillText('ATTENDEE', 30, 295)

  ctx.fillStyle = '#F0EBE0'
  ctx.font = 'bold 18px Arial'
  const attendeeName = profile?.name || profile?.display_name || npub.slice(0, 20) + '…'
  ctx.fillText(attendeeName, 30, 320)

  if (profile?.nip05) {
    ctx.fillStyle = '#F7931A'
    ctx.font = '12px Arial'
    ctx.fillText(profile.nip05, 30, 342)
  }

  // Status pill
  ctx.fillStyle = 'rgba(234,179,8,0.1)'
  ctx.beginPath()
  ctx.roundRect(30, 356, 130, 26, 13)
  ctx.fill()
  ctx.strokeStyle = 'rgba(234,179,8,0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(30, 356, 130, 26, 13)
  ctx.stroke()
  // Dot indicator
  ctx.fillStyle = '#eab308'
  ctx.beginPath()
  ctx.arc(46, 369, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#eab308'
  ctx.font = '600 11px Arial'
  ctx.fillText('PENDING', 56, 374)

  // Vertical dashed separator before QR
  ctx.setLineDash([5, 5])
  ctx.strokeStyle = 'rgba(247,147,26,0.25)'
  ctx.beginPath(); ctx.moveTo(620, 10); ctx.lineTo(620, 410); ctx.stroke()
  ctx.setLineDash([])

  // Small circles at separator (tear-off look)
  ctx.fillStyle = '#0a0a0a'
  ctx.beginPath(); ctx.arc(620, 0, 18, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(620, 420, 18, 0, Math.PI * 2); ctx.fill()

  // QR Code
  const qrImg = new Image()
  qrImg.src = qrDataUrl
  await new Promise(r => { qrImg.onload = r })

  // QR background
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(638, 110, 140, 140, 10)
  ctx.fill()
  ctx.drawImage(qrImg, 640, 112, 136, 136)

  ctx.fillStyle = '#888'
  ctx.font = '11px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('Scan to verify', 708, 268)
  ctx.fillText('', 708, 284)

  // BTC watermark text
  ctx.fillStyle = 'rgba(247,147,26,0.04)'
  ctx.font = 'bold 220px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('BTC', 400, 340)

  ctx.textAlign = 'left'

  // Footer
  ctx.fillStyle = 'rgba(247,147,26,0.3)'
  ctx.font = '10px monospace'
  ctx.fillText(`Generated: ${new Date().toISOString().slice(0,19)} UTC`, 30, 405)

  // Download
  const link = document.createElement('a')
  link.download = `bitsavers-ticket-${ticketId.slice(0, 8)}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

export function generateTicketId(npub, eventId) {
  // Fully deterministic — same npub + eventId always produces the same ticketId
  // No Date.now() — one npub = one ticket per event, forever
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

