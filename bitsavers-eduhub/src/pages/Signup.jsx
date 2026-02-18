import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { publishProfile } from '../lib/nostr'
import ImageUpload from '../components/ImageUpload'

export default function Signup({ onBack }) {
  const { login } = useAuth()
  const [step, setStep] = useState('generate') // generate | setup | saving | done
  const [generatedKeys, setGeneratedKeys] = useState(null)
  const [showNsec, setShowNsec] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  // Profile setup fields
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [picture, setPicture] = useState('')
  const [website, setWebsite] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [pubError, setPubError] = useState('')

  const handleGenerate = async () => {
    setError('')
    setLoading(true)
    try {
      const keys = await login('generate')
      setGeneratedKeys(keys)
      setStep('savekeys')
      setLoading(false)
    } catch (err) {
      setError(err.message || 'Failed to generate keys')
      setLoading(false)
    }
  }

  const handleSetupProfile = async () => {
    if (!name.trim()) {
      setPubError('Please enter a display name')
      return
    }
    setPublishing(true)
    setPubError('')
    try {
      const profileData = {
        name: name.trim(),
        display_name: name.trim(),
        about: bio.trim(),
        picture: picture.trim(),
        website: website.trim(),
        // tag this profile as a bitsavers user
        lud16: '',
        nip05: '',
      }
      // Publish kind:0 to relays
      await publishProfile(generatedKeys.nsec, profileData)

      // Update stored user with new profile info
      const storedUser = JSON.parse(localStorage.getItem('bitsavers_user') || '{}')
      const updatedUser = { ...storedUser, profile: profileData }
      localStorage.setItem('bitsavers_user', JSON.stringify(updatedUser))

      setStep('done')
      setPublishing(false)
      setTimeout(() => window.location.reload(), 1200)
    } catch (err) {
      setPubError(err.message || 'Failed to publish profile')
      setPublishing(false)
    }
  }

  const handleSkipProfile = () => {
    window.location.reload()
  }

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text)
      alert(`${label} copied!`)
    } catch {
      alert('Failed to copy')
    }
  }

  // ── Step 1: Generate keys ──────────────────────────────────────────────────
  if (step === 'generate') {
    return (
      <Screen>
        <Logo />
        <h1 style={s.h1}>Create Account</h1>
        <p style={s.sub}>Join thousands of Bitcoin learners across Africa</p>

        <Card>
          <p style={{ fontSize: 14, color: '#ccc', lineHeight: 1.7, marginBottom: 24 }}>
            BitSavers uses <span style={{ color: '#F7931A' }}>Nostr</span> — a decentralised protocol.
            You own your identity. No email, no password, no company controls your account.
          </p>
          <button onClick={handleGenerate} disabled={loading} style={s.btnPrimary}>
            {loading ? 'Generating…' : '⚡ Generate My Keys'}
          </button>
          {error && <ErrorBox msg={error} />}
        </Card>

        <Back onBack={onBack} />
      </Screen>
    )
  }

  // ── Step 2: Show & save keys ───────────────────────────────────────────────
  if (step === 'savekeys') {
    return (
      <Screen>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔑</div>
          <h1 style={{ ...s.h1, color: '#4ade80' }}>Keys Generated!</h1>
          <p style={s.sub}>Save your private key — you'll need it to log in</p>
        </div>

        <Card>
          {/* Public key */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ ...s.label, color: '#4ade80' }}>PUBLIC KEY — share freely</label>
            <div style={{ ...s.keyBox, borderColor: 'rgba(74,222,128,0.3)', color: '#4ade80' }}>
              {generatedKeys?.npub}
            </div>
            <button onClick={() => copyToClipboard(generatedKeys?.npub, 'Public key')} style={{ ...s.btnOutline, borderColor: 'rgba(74,222,128,0.3)', color: '#4ade80', marginTop: 8 }}>
              Copy npub
            </button>
          </div>

          {/* Private key */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ ...s.label, color: '#ef4444' }}>PRIVATE KEY — NEVER share!</label>
            <div style={{ position: 'relative' }}>
              <div style={{ ...s.keyBox, borderColor: 'rgba(239,68,68,0.3)', color: '#f87171', paddingRight: 48 }}>
                {showNsec ? generatedKeys?.nsec : '••••••••••••••••••••••••••••••••••••'}
              </div>
              <button onClick={() => setShowNsec(!showNsec)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 18 }}>
                {showNsec ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            <button onClick={() => copyToClipboard(generatedKeys?.nsec, 'Private key')} style={{ ...s.btnOutline, borderColor: 'rgba(239,68,68,0.3)', color: '#f87171', marginTop: 8 }}>
              Copy nsec
            </button>
          </div>

          {/* Warning */}
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 12, color: '#f87171', lineHeight: 1.6 }}>
            ⚠️ <strong>If you lose your private key, you lose your account forever.</strong> Save it in a password manager or write it down safely.
          </div>

          {/* Confirm checkbox */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 20 }}>
            <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)}
              style={{ marginTop: 2, accentColor: '#F7931A', width: 16, height: 16 }} />
            <span style={{ fontSize: 13, color: '#ccc', lineHeight: 1.5 }}>
              I've saved my private key somewhere safe
            </span>
          </label>

          <button onClick={() => setStep('setup')} disabled={!saved}
            style={{ ...s.btnPrimary, opacity: saved ? 1 : 0.4, cursor: saved ? 'pointer' : 'not-allowed' }}>
            Continue → Set Up Profile
          </button>
        </Card>
      </Screen>
    )
  }

  // ── Step 3: Profile setup ──────────────────────────────────────────────────
  if (step === 'setup' || step === 'done') {
    return (
      <Screen>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>👤</div>
          <h1 style={s.h1}>Set Up Your Profile</h1>
          <p style={s.sub}>This is published to the Nostr network — visible everywhere</p>
        </div>

        <Card>
          {/* Avatar upload */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <ImageUpload currentUrl={picture} onUploaded={setPicture} size={86} />
          </div>

          <Field label="Display Name *" value={name} onChange={setName} placeholder="e.g. Satoshi Njoroge" />
          <Field label="Bio" value={bio} onChange={setBio} placeholder="Bitcoin student from Nairobi 🇰🇪" textarea />
          <Field label="Website" value={website} onChange={setWebsite} placeholder="https://yoursite.com" />

          {pubError && <ErrorBox msg={pubError} />}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '10px 0', color: '#4ade80', fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
              ✅ Profile published! Entering dashboard…
            </div>
          )}

          <button onClick={handleSetupProfile} disabled={publishing || step === 'done'} style={s.btnPrimary}>
            {publishing ? 'Publishing to Nostr…' : '🚀 Publish Profile & Enter'}
          </button>

          <button onClick={handleSkipProfile} style={{ ...s.btnOutline, marginTop: 10, width: '100%' }}>
            Skip for now → Enter Dashboard
          </button>
        </Card>
      </Screen>
    )
  }
}

