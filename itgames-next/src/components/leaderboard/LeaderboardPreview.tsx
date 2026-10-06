'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

interface EventScore {
  eventId: number
  eventTitle: string
  rank: number
  points: number
  result: string
  isWO: boolean
}

interface TeamPreview {
  teamCode: number
  teamName: string
  athletes: string[]
  events: EventScore[]
  totalPoints: number
  position: number
}

interface LeaderboardPreviewProps {
  game: string
  category: number
  onConfirm: (eventId: number) => Promise<void>
  onCancel: () => void
}

export function LeaderboardPreview({
  game,
  category,
  onConfirm,
  onCancel
}: LeaderboardPreviewProps) {
  const [teams, setTeams] = useState<TeamPreview[]>([])
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null)

  // Carregar preview
  const loadPreview = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/leaderboard/preview/${game}/${category}`)
      const data = await res.json()
      setTeams(data.teams || [])
    } catch (error) {
      console.error('Error loading preview:', error)
    } finally {
      setLoading(false)
    }
  }

  // Confirmar cálculo
  const handleConfirm = async () => {
    if (!selectedEvent) return

    setConfirming(true)
    try {
      await onConfirm(selectedEvent)
    } finally {
      setConfirming(false)
    }
  }

  // Renderizar badge de posição
  const getRankBadge = (position: number) => {
    const classes =
      position === 1
        ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
        : position === 2
        ? 'bg-zinc-300/20 text-zinc-600 dark:text-zinc-300'
        : position === 3
        ? 'bg-amber-600/20 text-amber-700 dark:text-amber-400'
        : 'bg-muted text-muted-foreground'

    return (
      <div className={`px-2 py-1 rounded-md font-bold text-sm ${classes}`}>
        #{position}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (teams.length === 0) {
    return (
      <div className="text-center py-16">
        <button
          onClick={loadPreview}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Calcular Preview
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Preview do Leaderboard</h3>
          <p className="text-sm text-muted-foreground">
            Revise os cálculos antes de confirmar
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={confirming}
            className="px-4 py-2 border border-border rounded-lg hover:bg-muted/40 transition-colors disabled:opacity-50"
          >
            <XCircle className="h-4 w-4 mr-2 inline" />
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming || !selectedEvent}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {confirming ? (
              <Loader2 className="h-4 w-4 mr-2 inline animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2 inline" />
            )}
            Confirmar e Salvar
          </button>
        </div>
      </div>

      {/* Tabela de preview */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold">Pos</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Atletas</th>
                <th className="px-4 py-3 text-right text-xs font-semibold">Eventos</th>
                <th className="px-4 py-3 text-right text-xs font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team, index) => (
                <motion.tr
                  key={team.teamCode}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="border-t border-border hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">{getRankBadge(team.position)}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-sm">{team.teamName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-muted-foreground">
                      {team.athletes.join(' · ')}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end flex-wrap">
                      {team.events.map((event) => (
                        <div
                          key={event.eventId}
                          className="px-2 py-0.5 rounded bg-muted text-xs"
                          title={`${event.eventTitle}: ${event.result} (${event.points} pts)`}
                        >
                          {event.isWO ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              WO
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              #{event.rank}
                            </span>
                          )}
                          <span className="text-primary ml-1 font-semibold">
                            {event.points}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="text-lg font-bold text-primary">
                      {team.totalPoints}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-primary"></div>
          <span>Pontuação</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-amber-500/20"></div>
          <span>Walk Over (WO)</span>
        </div>
      </div>
    </div>
  )
}
