import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus, Search } from 'lucide-react'
import { faqs } from '../data/content'

function FAQItem({ item, isOpen, onToggle, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      className={`border rounded-xl overflow-hidden transition-colors ${
        isOpen ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/10' : 'border-gray-200 dark:border-dark-800 bg-white dark:bg-dark-900'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 text-left"
        aria-expanded={isOpen}
      >
        <span className="font-semibold text-dark-900 dark:text-white pr-4">{item.question}</span>
        <span className="shrink-0 w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-500">
          {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="px-6 pb-6 text-gray-600 dark:text-dark-400 text-sm leading-relaxed">
              {item.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null)
  const [search, setSearch] = useState('')

  const toggle = useCallback((i) => {
    setOpenIndex((prev) => (prev === i ? null : i))
  }, [])

  const filtered = faqs.filter((f) =>
    f.question.toLowerCase().includes(search.toLowerCase()) ||
    f.answer.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="pt-24">
      <section className="bg-gradient-to-br from-dark-900 to-dark-800 py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="inline-block bg-orange-500/15 text-orange-300 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
          >
            Questions
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-extrabold text-white mb-6"
          >
            Frequently Asked Questions
          </motion.h1>
        </div>
      </section>

      <section className="py-24 bg-white dark:bg-dark-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Search */}
          <div className="relative mb-10">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search questions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 dark:border-dark-800 bg-gray-50 dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
            />
          </div>

          <div className="space-y-4">
            {filtered.length > 0 ? (
              filtered.map((faq, i) => (
                <FAQItem
                  key={i}
                  item={faq}
                  index={i}
                  isOpen={openIndex === i}
                  onToggle={() => toggle(i)}
                />
              ))
            ) : (
              <p className="text-center text-gray-500 dark:text-dark-400 py-8">No questions found matching "{search}"</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
