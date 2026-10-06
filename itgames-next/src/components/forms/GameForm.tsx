'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ImageUploader } from './ImageUploader'
import { Switch } from '@/components/ui/switch'
import { gamesApi } from '@/lib/api'
import type { Game } from '@/types/game'

interface GameFormData {
  name: string
  date: string
  location: string
  description: string
  status: Game['status']
  foto?: string
  isLowestPointsBetter: boolean
  showTime: boolean
  showWeight: boolean
  showReps: boolean
  showScoreRevision: boolean
}

interface Props {
  initial?: Partial<Game>
  gameCode?: string
  onSuccess: () => void
}

export function GameForm({ initial, gameCode, onSuccess }: Props) {
  const [foto, setFoto] = useState(initial?.foto ?? '')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<GameFormData>({
    defaultValues: {
      name: initial?.name ?? '',
      date: initial?.date?.split('T')[0] ?? '',
      location: initial?.location ?? '',
      description: initial?.description ?? '',
      status: initial?.status ?? 'New',
      isLowestPointsBetter: initial?.isLowestPointsBetter ?? false,
      showTime: initial?.showTime ?? true,
      showWeight: initial?.showWeight ?? true,
      showReps: initial?.showReps ?? true,
      showScoreRevision: initial?.showScoreRevision ?? false,
    },
  })

  const onSubmit = async (data: GameFormData) => {
    setSubmitting(true)
    setError('')
    try {
      const payload = { ...data, foto }
      if (gameCode) {
        await gamesApi.update(gameCode, payload)
      } else {
        await gamesApi.create(payload)
      }
      onSuccess()
    } catch {
      setError('Erro ao salvar campeonato.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <ImageUploader
        storagePath="games/covers"
        onUploaded={setFoto}
        onUploadingChange={setUploading}
        currentImageUrl={foto}
      />

      <div className="space-y-1.5">
        <Label>Nome do campeonato</Label>
        <Input {...register('name', { required: 'Campo obrigatório' })} placeholder="Ex: ITG 2025" />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Data</Label>
          <Input type="date" {...register('date', { required: 'Campo obrigatório' })} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select
            defaultValue={initial?.status ?? 'New'}
            onValueChange={(v) => setValue('status', v as Game['status'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="New">Novo</SelectItem>
              <SelectItem value="Ativo">Ativo</SelectItem>
              <SelectItem value="Inativo">Inativo</SelectItem>
              <SelectItem value="Cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Local</Label>
        <Input {...register('location')} placeholder="Cidade, estado" />
      </div>

      <div className="space-y-1.5">
        <Label>Descrição</Label>
        <textarea
          {...register('description')}
          placeholder="Descreva o campeonato..."
          rows={3}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
      </div>

      <div className="space-y-4 pt-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Configurações do Leaderboard</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label className="text-sm">Menor pontuação vence</Label>
              <p className="text-[10px] text-muted-foreground">Útil para provas de tempo ou menor carga.</p>
            </div>
            <Switch 
              checked={watch('isLowestPointsBetter')} 
              onCheckedChange={(checked) => setValue('isLowestPointsBetter', checked)} 
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label className="text-sm">Mostrar tempo</Label>
              <p className="text-[10px] text-muted-foreground">Exibe o tempo no leaderboard público.</p>
            </div>
            <Switch 
              checked={watch('showTime')} 
              onCheckedChange={(checked) => setValue('showTime', checked)} 
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label className="text-sm">Mostrar carga (kg)</Label>
              <p className="text-[10px] text-muted-foreground">Exibe o peso no leaderboard público.</p>
            </div>
            <Switch 
              checked={watch('showWeight')} 
              onCheckedChange={(checked) => setValue('showWeight', checked)} 
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label className="text-sm">Mostrar repetições</Label>
              <p className="text-[10px] text-muted-foreground">Exibe as reps no leaderboard público.</p>
            </div>
            <Switch 
              checked={watch('showReps')} 
              onCheckedChange={(checked) => setValue('showReps', checked)} 
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-blue-500/5 border-blue-500/20 p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label className="text-sm">Liberar Revisão de Scores</Label>
              <p className="text-[10px] text-muted-foreground">Exibe a aba de scores enviados para o público.</p>
            </div>
            <Switch 
              checked={watch('showScoreRevision')} 
              onCheckedChange={(checked) => setValue('showScoreRevision', checked)} 
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={submitting || uploading}>
        {uploading ? 'Aguardando upload...' : submitting ? 'Salvando...' : gameCode ? 'Atualizar campeonato' : 'Criar campeonato'}
      </Button>
    </form>
  )
}
