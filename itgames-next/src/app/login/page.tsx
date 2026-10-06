import { Trophy } from 'lucide-react'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Trophy className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-black">
            IT.<span className="text-primary">GAMES</span>
          </h1>
          <p className="text-sm text-muted-foreground">Entre para acompanhar seus resultados</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
