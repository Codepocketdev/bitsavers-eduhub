export default function Hero({ onEnter }) {
  return (
    <div style={{
      padding: '60px 5% 40px',
      textAlign: 'center',
      background: '#080808',
      position: 'relative',
    }}>

      {/* Grid background - subtle */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(247,147,26,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(247,147,26,0.02) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        opacity: 0.5,
      }}/>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 800, margin: '0 auto' }}>
        
        {/* Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(247,147,26,0.12)',
          border: '1px solid rgba(247,147,26,0.3)',
          borderRadius: 20,
          padding: '6px 16px',
          fontSize: 11,
          fontWeight: 700,
          color: '#F7931A',
          letterSpacing: 2,
          marginBottom: 24,
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#F7931A',
            boxShadow: '0 0 8px #F7931A',
            animation: 'pulse 2s infinite',
          }}/>
          AFRICA'S BITCOIN UNIVERSITY
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(32px, 8vw, 56px)',
          fontWeight: 900,
          lineHeight: 1.1,
          color: '#fff',
          marginBottom: 16,
        }}>
          Master Bitcoin.<br />
          <span style={{
            background: 'linear-gradient(135deg, #F7931A 0%, #ff9d3a 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>Build Your Future.</span>
        </h1>

        {/* Subheading */}
        <p style={{
          fontSize: 'clamp(15px, 3vw, 18px)',
          color: '#aaa',
          lineHeight: 1.6,
          marginBottom: 32,
          maxWidth: 600,
          margin: '0 auto 32px',
        }}>
          Learn Bitcoin from expert instructors. Join thousands of students across Kenya. 100% free forever.
        </p>

        {/* Single CTA */}
        <button onClick={onEnter} style={{
          background: '#F7931A',
          border: 'none',
          color: '#080808',
          padding: '16px 40px',
          borderRadius: 12,
          fontWeight: 800,
          fontSize: 16,
          cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(247,147,26,0.35)',
        }}>
          Start Learning Free →
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

