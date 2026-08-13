import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { useApp } from '../context/AppContext'

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
}

export default function Toast() {
  const { toast, dispatch } = useApp()
  if (!toast) return null

  const Icon = icons[toast.type] || Info

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -50, x: '-50%' }}
          className="fixed top-24 left-1/2 z-[1002] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl glass border border-orange-200 dark:border-orange-800"
        >
          <Icon className={`w-5 h-5 ${toast.type === 'success' ? 'text-green-500' : toast.type === 'error' ? 'text-red-500' : 'text-orange-500'}`} />
          <span className="text-sm font-medium text-dark-900 dark:text-white">{toast.message}</span>
          <button onClick={() => dispatch({ type: 'CLEAR_TOAST' })} className="ml-2 hover:opacity-70">
            <X className="w-4 h-4 text-dark-500" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
