'use client'
import { useState, useEffect } from 'react'
import { eventsApi } from '@/lib/api'
import type { GameEvent } from '@/types/game'

export function useEvents(gameCode: string, categoryCode: string) {
  const [events, setEvents] = useState<GameEvent[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!gameCode || !categoryCode) return
    setLoading(true)
    eventsApi
      .list(gameCode, categoryCode)
      .then((res) => setEvents(res.data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [gameCode, categoryCode])

  return { events, loading }
}
