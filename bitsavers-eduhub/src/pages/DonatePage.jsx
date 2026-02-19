import { useState } from 'react'
import { Zap, Copy, CheckCircle, X } from 'lucide-react'

const C = {
  bg: '#080808', surface: '#0f0f0f', card: '#141414',
  border: 'rgba(247,147,26,0.18)', accent: '#F7931A',
  dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

const BLINK_ADDRESS = 'hodlcurator@blink.sv'
const BLINK_LN_URL = 'https://pay.blink.sv/hodlcurator'
const presets = [100, 1000, 5000, 21000, 100000]

// ─── Invoice Modal ────────────────────────────────────────────────────────────
function InvoiceModal({ invoice, amount, onClose }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invoice)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { alert('Copy failed') }
  }

  const openWallet = () => window.open(`lightning:${invoice}`, '_blank')

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 20, width: '100%', maxWidth: 380,
        padding: 28, position: 'relative',
        animation: 'popIn 0.2s ease',
      }}>
        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(255,255,255,0.06)', border: 'none',
          color: C.muted, width: 32, height: 32, borderRadius: '50%',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <X size={16} />
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 0 24px rgba(247,147,26,0.4)' }}>
            <Zap size={26} color={C.bg} fill={C.bg} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.text, marginBottom: 4 }}>
            {amount.toLocaleString()} sats
          </div>
          <div style={{ fontSize: 13, color: C.muted }}>Scan with any Lightning wallet</div>
        </div>

        {/* QR Code */}
        <div style={{ background: '#fff', borderRadius: 14, padding: 12, marginBottom: 20, textAlign: 'center' }}>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(invoice)}&margin=4`}
            alt="Lightning QR"
            style={{ width: '100%', maxWidth: 240, display: 'block', margin: '0 auto', borderRadius: 8 }}
          />
        </div>

        {/* Invoice string */}
        <div style={{
          background: '#0a0a0a', border: `1px solid ${C.border}`,
          borderRadius: 9, padding: '10px 12px',
          fontSize: 9, fontFamily: 'monospace', color: C.muted,
          wordBreak: 'break-all', lineHeight: 1.5, marginBottom: 16,
        }}>
          {invoice.slice(0, 80)}…
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={copy} style={{
            flex: 1, background: copied ? 'rgba(34,197,94,0.15)' : C.dim,
            border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : C.border}`,
            color: copied ? C.green : C.accent,
            padding: 13, borderRadius: 10, fontWeight: 700, fontSize: 13,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {copied ? <><CheckCircle size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
          </button>
          <button onClick={openWallet} style={{
            flex: 1, background: C.accent, border: 'none', color: C.bg,
            padding: 13, borderRadius: 10, fontWeight: 700, fontSize: 13,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Zap size={14} fill={C.bg} /> Open Wallet
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <a href={BLINK_LN_URL} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: C.muted, textDecoration: 'none' }}>
            Or pay directly on Blink →
          </a>
        </div>
      </div>

      <style>{`@keyframes popIn { from { transform: scale(0.92); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
    </div>
  )
}

// ─── Main Donate Page ─────────────────────────────────────────────────────────
export default function DonatePage() {
  const [amount, setAmount] = useState(1000)
  const [loading, setLoading] = useState(false)
  const [invoice, setInvoice] = useState('')
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)

  const fetchInvoice = async () => {
    setLoading(true)
    setError('')
    setInvoice('')
    try {
      const [user, domain] = BLINK_ADDRESS.split('@')
      const metaRes = await fetch(`https://${domain}/.well-known/lnurlp/${user}`)
      if (!metaRes.ok) throw new Error('Could not reach Blink')
      const meta = await metaRes.json()
      const msats = amount * 1000
      if (msats < meta.minSendable || msats > meta.maxSendable)
        throw new Error(`Amount must be between ${meta.minSendable/1000} and ${meta.maxSendable/1000} sats`)
      const invRes = await fetch(`${meta.callback}?amount=${msats}`)
      if (!invRes.ok) throw new Error('Could not get invoice')
      const invData = await invRes.json()
      if (invData.status === 'ERROR') throw new Error(invData.reason)
      setInvoice(invData.pr)
      setShowModal(true)
    } catch (e) {
      setError(e.message || 'Failed to get invoice')
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 500, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, textAlign: 'center', marginBottom: 16 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#F7931A,#b8690f)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 0 32px rgba(247,147,26,0.4)' }}>
          <Zap size={36} color={C.bg} fill={C.bg} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 6 }}>Support BitSavers</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 12 }}>
          Help us keep Bitcoin education free across Africa. Every sat counts.
        </div>
        <div style={{ background: C.dim, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 12, color: C.accent, fontFamily: 'monospace', display: 'inline-block' }}>
          {BLINK_ADDRESS}
        </div>
      </div>

      {/* Amount selector */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Select Amount (sats)</div>

        {/* Presets */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
          {presets.map(p => (
            <button key={p} onClick={() => setAmount(p)} style={{
              background: amount === p ? C.accent : C.dim,
              border: `1px solid ${amount === p ? C.accent : C.border}`,
              color: amount === p ? C.bg : C.muted,
              padding: '8px 4px', borderRadius: 9, fontWeight: 700,
              fontSize: p >= 10000 ? 10 : 12, cursor: 'pointer',
            }}>
              {p.toLocaleString()}
            </button>
          ))}
        </div>

        {/* Slider */}
        <div style={{ marginBottom: 16 }}>
          <input type="range" min={1} max={1000000} value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            style={{ width: '100%', accentColor: C.accent, cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted, marginTop: 4 }}>
            <span>1 sat</span><span>1,000,000 sats</span>
          </div>
        </div>

        {/* Manual input */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input type="number" value={amount} onChange={e => setAmount(Math.max(1, Number(e.target.value)))}
            style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 60px 14px 16px', color: C.text, fontSize: 22, fontWeight: 800, outline: 'none', textAlign: 'center' }} />
          <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.muted, fontWeight: 600 }}>SATS</span>
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: C.muted, marginBottom: 20 }}>
          ≈ ${(amount * 0.00097).toFixed(2)} USD at ~$97k/BTC
        </div>

        {error && (
          <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 9, color: C.red, fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button onClick={fetchInvoice} disabled={loading || amount < 1} style={{
          width: '100%', background: C.accent, border: 'none', color: C.bg,
          padding: '15px', borderRadius: 12, fontWeight: 800, fontSize: 16,
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <Zap size={18} fill={C.bg} />
          {loading ? 'Getting Invoice…' : `Pay ${amount.toLocaleString()} sats`}
        </button>
      </div>

      {/* Invoice modal popup */}
      {showModal && invoice && (
        <InvoiceModal
          invoice={invoice}
          amount={amount}
          onClose={() => { setShowModal(false); setInvoice('') }}
        />
      )}
    </div>
  )
}

