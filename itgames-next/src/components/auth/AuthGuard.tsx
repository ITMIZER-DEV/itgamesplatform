'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

interface AuthGuardProps {
  children: React.ReactNode
  requireAdmin?: boolean
  requireJudge?: boolean
}

export function AuthGuard({ children, requireAdmin = false, requireJudge = false }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (requireAdmin && user.role !== 'admin') {
      router.replace('/')
      return
    }
    if (requireJudge && user.role !== 'judge' && user.role !== 'admin') {
      // Permissionamento: Admin também pode ver área do Judge se quiser
      router.replace('/')
    }
  }, [user, loading, requireAdmin, requireJudge, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) return null
  if (requireAdmin && user.role !== 'admin') return null
  if (requireJudge && user.role !== 'judge' && user.role !== 'admin') return null

  return <>{children}</>
}
