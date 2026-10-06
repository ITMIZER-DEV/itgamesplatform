'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

export function LoginForm() {
  const { user, loginWithEmail, loginWithGoogle } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        router.replace('/admin')
      } else if (user.role === 'judge') {
        router.replace('/judge')
      } else {
        router.replace('/')
      }
    }
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await loginWithEmail(email)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'E-mail não encontrado.')
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setGoogleLoading(true)
    try {
      await loginWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar com Google.')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-4">
        <Button
          type="button"
          size="lg"
          className="w-full gap-3 h-12 text-base font-bold shadow-lg hover:shadow-primary/20 transition-all hover:scale-[1.02]"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
        >
          <GoogleIcon />
          {googleLoading ? 'Conectando...' : 'Entrar com Google'}
        </Button>
        
        <p className="text-center text-xs text-muted-foreground px-4">
          Acesse instantaneamente usando sua conta Google sincronizada.
        </p>
      </div>

      {!showEmailForm ? (
        <div className="pt-4 text-center">
          <button
            type="button"
            onClick={() => setShowEmailForm(true)}
            className="text-sm text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
          >
            Entrar com e-mail manualmente
          </button>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou e-mail</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-bold">E-mail Cadastrado</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="h-11 shadow-inner bg-card/50"
                autoComplete="email"
              />
            </div>
            {error && (
              <p className="text-sm font-medium text-destructive animate-bounce bg-destructive/10 p-2 rounded-md">
                ⚠️ {error}
              </p>
            )}
            <Button type="submit" className="w-full h-11 font-black uppercase tracking-wider" disabled={loading || googleLoading}>
              {loading ? 'Validando Acesso...' : 'Entrar Agora'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-xs"
              onClick={() => setShowEmailForm(false)}
            >
              Voltar para Google
            </Button>
          </form>
        </div>
      )}
      
      <div className="pt-8 text-center">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-bold">
          Plataforma de Resultados IT.GAMES
        </p>
      </div>
    </div>
  )
}
