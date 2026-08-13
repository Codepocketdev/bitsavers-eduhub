import { useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Clock, MapPin, Ticket, Bell, Check } from 'lucide-react'
import { upcomingEvents } from '../data/content'
import { useApp } from '../context/AppContext'

export default function UpcomingEvents() {
  const { showToast } = useApp()
  const [reminders, setReminders] = useState(new Set())

  const toggleReminder = (id) => {
    setReminders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        showToast('Reminder removed', 'info')
      } else {
        next.add(id)
        showToast('Reminder set! We will notify you.', 'success')
      }
      return next
    })
  }

  return (
    <section className="py-24 bg-white dark:bg-dark-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            Coming Up
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold text-dark-900 dark:text-white mb-4">Upcoming Events</h2>
          <p className="text-gray-500 dark:text-dark-400 max-w-xl mx-auto">
            Mark your calendar. Don't miss out on our upcoming workshops, bootcamps, and community events.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {upcomingEvents.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className="group bg-gray-50 dark:bg-dark-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-dark-800 shadow-sm hover:shadow-xl transition-all"
            >
              <div className="flex flex-col sm:flex-row">
                {/* Image */}
                <div className="sm:w-48 h-48 sm:h-auto shrink-0 overflow-hidden">
                  <img
                    src={event.image}
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>

                {/* Content */}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {event.tags.map((tag) => (
                      <span key={tag} className="px-2.5 py-0.5 bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 text-xs font-semibold rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <h3 className="text-lg font-bold text-dark-900 dark:text-white mb-2 group-hover:text-orange-500 transition-colors">
                    {event.title}
                  </h3>

                  <p className="text-gray-500 dark:text-dark-400 text-sm mb-4 line-clamp-2 flex-1">
                    {event.description}
                  </p>

                  <div className="space-y-2 text-sm text-gray-500 dark:text-dark-400 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
                      {event.date}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-500 shrink-0" />
                      {event.time}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
                      {event.location}
                    </div>
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-orange-500 shrink-0" />
                      {event.spots} spots available
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-full transition-all hover:-translate-y-0.5">
                      Register
                    </button>
                    <button
                      onClick={() => toggleReminder(event.id)}
                      className={`px-4 py-2.5 rounded-full text-sm font-semibold border transition-all hover:-translate-y-0.5 flex items-center gap-2 ${
                        reminders.has(event.id)
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-200 dark:border-dark-700 text-gray-600 dark:text-dark-300 hover:border-orange-500 hover:text-orange-500'
                      }`}
                    >
                      {reminders.has(event.id) ? <Check className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                      {reminders.has(event.id) ? 'Saved' : 'Remind Me'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
