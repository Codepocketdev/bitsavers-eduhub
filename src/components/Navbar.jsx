import { useState, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Sun, Moon } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { navLinks } from '../data/content'

export default function Navbar() {
  const { theme, toggleTheme, menuOpen, dispatch } = useApp()
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    dispatch({ type: 'CLOSE_MENU' })
  }, [location.pathname, dispatch])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') dispatch({ type: 'CLOSE_MENU' })
  }, [dispatch])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`fixed top-0 left-0 right-0 z-[1000] transition-all duration-300 ${
          scrolled
            ? 'bg-white/90 dark:bg-dark-950/90 backdrop-blur-xl shadow-lg py-3'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <img
                  src="/images/logo.jpeg"
                  alt="Bitsavers EduHub"
                  className="w-10 h-10 rounded-full object-cover border-2 border-orange-500 group-hover:scale-110 transition-transform"
                  loading="eager"
                />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-dark-950" />
              </div>
              <span className={`font-bold text-lg transition-colors ${scrolled ? 'text-dark-900 dark:text-white' : 'text-white'}`}>
                Bitsavers EduHub
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    location.pathname === link.path
                      ? 'bg-orange-500 text-white'
                      : scrolled
                      ? 'text-dark-700 dark:text-dark-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Open App button */}
              <a
                href="https://app.biteduhub.com"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-3 inline-flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-full transition-all hover:-translate-y-0.5"
              >
                Open App
              </a>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className={`ml-2 p-2 rounded-full transition-all ${scrolled ? 'hover:bg-gray-100 dark:hover:bg-dark-800 text-dark-700 dark:text-dark-300' : 'hover:bg-white/10 text-white'}`}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>

            {/* Mobile Toggle */}
            <div className="flex lg:hidden items-center gap-2">
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-full ${scrolled ? 'text-dark-700 dark:text-white' : 'text-white'}`}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={() => dispatch({ type: 'TOGGLE_MENU' })}
                className={`p-2 rounded-full ${scrolled ? 'text-dark-700 dark:text-white' : 'text-white'}`}
                aria-label="Toggle menu"
              >
                {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[999] bg-white dark:bg-dark-950 lg:hidden"
          >
            <div className="flex flex-col items-center justify-center h-full gap-6">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.path}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link
                    to={link.path}
                    onClick={() => dispatch({ type: 'CLOSE_MENU' })}
                    className={`text-2xl font-bold transition-colors ${
                      location.pathname === link.path
                        ? 'text-orange-500'
                        : 'text-dark-900 dark:text-white hover:text-orange-500'
                    }`}
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}

              {/* Open App — mobile */}
              <motion.a
                href="https://app.biteduhub.com"
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: navLinks.length * 0.1 }}
                className="mt-4 inline-flex items-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-full transition-all"
              >
                Open App
              </motion.a>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

