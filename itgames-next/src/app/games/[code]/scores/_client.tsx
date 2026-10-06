'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useGame } from '@/hooks/useGames'
import { useEvents } from '@/hooks/useEvents'
import { useScores } from '@/hooks/useScores'
import { ScoreCard } from '@/components/score/ScoreCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export default function ScoresClient() {
  const { code } = useParams<{ code: string }>()
  const { game, loading: gameLoading } = useGame(code)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedEvent, setSelectedEvent] = useState('')

  const categories = game?.categories ?? []

  // Auto-select first category once game loads
  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      setSelectedCategory(String(categories[0].code))
    }
  }, [categories, selectedCategory])

  const { events, loading: eventsLoading } = useEvents(code, selectedCategory)
  const { scores, loading: scoresLoading } = useScores(code, selectedCategory, selectedEvent)

  function handleCategoryChange(v: string) {
    setSelectedCategory(v)
    setSelectedEvent('')
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-black">Scores por Evento</h1>

      {gameLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-28 rounded-lg" />
            ))}
          </div>
        </div>
      ) : !categories.length ? (
        <p className="text-muted-foreground text-sm py-12 text-center">
          Nenhuma categoria disponível.
        </p>
      ) : (
        <Tabs value={selectedCategory} onValueChange={handleCategoryChange}>
          {/* ── Category tabs ── */}
          <TabsList className="w-full overflow-x-auto flex flex-nowrap h-auto gap-1 p-1">
            {categories.map((cat) => (
              <TabsTrigger
                key={cat.code}
                value={String(cat.code)}
                className="whitespace-nowrap text-xs sm:text-sm"
              >
                {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Tab content (same for all categories, driven by selectedCategory state) ── */}
          {categories.map((cat) => (
            <TabsContent key={cat.code} value={String(cat.code)} className="mt-4 space-y-4">
              {/* Event selector */}
              {eventsLoading ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-28 rounded-lg" />
                  ))}
                </div>
              ) : !events.length ? (
                <p className="text-muted-foreground text-sm py-6 text-center">
                  Nenhum evento cadastrado para esta categoria.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {events.map((event) => (
                    <button
                      key={event.idEvent}
                      type="button"
                      onClick={() => setSelectedEvent(String(event.idEvent))}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                        selectedEvent === String(event.idEvent)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border hover:border-primary/50 text-foreground'
                      )}
                    >
                      {event.title}
                    </button>
                  ))}
                </div>
              )}

              {/* Score list */}
              {!selectedEvent ? (
                <p className="text-muted-foreground text-sm py-8 text-center">
                  Selecione um evento para ver os scores.
                </p>
              ) : scoresLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : !scores.length ? (
                <p className="text-muted-foreground text-sm py-8 text-center">
                  Nenhum score registrado para este evento.
                </p>
              ) : (
                <div className="space-y-3">
                  {scores.map((score, idx) => (
                    <ScoreCard key={score.code ?? idx} score={score} rank={idx + 1} />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
