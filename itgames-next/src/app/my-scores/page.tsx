'use client'
import { useEffect, useState } from 'react'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { useAuth } from '@/hooks/useAuth'
import { registrationApi } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Registration } from '@/types/registration'

function MyScoresContent() {
  const { user } = useAuth()
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.idPerson) {
      setLoading(false)
      return
    }
    registrationApi
      .list(user.idPerson)
      .then((res) => setRegistrations(res.data))
      .catch(() => setRegistrations([]))
      .finally(() => setLoading(false))
  }, [user])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (!registrations.length) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p className="font-semibold">Nenhuma inscrição encontrada.</p>
        <p className="text-sm mt-1">Inscreva-se em um campeonato para aparecer aqui.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {registrations.map((reg) => (
        <div key={reg.code} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div>
            <p className="font-bold">{reg.team}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{reg.category}</p>
          </div>
          <Badge
            variant="outline"
            className={
              reg.status === 'Ativo' ? 'border-green-600 text-green-400' : 'border-zinc-600 text-zinc-400'
            }
          >
            {reg.status}
          </Badge>
        </div>
      ))}
    </div>
  )
}

export default function MyScoresPage() {
  return (
    <AuthGuard>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-black mb-6">Meus Scores</h1>
        <MyScoresContent />
      </div>
    </AuthGuard>
  )
}
