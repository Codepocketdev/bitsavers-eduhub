import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Camera } from 'lucide-react'
import { galleryEvents } from '../data/content'

export default function Gallery() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [lightbox, setLightbox] = useState(null)

  const categories = ['All', ...galleryEvents.map((g) => g.category)]

  const allImages = galleryEvents.flatMap((event) =>
    event.images.map((img, idx) => ({
      src: img,
      title: event.title,
      category: event.category,
      eventId: event.id,
      idx,
    }))
  )

  const filtered = activeCategory === 'All'
    ? allImages
    : allImages.filter((img) => img.category === activeCategory)

  const openLightbox = (index) => setLightbox(index)
  const closeLightbox = () => setLightbox(null)

  const goNext = () => setLightbox((prev) => (prev + 1) % filtered.length)
  const goPrev = () => setLightbox((prev) => (prev - 1 + filtered.length) % filtered.length)

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') closeLightbox()
    if (e.key === 'ArrowRight') goNext()
    if (e.key === 'ArrowLeft') goPrev()
  }

  return (
    <section className="py-24 bg-gray-50 dark:bg-dark-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-block bg-orange-500/10 text-orange-600 dark:text-orange-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            Memories
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold text-dark-900 dark:text-white mb-4">Event Gallery</h2>
          <p className="text-gray-500 dark:text-dark-400 max-w-xl mx-auto">
            Snapshots from Bitcoin Pizza Day, Campus Caravan, She Leads, and more.
          </p>
        </motion.div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setLightbox(null) }}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                activeCategory === cat
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                  : 'bg-white dark:bg-dark-900 text-gray-600 dark:text-dark-300 border border-gray-200 dark:border-dark-800 hover:border-orange-500 hover:text-orange-500'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Masonry Grid */}
        <motion.div layout className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((img, i) => (
              <motion.div
                key={`${img.eventId}-${img.idx}`}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                onClick={() => openLightbox(i)}
                className="break-inside-avoid group relative rounded-xl overflow-hidden cursor-pointer"
              >
                <img
                  src={img.src}
                  alt={img.title}
                  className="w-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                  <div>
                    <p className="text-white font-semibold text-sm">{img.title}</p>
                    <p className="text-white/70 text-xs">{img.category}</p>
                  </div>
                </div>
                <div className="absolute top-3 right-3 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-4 h-4 text-white" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1002] flex items-center justify-center bg-black/90 backdrop-blur-md"
            onClick={closeLightbox}
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            {/* Close */}
            <button
              onClick={closeLightbox}
              className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Prev */}
            <button
              onClick={(e) => { e.stopPropagation(); goPrev() }}
              className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Next */}
            <button
              onClick={(e) => { e.stopPropagation(); goNext() }}
              className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Image */}
            <motion.div
              key={lightbox}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-5xl max-h-[85vh] mx-4"
            >
              <img
                src={filtered[lightbox].src}
                alt={filtered[lightbox].title}
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              />
              <div className="text-center mt-4">
                <p className="text-white font-semibold">{filtered[lightbox].title}</p>
                <p className="text-white/60 text-sm">{lightbox + 1} / {filtered.length}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
