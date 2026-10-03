import { useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Clock, MapPin, Ticket, Bell, X, Download } from 'lucide-react'
import { upcomingEvents } from '../data/content'

const pad = (n) => String(n).padStart(2, '0')

// Nairobi is UTC+3 with no daylight saving, so convert to UTC
function toUTCDate(date, time) {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hh - 3, mm))
}

function toUTCStamp(date, time) {
  const dt = toUTCDate(date, time)
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00Z`
}

function defaultEnd(start) {
  const [h, m] = start.split(':').map(Number)
  return `${pad(Math.min(h + 4, 23))}:${pad(m)}`
}

function googleCalendarUrl(event, date) {
  const { start, end } = event.calendar
  const endTime = end || defaultEnd(start)
  const dates = `${toUTCStamp(date, start)}/${toUTCStamp(date, endTime)}`
  return (
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(event.title)}` +
    `&dates=${dates}` +
    `&details=${encodeURIComponent(event.description)}` +
    `&location=${encodeURIComponent(event.location)}` +
    '&ctz=Africa/Nairobi'
  )
}

function outlookCalendarUrl(event, date) {
  const { start, end } = event.calendar
  const endTime = end || defaultEnd(start)
  return (
    'https://outlook.live.com/calendar/0/action/compose?rru=addevent' +
    `&subject=${encodeURIComponent(event.title)}` +
    `&startdt=${encodeURIComponent(toUTCDate(date, start).toISOString())}` +
    `&enddt=${encodeURIComponent(toUTCDate(date, endTime).toISOString())}` +
    `&location=${encodeURIComponent(event.location)}` +
    `&body=${encodeURIComponent(event.description)}`
  )
}

function escapeICS(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function downloadICS(event) {
  const { dates, start, end } = event.calendar
  const endTime = end || defaultEnd(start)
  const stamp = toUTCStamp(new Date().toISOString().slice(0, 10), '03:00')

  const events = dates.map((date) => [
    'BEGIN:VEVENT',
    `UID:${event.id}-${date}@bitsavers-eduhub`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toUTCStamp(date, start)}`,
    `DTEND:${toUTCStamp(date, endTime)}`,
    `SUMMARY:${escapeICS(event.title)}`,
    `LOCATION:${escapeICS(event.location)}`,
    `DESCRIPTION:${escapeICS(event.description)}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeICS(event.title)} is tomorrow`,
    'END:VALARM',
    'END:VEVENT',
  ].join('\r\n'))

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bitsavers EduHub//Events//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.id}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function shortDate(date) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function UpcomingEvents() {
  const [openPicker, setOpenPicker] = useState(null)

  const registerClass =
    'flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-full text-center transition-all hover:-translate-y-0.5'

  const remindClass =
    'px-4 py-2.5 rounded-full text-sm font-semibold border transition-all hover:-translate-y-0.5 flex items-center gap-2 border-gray-200 dark:border-dark-700 text-gray-600 dark:text-dark-300 hover:border-orange-500 hover:text-orange-500'

  const labelClass =
    'text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-dark-400 mb-2'

  return (
    <section className="py-24 bg-white dark:bg-dark-950 overflow-hidden">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {upcomingEvents.map((event, i) => {
            const isPoster = event.image.startsWith('/images/events/')
            const pickerOpen = openPicker === event.id
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ y: -4 }}
                className={`group bg-gray-50 dark:bg-dark-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-dark-800 shadow-sm hover:shadow-xl transition-all ${
                  isPoster ? 'md:col-span-2' : ''
                }`}
              >
                <div className={isPoster ? 'flex flex-col sm:flex-row' : ''}>
                  {/* Image: natural shape, nothing cropped */}
                  <img
                    src={event.image}
                    alt={event.title}
                    className={`block h-auto ${
                      isPoster ? 'w-full sm:w-72 shrink-0 self-start' : 'w-full'
                    }`}
                    loading="lazy"
                  />

                  {/* Content */}
                  <div className="p-6 flex flex-col flex-1 min-w-0">
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

                    <p className={`text-gray-500 dark:text-dark-400 text-sm mb-4 ${isPoster ? '' : 'line-clamp-2'}`}>
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
                      {event.registerUrl ? (
                        <a
                          href={event.registerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={registerClass}
                        >
                          Register
                        </a>
                      ) : (
                        <button className={registerClass}>Register</button>
                      )}

                      {event.calendar && (
                        <button
                          onClick={() => setOpenPicker(pickerOpen ? null : event.id)}
                          className={remindClass}
                        >
                          {pickerOpen ? <X className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                          Remind Me
                        </button>
                      )}
                    </div>

                    {/* Calendar picker */}
                    {event.calendar && pickerOpen && (
                      <div className="mt-4 p-4 rounded-xl bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 space-y-4">
                        <div>
                          <p className={labelClass}>Google Calendar</p>
                          <div className="flex flex-wrap gap-2">
                            {event.calendar.dates.map((date) => (
                              <a
                                key={date}
                                href={googleCalendarUrl(event, date)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-full text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-all"
                              >
                                {shortDate(date)}
                              </a>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className={labelClass}>Outlook</p>
                          <div className="flex flex-wrap gap-2">
                            {event.calendar.dates.map((date) => (
                              <a
                                key={date}
                                href={outlookCalendarUrl(event, date)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-full text-sm font-semibold border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white transition-all"
                              >
                                {shortDate(date)}
                              </a>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className={labelClass}>Apple Calendar / other</p>
                          <button
                            onClick={() => downloadICS(event)}
                            className="px-4 py-2 rounded-full text-sm font-semibold border border-gray-300 dark:border-dark-600 text-gray-700 dark:text-dark-200 hover:border-orange-500 hover:text-orange-500 transition-all flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            Download .ics{event.calendar.dates.length > 1 ? ' (all dates)' : ''}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
