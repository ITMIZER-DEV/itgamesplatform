'use client'
import { useState } from 'react'
import { RotateCcw, Loader2, AlertTriangle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface EventReverseButtonProps {
  game: string
  category: number
  eventId: number
  eventTitle: string
  onReverse?: () => void
}

export function EventReverseButton({
  game,
  category,
  eventId,
  eventTitle,
  onReverse
}: EventReverseButtonProps) {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const handleReverse = async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/leaderboard/reverse/${game}/${category}/${eventId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: 'Reversão manual via interface'
          })
        }
      )

      const data = await res.json()

      if (data.success) {
        alert(
          `Cálculo revertido com sucesso!\n\n` +
          `Times afetados: ${data.teamsAffected}\n` +
          `Pontos removidos: ${data.pointsRemoved}`
        )
        setOpen(false)
        onReverse?.()
      } else {
        alert(`Erro ao reverter: ${data.error}`)
      }
    } catch (error) {
      console.error('Error reversing event:', error)
      alert('Erro ao reverter cálculo do evento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          className="px-3 py-1.5 text-xs border border-amber-600/50 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-600/10 transition-colors flex items-center gap-1.5"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RotateCcw className="h-3 w-3" />
          )}
          Reverter
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Reverter Cálculo do Evento
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Você está prestes a reverter o cálculo do evento:
            </p>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-semibold text-foreground">{eventTitle}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Game: {game} | Categoria: {category}
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-foreground">O que acontecerá:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Pontos do evento serão removidos de todos os times</li>
                <li>Scores WO criados automaticamente serão deletados</li>
                <li>O evento será marcado como não calculado</li>
                <li>O leaderboard geral será recalculado</li>
                <li>A operação ficará registrada no histórico</li>
              </ul>
            </div>
            <p className="text-amber-600 dark:text-amber-400 font-semibold">
              ⚠️ Esta ação não pode ser desfeita automaticamente
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleReverse()
            }}
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Revertendo...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                Confirmar Reversão
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
