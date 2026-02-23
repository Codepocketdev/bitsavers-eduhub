import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './lib/AuthContext'
import SplashScreen from './components/SplashScreen'
import Intro from './pages/Intro'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'

function InstallBanner({ onInstall, onDismiss }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9998,
      background: '#141414',
      borderTop: '1px solid rgba(247,147,26,0.3)',
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
    }}>
      <img src="/icon-192.png" alt="BitSavers" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#F0EBE0' }}>Install BitSavers EduHub</div>
        <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Add to home screen for the best experience</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={onDismiss} style={{
          background: 'transparent', border: '1px solid rgba(247,147,26,0.3)',
          color: '#666', padding: '8px 12px', borderRadius: 8,
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>Later</button>
        <button onClick={onInstall} style={{
          background: '#F7931A', border: 'none',
          color: '#000', padding: '8px 16px', borderRadius: 8,
          fontSize: 12, fontWeight: 800, cursor: 'pointer',
        }}>Install</button>
      </div>
    </div>
  )
}

function AppContent() {
  const { user, loading } = useAuth()
  const [showSplash, setShowSplash] = useState(true)
  const [page, setPage] = useState('intro')
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  // Capture the install prompt — only show in browser, not inside installed PWA
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
    if (isStandalone) return // already installed, skip

    const handler = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
      // Show banner after splash is gone
      setTimeout(() => setShowInstallBanner(true), 3500)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    setInstallPrompt(null)
    setShowInstallBanner(false)
  }

  const handleDismiss = () => {
    setShowInstallBanner(false)
    // Don't show again for 3 days
    localStorage.setItem('bitsavers_install_dismissed', Date.now())
  }

  if (showSplash) return <SplashScreen />

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#080808', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading...
      </div>
    )
  }

  return (
    <>
      {user ? <Dashboard /> : (
        page === 'login' ? <Login onBack={() => setPage('intro')} /> :
        page === 'signup' ? <Signup onBack={() => setPage('intro')} /> :
        <Intro onNavigate={setPage} />
      )}
      {showInstallBanner && (
        <InstallBanner onInstall={handleInstall} onDismiss={handleDismiss} />
      )}
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

