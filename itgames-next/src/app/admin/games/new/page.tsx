'use client'
import { useRouter } from 'next/navigation'
import { GameForm } from '@/components/forms/GameForm'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function NewGamePage() {
  const router = useRouter()

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/admin/games">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-black">Novo Campeonato</h1>
      </div>

      <GameForm onSuccess={() => router.push('/admin/games')} />
    </div>
  )
}
