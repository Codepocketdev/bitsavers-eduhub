import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function CTASection() {
  return (
    <section className="py-24 bg-gradient-to-br from-dark-900 to-dark-800 relative overflow-hidden">
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute -top-40 -right-40 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl"
      />
      <div className="max-w-3xl mx-auto px-4 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6">
            Join The Bitsavers EduHub Movement
          </h2>
          <p className="text-white/70 text-lg mb-10 max-w-xl mx-auto">
            Be part of the revolution. Whether you're a student, developer, merchant, or Bitcoin enthusiast — there's a place for you here.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/contact"
              className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-full transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/25"
            >
              Get In Touch
            </Link>
            <Link
              to="/programs"
              className="px-8 py-4 border-2 border-white/30 hover:border-white hover:bg-white hover:text-dark-900 text-white font-semibold rounded-full transition-all"
            >
              Explore Programs
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
