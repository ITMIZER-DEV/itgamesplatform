import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 text-center px-4">
      <p className="text-8xl font-black text-primary">404</p>
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="text-muted-foreground">A página que você procura não existe.</p>
      <Button asChild>
        <Link href="/">Voltar ao início</Link>
      </Button>
    </div>
  )
}
