import { motion } from 'framer-motion'
import { GraduationCap, Handshake, Rocket } from 'lucide-react'
import { pillars } from '../data/content'

const iconMap = { GraduationCap, Handshake, Rocket }

export default function Pillars() {
  return (
    <section id="pillars" className="py-24 px-4 bg-white dark:bg-dark-950 overflow-hidden">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6 }}
          className="rounded-2xl overflow-hidden bg-dark-900 aspect-[3/2]"
        >
          <img
            src="/images/programs/bitcoin-education.jpg"
            alt="Bitsavers EduHub Bitcoin education session"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </motion.div>

        <div className="space-y-10">
          {pillars.map((pillar, i) => {
            const Icon = iconMap[pillar.icon]
            return (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="flex gap-5"
              >
                {Icon && (
                  <Icon className="w-9 h-9 text-orange-500 shrink-0 mt-1" strokeWidth={1.5} />
                )}
                <div>
                  <h3 className="text-xl font-bold text-dark-900 dark:text-white mb-2">{pillar.title}</h3>
                  <p className="text-gray-500 dark:text-dark-400 text-sm leading-relaxed">{pillar.description}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
