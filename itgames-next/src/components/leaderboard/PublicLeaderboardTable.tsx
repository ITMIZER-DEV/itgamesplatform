'use client'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { LeaderboardEntry } from '@/types/score'

interface Props {
  entries: LeaderboardEntry[]
  loading?: boolean
  showTime?: boolean
  showWeight?: boolean
  showReps?: boolean
  events?: Array<{ idEvent: number; title: string }>
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
}

export function PublicLeaderboardTable({
  entries,
  loading,
  showTime = true,
  showWeight = true,
  showReps = true,
  events = []
}: Props) {
  if (loading) {
    return (
      <div className="w-full space-y-2 animate-pulse">
        <div className="h-12 bg-muted rounded-lg w-full" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted/50 rounded-lg w-full" />
        ))}
      </div>
    )
  }

  if (!entries.length) {
    return (
      <div className="py-20 text-center border-2 border-dashed border-border rounded-2xl">
        <p className="text-muted-foreground font-medium">Nenhum resultado disponível para esta categoria ainda.</p>
      </div>
    )
  }

  const hasDetailFlags = showTime || showWeight || showReps

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="px-4 py-4 text-left font-black uppercase tracking-tighter text-[11px] w-16">Pos</th>
              <th className="px-4 py-4 text-left font-black uppercase tracking-tighter text-[11px] min-w-[200px]">Time / Atletas</th>
              
              {/* Event Columns */}
              {events.map((event) => (
                <th key={event.idEvent} className="px-4 py-4 text-center font-black uppercase tracking-tighter text-[11px] min-w-[120px] border-l border-border/50">
                  {event.title}
                </th>
              ))}
              
              <th className="px-4 py-4 text-center font-black uppercase tracking-tighter text-[11px] w-24 border-l border-border/50 bg-primary/5">Total</th>
            </tr>
          </thead>
          <motion.tbody
            variants={container}
            initial="hidden"
            animate="show"
          >
            {entries.map((entry, idx) => (
              <motion.tr
                key={entry.registration?.team || idx}
                variants={item}
                className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-4">
                  <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-lg font-black text-sm shadow-sm",
                    entry.Rank === 1 ? "bg-yellow-400 text-yellow-950" :
                    entry.Rank === 2 ? "bg-zinc-300 text-zinc-900" :
                    entry.Rank === 3 ? "bg-amber-600 text-white" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {entry.Rank}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div>
                    <p className="font-black uppercase text-sm leading-tight text-foreground truncate max-w-[180px]">
                      {entry.registration?.team}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-medium mt-1 truncate max-w-[180px]">
                      {entry.registration?.athletes?.map(a => a.name).join(' · ')}
                    </p>
                  </div>
                </td>

                {/* Event Cells */}
                {events.map((event) => {
                  const score = entry.registration?.scores?.find(s => s.eventRef?.title === event.title)
                  
                  return (
                    <td key={event.idEvent} className="px-4 py-4 text-center border-l border-border/50">
                      {score ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-xs font-black text-foreground">
                              {score.isWO ? 'WO' : `#${score.rank}`}
                            </span>
                            <span className="text-[10px] text-primary font-bold">
                               {score.point} pts
                            </span>
                          </div>
                          
                          {/* Visibility conditional details */}
                          {hasDetailFlags && !score.isWO && (
                            <div className="text-[10px] text-muted-foreground font-mono bg-muted/50 rounded py-0.5 px-1 inline-block">
                              {[
                                showTime && score.time,
                                showWeight && score.weight ? `${score.weight}kg` : null,
                                showReps && score.reps ? `${score.reps} reps` : null
                              ].filter(Boolean).join(' | ') || '-'}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/30 font-black">-</span>
                      )}
                    </td>
                  )
                })}

                <td className="px-4 py-4 text-center border-l border-border/50 bg-primary/5">
                  <span className="text-lg font-black text-primary tracking-tight">
                    {entry.points}
                  </span>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </div>
  )
}
