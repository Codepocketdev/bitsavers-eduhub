import { motion } from 'framer-motion'
import { GraduationCap, Handshake, Rocket } from 'lucide-react'
import { pillars } from '../data/content'

const iconMap = { GraduationCap, Handshake, Rocket }

export default function Pillars() {
  return (
    <section id="pillars" className="relative z-10 -mt-16 pb-20 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {pillars.map((pillar, i) => {
          const Icon = iconMap[pillar.icon]
          return (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              whileHover={{ y: -8 }}
              className="bg-white dark:bg-dark-900 rounded-2xl p-8 shadow-xl border border-gray-100 dark:border-dark-800 text-center group"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform">
                <Icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-dark-900 dark:text-white mb-3">{pillar.title}</h3>
              <p className="text-gray-500 dark:text-dark-400 text-sm leading-relaxed">{pillar.description}</p>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
