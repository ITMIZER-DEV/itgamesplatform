'use client'
import { useState, useEffect } from 'react'
import { workoutsApi } from '@/lib/api'

export interface WodItem {
  code: string | number
  title: string
  description?: string
  game: string
  category?: string | number
  type?: string
  timeCap?: string
  Category?: { name: string; code: string | number }
}

export function useWorkouts(gameCode: string) {
  const [workouts, setWorkouts] = useState<WodItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!gameCode) return
    setLoading(true)
    workoutsApi
      .list(gameCode)
      .then((res) => setWorkouts(res.data))
      .catch(() => setError('Erro ao carregar workouts'))
      .finally(() => setLoading(false))
  }, [gameCode])

  return { workouts, loading, error }
}
