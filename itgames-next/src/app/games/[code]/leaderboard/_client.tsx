'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useGame } from '@/hooks/useGames'
import { useEvents } from '@/hooks/useEvents'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { PublicLeaderboardTable } from '@/components/leaderboard/PublicLeaderboardTable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trophy, ArrowLeft, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function LeaderboardClient() {
  const { code } = useParams<{ code: string }>()
  const { game, loading: gameLoading } = useGame(code)
  const [selectedCategory, setSelectedCategory] = useState('')
  const { entries, loading: lbLoading } = useLeaderboard(code, selectedCategory)
  const { events, loading: eventsLoading } = useEvents(code, selectedCategory)

  const categories = game?.categories ?? []

  // Selecionar primeira categoria automaticamente
  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      setSelectedCategory(String(categories[0].code))
    }
  }, [categories, selectedCategory])

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-700">
      {/* Header com Navegação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="rounded-full hover:bg-muted/50">
            <Link href={`/games/${code}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="space-y-0.5">
             <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-black uppercase tracking-tighter">Leaderboard</h1>
             </div>
             <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{game?.name || 'Carregando...'}</p>
          </div>
        </div>

        <Button asChild variant="outline" size="sm" className="hidden sm:flex rounded-full px-4 border-primary/20 hover:border-primary/50 text-xs font-bold uppercase tracking-wider">
           <Link href="/games">
              <LayoutGrid className="mr-2 h-3.5 w-3.5" />
              Ver outros jogos
           </Link>
        </Button>
      </div>

      {!gameLoading && game && categories.length > 0 ? (
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="space-y-6">
          <div className="flex justify-center">
            <TabsList className="bg-muted/40 p-1 rounded-full h-auto flex flex-wrap justify-center border border-border/50">
              {categories.map((c) => (
                <TabsTrigger
                  key={c.code}
                  value={String(c.code)}
                  className="rounded-full px-6 py-2 text-xs font-black uppercase tracking-tight data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300"
                >
                  {c.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value={selectedCategory} className="mt-0 focus-visible:outline-none focus-visible:ring-0">
             <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                   <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Atualizado em tempo real</span>
                   </div>
                   {selectedCategory && (
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                         {categories.find(c => String(c.code) === selectedCategory)?.name}
                      </span>
                   )}
                </div>

                <PublicLeaderboardTable
                   entries={entries}
                   loading={lbLoading || eventsLoading}
                   events={events}
                   showTime={game.showTime}
                   showWeight={game.showWeight}
                   showReps={game.showReps}
                />
             </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="py-20 text-center space-y-4">
           {!gameLoading && (
              <>
                 <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground/30" />
                 <p className="text-muted-foreground font-medium">Nenhuma categoria encontrada para este campeonato.</p>
              </>
           )}
           {gameLoading && <div className="h-12 w-full animate-pulse bg-muted rounded-full" />}
        </div>
      )}

      {/* Footer Mobile Fix */}
      <div className="flex sm:hidden justify-center pt-4">
        <Button asChild variant="ghost" size="sm" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
           <Link href="/games">Ver Outros Campeonatos</Link>
        </Button>
      </div>
    </div>
  )
}
