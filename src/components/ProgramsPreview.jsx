import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { programs } from '../data/content'
import EventVideoFrame from './EventVideoFrame'

export default function ProgramsPreview() {
  const gridClass =
    programs.length < 3
      ? 'md:grid-cols-2 max-w-5xl mx-auto'
      : 'md:grid-cols-3'

  return (
    <section className="py-24 bg-white dark:bg-dark-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-orange-500/10 text-orange-600 dark:text-orange-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            What We Do
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold text-dark-900 dark:text-white mb-4">Our Programs</h2>
          <p className="text-gray-500 dark:text-dark-400 max-w-xl mx-auto">
            Driving Bitcoin education, adoption, and innovation to build a stronger ecosystem.
          </p>
        </motion.div>

        <div className={`grid grid-cols-1 gap-x-10 gap-y-14 ${gridClass}`}>
          {programs.map((program, i) => (
            <motion.div
              key={program.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group"
            >
              <div className="rounded-2xl overflow-hidden mb-6">
                {program.video ? (
                  <EventVideoFrame src={program.video} heightClass="h-64" />
                ) : (
                  <div className="h-64 overflow-hidden">
                    <img
                      src={program.image}
                      alt={program.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                )}
              </div>
              <h3 className="text-2xl font-bold text-dark-900 dark:text-white mb-3">{program.title}</h3>
              <p className="text-gray-500 dark:text-dark-400 text-sm leading-relaxed mb-5">{program.description}</p>
              <Link
                to={program.link}
                className="inline-flex items-center gap-2 text-orange-500 font-semibold text-sm hover:gap-3 transition-all"
              >
                Learn More <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
