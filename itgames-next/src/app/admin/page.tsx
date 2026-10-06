'use client'
import { useState, useMemo } from 'react'
import { useGames } from '@/hooks/useGames'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Trophy, Plus, TrendingUp, Calendar, MapPin, Settings, Sparkles, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

const statAnim = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1 } }),
}

const cardAnim = {
  hidden: { opacity: 0, scale: 0.95 },
  show: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.05, type: 'spring', stiffness: 300, damping: 25 }
  }),
}

function statusColor(status: string | null | undefined) {
  if (status === 'Ativo') return 'bg-green-500/10 text-green-600 border-green-500/20'
  if (status === 'New') return 'bg-orange-500/10 text-orange-600 border-orange-500/20'
  if (status === 'Inativo') return 'bg-gray-500/10 text-gray-600 border-gray-500/20'
  if (status === 'Cancelado') return 'bg-red-500/10 text-red-600 border-red-500/20'
  return 'bg-gray-500/10 text-gray-600 border-gray-500/20'
}

function statusIcon(status: string | null | undefined) {
  if (status === 'Ativo') return TrendingUp
  if (status === 'New') return Sparkles
  if (status === 'Inativo') return XCircle
  if (status === 'Cancelado') return XCircle
  return Trophy
}

export default function AdminDashboard() {
  const { games, loading } = useGames(true) // includeInactive = true para admin
  const [activeTab, setActiveTab] = useState<'todos' | 'ativos' | 'novos' | 'inativos'>('todos')

  const stats = useMemo(() => {
    const total = games.length
    const ativos = games.filter((g) => g.status === 'Ativo').length
    const novos = games.filter((g) => g.status === 'New').length
    const inativos = games.filter((g) => g.status === 'Inativo' || g.status === 'Cancelado').length

    return [
      { label: 'Total de Campeonatos', value: total, icon: Trophy, color: 'text-purple-500' },
      { label: 'Ativos', value: ativos, icon: TrendingUp, color: 'text-green-500' },
      { label: 'Novos', value: novos, icon: Sparkles, color: 'text-orange-500' },
      { label: 'Inativos/Cancelados', value: inativos, icon: XCircle, color: 'text-gray-500' },
    ]
  }, [games])

  const filteredGames = useMemo(() => {
    if (activeTab === 'todos') return games
    if (activeTab === 'ativos') return games.filter(g => g.status === 'Ativo')
    if (activeTab === 'novos') return games.filter(g => g.status === 'New')
    if (activeTab === 'inativos') return games.filter(g => g.status === 'Inativo' || g.status === 'Cancelado')
    return games
  }, [games, activeTab])

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Dashboard</h1>
        <Button asChild size="sm">
          <Link href="/admin/games/new" className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Novo Campeonato
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} custom={i} variants={statAnim} initial="hidden" animate="show">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-black">{loading ? '—' : s.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Games with Tabs */}
      <div>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Campeonatos</h2>
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="ativos">Ativos</TabsTrigger>
              <TabsTrigger value="novos">Novos</TabsTrigger>
              <TabsTrigger value="inativos">Inativos</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={activeTab} className="mt-0">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2 mt-2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3 mt-2" />
                    </CardContent>
                    <CardFooter>
                      <Skeleton className="h-10 w-full" />
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : filteredGames.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Trophy className="h-16 w-16 text-muted-foreground/40 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Nenhum campeonato encontrado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTab === 'todos' && 'Crie seu primeiro campeonato para começar'}
                  {activeTab === 'ativos' && 'Nenhum campeonato ativo no momento'}
                  {activeTab === 'novos' && 'Nenhum campeonato novo aguardando ativação'}
                  {activeTab === 'inativos' && 'Nenhum campeonato inativo ou cancelado'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGames.map((game, i) => {
                  const StatusIcon = statusIcon(game.status)

                  return (
                    <motion.div
                      key={game.code}
                      custom={i}
                      variants={cardAnim}
                      initial="hidden"
                      animate="show"
                    >
                      <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-lg leading-tight line-clamp-2">{game.name}</CardTitle>
                            <Badge className={statusColor(game.status)}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {game.status || 'Novo'}
                            </Badge>
                          </div>
                          {game.date && (
                            <CardDescription className="flex items-center gap-1.5 text-xs mt-2">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(game.date).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="pb-3 flex-1">
                          {game.location && (
                            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              {game.location}
                            </p>
                          )}
                          {game.description && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {game.description}
                            </p>
                          )}
                        </CardContent>
                        <CardFooter className="pt-3">
                          <Button asChild className="w-full" size="sm">
                            <Link href={`/admin/games/${game.code}`} className="flex items-center gap-1.5">
                              <Settings className="h-4 w-4" /> Gerenciar
                            </Link>
                          </Button>
                        </CardFooter>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
