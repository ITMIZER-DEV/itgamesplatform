'use client'
import { useParams, useRouter } from 'next/navigation'
import { useGame } from '@/hooks/useGames'
import { RegisterTeamForm } from '@/components/forms/RegisterTeamForm'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function RegisterPage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const { game, loading } = useGame(code)

  if (loading) {
    return (
      <div className="container mx-auto py-10 px-4 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    )
  }

  if (!game) {
    return (
      <div className="container mx-auto py-20 px-4 text-center space-y-4">
        <h1 className="text-2xl font-black uppercase">Campeonato não encontrado</h1>
        <Button onClick={() => router.back()}>Voltar</Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-2xl">
      <div className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">Inscrição</h1>
          <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">{game.name}</p>
        </div>
      </div>

      <div className="bg-zinc-900/40 border border-white/5 p-6 md:p-8 rounded-3xl shadow-2xl backdrop-blur-sm">
        <RegisterTeamForm 
          game={game} 
          onSuccess={() => {
            alert('Inscrição realizada com sucesso!')
            router.push(`/games/${code}`)
          }} 
        />
      </div>
    </div>
  )
}
