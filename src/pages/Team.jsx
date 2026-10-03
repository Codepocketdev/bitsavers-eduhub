import { motion } from 'framer-motion'
import { Twitter, Linkedin } from 'lucide-react'
import { team } from '../data/content'

function getInitials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

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
            Meet The Team
          </motion.h1>
        </div>
      </section>

      <section className="py-24 bg-gray-50 dark:bg-dark-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-16">
            {team.map((member, i) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex flex-col items-center text-center w-full max-w-sm mx-auto"
              >
                <div className="w-full aspect-square rounded-2xl overflow-hidden bg-dark-900 mb-6">
                  {member.image ? (
                    <img
                      src={member.image}
                      alt={member.name}
                      className="w-full h-full object-cover object-top"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-600">
                      <span className="text-6xl font-extrabold text-white">{getInitials(member.name)}</span>
                    </div>
                  )}
                </div>

                <h3 className="text-xl font-bold text-dark-900 dark:text-white">{member.name}</h3>
                <span className="text-orange-500 text-xs font-semibold uppercase tracking-wider mt-1">{member.role}</span>
                <p className="text-gray-500 dark:text-dark-400 text-sm mt-4 leading-relaxed">{member.bio}</p>

                <div className="flex justify-center gap-3 mt-5">
                  <a href={member.social.twitter} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-dark-800 flex items-center justify-center text-gray-600 dark:text-dark-400 hover:bg-orange-500 hover:text-white transition-all">
                    <Twitter className="w-4 h-4" />
                  </a>
                  <a href={member.social.linkedin} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-dark-800 flex items-center justify-center text-gray-600 dark:text-dark-400 hover:bg-orange-500 hover:text-white transition-all">
                    <Linkedin className="w-4 h-4" />
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
