{/* CSS Logo instead of image */}
      <div style={{
        width: 'min(200px, 60vw)',
        height: 'min(200px, 60vw)',
        marginBottom: 32,
        animation: 'fadeInUp 0.8s ease-out both',
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Outer circle */}
        <div style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          border: '8px solid #F7931A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle, rgba(247,147,26,0.1) 0%, transparent 70%)',
          position: 'relative',
          boxShadow: '0 0 60px rgba(247,147,26,0.4)',
        }}>
          {/* Bitcoin symbol */}
          <div style={{
            fontSize: 'clamp(60px, 15vw, 100px)',
            fontWeight: 900,
            color: '#F7931A',
            fontFamily: 'Arial, sans-serif',
          }}>₿</div>
          
          {/* Graduation caps (top left and right) */}
          <div style={{
            position: 'absolute',
            top: '15%',
            left: '10%',
            fontSize: 'clamp(20px, 5vw, 32px)',
          }}>🎓</div>
          <div style={{
            position: 'absolute',
            top: '15%',
            right: '10%',
            fontSize: 'clamp(20px, 5vw, 32px)',
          }}>🎓</div>
        </div>
      </div>
