import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

export default function Login({ onBack }) {
  const { login } = useAuth()
  const [method, setMethod] = useState('nsec')
  const [nsecInput, setNsecInput] = useState('')
  const [showNsec, setShowNsec] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setError('')
    setLoading(true)

    try {
      if (method === 'extension') {
        await login('extension')
      } else {
        if (!nsecInput.trim()) {
          setError('Please enter your nsec key')
          setLoading(false)
          return
        }
        await login('nsec', nsecInput)
      }
      // Success - AuthContext will update user state
    } catch (err) {
      setError(err.message || 'Login failed')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080808',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        maxWidth: 500,
        width: '100%',
      }}>
        
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 80,
            height: 80,
            margin: '0 auto 20px',
            background: '#F7931A',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 40,
            fontWeight: 900,
            color: '#080808',
            boxShadow: '0 0 40px rgba(247,147,26,0.4)',
          }}>₿</div>
          
          <h1 style={{
            fontSize: 28,
            fontWeight: 900,
            color: '#fff',
            marginBottom: 8,
          }}>
            Welcome Back
          </h1>
          
          <p style={{
            fontSize: 14,
            color: '#999',
          }}>
            Login to continue your Bitcoin journey
          </p>
        </div>

        {/* Method Tabs */}
        <div style={{
          display: 'flex',
          gap: 12,
          marginBottom: 32,
        }}>
          <button
            onClick={() => setMethod('extension')}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: 12,
              border: method === 'extension' ? '2px solid #F7931A' : '1px solid rgba(247,147,26,0.3)',
              background: method === 'extension' ? 'rgba(247,147,26,0.1)' : 'transparent',
              color: method === 'extension' ? '#F7931A' : '#999',
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Extension
          </button>

          <button
            onClick={() => setMethod('nsec')}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: 12,
              border: method === 'nsec' ? '2px solid #F7931A' : '1px solid rgba(247,147,26,0.3)',
              background: method === 'nsec' ? 'rgba(247,147,26,0.1)' : 'transparent',
              color: method === 'nsec' ? '#F7931A' : '#999',
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Nsec Key
          </button>
        </div>

        {/* Form */}
        <div style={{
          background: 'rgba(17,17,17,0.6)',
          border: '1px solid rgba(247,147,26,0.2)',
          borderRadius: 16,
          padding: 32,
          marginBottom: 24,
        }}>
          {method === 'extension' ? (
            <>
              <p style={{
                fontSize: 14,
                color: '#ccc',
                lineHeight: 1.7,
                marginBottom: 24,
              }}>
                Login with your Nostr browser extension (nos2x, Alby, etc.)
              </p>

              <button
                onClick={handleLogin}
                disabled={loading}
                style={{
                  width: '100%',
                  background: '#F7931A',
                  border: 'none',
                  color: '#080808',
                  padding: '16px',
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Connecting...' : 'Login with Extension'}
              </button>
            </>
          ) : (
            <>
              <label style={{
                fontSize: 13,
                color: '#999',
                fontWeight: 600,
                display: 'block',
                marginBottom: 10,
              }}>
                Your Nsec Key
              </label>

              <div style={{ position: 'relative', marginBottom: 20 }}>
                <input
                  type={showNsec ? 'text' : 'password'}
                  value={nsecInput}
                  onChange={(e) => setNsecInput(e.target.value)}
                  placeholder="nsec1..."
                  style={{
                    width: '100%',
                    background: '#0a0a0a',
                    border: '1px solid rgba(247,147,26,0.3)',
                    borderRadius: 10,
                    padding: '14px 50px 14px 16px',
                    color: '#F0EBE0',
                    fontSize: 14,
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => setShowNsec(!showNsec)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#999',
                    cursor: 'pointer',
                    padding: 8,
                  }}
                >
                  {showNsec ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>

              <p style={{
                fontSize: 11,
                color: '#666',
                marginBottom: 20,
              }}>
                Never share your nsec! It's like your password.
              </p>

              <button
                onClick={handleLogin}
                disabled={loading || !nsecInput.trim()}
                style={{
                  width: '100%',
                  background: '#F7931A',
                  border: 'none',
                  color: '#080808',
                  padding: '16px',
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: (loading || !nsecInput.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (loading || !nsecInput.trim()) ? 0.6 : 1,
                }}
              >
                {loading ? 'Logging in...' : 'Login with Nsec'}
              </button>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: 14,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10,
            color: '#f87171',
            fontSize: 13,
            marginBottom: 20,
          }}>
            {error}
          </div>
        )}

        {/* Back */}
        <div style={{ textAlign: 'center' }}>
          <button onClick={onBack} style={{
            background: 'none',
            border: 'none',
            color: '#999',
            fontSize: 14,
            cursor: 'pointer',
          }}>
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  )
}
