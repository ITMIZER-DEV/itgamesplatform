import { AuthGuard } from '@/components/auth/AuthGuard'

export default function JudgeLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireJudge>
      <div className="min-h-[calc(100vh-3.5rem)] bg-background flex flex-col">
        <main className="flex-1 overflow-auto container max-w-lg mx-auto py-6 px-4">
          {children}
        </main>
      </div>
    </AuthGuard>
  )
}
