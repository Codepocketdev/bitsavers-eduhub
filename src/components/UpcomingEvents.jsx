import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Clock, MapPin, Ticket, Bell, X, Download, ZoomIn } from 'lucide-react'
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

// Posters live in /images/events/ and get the featured layout
const isFeatured = (event) => event.image.startsWith('/images/events/')

const labelClass =
  'text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-dark-400 mb-2'

const remindClass =
  'px-4 py-2.5 rounded-full text-sm font-semibold border transition-all hover:-translate-y-0.5 flex items-center gap-2 border-gray-300 dark:border-dark-700 text-gray-600 dark:text-dark-300 hover:border-orange-500 hover:text-orange-500'

function EventDetails({ event, featured, openPicker, setOpenPicker }) {
  const pickerOpen = openPicker === event.id
  const registerClass = `px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-full text-center transition-all hover:-translate-y-0.5 ${
    featured ? 'flex-1 sm:flex-none sm:px-10' : 'flex-1'
  }`

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-3">
        {event.tags.map((tag) => (
          <span key={tag} className="px-2.5 py-0.5 bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 text-xs font-semibold rounded-full">
            {tag}
          </span>
        ))}
      </div>

      <h3 className={`font-bold text-dark-900 dark:text-white mb-2 ${featured ? 'text-2xl md:text-3xl' : 'text-xl'}`}>
        {event.title}
      </h3>

      <p className={`text-gray-500 dark:text-dark-400 text-sm mb-4 ${featured ? '' : 'line-clamp-2'}`}>
        {event.description}
      </p>

      <div className="space-y-2 text-sm text-gray-500 dark:text-dark-400 mb-5">
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

      {event.calendar && pickerOpen && (
        <div className="mt-4 p-4 rounded-xl bg-dark-900 border border-dark-800 space-y-4">
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
              className="px-4 py-2 rounded-full text-sm font-semibold border border-dark-600 text-dark-200 hover:border-orange-500 hover:text-orange-500 transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download .ics{event.calendar.dates.length > 1 ? ' (all dates)' : ''}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default function UpcomingEvents() {
  const [openPicker, setOpenPicker] = useState(null)
  const [lightbox, setLightbox] = useState(null)

  const featured = upcomingEvents.filter(isFeatured)
  const regular = upcomingEvents.filter((e) => !isFeatured(e))

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e) => {
      if (e.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [lightbox])

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

        {/* Featured events (posters): no card, poster at its real 4:5 shape */}
        <div className="space-y-16 mb-16">
          {featured.map((event) => (
            <motion.article
              key={event.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-8 md:gap-12">
                <button
                  type="button"
                  onClick={() => setLightbox(event)}
                  aria-label={`View full poster for ${event.title}`}
                  className="relative block w-full md:w-80 lg:w-96 shrink-0 aspect-[4/5] overflow-hidden rounded-2xl bg-dark-900 cursor-zoom-in"
                >
                  <img
                    src={event.image}
                    alt={event.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 text-white text-xs font-semibold">
                    <ZoomIn className="w-3.5 h-3.5" />
                    View full poster
                  </span>
                </button>

                <div className="flex flex-col flex-1 min-w-0">
                  <EventDetails
                    event={event}
                    featured
                    openPicker={openPicker}
                    setOpenPicker={setOpenPicker}
                  />
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        {/* Everything else: no card, same 16:10 image frame */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-14 items-start">
          {regular.map((event, i) => (
            <motion.article
              key={event.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-dark-900 mb-6">
                <img
                  src={event.image}
                  alt={event.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="flex flex-col">
                <EventDetails
                  event={event}
                  featured={false}
                  openPicker={openPicker}
                  setOpenPicker={setOpenPicker}
                />
              </div>
            </motion.article>
          ))}
        </div>
      </div>

      {/* Lightbox: full poster, nothing cropped */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[1100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.title}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightbox.image}
            alt={lightbox.title}
            className="max-h-[90vh] max-w-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  )
}