// ── Small reusable components ─────────────────────────────────────────────────
function Screen({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>{children}</div>
    </div>
  )
}

function Logo() {
  return (
    <div style={{ textAlign: 'center', marginBottom: 28 }}>
      <div style={{ width: 72, height: 72, margin: '0 auto 14px', background: '#F7931A', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 900, color: '#080808', boxShadow: '0 0 36px rgba(247,147,26,0.4)' }}>₿</div>
    </div>
  )
}

function Card({ children }) {
  return (
    <div style={{ background: 'rgba(17,17,17,0.7)', border: '1px solid rgba(247,147,26,0.2)', borderRadius: 16, padding: 28, marginBottom: 20 }}>
      {children}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, textarea }) {
  const style = { width: '100%', background: '#0a0a0a', border: '1px solid rgba(247,147,26,0.25)', borderRadius: 10, padding: '13px 14px', color: '#F0EBE0', fontSize: 14, outline: 'none', marginBottom: 16, fontFamily: 'inherit', resize: 'vertical' }
  return (
    <div>
      <label style={{ fontSize: 12, color: '#777', fontWeight: 600, display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>{label}</label>
      {textarea
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} style={style} />
        : <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={style} />
      }
    </div>
  )
}

function Back({ onBack }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#666', fontSize: 13, cursor: 'pointer' }}>← Back to home</button>
    </div>
  )
}

function ErrorBox({ msg }) {
  return <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#f87171', fontSize: 13, marginTop: 12 }}>{msg}</div>
}

const s = {
  h1:         { fontSize: 26, fontWeight: 900, color: '#fff', textAlign: 'center', marginBottom: 6 },
  sub:        { fontSize: 13, color: '#777', textAlign: 'center', marginBottom: 24 },
  label:      { fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 8 },
  keyBox:     { background: '#0a0a0a', border: '1px solid', borderRadius: 10, padding: 12, fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.5 },
  btnPrimary: { width: '100%', background: '#F7931A', border: 'none', color: '#080808', padding: '15px', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer' },
  btnOutline: { background: 'transparent', border: '1px solid rgba(247,147,26,0.3)', color: '#F7931A', padding: '9px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer' },
}

