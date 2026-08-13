import { useState, useEffect, useCallback } from 'react'

export function useLocalStorage(key, initialValue) {
  const [stored, setStored] = useState(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(stored) : value
      setStored(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (err) {
      console.error('useLocalStorage error:', err)
    }
  }, [key, stored])

  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key)
      setStored(initialValue)
    } catch (err) {
      console.error('useLocalStorage remove error:', err)
    }
  }, [key, initialValue])

  return [stored, setValue, removeValue]
}
