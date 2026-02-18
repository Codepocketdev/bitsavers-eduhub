import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './lib/AuthContext'
import SplashScreen from './components/SplashScreen'
import Intro from './pages/Intro'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'

function AppContent() {
  const { user, loading } = useAuth()
  const [showSplash, setShowSplash] = useState(true)
  const [page, setPage] = useState('intro')

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false)
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  // Show splash first
  if (showSplash) {
    return <SplashScreen />
  }

  // Show loading while checking auth
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#080808',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        Loading...
      </div>
    )
  }

  // If logged in, show Dashboard
  if (user) {
    return <Dashboard />
  }

  // Not logged in - show navigation pages
  if (page === 'login') {
    return <Login onBack={() => setPage('intro')} />
  }

  if (page === 'signup') {
    return <Signup onBack={() => setPage('intro')} />
  }

  return <Intro onNavigate={setPage} />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
