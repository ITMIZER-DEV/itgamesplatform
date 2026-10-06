'use client'
import { useAuth } from '@/hooks/useAuth'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ShieldCheck, Trophy, User, LogOut } from 'lucide-react'
import Link from 'next/link'

const ROLE_CONFIG = {
  admin: {
    label: 'Administrador',
    icon: ShieldCheck,
    className: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  },
  judge: {
    label: 'Juiz',
    icon: Trophy,
    className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  athlete: {
    label: 'Competidor',
    icon: User,
    className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
} as const

function ProfileContent() {
  const { user, logout, isAdmin } = useAuth()
  if (!user) return null

  const role = user.role ?? 'athlete'
  const config = ROLE_CONFIG[role] ?? ROLE_CONFIG.athlete
  const RoleIcon = config.icon

  const initials = (user.displayName ?? user.email ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="container mx-auto max-w-lg px-4 py-12">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 flex flex-col items-center gap-6">
        {/* Avatar */}
        <Avatar className="h-24 w-24 ring-2 ring-primary ring-offset-2 ring-offset-zinc-900">
          <AvatarImage src={user.photoURL ?? undefined} alt={user.displayName ?? ''} />
          <AvatarFallback className="text-2xl font-bold bg-zinc-800 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Nome e e-mail */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">
            {user.displayName ?? 'Usuário'}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">{user.email}</p>
        </div>

        {/* Badge de papel */}
        <div className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium ${config.className}`}>
          <RoleIcon className="h-4 w-4" />
          {config.label}
        </div>

        {/* Ações rápidas */}
        <div className="w-full flex flex-col gap-3 pt-2">
          <Button asChild variant="outline" className="w-full justify-start gap-2">
            <Link href="/my-scores">
              <Trophy className="h-4 w-4 text-primary" />
              Meus Scores
            </Link>
          </Button>

          {isAdmin && (
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link href="/admin">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Painel Admin
              </Link>
            </Button>
          )}

          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  )
}
