import { useState } from 'react'
import { Menu, X } from 'lucide-react'

export default function Navbar({ onEnter }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <nav style={{
        padding: '16px 5%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(247,147,26,0.15)',
        background: 'rgba(8,8,8,0.95)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(20px)',
      }}>
        
        {/* Left: Menu button + Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Hamburger Menu */}
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background: 'transparent',
              border: '1px solid rgba(247,147,26,0.3)',
              color: '#F7931A',
              padding: 8,
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s',
            }}
          >
            <Menu size={20} />
          </button>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38,
              background: '#F7931A',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 20,
              color: '#080808',
              boxShadow: '0 0 20px rgba(247,147,26,0.5)',
            }}>₿</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', letterSpacing: 0.5 }}>BITSAVERS</div>
              <div style={{ fontWeight: 600, fontSize: 9, color: '#F7931A', letterSpacing: 2 }}>EDUHUB ACADEMY</div>
            </div>
          </div>
        </div>

        {/* Right: Auth buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onEnter} style={{
            background: 'transparent',
            border: '1px solid rgba(247,147,26,0.4)',
            color: '#F0EBE0',
            padding: '10px 20px',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}>Login</button>
          <button onClick={onEnter} style={{
            background: '#F7931A',
            border: 'none',
            color: '#080808',
            padding: '10px 24px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            boxShadow: '0 0 20px rgba(247,147,26,0.35)',
          }}>Register</button>
        </div>
      </nav>

      {/* Sidebar Menu Overlay */}
      {menuOpen && (
        <>
          {/* Backdrop */}
          <div 
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(4px)',
              zIndex: 150,
              animation: 'fadeIn 0.3s',
            }}
          />

          {/* Sidebar */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: 320,
            maxWidth: '85vw',
            background: '#111',
            borderRight: '1px solid rgba(247,147,26,0.3)',
            zIndex: 200,
            overflowY: 'auto',
            animation: 'slideInLeft 0.3s ease-out',
          }}>
            
            {/* Header */}
            <div style={{
              padding: 24,
              borderBottom: '1px solid rgba(247,147,26,0.2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Menu</h2>
              <button 
                onClick={() => setMenuOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#777',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Menu Items */}
            <div style={{ padding: '20px 16px' }}>
              
              {/* Section: Learn */}
              <div style={{ marginBottom: 32 }}>
                <div style={{
                  fontSize: 11,
                  color: '#555',
                  fontWeight: 700,
                  letterSpacing: 2,
                  padding: '0 12px 12px',
                }}>
                  LEARN
                </div>
                
                <MenuItem 
                  emoji="🎓" 
                  title="Courses" 
                  description="Browse all learning paths"
                  onClick={() => {
                    document.getElementById('courses-section')?.scrollIntoView({ behavior: 'smooth' })
                    setMenuOpen(false)
                  }}
                />
                <MenuItem 
                  emoji="⚡" 
                  title="Features" 
                  description="What makes us different"
                  onClick={() => {
                    document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' })
                    setMenuOpen(false)
                  }}
                />
                <MenuItem 
                  emoji="📚" 
                  title="Resources" 
                  description="Free Bitcoin learning materials"
                />
              </div>

              {/* Section: Community */}
              <div style={{ marginBottom: 32 }}>
                <div style={{
                  fontSize: 11,
                  color: '#555',
                  fontWeight: 700,
                  letterSpacing: 2,
                  padding: '0 12px 12px',
                }}>
                  COMMUNITY
                </div>
                
                <MenuItem 
                  emoji="💬" 
                  title="Nostr Community" 
                  description="Join the conversation"
                />
                <MenuItem 
                  emoji="🏫" 
                  title="Campus Groups" 
                  description="Connect with your university"
                />
                <MenuItem 
                  emoji="👥" 
                  title="Study Groups" 
                  description="Learn together"
                />
              </div>

              {/* Section: About */}
              <div>
                <div style={{
                  fontSize: 11,
                  color: '#555',
                  fontWeight: 700,
                  letterSpacing: 2,
                  padding: '0 12px 12px',
                }}>
                  ABOUT
                </div>
                
                <MenuItem 
                  emoji="ℹ️" 
                  title="About Us" 
                  description="Our mission & vision"
                />
                <MenuItem 
                  emoji="🤝" 
                  title="Partners" 
                  description="Universities & organizations"
                />
                <MenuItem 
                  emoji="📧" 
                  title="Contact" 
                  description="Get in touch"
                />
              </div>
            </div>

            {/* Footer CTA */}
            <div style={{
              padding: 24,
              borderTop: '1px solid rgba(247,147,26,0.2)',
              marginTop: 'auto',
            }}>
              <button 
                onClick={() => {
                  onEnter()
                  setMenuOpen(false)
                }}
                style={{
                  width: '100%',
                  background: '#F7931A',
                  border: 'none',
                  color: '#080808',
                  padding: '14px',
                  borderRadius: 10,
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(247,147,26,0.3)',
                }}
              >
                Start Learning Free →
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}

// Menu Item Component
function MenuItem({ emoji, title, description, onClick }) {
  return (
    <div 
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 12px',
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'all 0.2s',
        marginBottom: 4,
        background: 'transparent',
        border: '1px solid transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(247,147,26,0.08)'
        e.currentTarget.style.borderColor = 'rgba(247,147,26,0.2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = 'transparent'
      }}
    >
      <div style={{ fontSize: 24 }}>{emoji}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: '#777' }}>
          {description}
        </div>
      </div>
    </div>
  )
}

