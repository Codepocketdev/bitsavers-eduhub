export default function Intro({ onNavigate }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#080808',
      color: '#F0EBE0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 5%',
      position: 'relative',
    }}>

      {/* Grid background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(247,147,26,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(247,147,26,0.02) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        opacity: 0.3,
      }}/>

      <div style={{
        maxWidth: 800,
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* Logo */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            width: 120,
            height: 120,
            margin: '0 auto 20px',
            background: '#F7931A',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 60,
            fontWeight: 900,
            color: '#080808',
            boxShadow: '0 0 40px rgba(247,147,26,0.4)',
          }}>₿</div>

          <h1 style={{
            fontSize: 'clamp(28px, 6vw, 42px)',
            fontWeight: 900,
            color: '#fff',
            marginBottom: 8,
          }}>
            BITSAVERS EDUHUB
          </h1>

          <p style={{
            fontSize: 14,
            color: '#F7931A',
            fontWeight: 600,
            letterSpacing: 3,
          }}>
            AFRICA'S BITCOIN UNIVERSITY
          </p>
        </div>

        {/* Mission Statement */}
        <div style={{
          background: 'rgba(17,17,17,0.6)',
          border: '1px solid rgba(247,147,26,0.2)',
          borderRadius: 16,
          padding: 40,
          marginBottom: 50,
        }}>
          <h2 style={{
            fontSize: 'clamp(20px, 4vw, 28px)',
            fontWeight: 800,
            color: '#F7931A',
            marginBottom: 20,
          }}>
            Our Mission
          </h2>
          <p style={{
            fontSize: 'clamp(15px, 3vw, 18px)',
            color: '#ccc',
            lineHeight: 1.8,
            marginBottom: 30,
          }}>
            To empower every African with Bitcoin knowledge and financial sovereignty.
            We believe education is the path to freedom, and Bitcoin is the tool
            that makes freedom possible.
          </p>

          <h2 style={{
            fontSize: 'clamp(20px, 4vw, 28px)',
            fontWeight: 800,
            color: '#F7931A',
            marginBottom: 20,
          }}>
            Our Vision
          </h2>
          <p style={{
            fontSize: 'clamp(15px, 3vw, 18px)',
            color: '#ccc',
            lineHeight: 1.8,
          }}>
            A financially literate Africa where every person understands Bitcoin,
            controls their money, and participates in the global digital economy
            on their own terms.
          </p>
        </div>

        {/* Programs */}
        <div style={{ marginBottom: 50 }}>
          <h2 style={{
            fontSize: 'clamp(20px, 4vw, 28px)',
            fontWeight: 800,
            color: '#fff',
            marginBottom: 30,
          }}>
            What We Offer
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 20,
          }}>
            {[
              {
                title: 'Expert-Led Courses',
                desc: 'Learn from Bitcoin developers, miners, and educators'
              },
              {
                title: 'Live Community',
                desc: 'Connect with thousands of Bitcoin students across Africa'
              },
              {
                title: 'University Partnerships',
                desc: 'Recognized programs with leading African universities'
              },
              {
                title: 'Forever Free',
                desc: 'No subscriptions, no hidden fees. Bitcoin education for all.'
              },
            ].map((item, i) => (
              <div key={i} style={{
                background: 'rgba(17,17,17,0.6)',
                border: '1px solid rgba(247,147,26,0.2)',
                borderRadius: 12,
                padding: 24,
                textAlign: 'center',
              }}>
                <h3 style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#F7931A',
                  marginBottom: 8,
                }}>
                  {item.title}
                </h3>
                <p style={{
                  fontSize: 13,
                  color: '#999',
                  lineHeight: 1.6,
                }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div>
          <p style={{
            fontSize: 15,
            color: '#999',
            marginBottom: 24,
          }}>
            Ready to start your Bitcoin journey?
          </p>

          <div style={{
            display: 'flex',
            gap: 16,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}>
            <button onClick={() => onNavigate && onNavigate('login')} style={{
              background: 'transparent',
              border: '2px solid rgba(247,147,26,0.4)',
              color: '#F0EBE0',
              padding: '16px 40px',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer',
            }}>
              Login
            </button>

            <button onClick={() => onNavigate && onNavigate('signup')} style={{
              background: '#F7931A',
              border: 'none',
              color: '#080808',
              padding: '18px 40px',
              borderRadius: 12,
              fontWeight: 900,
              fontSize: 16,
              cursor: 'pointer',
              boxShadow: '0 4px 30px rgba(247,147,26,0.4)',
            }}>
              Create Account
            </button>
          </div>

          <p style={{
            fontSize: 12,
            color: '#666',
            marginTop: 20,
            fontFamily: 'monospace',
          }}>
            Free forever - No credit card required
          </p>
        </div>
      </div>
    </div>
  )
}
