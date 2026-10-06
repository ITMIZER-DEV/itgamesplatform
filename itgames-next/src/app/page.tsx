'use client'
import { Search, Calendar as CalendarIcon, Filter, ExternalLink, Trophy, History, X } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useGames } from '@/hooks/useGames'
import { GameGrid } from '@/components/game/GameGrid'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { ContactModal } from '@/components/modals/ContactModal'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export default function HomePage() {
  const { games, loading } = useGames()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Ativo' | 'Inativo' | 'New' | 'Cancelado'>('All')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [isContactOpen, setIsContactOpen] = useState(false)

  const filtered = useMemo(() => {
    return games.filter((g) => {
      // Busca robusta (Case insensitive + Trim)
      const searchTerm = search.trim().toLowerCase()
      const matchesSearch = !searchTerm || g.name?.toLowerCase().includes(searchTerm)
      
      // Filtro de Status
      const matchesStatus = statusFilter === 'All' || g.status === statusFilter
      
      // Filtro de Período (Data Início / Fim)
      let matchesRange = true
      if (g.date) {
        const gameDate = new Date(g.date).getTime()
        if (startDate) {
          const start = new Date(startDate).getTime()
          if (gameDate < start) matchesRange = false
        }
        if (endDate) {
          const end = new Date(endDate).getTime()
          if (gameDate > end) matchesRange = false
        }
      }

      return matchesSearch && matchesStatus && matchesRange
    })
  }, [games, search, statusFilter, startDate, endDate])

  const activeGames = filtered.filter(g => g.status === 'Ativo' || g.status === 'New' || !g.status)
  const pastGames = filtered.filter(g => g.status === 'Inativo')

  const resetFilters = () => {
    setSearch('')
    setStatusFilter('All')
    setStartDate('')
    setEndDate('')
  }

  const hasActiveFilters = search || statusFilter !== 'All' || startDate || endDate

  return (
    <div className="min-h-screen bg-background">
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />

      {/* ────────────────── HERO SECTION ────────────────── */}
      <section className="relative h-[60vh] min-h-[400px] w-full flex items-center justify-center overflow-hidden">
        {/* Background Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1541534741688-6078c64b5903?q=80&w=2070&auto=format&fit=crop" 
            alt="CrossFit Arena" 
            className="w-full h-full object-cover grayscale-[0.5] brightness-[0.4]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background" />
        </div>

        <div className="container relative z-10 px-4 text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <Badge variant="outline" className="mb-4 border-primary/50 text-primary px-4 py-1.5 uppercase tracking-widest text-xs font-bold bg-primary/5">
              Finding the Fittest on Earth
            </Badge>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic leading-none mb-4">
              IT.GAMES <span className="text-primary tracking-normal not-italic">2026</span>
            </h1>
            <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto font-medium leading-relaxed">
              A maior rede de competições de CrossFit do Brasil. <br className="hidden md:block" />
              Acompanhe resultados, leaderboards e a evolução dos atletas em tempo real.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="flex flex-wrap items-center justify-center gap-4 pt-4"
          >
            <Button size="lg" className="rounded-full px-8 font-bold text-base h-12 shadow-lg shadow-primary/20" onClick={() => {
              const el = document.getElementById('competitions')
              el?.scrollIntoView({ behavior: 'smooth' })
            }}>
              Ver Rankings
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-8 font-bold text-base h-12 border-zinc-700 bg-white/5 backdrop-blur-sm" onClick={() => setIsContactOpen(true)}>
              Organize seu Evento
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ────────────────── FILTER BAR ────────────────── */}
      <section id="competitions" className="sticky top-14 z-40 w-full border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="container px-4 py-4">
          <div className="flex flex-col lg:flex-row items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="PROCURAR CAMPEONATO..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-11 bg-zinc-900/70 border-zinc-800 focus:border-primary/50 text-sm font-bold tracking-widest uppercase placeholder:text-zinc-500 text-zinc-100"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Status Select */}
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-[140px] h-11 bg-zinc-900/50 border-zinc-800 text-xs font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-primary" />
                    <SelectValue placeholder="Status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">TODOS</SelectItem>
                  <SelectItem value="Ativo">ATIVOS</SelectItem>
                  <SelectItem value="New">NOVOS</SelectItem>
                  <SelectItem value="Inativo">ENCERRADOS</SelectItem>
                  <SelectItem value="Cancelado">CANCELADOS</SelectItem>
                </SelectContent>
              </Select>

              {/* Date Range Group */}
              <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-md px-2 h-11">
                <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-[10px] font-bold uppercase tracking-wider text-white focus:ring-0 w-28"
                  placeholder="Início"
                />
                <span className="text-zinc-600 text-xs">ATÉ</span>
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none text-[10px] font-bold uppercase tracking-wider text-white focus:ring-0 w-28"
                  placeholder="Fim"
                />
              </div>

              {/* Reset Button */}
              {hasActiveFilters && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={resetFilters}
                  className="h-11 px-3 text-zinc-500 hover:text-white"
                >
                  <X className="h-4 w-4 mr-2" /> Limpar
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────── CONTENT ────────────────── */}
      <main className="container px-4 py-12 space-y-16">
        
        {/* Active Competitions */}
        <section className="space-y-8">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
              <span className="h-8 w-1.5 bg-primary rounded-full" />
              Próximos Campeonatos
            </h2>
            <Badge variant="secondary" className="bg-zinc-900 text-zinc-400 font-bold px-3 text-lg py-1">
              {activeGames.length}
            </Badge>
          </div>
          
          <GameGrid games={activeGames} loading={loading} />
          
          {!loading && activeGames.length === 0 && (
            <div className="py-20 text-center border-2 border-dashed border-zinc-800 rounded-3xl">
               <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Nenhum campeonato ativo encontrado para estes filtros.</p>
            </div>
          )}
        </section>

        {/* Past Competitions */}
        {pastGames.length > 0 && (
          <section className="space-y-8 pt-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3 opacity-60">
                <History className="h-6 w-6 text-zinc-500" />
                Histórico de Eventos
              </h2>
              <Badge variant="outline" className="text-zinc-500 font-bold px-3">
                {pastGames.length}
              </Badge>
            </div>
            
            <div className="opacity-70 contrast-75 hover:opacity-100 transition-opacity duration-500">
              <GameGrid games={pastGames} loading={loading} />
            </div>
          </section>
        )}

      </main>

      {/* Footer / CTA Footer */}
      <section className="bg-zinc-900/30 border-t border-white/5 py-16 mt-12 text-center">
        <div className="container px-4 space-y-4">
          <h3 className="text-xl font-bold uppercase tracking-widest text-zinc-500">Quer organizar seu campeonato?</h3>
          <p className="text-zinc-600 max-w-lg mx-auto text-sm">Oferecemos a melhor plataforma para gestão de scores, sumulas e leaderboards em tempo real.</p>
          <Button 
            variant="link" 
            className="text-primary font-black uppercase tracking-widest gap-2"
            onClick={() => setIsContactOpen(true)}
          >
            ENTRAR EM CONTATO <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </section>
    </div>
  )
}
