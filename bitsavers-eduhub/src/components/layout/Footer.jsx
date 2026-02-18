export default function Footer() {
  return (
    <footer style={{
      padding: '28px 5%',
      borderTop: '1px solid rgba(247,147,26,0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 16,
      background: '#0a0a0a',
    }}>
      <div style={{ fontSize: 13, color: '#555' }}>
        © 2026 Bitsavers EduHub Academy · Kenya
      </div>
      <div style={{ fontSize: 13, color: '#555' }}>
        Built on Bitcoin ₿ · Powered by Nostr ⚡
      </div>
    </footer>
  )
}
