'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { useDropzone } from 'react-dropzone'
import { useUpload } from '@/hooks/useUpload'
import { cn } from '@/lib/utils'

import { useGame } from '@/hooks/useGames'
import { useWorkouts, type WodItem } from '@/hooks/useWorkouts'
import { useEvents } from '@/hooks/useEvents'
import { useScores } from '@/hooks/useScores'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { useAuth } from '@/hooks/useAuth'
import Cropper, { type Area } from 'react-easy-crop'
import { getCroppedBlob } from '@/lib/cropImage'
import { registrationApi, workoutsApi, scoresApi, api, eventsApi } from '@/lib/api'
import type { Registration } from '@/types/registration'
import type { Score, LeaderboardEntry } from '@/types/score'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CategoryEventFilter } from '@/components/leaderboard/CategoryEventFilter'
import { ScoreBadges } from '@/components/score/ScoreBadges'
import { DeleteScoreButton } from '@/components/score/DeleteScoreButton'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'
import { RegisterTeamForm } from '@/components/forms/RegisterTeamForm'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft, Pencil, List, Dumbbell, Users, BarChart2, Trophy,
  Calculator, Plus, ChevronDown, ChevronUp, X, UserCircle2, FileImage,
  Upload, Loader2, Check, CheckCircle, Trash2, ShieldCheck, ScrollText, Settings2, Search, Eye, Edit3, RotateCcw, Copy, ClipboardPaste, Download
} from 'lucide-react'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import dynamic from 'next/dynamic'
const SumulaRichEditor = dynamic(() => import('@/components/sumula/SumulaRichEditor').then(m => ({ default: m.SumulaRichEditor })), { ssr: false })

const PRINT_STYLES = `
  @media print {
    body * { visibility: hidden; }
    .print-area, .print-area * { visibility: visible; }
    .print-area { 
      position: absolute; 
      left: 0; 
      top: 0; 
      width: 100%; 
      margin: 0;
      padding: 0;
    }
    .no-print { display: none !important; }
    .sumula-page { 
      page-break-after: always; 
      border: 1px solid black !important;
      margin-bottom: 0 !important;
      box-shadow: none !important;
    }
  }
`

// ─── helpers ──────────────────────────────────────────────────────────────────
function statusColor(status: string) {
  if (status === 'Ativo') return 'default'
  if (status === 'Inativo') return 'secondary'
  if (status === 'Cancelado') return 'destructive'
  return 'outline'
}

