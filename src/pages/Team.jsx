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
    <div className="bg-dark-950">
      <section className="pt-36 pb-24">
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

                <h3 className="text-xl font-bold text-white">{member.name}</h3>
                <span className="text-orange-500 text-xs font-semibold uppercase tracking-wider mt-1">{member.role}</span>
                <p className="text-dark-400 text-sm mt-4 leading-relaxed">{member.bio}</p>

                <div className="flex justify-center gap-3 mt-5">
                  <a href={member.social.twitter} className="w-9 h-9 rounded-full bg-dark-800 flex items-center justify-center text-dark-400 hover:bg-orange-500 hover:text-white transition-all">
                    <Twitter className="w-4 h-4" />
                  </a>
                  <a href={member.social.linkedin} className="w-9 h-9 rounded-full bg-dark-800 flex items-center justify-center text-dark-400 hover:bg-orange-500 hover:text-white transition-all">
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
