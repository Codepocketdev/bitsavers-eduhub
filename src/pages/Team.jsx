import { motion } from 'framer-motion'
import { Twitter, Linkedin } from 'lucide-react'
import { team } from '../data/content'

export default function Team() {
  return (
    <div className="pt-24">
      <section className="bg-gradient-to-br from-dark-900 to-dark-800 py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="inline-block bg-orange-500/15 text-orange-300 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
          >
            The Team
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-extrabold text-white mb-6"
          >
            Meet The Founders
          </motion.h1>
        </div>
      </section>

      <section className="py-24 bg-gray-50 dark:bg-dark-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {team.map((member, i) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                whileHover={{ y: -6 }}
                className="bg-white dark:bg-dark-900 rounded-2xl overflow-hidden shadow-lg border border-gray-100 dark:border-dark-800"
              >
                <div className="h-72 overflow-hidden">
                  <img src={member.image} alt={member.name} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-dark-900 dark:text-white">{member.name}</h3>
                  <span className="text-orange-500 text-xs font-semibold uppercase tracking-wider">{member.role}</span>
                  <p className="text-gray-500 dark:text-dark-400 text-sm mt-4 leading-relaxed">{member.bio}</p>
                  <div className="flex gap-3 mt-5">
                    <a href={member.social.twitter} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-dark-800 flex items-center justify-center text-gray-600 dark:text-dark-400 hover:bg-orange-500 hover:text-white transition-all">
                      <Twitter className="w-4 h-4" />
                    </a>
                    <a href={member.social.linkedin} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-dark-800 flex items-center justify-center text-gray-600 dark:text-dark-400 hover:bg-orange-500 hover:text-white transition-all">
                      <Linkedin className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
