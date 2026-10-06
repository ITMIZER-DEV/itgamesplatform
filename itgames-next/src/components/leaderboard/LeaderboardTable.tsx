'use client'
import { motion } from 'framer-motion'
import { LeaderboardRow } from './LeaderboardRow'
import { Skeleton } from '@/components/ui/skeleton'
import type { LeaderboardEntry } from '@/types/score'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
}

const row = {
  hidden: { opacity: 0, x: -16 },
  show: { opacity: 1, x: 0 },
}

export function LeaderboardTable({
  entries,
  loading,
}: {
  entries: LeaderboardEntry[]
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-px">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-none first:rounded-t-lg last:rounded-b-lg" />
        ))}
      </div>
    )
  }

  if (!entries.length) {
    return (
      <div className="py-16 text-center text-muted-foreground text-sm">
        Nenhuma pontuação registrada ainda.
      </div>
    )
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="rounded-xl border border-border overflow-hidden"
    >
      {entries.map((entry) => (
        <motion.div key={entry.Rank} variants={row}>
          <LeaderboardRow entry={entry} />
        </motion.div>
      ))}
    </motion.div>
  )
}
