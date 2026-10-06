'use client'
import { useState, useEffect } from 'react'
import { gamesApi } from '@/lib/api'
import type { Game } from '@/types/game'

export function useGames(includeInactive = false) {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const url = includeInactive ? '/api/games?includeInactive=true' : '/api/games'
    fetch(url)
      .then((res) => res.json())
      .then((data) => setGames(data))
      .catch(() => setError('Erro ao carregar campeonatos'))
      .finally(() => setLoading(false))
  }, [includeInactive])

  return { games, loading, error }
}

export function useGame(code: string) {
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    gamesApi
      .getByCode(code)
      .then((res) => setGame(res.data))
      .catch(() => setError('Jogo não encontrado'))
      .finally(() => setLoading(false))
  }, [code])

  return { game, loading, error }
}
