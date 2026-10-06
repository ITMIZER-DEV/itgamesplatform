'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useGame } from '@/hooks/useGames'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { RegisterTeamForm } from '@/components/forms/RegisterTeamForm'
import { Skeleton } from '@/components/ui/skeleton'

function RegisterContent() {
  const { code } = useParams<{ code: string }>()
  const { game, loading } = useGame(code)
  const [success, setSuccess] = useState(false)

  if (success) {
    return (
      <div className="rounded-xl border border-green-600/30 bg-green-500/10 p-6 text-center space-y-2">
        <p className="text-xl font-bold text-green-400">Inscrição realizada!</p>
        <p className="text-sm text-muted-foreground">
          Sua equipe foi inscrita com sucesso.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!game) return <p className="text-muted-foreground">Campeonato não encontrado.</p>

  return <RegisterTeamForm game={game} onSuccess={() => setSuccess(true)} />
}

export default function RegisterClient() {
  return (
    <AuthGuard>
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <h1 className="text-2xl font-black mb-6">Inscrição</h1>
        <RegisterContent />
      </div>
    </AuthGuard>
  )
}
