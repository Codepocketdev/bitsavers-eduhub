import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Suspense, lazy } from 'react'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ScrollProgress from './components/ScrollProgress'
import Toast from './components/Toast'

const Home = lazy(() => import('./pages/Home'))
const About = lazy(() => import('./pages/About'))
const Programs = lazy(() => import('./pages/Programs'))
const Team = lazy(() => import('./pages/Team'))
const FAQ = lazy(() => import('./pages/FAQ'))
const Contact = lazy(() => import('./pages/Contact'))
const Donate  = lazy(() => import('./pages/Donate'))

function PageWrapper({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      {children}
    </motion.div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-950">
      <div className="w-12 h-12 border-4 border-orange-200 dark:border-orange-900 border-t-orange-500 rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-white dark:bg-dark-950 text-dark-900 dark:text-white transition-colors">
      <ScrollProgress />
      <Navbar />
      <Toast />
      <Suspense fallback={<LoadingFallback />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<PageWrapper><Home /></PageWrapper>} />
            <Route path="/about" element={<PageWrapper><About /></PageWrapper>} />
            <Route path="/programs" element={<PageWrapper><Programs /></PageWrapper>} />
            <Route path="/team" element={<PageWrapper><Team /></PageWrapper>} />
            <Route path="/faq" element={<PageWrapper><FAQ /></PageWrapper>} />
            <Route path="/donate" element={<PageWrapper><Donate /></PageWrapper>} />
            <Route path="/contact" element={<PageWrapper><Contact /></PageWrapper>} />
          </Routes>
        </AnimatePresence>
      </Suspense>
      <Footer />
    </div>
  )
}
