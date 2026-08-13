import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, ChevronDown } from 'lucide-react'
import { stats } from '../data/content'
import { useCountUp } from '../hooks/useCountUp'

function StatItem({ value, suffix, label }) {
  const { count, ref } = useCountUp(value, 2000)
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      <span className="block text-3xl md:text-4xl font-extrabold text-orange-500">{count}{suffix}</span>
      <span className="block text-xs uppercase tracking-widest text-white/60 mt-2">{label}</span>
    </motion.div>
  )
}

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1920&h=1080&fit=crop"
          alt="Bitcoin Background"
          className="w-full h-full object-cover"
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-dark-900/80" />
        {/* Orange gradient overlay for brand feel */}
        <div className="absolute inset-0 bg-gradient-to-br from-dark-900/90 via-dark-800/70 to-orange-950/60" />
      </div>

      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-20 -right-20 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-20 -left-20 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl"
        />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23F7931A' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center pt-24 pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 bg-orange-500/15 border border-orange-500/30 text-orange-300 px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-wider mb-8"
        >
          <Zap className="w-4 h-4" />
          Bitcoin Education Reimagined
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-white leading-tight mb-6"
        >
          Building a{' '}
          <span className="relative">
            <span className="text-orange-500">Bitcoin-Literate</span>
            <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
              <path d="M2 10C50 2 100 2 150 6C200 10 250 6 298 2" stroke="#F7931A" strokeWidth="4" strokeLinecap="round" opacity="0.4"/>
            </svg>
          </span>{' '}
          Generation
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          We're on a mission to democratize Bitcoin education across Africa.
          From beginners to builders, we equip learners with the knowledge to thrive in a decentralized world.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
        >
          <Link
            to="/programs"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-full transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/25"
          >
            Explore Programs
          </Link>
          <Link
            to="/about"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-white/30 hover:border-white hover:bg-white hover:text-dark-900 text-white font-semibold rounded-full transition-all"
          >
            Our Story
          </Link>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-8 md:gap-16">
          {stats.map((stat) => (
            <StatItem key={stat.label} {...stat} />
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <a href="#pillars" className="text-white/40 hover:text-white transition-colors">
          <ChevronDown className="w-6 h-6" />
        </a>
      </motion.div>
    </section>
  )
}
