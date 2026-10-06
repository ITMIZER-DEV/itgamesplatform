import { AuthGuard } from '@/components/auth/AuthGuard'
import { AdminSidebar } from '@/components/layout/AdminSidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireAdmin>
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <AdminSidebar />
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </AuthGuard>
  )
}
