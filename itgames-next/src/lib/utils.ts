import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function calculateAdjustedTime(timeStr: string, repsMissing: number | string): string {
  if (!timeStr) return ''
  const parts = timeStr.split(':').map(Number)
  const mm = parts[0] || 0
  const ss = parts[1] || 0
  const totalSeconds = (mm * 60) + ss + Number(repsMissing || 0)
  
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatScore(score: {
  time?: string
  weight?: string | number
  reps?: string | number
}): string {
  if (score.time) {
    if (score.reps && Number(score.reps) > 0) {
      return `${score.time} (+${score.reps}) → ${calculateAdjustedTime(score.time, score.reps)}`
    }
    return score.time
  }
  if (score.weight) return `${score.weight}kg`
  if (score.reps) return `${score.reps} reps`
  return '-'
}
