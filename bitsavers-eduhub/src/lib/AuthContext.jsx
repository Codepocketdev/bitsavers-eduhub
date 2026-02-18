import { createContext, useContext, useState, useEffect } from 'react'
import { initNDK, loginWithExtension, loginWithNsec, generateKeypair } from './nostr'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [ndk, setNdk] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Initialize NDK on mount
    const ndkInstance = initNDK()
    setNdk(ndkInstance)

    // Check for stored session
    const storedUser = localStorage.getItem('bitsavers_user')
    const storedNsec = localStorage.getItem('bitsavers_nsec')
    
    if (storedUser && storedNsec) {
      // Auto-login with stored nsec
      loginWithNsec(ndkInstance, storedNsec)
        .then(userData => {
          setUser(userData)
          setLoading(false)
        })
        .catch(() => {
          localStorage.removeItem('bitsavers_user')
          localStorage.removeItem('bitsavers_nsec')
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (method, nsecKey = null) => {
    try {
      let userData

      if (method === 'extension') {
        userData = await loginWithExtension(ndk)
      } else if (method === 'nsec' && nsecKey) {
        userData = await loginWithNsec(ndk, nsecKey)
        // Store nsec for auto-login (encrypted in production!)
        localStorage.setItem('bitsavers_nsec', nsecKey)
      } else if (method === 'generate') {
        userData = await generateKeypair(ndk)
        // Store generated nsec
        localStorage.setItem('bitsavers_nsec', userData.nsec)
      }

      setUser(userData)
      localStorage.setItem('bitsavers_user', JSON.stringify(userData))
      return userData
    } catch (error) {
      throw error
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('bitsavers_user')
    localStorage.removeItem('bitsavers_nsec')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, ndk }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
