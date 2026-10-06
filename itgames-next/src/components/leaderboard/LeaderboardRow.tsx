'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn, calculateAdjustedTime } from '@/lib/utils'
import type { LeaderboardEntry } from '@/types/score'

function RankBadge({ rank }: { rank: number }) {
  const classes =
    rank === 1
      ? 'text-yellow-400'
      : rank === 2
      ? 'text-zinc-300'
      : rank === 3
      ? 'text-amber-600'
      : 'text-muted-foreground'
  return <span className={cn('text-2xl font-black w-10 text-center shrink-0', classes)}>#{rank}</span>
}

export function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 py-3 px-4 hover:bg-muted/40 transition-colors text-left"
      >
        <RankBadge rank={entry.Rank} />
        <div className="flex-1 min-w-0">
          <p className="font-bold uppercase text-sm truncate">{entry.registration?.team}</p>
          <p className="text-xs text-muted-foreground truncate">
            {entry.registration?.athletes?.map((a) => a.name).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-primary font-bold text-sm">{entry.points} pts</span>
          <ChevronDown
            className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')}
          />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-2">
              {entry.registration?.scores?.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs bg-muted/30 rounded-md px-3 py-2"
                >
                  <span className="text-muted-foreground font-medium">{s.eventRef?.title || 'WOD'}</span>
                  <div className="flex items-center gap-3">
                    {s.isWO ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold text-[10px] uppercase">
                        WO
                      </span>
                    ) : (
                      <span className="text-foreground font-medium">
                        {s.time ? (
                          <>
                            {calculateAdjustedTime(s.time, s.reps || 0)}
                            {s.reps && Number(s.reps) > 0 ? (
                              <span className="text-amber-500 ml-1 text-[10px]">
                                ({s.time} +{s.reps})
                              </span>
                            ) : null}
                          </>
                        ) : s.weight ? (
                          `${s.weight}kg`
                        ) : s.reps ? (
                          `${s.reps} reps`
                        ) : '-'}
                      </span>
                    )}
                    <span className="text-primary font-semibold">{s.point} pts</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
