'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { judgesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Trophy, ChevronRight, LogOut } from 'lucide-react'
import { toast } from 'sonner'

export default function JudgeDashboard() {
  const { user, logout } = useAuth()
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadGames() {
      if (!user?.idPerson) return
      try {
        const res = await judgesApi.listByPerson(user.idPerson)
        setGames(res.data)
      } catch (error) {
        console.error('Erro ao carregar games:', error)
        toast.error('Erro ao carregar campeonatos.')
      } finally {
        setLoading(false)
      }
    }
    loadGames()
  }, [user])

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Trophy className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-black text-xl leading-tight">Painel do Juiz</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">
              {user?.displayName || 'Juiz Oficial'}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={logout} className="rounded-full">
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase text-muted-foreground tracking-wider">
          Seus Campeonatos
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-12 bg-muted/20 rounded-2xl border-2 border-dashed border-muted">
            <p className="text-muted-foreground text-sm">Nenhum campeonato vinculado ao seu perfil.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {games.map((game) => (
              <Link 
                key={game.code} 
                href={`/judge/game/${game.code}`}
                className="group flex items-center justify-between p-4 bg-card rounded-2xl border border-border shadow-sm hover:border-primary/50 transition-all hover:scale-[1.01]"
              >
                <div className="flex items-center gap-4">
                  {game.foto ? (
                    <img src={game.foto} alt={game.name} className="h-12 w-12 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                      <Trophy className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-black uppercase truncate">{game.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {game.location || 'Brasil'} · {game.date || 'Em breve'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <footer className="pt-8 text-center">
        <p className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-[0.2em]">
          Plataforma IT.GAMES 2026
        </p>
      </footer>
    </div>
  )
}
