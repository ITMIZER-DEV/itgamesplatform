'use client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useGame } from '@/hooks/useGames'
import { GameForm } from '@/components/forms/GameForm'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'

export default function EditGameClient() {
  const { code } = useParams<{ code: string }>()
  const { game, loading } = useGame(code)
  const router = useRouter()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/admin/games/${code}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-black">Editar Campeonato</h1>
      </div>

      <div className="max-w-2xl">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : game ? (
          <GameForm
            initial={game}
            gameCode={code}
            onSuccess={() => router.push(`/admin/games/${code}`)}
          />
        ) : (
          <p className="text-muted-foreground">Campeonato não encontrado.</p>
        )}
      </div>
    </div>
  )
}
