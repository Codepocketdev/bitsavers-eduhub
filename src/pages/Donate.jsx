import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Copy, Check, Loader, ArrowRight, ArrowLeft } from 'lucide-react'

const LIGHTNING_ADDRESS = 'biteduhub@blink.sv'
const BLINK_LN_URL      = 'https://pay.blink.sv/biteduhub'

const MIN_SATS = 100
const MAX_SATS = 1000000

// Slider is logarithmic: 100 sats at the left, 1,000,000 at the right
const posToSats = (pos) => {
  const raw = Math.pow(10, 2 + (pos / 100) * 4)
  const mag = Math.pow(10, Math.floor(Math.log10(raw)) - 1)
  return Math.min(MAX_SATS, Math.max(MIN_SATS, Math.round(raw / mag) * mag))
}
const satsToPos = (sats) => {
  const clamped = Math.min(MAX_SATS, Math.max(MIN_SATS, sats || MIN_SATS))
  return Math.round(((Math.log10(clamped) - 2) / 4) * 100)
}

const qrUrl = (data, size, extra = '') =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&bgcolor=ffffff&color=0d0d0d&margin=0${extra}`

export default function Donate() {
  const [pos,       setPos]       = useState(0)
  const [amount,    setAmount]    = useState(MIN_SATS)
  const [touched,   setTouched]   = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [invoice,   setInvoice]   = useState('')
  const [verifyUrl, setVerifyUrl] = useState('')
  const [error,     setError]     = useState('')
  const [paid,      setPaid]      = useState(false)
  const [copied,    setCopied]    = useState(false)
  const [addrCopied, setAddrCopied] = useState(false)

  const pollRef  = useRef(null)
  const resetRef = useRef(null)
  const panelRef = useRef(null)

  const reset = () => {
    setInvoice('')
    setVerifyUrl('')
    setPaid(false)
  }

  // Poll for payment (same logic as before)
  useEffect(() => {
    if (!verifyUrl) return
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(verifyUrl)
        if (!res.ok) return
        const data = await res.json()
        if (data.settled === true) {
          clearInterval(pollRef.current)
          setPaid(true)
          resetRef.current = setTimeout(reset, 4000)
        }
      } catch {}
    }, 2000)
    return () => clearInterval(pollRef.current)
  }, [verifyUrl])

  useEffect(() => () => clearTimeout(resetRef.current), [])

  // On phones the QR sits below the form, so bring it into view
  useEffect(() => {
    if (invoice && window.innerWidth < 768) {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [invoice])

  const handleSlider = (e) => {
    const p = Number(e.target.value)
    setPos(p)
    setAmount(posToSats(p))
    setTouched(true)
  }

  const handleInput = (e) => {
    const v = Math.max(0, Math.floor(Number(e.target.value)) || 0)
    setAmount(v)
    setPos(satsToPos(v))
  }

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
      clearTimeout(resetRef.current)
      setPaid(false)
      setInvoice(invData.pr)
      setVerifyUrl(invData.verify || '')
    } catch (e) {
      setError(e.message || 'Failed to get invoice')
    }
    setLoading(false)
  }

  const copyInvoice = async () => {
    await navigator.clipboard.writeText(invoice)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyAddress = async () => {
    await navigator.clipboard.writeText(LIGHTNING_ADDRESS)
    setAddrCopied(true)
    setTimeout(() => setAddrCopied(false), 2000)
  }

  const view = paid ? 'paid' : invoice ? 'invoice' : 'static'

  return (
    <div className="min-h-screen bg-dark-950 text-white pt-28 pb-20 overflow-hidden">
      <style>{`
        .sat-slider{-webkit-appearance:none;appearance:none;height:8px;border-radius:9999px;outline:none;cursor:pointer}
        .sat-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:28px;height:28px;border-radius:9999px;background:#fff;border:4px solid #f97316;box-shadow:0 2px 14px rgba(249,115,22,.5)}
        .sat-slider::-moz-range-thumb{box-sizing:border-box;width:28px;height:28px;border-radius:9999px;background:#fff;border:4px solid #f97316;box-shadow:0 2px 14px rgba(249,115,22,.5)}
        .no-spin::-webkit-outer-spin-button,.no-spin::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
        .no-spin{-moz-appearance:textfield}
      `}</style>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-16 items-center">

        {/* LEFT: copy + amount */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.05] mb-6">
            Fund Bitcoin <span className="text-orange-500">Education.</span>
          </h1>
          <p className="text-dark-300 text-lg max-w-md mb-12">
            Help us keep Bitcoin education free across Africa. Every sat counts.
          </p>

          {/* Slider */}
          <div className="max-w-md mb-8">
            <div className="h-12 mb-4 flex items-end">
              {touched ? (
                <div className="text-4xl font-extrabold leading-none">
                  <span className="text-orange-500">{amount.toLocaleString()}</span>{' '}
                  <span className="text-lg text-dark-400 font-semibold">sats</span>
                </div>
              ) : (
                <p className="text-dark-400 text-sm flex items-center gap-2">
                  Drag to choose an amount <ArrowRight className="w-4 h-4 text-orange-500" />
                </p>
              )}
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={pos}
              onChange={handleSlider}
              aria-label="Donation amount in sats"
              className="sat-slider w-full"
              style={{ background: `linear-gradient(to right, #f97316 ${pos}%, #262626 ${pos}%)` }}
            />
            <div className="flex justify-between text-xs text-dark-500 mt-3">
              <span>100</span>
              <span>1,000,000</span>
            </div>
          </div>

          {/* Appears after the first drag */}
          <AnimatePresence>
            {touched && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="max-w-md"
              >
                <div className="relative mb-4">
                  <input
                    type="number"
                    min={1}
                    value={amount || ''}
                    onChange={handleInput}
                    aria-label="Edit amount in sats"
                    className="no-spin w-full bg-transparent border-2 border-dark-700 focus:border-orange-500 rounded-xl px-5 py-4 text-2xl font-bold text-white outline-none transition-colors"
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-semibold text-dark-500">
                    SATS
                  </span>
                </div>

                {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

                <button
                  onClick={fetchInvoice}
                  disabled={loading || amount < 1}
                  className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-10 py-3 rounded-full transition-colors"
                >
                  {loading
                    ? <><Loader className="w-4 h-4 animate-spin" /> Getting invoice…</>
                    : <><Zap className="w-4 h-4 fill-white" /> Generate invoice</>
                  }
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* RIGHT: QR panel */}
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="relative mx-auto w-72 sm:w-80"
        >
          <div className="absolute -inset-10 bg-orange-500/10 blur-3xl rounded-full pointer-events-none" />

          <AnimatePresence mode="wait">
            {view === 'static' && (
              <motion.div
                key="static"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="relative text-center"
              >
                <div className="relative rounded-[2rem] border-[6px] border-dark-800 bg-white p-5">
                  <img
                    src={qrUrl(LIGHTNING_ADDRESS, 320, '&ecc=H')}
                    alt="Bitsavers EduHub Lightning address QR"
                    className="w-full aspect-square"
                  />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-orange-500 border-4 border-white flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white fill-white" />
                  </div>
                </div>
                <p className="text-dark-300 text-sm mt-6 mb-3">Scan with any Lightning wallet</p>
                <button
                  onClick={copyAddress}
                  className="inline-flex items-center gap-2 font-mono text-sm text-dark-300 hover:text-orange-500 transition-colors"
                >
                  {addrCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {LIGHTNING_ADDRESS}
                </button>
              </motion.div>
            )}

            {view === 'invoice' && (
              <motion.div
                key="invoice"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="relative text-center"
              >
                <div className="rounded-[2rem] border-[6px] border-dark-800 bg-white p-5">
                  <img
                    src={qrUrl(invoice, 320)}
                    alt="Lightning invoice QR"
                    className="w-full aspect-square"
                  />
                </div>

                <div className="mt-6 mb-1 text-2xl font-extrabold text-orange-500">
                  {amount.toLocaleString()} sats
                </div>
                {verifyUrl ? (
                  <div className="flex items-center justify-center gap-2 mb-5 text-xs text-dark-400">
                    <Loader className="w-3 h-3 text-orange-500 animate-spin" />
                    Waiting for payment…
                  </div>
                ) : (
                  <div className="mb-5 text-xs text-dark-400">Scan with any Lightning wallet</div>
                )}

                <div className="flex gap-3 mb-4">
                  <button
                    onClick={copyInvoice}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full font-semibold text-sm transition-colors border ${
                      copied
                        ? 'border-green-500/50 text-green-400'
                        : 'border-dark-700 text-dark-200 hover:border-orange-500 hover:text-orange-500'
                    }`}
                  >
                    {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
                  </button>
                  <a
                    href={`lightning:${invoice}`}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors"
                  >
                    <Zap className="w-4 h-4 fill-white" /> Open Wallet
                  </a>
                </div>

                <div className="flex items-center justify-center gap-6 text-xs">
                  <button
                    onClick={reset}
                    className="inline-flex items-center gap-1 text-dark-400 hover:text-orange-500 transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" /> Cancel
                  </button>
                  <a
                    href={BLINK_LN_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-dark-400 hover:text-orange-500 transition-colors"
                  >
                    Or pay on Blink →
                  </a>
                </div>
              </motion.div>
            )}

            {view === 'paid' && (
              <motion.div
                key="paid"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="relative text-center py-16"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-20 h-20 rounded-full border-2 border-green-500 bg-green-500/10 flex items-center justify-center mx-auto mb-6"
                >
                  <Check className="w-10 h-10 text-green-500" />
                </motion.div>
                <div className="text-2xl font-extrabold text-green-500 mb-2">Payment received!</div>
                <div className="text-dark-300 text-sm mb-3">Thank you for supporting Bitsavers EduHub</div>
                <div className="text-3xl font-extrabold text-orange-500">{amount.toLocaleString()} sats</div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      </div>
    </div>
  )
}
