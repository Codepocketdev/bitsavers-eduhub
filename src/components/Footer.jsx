import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Twitter, Send, Youtube, Github, Instagram, Facebook, Linkedin, Mail, MapPin } from 'lucide-react'
import { TikTokIcon, NostrIcon } from './BrandIcons'

const footerLinks = [
  { title: 'Quick Links', links: [
    { label: 'About Us', path: '/about' },
    { label: 'Programs', path: '/programs' },
    { label: 'Team', path: '/team' },
    { label: 'FAQ', path: '/faq' },
  ]},
  { title: 'Programs', links: [
    { label: 'Bitcoin Basics', path: '/programs' },
    { label: 'Lightning Network', path: '/programs' },
    { label: 'Merchant Onboarding', path: '/programs' },
  ]},
]

const socials = [
  { icon: Twitter,     href: 'https://x.com/BitEduhub', label: 'Twitter' },
  { icon: Send,        href: '#', label: 'Telegram' },
  { icon: Youtube,     href: '#', label: 'YouTube' },
  { icon: Github,      href: 'https://github.com/Codepocketdev/bitsavers-eduhub', label: 'GitHub' },
  { icon: Instagram,   href: 'https://www.instagram.com/biteduhub', label: 'Instagram' },
  { icon: Facebook,    href: 'https://www.facebook.com/profile.php?id=61578651988175', label: 'Facebook' },
  { icon: TikTokIcon,  href: 'https://www.tiktok.com/@biteduhub', label: 'TikTok' },
  { icon: Linkedin,    href: 'https://www.linkedin.com/company/bitsavers-eduhub/', label: 'LinkedIn' },
  { icon: NostrIcon,   href: 'https://yakihonne.com/profile/nprofile1qqsf49usnyrpjufc6dyf2jwe632wtsfms0cr5rcvk9rhjaj5jnunfaqzqqpsgqqqqqqqlpuxlp', label: 'Nostr' },
]

export default function Footer() {
  return (
    <footer className="bg-dark-900 dark:bg-dark-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Link to="/" className="flex items-center gap-3 mb-5">
              <img src="/images/logo.jpeg" alt="Bitsavers" className="w-10 h-10 rounded-full border-2 border-orange-500" />
              <span className="font-bold text-lg">Bitsavers EduHub</span>
            </Link>
            <p className="text-dark-400 text-sm leading-relaxed mb-6">
              Empowering Africa through Bitcoin education, adoption, and innovation.
            </p>
            <div className="flex flex-wrap gap-3">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target={social.href !== '#' ? '_blank' : undefined}
                  rel={social.href !== '#' ? 'noopener noreferrer' : undefined}
                  aria-label={social.label}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-orange-500 transition-all hover:-translate-y-1"
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </motion.div>

          {/* Link columns */}
          {footerLinks.map((col) => (
            <motion.div
              key={col.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h4 className="font-bold text-sm uppercase tracking-wider mb-5">{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.path} className="text-dark-400 hover:text-orange-500 text-sm transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}

          {/* Contact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h4 className="font-bold text-sm uppercase tracking-wider mb-5">Contact</h4>
            <div className="space-y-3">
              <p className="flex items-center gap-3 text-dark-400 text-sm">
                <Mail className="w-4 h-4 text-orange-500" />
                info@biteduhub.com
              </p>
              <p className="flex items-center gap-3 text-dark-400 text-sm">
                <MapPin className="w-4 h-4 text-orange-500" />
                Nairobi, Kenya
              </p>
            </div>
          </motion.div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-dark-500 text-sm">&copy; {new Date().getFullYear()} Bitsavers EduHub. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
