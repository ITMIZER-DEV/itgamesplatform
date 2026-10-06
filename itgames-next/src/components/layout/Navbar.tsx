'use client'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Trophy, LogOut, User, ShieldCheck } from 'lucide-react'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

export function Navbar() {
  const { user, logout, isAdmin } = useAuth()

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-black text-lg tracking-tight">
          <Trophy className="h-5 w-5 text-primary" />
          <span className="text-foreground">IT.<span className="text-primary">GAMES</span></span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              {isAdmin && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin" className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    Admin
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm">
                <Link href="/my-scores" className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  Meus Scores
                </Link>
              </Button>
              <Button asChild variant="ghost" size="icon" title="Perfil">
                <Link href="/profile">
                  <User className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={logout} title="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Entrar</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  )
}
