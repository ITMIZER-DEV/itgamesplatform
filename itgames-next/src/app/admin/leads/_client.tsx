'use client'
import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Smartphone, Mail, User, Calendar, MessageSquare, ExternalLink, 
  Search, ArrowRight, CheckCircle2, XCircle, Clock, MoreVertical,
  ChevronRight, Info, Trash2
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Lead {
  id: string
  name: string
  email: string
  phone: string
  description: string | null
  status: string
  createdAt: string
}

const STAGES = [
  { id: 'new', label: 'Início / Novo', color: 'bg-blue-500', bg: 'bg-blue-500/5', icon: MessageSquare, next: 'contacted' },
  { id: 'contacted', label: 'Contato', color: 'bg-amber-500', bg: 'bg-amber-500/5', icon: Smartphone, next: 'negotiating' },
  { id: 'negotiating', label: 'Negociação', color: 'bg-purple-500', bg: 'bg-purple-500/5', icon: Clock, next: 'won' },
  { id: 'won', label: 'Fechado', color: 'bg-green-500', bg: 'bg-green-500/5', icon: CheckCircle2, next: null },
  { id: 'lost', label: 'Perdido', color: 'bg-zinc-500', bg: 'bg-zinc-500/5', icon: XCircle, next: null },
]

export function LeadsDashboard() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads')
      const data = await res.json()
      setLeads(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [])

  const updateStatus = async (id: string, newStatus: string) => {
    const originalLeads = [...leads]
    // Otimismo na UI
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l))
    
    try {
      const res = await fetch(`/api/leads/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (!res.ok) throw new Error()
      toast.success(`Movido para ${STAGES.find(s => s.id === newStatus)?.label}`)
    } catch {
      setLeads(originalLeads)
      toast.error('Erro ao atualizar status')
    }
  }

  const filteredLeads = useMemo(() => {
    const term = search.toLowerCase().trim()
    if (!term) return leads
    return leads.filter(l => 
      l.name.toLowerCase().includes(term) ||
      l.email.toLowerCase().includes(term) ||
      l.phone.includes(term)
    )
  }, [leads, search])

  if (loading) {
    return (
      <div className="flex gap-6 overflow-x-auto pb-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="min-w-[320px] space-y-4">
            <Skeleton className="h-10 w-full bg-zinc-900 rounded-xl" />
            <Skeleton className="h-[200px] w-full bg-zinc-900/50 rounded-2xl" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header Stat & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-900/20 p-6 rounded-[2rem] border border-white/5 shadow-2xl backdrop-blur-sm">
        <div className="space-y-1">
          <h2 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">Visão Geral</h2>
          <div className="flex items-center gap-4">
             <div className="text-3xl font-black text-white">{leads.length} <span className="text-zinc-700 text-lg">LEADS</span></div>
             <div className="h-4 w-px bg-zinc-800" />
             <div className="text-sm font-bold text-green-500 uppercase tracking-tighter">
                {leads.filter(l => l.status === 'won').length} FECHADOS
             </div>
          </div>
        </div>
        
        <div className="relative max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
          <Input 
            placeholder="PROCURAR NO FUNIL..."
            className="pl-12 h-14 bg-black/40 border-white/5 focus:border-primary/50 text-white font-bold rounded-2xl tracking-widest text-xs uppercase shadow-inner"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-6 overflow-x-auto pb-8 snap-x scroll-smooth no-scrollbar">
        {STAGES.map((stage) => {
          const stageLeads = filteredLeads.filter(l => l.status === stage.id || (stage.id === 'new' && (!l.status || l.status === 'new')))
          const Icon = stage.icon

          return (
            <div key={stage.id} className="min-w-[320px] w-80 flex flex-col gap-5 snap-start">
              {/* Column Header */}
              <div className="flex items-center justify-between px-4 group">
                <div className="flex items-center gap-3">
                  <div className={cn("h-4 w-4 rounded-md shadow-[0_0_12px] flex items-center justify-center", stage.color)}>
                     <Icon className="h-2.5 w-2.5 text-white" />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">
                    {stage.label}
                  </h3>
                </div>
                <Badge variant="secondary" className="bg-zinc-900 text-zinc-500 font-black h-5 px-2">
                  {stageLeads.length}
                </Badge>
              </div>

              {/* Column Content */}
              <div className={cn(
                "rounded-[2.5rem] p-3 flex flex-col gap-4 min-h-[600px] border border-white/[0.03] transition-colors duration-500 relative scrollbar-hide overflow-y-auto",
                stage.bg
              )}>
                <AnimatePresence mode="popLayout">
                  {stageLeads.map((lead, idx) => (
                    <motion.div
                      key={lead.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    >
                      <Card className="bg-zinc-900/90 border-white/5 hover:border-primary/40 transition-all duration-300 shadow-xl group cursor-pointer active:scale-95" onClick={() => setSelectedLead(lead)}>
                        <CardContent className="p-5 space-y-4">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-black text-sm text-white uppercase tracking-tight leading-tight group-hover:text-primary transition-colors">
                              {lead.name}
                            </h4>
                            <div className="flex items-center gap-1">
                               <div className="h-1.5 w-1.5 rounded-full bg-zinc-800" />
                               <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" className="h-6 w-6 p-0 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreVertical className="h-3 w-3 text-zinc-500" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-zinc-950 border-white/5 text-zinc-400">
                                  {STAGES.map(s => (
                                    <DropdownMenuItem 
                                      key={s.id} 
                                      className="text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 hover:text-primary disabled:opacity-20"
                                      disabled={s.id === lead.status}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        updateStatus(lead.id, s.id)
                                      }}
                                    >
                                      Mover para {s.label}
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuSeparator className="bg-white/5" />
                                  <DropdownMenuItem className="text-[10px] font-bold uppercase tracking-widest text-red-500 hover:bg-red-500/20">
                                    <Trash2 className="h-3 w-3 mr-2" /> Excluir Lead
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                               </DropdownMenu>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                             <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-bold overflow-hidden">
                               <Smartphone className="h-3 w-3 shrink-0" />
                               <span className="truncate">{lead.phone}</span>
                             </div>
                             {lead.description && (
                               <div className="bg-black/40 rounded-xl p-3 text-[10px] text-zinc-600 line-clamp-2 leading-relaxed border border-white/5 relative">
                                  "{lead.description}"
                               </div>
                             )}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-white/[0.03]">
                            <div className="text-[9px] font-black uppercase tracking-[0.1em] text-zinc-700">
                               {format(new Date(lead.createdAt), 'dd MMM')}
                            </div>
                            {stage.next && (
                               <Button 
                                 size="sm" 
                                 variant="ghost" 
                                 className="h-7 px-2 text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/5 hover:bg-primary/20 rounded-lg group/btn"
                                 onClick={(e) => {
                                    e.stopPropagation()
                                    updateStatus(lead.id, stage.next!)
                                 }}
                               >
                                 Avançar <ChevronRight className="h-3 w-3 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                               </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {stageLeads.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-10 filter grayscale">
                    <Icon className="h-12 w-12 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Aguardando</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Lead Detail Modal */}
      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="sm:max-w-xl bg-zinc-950 border-white/5 p-0 overflow-hidden rounded-[2.5rem] shadow-2xl">
          {selectedLead && (
            <>
              <div className="bg-zinc-900/50 p-8 border-b border-white/5 relative overflow-hidden">
                <div className={cn("absolute -right-20 -top-20 h-60 w-60 rounded-full blur-[100px] opacity-20", STAGES.find(s => s.id === selectedLead.status)?.color)} />
                <div className="relative z-10 flex items-center justify-between">
                   <div className="space-y-1">
                      <Badge variant="outline" className="border-primary/30 text-primary uppercase font-black text-[10px] tracking-widest mb-2">
                         Detalhes do Lead
                      </Badge>
                      <DialogTitle className="text-3xl font-black text-white uppercase tracking-tighter">
                        {selectedLead.name}
                      </DialogTitle>
                   </div>
                   <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center border border-primary/20">
                      <User className="h-8 w-8 text-primary" />
                   </div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-1.5 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2">
                         <Smartphone className="h-3 w-3" /> WhatsApp
                      </p>
                      <p className="text-white font-bold">{selectedLead.phone}</p>
                   </div>
                   <div className="space-y-1.5 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2">
                         <Mail className="h-3 w-3" /> E-mail
                      </p>
                      <p className="text-white font-bold truncate">{selectedLead.email}</p>
                   </div>
                </div>

                <div className="space-y-3">
                   <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2">
                      <MessageSquare className="h-3 w-3" /> Descrição do Evento
                   </p>
                   <div className="p-6 rounded-3xl bg-primary/5 border border-primary/10 text-zinc-300 leading-relaxed italic text-base">
                      "{selectedLead.description || 'Nenhuma descrição fornecida.'}"
                   </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                   <Button 
                    className="flex-1 h-14 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-tighter shadow-lg shadow-green-600/20 group"
                    onClick={() => window.open(`https://wa.me/${selectedLead.phone.replace(/\D/g, '')}`, '_blank')}
                   >
                     Iniciar Contato <ExternalLink className="ml-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                   </Button>
                   <Button 
                    variant="outline"
                    className="h-14 w-14 rounded-2xl border-white/10 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50 transition-all font-black uppercase"
                   >
                     <Trash2 className="h-6 w-6" />
                   </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
