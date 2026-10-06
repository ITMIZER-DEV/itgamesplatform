import { ScoreBadges } from './ScoreBadges'
import type { Score } from '@/types/score'
import { cn } from '@/lib/utils'

function RankNum({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        'text-3xl font-black w-10 text-center shrink-0',
        rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-zinc-300' : rank === 3 ? 'text-amber-600' : 'text-muted-foreground'
      )}
    >
      {rank}
    </span>
  )
}

export function ScoreCard({ score, rank }: { score: Score; rank: number }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3">
      <RankNum rank={rank} />

      <div className="flex-1 min-w-0">
        <p className="font-bold uppercase text-sm leading-tight truncate">{score.registration?.team}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {score.registration?.athletes?.map((a: any) => a.name).join(' · ')}
        </p>
      </div>

      <ScoreBadges score={score} className="shrink-0" />
    </div>
  )
}
