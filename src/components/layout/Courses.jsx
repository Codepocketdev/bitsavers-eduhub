export default function Courses() {
  const courses = [
    {
      level: 'Beginner',
      title: 'Bitcoin Fundamentals',
      description: 'Start from zero. Learn what Bitcoin is, how it works, and why it matters for Africa.',
      modules: 24,
      duration: '6 weeks',
      color: '#10b981',
      topics: ['What is Money?', 'Bitcoin Basics', 'Wallets & Keys', 'Sending & Receiving'],
    },
    {
      level: 'Intermediate',
      title: 'Lightning Network',
      description: 'Master instant Bitcoin payments. Build and operate Lightning nodes.',
      modules: 18,
      duration: '4 weeks',
      color: '#F7931A',
      topics: ['Payment Channels', 'Routing', 'Node Setup', 'Channel Management'],
    },
    {
      level: 'Advanced',
      title: 'Bitcoin Development',
      description: 'Build on Bitcoin. Create wallets, integrate APIs, and contribute to open source.',
      modules: 32,
      duration: '10 weeks',
      color: '#8b5cf6',
      topics: ['Bitcoin Core', 'Script', 'APIs & Libraries', 'Security'],
    },
  ]

  return (
    <section style={{
      padding: '100px 5%',
      background: '#0a0a0a',
      position: 'relative',
    }}>
      
      {/* Section Header */}
      <div style={{ textAlign: 'center', marginBottom: 70 }}>
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
          Learning Paths
        </div>
        <h2 style={{
          fontSize: 'clamp(32px, 6vw, 54px)',
          fontWeight: 900,
          color: '#fff',
          marginBottom: 20,
          lineHeight: 1.1,
        }}>
          Choose Your <span style={{ color: '#F7931A' }}>Bitcoin Journey</span>
        </h2>
        <p style={{
          fontSize: 18,
          color: '#999',
          maxWidth: 700,
          margin: '0 auto',
          lineHeight: 1.7,
        }}>
          Structured courses that take you from curious beginner to confident Bitcoiner.
        </p>
      </div>

      {/* Courses Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 28,
        maxWidth: 1200,
        margin: '0 auto',
      }}>
        {courses.map((course, i) => (
          <div key={i} style={{
            background: '#111',
            border: '1px solid rgba(247,147,26,0.2)',
            borderRadius: 18,
            padding: 32,
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.3s',
          }}>
            {/* Colored accent bar */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: `linear-gradient(90deg, ${course.color}, transparent)`,
            }}/>

            {/* Level badge */}
            <div style={{
              display: 'inline-block',
              background: `${course.color}22`,
              border: `1px solid ${course.color}44`,
              borderRadius: 20,
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 700,
              color: course.color,
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginBottom: 20,
            }}>
              {course.level}
            </div>

            <h3 style={{
              fontSize: 26,
              fontWeight: 900,
              color: '#fff',
              marginBottom: 14,
              lineHeight: 1.2,
            }}>
              {course.title}
            </h3>

            <p style={{
              fontSize: 15,
              color: '#aaa',
              lineHeight: 1.7,
              marginBottom: 24,
            }}>
              {course.description}
            </p>

            {/* Meta info */}
            <div style={{
              display: 'flex',
              gap: 20,
              marginBottom: 24,
              paddingBottom: 24,
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div>
                <div style={{ fontSize: 11, color: '#777', marginBottom: 4, fontWeight: 600 }}>MODULES</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{course.modules}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#777', marginBottom: 4, fontWeight: 600 }}>DURATION</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{course.duration}</div>
              </div>
            </div>

            {/* Topics */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, color: '#777', marginBottom: 12, fontWeight: 600 }}>
                WHAT YOU'LL LEARN
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {course.topics.map((topic, j) => (
                  <div key={j} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                    color: '#ccc',
                  }}>
                    <div style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: course.color,
                      boxShadow: `0 0 8px ${course.color}`,
                    }}/>
                    {topic}
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Button */}
            <button style={{
              width: '100%',
              background: 'transparent',
              border: `2px solid ${course.color}44`,
              color: course.color,
              padding: '14px',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.3s',
            }}>
              Start Learning →
            </button>
          </div>
        ))}
      </div>

      {/* Additional courses */}
      <div style={{
        marginTop: 60,
        textAlign: 'center',
        padding: '40px 30px',
        background: 'rgba(17,17,17,0.4)',
        border: '1px solid rgba(247,147,26,0.15)',
        borderRadius: 16,
        maxWidth: 900,
        margin: '60px auto 0',
      }}>
        <h4 style={{
          fontSize: 20,
          fontWeight: 800,
          color: '#fff',
          marginBottom: 12,
        }}>
          + 15 More Specialized Courses
        </h4>
        <p style={{ fontSize: 14, color: '#999', marginBottom: 20 }}>
          Mining, Security, Economics, Philosophy, History, and more.
        </p>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 10,
        }}>
          {['Bitcoin Mining', 'Austrian Economics', 'Hardware Wallets', 'Multisig', 'Privacy', 'Proof of Work'].map((topic) => (
            <span key={topic} style={{
              background: 'rgba(247,147,26,0.1)',
              border: '1px solid rgba(247,147,26,0.25)',
              padding: '8px 16px',
              borderRadius: 20,
              fontSize: 12,
              color: '#F0EBE0',
              fontWeight: 600,
            }}>
              {topic}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