// ─── WOD add form ─────────────────────────────────────────────────────────────
function AddWodForm({ gameCode, categories, onCreated }: {
  gameCode: string
  categories: { code: string | number; name: string }[]
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    category: '', type: '', title: '', timeCap: '', description: '',
  })

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.category || !form.type || !form.title || !form.description) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }
    setSaving(true)
    try {
      await workoutsApi.create({ game: gameCode, ...form })
      toast.success('Workout cadastrado!')
      setForm({ category: '', type: '', title: '', timeCap: '', description: '' })
      setOpen(false)
      onCreated()
    } catch {
      toast.error('Erro ao cadastrar workout')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/20 transition-colors"
      >
        <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> Cadastrar Workout</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="border-t border-border p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Categoria *</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.code} value={String(c.code)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">Tempo</SelectItem>
                  <SelectItem value="weight">Carga</SelectItem>
                  <SelectItem value="reps">Repetições</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex: WOD 01 – AMRAP 12min" />
          </div>

          {form.type === 'time' && (
            <div className="space-y-1.5">
              <Label>Time Cap</Label>
              <Input value={form.timeCap} onChange={(e) => set('timeCap', e.target.value)} placeholder="Ex: 12:00" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Descrição *</Label>
            <RichTextEditor 
              value={form.description} 
              onChange={(v) => set('description', v)}
              placeholder="Descreva o workout..."
              minHeight="150px"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar Workout'}</Button>
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Score add form ────────────────────────────────────────────────────────────
function AddScoreForm({ gameCode, categories, workouts }: {
  gameCode: string
  categories: { code: string | number; name: string }[]
  workouts: WodItem[]
}) {
  const [saving, setSaving] = useState(false)
  const [scoreCategory, setScoreCategory] = useState('')
  const [scoreEvent, setScoreEvent] = useState('')
  const [form, setForm] = useState({ code: '', time: '', weight: '', reps: '' })

  // Registration code lookup
  const [teamInfo, setTeamInfo] = useState<Registration | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Photo upload
  const { upload, uploading, progress, downloadURL, reset: resetUpload } = useUpload()
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const { user } = useAuth()

  // Crop states
  const [cropOpen, setCropOpen] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const { events, loading: eventsLoading } = useEvents(gameCode, scoreCategory)
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  // time mask 00:00
  const formatTime = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4)
    if (digits.length <= 2) return digits
    return `${digits.slice(0, 2)}:${digits.slice(2)}`
  }

  // Debounced lookup when code reaches ≥4 chars
  function handleCodeChange(val: string) {
    set('code', val)
    setTeamInfo(null)
    if (lookupTimer.current) clearTimeout(lookupTimer.current)
    if (val.length >= 4) {
      lookupTimer.current = setTimeout(async () => {
        setLookingUp(true)
        try {
          const res = await registrationApi.getByCode(val, gameCode)
          const data: Registration = res.data
          setTeamInfo(data)
          if (data?.categoryId) setScoreCategory(String(data.categoryId))
        } catch {
          setTeamInfo(null)
        } finally {
          setLookingUp(false)
        }
      }, 600)
    }
  }

  // Drop zone for A4 súmula photo
  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      setImageToCrop(e.target?.result as string)
      setCropOpen(true)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleConfirmCrop = async () => {
    if (!imageToCrop || !croppedAreaPixels) return
    setIsProcessing(true)
    try {
      const croppedBlob = await getCroppedBlob(imageToCrop, croppedAreaPixels)
      setCropOpen(false) // Fecha o modal após processar o blob, antes do upload
      const file = new File([croppedBlob], `sumula_${Date.now()}.jpg`, { type: 'image/jpeg' })
      
      const localUrl = URL.createObjectURL(croppedBlob)
      setPhotoPreview(localUrl)

      await upload(file, `games/${gameCode}/scores/${Date.now()}`)
    } catch (err) {
      toast.error('Erro ao processar imagem')
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scoreCategory || !scoreEvent || !teamInfo) {
      toast.error('Preencha categoria, evento e identifique o time')
      return
    }
    setSaving(true)
    try {
      await scoresApi.submit({
        game: gameCode,
        category: Number(scoreCategory),
        idEvent: Number(scoreEvent),
        codeTeam: Number(teamInfo.code),
        numberTeam: String(teamInfo.number),
        judge: user?.displayName || user?.email || 'Admin',
        ...(form.time && { time: form.time }),
        ...(form.weight && { weight: form.weight }),
        ...(form.reps && { reps: form.reps }),
        ...(downloadURL && { photo: downloadURL }),
      })
      toast.success('Score cadastrado!')
      setForm({ code: '', time: '', weight: '', reps: '' })
      setScoreCategory('')
      setScoreEvent('')
      setTeamInfo(null)
      setPhotoPreview(null)
      resetUpload()
    } catch {
      toast.error('Erro ao cadastrar score')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold border-b border-border bg-muted/10">
        <span className="flex items-center gap-2 text-primary">
          <Plus className="h-4 w-4" /> Cadastrar Pontuação (Súmula)
        </span>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <CategoryEventFilter
            categories={categories}
            events={events}
            selectedCategory={scoreCategory}
            selectedEvent={scoreEvent}
            onCategoryChange={(v) => { setScoreCategory(v); setScoreEvent('') }}
            onEventChange={setScoreEvent}
            loadingEvents={eventsLoading}
          />

          <div className="space-y-1.5">
            <Label>Código de inscrição *</Label>
            <div className="relative">
              <Input
                value={form.code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="Código do time inscrito"
                className="pr-9"
              />
              {lookingUp && (
                <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {teamInfo && (
              <div className="rounded-lg bg-muted/40 px-3 py-2 space-y-0.5 border border-border">
                <p className="text-sm font-bold">{teamInfo.team}</p>
                <p className="text-xs text-muted-foreground">
                  {(teamInfo.category || (teamInfo as any).category)?.name || 'Categoria não identificada'}
                </p>
                {((teamInfo.athletes || (teamInfo as any).athletes) || []).length > 0 && (
                  <p className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                    {(teamInfo.athletes || (teamInfo as any).athletes).map((a: any) => a.name).join(' · ')}
                  </p>
                )}
              </div>
            )}
          </div>

          {!teamInfo && (
            <div className="h-4" /> 
          )}
          {teamInfo && (
            <>
              {(() => {
                const eventObj = events.find(e => String(e.idEvent) === scoreEvent)
                const workoutObj = workouts.find(w => String(w.code) === String(eventObj?.workout))
                const type = workoutObj?.type

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Caso Tempo */}
                    {(type === 'time' || !type) && (
                      <>
                        <div className="space-y-1.5 flex-1 max-w-[140px]">
                          <div className="flex items-center justify-between">
                            <Label>Tempo</Label>
                            {workoutObj?.timeCap && (
                              <Button 
                                type="button" 
                                variant={form.time === workoutObj.timeCap ? "default" : "outline"}
                                size="xs"
                                className="h-5 px-1.5 text-[10px] uppercase font-bold tracking-tighter"
                                onClick={() => set('time', workoutObj.timeCap!)}
                              >
                                CAP
                              </Button>
                            )}
                          </div>
                          <Input 
                            value={form.time} 
                            onChange={(e) => set('time', formatTime(e.target.value))} 
                            placeholder="00:00" 
                          />
                        </div>
                        {type === 'time' && (
                          <div className="space-y-1.5">
                            <Label className="text-amber-600 dark:text-amber-400">Reps Faltantes</Label>
                            <Input 
                              value={form.reps} 
                              onChange={(e) => set('reps', e.target.value)} 
                              placeholder="0" 
                            />
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* Caso Carga */}
                    {(type === 'weight' || !type) && (
                      <div className="space-y-1.5">
                        <Label>Carga (kg)</Label>
                        <Input value={form.weight} onChange={(e) => set('weight', e.target.value)} placeholder="0" />
                      </div>
                    )}

                    {/* Caso Reps (AMRAP) */}
                    {(type === 'reps' || !type) && (
                      <div className="space-y-1.5">
                        <Label>Reps</Label>
                        <Input value={form.reps} onChange={(e) => set('reps', e.target.value)} placeholder="0" />
                      </div>
                    )}
                  </div>
                )
              })()}

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                  <FileImage className="h-3.5 w-3.5" /> Súmula (A4)
                </Label>
                <div className="flex justify-center">
                  <div
                    {...getRootProps()}
                    className={cn(
                      'aspect-[210/297] w-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden',
                      isDragActive
                        ? 'border-primary bg-primary/10 scale-105'
                        : 'border-border hover:border-primary/50 bg-muted/20'
                    )}
                  >
                    <input {...getInputProps()} />
                    {photoPreview ? (
                      <img src={photoPreview} alt="Súmula" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground px-2 text-center">
                        <Upload className="h-5 w-5 opacity-40" />
                        <span className="text-[10px] font-medium">Upload A4</span>
                      </div>
                    )}
                  </div>
                </div>
                {uploading && (
                  <div className="space-y-1">
                    <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">Enviando {Math.round(progress)}%</p>
                  </div>
                )}
                {downloadURL && !uploading && (
                  <p className="text-[10px] text-green-500 font-medium text-center flex items-center justify-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Foto processada
                  </p>
                )}
              </div>

              <div className="flex gap-3 justify-end mt-4">
                <Button type="submit" size="sm" disabled={saving || uploading}>
                  {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-2 h-3.5 w-3.5" />}
                  Salvar Pontuação
                </Button>
              </div>
            </>
          )}
        </form>

      {/* Modal de Crop A4 */}
      <Dialog open={cropOpen} onOpenChange={setCropOpen}>
        <DialogContent className="max-w-2xl bg-background border-border">
          <DialogHeader>
            <DialogTitle>Ajustar Súmula (Aspecto A4)</DialogTitle>
          </DialogHeader>
          <div className="relative h-[500px] w-full bg-black rounded-md overflow-hidden mt-2">
            {imageToCrop && (
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={210 / 297}
                onCropChange={setCrop}
                onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                onZoomChange={setZoom}
              />
            )}
          </div>
          <div className="flex items-center gap-4 py-3">
            <span className="text-sm font-medium">Zoom</span>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-primary h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <Button variant="ghost" size="sm" onClick={() => setCropOpen(false)} disabled={isProcessing || uploading}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirmCrop} disabled={isProcessing || uploading}>
              { (isProcessing || uploading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null }
              Confirmar Seleção
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function GameDetailClient() {
  const { code } = useParams<{ code: string }>()
  const { game, loading: gameLoading } = useGame(code)
  const { workouts, loading: wodLoading, error: wodError } = useWorkouts(code)
  const { user } = useAuth()

  // Inscrições
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loadingReg, setLoadingReg] = useState(false)
  const [regLoaded, setRegLoaded] = useState(false)
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null)
  const [regSearch, setRegSearch] = useState('')
  const [regPage, setRegPage] = useState(1)
  const [regPerPage, setRegPerPage] = useState(10)
  const [isAddRegOpen, setIsAddRegOpen] = useState(false)

  // Scores (revisão)
  const [scoreCategory, setScoreCategory] = useState('')
  const [scoreEvent, setScoreEvent] = useState('')
  const { events, loading: eventsLoading } = useEvents(code, scoreCategory)
  const { scores, loading: scoresLoading, refetch: refetchScores } = useScores(code, scoreCategory, scoreEvent)

  // Leaderboard oficial
  const [lbCategory, setLbCategory] = useState('')
  const { entries: lbEntries, loading: lbLoading } = useLeaderboard(code, lbCategory)

  // Preview do leaderboard
  const [previewCategory, setPreviewCategory] = useState('')
  const [previewTeams, setPreviewTeams] = useState<any[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [savingLeaderboard, setSavingLeaderboard] = useState(false)

  // Cálculo de evento individual
  const [eventCalcOpen, setEventCalcOpen] = useState(false)
  const [eventCalcCategory, setEventCalcCategory] = useState('')
  const [eventCalcEvent, setEventCalcEvent] = useState('')
  const [loadingEventCalc, setLoadingEventCalc] = useState(false)
  const [savingEventCalc, setSavingEventCalc] = useState(false)
  const { events: eventCalcEvents, loading: eventCalcEventsLoading } = useEvents(code, eventCalcCategory)

  // Score detail modal
  const [selectedScore, setSelectedScore] = useState<Score | null>(null)
  const [loadingScoreDetail, setLoadingScoreDetail] = useState(false)

  // Reload WOD list after add
  const [wodKey, setWodKey] = useState(0)

  // Juízes
  const [judges, setJudges] = useState<any[]>([])
  const [loadingJudges, setLoadingJudges] = useState(false)
  const [persons, setPersons] = useState<any[]>([])
  const [loadingPersons, setLoadingPersons] = useState(false)
  const [personSearch, setPersonSearch] = useState('')

  // Workout edit/delete
  const [editingWod, setEditingWod] = useState<WodItem | null>(null)
  const [editWodForm, setEditWodForm] = useState({ title: '', description: '', timeCap: '', type: '', category: '' })
  const [savingWod, setSavingWod] = useState(false)
  const [deletingWodCode, setDeletingWodCode] = useState<number | null>(null)

  // Pontuação
  const [points, setPoints] = useState<any[]>([])
  const [loadingPoints, setLoadingPoints] = useState(false)
  const [pointsCategory, setPointsCategory] = useState('')

  // Parciais & Análise
  const [parciaisCategory, setParciaisCategory] = useState('')
  const [parciaisData, setParciaisData] = useState<any[]>([])
  const [loadingParciais, setLoadingParciais] = useState(false)

  // Súmulas
  const [sumulaCategory, setSumulaCategory] = useState('')
  const [sumulaEvent, setSumulaEvent] = useState('')
  const [sumulaTemplateUrl, setSumulaTemplateUrl] = useState('')

  // Estados de Edição de Nome do Time e Score
  const [isEditingTeamName, setIsEditingTeamName] = useState(false)
  const [editTeamNameValue, setEditTeamNameValue] = useState('')
  const [isSavingTeamName, setIsSavingTeamName] = useState(false)
  const [isEditingScore, setIsEditingScore] = useState(false)
  const [editScoreForm, setEditScoreForm] = useState({ time: '', reps: '', weight: '', point: 0, isWO: false })
  const [isSavingScore, setIsSavingScore] = useState(false)

  interface EditRegForm {
    team: string;
    categoryId: number;
    status: string;
    number: string;
    athletes: Array<{
      code?: number;
      name: string;
      cpf?: string;
      phonenumber?: string;
    }>;
  }

  // Estados de Edição de Inscrição Completa
  const [isEditingReg, setIsEditingReg] = useState(false)
  const [isSavingReg, setIsSavingReg] = useState(false)
  const [editRegForm, setEditRegForm] = useState<EditRegForm>({
    team: '',
    categoryId: 0,
    status: '',
    number: '',
    athletes: []
  })

  // Preview e outros estados (removendo any onde possível ou tipando o callback)
  const [previewMetadata, setPreviewMetadata] = useState<any>(null)
  const [eventCalcPreview, setEventCalcPreview] = useState<any>(null)
  const [previewRegistration, setPreviewRegistration] = useState<Registration | null>(null)
  const [copiedLayout, setCopiedLayout] = useState<string | null>(null)
  const [pasteKey, setPasteKey] = useState(0)

  // Sincronizar eventos para a aba de súmulas
  const [sumulaEvents, setSumulaEvents] = useState<any[]>([])
  useEffect(() => {
    if (sumulaCategory && code) {
      eventsApi.list(code, sumulaCategory).then(r => setSumulaEvents(r.data))
    }
  }, [code, sumulaCategory])

  const categories = game?.categories ?? []

  function handleTabChange(tab: string) {
    if (tab === 'inscricoes' && !regLoaded) {
      setLoadingReg(true)
      registrationApi
        .list(code)
        .then((res) => { setRegistrations(res.data); setRegLoaded(true) })
        .catch(() => toast.error('Erro ao carregar inscrições'))
        .finally(() => setLoadingReg(false))
    }

    if (tab === 'judges') {
      loadJudges()
      loadPersons()
    }

    if (tab === 'pontuacao' && !pointsCategory && categories.length > 0) {
      setPointsCategory(String(categories[0].code))
      loadPoints(String(categories[0].code))
    }
  }

  const loadJudges = useCallback(() => {
    setLoadingJudges(true)
    api.get(`judges/${code}`)
      .then(res => setJudges(res.data))
      .catch(() => toast.error('Erro ao carregar juízes'))
      .finally(() => setLoadingJudges(false))
  }, [code])

  const loadPersons = useCallback(() => {
    setLoadingPersons(true)
    api.get('person')
      .then(res => setPersons(res.data))
      .catch(() => toast.error('Erro ao carregar pessoas'))
      .finally(() => setLoadingPersons(false))
  }, [])

  const loadPoints = useCallback((catId: string) => {
    if (!catId) return
    setLoadingPoints(true)
    api.get(`points/${code}/${catId}`)
      .then(res => setPoints(res.data))
      .catch(() => toast.error('Erro ao carregar pontuação'))
      .finally(() => setLoadingPoints(false))
  }, [code])

  async function openScoreDetail(score: Score) {
    if (!score.code) return
    setLoadingScoreDetail(true)
    setSelectedScore(score)
    try {
      const res = await scoresApi.getByCode(String(score.code))
      setSelectedScore(res.data)
    } catch {
      // keep the data already available from the list
    } finally {
      setLoadingScoreDetail(false)
    }
  }

  function handleScoreCategoryChange(v: string) {
    setScoreCategory(v)
    setScoreEvent('')
    // Load registrations (shared with Inscrições tab) if not done yet
    if (!regLoaded) {
      setLoadingReg(true)
      registrationApi
        .list(code)
        .then((res) => { setRegistrations(res.data); setRegLoaded(true) })
        .catch(() => { })
        .finally(() => setLoadingReg(false))
    }
  }

  // Carregar preview do leaderboard
  async function loadLeaderboardPreview() {
    if (!previewCategory) {
      toast.error('Selecione uma categoria')
      return
    }
    setLoadingPreview(true)
    try {
      const res = await fetch(`/api/leaderboard/preview/${code}/${previewCategory}`)
      const data = await res.json()
      setPreviewTeams(data.teams || [])
      setPreviewMetadata(data.metadata || null)
    } catch (error) {
      toast.error('Erro ao carregar preview')
      console.error(error)
    } finally {
      setLoadingPreview(false)
    }
  }

  // Gravar leaderboard oficial
  async function handleSaveLeaderboard() {
    if (!previewCategory) {
      toast.error('Selecione uma categoria')
      return
    }

    if (!previewTeams.length) {
      toast.error('Nenhum dado para gravar. Carregue o preview primeiro.')
      return
    }

    const eventsCount = previewMetadata?.eventsCalculated || 0
    const teamsCount = previewTeams.length

    if (!confirm(
      `Gravar Leaderboard Oficial?\n\n` +
      `📊 ${teamsCount} times serão salvos\n` +
      `✅ ${eventsCount} eventos calculados\n\n` +
      `Esta ação irá atualizar o leaderboard oficial no banco de dados.`
    )) {
      return
    }

    setSavingLeaderboard(true)
    try {
      const executedBy = user?.email || 'admin'
      const res = await fetch(`/api/leaderboard/save/${code}/${previewCategory}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teams: previewTeams,
          executedBy
        })
      })
      const data = await res.json()

      if (data.success) {
        toast.success(`✅ Leaderboard gravado com sucesso!\n${data.teamsAffected} times atualizados`)
        // Recarregar preview para mostrar dados atualizados
        await loadLeaderboardPreview()
      } else {
        toast.error(data.error || 'Erro ao gravar leaderboard')
      }
    } catch (error) {
      toast.error('Erro ao gravar leaderboard')
      console.error(error)
    } finally {
      setSavingLeaderboard(false)
    }
  }

  // Preview de cálculo de evento individual
  async function handleEventCalcPreview() {
    if (!eventCalcCategory) {
      toast.error('Selecione uma categoria')
      return
    }
    if (!eventCalcEvent) {
      toast.error('Selecione um evento')
      return
    }

    setLoadingEventCalc(true)
    try {
      const res = await fetch(`/api/leaderboard/calculate-event/${code}/${eventCalcCategory}/${eventCalcEvent}`)
      const data = await res.json()

      if (data.success) {
        setEventCalcPreview(data)
        toast.success(`✅ Preview calculado!\n${data.stats.participated} participantes\n${data.stats.walkOver} WOs`)
      } else {
        toast.error(data.error || 'Erro ao calcular preview')
      }
    } catch (error) {
      toast.error('Erro ao calcular preview do evento')
      console.error(error)
    } finally {
      setLoadingEventCalc(false)
    }
  }

  // Gravar cálculo de evento individual
  async function handleEventCalcSave() {
    if (!eventCalcCategory || !eventCalcEvent) {
      toast.error('Selecione categoria e evento')
      return
    }

    const eventTitle = eventCalcEvents.find(e => String(e.idEvent) === eventCalcEvent)?.title || 'evento'

    if (!confirm(
      `Gravar cálculo do evento "${eventTitle}"?\n\n` +
      `Isso irá:\n` +
      `• Aplicar Dense Rank (empates = mesma posição)\n` +
      `• Criar WO automático\n` +
      `• Salvar no banco de dados\n` +
      `• Atualizar leaderboard geral`
    )) {
      return
    }

    setSavingEventCalc(true)
    try {
      const res = await fetch(`/api/leaderboard/calculate-event/${code}/${eventCalcCategory}/${eventCalcEvent}`, {
        method: 'POST'
      })
      const data = await res.json()

      if (data.success) {
        toast.success(`✅ Evento "${eventTitle}" calculado e gravado!\n${data.teamsAffected} times afetados`)
        // Limpar preview e recarregar leaderboard geral
        setEventCalcPreview(null)
        setEventCalcEvent('')
        if (previewCategory === eventCalcCategory) {
          await loadLeaderboardPreview()
        }
      } else {
        toast.error(data.error || 'Erro ao gravar evento')
      }
    } catch (error) {
      toast.error('Erro ao gravar cálculo do evento')
      console.error(error)
    } finally {
      setSavingEventCalc(false)
    }
  }

  // Limpar todos os cálculos da categoria
  async function handleClearAllCalculations() {
    if (!previewCategory) {
      toast.error('Selecione uma categoria primeiro')
      return
    }

    const categoryName = categories.find(c => String(c.code) === previewCategory)?.name || 'categoria'

    if (!confirm(
      `⚠️⚠️⚠️ ATENÇÃO: LIMPAR TODOS OS CÁLCULOS? ⚠️⚠️⚠️\n\n` +
      `Categoria: ${categoryName}\n\n` +
      `Esta ação irá:\n` +
      `• DELETAR todo o leaderboard desta categoria\n` +
      `• REMOVER todos os rankings e pontos dos scores\n` +
      `• DELETAR todos os scores WO\n` +
      `• MARCAR todo histórico como revertido\n` +
      `• RESETAR todos os eventos para não calculados\n\n` +
      `Você poderá recalcular tudo do zero após limpar.\n\n` +
      `ESTA AÇÃO NÃO PODE SER DESFEITA!\n\n` +
      `Digite "LIMPAR" para confirmar:`
    )) {
      return
    }

    const confirmation = prompt('Digite "LIMPAR" para confirmar a limpeza completa:')
    if (confirmation !== 'LIMPAR') {
      toast.error('Operação cancelada')
      return
    }

    try {
      const res = await fetch(`/api/leaderboard/clear-all/${code}/${previewCategory}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clearedBy: user?.email || 'admin'
        })
      })
      const data = await res.json()

      if (data.success) {
        toast.success(
          `✅ Todos os cálculos foram limpos!\n\n` +
          `${data.eventsCleared} eventos resetados\n` +
          `${data.teamsAffected} times afetados\n\n` +
          `Você pode recalcular tudo agora.`
        )
        // Recarregar preview (deve mostrar vazio)
        setPreviewTeams([])
        setPreviewMetadata(null)
        await loadLeaderboardPreview()
      } else {
        toast.error(data.error || 'Erro ao limpar cálculos')
      }
    } catch (error) {
      toast.error('Erro ao limpar todos os cálculos')
      console.error(error)
    }
  }

  // Carregar dados parciais
  async function loadParciaisData() {
    if (!parciaisCategory) {
      toast.error('Selecione uma categoria')
      return
    }

    setLoadingParciais(true)
    try {
      const res = await fetch(`/api/leaderboard/parciais/${code}/${parciaisCategory}`)
      const data = await res.json()

      if (data.success) {
        setParciaisData(data.data || [])
      } else {
        toast.error(data.error || 'Erro ao carregar dados parciais')
        setParciaisData([])
      }
    } catch (error) {
      toast.error('Erro ao carregar dados parciais')
      console.error(error)
      setParciaisData([])
    } finally {
      setLoadingParciais(false)
    }
  }

  // Exportar para Excel (CSV)
  async function exportToExcel() {
    if (parciaisData.length === 0) {
      toast.error('Não há dados para exportar')
      return
    }

    try {
      // Criar cabeçalhos
      const headers = ['Posição', 'Time', 'Número', 'Atletas']

      // Adicionar cabeçalhos dos eventos
      if (parciaisData[0]?.events) {
        parciaisData[0].events.forEach((event: any, idx: number) => {
          const prefix = `Evento ${idx + 1} (${event.eventTitle})`
          headers.push(`${prefix} - Tipo`)
          headers.push(`${prefix} - Colocação`)
          headers.push(`${prefix} - Tempo`)
          headers.push(`${prefix} - Peso (kg)`)
          headers.push(`${prefix} - Reps`)
          headers.push(`${prefix} - Pontos`)
        })
      }
      headers.push('Total de Pontos')

      // Criar linhas de dados
      const rows = parciaisData.map(team => {
        const row = [
          team.position,
          team.teamName,
          team.teamNumber || '',
          team.athletes.join(' · ')
        ]

        // Adicionar dados de cada evento
        team.events.forEach((event: any) => {
          row.push(event.eventType || 'N/A')
          row.push(event.isWO ? 'WO' : event.rank ? `#${event.rank}` : 'Sem Rank')
          row.push(event.time || '')
          row.push(event.weight || '')
          row.push(event.reps || '')
          row.push(event.points)
        })

        row.push(team.totalPoints)
        return row
      })

      // Converter para CSV
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          // Escapar vírgulas e aspas
          const cellStr = String(cell)
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`
          }
          return cellStr
        }).join(','))
      ].join('\n')

      // Criar blob e fazer download
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)

      const categoryName = categories.find(c => String(c.code) === parciaisCategory)?.name || 'categoria'
      link.setAttribute('href', url)
      link.setAttribute('download', `parciais_${categoryName}_${code}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('CSV exportado com sucesso! Abra no Excel.')
    } catch (error) {
      toast.error('Erro ao exportar CSV')
      console.error(error)
    }
  }

  // Reverter evento
  async function handleReverseEvent(eventId: number, eventTitle: string) {
    if (!previewCategory) {
      toast.error('Selecione uma categoria primeiro')
      return
    }

    if (!confirm(
      `⚠️ Reverter cálculo do evento "${eventTitle}"?\n\n` +
      `Isso irá:\n` +
      `• Remover pontos do leaderboard\n` +
      `• Deletar scores WO criados automaticamente\n` +
      `• Remover ranking dos scores\n` +
      `• Permitir recalcular depois\n\n` +
      `Esta ação não pode ser desfeita diretamente.`
    )) {
      return
    }

    try {
      const res = await fetch(`/api/leaderboard/reverse/${code}/${previewCategory}/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reversedBy: user?.email || 'admin',
          reason: 'Reversão manual via admin'
        })
      })
      const data = await res.json()

      if (data.success) {
        toast.success(
          `✅ Evento "${eventTitle}" revertido com sucesso!\n\n` +
          `${data.teamsAffected} times afetados\n` +
          `${data.pointsRemoved} pontos removidos`
        )
        // Recarregar preview para mostrar alterações
        await loadLeaderboardPreview()
      } else {
        toast.error(data.error || 'Erro ao reverter')
      }
    } catch (error) {
      toast.error('Erro ao reverter evento')
      console.error(error)
    }
  }

  // Atualizar nome do time
  async function handleUpdateTeamName() {
    if (!selectedReg || !editTeamNameValue.trim()) return
    
    setIsSavingTeamName(true)
    try {
      const res = await fetch(`/api/game/register/${selectedReg.code}?game=${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: editTeamNameValue.trim() })
      })
      const data = await res.json()
      
      if (data.success) {
        toast.success('Nome do time atualizado!')
        
        // Atualizar lista local de inscrições
        setRegistrations((prev: Registration[]) => prev.map(r => 
          Number(r.code) === Number(selectedReg!.code) ? { ...r, team: editTeamNameValue.trim() } : r
        ))
        
        // Atualizar selectedReg se estiver aberto
        setSelectedReg(prev => prev ? { ...prev, team: editTeamNameValue.trim() } : null)
        
        // Se houver um selectedScore aberto desse mesmo time, atualizar também
        if (selectedScore && Number(selectedScore.registration?.code) === Number(selectedReg.code)) {
          setSelectedScore(prev => prev ? {
            ...prev,
            registration: { ...prev.registration!, team: editTeamNameValue.trim() }
          } : null)
        }

        setIsEditingTeamName(false)
      } else {
        toast.error(data.error || 'Erro ao atualizar nome')
      }
    } catch (error) {
      toast.error('Erro de conexão ao atualizar nome')
    } finally {
      setIsSavingTeamName(false)
    }
  }

  // Utilitário para pegar o tipo de workout baseado no id do evento
  function getWorkoutType(idEvent: number) {
    if (!game?.categories) return 'reps'
    
    for (const cat of game.categories) {
      const event = cat.events?.find((e: any) => e.idEvent === idEvent)
      if (event) {
        const wod = cat.workouts?.find((w: any) => w.code === event.workout)
        return wod?.type?.toLowerCase() || 'reps'
      }
    }
    return 'reps'
  }

  // Atualização completa da inscrição (Admin)
  async function handleUpdateCompleteRegistration() {
    if (!selectedReg?.code || !code) return
    
    setIsSavingReg(true)
    try {
      const res = await fetch(`/api/game/register/${selectedReg.code}?game=${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editRegForm)
      })
      const data = await res.json()
      
      if (res.ok) {
        toast.success(`Inscrição ${editRegForm.team} atualizada com sucesso!`)
        
        // Atualizar lista local de inscrições
        setRegistrations((prev: Registration[]) => prev.map(r => 
          Number(r.code) === Number(selectedReg!.code) ? { ...r, ...editRegForm } as Registration : r
        ))
        
        // Se houver um selectedScore aberto, atualizar os dados da inscrição nele também
        if (selectedScore && Number(selectedScore.codeTeam) === Number(selectedReg.code)) {
           setSelectedScore((prev: Score | null) => prev ? {
             ...prev,
             registration: { ...prev.registration!, team: editRegForm.team }
           } : null)
        }

        setSelectedReg({ ...selectedReg, ...editRegForm } as Registration)
        setIsEditingReg(false)
      } else {
        toast.error(data.error || 'Erro ao atualizar inscrição')
      }
    } catch (error) {
      toast.error('Erro de conexão ao atualizar inscrição')
    } finally {
      setIsSavingReg(false)
    }
  }

  // Atualizar score
  async function handleUpdateScore() {
    if (!selectedScore?.code) return
    
    setIsSavingScore(true)
    try {
      const res = await fetch(`/api/score/code/${selectedScore.code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editScoreForm)
      })
      const data = await res.json()
      
      if (data.success) {
        toast.success('Resultado do score atualizado!')
        
        // Atualizar estado local do score selecionado
        const updatedScore = { ...selectedScore, ...editScoreForm }
        setSelectedScore(updatedScore)
        
        // Refetch scores na lista para garantir que o ranking e visualização atualizem
        refetchScores()
        
        setIsEditingScore(false)
      } else {
        toast.error(data.error || 'Erro ao atualizar score')
      }
    } catch (error) {
      toast.error('Erro de conexão ao atualizar score')
    } finally {
      setIsSavingScore(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />
      
      {game?.foto && (
        <div className="relative h-48 sm:h-64 w-full rounded-2xl overflow-hidden mb-6 shadow-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={game.foto} 
            alt={game?.name || 'Cover'} 
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
            <div className="space-y-1">
              <Badge className="bg-primary/90 text-primary-foreground border-none hover:bg-primary uppercase text-[10px] font-bold px-2 py-0.5">
                Painel Administrativo
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-black text-white uppercase drop-shadow-md">
                {game?.name}
              </h2>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/admin/games"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            {gameLoading ? (
              <Skeleton className="h-8 w-48" />
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black">{game?.name}</h1>
                {game?.status && (
                  <Badge variant={statusColor(game.status)}>{game.status}</Badge>
                )}
              </div>
            )}
            {game?.date && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {new Date(game.date).toLocaleDateString('pt-BR')}
                {game.location ? ` · ${game.location}` : ''}
              </p>
            )}
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/games/${code}/edit`} className="flex items-center gap-1.5">
            <Pencil className="h-4 w-4" /> Editar
          </Link>
        </Button>
      </div>

      {/* ── Alert for Lowest Points Mode ── */}
      {game?.isLowestPointsBetter && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 dark:text-amber-400 text-sm font-medium">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
          <span>
            <strong>ATENÇÃO:</strong> Este campeonato usa <strong>MENOR PONTUAÇÃO VENCE</strong> (Lower points = Better ranking)
          </span>
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs defaultValue="categorias" onValueChange={handleTabChange}>
        <TabsList className="w-full overflow-x-auto flex flex-nowrap h-auto gap-1 p-1">
          <TabsTrigger value="categorias" className="flex items-center gap-1.5 whitespace-nowrap">
            <List className="h-4 w-4" /> Categorias
          </TabsTrigger>
          <TabsTrigger value="workout" className="flex items-center gap-1.5 whitespace-nowrap">
            <Dumbbell className="h-4 w-4" /> Workout
          </TabsTrigger>
          <TabsTrigger value="inscricoes" className="flex items-center gap-1.5 whitespace-nowrap">
            <Users className="h-4 w-4" /> Inscrições
          </TabsTrigger>
          <TabsTrigger value="scores" className="flex items-center gap-1.5 whitespace-nowrap">
            <BarChart2 className="h-4 w-4" /> Scores
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="flex items-center gap-1.5 whitespace-nowrap">
            <Trophy className="h-4 w-4" /> Leaderboard
          </TabsTrigger>
          <TabsTrigger value="judges" className="flex items-center gap-1.5 whitespace-nowrap">
            <ShieldCheck className="h-4 w-4" /> Juízes
          </TabsTrigger>
          <TabsTrigger value="pontuacao" className="flex items-center gap-1.5 whitespace-nowrap">
            <Settings2 className="h-4 w-4" /> Pontuação
          </TabsTrigger>
          <TabsTrigger value="sumulas" className="flex items-center gap-1.5 whitespace-nowrap">
            <ScrollText className="h-4 w-4" /> Súmulas
          </TabsTrigger>
        </TabsList>

        {/* ── CATEGORIAS ── */}
        <TabsContent value="categorias" className="mt-4">
          {gameLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : !categories.length ? (
            <p className="text-muted-foreground text-sm py-12 text-center">Nenhuma categoria cadastrada.</p>
          ) : (
            <div className="space-y-3">
              {categories.map((cat) => (
                <div key={cat.code} className="flex items-start justify-between rounded-xl border border-border bg-card p-4">
                  <div>
                    <p className="font-bold">{cat.name}</p>
                    {cat.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                    )}
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {cat.maxAthlete} atleta(s)
                      </span>
                      <span>R$ {cat.amount}</span>
                    </div>
                  </div>
                  <Badge variant="outline">{cat.events?.length ?? 0} eventos</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── WORKOUT ── */}
        <TabsContent value="workout" className="mt-4 space-y-4">
          {/* Cadastro */}
          {!gameLoading && (
            <AddWodForm
              key={wodKey}
              gameCode={code}
              categories={categories}
              onCreated={() => setWodKey((k) => k + 1)}
            />
          )}

          {/* Lista */}
          <div className="space-y-3">
            {wodLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
            ) : wodError || !workouts.length ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Nenhum workout cadastrado.</p>
            ) : (
              workouts.map((wod: WodItem) => (
                <div key={wod.code} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px] uppercase font-bold text-orange-500 border-orange-500/30 bg-orange-500/5 px-1.5 py-0">
                          {categories.find(c => String(c.code) === String(wod.category))?.name || 'Geral'}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] uppercase font-bold px-1.5 py-0">{wod.type}</Badge>
                      </div>
                      <h4 className="font-black text-base uppercase leading-tight">{wod.title}</h4>
                      {wod.timeCap && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Settings2 className="h-3 w-3" /> Time Cap: {wod.timeCap}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setEditingWod(wod)
                          setEditWodForm({
                            title: wod.title,
                            description: wod.description || '',
                            timeCap: wod.timeCap || '',
                            type: wod.type || 'time',
                            category: String(wod.category)
                          })
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={async () => {
                          if (!confirm('Deseja excluir este workout?')) return
                          try {
                            await api.delete(`workout/${code}/${wod.code}`)
                            toast.success('Workout removido!')
                            setWodKey(k => k + 1)
                          } catch {
                            toast.error('Erro ao remover')
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {wod.description && (
                    <div
                      className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: wod.description }}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* ── INSCRIÇÕES ── */}
        <TabsContent value="inscricoes" className="mt-4 space-y-3">
          {loadingReg ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : (() => {
            const q = regSearch.trim().toLowerCase()
            const filtered = registrations.filter((r) =>
              !q ||
              r.team.toLowerCase().includes(q) ||
              r.athletes?.some((a: any) => a.name.toLowerCase().includes(q))
            )
            const totalPages = Math.max(1, Math.ceil(filtered.length / regPerPage))
            const page = Math.min(regPage, totalPages)
            const paged = filtered.slice((page - 1) * regPerPage, page * regPerPage)

            return (
              <>
                {/* Busca + por página */}
                <div className="flex items-center gap-2">
                  <Input
                    value={regSearch}
                    onChange={(e) => { setRegSearch(e.target.value); setRegPage(1) }}
                    placeholder="Buscar por time ou atleta…"
                    className="flex-1"
                  />
                  <Button
                    onClick={() => setIsAddRegOpen(true)}
                    className="shrink-0 gap-1.5"
                    disabled={!game}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Cadastrar Inscrição</span>
                  </Button>
                  <Select value={String(regPerPage)} onValueChange={(v) => { setRegPerPage(Number(v)); setRegPage(1) }}>
                    <SelectTrigger className="w-24 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="30">30</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Contagem */}
                <p className="text-xs text-muted-foreground">
                  {filtered.length} inscrição{filtered.length !== 1 ? 'ões' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
                </p>

                {/* Lista */}
                {!filtered.length ? (
                  <p className="text-muted-foreground text-sm py-12 text-center">Nenhuma inscrição encontrada.</p>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    {paged.map((reg, idx) => (
                      <button
                        key={reg.code ?? idx}
                        type="button"
                        onClick={() => setSelectedReg(reg)}
                        className="w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted-foreground font-mono leading-none mb-0.5">#{reg.number}</p>
                          <p className="font-bold text-sm truncate">{reg.team}</p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {typeof reg.category === 'string' ? reg.category : (reg.category as any)?.name || 'Sem Categoria'}
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-primary hover:bg-primary/10 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditRegForm({
                              team: reg.team || '',
                              categoryId: reg.categoryId || (reg.category as any)?.code || 0,
                              status: reg.status || '',
                              number: reg.number || '',
                              athletes: (reg.athletes || []).map((a: any) => ({
                                code: a.code,
                                name: a.name,
                                cpf: a.cpf,
                                phonenumber: a.phonenumber
                              }))
                            })
                            setSelectedReg(reg)
                            setIsEditingReg(true)
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </button>
                    ))}
                  </div>
                )}

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRegPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Anterior
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRegPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Próxima
                    </Button>
                  </div>
                )}
              </>
            )
          })()}
        </TabsContent>

        {/* ── SCORES ── */}
        <TabsContent value="scores" className="mt-4 space-y-4">
          {/* Cadastro de score */}
          {!gameLoading && <AddScoreForm gameCode={code} categories={categories} workouts={workouts} />}

          {/* Filtros e lista */}
          {!gameLoading && (
            <CategoryEventFilter
              categories={categories}
              events={events}
              selectedCategory={scoreCategory}
              selectedEvent={scoreEvent}
              onCategoryChange={handleScoreCategoryChange}
              onEventChange={setScoreEvent}
              loadingEvents={eventsLoading}
            />
          )}

          {!scoreEvent ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Selecione categoria e evento para ver os scores.
            </p>
          ) : scoresLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : (() => {
            // Cross-reference: teams that already submitted a score for this event
            const scoredTeams = new Set(scores.map((s) => s.registration?.team))
            // Registrations for the selected category not yet scored
            const pending = registrations.filter(
              (r) => String(r.categoryId) === scoreCategory && !scoredTeams.has(r.team)
            )

            return (
              <div className="space-y-6">
                {/* ── Com Score ── */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <BarChart2 className="h-3.5 w-3.5" /> Com Score
                    <span className="ml-1 bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px]">
                      {scores.length}
                    </span>
                  </p>
                  {!scores.length ? (
                    <p className="text-muted-foreground text-xs py-3 text-center">Nenhum score registrado.</p>
                  ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                      {scores.map((score, idx) => (
                        <div
                          key={score.code ?? idx}
                          className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                        >
                          <span className="text-xl font-black text-muted-foreground w-8 text-center">{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => openScoreDetail(score)}
                            className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                          >
                            <p className="font-bold text-sm truncate">{score.registration?.team}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {score.registration?.athletes?.map((a) => a.name).join(' · ')}
                            </p>
                          </button>
                          <div className="flex items-center gap-2 shrink-0">
                            <ScoreBadges score={score} className="text-xs" />
                            {score.code && <DeleteScoreButton scoreCode={String(score.code)} onDeleted={refetchScores} />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Pendentes ── */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Pendentes
                    {loadingReg ? (
                      <Skeleton className="h-3.5 w-8 rounded-full ml-1" />
                    ) : (
                      <span className="ml-1 bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px]">
                        {pending.length}
                      </span>
                    )}
                  </p>
                  {loadingReg ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                    </div>
                  ) : !pending.length ? (
                    <p className="text-muted-foreground text-xs py-3 text-center">
                      Todos os times já enviaram score.
                    </p>
                  ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                      {pending.map((reg, idx) => (
                        <div
                          key={reg.code ?? idx}
                          className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0"
                        >
                          <span className="text-xs font-black text-muted-foreground w-6 text-center shrink-0">
                            #{reg.number}
                          </span>
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedReg(reg)}>
                            <p className="font-bold text-sm truncate">{reg.team}</p>
                            {reg.athletes && reg.athletes.length > 0 && (
                              <p className="text-[10px] text-muted-foreground truncate">
                                {reg.athletes.map((a: any) => a.name).join(' · ')}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">Pendente</Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-primary hover:bg-primary/10 shrink-0"
                            onClick={() => {
                              setEditRegForm({
                                team: reg.team || '',
                                categoryId: reg.categoryId || (reg.category as any)?.code || 0,
                                status: reg.status || '',
                                number: reg.number || '',
                                athletes: (reg.athletes || []).map((a: any) => ({
                                  code: a.code,
                                  name: a.name,
                                  cpf: a.cpf,
                                  phonenumber: a.phonenumber
                                }))
                              })
                              setSelectedReg(reg)
                              setIsEditingReg(true)
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </TabsContent>

        {/* ── LEADERBOARD ── */}
        <TabsContent value="leaderboard" className="mt-4">
          <Tabs defaultValue="oficial">
            <TabsList className="mb-4">
              <TabsTrigger value="oficial" className="flex items-center gap-1.5">
                <Trophy className="h-4 w-4" /> Oficial
              </TabsTrigger>
              <TabsTrigger value="revisao" className="flex items-center gap-1.5">
                <Eye className="h-4 w-4" /> Preview & Gestão
              </TabsTrigger>
              <TabsTrigger value="parciais" className="flex items-center gap-1.5">
                <BarChart2 className="h-4 w-4" /> Parciais & Análise
              </TabsTrigger>
            </TabsList>

            {/* LB Oficial */}
            <TabsContent value="oficial" className="space-y-4">
              {!gameLoading && (
                <Select value={lbCategory} onValueChange={setLbCategory}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.code} value={String(c.code)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!lbCategory ? (
                <p className="text-muted-foreground text-sm py-8 text-center">
                  Selecione uma categoria para ver o ranking.
                </p>
              ) : (
                <LeaderboardTable entries={lbEntries as LeaderboardEntry[]} loading={lbLoading} />
              )}
            </TabsContent>

            {/* LB Preview */}
            <TabsContent value="revisao" className="space-y-4">
              {/* Calcular Evento Individual */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Calcular Evento Individual
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Calcule e grave eventos um por vez (menor tempo ganha, maior peso/reps ganha)
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEventCalcOpen(!eventCalcOpen)}
                  >
                    {eventCalcOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>

                {eventCalcOpen && (
                  <div className="space-y-4 pt-2 border-t">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {!gameLoading && (
                        <>
                          <div className="space-y-1.5">
                            <Label>Categoria</Label>
                            <Select value={eventCalcCategory} onValueChange={(v) => { setEventCalcCategory(v); setEventCalcEvent(''); setEventCalcPreview(null) }}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a categoria" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((c) => (
                                  <SelectItem key={c.code} value={String(c.code)}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label>Evento</Label>
                            <Select value={eventCalcEvent} onValueChange={(v) => { setEventCalcEvent(v); setEventCalcPreview(null) }} disabled={!eventCalcCategory || eventCalcEventsLoading}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o evento" />
                              </SelectTrigger>
                              <SelectContent>
                                {eventCalcEvents.map((e) => (
                                  <SelectItem key={e.idEvent} value={String(e.idEvent)}>
                                    {e.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={handleEventCalcPreview}
                        disabled={loadingEventCalc || !eventCalcCategory || !eventCalcEvent}
                        variant="outline"
                      >
                        {loadingEventCalc ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Calculando...</>
                        ) : (
                          <><Eye className="h-4 w-4 mr-2" /> Preview</>
                        )}
                      </Button>

                      {eventCalcPreview && (
                        <Button
                          onClick={handleEventCalcSave}
                          disabled={savingEventCalc}
                        >
                          {savingEventCalc ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gravando...</>
                          ) : (
                            <><CheckCircle className="h-4 w-4 mr-2" /> Gravar Evento</>
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Preview do Evento */}
                    {eventCalcPreview && (
                      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Preview do Cálculo</h4>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span>✅ {eventCalcPreview.stats.participated} participantes</span>
                            <span>🚫 {eventCalcPreview.stats.walkOver} WOs</span>
                          </div>
                        </div>

                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {eventCalcPreview.completed.map((score: any) => (
                            <div key={score.codeTeam} className="flex items-center justify-between p-2 rounded bg-card border border-border text-sm">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">#{score.rank}</span>
                                  <span className="text-xs text-muted-foreground/60">
                                    {score.teamNumber ? `#${score.teamNumber}` : `Time ${score.codeTeam}`}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground truncate">{score.teamName || `Time ${score.codeTeam}`}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono text-xs">
                                  {score.time && score.reps ? `${score.time} + ${score.reps} reps` :
                                   score.time ? score.time :
                                   score.weight ? `${score.weight}kg` :
                                   score.reps ? `${score.reps} reps` : '-'}
                                </div>
                                <div className="text-xs text-primary font-semibold">{score.point} pts</div>
                              </div>
                            </div>
                          ))}
                          {eventCalcPreview.walkOver.map((score: any) => (
                            <div key={score.codeTeam} className="flex items-center justify-between p-2 rounded bg-amber-500/5 border border-amber-500/20 text-sm">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-amber-600">WO #{score.rank}</span>
                                  <span className="text-xs text-muted-foreground/60">
                                    {score.teamNumber ? `#${score.teamNumber}` : `Time ${score.codeTeam}`}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground truncate">{score.teamName || `Time ${score.codeTeam}`}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-amber-600 font-semibold">{score.point} pts</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Preview Leaderboard Completo */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {!gameLoading && (
                    <Select value={previewCategory} onValueChange={setPreviewCategory}>
                      <SelectTrigger className="w-full sm:w-64">
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.code} value={String(c.code)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    onClick={loadLeaderboardPreview}
                    disabled={loadingPreview || !previewCategory}
                    variant="outline"
                  >
                    {loadingPreview ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Calculando...</>
                    ) : (
                      <><Eye className="h-4 w-4 mr-2" /> Visualizar Preview</>
                    )}
                  </Button>
                  {previewTeams.length > 0 && (
                    <Button
                      onClick={handleSaveLeaderboard}
                      disabled={savingLeaderboard}
                    >
                      {savingLeaderboard ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gravando...</>
                      ) : (
                        <><CheckCircle className="h-4 w-4 mr-2" /> Gravar Leaderboard</>
                      )}
                    </Button>
                  )}
                </div>

                {previewMetadata && (
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>📊 {previewMetadata.totalTeams} times</span>
                    <span>✅ {previewMetadata.eventsCalculated} eventos calculados</span>
                    {previewMetadata.lastUpdate && (
                      <span>🕐 Último cálculo: {new Date(previewMetadata.lastUpdate).toLocaleString('pt-BR')}</span>
                    )}
                  </div>
                )}

                {loadingPreview ? (
                  <div className="space-y-3">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                  </div>
                ) : !previewTeams.length ? (
                  <div className="py-16 text-center border-2 border-dashed border-border rounded-xl">
                    <Eye className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                    <p className="text-muted-foreground">
                      Selecione uma categoria e clique em "Visualizar Preview"
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b border-border">
                          <tr>
                            <th className="px-4 py-3 text-left w-16">Pos</th>
                            <th className="px-4 py-3 text-left">Time</th>
                            <th className="px-4 py-3 text-left">Atletas</th>
                            <th className="px-4 py-3 text-right">Eventos</th>
                            <th className="px-4 py-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewTeams.map((team, index) => (
                            <tr
                              key={team.teamCode}
                              className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "px-2 py-1 rounded-md font-bold text-sm",
                                  team.position === 1 ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400" :
                                  team.position === 2 ? "bg-zinc-300/20 text-zinc-600 dark:text-zinc-300" :
                                  team.position === 3 ? "bg-amber-600/20 text-amber-700 dark:text-amber-400" :
                                  "bg-muted text-muted-foreground"
                                )}>
                                  #{team.position}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-semibold">{team.teamName}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-xs text-muted-foreground truncate max-w-xs">
                                  {team.athletes.join(' · ')}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1 justify-end flex-wrap">
                                  {team.events.map((event: any) => (
                                    <span
                                      key={event.eventId}
                                      className={cn(
                                        "px-2 py-0.5 rounded text-xs font-medium",
                                        event.isWO
                                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                          : "bg-muted text-muted-foreground"
                                      )}
                                      title={`${event.eventTitle}: ${event.result} (${event.points} pts)`}
                                    >
                                      {event.isWO ? 'WO' : `#${event.rank}`} · {event.points}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-lg font-bold text-primary">
                                  {team.totalPoints}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {previewTeams.length > 0 && (
                  <div className="flex gap-4 text-xs text-muted-foreground border-t pt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-primary"></div>
                      <span>Pontuação</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-amber-500/20"></div>
                      <span>Walk Over (WO)</span>
                    </div>
                  </div>
                )}

                {/* Eventos Calculados - Reversão Individual */}
                {previewMetadata?.calculatedEvents && previewMetadata.calculatedEvents.length > 0 && (
                  <div className="space-y-3 border-t pt-4 mt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <Settings2 className="h-4 w-4" />
                        Eventos Calculados ({previewMetadata.calculatedEvents.length})
                      </h3>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleClearAllCalculations}
                        className="text-xs"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Limpar Todos
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {previewMetadata.calculatedEvents.map((event: any) => (
                        <div
                          key={event.eventId}
                          className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20"
                        >
                          <div>
                            <p className="text-sm font-semibold">{event.eventTitle}</p>
                            <p className="text-xs text-muted-foreground">
                              Evento #{event.eventId}
                            </p>
                          </div>
                          {event.canReverse && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReverseEvent(event.eventId, event.eventTitle)}
                              className="text-amber-600 border-amber-600/50 hover:bg-amber-600/10"
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Reverter
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      💡 Reverter um evento remove seus pontos do leaderboard e permite recalculá-lo.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* LB Parciais & Análise */}
            <TabsContent value="parciais" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {!gameLoading && (
                    <Select value={parciaisCategory} onValueChange={(v) => { setParciaisCategory(v); setParciaisData([]) }}>
                      <SelectTrigger className="w-full sm:w-64">
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.code} value={String(c.code)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    onClick={loadParciaisData}
                    disabled={loadingParciais || !parciaisCategory}
                    variant="outline"
                  >
                    {loadingParciais ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando...</>
                    ) : (
                      <><Search className="h-4 w-4 mr-2" /> Carregar Dados</>
                    )}
                  </Button>
                  {parciaisData.length > 0 && (
                    <Button
                      onClick={exportToExcel}
                      variant="default"
                    >
                      <Download className="h-4 w-4 mr-2" /> Exportar Excel
                    </Button>
                  )}
                </div>

                {loadingParciais ? (
                  <div className="space-y-3">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                  </div>
                ) : !parciaisData.length ? (
                  <div className="py-16 text-center border-2 border-dashed border-border rounded-xl">
                    <BarChart2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                    <p className="text-muted-foreground">
                      Selecione uma categoria e clique em "Carregar Dados"
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b border-border">
                          <tr>
                            <th className="px-4 py-3 text-left w-12 sticky left-0 bg-muted/50 z-10">Pos</th>
                            <th className="px-4 py-3 text-left min-w-[200px] sticky left-12 bg-muted/50 z-10">Time</th>
                            {parciaisData[0]?.events.map((event: any, idx: number) => (
                              <th key={event.eventId} className="px-4 py-3 text-center min-w-[180px]">
                                <div className="font-semibold">Evento {idx + 1}</div>
                                <div className="text-xs font-normal text-muted-foreground truncate">{event.eventTitle}</div>
                                <div className="text-xs font-normal text-primary/60">({event.eventType || 'N/A'})</div>
                              </th>
                            ))}
                            <th className="px-4 py-3 text-center w-24 font-bold">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parciaisData.map((team) => (
                            <tr
                              key={team.teamCode}
                              className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                            >
                              <td className="px-4 py-3 sticky left-0 bg-card">
                                <span className={cn(
                                  "px-2 py-1 rounded-md font-bold text-sm",
                                  team.position === 1 ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400" :
                                  team.position === 2 ? "bg-zinc-300/20 text-zinc-600 dark:text-zinc-300" :
                                  team.position === 3 ? "bg-amber-600/20 text-amber-700 dark:text-amber-400" :
                                  "bg-muted text-muted-foreground"
                                )}>
                                  #{team.position}
                                </span>
                              </td>
                              <td className="px-4 py-3 sticky left-12 bg-card">
                                <div>
                                  <p className="font-semibold">{team.teamName}</p>
                                  {team.teamNumber && (
                                    <p className="text-xs text-muted-foreground">#{team.teamNumber}</p>
                                  )}
                                  <p className="text-xs text-muted-foreground truncate max-w-xs">
                                    {team.athletes.join(' · ')}
                                  </p>
                                </div>
                              </td>
                              {team.events.map((event: any) => (
                                <td key={event.eventId} className="px-3 py-2 text-center border-l border-border/50">
                                  {event.hasScore ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                      {/* Posição */}
                                      <span className={cn(
                                        "text-xs px-2 py-0.5 rounded font-bold",
                                        event.isWO
                                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                          : event.rank === 1
                                          ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                                          : event.rank === 2
                                          ? "bg-zinc-300/20 text-zinc-600 dark:text-zinc-300"
                                          : event.rank === 3
                                          ? "bg-amber-600/20 text-amber-700 dark:text-amber-400"
                                          : event.rank
                                          ? "bg-muted text-muted-foreground"
                                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                      )}>
                                        {event.isWO ? 'WO' : event.rank ? `#${event.rank}º` : 'Sem Rank'}
                                      </span>

                                      {/* Resultado detalhado */}
                                      <div className="text-xs font-mono text-muted-foreground mt-1">
                                        {event.time && <div>⏱️ {event.time}</div>}
                                        {event.weight && <div>🏋️ {event.weight}kg</div>}
                                        {event.reps && <div>🔄 {event.reps} reps</div>}
                                        {!event.time && !event.weight && !event.reps && event.isWO && <div>-</div>}
                                      </div>

                                      {/* Pontos */}
                                      <span className="text-xs font-bold text-primary mt-1">{event.points} pts</span>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground/40">-</div>
                                  )}
                                </td>
                              ))}
                              <td className="px-4 py-3 text-center">
                                <span className="text-lg font-bold text-primary">
                                  {team.totalPoints}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

          </Tabs>
        </TabsContent>

        {/* ── JUÍZES ── */}
        <TabsContent value="judges" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Plus className="h-4 w-4" /> Adicionar Juiz
            </h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar pessoa por nome ou CPF..."
                  className="pl-9"
                  value={personSearch}
                  onChange={(e) => setPersonSearch(e.target.value)}
                />
              </div>
            </div>
            
            {personSearch.length > 2 && (
              <div className="border border-border rounded-lg overflow-hidden bg-muted/20">
                {persons
                  .filter(p => (p.name?.toLowerCase().includes(personSearch.toLowerCase()) || p.cpf?.includes(personSearch)))
                  .slice(0, 5)
                  .map(p => (
                    <div key={p.idPerson} className="flex items-center justify-between p-3 border-b border-border last:border-0 hover:bg-muted/40 text-left">
                      <div>
                        <p className="text-sm font-bold">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.cpf || 'Sem CPF'}</p>
                      </div>
                      <Button size="sm" onClick={async () => {
                        try {
                          await api.post('judges', { idPerson: p.idPerson, game: code, name: p.name, cpf: p.cpf })
                          toast.success('Juiz adicionado!')
                          setPersonSearch('')
                          loadJudges()
                        } catch {
                          toast.error('Erro ao adicionar juiz')
                        }
                      }}>Vincular</Button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 px-1">
              <ShieldCheck className="h-4 w-4" /> Juízes Vinculados ({judges.length})
            </h3>
            {loadingJudges ? (
              <Skeleton className="h-20 w-full rounded-xl" />
            ) : !judges.length ? (
              <p className="text-muted-foreground text-sm py-8 text-center bg-card rounded-xl border border-border italic">Nenhum juiz cadastrado para este game.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {judges.map(j => (
                  <div key={j.idPerson} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                    <div>
                      <p className="font-bold">{j.name}</p>
                      <p className="text-xs text-muted-foreground">{j.cpf}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={async () => {
                      if (!confirm(`Remover juiz ${j.name}?`)) return
                      try {
                        await api.delete(`judges/${code}/${j.idPerson}`)
                        toast.success('Juiz removido')
                        loadJudges()
                      } catch {
                        toast.error('Erro ao remover juiz')
                      }
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── PONTUAÇÃO ── */}
        <TabsContent value="pontuacao" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <Select value={pointsCategory} onValueChange={(v) => { setPointsCategory(v); loadPoints(v) }}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c: any) => (
                      <SelectItem key={c.code} value={String(c.code)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    const defaultPts = []
                    for (let i = 1; i <= 50; i++) {
                      let p = 0
                      if (i === 1) p = 100
                      else if (i === 2) p = 95
                      else if (i === 3) p = 90
                      else if (i === 4) p = 80
                      else if (i === 5) p = 78
                      else p = 78 - ((i - 5) * 2)
                      defaultPts.push({ position: i, points: Math.max(0, p) })
                    }
                    setPoints(defaultPts)
                    toast.success('Pontuação padrão gerada!')
                  }}>Gerar Padrão</Button>
                  
                  <Button variant="outline" size="sm" onClick={() => {
                    const linearPts = []
                    // Gera 1 ponto para 1º, 2 para 2º, etc. até 50 posições
                    for (let i = 1; i <= 50; i++) {
                      linearPts.push({ position: i, points: i })
                    }
                    setPoints(linearPts)
                    toast.success('Pontuação crescente (1, 2, 3...) gerada!')
                  }}>Gerar Crescente (1, 2, 3...)</Button>
                </div>
              </div>
              <Button onClick={async () => {
                if (!pointsCategory) return
                try {
                  const dataToSend = points.map(p => ({ ...p, game: code, category: parseInt(pointsCategory) }))
                  await api.post('points', dataToSend)
                  toast.success('Pontuação salva!')
                } catch {
                  toast.error('Erro ao salvar')
                }
              }}>Salvar Tabela</Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left w-24">Posição</th>
                    <th className="px-4 py-2 text-left">Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p, idx) => (
                    <tr key={idx} className="border-b border-border last:border-0 hover:bg-muted/10">
                      <td className="px-4 py-2 font-mono">#{p.position}º</td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          value={p.points}
                          onChange={(e) => {
                            const newPts = [...points]
                            newPts[idx].points = parseInt(e.target.value) || 0
                            setPoints(newPts)
                          }}
                          className="w-24 h-8"
                        />
                      </td>
                    </tr>
                  ))}
                  {!points.length && (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center italic text-muted-foreground">Utilize o botão "Gerar Padrão" para começar ou selecione uma categoria com pontos já salvos.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ── SÚMULAS ── */}
        <TabsContent value="sumulas" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-4 print:hidden">
            {/* Seleção de Categoria */}
            <div className="space-y-1.5 max-w-xs">
              <Label>Categoria</Label>
              <Select value={sumulaCategory} onValueChange={async (v) => { 
                setSumulaCategory(v); 
                setSumulaEvent(''); 
                setSumulaTemplateUrl('');
                if (registrations.length === 0) {
                  try {
                    const res = await registrationApi.list(code)
                    setRegistrations(res.data)
                  } catch (e) {}
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione Categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c: any) => (
                    <SelectItem key={c.code} value={String(c.code)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cards de Eventos */}
            {sumulaCategory && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 px-1">
                    <ScrollText className="h-4 w-4" /> Eventos / WODs
                  </h3>
                  {sumulaEvents.filter(e => e.sumulaTemplate).length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {sumulaEvents.filter(e => e.sumulaTemplate).length} com layout
                    </Badge>
                  )}
                </div>

                {!sumulaEvents.length ? (
                  <p className="text-muted-foreground text-sm py-8 text-center bg-muted/20 rounded-xl border border-dashed border-border italic">
                    Nenhum evento vinculado a esta categoria.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sumulaEvents.map(evt => {
                      const isSelected = String(evt.idEvent) === sumulaEvent
                      const hasTemplate = !!evt.sumulaTemplate
                      return (
                        <button
                          key={evt.idEvent}
                          type="button"
                          onClick={() => {
                            setSumulaEvent(String(evt.idEvent))
                            setSumulaTemplateUrl(evt.sumulaTemplate || '')
                          }}
                          className={`relative rounded-xl border-2 p-4 text-left transition-all duration-200 hover:shadow-md ${
                            isSelected
                              ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                              : 'border-border bg-card hover:border-primary/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className={`font-bold text-sm truncate ${isSelected ? 'text-primary' : ''}`}>
                                {evt.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                                ID: {evt.idEvent}
                              </p>
                            </div>
                            {hasTemplate ? (
                              <Badge variant="default" className="shrink-0 text-[9px] h-5 bg-emerald-600 hover:bg-emerald-700">
                                <CheckCircle className="h-3 w-3 mr-0.5" /> Layout
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="shrink-0 text-[9px] h-5 text-muted-foreground">
                                Sem layout
                              </Badge>
                            )}
                          </div>
                          {isSelected && (
                            <div className="absolute -top-px -left-px -right-px h-1 bg-primary rounded-t-xl" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Editor Rich Text */}
            {sumulaCategory && sumulaEvent ? (() => {
               const firstReg = registrations.find(r => String(r.categoryId) === sumulaCategory)
               const currentEventTitle = sumulaEvents.find(e => String(e.idEvent) === sumulaEvent)?.title || ''
               
               const previewData = firstReg ? {
                  gameName: game?.name || '',
                  categoryName: categories.find((c: any) => String(c.code) === sumulaCategory)?.name || '',
                  registerNumber: firstReg.number || String(firstReg.code),
                  teamName: firstReg.team,
                  athletes: firstReg.athletes || []
               } : {
                  gameName: game?.name || 'GAME_NAME',
                  categoryName: 'CATEGORIA_EXEMPLO',
                  registerNumber: '001',
                  teamName: 'EQUIPE_EXEMPLO',
                  athletes: [{name: 'Atleta 1'}, {name: 'Atleta 2'}, {name: 'Atleta 3'}]
               }

               return (
                 <div className="mt-6 border-t pt-6">
                    {/* Botões Copiar / Colar Layout */}
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-muted-foreground">
                        Editando: <strong>{currentEventTitle}</strong>
                      </p>
                      <div className="flex items-center gap-2">
                        {sumulaTemplateUrl && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5 h-7 text-xs"
                            onClick={() => {
                              setCopiedLayout(sumulaTemplateUrl)
                              toast.success(`Layout de "${currentEventTitle}" copiado! Agora selecione outro evento e clique em "Colar".`)
                            }}
                          >
                            <Copy className="h-3 w-3" /> Copiar Layout
                          </Button>
                        )}
                        {copiedLayout && (
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="gap-1.5 h-7 text-xs bg-blue-600 hover:bg-blue-700"
                            onClick={() => {
                              setSumulaTemplateUrl(copiedLayout)
                              setPasteKey(k => k + 1)
                              toast.success('Layout colado! Clique em "Salvar" no editor para persistir.')
                            }}
                          >
                            <ClipboardPaste className="h-3 w-3" /> Colar Layout
                          </Button>
                        )}
                      </div>
                    </div>
                    <SumulaRichEditor 
                       key={`${sumulaEvent}-${pasteKey}`}
                       gameCode={code} 
                       eventId={sumulaEvent}
                       eventTitle={currentEventTitle}
                       initialContent={sumulaTemplateUrl}
                       previewData={previewData}
                       onSaved={(html) => {
                         // Atualiza estado local sem precisar de HTTP call extra
                         setSumulaTemplateUrl(html)
                         setSumulaEvents(prev => prev.map(e => 
                            String(e.idEvent) === sumulaEvent ? { ...e, sumulaTemplate: html } : e
                         ))
                       }}
                    />
                 </div>
               )
            })() : (
              <div className="py-20 text-center border-2 border-dashed border-border rounded-xl mt-6">
                 <p className="text-muted-foreground">Selecione uma categoria e um evento para editar e visualizar a súmula.</p>
              </div>
            )}
          </div>

          {/* Área visível somente na impressão */}
          <div className="print-area hidden print:block">
            {sumulaCategory && sumulaEvent && registrations
              .filter(r => String(r.categoryId) === sumulaCategory)
              .map((reg, idx, arr) => {
                const isLast = idx === arr.length - 1;
                const athletes = reg.athletes || []
                const categoryName = categories.find((c: any) => String(c.code) === sumulaCategory)?.name || ''
                const eventTitle = sumulaEvents.find(e => String(e.idEvent) === sumulaEvent)?.title || ''
                
                const data: Record<string, string> = {
                  '#GAMENAME#': game?.name || '',
                  '#CATEGORYNAME#': categoryName,
                  '#REGISTERNUMBER#': reg.number || String(reg.code),
                  '#TEAMNAME#': reg.team,
                  '#ATHLETE1_NAME#': athletes[0]?.name || '___',
                  '#ATHLETE2_NAME#': athletes[1]?.name || '___',
                  '#ATHLETE3_NAME#': athletes[2]?.name || '___',
                  '#EVENTTITLE#': eventTitle,
                  '#IDATLETA#': `${reg.number || String(reg.code)} - ${reg.team}`,
                  '#CATEGORIAATLETA#': categoryName,
                }

                let htmlContent = sumulaTemplateUrl || ''
                Object.entries(data).forEach(([key, value]) => {
                  htmlContent = htmlContent.replaceAll(key, value)
                })

                return (
                  <div key={reg.code || idx} className="contents">
                    <div className="sumula-page w-[210mm] h-[296mm] max-h-[296mm] overflow-hidden mx-auto bg-white break-inside-avoid print:m-0 print:p-0 box-border border-b border-transparent" style={{ pageBreakAfter: isLast ? 'auto' : 'always' }}>
                      <div 
                        className="prose prose-sm sumula-content max-w-none px-[15mm] py-[5mm] font-[Arial] text-black leading-snug"
                        style={{ fontFamily: 'Arial, sans-serif', fontSize: '12pt' }}
                        dangerouslySetInnerHTML={{ __html: htmlContent }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Modal de detalhes do score ── */}
      {selectedScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedScore(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="min-w-0 flex-1">
                {isEditingTeamName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editTeamNameValue}
                      onChange={(e) => setEditTeamNameValue(e.target.value)}
                      className="h-8 py-1"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-500" onClick={handleUpdateTeamName} disabled={isSavingTeamName}>
                      {isSavingTeamName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setIsEditingTeamName(false)} disabled={isSavingTeamName}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <p className="font-black text-base truncate">{selectedScore.registration?.team}</p>
                    <button 
                      onClick={() => {
                        setEditTeamNameValue(selectedScore.registration?.team || '')
                        setIsEditingTeamName(true)
                      }}
                      className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground truncate">
                  {selectedScore.registration?.athletes?.map((a: any) => a.name).join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-3">
                {!isEditingScore && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full"
                    onClick={() => {
                      setEditScoreForm({
                        time: String(selectedScore.time || ''),
                        reps: String(selectedScore.reps || ''),
                        weight: String(selectedScore.weight || ''),
                        point: selectedScore.point || 0,
                        isWO: selectedScore.isWO || false
                      })
                      setIsEditingScore(true)
                    }}
                  >
                    <Edit3 className="h-4 w-4 text-primary" />
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedScore(null)
                    setIsEditingScore(false)
                    setIsEditingTeamName(false)
                  }}
                  className="shrink-0 rounded-full p-1.5 hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-5 py-4 space-y-4">
              {loadingScoreDetail ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-40 w-full rounded-xl" />
                </div>
              ) : isEditingScore ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Mostrar campos baseados no tipo do workout */}
                    {(getWorkoutType(selectedScore.idEvent) === 'time' || selectedScore.time !== null) && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tempo</Label>
                        <Input 
                          placeholder="00:00" 
                          value={editScoreForm.time} 
                          onChange={(e) => setEditScoreForm(f => ({ ...f, time: e.target.value }))}
                        />
                      </div>
                    )}
                    {(getWorkoutType(selectedScore.idEvent) === 'time' || selectedScore.reps !== null) && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">{getWorkoutType(selectedScore.idEvent) === 'time' ? 'Reps (Tiebreak)' : 'Reps'}</Label>
                        <Input 
                          placeholder="Reps" 
                          value={editScoreForm.reps} 
                          onChange={(e) => setEditScoreForm(f => ({ ...f, reps: e.target.value }))}
                        />
                      </div>
                    )}
                    {(selectedScore.weight !== null) && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Peso (kg)</Label>
                        <Input 
                          placeholder="Kg" 
                          value={editScoreForm.weight} 
                          onChange={(e) => setEditScoreForm(f => ({ ...f, weight: e.target.value }))}
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Pontos</Label>
                      <Input 
                        type="number"
                        placeholder="Pts" 
                        value={editScoreForm.point} 
                        onChange={(e) => setEditScoreForm(f => ({ ...f, point: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="edit-iswo"
                      checked={editScoreForm.isWO}
                      onChange={(e) => setEditScoreForm(f => ({ ...f, isWO: e.target.checked }))}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="edit-iswo" className="text-xs cursor-pointer">Marcar como WO</Label>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1" onClick={handleUpdateScore} disabled={isSavingScore}>
                      {isSavingScore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Salvar Resultado
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditingScore(false)} disabled={isSavingScore}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Resultado */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <ScoreBadges score={selectedScore} />
                    {selectedScore.rank && (
                      <Badge variant="outline">#{selectedScore.rank}º Lugar</Badge>
                    )}
                    {selectedScore.Judge?.name && (
                      <span className="text-xs text-muted-foreground">
                        Judge: <strong>{selectedScore.Judge.name}</strong>
                      </span>
                    )}
                  </div>

                  {/* Código */}
                  {selectedScore.code && (
                    <p className="text-[10px] text-muted-foreground font-mono opacity-50">
                      ID: {selectedScore.code}
                    </p>
                  )}

                  {/* Foto da súmula */}
                  {selectedScore.photo ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <FileImage className="h-3.5 w-3.5" /> Súmula
                      </p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedScore.photo}
                        alt="Súmula do score"
                        className="w-full rounded-xl border border-border object-contain max-h-72"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl bg-muted/30 text-muted-foreground">
                      <FileImage className="h-8 w-8 opacity-40" />
                      <p className="text-xs">Nenhuma foto de súmula registrada.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de detalhes da inscrição ── */}
      {selectedReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 border-transparent">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedReg(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <UserCircle2 className="h-5 w-5 text-muted-foreground shrink-0" />
                {isEditingTeamName ? (
                  <div className="flex items-center gap-2 w-full">
                    <Input
                      value={editTeamNameValue}
                      onChange={(e) => setEditTeamNameValue(e.target.value)}
                      className="h-8 py-1"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-500" onClick={handleUpdateTeamName} disabled={isSavingTeamName}>
                      {isSavingTeamName ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setIsEditingTeamName(false)} disabled={isSavingTeamName}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group min-w-0">
                    <h2 className="font-black text-lg truncate">{selectedReg.team}</h2>
                    <button 
                      onClick={() => {
                        setEditTeamNameValue(selectedReg.team || '')
                        setIsEditingTeamName(true)
                      }}
                      className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedReg(null)
                  setIsEditingTeamName(false)
                }}
                className="rounded-full p-1.5 hover:bg-muted transition-colors ml-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Info */}
            <div className="px-5 py-4 space-y-4">
              {isEditingReg ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome do Time</Label>
                    <Input 
                      value={editRegForm.team} 
                      onChange={(e) => setEditRegForm(f => ({ ...f, team: e.target.value }))}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Categoria</Label>
                      <Select 
                        value={String(editRegForm.categoryId)} 
                        onValueChange={(v) => setEditRegForm(f => ({ ...f, categoryId: parseInt(v) }))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.code} value={String(cat.code)}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Status</Label>
                      <Select 
                        value={editRegForm.status} 
                        onValueChange={(v) => setEditRegForm(f => ({ ...f, status: v }))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PAID">Pago (PAID)</SelectItem>
                          <SelectItem value="PENDING">Pendente (PENDING)</SelectItem>
                          <SelectItem value="CANCELED">Cancelado</SelectItem>
                          <SelectItem value="WAITLIST">Lista de Espera</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Número da Inscrição</Label>
                    <Input 
                      value={editRegForm.number} 
                      onChange={(e) => setEditRegForm(f => ({ ...f, number: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                       <Users className="h-3 w-3" /> Atletas
                    </p>
                    {editRegForm.athletes.map((athlete: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl border border-border bg-muted/20 space-y-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase">Nome do Atleta {idx + 1}</Label>
                          <Input 
                            value={athlete.name} 
                            onChange={(e) => {
                              const newAthletes = [...editRegForm.athletes]
                              newAthletes[idx].name = e.target.value
                              setEditRegForm(f => ({ ...f, athletes: newAthletes }))
                            }}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase">CPF</Label>
                          <Input 
                            value={athlete.cpf || ''} 
                            onChange={(e) => {
                              const newAthletes = [...editRegForm.athletes]
                              newAthletes[idx].cpf = e.target.value
                              setEditRegForm(f => ({ ...f, athletes: newAthletes }))
                            }}
                            placeholder="000.000.000-00"
                            className="h-8 text-sm font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1" onClick={handleUpdateCompleteRegistration} disabled={isSavingReg}>
                      {isSavingReg ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Salvar Alterações
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditingReg(false)} disabled={isSavingReg}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="secondary">
                      {typeof selectedReg.category === 'string' ? selectedReg.category : (selectedReg.category as any)?.name || 'Sem Categoria'}
                    </Badge>
                    <Badge variant="outline">{selectedReg.status}</Badge>
                    <span className="text-sm text-muted-foreground">#{selectedReg.number}</span>
                    {(selectedReg.amount ?? 0) > 0 && (
                      <span className="text-sm text-muted-foreground ml-auto">
                        R$ {Number(selectedReg.amount).toFixed(2)}
                      </span>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="ml-auto h-8 gap-1 text-primary hover:text-primary hover:bg-primary/10"
                      onClick={() => {
                        setEditRegForm({
                          team: selectedReg.team || '',
                          categoryId: selectedReg.categoryId || (selectedReg.category as any)?.code || 0,
                          status: selectedReg.status || '',
                          number: selectedReg.number || '',
                          athletes: (selectedReg.athletes || []).map((a: any) => ({
                            code: a.code,
                            name: a.name,
                            cpf: a.cpf,
                            phonenumber: a.phonenumber
                          }))
                        })
                        setIsEditingReg(true)
                      }}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Editar Cadastro
                    </Button>
                  </div>

                  {/* Atletas */}
                  {selectedReg.athletes && selectedReg.athletes.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Atletas
                      </p>
                      <div className="space-y-2">
                        {selectedReg.athletes.map((athlete: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
                          >
                            <span className="text-sm font-medium">{athlete.name}</span>
                            {athlete.cpf && (
                              <span className="text-xs text-muted-foreground font-mono">
                                {athlete.cpf.replace(/(\d{3})\d{6}(\d{2})/, '$1.***.***-$2')}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Nenhum atleta registrado.
                    </p>
                  )}
                </>
              )}

              {/* Ações Destrutivas */}
              <div className="pt-4 mt-4 border-t border-border">
                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  onClick={async () => {
                    if (!selectedReg?.code) return
                    if (!confirm(`Deseja realmente excluir a inscrição do time "${selectedReg.team}"? Todos os atletas e scores serão deletados.`)) return
                    
                    try {
                      const response = await fetch(`/api/game/register/${String(selectedReg.code)}?game=${code}`, {
                        method: 'DELETE',
                      })
                      const res = await response.json()
                      
                      if (res.success) {
                        toast.success('Inscrição removida com sucesso!')
                        setRegistrations((prev) => prev.filter((r) => Number(r.code) !== Number(selectedReg?.code)))
                        setSelectedReg(null)
                      } else {
                        toast.error(res.error || 'Erro ao remover inscrição')
                      }
                    } catch (err: any) {
                      toast.error('Erro de conexão ao remover inscrição')
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir Inscrição Definitivamente
                </Button>
                <p className="text-[10px] text-muted-foreground text-center mt-2 leading-tight">
                  Esta ação é irreversível e apagará todos os dados aninhados (atletas e scores).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ── Modal de Nova Inscrição (Admin) ── */}
      <Dialog open={isAddRegOpen} onOpenChange={setIsAddRegOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Inscrição</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {game && (
              <RegisterTeamForm
                game={game}
                onSuccess={() => {
                  setIsAddRegOpen(false)
                  toast.success('Inscrição criada com sucesso!')
                  // Force reload registrations
                  setLoadingReg(true)
                  registrationApi
                    .list(code)
                    .then((res) => setRegistrations(res.data))
                    .catch(() => toast.error('Erro ao recarregar inscrições'))
                    .finally(() => setLoadingReg(false))
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* ── Modal de Edição de Workout ── */}
      {editingWod && (
        <Dialog open={!!editingWod} onOpenChange={(open) => !open && setEditingWod(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="px-6 py-4 border-b border-border bg-muted/20">
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-orange-500" />
                Editar Workout
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Categoria *</Label>
                  <Select 
                    value={editWodForm.category} 
                    onValueChange={(v) => setEditWodForm(f => ({ ...f, category: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.code} value={String(c.code)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo *</Label>
                  <Select 
                    value={editWodForm.type} 
                    onValueChange={(v) => setEditWodForm(f => ({ ...f, type: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="time">Tempo</SelectItem>
                      <SelectItem value="weight">Carga</SelectItem>
                      <SelectItem value="reps">Repetições</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Título *</Label>
                <Input 
                  value={editWodForm.title} 
                  onChange={(e) => setEditWodForm(f => ({ ...f, title: e.target.value }))} 
                  placeholder="Ex: WOD 01 – AMRAP 12min" 
                />
              </div>

              {editWodForm.type === 'time' && (
                <div className="space-y-1.5">
                  <Label>Time Cap</Label>
                  <Input 
                    value={editWodForm.timeCap} 
                    onChange={(e) => setEditWodForm(f => ({ ...f, timeCap: e.target.value }))} 
                    placeholder="Ex: 12:00" 
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <RichTextEditor 
                  value={editWodForm.description} 
                  onChange={(v) => setEditWodForm(f => ({ ...f, description: v }))}
                  minHeight="200px"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border bg-muted/10 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setEditingWod(null)}>Cancelar</Button>
              <Button 
                disabled={savingWod} 
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={async () => {
                  if (!editingWod) return
                  setSavingWod(true)
                  try {
                    await api.patch(`workout/${code}/${editingWod.code}`, {
                      ...editWodForm,
                      category: parseInt(editWodForm.category)
                    })
                    toast.success('Workout atualizado com sucesso!')
                    setEditingWod(null)
                    setWodKey(k => k + 1)
                  } catch {
                    toast.error('Erro ao atualizar workout')
                  } finally {
                    setSavingWod(false)
                  }
                }}
              >
                {savingWod ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}


    </div>
  )
}
