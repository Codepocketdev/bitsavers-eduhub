import { useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { X } from 'lucide-react'

export default function LoginModal({ onClose }) {
  const { login } = useAuth()
  const [tab, setTab] = useState('extension')
  const [nsecInput, setNsecInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatedKeys, setGeneratedKeys] = useState(null)

  const handleLogin = async (method) => {
    setError('')
    setLoading(true)

    try {
      if (method === 'nsec') {
        await login('nsec', nsecInput)
      } else if (method === 'extension') {
        await login('extension')
      } else if (method === 'generate') {
        const keys = await login('generate')
        setGeneratedKeys(keys)
        return // Don't close yet, show keys
      }
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }} onClick={onClose}>
      
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#111',
        border: '1px solid rgba(247,147,26,0.3)',
        borderRadius: 20,
        padding: 40,
        width: '100%',
        maxWidth: 460,
        position: 'relative',
      }}>
        
        <button onClick={onClose} style={{
          position: 'absolute',
          top: 16,
          right: 16,
          background: 'none',
          border: 'none',
          color: '#777',
          cursor: 'pointer',
          padding: 4,
        }}>
          <X size={24}/>
        </button>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 64,
            height: 64,
            background: '#F7931A',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30,
            fontWeight: 900,
            color: '#080808',
            margin: '0 auto 14px',
            boxShadow: '0 0 40px rgba(247,147,26,0.5)',
          }}>₿</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            Login with Nostr
          </h1>
          <p style={{ fontSize: 13, color: '#777', fontFamily: 'monospace' }}>
            Your keys, your identity
          </p>
        </div>

        {!generatedKeys ? (
          <>
            <div style={{
              display: 'flex',
              background: '#191919',
              borderRadius: 10,
              padding: 4,
              marginBottom: 24,
            }}>
              {['extension', 'nsec', 'generate'].map((t) => (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1,
                  padding: 9,
                  borderRadius: 8,
                  border: 'none',
                  background: tab === t ? '#F7931A' : 'transparent',
                  color: tab === t ? '#080808' : '#777',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>
                  {t === 'extension' && '⚡ Extension'}
                  {t === 'nsec' && '🔑 Nsec Key'}
                  {t === 'generate' && '✨ New Account'}
                </button>
              ))}
            </div>

            {tab === 'extension' && (
              <div>
                <p style={{ fontSize: 13, color: '#999', marginBottom: 16, lineHeight: 1.6 }}>
                  Login with your Nostr browser extension (nos2x, Alby, etc.)
                </p>
                <button onClick={() => handleLogin('extension')} disabled={loading} style={{
                  width: '100%',
                  background: '#F7931A',
                  border: 'none',
                  color: '#080808',
                  padding: '13px',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}>
                  {loading ? 'Connecting...' : '⚡ Login with Extension'}
                </button>
              </div>
            )}

            {tab === 'nsec' && (
              <div>
                <label style={{ fontSize: 12, color: '#777', fontWeight: 600, display: 'block', marginBottom: 8 }}>
                  YOUR NSEC KEY
                </label>
                <input
                  type="password"
                  value={nsecInput}
                  onChange={(e) => setNsecInput(e.target.value)}
                  placeholder="nsec1..."
                  style={{
                    width: '100%',
                    background: '#191919',
                    border: '1px solid rgba(247,147,26,0.3)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    color: '#F0EBE0',
                    fontSize: 13,
                    fontFamily: 'monospace',
                    outline: 'none',
                    marginBottom: 16,
                  }}
                />
                <button onClick={() => handleLogin('nsec')} disabled={loading || !nsecInput} style={{
                  width: '100%',
                  background: '#F7931A',
                  border: 'none',
                  color: '#080808',
                  padding: '13px',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: (loading || !nsecInput) ? 'not-allowed' : 'pointer',
                  opacity: (loading || !nsecInput) ? 0.6 : 1,
                }}>
                  {loading ? 'Logging in...' : '🔑 Login with Nsec'}
                </button>
              </div>
            )}

            {tab === 'generate' && (
              <div>
                <p style={{ fontSize: 13, color: '#999', marginBottom: 16, lineHeight: 1.6 }}>
                  Generate a new Nostr identity. Save your keys securely!
                </p>
                <button onClick={() => handleLogin('generate')} disabled={loading} style={{
                  width: '100%',
                  background: '#F7931A',
                  border: 'none',
                  color: '#080808',
                  padding: '13px',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}>
                  {loading ? 'Generating...' : '✨ Generate New Keys'}
                </button>
              </div>
            )}

            {error && (
              <div style={{
                marginTop: 16,
                padding: 12,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8,
                color: '#f87171',
                fontSize: 13,
              }}>
                {error}
              </div>
            )}
          </>
        ) : (
          <div>
            <p style={{ fontSize: 14, color: '#4ade80', marginBottom: 16, fontWeight: 600 }}>
              ✓ Keys Generated Successfully!
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: '#777', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                PUBLIC KEY (NPUB) - SHARE THIS
              </label>
              <code style={{
                display: 'block',
                background: '#191919',
                border: '1px solid rgba(247,147,26,0.3)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 11,
                fontFamily: 'monospace',
                color: '#F7931A',
                wordBreak: 'break-all',
              }}>
                {generatedKeys.npub}
              </code>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: '#f87171', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                PRIVATE KEY (NSEC) - NEVER SHARE THIS!
              </label>
              <code style={{
                display: 'block',
                background: '#1a0505',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 11,
                fontFamily: 'monospace',
                color: '#f87171',
                wordBreak: 'break-all',
              }}>
                {generatedKeys.nsec}
              </code>
            </div>
            <p style={{ fontSize: 12, color: '#999', marginBottom: 16, lineHeight: 1.6 }}>
              ⚠️ Save your nsec key somewhere safe! If you lose it, you lose access to your account forever.
            </p>
            <button onClick={onClose} style={{
              width: '100%',
              background: '#F7931A',
              border: 'none',
              color: '#080808',
              padding: '13px',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}>
              I've Saved My Keys → Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
