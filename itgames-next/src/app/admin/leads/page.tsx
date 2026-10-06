import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { LeadsDashboard } from './_client'

export const metadata = {
  title: 'Onboarding de Leads | IT.GAMES Admin',
  description: 'Gerenciamento de novos contatos e possíveis clientes.',
}

export default function LeadsPage() {
  return (
    <main className="p-8 bg-zinc-950 min-h-screen">
      <div className="max-w-[1600px] mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-white">
            Funil de <span className="text-primary italic">Vendas</span>
          </h1>
          <p className="text-zinc-400 font-medium mt-2">
            Gerencie o progresso e o onboarding dos novos organizadores.
          </p>
        </div>

        <LeadsDashboard />
      </div>
    </main>
  )
}
