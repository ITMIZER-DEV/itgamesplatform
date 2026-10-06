'use client'
import { useState, useEffect } from 'react'
import { leaderboardApi } from '@/lib/api'
import type { LeaderboardEntry } from '@/types/score'

export function useLeaderboard(gameCode: string, categoryCode: string) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!gameCode || !categoryCode) return
    setLoading(true)
    leaderboardApi
      .get(gameCode, categoryCode)
      .then((res) => setEntries(res.data))
      .catch(() => setError('Erro ao carregar leaderboard'))
      .finally(() => setLoading(false))
  }, [gameCode, categoryCode])

  return { entries, loading, error }
}
