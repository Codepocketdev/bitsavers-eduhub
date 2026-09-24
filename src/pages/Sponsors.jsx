import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SimplePool } from 'nostr-tools/pool'
import { RefreshCw, ExternalLink, Trophy, Handshake, Building2, X } from 'lucide-react'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const TAG = 'bitsavers-sponsors'

function normalizeUrl(url) {
  if (!url) return url
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function Logo({ item, size = 'w-20 h-20' }) {
  const [broken, setBroken] = useState(false)

  if (!item.logo || broken) {
    return (
      <div className={`${size} rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center`}>
        <Building2 className="w-8 h-8 text-orange-500" />
      </div>
    )
  }

  return (
    <img
      src={item.logo}
      alt={item.name}
      className={`${size} object-contain rounded-xl bg-white p-2`}
      onError={() => setBroken(true)}
    />
  )
}

function Card({ item, i, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: i * 0.05 }}
      className="bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-2xl p-6 flex flex-col items-center text-center gap-3 hover:border-orange-300 dark:hover:border-orange-700 transition-all text-left"
    >
      <Logo item={item} />
      <div>
        <div className="font-bold text-dark-900 dark:text-white mb-1">{item.name}</div>
        {item.description && (
          <div className="text-sm text-gray-500 dark:text-dark-400 leading-relaxed line-clamp-3">{item.description}</div>
        )}
      </div>
    </motion.button>
  )
}

function SectionHeader({ Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-200 dark:border-dark-700">
      <Icon className="w-4 h-4 text-orange-500" />
      <span className="font-bold text-sm text-dark-900 dark:text-white">{title}</span>
    </div>
  )
}

function DetailModal({ item, onClose }) {
  const link = normalizeUrl(item.url)
  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 overflow-y-auto bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-2xl w-full max-w-sm p-6 relative max-h-[calc(100vh-2rem)] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-800 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-dark-700 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center gap-4 pt-2">
          <Logo item={item} size="w-24 h-24" />
          <div>
            <div className="font-extrabold text-xl text-dark-900 dark:text-white mb-2">{item.name}</div>
            {item.description && (
              <div className="text-sm text-gray-500 dark:text-dark-400 leading-relaxed">{item.description}</div>
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
  const [data, setData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bitsavers_sponsors') || '{"sponsors":[],"collaborators":[]}') }
    catch { return { sponsors: [], collaborators: [] } }
  })
  const [fetching, setFetching] = useState(false)
  const [selected, setSelected] = useState(null)

  const fetchData = () => {
    setFetching(true)
    const pool = new SimplePool()
    const seen = new Set()
    let latest = { created_at: 0, data: null }
    let eoseCount = 0

    RELAYS.forEach(relay => {
      const sub = pool.subscribe([relay], { kinds: [1], '#t': [TAG], limit: 10 }, {
        onevent(e) {
          if (seen.has(e.id) || !e.content.startsWith('SPONSORS:')) return
          seen.add(e.id)
          try {
            if (e.created_at > latest.created_at)
              latest = { created_at: e.created_at, data: JSON.parse(e.content.slice('SPONSORS:'.length)) }
          } catch {}
        },
        oneose() {
          sub.close(); eoseCount++
          if (eoseCount >= RELAYS.length) {
            if (latest.data) {
              localStorage.setItem('bitsavers_sponsors', JSON.stringify(latest.data))
              setData(latest.data)
            }
            setFetching(false)
          }
        }
      })
    })
    setTimeout(() => setFetching(false), 8000)
  }

  useEffect(() => { fetchData() }, [])

  const sponsors = data.sponsors?.filter(s => s.name) || []
  const collaborators = data.collaborators?.filter(c => c.name) || []
  const empty = sponsors.length === 0 && collaborators.length === 0 && !fetching

  return (
    <div className="min-h-screen bg-white dark:bg-dark-950 pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 text-orange-500 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider mb-6">
            <Handshake className="w-4 h-4" />
            Partners
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-dark-900 dark:text-white mb-4 leading-tight">
            Our Sponsors &{' '}
            <span className="text-orange-500">Collaborators</span>
          </h1>
          <p className="text-gray-500 dark:text-dark-400 text-base leading-relaxed max-w-xl mx-auto">
            Organizations supporting Bitcoin education across Africa.
          </p>
        </motion.div>

        <div className="flex justify-center mb-10">
          <button
            onClick={fetchData}
            disabled={fetching}
            className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 text-orange-500 px-4 py-2 rounded-full text-sm font-semibold hover:bg-orange-500/20 transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${fetching ? 'animate-spin' : ''}`} />
            {fetching ? 'Syncing…' : 'Refresh'}
          </button>
        </div>

        {sponsors.length > 0 && (
          <div className="mb-12">
            <SectionHeader Icon={Trophy} title="Sponsors" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {sponsors.map((s, i) => <Card key={i} item={s} i={i} onClick={() => setSelected(s)} />)}
            </div>
          </div>
        )}

        {collaborators.length > 0 && (
          <div>
            <SectionHeader Icon={Handshake} title="Collaborators" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {collaborators.map((c, i) => <Card key={i} item={c} i={i} onClick={() => setSelected(c)} />)}
            </div>
          </div>
        )}

        {empty && (
          <div className="text-center py-16 text-gray-400 dark:text-dark-500">
            <Handshake className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <div className="font-bold text-dark-900 dark:text-white mb-1">No partners yet</div>
            <div className="text-sm">Check back soon.</div>
          </div>
        )}

      </div>

      <AnimatePresence>
        {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  )
}
