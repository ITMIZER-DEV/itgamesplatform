'use client'
import { motion } from 'framer-motion'
import { GameCard } from './GameCard'
import { GameCardSkeleton } from './GameCardSkeleton'
import type { Game } from '@/types/game'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}

const item = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } },
}

export function GameGrid({ games, loading }: { games: Game[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <GameCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!games.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p className="text-lg font-semibold">Nenhum campeonato disponível</p>
        <p className="text-sm mt-1">Volte em breve!</p>
      </div>
    )
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {games.map((g) => (
        <motion.div key={g.code} variants={item}>
          <GameCard game={g} />
        </motion.div>
      ))}
    </motion.div>
  )
}
