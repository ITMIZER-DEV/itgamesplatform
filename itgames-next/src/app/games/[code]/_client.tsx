'use client'
import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useGame } from '@/hooks/useGames'
import { useEvents } from '@/hooks/useEvents'
import { useScores } from '@/hooks/useScores'
import { useWorkouts } from '@/hooks/useWorkouts'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScoreCard } from '@/components/score/ScoreCard'
import { PublicLeaderboardTable } from '@/components/leaderboard/PublicLeaderboardTable'
import { GameHero } from '@/components/game/GameHero'
import { Trophy, Dumbbell, Receipt, Info, AlignLeft, LayoutGrid, Clock, Weight, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

export default function GameDetailClient() {
  const { code } = useParams<{ code: string }>()
  const { game, loading: gameLoading } = useGame(code)
  
  const [activeTab, setActiveTab] = useState('workouts')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedEvent, setSelectedEvent] = useState('')

  const categories = useMemo(() => game?.categories ?? [], [game])

  // Lógica de seleção automática
  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      setSelectedCategory(String(categories[0].code))
    }
  }, [categories, selectedCategory])

  // Hooks de Dados
  const { workouts, loading: workoutsLoading } = useWorkouts(code)
  const { events, loading: eventsLoading } = useEvents(code, selectedCategory)
  const { scores, loading: scoresLoading } = useScores(code, selectedCategory, selectedEvent)
  const { entries, loading: lbLoading } = useLeaderboard(code, selectedCategory)

  if (gameLoading) {
    return (
      <div className="min-h-screen bg-background space-y-8 pb-20">
        <Skeleton className="h-[50vh] w-full" />
        <div className="container px-4 space-y-6">
          <Skeleton className="h-12 w-1/2" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground font-black uppercase tracking-widest">
        Campeonato não encontrado.
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <GameHero game={game} />

      <main className="container px-4 -mt-10 relative z-20">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          
          {/* ────────────────── TABS NAVIGATION ────────────────── */}
          <div className="flex justify-center sm:justify-start">
            <TabsList className="bg-zinc-900/80 backdrop-blur-xl border border-white/5 p-1.5 rounded-2xl h-auto shadow-2xl">
              <TabsTrigger 
                value="workouts" 
                className="rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-tighter data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300"
              >
                <AlignLeft className="h-3.5 w-3.5 mr-2" /> Workouts
              </TabsTrigger>
              
              {game.showScoreRevision && (
                <TabsTrigger 
                  value="scores" 
                  className="rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-tighter data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300"
                >
                  <Receipt className="h-3.5 w-3.5 mr-2" /> Revisão
                </TabsTrigger>
              )}

              <TabsTrigger 
                value="leaderboard" 
                className="rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-tighter data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300"
              >
                <Trophy className="h-3.5 w-3.5 mr-2" /> Leaderboard
              </TabsTrigger>
            </TabsList>
          </div>

          <AnimatePresence mode="wait">
            {/* ────────────────── WORKOUTS TAB ────────────────── */}
            <TabsContent value="workouts" className="m-0 border-none outline-none">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Eventos do Campeonato</h2>
                  <div className="h-[1px] flex-1 bg-white/5" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {workoutsLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-3xl" />)
                  ) : !workouts.length ? (
                    <div className="col-span-full py-20 text-center text-muted-foreground uppercase font-bold tracking-widest text-sm bg-zinc-900/20 rounded-3xl border border-dashed border-white/5">
                      Nenhum workout cadastrado ainda.
                    </div>
                  ) : (
                    workouts.map((wod) => (
                      <div key={wod.code} className="group relative bg-zinc-900/40 border border-white/5 rounded-3xl p-6 hover:border-primary/30 transition-all duration-500 overflow-hidden shadow-xl">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
                          <Zap className="h-20 w-20 text-primary" />
                        </div>
                        
                        <div className="relative space-y-4">
                          <Badge variant="outline" className="border-primary/40 text-primary text-[10px] font-black uppercase tracking-widest px-2 py-0.5">
                            {wod.Category?.name || 'Workout'}
                          </Badge>
                          <h3 className="text-xl font-black uppercase tracking-tighter group-hover:text-primary transition-colors">{wod.title}</h3>
                          
                          <div className="flex items-center gap-4 text-xs font-bold text-zinc-500 uppercase">
                            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-primary" /> {wod.timeCap || 'No Cap'}</span>
                            <span className="flex items-center gap-1.5"><Weight className="h-3.5 w-3.5 text-primary" /> {wod.type || 'For Time'}</span>
                          </div>

                          {wod.description && (
                            <p className="text-sm text-zinc-400 line-clamp-3 font-medium leading-normal pt-2">
                              {wod.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </TabsContent>

            {/* ────────────────── SCORE REVISION TAB ────────────────── */}
            {game.showScoreRevision && (
              <TabsContent value="scores" className="m-0 border-none outline-none">
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {/* Category & Event Selectors */}
                  <div className="flex flex-col sm:flex-row gap-4 bg-zinc-900/40 border border-white/5 p-4 rounded-3xl shadow-lg">
                    <div className="flex-1 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Categoria</p>
                      <div className="flex flex-wrap gap-2">
                        {categories.map((cat) => (
                          <button
                            key={cat.code}
                            onClick={() => { setSelectedCategory(String(cat.code)); setSelectedEvent('') }}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tighter transition-all duration-300 border",
                              selectedCategory === String(cat.code)
                                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                                : "bg-zinc-900/50 border-white/5 text-zinc-500 hover:text-zinc-300"
                            )}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Evento</p>
                      <div className="flex flex-wrap gap-2">
                        {eventsLoading ? <Skeleton className="h-8 w-32" /> : events.map((ev) => (
                          <button
                            key={ev.idEvent}
                            onClick={() => setSelectedEvent(String(ev.idEvent))}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                              selectedEvent === String(ev.idEvent)
                                ? "bg-white text-black border-white"
                                : "bg-transparent border-white/10 text-zinc-500 hover:border-white/30"
                            )}
                          >
                            {ev.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Scores List */}
                  <div className="space-y-3">
                    {!selectedEvent ? (
                      <div className="py-20 text-center text-muted-foreground uppercase font-bold tracking-widest text-sm bg-zinc-900/20 rounded-3xl border border-dashed border-white/5">
                        Selecione um evento para revisar os scores.
                      </div>
                    ) : scoresLoading ? (
                      Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)
                    ) : !scores.length ? (
                      <div className="py-20 text-center text-muted-foreground uppercase font-bold tracking-widest text-sm">
                        Nenhum score registrado para este evento.
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {scores.map((score, idx) => (
                          <ScoreCard key={score.code ?? idx} score={score} rank={idx + 1} />
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              </TabsContent>
            )}

            {/* ────────────────── LEADERBOARD TAB ────────────────── */}
            <TabsContent value="leaderboard" className="m-0 border-none outline-none">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Category Selector (Pills style) */}
                <div className="flex justify-center flex-wrap gap-2 py-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.code}
                      onClick={() => setSelectedCategory(String(cat.code))}
                      className={cn(
                        "px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-tight transition-all duration-300",
                        selectedCategory === String(cat.code)
                          ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20 scale-105"
                          : "bg-zinc-900/50 text-zinc-500 hover:bg-zinc-800"
                      )}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Live Update</span>
                    </div>
                    {selectedCategory && (
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">
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
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </main>
    </div>
  )
}
