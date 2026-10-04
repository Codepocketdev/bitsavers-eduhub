import { useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Volume2, VolumeX, ArrowRight } from 'lucide-react'

const points = [
  { n: '01', title: 'Your keys, your coins', text: 'Learn how to hold Bitcoin yourself, without banks or middlemen.' },
  { n: '02', title: 'Hands-on, not theory', text: 'Set up a hardware wallet, back it up and send a real transaction.' },
  { n: '03', title: 'Free for everyone', text: 'Open sessions on campuses and in communities across Kenya.' },
]

export default function AcademyShowcase() {
  const videoRef = useRef(null)
  const hideTimer = useRef(null)
  const [muted, setMuted] = useState(true)
  const [showControl, setShowControl] = useState(false)

  const startHideTimer = () => {
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowControl(false), 3000)
  }

  const handleVideoTap = () => {
    clearTimeout(hideTimer.current)
    setShowControl((prev) => {
      if (!prev) {
        hideTimer.current = setTimeout(() => setShowControl(false), 3000)
      }
      return !prev
    })
  }

  useEffect(() => () => clearTimeout(hideTimer.current), [])

  const toggleSound = (e) => {
    e.stopPropagation()
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
    startHideTimer()
  }

  return (
    <section id="academy" className="py-24 bg-dark-950 text-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-orange-500 text-sm font-bold uppercase tracking-widest mb-4">Bitcoin Education</p>
          <h2 className="text-4xl md:text-6xl font-extrabold leading-[1.05] mb-6">
            Take control of your money.
          </h2>
          <p className="text-dark-300 text-lg max-w-md mb-10">
            Practical Bitcoin self-custody training from Bitsavers EduHub. Learn it once, keep it for life.
          </p>

          <div className="space-y-6 mb-10">
            {points.map((p) => (
              <div key={p.n} className="flex gap-5">
                <span className="text-orange-500 font-bold text-sm pt-1">{p.n}</span>
                <div>
                  <h3 className="font-bold text-lg">{p.title}</h3>
                  <p className="text-dark-400 text-sm">{p.text}</p>
                </div>
              </div>
            ))}
          </div>

          <a
            href="https://bit.ly/4iUIuwi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-10 py-3 rounded-full transition-colors"
          >
            Join a session <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative mx-auto w-64 sm:w-72"
        >
          <div className="absolute -inset-10 bg-orange-500/10 blur-3xl rounded-full pointer-events-none" />
          <div
            onClick={handleVideoTap}
            className="relative rounded-[2.5rem] border-[6px] border-dark-800 overflow-hidden aspect-[9/16] bg-black cursor-pointer"
          >
            <video
              ref={videoRef}
              src="/videos/trezor-academy.mp4"
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover pointer-events-none"
            />
            <button
              type="button"
              onClick={toggleSound}
              aria-label={muted ? 'Unmute video' : 'Mute video'}
              className={`absolute bottom-4 right-4 w-10 h-10 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-opacity duration-300 ${
                showControl ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
