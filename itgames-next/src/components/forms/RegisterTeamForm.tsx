'use client'
import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { registrationApi } from '@/lib/api'
import type { Game, Category } from '@/types/game'
import type { TeamRegistration } from '@/types/registration'

interface Props {
  game: Game
  onSuccess: () => void
}

export function RegisterTeamForm({ game, onSuccess }: Props) {
  const categories = game.categories ?? []
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const { register, control, handleSubmit, setValue, formState: { errors } } =
    useForm<TeamRegistration>({ defaultValues: { gameId: game.code, athletes: [] } })

  const { fields, replace } = useFieldArray({ control, name: 'athletes' })

  const handleCategoryChange = (code: string) => {
    const cat = categories.find((c) => String(c.code) === code)
    if (!cat) return
    setSelectedCategory(cat)
    setValue('categoryId', Number(cat.code))
    setValue('amount', cat.amount)
    replace(Array.from({ length: cat.maxAthlete }, () => ({ name: '', cpf: '' })))
  }

  const onSubmit = async (data: TeamRegistration) => {
    setSubmitting(true)
    setError('')
    try {
      const payload: TeamRegistration = selectedCategory?.maxAthlete === 1
        ? { ...data, team: data.athletes[0]?.name ?? '' }
        : data
      await registrationApi.register(payload)
      onSuccess()
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response: { status: number; data: unknown } }
        const detail = typeof axiosErr.response.data === 'object' && axiosErr.response.data !== null
          ? JSON.stringify(axiosErr.response.data)
          : String(axiosErr.response.data)
        setError(`Erro ${axiosErr.response.status}: ${detail}`)
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao realizar inscrição. Tente novamente.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-1.5">
        <Label>Categoria</Label>
        <Select onValueChange={handleCategoryChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a categoria" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c: any) => (
              <SelectItem key={c.code} value={String(c.code)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCategory && selectedCategory.maxAthlete > 1 && (
        <div className="space-y-1.5">
          <Label>Nome do Time</Label>
          <Input
            {...register('team', { required: 'Campo obrigatório' })}
            placeholder="Nome do time"
          />
          {errors.team && <p className="text-xs text-destructive">{errors.team.message}</p>}
        </div>
      )}

      {fields.map((field, idx) => (
        <div key={field.id} className="rounded-xl border border-border p-4 space-y-3">
          <p className="text-sm font-semibold text-primary">Atleta {idx + 1}</p>
          <div className="space-y-1.5">
            <Label>Nome completo</Label>
            <Input
              {...register(`athletes.${idx}.name`, { required: true })}
              placeholder="Nome completo"
            />
          </div>
          <div className="space-y-1.5">
            <Label>CPF</Label>
            <Input
              {...register(`athletes.${idx}.cpf`, {
                required: true,
                pattern: { value: /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, message: 'CPF inválido' },
              })}
              placeholder="000.000.000-00"
            />
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={submitting || !selectedCategory || !fields.length}>
        {submitting ? 'Inscrevendo...' : 'Confirmar Inscrição'}
      </Button>
    </form>
  )
}
