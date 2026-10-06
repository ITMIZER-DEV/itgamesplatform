'use client'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Smartphone, Mail, User, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

interface ContactModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    description: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) throw new Error('Falha ao enviar')

      setSuccess(true)
      setTimeout(() => {
        onClose()
        setSuccess(false)
        setFormData({ name: '', email: '', phone: '', description: '' })
      }, 3000)
    } catch (error) {
      toast.error('Erro ao enviar sua solicitação. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-white/5 p-0 overflow-hidden rounded-[2rem] shadow-2xl">
        <div className="bg-primary/10 p-8 pb-4 border-b border-white/5 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-40 w-40 bg-primary/20 rounded-full blur-3xl" />
          <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-white">
            Organize seu <span className="text-primary italic">Evento</span>
          </DialogTitle>
          <DialogDescription className="text-zinc-400 font-medium mt-2">
            Deixe seus dados e entraremos em contato para apresentar nossa plataforma.
          </DialogDescription>
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 flex flex-col items-center justify-center text-center space-y-4"
              >
                <div className="h-20 w-20 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tighter text-white">Mensagem Enviada!</h3>
                <p className="text-zinc-400 text-sm font-medium">Obrigado pelo interesse. Em breve nossa equipe entrará em contato.</p>
              </motion.div>
            ) : (
              <motion.form 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={handleSubmit} 
                className="space-y-6"
              >
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                      <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Nome Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-zinc-600" />
                      <Input
                        id="name"
                        required
                        placeholder="João Silva"
                        className="pl-10 bg-zinc-900/70 border-white/10 focus:border-primary/50 text-zinc-100 font-medium"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">E-mail</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-600" />
                        <Input
                          id="email"
                          type="email"
                          required
                          placeholder="joao@exemplo.com"
                          className="pl-10 bg-zinc-900/70 border-white/10 focus:border-primary/50 text-zinc-100 font-medium"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">WhatsApp</Label>
                      <div className="relative">
                        <Smartphone className="absolute left-3 top-2.5 h-4 w-4 text-zinc-600" />
                        <Input
                          id="phone"
                          required
                          placeholder="(11) 99999-9999"
                          className="pl-10 bg-zinc-900/70 border-white/10 focus:border-primary/50 text-zinc-100 font-medium"
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-[10px] font-black uppercase tracking-widest text-primary ml-1">Seu Campeonato</Label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
                      <textarea
                        id="description"
                        rows={3}
                        placeholder="Conte um pouco sobre o evento que você pretende organizar..."
                        className="w-full flex min-h-[80px] rounded-md border border-white/10 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 font-medium ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-10 focus:border-primary/50 transition-colors"
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <Button 
                  disabled={loading}
                  className="w-full h-12 rounded-xl font-black uppercase tracking-tighter text-lg shadow-xl shadow-primary/20 group"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Solicitar Onboarding 
                      <CheckCircle2 className="ml-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                    </>
                  )}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  )
}
