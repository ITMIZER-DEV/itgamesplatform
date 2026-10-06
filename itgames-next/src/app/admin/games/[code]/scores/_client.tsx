'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useGame } from '@/hooks/useGames'
import { useEvents } from '@/hooks/useEvents'
import { useScores } from '@/hooks/useScores'
import { CategoryEventFilter } from '@/components/leaderboard/CategoryEventFilter'
import { DeleteScoreButton } from '@/components/score/DeleteScoreButton'
import { ScoreBadges } from '@/components/score/ScoreBadges'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'

export default function AdminScoresClient() {
  const { code } = useParams<{ code: string }>()
  const { game, loading: gameLoading } = useGame(code)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedEvent, setSelectedEvent] = useState('')

  const { events, loading: eventsLoading } = useEvents(code, selectedCategory)
  const { scores, loading: scoresLoading, refetch } = useScores(code, selectedCategory, selectedEvent)

  const handleCategoryChange = (v: string) => {
    setSelectedCategory(v)
    setSelectedEvent('')
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/admin/games/${code}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-black">Gerenciar Scores</h1>
      </div>

      {!gameLoading && game && (
        <CategoryEventFilter
          categories={game.categories ?? []}
          events={events}
          selectedCategory={selectedCategory}
          selectedEvent={selectedEvent}
          onCategoryChange={handleCategoryChange}
          onEventChange={setSelectedEvent}
          loadingEvents={eventsLoading}
        />
      )}

      {!selectedEvent ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          Selecione categoria e evento.
        </p>
      ) : scoresLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : !scores.length ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          Nenhum score para este evento.
        </p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {scores.map((score, idx) => (
            <div
              key={score.code ?? idx}
              className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
            >
              <span className="text-xl font-black text-muted-foreground w-8 text-center">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{score.registration?.team}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {score.registration?.athletes?.map((a: any) => a.name).join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ScoreBadges score={score} className="text-xs" />
                {score.code && (
                  <DeleteScoreButton scoreCode={String(score.code)} onDeleted={refetch} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
