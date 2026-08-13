import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Copy, Check, X, Loader, Heart } from 'lucide-react'

const LIGHTNING_ADDRESS = 'biteduhub@blink.sv'
const BLINK_LN_URL      = 'https://pay.blink.sv/biteduhub'
const PRESETS           = [100, 1000, 5000, 21000, 100000]

// ── Invoice Modal ─────────────────────────────────────
function InvoiceModal({ invoice, verifyUrl, amount, onClose, onPaid }) {
  const [copied, setCopied] = useState(false)
  const [paid,   setPaid]   = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    if (!verifyUrl) return
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(verifyUrl)
        if (!res.ok) return
        const data = await res.json()
        if (data.settled === true) {
          clearInterval(pollRef.current)
          setPaid(true)
          setTimeout(() => { onPaid?.(); onClose() }, 2500)
        }
      } catch {}
    }, 2000)
    return () => clearInterval(pollRef.current)
  }, [verifyUrl])

  const copy = async () => {
    await navigator.clipboard.writeText(invoice)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && !paid && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-2xl w-full max-w-sm p-6 relative"
      >
        {/* Close */}
        {!paid && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-800 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-dark-700 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {paid ? (
          /* Success screen */
          <div className="text-center py-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 border-2 border-green-500 flex items-center justify-center mx-auto mb-4"
            >
              <Check className="w-8 h-8 text-green-500" />
            </motion.div>
            <div className="text-xl font-extrabold text-green-500 mb-2">Payment Received!</div>
            <div className="text-sm text-gray-500 dark:text-dark-400 mb-3">Thank you for supporting Bitsavers EduHub</div>
            <div className="text-2xl font-extrabold text-orange-500">{amount.toLocaleString()} sats</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-orange-500/30">
                <Zap className="w-6 h-6 text-white fill-white" />
              </div>
              <div className="text-xl font-extrabold text-dark-900 dark:text-white">{amount.toLocaleString()} sats</div>
              <div className="text-sm text-gray-500 dark:text-dark-400">Scan with any Lightning wallet</div>
            </div>

            {/* QR */}
            <div className="bg-white rounded-xl p-3 mb-4 flex justify-center border border-gray-100">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(invoice)}&bgcolor=ffffff&color=1a1410&margin=8`}
                alt="Lightning Invoice QR"
                className="w-52 h-52 rounded-lg"
              />
            </div>

            {/* Waiting indicator */}
            {verifyUrl && (
              <div className="flex items-center justify-center gap-2 mb-4 px-3 py-2 bg-orange-500/5 border border-orange-500/20 rounded-lg">
                <Loader className="w-3 h-3 text-orange-500 animate-spin" />
                <span className="text-xs text-gray-500 dark:text-dark-400">Waiting for payment…</span>
              </div>
            )}

            {/* Invoice string */}
            <div className="bg-gray-50 dark:bg-dark-950 border border-gray-200 dark:border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-400 break-all leading-relaxed mb-4">
              {invoice.slice(0, 80)}…
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mb-4">
              <button
                onClick={copy}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all border ${
                  copied
                    ? 'bg-green-50 border-green-300 text-green-600 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400'
                    : 'bg-orange-500/10 border-orange-500/30 text-orange-500 hover:bg-orange-500/20'
                }`}
              >
                {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
              </button>
              <a
                href={`lightning:${invoice}`}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all"
              >
                <Zap className="w-4 h-4 fill-white" /> Open Wallet
              </a>
            </div>

            <div className="text-center">
              <a
                href={BLINK_LN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-400 hover:text-orange-500 transition-colors"
              >
                Or pay directly on Blink →
              </a>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}

// ── Main Donate Page ──────────────────────────────────
export default function Donate() {
  const [amount,    setAmount]    = useState(1000)
  const [loading,   setLoading]   = useState(false)
  const [invoice,   setInvoice]   = useState('')
  const [verifyUrl, setVerifyUrl] = useState('')
  const [error,     setError]     = useState('')
  const [showModal, setShowModal] = useState(false)

  const fetchInvoice = async () => {
    setLoading(true); setError('')
    try {
      const [user, domain] = LIGHTNING_ADDRESS.split('@')
      const metaRes = await fetch(`https://${domain}/.well-known/lnurlp/${user}`)
      if (!metaRes.ok) throw new Error('Could not reach Lightning address')
      const meta  = await metaRes.json()
      const msats = amount * 1000
      if (msats < meta.minSendable || msats > meta.maxSendable)
        throw new Error(`Amount must be between ${meta.minSendable/1000}–${meta.maxSendable/1000} sats`)
      const invRes  = await fetch(`${meta.callback}?amount=${msats}`)
      if (!invRes.ok) throw new Error('Could not get invoice')
      const invData = await invRes.json()
      if (invData.status === 'ERROR') throw new Error(invData.reason)
      setInvoice(invData.pr)
      if (invData.verify) setVerifyUrl(invData.verify)
      setShowModal(true)
    } catch(e) {
      setError(e.message || 'Failed to get invoice')
    }
    setLoading(false)
  }

  const handleClose = () => { setShowModal(false); setInvoice(''); setVerifyUrl('') }

  return (
    <div className="min-h-screen bg-white dark:bg-dark-950 pt-24 pb-16">
      <div className="max-w-lg mx-auto px-4 sm:px-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 text-orange-500 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider mb-6">
            <Heart className="w-4 h-4 fill-orange-500" />
            Support Bitsavers EduHub
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-dark-900 dark:text-white mb-4 leading-tight">
            Fund Bitcoin{' '}
            <span className="text-orange-500">Education</span>
          </h1>
          <p className="text-gray-500 dark:text-dark-400 text-base leading-relaxed">
            Help us keep Bitcoin education free across Africa. Every sat counts.
          </p>
        </motion.div>

        {/* Donate card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-2xl p-6"
        >
          {/* Preset pills */}
          <div className="flex flex-wrap gap-2 mb-6 justify-center">
            {PRESETS.map(p => (
              <button
                key={p}
                onClick={() => setAmount(p)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                  amount === p
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-600 text-gray-600 dark:text-dark-300 hover:border-orange-300'
                }`}
              >
                {p.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Amount display */}
          <div className="text-center mb-4">
            <span className="text-5xl font-extrabold text-dark-900 dark:text-white">{amount.toLocaleString()}</span>
            <span className="text-lg font-semibold text-gray-400 dark:text-dark-400 ml-2">sats</span>
          </div>

          {/* Slider */}
          <div className="mb-6">
            <input
              type="range"
              min={1}
              max={1000000}
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-400 dark:text-dark-500 mt-1">
              <span>1 sat</span>
              <span>1,000,000 sats</span>
            </div>
          </div>

          {/* Custom input */}
          <div className="relative mb-6">
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(Math.max(1, Number(e.target.value)))}
              className="w-full bg-white dark:bg-dark-800 border-2 border-gray-200 dark:border-dark-600 focus:border-orange-500 rounded-xl px-5 py-4 text-center text-xl font-bold text-dark-900 dark:text-white outline-none transition-all pr-16"
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 dark:text-dark-500">SATS</span>
          </div>

          {/* Lightning address */}
          <div className="flex items-center justify-center gap-2 mb-6 px-4 py-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
            <Zap className="w-4 h-4 text-orange-500 fill-orange-500 flex-shrink-0" />
            <span className="font-mono text-sm text-gray-600 dark:text-dark-300">{LIGHTNING_ADDRESS}</span>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Pay button */}
          <button
            onClick={fetchInvoice}
            disabled={loading || amount < 1}
            className="w-full flex items-center justify-center gap-2 py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-orange-500/25"
          >
            {loading
              ? <><Loader className="w-5 h-5 animate-spin" /> Getting invoice…</>
              : <><Zap className="w-5 h-5 fill-white" /> Pay {amount.toLocaleString()} sats</>
            }
          </button>
        </motion.div>

      </div>

      {/* Invoice Modal */}
      <AnimatePresence>
        {showModal && invoice && (
          <InvoiceModal
            invoice={invoice}
            verifyUrl={verifyUrl}
            amount={amount}
            onClose={handleClose}
            onPaid={() => console.log('Paid!')}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

