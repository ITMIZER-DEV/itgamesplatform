import { Badge } from '@/components/ui/badge'
import { cn, calculateAdjustedTime } from '@/lib/utils'
import type { Score } from '@/types/score'

interface Props {
  score: Score
  className?: string
}

export function ScoreBadges({ score, className }: Props) {
  return (
    <div className={cn('flex gap-1.5', className)}>
      {score.time && (
        <Badge variant="outline" className="border-blue-500 text-blue-400 font-bold">
          {calculateAdjustedTime(score.time, score.reps || 0)}
          {score.reps && Number(score.reps) > 0 && (
            <span className="ml-1 text-[10px] font-normal opacity-80">
              ({score.time} +{score.reps})
            </span>
          )}
        </Badge>
      )}
      {score.weight && (
        <Badge variant="outline" className="border-yellow-500 text-yellow-400">
          {score.weight}kg
        </Badge>
      )}
      {score.reps && !score.time && (
        <Badge variant="outline" className="border-green-500 text-green-400">
          {score.reps} reps
        </Badge>
      )}
    </div>
  )
}
