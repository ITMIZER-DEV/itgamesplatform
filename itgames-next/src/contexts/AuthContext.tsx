'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { signInAnonymously, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { authApi } from '@/lib/api'
import type { AppUser } from '@/types/auth'

const SESSION_KEY = 'itgames_user'

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  isAdmin: boolean
  isJudge: boolean
  loginWithEmail: (email: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Sync Firebase Auth state with localStorage session
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      const stored = localStorage.getItem(SESSION_KEY)
      if (firebaseUser && stored) {
        try {
          const parsed: AppUser = JSON.parse(stored)
          if (parsed.role) parsed.role = parsed.role.toLowerCase() as AppUser['role']
          setUser(parsed)
          console.log('[Auth] Sessão restaurada', { role: parsed.role })
        } catch {
          localStorage.removeItem(SESSION_KEY)
        }
      } else {
        // Firebase session expired or no local data → clean up
        if (stored) localStorage.removeItem(SESSION_KEY)
        setUser(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const loginWithEmail = async (email: string) => {
    // Sign into Firebase (anonymously) so Firebase Storage rules are satisfied
    const { user: firebaseUser } = await signInAnonymously(auth)
    const token = await firebaseUser.getIdToken()

    console.log('[Auth] Validando email na API:', email)
    const res = await authApi.login(email, token)

    if (res.data.message) {
      console.warn('[Auth] Usuário não cadastrado no sistema:', res.data.message)
      throw new Error(res.data.message)
    }

    const appUser: AppUser = {
      uid: email,
      email,
      displayName: null,
      photoURL: null,
      role: (res.data.role?.toLowerCase() ?? null) as AppUser['role'],
      idPerson: res.data.idPerson ?? null,
    }
    console.log('[Auth] API login data:', { role: appUser.role, idPerson: appUser.idPerson })
    console.log('[Auth] Usuário configurado:', appUser)

    localStorage.setItem(SESSION_KEY, JSON.stringify(appUser))
    setUser(appUser)
  }

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    const { user: firebaseUser } = await signInWithPopup(auth, provider)
    const email = firebaseUser.email!

    console.log('[Auth] Google sign-in OK, validando no backend:', email)
    const token = await firebaseUser.getIdToken()
    const res = await authApi.login(email, token)

    if (res.data.message) {
      console.warn('[Auth] Email Google não cadastrado no sistema:', res.data.message)
      await signOut(auth)
      throw new Error(res.data.message)
    }

    const appUser: AppUser = {
      uid: firebaseUser.uid,
      email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      role: (res.data.role?.toLowerCase() ?? null) as AppUser['role'],
      idPerson: res.data.idPerson ?? null,
    }
    console.log('[Auth] Google login OK:', { role: appUser.role, idPerson: appUser.idPerson })

    localStorage.setItem(SESSION_KEY, JSON.stringify(appUser))
    setUser(appUser)
  }

  const logout = async () => {
    console.log('[Auth] Usuário deslogado')
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
    await signOut(auth)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin: user?.role === 'admin',
        isJudge: user?.role === 'judge',
        loginWithEmail,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
