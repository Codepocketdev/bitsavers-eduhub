import { motion } from 'framer-motion'
import { CheckCircle, Target, BookOpen, Users } from 'lucide-react'

const features = [
  { icon: BookOpen, title: 'Bitcoin Literacy Programs', desc: 'Comprehensive courses from basics to advanced.' },
  { icon: Users, title: 'Merchant Onboarding', desc: 'Helping businesses accept Bitcoin payments.' },
  { icon: Target, title: 'Developer Training', desc: 'Building the next generation of Bitcoin developers.' },
]

export default function About() {
  return (
    <div className="pt-24">
      {/* Header */}
      <section className="bg-gradient-to-br from-dark-900 to-dark-800 py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="inline-block bg-orange-500/15 text-orange-300 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
          >
            Our Story
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-extrabold text-white mb-6"
          >
            Bitsavers EduHub
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-white/70 text-lg max-w-2xl mx-auto"
          >
            Africa's Bitcoin Education Hub — empowering communities through knowledge, adoption, and innovation.
          </motion.p>
        </div>
      </section>

      {/* Content */}
      <section className="py-24 bg-gray-50 dark:bg-dark-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-extrabold text-dark-900 dark:text-white mb-6">
                Zambia's Bitcoin Circular Economy
              </h2>
              <p className="text-gray-600 dark:text-dark-400 leading-relaxed mb-6">
                Bitsavers EduHub is dedicated to educating individuals, students, and entrepreneurs on Bitcoin 
                adoption, payments, and financial sovereignty. We empower communities by providing practical 
                knowledge on how to earn, spend, and store Bitcoin securely.
              </p>
              <p className="text-gray-600 dark:text-dark-400 leading-relaxed mb-8">
                Join us as we shape the future of financial freedom across the continent.
              </p>

              <div className="bg-white dark:bg-dark-900 rounded-xl p-6 border-l-4 border-orange-500 shadow-sm">
                <h3 className="text-lg font-bold text-dark-900 dark:text-white mb-2 flex items-center gap-2">
                  <Target className="w-5 h-5 text-orange-500" />
                  Our Mission
                </h3>
                <p className="text-gray-500 dark:text-dark-400 text-sm mb-4">
                  Empowering individuals and organizations with practical Bitcoin education.
                </p>
                <ul className="space-y-2">
                  {features.map((f) => (
                    <li key={f.title} className="flex items-center gap-3 text-sm text-gray-600 dark:text-dark-300">
                      <CheckCircle className="w-4 h-4 text-orange-500 shrink-0" />
                      {f.title}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&h=700&fit=crop"
                  alt="Bitcoin Education Workshop"
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-orange-500 text-white px-8 py-6 rounded-xl shadow-xl">
                <span className="block text-4xl font-extrabold">5+</span>
                <span className="text-xs font-semibold uppercase tracking-wider">Years of Impact</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  )
}
