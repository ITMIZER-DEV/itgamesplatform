'use client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useGame } from '@/hooks/useGames'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Users } from 'lucide-react'

export default function CategoriesClient() {
  const { code } = useParams<{ code: string }>()
  const { game, loading } = useGame(code)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/admin/games/${code}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-black">Categorias</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : !game?.categories?.length ? (
        <p className="text-muted-foreground text-sm py-12 text-center">
          Nenhuma categoria cadastrada.
        </p>
      ) : (
        <div className="space-y-3">
          {game.categories.map((cat) => (
            <div key={cat.code} className="flex items-start justify-between rounded-xl border border-border bg-card p-4">
              <div>
                <p className="font-bold">{cat.name}</p>
                {cat.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                )}
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {cat.maxAthlete} atleta(s)
                  </span>
                  <span>R$ {cat.amount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
