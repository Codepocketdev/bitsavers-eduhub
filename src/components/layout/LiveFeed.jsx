import { useState, useEffect } from 'react'
import NDK, { NDKEvent } from '@nostr-dev-kit/ndk'

export default function LiveFeed() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Initialize NDK
    const ndk = new NDK({
      explicitRelayUrls: [
        'wss://relay.damus.io',
        'wss://nos.lol',
        'wss://relay.snort.social',
      ]
    })

    const connectAndSubscribe = async () => {
      try {
        await ndk.connect()
        
        // Subscribe to recent notes about Bitcoin/Education
        const filter = {
          kinds: [1], // Text notes
          limit: 20,
          '#t': ['bitcoin', 'education', 'nostr'] // Posts with these hashtags
        }

        const sub = ndk.subscribe(filter, { closeOnEose: false })

        sub.on('event', (event) => {
          setEvents(prev => {
            // Prevent duplicates
            if (prev.some(e => e.id === event.id)) return prev
            // Add new event and keep only last 20
            return [event, ...prev].slice(0, 20)
          })
          setLoading(false)
        })

        sub.on('eose', () => {
          setLoading(false)
        })

      } catch (error) {
        console.error('NDK connection error:', error)
        setLoading(false)
      }
    }

    connectAndSubscribe()
  }, [])

  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000)
    const now = new Date()
    const diff = Math.floor((now - date) / 1000)

    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  const shortenPubkey = (pubkey) => {
    return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`
  }

  return (
    <section style={{
      padding: '80px 5% 100px',
      background: '#080808',
      position: 'relative',
    }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 50, maxWidth: 800, margin: '0 auto 50px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
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
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#4ade80',
            boxShadow: '0 0 10px #4ade80',
            animation: 'pulse 2s infinite',
          }}/>
          Live from Nostr
        </div>
        
        <h2 style={{
          fontSize: 'clamp(32px, 6vw, 48px)',
          fontWeight: 900,
          color: '#fff',
          marginBottom: 16,
          lineHeight: 1.1,
        }}>
          The Conversation is <span style={{ color: '#F7931A' }}>Happening Now</span>
        </h2>
        
        <p style={{
          fontSize: 16,
          color: '#999',
          lineHeight: 1.7,
        }}>
          Real Bitcoin educators and students sharing knowledge across the Nostr network
        </p>
      </div>

      {/* Feed Container */}
      <div style={{
        maxWidth: 900,
        margin: '0 auto',
        background: '#0a0a0a',
        border: '1px solid rgba(247,147,26,0.2)',
        borderRadius: 16,
        overflow: 'hidden',
      }}>
        
        {/* Feed Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(247,147,26,0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#111',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 20 }}>⚡</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Global Feed</div>
              <div style={{ fontSize: 12, color: '#777' }}>
                {events.length} recent posts
              </div>
            </div>
          </div>
          
          <div style={{
            background: 'rgba(74,222,128,0.15)',
            border: '1px solid rgba(74,222,128,0.3)',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 700,
            color: '#4ade80',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#4ade80',
              animation: 'pulse 2s infinite',
            }}/>
            LIVE
          </div>
        </div>

        {/* Feed Content */}
        <div style={{
          maxHeight: 600,
          overflowY: 'auto',
          padding: 20,
        }}>
          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#777',
            }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>⚡</div>
              <div style={{ fontSize: 14 }}>Connecting to Nostr relays...</div>
            </div>
          ) : events.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#777',
            }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>🤔</div>
              <div style={{ fontSize: 14 }}>No recent posts found. Check back soon!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {events.map((event) => (
                <div key={event.id} style={{
                  background: '#111',
                  border: '1px solid rgba(247,147,26,0.15)',
                  borderRadius: 12,
                  padding: 18,
                  transition: 'all 0.3s',
                }}>
                  {/* Author */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 12,
                  }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #F7931A, #ff9d3a)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 16,
                      color: '#080808',
                    }}>
                      {event.pubkey.slice(0, 2).toUpperCase()}
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: '#fff',
                        fontFamily: 'monospace',
                      }}>
                        {shortenPubkey(event.pubkey)}
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: '#777',
                      }}>
                        {formatTime(event.created_at)}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <p style={{
                    fontSize: 14,
                    color: '#ccc',
                    lineHeight: 1.6,
                    margin: 0,
                    wordBreak: 'break-word',
                  }}>
                    {event.content.length > 280 
                      ? event.content.slice(0, 280) + '...' 
                      : event.content}
                  </p>

                  {/* Tags */}
                  {event.tags.filter(t => t[0] === 't').length > 0 && (
                    <div style={{
                      marginTop: 12,
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}>
                      {event.tags
                        .filter(t => t[0] === 't')
                        .slice(0, 3)
                        .map((tag, i) => (
                          <span key={i} style={{
                            background: 'rgba(247,147,26,0.1)',
                            border: '1px solid rgba(247,147,26,0.25)',
                            padding: '4px 10px',
                            borderRadius: 12,
                            fontSize: 11,
                            color: '#F7931A',
                            fontWeight: 600,
                          }}>
                            #{tag[1]}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div style={{
          padding: 24,
          borderTop: '1px solid rgba(247,147,26,0.2)',
          textAlign: 'center',
          background: '#111',
        }}>
          <p style={{ fontSize: 14, color: '#999', marginBottom: 16 }}>
            Join the conversation. Your voice matters.
          </p>
          <button style={{
            background: '#F7931A',
            border: 'none',
            color: '#080808',
            padding: '12px 32px',
            borderRadius: 10,
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(247,147,26,0.3)',
          }}>
            Start Posting on Nostr →
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </section>
  )
}

