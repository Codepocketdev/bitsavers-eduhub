import { useState } from 'react'
import { Video, Eye, EyeOff, CheckCircle, Loader, Wifi, WifiOff, Trash2 } from 'lucide-react'

const C = {
  bg: '#080808', card: '#141414', border: 'rgba(247,147,26,0.18)',
  accent: '#F7931A', dim: 'rgba(247,147,26,0.12)', text: '#F0EBE0',
  muted: '#666', green: '#22c55e', red: '#ef4444',
}

const Card = ({ children }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
    {children}
  </div>
)

const getCredentials = () => { try { return JSON.parse(localStorage.getItem('bitsavers_zoom') || '{}') } catch { return {} } }
const saveCredentials = (d) => localStorage.setItem('bitsavers_zoom', JSON.stringify(d))

export default function AdminLiveClasses() {
  const stored = getCredentials()
  const [accountId, setAccountId]     = useState(stored.accountId || '')
  const [clientId, setClientId]       = useState(stored.clientId || '')
  const [clientSecret, setClientSecret] = useState(stored.clientSecret || '')
  const [userId, setUserId]           = useState(stored.userId || 'me')
  const [showSecret, setShowSecret]   = useState(false)
  const [testing, setTesting]         = useState(false)
  const [testResult, setTestResult]   = useState(null) // null | 'ok' | 'err'
  const [testMsg, setTestMsg]         = useState('')
  const [saved, setSaved]             = useState(false)

  const isConnected = !!(stored.accountId && stored.clientId && stored.clientSecret)

  const testConnection = async () => {
    if (!accountId || !clientId || !clientSecret) {
      setTestResult('err'); setTestMsg('Fill in all fields first'); return
    }
    setTesting(true); setTestResult(null); setTestMsg('')
    try {
      const res = await fetch('/api/zoom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, clientId, clientSecret, action: 'upcoming', userId: userId || 'me' })
      })
      const text = await res.text()
      if (!text) throw new Error('No response — test this on the deployed Vercel URL, not localhost')
      let data
      try { data = JSON.parse(text) } catch { throw new Error('Invalid response — API may not be deployed yet') }
      if (!res.ok) throw new Error(data.error || 'Connection failed')
      setTestResult('ok')
      setTestMsg(`Connected! Found ${data.meetings?.length || 0} upcoming meeting(s)`)
    } catch (e) {
      setTestResult('err')
      setTestMsg(e.message || 'Connection failed')
    }
    setTesting(false)
  }

  const save = () => {
    saveCredentials({ accountId, clientId, clientSecret, userId })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const disconnect = () => {
    if (!confirm('Remove Zoom credentials? Live classes will stop working.')) return
    localStorage.removeItem('bitsavers_zoom')
    setAccountId(''); setClientId(''); setClientSecret('')
    setTestResult(null); setTestMsg('')
  }

  return (
    <div>
      {/* Status */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: isConnected ? 'rgba(34,197,94,0.1)' : C.dim, border: `1px solid ${isConnected ? 'rgba(34,197,94,0.3)' : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isConnected ? <Wifi size={20} color={C.green} /> : <WifiOff size={20} color={C.muted} />}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Zoom Integration</div>
            <div style={{ fontSize: 12, color: isConnected ? C.green : C.muted }}>
              {isConnected ? 'Connected — credentials saved' : 'Not connected'}
            </div>
          </div>
          {isConnected && (
            <button onClick={disconnect} style={{ marginLeft: 'auto', background: 'rgba(239,68,68,0.1)', border: 'none', color: C.red, padding: '7px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Trash2 size={12} /> Disconnect
            </button>
          )}
        </div>
      </Card>

      {/* Credentials form */}
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 18 }}>Zoom Server-to-Server OAuth Credentials</div>

        {[
          ['Account ID', accountId, setAccountId, 'YkcDbNh…', false],
          ['Client ID', clientId, setClientId, '98H0AB…', false],
        ].map(([label, val, set, ph]) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>{label}</label>
            <input
              value={val} onChange={e => set(e.target.value)} placeholder={ph}
              style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 13px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'monospace' }}
            />
          </div>
        ))}

        {/* Client Secret with show/hide */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>Client Secret</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showSecret ? 'text' : 'password'}
              value={clientSecret} onChange={e => setClientSecret(e.target.value)}
              placeholder="X71W7Y…"
              style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 42px 12px 13px', color: C.text, fontSize: 13, outline: 'none', fontFamily: 'monospace' }}
            />
            <button onClick={() => setShowSecret(!showSecret)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}>
              {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* User ID (optional) */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Zoom User ID / Email <span style={{ fontWeight: 400 }}>(optional — defaults to account owner)</span>
          </label>
          <input
            value={userId} onChange={e => setUserId(e.target.value)} placeholder="me or your@email.com"
            style={{ width: '100%', background: '#0a0a0a', border: `1px solid ${C.border}`, borderRadius: 9, padding: '12px 13px', color: C.text, fontSize: 13, outline: 'none' }}
          />
        </div>

        {/* Test result */}
        {testResult && (
          <div style={{ padding: '10px 14px', borderRadius: 9, marginBottom: 14, fontSize: 13,
            background: testResult === 'ok' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${testResult === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: testResult === 'ok' ? C.green : C.red,
          }}>
            {testMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={testConnection} disabled={testing} style={{ flex: 1, background: C.dim, border: `1px solid ${C.border}`, color: C.accent, padding: '12px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {testing ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Testing…</> : <><Wifi size={13} /> Test Connection</>}
          </button>
          <button onClick={save} style={{ flex: 1, background: saved ? 'rgba(34,197,94,0.15)' : C.accent, border: saved ? '1px solid rgba(34,197,94,0.4)' : 'none', color: saved ? C.green : '#000', padding: '12px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {saved ? <><CheckCircle size={13} /> Saved!</> : 'Save Credentials'}
          </button>
        </div>
      </Card>

      {/* Info */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>What this enables</div>
        {[
          ['Live class indicator', 'Green pulse when a Zoom class is happening right now'],
          ['Who\'s in the call', 'See participant names live from the Zoom dashboard'],
          ['Upcoming classes', 'Countdown timers for scheduled sessions'],
          ['One-tap join', 'Students join directly from the app'],
        ].map(([title, desc]) => (
          <div key={title} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <CheckCircle size={14} color={C.green} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{title}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{desc}</div>
            </div>
          </div>
        ))}
      </Card>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

