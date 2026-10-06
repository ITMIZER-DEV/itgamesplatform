'use client'
import { useState, useEffect, use } from 'react'

export const dynamic = 'force-dynamic'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useGame } from '@/hooks/useGames'
import { eventsApi, scoresApi, registrationApi, workoutsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, Search, Save, Camera, CheckCircle2, AlertCircle, Loader2, Timer, Trophy, Weight, Crop } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import Cropper, { Area } from 'react-easy-crop'
import { getCroppedBlob } from '@/lib/cropImage'
import { toast } from 'sonner'
import { useUpload } from '@/hooks/useUpload'

export default function JudgeScoringPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const { game, loading: gameLoading } = useGame(code)
  
  const [categories, setCategories] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [workouts, setWorkouts] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedEvent, setSelectedEvent] = useState('')
  
  const [searchNumber, setSearchNumber] = useState('')
  const [searching, setSearching] = useState(false)
  const [registration, setRegistration] = useState<any>(null)
  
  const [isCap, setIsCap] = useState(false)
  const [judgeName, setJudgeName] = useState('')
  const [existingScore, setExistingScore] = useState<any | null>(null)
  const [checkingScore, setCheckingScore] = useState(false)
  
  // Crop states
  const [cropOpen, setCropOpen] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const { upload, uploading: isUploading, downloadURL, reset: resetUpload } = useUpload()

  const [scoreData, setScoreData] = useState({
    time: '',
    reps: '',
    weight: '',
    photo: '' as string | null
  })
  const [saving, setSaving] = useState(false)

  // Mascara de tempo 00:00
  const formatTime = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4)
    if (digits.length <= 2) return digits
    return `${digits.slice(0, 2)}:${digits.slice(2)}`
  }

  // Carregar categorias do game
  useEffect(() => {
    if (game?.categories) {
      setCategories(game.categories)
      if (game.categories.length > 0) {
        setSelectedCategory(String(game.categories[0].code))
      }
    }
  }, [game])

  // Inicializar nome do juiz
  useEffect(() => {
    if (user && !judgeName) {
      setJudgeName(user.displayName || user.email?.split('@')[0] || '')
    }
  }, [user])

  // Carregar eventos e workouts da categoria selecionada
  useEffect(() => {
    if (selectedCategory) {
      eventsApi.list(code, selectedCategory).then(res => setEvents(res.data))
      workoutsApi.list(code).then(res => setWorkouts(res.data))
    }
  }, [code, selectedCategory])

  const handleSearch = async () => {
    if (!searchNumber) return
    setSearching(true)
    setRegistration(null)
    try {
      const res = await registrationApi.list(code)
      const found = res.data.find((r: any) => r.number === searchNumber || String(r.code) === searchNumber)
      if (found) {
        setRegistration(found)
        setSelectedCategory(String(found.categoryId))
        setSelectedEvent('') // Reset do evento ao trocar de atleta
        toast.info(`Time encontrado: ${found.team}`)
      } else {
        toast.error('Time não encontrado com este número.')
      }
    } catch (error) {
      toast.error('Erro ao buscar time.')
    } finally {
      setSearching(false)
    }
  }

  // Busca automática ao digitar 4 dígitos
  useEffect(() => {
    if (searchNumber.length === 4 && !searching) {
      handleSearch()
    }
  }, [searchNumber])

  // Validar se já existe score ao selecionar evento/atleta
  useEffect(() => {
    const checkDuplicate = async () => {
      if (registration && selectedEvent) {
        setCheckingScore(true)
        try {
          const res = await scoresApi.list(code, selectedCategory, selectedEvent)
          const found = res.data.find((s: any) => s.codeTeam === registration.code)
          setExistingScore(found || null)
        } catch (error) {
          console.error('Erro ao validar duplicidade:', error)
        } finally {
          setCheckingScore(false)
        }
      } else {
        setExistingScore(null)
      }
    }
    checkDuplicate()
  }, [registration, selectedEvent, code, selectedCategory])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setImageToCrop(reader.result as string)
      setCropOpen(true)
    }
    reader.readAsDataURL(file)
  }

  const handleConfirmCrop = async () => {
    if (!imageToCrop || !croppedAreaPixels) return
    setIsProcessing(true)
    try {
      const croppedBlob = await getCroppedBlob(imageToCrop, croppedAreaPixels)
      setCropOpen(false)
      
      const file = new File([croppedBlob], `sumula_${Date.now()}.jpg`, { type: 'image/jpeg' })
      const localUrl = URL.createObjectURL(croppedBlob)
      setScoreData(prev => ({ ...prev, photo: localUrl }))
      
      // Upload para o Firebase igual ao Admin
      await upload(file, `games/${code}/scores/${Date.now()}`)
      toast.success('Imagem processada e enviada!')
    } catch (err) {
      toast.error('Erro ao processar imagem')
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!registration || !selectedEvent) {
      toast.error('Selecione o time e o evento.')
      return
    }

    setSaving(true)
    try {
      const selectedWorkout = events.find(e => String(e.idEvent) === selectedEvent)
      const type = selectedWorkout?.type?.toLowerCase()
      
      let finalTime = scoreData.time || null
      let finalReps = scoreData.reps || null
      let finalWeight = scoreData.weight || null

      if (type === 'time') {
        if (isCap) {
          finalTime = selectedWorkout.timeCap || '99:59' // Fallback se não tiver timecap
          // No CAP o Score é Reps
        }
        // Se não for CAP, reps é Tiebreak
      } else if (type === 'reps' || type === 'amrap') {
        finalTime = null
        finalWeight = null
      } else if (type === 'weight' || type === 'load') {
        finalTime = null
        finalReps = null
      }

      const payload = {
        idEvent: parseInt(selectedEvent),
        game: code,
        category: parseInt(selectedCategory),
        codeTeam: registration.code,
        numberTeam: registration.number || registration.code.toString(),
        time: finalTime,
        reps: finalReps,
        weight: finalWeight,
        judge: judgeName || 'Juiz',
        photo: downloadURL || scoreData.photo,
        status: true,
        dateScore: new Date().toISOString()
      }

      await scoresApi.submit(payload)
      
      // Limpar todos os estados para voltar ao início
      setScoreData({ time: '', reps: '', weight: '', photo: null })
      resetUpload()
      setIsCap(false)
      setRegistration(null)
      setSelectedEvent('')
      setSearchNumber('')
      setExistingScore(null)
      
      toast.success('Score registrado com sucesso!')
    } catch (error) {
      console.error(error)
      toast.error('Erro ao salvar resultado.')
    } finally {
      setSaving(false)
    }
  }

  if (gameLoading) return <div className="p-8 text-center"><Loader2 className="animate-spin inline mr-2" /> Carregando...</div>

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-black text-lg uppercase truncate">{game?.name}</h1>
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Lançamento de Resultado</p>
        </div>
      </header>

      <Card className="border-2 border-primary/20 shadow-lg overflow-hidden">
        <CardHeader className="bg-primary/5 border-b py-3 px-4">
          <CardTitle className="text-sm uppercase font-black flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" /> 1. Identificar Atleta/Time
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input 
                placeholder="Nº de Peito / Código" 
                value={searchNumber}
                onChange={(e) => setSearchNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="h-12 text-lg font-bold placeholder:font-normal"
              />
            </div>
            <Button onClick={handleSearch} disabled={searching} className="h-12 px-6">
              {searching ? <Loader2 className="animate-spin h-5 w-5" /> : <Search className="h-5 w-5" />}
            </Button>
          </div>

          {registration && (
            <div className="animate-in fade-in slide-in-from-top-2 p-4 rounded-xl bg-primary/10 border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-primary font-black uppercase tracking-widest">Time Confirmado</p>
                  <h3 className="font-black text-lg uppercase leading-tight">{registration.team}</h3>
                  <p className="text-xs text-muted-foreground">
                    {registration.category?.name || 'Categoria não informada'}
                  </p>
                </div>
                <div className="bg-white/50 p-2 rounded-full">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {registration && (
        <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <Card className="shadow-md">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm uppercase font-black">2. Dados do Workout</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Categoria</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={!!registration}>
                  <SelectTrigger className="h-11 disabled:bg-muted/50 disabled:opacity-100">
                    <SelectValue placeholder="Selecione a Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.code} value={String(c.code)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-2 block">Evento / Workout</Label>
                <div className="grid grid-cols-1 gap-2">
                  {events.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground italic uppercase text-center py-4 bg-muted/20 rounded-xl border border-dashed">Nenhum evento encontrado para esta categoria.</p>
                  ) : (
                    events.map(e => {
                      const isSelected = selectedEvent === String(e.idEvent)
                      const isOpen = e.status === true // Status true quer dizer que está ATIVO (não encerrado)
                      
                      return (
                        <Button
                          key={e.idEvent}
                          type="button"
                          variant={isSelected ? 'default' : 'outline'}
                          className={`h-auto min-h-[3.5rem] justify-start px-4 py-2 text-xs font-black uppercase tracking-tight transition-all duration-200 border-2 ${isSelected ? 'bg-orange-600 border-orange-700 text-white shadow-lg scale-[1.02]' : 'hover:bg-orange-500/5'} ${!isOpen ? 'opacity-50 grayscale' : ''}`}
                          onClick={() => setSelectedEvent(String(e.idEvent))}
                        >
                          <div className="flex items-center gap-3 w-full">
                            <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'border-white bg-white' : 'border-orange-500'}`}>
                              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-orange-600 animate-in zoom-in-50 duration-300" />}
                            </div>
                            <span className="flex-1 text-left break-words">{e.title}</span>
                            {!isOpen && (
                              <span className="text-[8px] bg-zinc-800 px-1.5 py-1 rounded text-white font-black ml-auto shrink-0 shadow-sm border border-white/10">ENCERRADO</span>
                            )}
                            {isOpen && (
                              <div className={`w-2 h-2 rounded-full ml-auto shrink-0 ${isSelected ? 'bg-white/80 animate-pulse' : 'bg-green-500 animate-pulse'}`} title="Evento Ativo" />
                            )}
                          </div>
                        </Button>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Juiz de Linha (Súmula)</Label>
                <Input 
                  placeholder="Nome do Juiz Responsável" 
                  value={judgeName}
                  onChange={(e) => setJudgeName(e.target.value)}
                  className="h-11 font-bold"
                />
              </div>
            </CardContent>
          </Card>
        </form>
      )}

      {selectedEvent && (
        <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="shadow-md border-orange-500/20 overflow-hidden">
            <CardHeader className="py-3 px-4 border-b bg-orange-500/5">
              <CardTitle className="text-sm uppercase font-black text-orange-600 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> 3. Resultado
                {checkingScore && <Loader2 className="animate-spin h-3 w-3 ml-2" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {existingScore ? (
                <div className="bg-red-500/10 border-2 border-red-500/20 p-4 rounded-2xl animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center gap-3 text-red-600 mb-2">
                    <AlertCircle className="h-6 w-6" />
                    <span className="font-black uppercase text-sm">Atenção: Resultado Já Lançado</span>
                  </div>
                  <p className="text-xs font-bold text-red-500/80 leading-relaxed uppercase">
                    Este time já possui uma pontuação registrada para este evento por "{existingScore.judge || 'um juiz'}". 
                    Em caso de erro, contacte o Head Judge.
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 py-2 border-t border-red-500/10 text-[10px] font-black uppercase text-red-600">
                    {existingScore.time && <div>Tempo: {existingScore.time}</div>}
                    {existingScore.reps && <div>Reps: {existingScore.reps}</div>}
                    {existingScore.weight && <div>Carga: {existingScore.weight}kg</div>}
                  </div>
                </div>
              ) : (
                <>
                  {(() => {
                    const selectedEventObj = events.find(e => String(e.idEvent) === selectedEvent)
                    const workoutObj = workouts.find(w => String(w.code) === String(selectedEventObj?.workout))
                    const type = workoutObj?.type?.toLowerCase() || ''
                    
                    // Lógica idêntica ao Admin
                    const isTime = type.includes('time') || !type
                    const isReps = type.includes('reps') || type.includes('amrap') || !type
                    const isWeight = type.includes('weight') || type.includes('load') || !type
                    
                    return (
                      <div className="grid grid-cols-1 gap-4 animate-in fade-in duration-500">
                        {/* Caso Tempo ou Fallback */}
                        {isTime && (
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between mb-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Tempo</Label>
                                {workoutObj?.timeCap && (
                                  <Button 
                                    type="button" 
                                    variant={scoreData.time === workoutObj.timeCap ? "default" : "outline"}
                                    size="sm"
                                    className="h-6 px-2 text-[9px] font-black tracking-tighter uppercase"
                                    onClick={() => setScoreData(prev => ({ ...prev, time: workoutObj.timeCap! }))}
                                  >
                                    CAP ({workoutObj.timeCap})
                                  </Button>
                                )}
                              </div>
                              <Input
                                value={scoreData.time}
                                onChange={(e) => setScoreData(prev => ({ ...prev, time: formatTime(e.target.value) }))}
                                placeholder="00:00"
                                className="h-14 text-center text-2xl font-black bg-muted/20 border-2 border-primary/10 focus:border-primary/30"
                              />
                            </div>

                            {/* Reps Faltantes (Somente se for tipo time EXPLICITAMENTE) */}
                            {type === 'time' && (
                              <div className="space-y-1.5 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                                <Label className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-widest mb-1 block">Reps Faltantes</Label>
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  value={scoreData.reps}
                                  onChange={(e) => setScoreData(prev => ({ ...prev, reps: e.target.value }))}
                                  placeholder="0"
                                  className="h-12 text-center text-xl font-bold bg-white/50 border-amber-500/20 focus:border-amber-500/40"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Caso Reps (AMRAP) ou Fallback */}
                        {(type === 'reps' || type === 'amrap' || !type) && (
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1 block">Reps</Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              value={scoreData.reps}
                              onChange={(e) => setScoreData(prev => ({ ...prev, reps: e.target.value }))}
                              placeholder="0"
                              className="h-14 text-center text-2xl font-black bg-muted/20 border-2 border-primary/10"
                            />
                          </div>
                        )}

                        {/* Caso Carga ou Fallback */}
                        {(type === 'weight' || type === 'load' || !type) && (
                          <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1 block">Carga (kg)</Label>
                            <Input
                              type="number"
                              inputMode="numeric"
                              value={scoreData.weight}
                              onChange={(e) => setScoreData(prev => ({ ...prev, weight: e.target.value }))}
                              placeholder="0"
                              className="h-14 text-center text-2xl font-black bg-muted/20 border-2 border-primary/10"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  <div className="pt-2">
                    <Label htmlFor="file-upload" className="block">
                      <div className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl transition-colors cursor-pointer ${scoreData.photo ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/50'}`}>
                        {scoreData.photo ? (
                          <div className="relative w-full aspect-video">
                            <img src={scoreData.photo} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                            <div className="absolute top-2 right-2 bg-primary text-white p-1 rounded-full shadow-lg">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                          </div>
                        ) : (
                          <>
                            <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground text-center">Tirar Foto da Súmula</p>
                          </>
                        )}
                      </div>
                    </Label>
                    <Input 
                      id="file-upload" 
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      className="hidden" 
                      onChange={handleFileUpload} 
                      disabled={!!existingScore}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Button 
            type="submit" 
            disabled={saving || !registration || !!existingScore || isUploading} 
            className={`w-full h-16 text-lg font-black uppercase tracking-widest shadow-xl transition-all ${existingScore ? 'bg-zinc-800' : 'shadow-primary/20'}`}
          >
            {existingScore ? (
              'RESTRITO: JÁ LANÇADO'
            ) : saving ? (
              <><Loader2 className="animate-spin mr-2" /> Salvando...</>
            ) : (
              <><Save className="h-6 w-6 mr-2" /> Salvar Resultado</>
            )}
          </Button>
        </form>
      )}

      {!registration && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 text-[10px] font-bold uppercase tracking-widest">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Aguardando identificação do atleta para habilitar o salvamento.
        </div>
      )}

      {/* Modal de Crop A4 */}
      <Dialog open={cropOpen} onOpenChange={(val) => !isProcessing && setCropOpen(val)}>
        <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 overflow-hidden bg-black border-none">
          <DialogHeader className="p-4 bg-zinc-900 border-b border-zinc-800 shrink-0">
            <DialogTitle className="text-white text-sm uppercase font-black flex items-center gap-2">
              <Crop className="h-4 w-4" /> Ajustar Enquadramento (A4)
            </DialogTitle>
            <DialogDescription className="sr-only">
              Ajuste o recorte da imagem da súmula para garantir a legibilidade.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 relative bg-zinc-950">
            {imageToCrop && (
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={210 / 297} // Proporção A4 vertical
                onCropChange={setCrop}
                onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                onZoomChange={setZoom}
              />
            )}
          </div>

          <DialogFooter className="p-4 bg-zinc-900 border-t border-zinc-800 flex flex-row items-center justify-between gap-4 shrink-0 px-6">
            <div className="flex-1">
              <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest leading-none mb-2 text-left">Zoom</p>
              <input 
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="ghost" className="text-white font-bold" onClick={() => setCropOpen(false)} disabled={isProcessing}>
                CANCELAR
              </Button>
              <Button onClick={handleConfirmCrop} disabled={isProcessing || isUploading} className="font-black px-6">
                {isProcessing || isUploading ? <Loader2 className="animate-spin h-5 w-5" /> : 'CONFIRMAR CORTE'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
