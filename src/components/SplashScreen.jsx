export default function SplashScreen() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'linear-gradient(180deg, #0a0a0a 0%, #1a0f00 50%, #0a0a0a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{ textAlign: 'center' }}>
        
        {/* Logo with glow effect */}
        <div style={{
          marginBottom: 40,
          animation: 'fadeInScale 1.2s ease-out',
        }}>
          <div style={{
            width: 200,
            height: 200,
            margin: '0 auto',
            position: 'relative',
          }}>
            {/* Glow background */}
            <div style={{
              position: 'absolute',
              inset: -20,
              background: 'radial-gradient(circle, rgba(247,147,26,0.3) 0%, transparent 70%)',
              borderRadius: '50%',
              animation: 'pulse 3s ease-in-out infinite',
            }}/>
            
            {/* Logo */}
            <img 
              src="/assets/logo.png" 
              alt="BitSavers EduHub" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                position: 'relative',
                zIndex: 1,
                filter: 'drop-shadow(0 0 30px rgba(247,147,26,0.5))',
              }}
            />
          </div>
        </div>

        {/* Brand name */}
        <div style={{
          animation: 'fadeInUp 1s ease-out 0.4s both',
        }}>
          <h1 style={{
            fontSize: 44,
            fontWeight: 900,
            color: '#fff',
            marginBottom: 12,
            letterSpacing: '0.02em',
            textShadow: '0 0 40px rgba(247,147,26,0.3)',
          }}>
            BitSavers
          </h1>
          <p style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#F7931A',
            letterSpacing: 4,
            marginBottom: 8,
          }}>
            EDUHUB ACADEMY
          </p>
          <p style={{
            fontSize: 13,
            color: '#666',
            fontFamily: 'monospace',
            letterSpacing: 1,
          }}>
            Bitcoin Education Platform
          </p>
        </div>

        {/* Loading indicator */}
        <div style={{
          marginTop: 60,
          animation: 'fadeInUp 1s ease-out 0.8s both',
        }}>
          {/* Progress bar */}
          <div style={{
            width: 200,
            height: 3,
            background: '#222',
            borderRadius: 10,
            margin: '0 auto',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, #F7931A, #ff9d3a)',
              borderRadius: 10,
              animation: 'loading 2.5s ease-in-out',
              boxShadow: '0 0 10px rgba(247,147,26,0.5)',
            }}/>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes fadeInScale {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          60% {
            transform: scale(1.05);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes fadeInUp {
          0% {
            opacity: 0;
            transform: translateY(30px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }
        
        @keyframes loading {
          0% {
            width: 0%;
          }
          100% {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
