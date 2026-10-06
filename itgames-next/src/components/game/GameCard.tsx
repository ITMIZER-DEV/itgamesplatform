'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Calendar, MapPin, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import type { Game } from '@/types/game'

const statusConfig = {
  Ativo: { label: 'Ativo', className: 'border-green-600 text-green-400' },
  New: { label: 'Novo', className: 'border-orange-500 text-orange-400' },
  Inativo: { label: 'Encerrado', className: 'border-zinc-600 text-zinc-400' },
  Cancelado: { label: 'Cancelado', className: 'border-red-600 text-red-500 bg-red-500/5' },
}

export function GameCard({ game }: { game: Game }) {
  const status = statusConfig[game.status] ?? statusConfig.Inativo

  return (
    <Link href={`/games/${game.code}`}>
      <motion.div
        whileHover={{ scale: 1.02, y: -4 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <Card className="group overflow-hidden border-border bg-card hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-colors duration-300">
          {/* Cover Image */}
          <div className="relative h-44 w-full overflow-hidden bg-zinc-900">
            {game.foto ? (
              <img
                src={game.foto}
                alt={game.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-800">
                <span className="text-4xl font-black text-zinc-700">
                  {game.name?.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-3 left-3">
              <Badge variant="outline" className={status.className}>
                {status.label}
              </Badge>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="font-bold text-base leading-tight line-clamp-2 mb-2">{game.name}</h3>
            <div className="space-y-1 text-xs text-muted-foreground">
              {game.date && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(game.date)}
                </div>
              )}
              {game.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {game.location}
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {game.categories?.length ?? 0} categoria(s)
              </span>
              <ChevronRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </Card>
      </motion.div>
    </Link>
  )
}
