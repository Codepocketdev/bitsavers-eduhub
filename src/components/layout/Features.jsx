export default function Features() {
  return (
    <section style={{
      padding: '100px 5%',
      background: '#080808',
      position: 'relative',
    }}>
      
      {/* Section Header */}
      <div style={{ textAlign: 'center', marginBottom: 70, maxWidth: 800, margin: '0 auto 70px' }}>
        <div style={{
          display: 'inline-block',
          background: 'rgba(247,147,26,0.12)',
          border: '1px solid rgba(247,147,26,0.3)',
          borderRadius: 20,
          padding: '6px 18px',
          fontSize: 11,
          fontWeight: 700,
          color: '#F7931A',
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginBottom: 24,
        }}>
          Why BitSavers EduHub
        </div>
        <h2 style={{
          fontSize: 'clamp(32px, 6vw, 54px)',
          fontWeight: 900,
          color: '#fff',
          marginBottom: 20,
          lineHeight: 1.1,
        }}>
          Learn Bitcoin the <span style={{ color: '#F7931A' }}>Right Way</span>
        </h2>
        <p style={{
          fontSize: 18,
          color: '#999',
          lineHeight: 1.7,
        }}>
          No paywalls. No corporate BS. Just pure Bitcoin education built on freedom tech.
        </p>
      </div>

      {/* Features Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 24,
        maxWidth: 1200,
        margin: '0 auto',
      }}>
        {[
          {
            icon: '⚡',
            title: 'Nostr-Native Platform',
            description: 'Your identity, your keys, your data. Login with Nostr and own your educational journey.',
            highlight: 'Decentralized',
          },
          {
            icon: '🎓',
            title: 'Expert Instructors',
            description: 'Learn from Bitcoin developers, miners, and educators actively working in the space.',
            highlight: 'Real Experience',
          },
          {
            icon: '🌍',
            title: 'Africa-Focused Curriculum',
            description: 'Content tailored for African students with real-world use cases and local context.',
            highlight: 'Relevant',
          },
          {
            icon: '💬',
            title: 'Live Community',
            description: 'Connect with fellow students via Nostr channels. Ask questions, share knowledge, collaborate.',
            highlight: 'Always Online',
          },
          {
            icon: '📚',
            title: 'Comprehensive Content',
            description: 'From Bitcoin basics to Lightning Network development. Beginner to advanced tracks.',
            highlight: '150+ Lessons',
          },
          {
            icon: '🔓',
            title: '100% Free Forever',
            description: 'No subscriptions. No hidden fees. Education should be accessible to everyone.',
            highlight: 'Always Free',
          },
        ].map((feature, i) => (
          <div key={i} style={{
            background: '#111',
            border: '1px solid rgba(247,147,26,0.2)',
            borderRadius: 16,
            padding: 32,
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.3s',
          }}>
            {/* Top accent */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              background: 'linear-gradient(90deg, #F7931A, transparent)',
            }}/>

            {/* Highlight badge */}
            <div style={{
              position: 'absolute',
              top: 20,
              right: 20,
              background: 'rgba(247,147,26,0.15)',
              border: '1px solid rgba(247,147,26,0.3)',
              borderRadius: 20,
              padding: '4px 12px',
              fontSize: 10,
              fontWeight: 700,
              color: '#F7931A',
              letterSpacing: 1,
            }}>
              {feature.highlight}
            </div>

            <div style={{ fontSize: 42, marginBottom: 20 }}>{feature.icon}</div>
            
            <h3 style={{
              fontSize: 20,
              fontWeight: 800,
              color: '#fff',
              marginBottom: 12,
              lineHeight: 1.3,
            }}>
              {feature.title}
            </h3>
            
            <p style={{
              fontSize: 14,
              color: '#999',
              lineHeight: 1.7,
            }}>
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div style={{
        textAlign: 'center',
        marginTop: 70,
        padding: '50px 30px',
        background: 'rgba(17,17,17,0.6)',
        border: '1px solid rgba(247,147,26,0.2)',
        borderRadius: 20,
        maxWidth: 800,
        margin: '70px auto 0',
      }}>
        <h3 style={{
          fontSize: 28,
          fontWeight: 800,
          color: '#fff',
          marginBottom: 16,
        }}>
          Ready to Stack Sats <em>and</em> Knowledge?
        </h3>
        <p style={{
          fontSize: 16,
          color: '#999',
          marginBottom: 28,
        }}>
          Join 2,400+ students learning Bitcoin the sovereign way.
        </p>
        <button style={{
          background: '#F7931A',
          border: 'none',
          color: '#080808',
          padding: '16px 40px',
          borderRadius: 10,
          fontWeight: 800,
          fontSize: 16,
          cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(247,147,26,0.3)',
        }}>
          Get Started Free →
        </button>
      </div>
    </section>
  )
}

