import { createContext, useContext, useReducer, useCallback } from 'react'

const AppContext = createContext(null)

const initialState = {
  theme: localStorage.getItem('theme') || 'light',
  menuOpen: false,
  toast: null,
  scrollProgress: 0,
}

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_THEME':
      localStorage.setItem('theme', action.payload)
      return { ...state, theme: action.payload }
    case 'TOGGLE_MENU':
      return { ...state, menuOpen: !state.menuOpen }
    case 'CLOSE_MENU':
      return { ...state, menuOpen: false }
    case 'SET_TOAST':
      return { ...state, toast: action.payload }
    case 'CLEAR_TOAST':
      return { ...state, toast: null }
    case 'SET_SCROLL_PROGRESS':
      return { ...state, scrollProgress: action.payload }
    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  const toggleTheme = useCallback(() => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light'
    dispatch({ type: 'SET_THEME', payload: newTheme })
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }, [state.theme])

  const showToast = useCallback((message, type = 'info') => {
    dispatch({ type: 'SET_TOAST', payload: { message, type } })
    setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 3000)
  }, [])

  const value = {
    ...state,
    dispatch,
    toggleTheme,
    showToast,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
