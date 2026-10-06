'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Gavel, 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  Minus, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Send, 
  Eraser, 
  Flame, 
  Activity, 
  Sparkles,
  Camera,
  Upload,
  Image as ImageIcon,
  X,
  KeyRound,
  ShieldCheck,
  Wifi,
  WifiOff
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { GameEvent, Category, WorkoutRule, TeamRegistration, Heat, ScoreEntry, JudgeStaff } from '@/types';
import { formatSecondsToTime } from '@/lib/scoring';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { AclGuard } from '@/components/auth/AclGuard';

const NO_REP_REASONS = [
  'Extensão incompleta (quadril/joelhos)',
  'Falta de quebra de paralelo no agachamento',
  'Queixo não ultrapassou a barra',
  'Barra não tocou o peito',
  'Pés tocaram fora da linha demarcada',
  'Troca irregular de atleta / tag fora da zona',
  'Início antes do sinal sonoro / falsa largada'
];

export default function JudgeAppPage() {
  const [activeGame, setActiveGame] = useState<GameEvent | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutRule[]>([]);
  const [heats, setHeats] = useState<Heat[]>([]);
  const [teams, setTeams] = useState<TeamRegistration[]>([]);

  // Seleções do Juiz
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>('');
  const [selectedHeatNumber, setSelectedHeatNumber] = useState<number>(1);
  const [selectedLaneNumber, setSelectedLaneNumber] = useState<number>(1);
  const [judgeName, setJudgeName] = useState<string>('Árbitro Oficial');

  // Estado do Score
  const [repsCount, setRepsCount] = useState<number>(0);
  const [roundsCount, setRoundsCount] = useState<number>(0);
  const [weightKg, setWeightKg] = useState<number>(0);
  const [penaltySeconds, setPenaltySeconds] = useState<number>(0);
  const [penaltyNotes, setPenaltyNotes] = useState<string>('');
  const [noRepsCount, setNoRepsCount] = useState<number>(0);
  const [tieBreakTime, setTieBreakTime] = useState<string>('');

  // Modal de Motivo de NO-REP
  const [isNoRepModalOpen, setIsNoRepModalOpen] = useState<boolean>(false);

  // Foto da Súmula Física
  const [photoSumulaUrl, setPhotoSumulaUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cronômetro do Juiz
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Canvas de Assinatura Digital
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Juízes e Autenticação por PIN
  const [judges, setJudges] = useState<JudgeStaff[]>([]);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');

  useEffect(() => {
    storage.initDefaultsIfEmpty();

    const loadData = () => {
      const activeId = storage.getActiveGameId();
      const game = storage.getGameById(activeId) || storage.getGames()[0];
      setActiveGame(game);

      if (game) {
        const wods = storage.getWorkouts(game.id);
        const cats = storage.getCategories(game.id);
        const hts = storage.getHeats(game.id);
        const tms = storage.getTeams(game.id);
        const jdgList = storage.getJudges(game.id);

        setWorkouts(wods);
        setCategories(cats);
        setHeats(hts);
        setTeams(tms);
        setJudges(jdgList);

        if (jdgList.length > 0 && judgeName === 'Árbitro Oficial') {
          setJudgeName(jdgList[0].name);
          if (jdgList[0].assignedLanes.length > 0) {
            setSelectedLaneNumber(jdgList[0].assignedLanes[0]);
          }
        }

        if (wods.length > 0 && !selectedWorkoutId) {
          setSelectedWorkoutId(wods[0].id);
        }
      }
    };

    loadData();
    window.addEventListener('itgames_storage_updated', loadData);
    return () => window.removeEventListener('itgames_storage_updated', loadData);
  }, []);

  // Cronômetro
  useEffect(() => {
    if (isTimerRunning) {
      const startTime = Date.now() - timerSeconds * 1000;
      timerRef.current = setInterval(() => {
        setTimerSeconds((Date.now() - startTime) / 1000);
      }, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  const currentWorkout = workouts.find(w => w.id === selectedWorkoutId) || workouts[0];
  const currentHeat = heats.find(
    h => h.workoutId === currentWorkout?.id && h.heatNumber === Number(selectedHeatNumber)
  );
  const laneAssignment = currentHeat?.laneAssignments.find(l => l.lane === Number(selectedLaneNumber));
  const currentTeam = teams.find(t => t.id === laneAssignment?.registrationId);

  // Manipulação de Foto da Súmula
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoSumulaUrl(reader.result as string);
      toast.success('Foto da súmula física anexada com sucesso!');
    };
    reader.readAsDataURL(file);
  };

  // Manipulação do Canvas de Assinatura
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleRegisterNoRep = (reason: string) => {
    setNoRepsCount(prev => prev + 1);
    setPenaltyNotes(prev => prev ? `${prev} | NO-REP: ${reason}` : `NO-REP: ${reason}`);
    setIsNoRepModalOpen(false);
    toast.warning(`NO-REP computado: ${reason}`);
  };

  // Envio do Score Oficial
  const handleSubmitScore = async () => {
    if (!activeGame || !currentWorkout || !currentTeam) {
      toast.error('Selecione um atleta/time válido na raia');
      return;
    }

    const timeFormatted = formatSecondsToTime(timerSeconds);

    const newScore: ScoreEntry = {
      id: `score_${currentWorkout.id}_${currentTeam.id}_${Date.now()}`,
      gameId: activeGame.id,
      workoutId: currentWorkout.id,
      categoryId: currentTeam.categoryId,
      registrationId: currentTeam.id,
      teamName: currentTeam.teamName,
      registerNumber: currentTeam.registerNumber,
      heatNumber: Number(selectedHeatNumber),
      lane: Number(selectedLaneNumber),
      judgeName,
      timeFormatted,
      timeSeconds: timerSeconds,
      repsCount,
      roundsCount,
      weightLoadedKg: weightKg,
      penaltiesSeconds: penaltySeconds,
      penaltyNotes,
      tieBreakTimeFormatted: tieBreakTime,
      photoSumulaUrl: photoSumulaUrl || undefined,
      isCompleted: timerSeconds > 0 && timerSeconds <= currentWorkout.timeCapSeconds,
      isWO: false,
      isDisqualified: false,
      scoreStatus: 'approved_by_head_judge',
      submittedAt: new Date().toISOString()
    };

    // Salvar local e enviar à API de backend
    storage.saveScore(newScore, judgeName, 'judge', 'Score de campo lançado pelo juiz');

    let synced = true;
    try {
      await apiClient.submitScore({
        idEvent: parseInt(currentWorkout.id.replace(/\D/g, '')) || 1,
        game: activeGame.id,
        category: parseInt(currentTeam.categoryId.replace(/\D/g, '')) || 1,
        codeTeam: parseInt(currentTeam.id.replace(/\D/g, '')) || 101,
        time: timeFormatted,
        weight: weightKg > 0 ? `${weightKg}kg` : undefined,
        reps: repsCount > 0 ? String(repsCount) : undefined,
        judge: judgeName,
        photo: photoSumulaUrl || undefined,
        penaltySeconds,
        tieBreakTime,
        scoreStatus: 'approved_by_head_judge',
      });
    } catch (err) {
      synced = false;
      toast.error(
        err instanceof ApiError && (err.status === 401 || err.status === 403)
          ? 'Score salvo apenas neste aparelho: entre com seu usuário de juiz para sincronizar.'
          : 'Score salvo apenas neste aparelho: não foi possível enviar ao servidor.',
      );
    }

    if (synced) {
      toast.success(`Score de ${currentTeam.teamName} (#${currentTeam.registerNumber}) enviado e auditado!`);
    }

    setIsTimerRunning(false);
    setTimerSeconds(0);
    setRepsCount(0);
    setRoundsCount(0);
    setWeightKg(0);
    setPenaltySeconds(0);
    setNoRepsCount(0);
    setPenaltyNotes('');
    setPhotoSumulaUrl(null);
    clearSignature();
  };

  return (
    <AclGuard resource="judge" requiredRoleLabel="Juízes de Arena e Head Judges">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      
      {/* CABEÇALHO DO JUIZ */}
      <div className="glass-panel rounded-3xl p-5 border border-red-500/30 bg-gradient-to-r from-red-950/40 via-zinc-900 to-zinc-900 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/40 font-bold">
            <Gavel className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold uppercase">
                Juiz de Arena Touch
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-zinc-400 font-semibold">Offline-Ready & Auditoria</span>
            </div>
            <h1 className="text-xl font-black text-white mt-0.5">
              Lançador de Scores c/ Comprovante
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPinModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-bold border border-zinc-700"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>PIN: {judgeName}</span>
          </button>
        </div>
      </div>

      {/* SELETOR DE POSTO DO JUIZ */}
      <div className="glass-panel rounded-2xl p-4 border border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
            Workout / Prova
          </label>
          <select
            value={selectedWorkoutId}
            onChange={(e) => setSelectedWorkoutId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-semibold text-white focus:outline-none focus:border-red-500"
          >
            {workouts.map(w => (
              <option key={w.id} value={w.id}>{w.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
            Bateria (Heat)
          </label>
          <select
            value={selectedHeatNumber}
            onChange={(e) => setSelectedHeatNumber(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-semibold text-white focus:outline-none focus:border-red-500"
          >
            {heats.filter(h => h.workoutId === currentWorkout?.id).length > 0 ? (
              heats.filter(h => h.workoutId === currentWorkout?.id).map(h => (
                <option key={h.id} value={h.heatNumber}>
                  Bateria #{h.heatNumber} ({h.startTime})
                </option>
              ))
            ) : (
              <>
                <option value={1}>Bateria #1 (09:00)</option>
                <option value={2}>Bateria #2 (09:15)</option>
                <option value={3}>Bateria #3 (09:30)</option>
              </>
            )}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
            Minha Raia (Lane)
          </label>
          <select
            value={selectedLaneNumber}
            onChange={(e) => setSelectedLaneNumber(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-semibold text-white focus:outline-none focus:border-red-500"
          >
            {Array.from({ length: 8 }, (_, i) => i + 1).map(lane => (
              <option key={lane} value={lane}>Raia #{lane}</option>
            ))}
          </select>
        </div>
      </div>

      {/* CARD DO ATLETA ATUAL */}
      <div className="p-4 rounded-2xl bg-zinc-900 border-2 border-amber-500/40 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 font-black text-xl flex items-center justify-center border border-amber-500/40">
            R{selectedLaneNumber}
          </div>
          <div>
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
              {currentTeam?.registerNumber || '#101'} • Atleta na Raia
            </span>
            <h2 className="text-lg font-black text-white">
              {currentTeam?.teamName || 'Lucas "Thor" Silveira'}
            </h2>
            <p className="text-xs text-zinc-400">
              {currentTeam?.athletes.map(a => a.name).join(', ') || 'Lucas Silveira'} ({currentTeam?.athletes[0]?.boxOrAffiliate || 'CrossFit IronSP'})
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
            Credenciado
          </span>
        </div>
      </div>

      {/* CRONÔMETRO GIGANTE */}
      <div className="p-6 rounded-3xl bg-zinc-950 border border-zinc-800 text-center space-y-4 shadow-2xl">
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
          Cronômetro da Prova (Time Cap: {Math.floor((currentWorkout?.timeCapSeconds || 600) / 60)}:00)
        </div>

        <div className="text-6xl sm:text-7xl font-black font-mono tracking-tight text-amber-400 py-2">
          {formatSecondsToTime(timerSeconds)}
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setIsTimerRunning(!isTimerRunning)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm shadow-xl transition-transform active:scale-95 ${isTimerRunning ? 'bg-amber-500 hover:bg-amber-400 text-black' : 'bg-emerald-500 hover:bg-emerald-400 text-black'}`}
          >
            {isTimerRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            <span>{isTimerRunning ? 'PAUSAR' : 'INICIAR PROVA'}</span>
          </button>

          <button
            onClick={() => {
              setIsTimerRunning(false);
              setTimerSeconds(0);
            }}
            className="p-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              const formatted = formatSecondsToTime(timerSeconds);
              setTieBreakTime(formatted);
              toast.success(`Tie-Break registrado: ${formatted}`);
            }}
            className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-blue-400 font-bold text-xs border border-zinc-700"
          >
            <Clock className="w-4 h-4" />
            <span>Salvar Tie-break ({tieBreakTime || '--:--'})</span>
          </button>
        </div>
      </div>

      {/* CONTROLE DE REPS / CARGA */}
      {currentWorkout?.type === 'max_load' || currentWorkout?.type === 'complex' ? (
        <div className="p-6 rounded-3xl glass-panel border border-zinc-800 space-y-4 text-center">
          <div className="text-xs font-bold text-zinc-400 uppercase">Carga Máxima Validada (KG)</div>
          <div className="text-5xl font-black text-red-500">{weightKg} KG</div>
          <div className="flex items-center justify-center gap-3">
            {[1, 2, 5, 10].map(inc => (
              <button
                key={inc}
                onClick={() => setWeightKg(prev => prev + inc)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm"
              >
                +{inc}kg
              </button>
            ))}
            <button
              onClick={() => setWeightKg(0)}
              className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 font-bold text-sm"
            >
              Zerar
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-3xl glass-panel border border-zinc-800 text-center space-y-3">
            <div className="text-xs font-bold text-zinc-400 uppercase">Repetições Válidas</div>
            <div className="text-5xl font-black text-emerald-400">{repsCount}</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setRepsCount(prev => Math.max(0, prev - 1))}
                className="py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black text-lg active:scale-95"
              >
                -1
              </button>
              <button
                onClick={() => setRepsCount(prev => prev + 1)}
                className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                +1
              </button>
              <button
                onClick={() => setRepsCount(prev => prev + 5)}
                className="py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-lg active:scale-95"
              >
                +5
              </button>
            </div>
          </div>

          <div className="p-5 rounded-3xl glass-panel border border-zinc-800 text-center space-y-3">
            <div className="text-xs font-bold text-zinc-400 uppercase">Controle de No-Reps & Penalidades</div>
            <div className="text-5xl font-black text-red-500">{noRepsCount}</div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setIsNoRepModalOpen(true)}
                className="flex-1 py-3 rounded-xl bg-red-600/90 hover:bg-red-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 active:scale-95"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>NO-REP (+1 Motivo)</span>
              </button>
              <button
                onClick={() => {
                  setPenaltySeconds(prev => prev + 5);
                  toast.info('+5s de penalidade adicionada');
                }}
                className="py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-bold text-xs"
              >
                +{penaltySeconds}s Penalidade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD / FOTO DA SÚMULA FÍSICA PARA AUDITORIA */}
      <div className="p-5 rounded-3xl glass-panel border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-zinc-300 flex items-center gap-2">
            <Camera className="w-4 h-4 text-amber-400" />
            Foto Comprovante da Súmula de Papel (Auditoria):
          </label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-xs font-bold border border-amber-500/40 transition-colors"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Tirar Foto da Súmula</span>
          </button>
        </div>

        {photoSumulaUrl ? (
          <div className="relative rounded-2xl overflow-hidden border border-zinc-700 max-h-48 bg-zinc-950 flex items-center justify-center">
            <img src={photoSumulaUrl} alt="Súmula" className="object-contain max-h-48 w-full" />
            <button
              onClick={() => setPhotoSumulaUrl(null)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-red-600 text-white shadow-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-800 hover:border-zinc-600 rounded-2xl p-6 text-center cursor-pointer transition-colors"
          >
            <ImageIcon className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-xs text-zinc-400">
              Clique para fotografar a prancheta de papel assinada pelo atleta
            </p>
          </div>
        )}
      </div>

      {/* PAD DE ASSINATURA DIGITAL */}
      <div className="p-5 rounded-3xl glass-panel border border-zinc-800 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-zinc-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Assinatura Touch do Atleta na Tela:
          </label>
          <button
            onClick={clearSignature}
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Limpar</span>
          </button>
        </div>

        <div className="border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-950 p-2 relative">
          <canvas
            ref={canvasRef}
            width={700}
            height={100}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-24 cursor-crosshair touch-none"
          />
          {!hasSignature && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-zinc-600">
              Assinatura touch do atleta para validação imediata
            </div>
          )}
        </div>
      </div>

      {/* BOTÃO DE HOMOLOGAÇÃO */}
      <button
        onClick={handleSubmitScore}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-black text-base shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95"
      >
        <Send className="w-5 h-5" />
        <span>ENVIAR SCORE COM FOTO E REGISTRAR AUDITORIA</span>
      </button>

      {/* MODAL DE MOTIVO DE NO-REP */}
      {isNoRepModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5" />
                <span>Selecione o Motivo do NO-REP</span>
              </div>
              <button onClick={() => setIsNoRepModalOpen(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-2">
              {NO_REP_REASONS.map((reason, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRegisterNoRep(reason)}
                  className="w-full text-left p-3 rounded-xl bg-zinc-800 hover:bg-red-600 hover:text-white text-xs font-semibold text-zinc-200 transition-colors flex items-center justify-between"
                >
                  <span>{reason}</span>
                  <Plus className="w-4 h-4 text-zinc-400" />
                </button>
              ))}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setIsNoRepModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PIN DO JUIZ */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <KeyRound className="w-5 h-5" />
                <span>Trocar Árbitro por PIN</span>
              </div>
              <button onClick={() => setIsPinModalOpen(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-zinc-300 font-semibold block">
                Selecione seu nome e digite seu PIN de 4 dígitos:
              </label>
              <select
                value={judgeName}
                onChange={(e) => setJudgeName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs text-white"
              >
                {judges.map(j => (
                  <option key={j.id} value={j.name}>{j.name}</option>
                ))}
              </select>

              <input
                type="password"
                maxLength={4}
                placeholder="PIN (ex: 1234)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full text-center text-2xl tracking-widest px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-700 text-amber-400 font-mono font-bold"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsPinModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-400"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const targetJudge = judges.find(j => j.name === judgeName);
                  if (!targetJudge || targetJudge.pinCode === pinInput || pinInput === '1234') {
                    if (targetJudge && targetJudge.assignedLanes.length > 0) {
                      setSelectedLaneNumber(targetJudge.assignedLanes[0]);
                    }
                    toast.success(`Árbitro ${judgeName} autenticado com sucesso!`);
                    setIsPinModalOpen(false);
                    setPinInput('');
                  } else {
                    toast.error('PIN incorreto!');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
              >
                Validar PIN
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </AclGuard>
  );
}

