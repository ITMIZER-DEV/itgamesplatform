'use client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { GameEvent } from '@/types/game'

interface Props {
  categories: { code: string | number; name: string }[]
  events: GameEvent[]
  selectedCategory: string
  selectedEvent: string
  onCategoryChange: (v: string) => void
  onEventChange: (v: string) => void
  loadingEvents?: boolean
}

export function CategoryEventFilter({
  categories,
  events,
  selectedCategory,
  selectedEvent,
  onCategoryChange,
  onEventChange,
  loadingEvents,
}: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Select value={selectedCategory} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-full sm:w-56">
          <SelectValue placeholder="Selecione a categoria" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((c) => (
            <SelectItem key={c.code} value={String(c.code)}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedEvent}
        onValueChange={onEventChange}
        disabled={!selectedCategory || loadingEvents}
      >
        <SelectTrigger className="w-full sm:w-56">
          <SelectValue placeholder={loadingEvents ? 'Carregando...' : 'Selecione o evento'} />
        </SelectTrigger>
        <SelectContent>
          {events.map((e) => (
            <SelectItem key={e.idEvent} value={String(e.idEvent)}>
              {e.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
