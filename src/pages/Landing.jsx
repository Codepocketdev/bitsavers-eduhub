import { useState } from 'react'
import Navbar from '../components/layout/Navbar'
import Hero from '../components/layout/Hero'
import LiveFeed from '../components/layout/LiveFeed'
import Footer from '../components/layout/Footer'
import LoginModal from '../components/auth/LoginModal'

export default function Landing() {
  const [showLogin, setShowLogin] = useState(false)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080808',
      width: '100%',
    }}>
      <Navbar onEnter={() => setShowLogin(true)} />
      
      {/* Simple Hero - just headline + CTA */}
      <Hero onEnter={() => setShowLogin(true)} />
      
      {/* Main attraction - Live Nostr Feed */}
      <LiveFeed />
      
      <Footer />
      
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  )
}

