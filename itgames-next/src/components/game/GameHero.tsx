'use client'
import { Calendar, MapPin, Share2, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { motion } from 'framer-motion'
import type { Game } from '@/types/game'

interface GameHeroProps {
  game: Game
}

export function GameHero({ game }: GameHeroProps) {
  return (
    <section className="relative w-full h-[50vh] min-h-[450px] flex items-end overflow-hidden">
      {/* Background with Overlay */}
      <div className="absolute inset-0 z-0">
        {game.foto ? (
          <img 
            src={game.foto} 
            alt={game.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-zinc-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <div className="container relative z-10 px-4 pb-12 sm:pb-16">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl space-y-6"
        >
          <div className="space-y-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Badge variant="outline" className="border-primary text-primary font-bold tracking-widest uppercase py-1 px-3 bg-primary/5">
                THE {game.date ? new Date(game.date).getFullYear() : '2026'}
              </Badge>
            </motion.div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter uppercase leading-[0.9] italic">
              {game.name}
            </h1>
            
            {game.description && (
              <p className="text-lg md:text-xl text-zinc-300 font-medium max-w-2xl line-clamp-2 leading-relaxed">
                {game.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm md:text-base font-bold uppercase tracking-wider text-zinc-400">
            {game.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                {game.location}
              </div>
            )}
            {game.date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {formatDate(game.date)}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button size="lg" className="rounded-full px-8 font-black uppercase tracking-widest h-12 shadow-lg shadow-primary/20">
              Inscrever Equipe
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-8 font-black uppercase tracking-widest h-12 bg-white/5 backdrop-blur-md border-zinc-700 hover:bg-white/10">
              Compartilhar <Share2 className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Side Label */}
      <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 rotate-90 hidden lg:block opacity-10">
        <span className="text-8xl font-black uppercase tracking-[0.2em] whitespace-nowrap">
          COMPETITION • 2026
        </span>
      </div>
    </section>
  )
}
