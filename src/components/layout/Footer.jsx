import { Twitter, Instagram, Facebook, Linkedin, Github, Zap, Globe } from 'lucide-react'

const SOCIALS = [
  { label: 'X / Twitter', icon: <Twitter size={18} />, url: 'https://x.com/BitEduhub' },
  { label: 'Instagram',   icon: <Instagram size={18} />, url: 'https://www.instagram.com/biteduhub?igsh=MXZ1emltMmtzNWVwMA==' },
  { label: 'Facebook',    icon: <Facebook size={18} />, url: 'https://www.facebook.com/profile.php?id=61578651988175' },
  { label: 'TikTok',      icon: <Globe size={18} />, url: 'https://www.tiktok.com/@biteduhub?_r=1&_t=ZS-944tkcWSkKH' },
  { label: 'LinkedIn',    icon: <Linkedin size={18} />, url: 'https://www.linkedin.com/company/bitsavers-eduhub/' },
  { label: 'GitHub',      icon: <Github size={18} />, url: 'https://github.com/Codepocketdev/bitsavers-eduhub' },
  { label: 'Nostr',       icon: <Zap size={18} />, url: 'https://yakihonne.com/profile/nprofile1qqsf49usnyrpjufc6dyf2jwe632wtsfms0cr5rcvk9rhjaj5jnunfaqzqqpsgqqqqqqqlpuxlp' },
]

export default function Footer() {
  return (
    <footer style={{
      padding: '28px 5%',
      borderTop: '1px solid rgba(247,147,26,0.1)',
      background: '#0a0a0a',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 22 }}>
        {SOCIALS.map(s => (
          <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" title={s.label}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 42, height: 42, borderRadius: '50%',
              background: 'rgba(247,147,26,0.08)',
              border: '1px solid rgba(247,147,26,0.18)',
              color: '#F7931A', textDecoration: 'none',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(247,147,26,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(247,147,26,0.08)'}
          >
            {s.icon}
          </a>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 13, color: '#555' }}>© 2026 Bitsavers EduHub Academy · Kenya</div>
        <div style={{ fontSize: 13, color: '#555' }}>Built on Bitcoin ₿ · Powered by Nostr ⚡</div>
      </div>
    </footer>
  )
}

