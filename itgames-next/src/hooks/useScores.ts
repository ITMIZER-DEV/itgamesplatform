'use client'
import { useState, useEffect, useCallback } from 'react'
import { scoresApi } from '@/lib/api'
import type { Score } from '@/types/score'

export function useScores(gameCode: string, categoryCode: string, eventId: string | number) {
  const [scores, setScores] = useState<Score[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    if (!gameCode || !categoryCode || !eventId) return
    setLoading(true)
    scoresApi
      .list(gameCode, categoryCode, eventId)
      .then((res) => setScores(res.data))
      .catch(() => setError('Erro ao carregar scores'))
      .finally(() => setLoading(false))
  }, [gameCode, categoryCode, eventId])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { scores, loading, error, refetch: fetch }
}
