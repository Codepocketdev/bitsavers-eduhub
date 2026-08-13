import { motion } from 'framer-motion'
import { ArrowRight, GraduationCap, Store, Code } from 'lucide-react'

const allPrograms = [
  {
    id: 'bitcoin-education',
    icon: GraduationCap,
    title: 'Bitcoin Education',
    description: 'We teach students, entrepreneurs, and local communities about Bitcoin — how it works, and how it creates opportunities for financial independence and global inclusion.',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=500&fit=crop',
    features: ['Beginner to Advanced', 'Hands-on Workshops', 'Certification'],
  },
  {
    id: 'merchant-adoption',
    icon: Store,
    title: 'Merchant Adoption',
    description: 'We support small businesses and vendors to start accepting Bitcoin through Lightning wallets, enabling fast, low-fee payments and financial inclusion.',
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=500&fit=crop',
    features: ['Lightning Setup', 'POS Integration', 'Ongoing Support'],
  },
  {
    id: 'developer-training',
    icon: Code,
    title: 'Developer Training',
    description: 'Training the next generation of African Bitcoin developers through intensive bootcamps, hackathons, and open-source contributions.',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=500&fit=crop',
    features: ['Rust & Python', 'Lightning Dev', 'Open Source'],
  },
]

export default function Programs() {
  return (
    <div className="pt-24">
      <section className="bg-gradient-to-br from-dark-900 to-dark-800 py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="inline-block bg-orange-500/15 text-orange-300 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
          >
            What We Do
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-extrabold text-white mb-6"
          >
            Our Programs
          </motion.h1>
        </div>
      </section>

      <section className="py-24 bg-white dark:bg-dark-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24">
          {allPrograms.map((program, i) => {
            const Icon = program.icon
            const isEven = i % 2 === 0
            return (
              <motion.div
                key={program.id}
                id={program.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${isEven ? '' : 'lg:flex-row-reverse'}`}
              >
                <div className={isEven ? '' : 'lg:order-2'}>
                  <div className="rounded-2xl overflow-hidden shadow-xl">
                    <img src={program.image} alt={program.title} className="w-full h-80 object-cover" loading="lazy" />
                  </div>
                </div>
                <div className={isEven ? '' : 'lg:order-1'}>
                  <div className="w-14 h-14 bg-orange-500/10 rounded-xl flex items-center justify-center mb-6">
                    <Icon className="w-7 h-7 text-orange-500" />
                  </div>
                  <h2 className="text-3xl font-extrabold text-dark-900 dark:text-white mb-4">{program.title}</h2>
                  <p className="text-gray-600 dark:text-dark-400 leading-relaxed mb-6">{program.description}</p>
                  <div className="flex flex-wrap gap-2 mb-8">
                    {program.features.map((f) => (
                      <span key={f} className="px-4 py-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-full text-sm font-medium">
                        {f}
                      </span>
                    ))}
                  </div>
                  <button className="inline-flex items-center gap-2 text-orange-500 font-semibold hover:gap-3 transition-all">
                    Apply Now <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
