import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, MapPin, Users, X, ArrowRight } from 'lucide-react'
import { recentEvents } from '../data/content'

export default function RecentEvents() {
  const [selected, setSelected] = useState(null)

  return (
    <section className="py-24 bg-gray-50 dark:bg-dark-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-orange-500/10 text-orange-600 dark:text-orange-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            Looking Back
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold text-dark-900 dark:text-white mb-4">Recent Events</h2>
          <p className="text-gray-500 dark:text-dark-400 max-w-xl mx-auto">
            Highlights from our latest community gatherings, workshops, and celebrations.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {recentEvents.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -6 }}
              onClick={() => setSelected(event)}
              className="group bg-white dark:bg-dark-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-dark-800 shadow-md hover:shadow-2xl transition-all cursor-pointer"
            >
              <div className="h-56 overflow-hidden relative">
                <img
                  src={event.image}
                  alt={event.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute top-4 left-4 flex gap-2">
                  {event.tags.map((tag) => (
                    <span key={tag} className="px-3 py-1 bg-orange-500 text-white text-xs font-semibold rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold text-dark-900 dark:text-white mb-2 group-hover:text-orange-500 transition-colors">
                  {event.title}
                </h3>
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-dark-400 mb-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-orange-500" />
                    {event.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4 text-orange-500" />
                    {event.attendees}
                  </span>
                </div>
                <p className="text-gray-500 dark:text-dark-400 text-sm line-clamp-2">{event.description}</p>
                <div className="mt-4 flex items-center gap-1 text-orange-500 text-sm font-semibold">
                  Read More <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1002] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-dark-900 rounded-2xl overflow-hidden max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="relative h-64">
                <img src={selected.image} alt={selected.title} className="w-full h-full object-cover" />
                <button
                  onClick={() => setSelected(null)}
                  className="absolute top-4 right-4 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8">
                <div className="flex flex-wrap gap-2 mb-4">
                  {selected.tags.map((tag) => (
                    <span key={tag} className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-semibold rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
                <h3 className="text-2xl font-bold text-dark-900 dark:text-white mb-4">{selected.title}</h3>
                <div className="flex flex-wrap gap-6 text-sm text-gray-500 dark:text-dark-400 mb-6">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-orange-500" />
                    {selected.date}
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange-500" />
                    {selected.location}
                  </span>
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-orange-500" />
                    {selected.attendees} attendees
                  </span>
                </div>
                <p className="text-gray-600 dark:text-dark-300 leading-relaxed">{selected.description}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
