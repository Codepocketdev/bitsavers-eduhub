import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, Building2, X } from 'lucide-react'
import partners from '../data/partners.json'

function normalizeUrl(url) {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function Logo({ item, className }) {
  const [broken, setBroken] = useState(false)

  if (!item.logo || broken) {
    return (
      <div className={`${className} bg-orange-500/10 flex items-center justify-center`}>
        <Building2 className="w-1/3 h-1/3 text-orange-500" />
      </div>
    )
  }

  return (
    <img
      src={item.logo}
      alt={item.name}
      className={`${className} object-cover`}
      onError={() => setBroken(true)}
      loading="lazy"
    />
  )
}

function Group({ title, subtitle, items, onSelect }) {
  if (!items || items.length === 0) return null
  return (
    <div className="mb-20 last:mb-0">
      <div className="text-center mb-12">
        <h2 className="text-2xl md:text-3xl font-extrabold text-dark-900 dark:text-white mb-2">{title}</h2>
        <p className="text-gray-500 dark:text-dark-400 text-sm">{subtitle}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-x-10 gap-y-12">
        {items.map((item, i) => (
          <motion.button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="group w-40 sm:w-48 flex flex-col items-center text-center"
          >
            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-white mb-4 transition-transform duration-300 group-hover:scale-105">
              <Logo item={item} className="w-full h-full" />
            </div>
            <span className="font-bold text-dark-900 dark:text-white group-hover:text-orange-500 transition-colors">
              {item.name}
            </span>
            {item.description && (
              <span className="mt-1 text-sm text-gray-500 dark:text-dark-400 leading-relaxed line-clamp-2">
                {item.description}
              </span>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function DetailModal({ item, onClose }) {
  const link = normalizeUrl(item.url)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 overflow-y-auto bg-black/80 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-dark-900 border border-dark-800 rounded-2xl w-full max-w-sm p-6 relative max-h-[calc(100vh-2rem)] overflow-y-auto"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-dark-800 flex items-center justify-center text-dark-300 hover:bg-dark-700 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center gap-4 pt-2">
          <div className="w-28 h-28 rounded-2xl overflow-hidden bg-white">
            <Logo item={item} className="w-full h-full" />
          </div>
          <div>
            <div className="font-extrabold text-xl text-white mb-2">{item.name}</div>
            {item.description && (
              <div className="text-sm text-dark-300 leading-relaxed">{item.description}</div>
            )}
          </div>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-xl transition-all"
            >
              Visit Website <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function Sponsors() {
  const [selected, setSelected] = useState(null)
  const sponsors = partners.sponsors || []
  const collaborators = partners.collaborators || []
  const empty = sponsors.length === 0 && collaborators.length === 0

  return (
    <div className="pt-24">
      <section className="bg-gradient-to-br from-dark-900 to-dark-800 py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="inline-block bg-orange-500/15 text-orange-300 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
          >
            Our Partners
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-extrabold text-white mb-6"
          >
            Sponsors &amp; Collaborators
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-white/70 text-lg max-w-2xl mx-auto"
          >
            The organizations that make Bitcoin education in Africa possible.
          </motion.p>
        </div>
      </section>

      <section className="py-24 bg-gray-50 dark:bg-dark-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {empty ? (
            <p className="text-center text-gray-500 dark:text-dark-400">Partners coming soon.</p>
          ) : (
            <>
              <Group
                title="Sponsors"
                subtitle="Backing our programs and events"
                items={sponsors}
                onSelect={setSelected}
              />
              <Group
                title="Collaborators"
                subtitle="Building alongside us"
                items={collaborators}
                onSelect={setSelected}
              />
            </>
          )}
        </div>
      </section>

      <AnimatePresence>
        {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  )
}
