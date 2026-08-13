import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Send, Mail, MapPin, Phone, CheckCircle, Loader2 } from 'lucide-react'
import { useForm } from '../hooks/useForm'
import { useClipboard } from '../hooks/useClipboard'
import { useApp } from '../context/AppContext'

function validate(values) {
  const errors = {}
  if (!values.name?.trim()) errors.name = 'Name is required'
  if (!values.email?.trim()) errors.email = 'Email is required'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'Invalid email'
  if (!values.message?.trim()) errors.message = 'Message is required'
  return errors
}

export default function Contact() {
  const { showToast } = useApp()
  const { copied, copy } = useClipboard()
  const [submitted, setSubmitted] = useState(false)

  const onSubmit = useCallback(async (values) => {
    await new Promise((r) => setTimeout(r, 1500))
    console.log('Form submitted:', values)
    setSubmitted(true)
    showToast('Message sent successfully!', 'success')
  }, [showToast])

  const { values, errors, touched, isSubmitting, handleChange, handleBlur, handleSubmit, reset } = useForm(
    { name: '', email: '', subject: '', message: '' },
    validate
  )

  const handleCopyEmail = async () => {
    const ok = await copy('hello@bitsaverseduhub.com')
    if (ok) showToast('Email copied to clipboard!', 'success')
  }

  if (submitted) {
    return (
      <div className="pt-24 min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-950">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md mx-auto px-4"
        >
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-3xl font-extrabold text-dark-900 dark:text-white mb-4">Thank You!</h2>
          <p className="text-gray-600 dark:text-dark-400 mb-8">We've received your message and will get back to you soon.</p>
          <button
            onClick={() => { setSubmitted(false); reset() }}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-full transition-all"
          >
            Send Another Message
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="pt-24">
      <section className="bg-gradient-to-br from-dark-900 to-dark-800 py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-extrabold text-white mb-6"
          >
            Get In Touch
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-white/70 text-lg max-w-xl mx-auto"
          >
            Have a question or want to collaborate? We'd love to hear from you.
          </motion.p>
        </div>
      </section>

      <section className="py-24 bg-white dark:bg-dark-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-2 space-y-8"
            >
              <div>
                <h2 className="text-2xl font-bold text-dark-900 dark:text-white mb-6">Contact Information</h2>
                <p className="text-gray-500 dark:text-dark-400 mb-8">
                  Fill out the form and our team will get back to you within 24 hours.
                </p>
              </div>

              <div className="space-y-5">
                <button
                  onClick={handleCopyEmail}
                  className="flex items-center gap-4 w-full text-left group"
                >
                  <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center group-hover:bg-orange-500 transition-colors">
                    <Mail className="w-5 h-5 text-orange-500 group-hover:text-white transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-dark-400">Email</p>
                    <p className="font-medium text-dark-900 dark:text-white">
                      hello@bitsaverseduhub.com {copied && <span className="text-green-500 text-xs ml-2">Copied!</span>}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-dark-400">Phone</p>
                    <p className="font-medium text-dark-900 dark:text-white">+254 700 000 000</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-dark-400">Location</p>
                    <p className="font-medium text-dark-900 dark:text-white">Nairobi, Kenya</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-3"
            >
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-dark-900 dark:text-white mb-2">Name *</label>
                    <input
                      name="name"
                      value={values.name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`w-full px-4 py-3 rounded-xl border bg-gray-50 dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all ${
                        touched.name && errors.name ? 'border-red-500' : 'border-gray-200 dark:border-dark-800'
                      }`}
                      placeholder="Your name"
                    />
                    {touched.name && errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-900 dark:text-white mb-2">Email *</label>
                    <input
                      name="email"
                      type="email"
                      value={values.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`w-full px-4 py-3 rounded-xl border bg-gray-50 dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all ${
                        touched.email && errors.email ? 'border-red-500' : 'border-gray-200 dark:border-dark-800'
                      }`}
                      placeholder="you@example.com"
                    />
                    {touched.email && errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-900 dark:text-white mb-2">Subject</label>
                  <input
                    name="subject"
                    value={values.subject}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-800 bg-gray-50 dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                    placeholder="What's this about?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-900 dark:text-white mb-2">Message *</label>
                  <textarea
                    name="message"
                    rows={5}
                    value={values.message}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full px-4 py-3 rounded-xl border bg-gray-50 dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all resize-none ${
                      touched.message && errors.message ? 'border-red-500' : 'border-gray-200 dark:border-dark-800'
                    }`}
                    placeholder="Tell us more..."
                  />
                  {touched.message && errors.message && <p className="text-red-500 text-xs mt-1">{errors.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-full transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/25"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  )
}
