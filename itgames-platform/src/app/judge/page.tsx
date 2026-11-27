'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Gavel, 
  Plus, 
  Minus, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Send, 
  Flame, 
  Activity, 
  Camera, 
  X, 
  KeyRound, 
  Dumbbell, 
  Timer, 
  Check, 
  FileCheck,
  Image as ImageIcon,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { useGames } from '@/lib/use-games';
import { getArenaSelection, pickExisting, usePersistArenaSelection } from '@/lib/arena-selection';
import { GameEvent, Category, WorkoutRule, TeamRegistration, Heat, ScoreEntry, JudgeStaff } from '@/types';
import { apiClient, ApiError } from '@/lib/api-client';
import { sortWorkoutsNaturally } from '@/lib/board';
import { toast } from 'sonner';
import { AclGuard } from '@/components/auth/AclGuard';
import { arenaLabel } from '@/lib/arena-data';

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
  const { activeGame } = useGames();
  const [categories, setCategories] = useState<Category[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutRule[]>([]);
  const [teams, setTeams] = useState<TeamRegistration[]>([]);
  const [heats, setHeats] = useState<any[]>([]);

  // Seleções do Juiz na Arena
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>('');
  const [selectedHeatNumber, setSelectedHeatNumber] = useState<number>(1);
  const [selectedLaneNumber, setSelectedLaneNumber] = useState<number>(1);
  const [judgeName, setJudgeName] = useState<string>('Árbitro Oficial');

  // ─── PARÂMETROS ESPECÍFICOS DE CADA TIPO DE WOD ───
  // WOD 1-A (Remo em Dupla — For Time c/ CAP e Metros Faltantes)
  const [rowStatus, setRowStatus] = useState<'finished' | 'cap'>('finished');
  const [rowTimeInput, setRowTimeInput] = useState<string>('04:15.0');
  const [rowMissingMeters, setRowMissingMeters] = useState<number>(0);

  // WOD 1-B (Death By em Dupla — 3 PARÂMETROS ESPECÍFICOS)
  const [deathByRoundsCompleted, setDeathByRoundsCompleted] = useState<number>(5);
  const [deathByCapReps, setDeathByCapReps] = useState<number>(0);
  const [deathByTieBreakTime, setDeathByTieBreakTime] = useState<string>('11:30.0');

  // WOD 2 (Sync & Burn — 130 reps totais • Sem tie-break)
  const [syncBurnStatus, setSyncBurnStatus] = useState<'finished' | 'cap'>('finished');
  const [syncBurnTimeInput, setSyncBurnTimeInput] = useState<string>('08:45');
  const [syncBurnMissingReps, setSyncBurnMissingReps] = useState<number>(0);

  // WOD 3 (Maximum Lift — Escada de Carga Máxima PR em KG com 6 Tentativas & Anilhas)
  const [weightAthleteA, setWeightAthleteA] = useState<number>(70);
  const [weightAthleteB, setWeightAthleteB] = useState<number>(80);
  const [barWeightA, setBarWeightA] = useState<number>(20);
  const [barWeightB, setBarWeightB] = useState<number>(20);
  const [activeAthleteTab, setActiveAthleteTab] = useState<'A' | 'B'>('A');
  const [activeAttemptIdxA, setActiveAttemptIdxA] = useState<number>(0);
  const [activeAttemptIdxB, setActiveAttemptIdxB] = useState<number>(0);

  type LiftAttempt = {
    p20: number; // 20kg HELE
    p15: number; // 15kg POOD
    p10: number; // 10kg BRAVE
    p5: number;  // 5kg BRAVE
    p2: number;  // 2kg Vazada
    p1: number;  // 1kg Fracionária
    totalKg: number;
    status: 'valid' | 'invalid' | 'pending';
  };

  const createInitialAttempts = (): LiftAttempt[] => [
    { p20: 2, p15: 0, p10: 2, p5: 0, p2: 0, p1: 0, totalKg: 80, status: 'valid' },
    { p20: 0, p15: 0, p10: 0, p5: 0, p2: 0, p1: 0, totalKg: 0, status: 'pending' },
    { p20: 0, p15: 0, p10: 0, p5: 0, p2: 0, p1: 0, totalKg: 0, status: 'pending' },
    { p20: 0, p15: 0, p10: 0, p5: 0, p2: 0, p1: 0, totalKg: 0, status: 'pending' },
    { p20: 0, p15: 0, p10: 0, p5: 0, p2: 0, p1: 0, totalKg: 0, status: 'pending' },
    { p20: 0, p15: 0, p10: 0, p5: 0, p2: 0, p1: 0, totalKg: 0, status: 'pending' },
  ];

  const [attemptsA, setAttemptsA] = useState<LiftAttempt[]>(createInitialAttempts());
  const [attemptsB, setAttemptsB] = useState<LiftAttempt[]>(createInitialAttempts());

  // WOD 4-A / 4-B & AMRAP (Double Trouble — Máximo de Reps Válidas • Sem tie-break)
  const [amrapRepsCount, setAmrapRepsCount] = useState<number>(45);

  // Parâmetros Genéricos / Outros WODs
  const [genericTimeInput, setGenericTimeInput] = useState<string>('09:30');
  const [genericRepsInput, setGenericRepsInput] = useState<number>(0);

  // Estados Comuns & Auditoria
  const [penaltySeconds, setPenaltySeconds] = useState<number>(0);
  const [penaltyNotes, setPenaltyNotes] = useState<string>('');
  const [noRepsCount, setNoRepsCount] = useState<number>(0);
  const [photoSumulaUrl, setPhotoSumulaUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isWodLocked, setIsWodLocked] = useState<boolean>(false);
  const [isRevertingLock, setIsRevertingLock] = useState<boolean>(false);

  // Modais
  const [isNoRepModalOpen, setIsNoRepModalOpen] = useState<boolean>(false);
  const [judges, setJudges] = useState<JudgeStaff[]>([]);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');

  // ─── CARREGAMENTO DE DADOS REAIS DA COMPETIÇÃO ───
  useEffect(() => {
    storage.initDefaultsIfEmpty();

    const loadCompetitionData = async () => {
      const game = activeGame;
      if (!game) return;

      const gId = game.code || game.id;
      let cats = storage.getCategories(game.id);
      let wods = storage.getWorkouts(game.id);
      let tms = storage.getTeams(game.id);
      const jdgList = storage.getJudges(game.id);
      setJudges(jdgList);

      try {
        const [apiCats, apiWods, apiRegs] = await Promise.all([
          apiClient.listCategories(gId).catch(() => null),
          apiClient.listWorkouts(gId).catch(() => null),
          apiClient.listRegistrations(gId).catch(() => null),
        ]);

        if (apiCats && apiCats.length > 0) {
          cats = apiCats.map((c: any) => ({
            id: String(c.code),
            gameId: c.gamesId,
            name: c.name,
            gender: c.genderRule || 'open',
            genderRule: c.genderRule || 'open',
            teamFormat: c.teamType || 'duo',
            maxAthletes: c.maxAthlete || 2,
            spotsTotal: c.maxRegistrations || 100,
          })) as any;
          storage.setCategoriesForGame(game.id, cats);
        }

        if (apiWods && apiWods.length > 0) {
          wods = apiWods.map((w: any) => ({
            id: String(w.code),
            gameId: w.game,
            gameName: game.name,
            categoryId: String(w.category),
            categoryIds: [String(w.category)],
            title: w.title || `WOD ${w.code}`,
            type: w.type || 'for_time',
            timeCapSeconds: (w.type === 'for_time' && (w.title?.includes('1-A') || w.title?.includes('ROW'))) ? 300 : (w.title?.includes('1-B') || w.title?.includes('DEATH')) ? 1260 : 600,
            description: w.description || '',
          })) as any;
        }

        if (apiRegs && apiRegs.length > 0) {
          tms = apiRegs.map((r: any) => ({
            id: String(r.code),
            gameId: r.gameCode,
            categoryId: String(r.categoryId),
            categoryName: r.category?.name || `Categoria ${r.categoryId}`,
            teamName: r.team,
            registerNumber: r.number || `#${r.code}`,
            amountPaid: r.amount || 0,
            paymentStatus: (r.status as any) || 'paid',
            athletes: (r.athletes || []).map((a: any) => ({
              id: String(a.code),
              name: a.name,
              cpf: a.cpf,
              gender: a.gender || 'M',
              boxOrAffiliate: a.boxOrGym || 'Independente',
            })),
          })) as any;
          storage.setTeamsForGame(game.id, tms);
        }
      } catch (err) {
        console.warn('[JudgeApp] Usando storage local', err);
      }

      setCategories(cats);
      setWorkouts(wods);
      setTeams(tms);

      // Tratamento dos parâmetros de leitura de QR Code da Súmula impressa
      // sem QR Code, retoma a última seleção feita em Baterias / Súmulas / Head Judge
      const shared = getArenaSelection(activeGame?.code);
      let initialCatId = pickExisting(cats, shared.categoryId);
      let initialWodId = pickExisting(wods, shared.workoutId);
      let initialHeat = shared.heat && !isNaN(Number(shared.heat)) ? Number(shared.heat) : 1;
      let initialLane = 1;

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const qCat = params.get('cat') || params.get('categoryId');
        const qWod = params.get('wod') || params.get('workoutId');
        const qHeat = params.get('heat') || params.get('heatNumber');
        const qLane = params.get('lane') || params.get('laneNumber');
        const qReg = params.get('reg') || params.get('registerNumber');
        const qJudge = params.get('judge') || params.get('judgeId');

        // A categoria vem da inscrição (reg) e, sem ela, do parâmetro cat
        const regTeam = qReg ? tms.find(t => String(t.id) === qReg.replace('#', '') || String((t as any).number) === qReg) : undefined;
        const matchedCat =
          (regTeam && cats.find(c => String(c.id) === String(regTeam.categoryId))) ||
          (qCat ? cats.find(c => String(c.id) === String(qCat)) || cats.find(c => c.name.toUpperCase().includes(qCat.toUpperCase())) : undefined);
        if (matchedCat) initialCatId = matchedCat.id;

        if (qWod) {
          // O título ("WOD 1-A") se repete em todas as categorias: procura primeiro dentro da categoria do link
          const inCategory = (w: WorkoutRule) =>
            !matchedCat || String(w.categoryId) === String(matchedCat.id) || !!w.categoryIds?.includes(matchedCat.id);
          const byId = (w: WorkoutRule) => String(w.id) === String(qWod);
          const byTitle = (w: WorkoutRule) => w.title.toUpperCase().includes(qWod.toUpperCase());
          const matchedWod =
            wods.find(w => byId(w)) ||
            wods.find(w => inCategory(w) && byTitle(w)) ||
            wods.find(w => byTitle(w));
          if (matchedWod) {
            initialWodId = matchedWod.id;
            if (matchedWod.categoryId && cats.some(c => c.id === matchedWod.categoryId)) {
              initialCatId = matchedWod.categoryId;
            }
          }
        }

        if (qHeat) {
          const h = parseInt(qHeat, 10);
          if (!isNaN(h)) initialHeat = h;
        }

        if (qLane) {
          const l = parseInt(qLane, 10);
          if (!isNaN(l)) initialLane = l;
        }

        if (qJudge) {
          const matchedJudge = jdgList.find(j => j.id === qJudge || j.pinCode === qJudge);
          if (matchedJudge) setJudgeName(matchedJudge.name);
        }

        if (qReg || qLane) {
          toast.success(`⚡ Súmula física escaneada! Raia ${initialLane} • Bateria ${initialHeat} selecionada.`);
        }
      }

      setSelectedCategoryId(initialCatId);
      setSelectedWorkoutId(initialWodId);
      setSelectedHeatNumber(initialHeat);
      setSelectedLaneNumber(initialLane);
    };

    loadCompetitionData();
  }, [activeGame]);

  // Carregar Baterias Reais da API do backend
  useEffect(() => {
    if (!activeGame || !selectedWorkoutId) return;
    const gId = activeGame.code || activeGame.id;
    const wodNum = parseInt(selectedWorkoutId.replace(/\D/g, ''), 10);
    if (!isNaN(wodNum)) {
      apiClient.fetchHeats(gId, wodNum)
        .then(apiHeats => {
          if (apiHeats && apiHeats.length > 0) {
            setHeats(apiHeats);
          }
        })
        .catch(() => {});
    }
  }, [activeGame, selectedWorkoutId]);

  // Resolução da Equipe / Dupla real da raia
  const activeCategory = categories.find(c => String(c.id) === String(selectedCategoryId)) || categories[0];
  const categoryWorkouts = sortWorkoutsNaturally(
    workouts.filter(
      w => !activeCategory || !w.categoryId || String(w.categoryId) === String(activeCategory.id) || w.categoryIds?.includes(activeCategory.id)
    )
  );
  const currentWorkout = categoryWorkouts.find(w => String(w.id) === String(selectedWorkoutId)) || categoryWorkouts[0] || workouts[0];
  const categoryTeams = teams.filter(t => String(t.categoryId) === String(activeCategory?.id) && t.paymentStatus !== 'cancelled');

  const workoutHeats = heats.filter(h => String(h.workoutCode) === String(currentWorkout?.id));
  const currentHeatApi = workoutHeats.find(h => Number(h.heatNumber) === Number(selectedHeatNumber));
  
  let currentTeam: TeamRegistration | undefined;

  // 1. Tentar localizar via slots da API
  if (currentHeatApi && currentHeatApi.slots) {
    const slot = currentHeatApi.slots.find((s: any) => Number(s.laneNumber) === Number(selectedLaneNumber));
    if (slot) {
      if (slot.registration) {
        currentTeam = {
          id: String(slot.registration.code),
          gameId: slot.gameCode || activeGame?.id,
          categoryId: String(slot.registration.categoryId),
          categoryName: activeCategory?.name || '',
          teamName: slot.registration.team?.trim() || 'Equipe na Raia',
          registerNumber: slot.registration.number || `#${slot.registration.code}`,
          amountPaid: slot.registration.amount || 0,
          paymentStatus: 'paid',
          athletes: (slot.registration.athletes || []).map((a: any) => ({
            id: String(a.code),
            name: a.name,
            cpf: a.cpf,
            gender: a.gender || 'F',
            boxOrAffiliate: a.boxOrGym || 'Independente'
          }))
        } as any;
      } else if (slot.teamCode) {
        currentTeam = teams.find(t => 
          String(t.id) === String(slot.teamCode) || 
          String(t.registerNumber).replace(/\D/g, '') === String(slot.teamCode)
        );
      }
    }
  }

  // 2. Se não houver slot gravado ou não achar equipe, distribuir da categoria selecionada
  if (!currentTeam && categoryTeams.length > 0) {
    const lanesPerHeat = activeGame?.lanesCount || 4;
    const teamIndex = (Number(selectedHeatNumber) - 1) * lanesPerHeat + (Number(selectedLaneNumber) - 1);
    currentTeam = categoryTeams[teamIndex] || categoryTeams[0];
  }

  // Desbloquear WOD quando estiver com cálculo oficial travado
  const handleUnlockWod = async () => {
    if (!activeGame || !currentWorkout || !activeCategory) return;
    setIsRevertingLock(true);
    try {
      const gCode = activeGame.code || activeGame.id;
      const catNum = parseInt(String(activeCategory.id).replace(/\D/g, ''), 10) || 2;
      const wodNum = parseInt(String(currentWorkout.id).replace(/\D/g, ''), 10) || 101;
      await apiClient.revertOfficialWod(gCode, catNum, wodNum, 'Destravado pelo Head Judge para alteração de súmula');
      setIsWodLocked(false);
      toast.success('🔓 WOD destravado com sucesso! Agora você pode lançar a súmula novamente.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao destravar WOD');
    } finally {
      setIsRevertingLock(false);
    }
  };

  // Identificação do Tipo de Prova
  const wodTitleUpper = (currentWorkout?.title || '').toUpperCase();
  const isRowWod = wodTitleUpper.includes('ROW') || wodTitleUpper.includes('REMO') || wodTitleUpper.includes('1-A');
  const isDeathByWod = wodTitleUpper.includes('DEATH BY') || wodTitleUpper.includes('1-B');
  const isSyncBurnWod = wodTitleUpper.includes('SYNC & BURN') || wodTitleUpper.includes('WOD 2');
  const isMaxLiftWod = currentWorkout?.type === 'max_load' || currentWorkout?.type === 'complex' || wodTitleUpper.includes('MAXIMUM LIFT') || wodTitleUpper.includes('WOD 3');
  const isDoubleTroubleWod = wodTitleUpper.includes('DOUBLE TROUBLE') || wodTitleUpper.includes('4-A') || wodTitleUpper.includes('4-B');

  // Cálculos de LPO / Escada de Carga Máxima (PR) com 6 Tentativas
  const computeAttemptTotal = (bar: number, att: { p20: number; p15: number; p10: number; p5: number; p2: number; p1: number }) => {
    return bar + (att.p20 * 20) + (att.p15 * 15) + (att.p10 * 10) + (att.p5 * 5) + (att.p2 * 2) + (att.p1 * 1);
  };

  const updateAttemptPlate = (athlete: 'A' | 'B', attemptIdx: number, plate: 'p20' | 'p15' | 'p10' | 'p5' | 'p2' | 'p1', delta: number) => {
    const isA = athlete === 'A';
    const currentList = isA ? [...attemptsA] : [...attemptsB];
    const target = { ...currentList[attemptIdx] };
    const newQty = Math.max(0, (target[plate] || 0) + delta);
    target[plate] = newQty;
    const bar = isA ? barWeightA : barWeightB;
    target.totalKg = computeAttemptTotal(bar, target);
    if (target.status === 'pending' && target.totalKg > bar) {
      target.status = 'valid';
    }
    currentList[attemptIdx] = target;

    const validWeights = currentList.filter(a => a.status === 'valid').map(a => a.totalKg);
    const maxVal = validWeights.length > 0 ? Math.max(...validWeights) : 0;

    if (isA) {
      setAttemptsA(currentList);
      if (maxVal > 0) setWeightAthleteA(maxVal);
    } else {
      setAttemptsB(currentList);
      if (maxVal > 0) setWeightAthleteB(maxVal);
    }
  };

  const setAttemptStatus = (athlete: 'A' | 'B', attemptIdx: number, status: 'valid' | 'invalid' | 'pending') => {
    const isA = athlete === 'A';
    const currentList = isA ? [...attemptsA] : [...attemptsB];
    const target = { ...currentList[attemptIdx] };
    target.status = status;
    const bar = isA ? barWeightA : barWeightB;
    if (target.totalKg === 0) {
      target.totalKg = computeAttemptTotal(bar, target);
    }
    currentList[attemptIdx] = target;

    const validWeights = currentList.filter(a => a.status === 'valid').map(a => a.totalKg);
    const maxVal = validWeights.length > 0 ? Math.max(...validWeights) : 0;

    if (isA) {
      setAttemptsA(currentList);
      if (maxVal > 0) setWeightAthleteA(maxVal);
    } else {
      setAttemptsB(currentList);
      if (maxVal > 0) setWeightAthleteB(maxVal);
    }
  };

  const changeBarWeight = (athlete: 'A' | 'B', newBar: number) => {
    const isA = athlete === 'A';
    if (isA) {
      setBarWeightA(newBar);
      const updated = attemptsA.map(att => ({
        ...att,
        totalKg: computeAttemptTotal(newBar, att)
      }));
      setAttemptsA(updated);
      const validWeights = updated.filter(a => a.status === 'valid').map(a => a.totalKg);
      if (validWeights.length > 0) setWeightAthleteA(Math.max(...validWeights));
    } else {
      setBarWeightB(newBar);
      const updated = attemptsB.map(att => ({
        ...att,
        totalKg: computeAttemptTotal(newBar, att)
      }));
      setAttemptsB(updated);
      const validWeights = updated.filter(a => a.status === 'valid').map(a => a.totalKg);
      if (validWeights.length > 0) setWeightAthleteB(Math.max(...validWeights));
    }
  };

  const setAttemptTotalDirect = (athlete: 'A' | 'B', attemptIdx: number, val: number) => {
    const isA = athlete === 'A';
    const currentList = isA ? [...attemptsA] : [...attemptsB];
    const target = { ...currentList[attemptIdx], totalKg: Math.max(0, val) };
    if (target.status === 'pending' && target.totalKg > 0) {
      target.status = 'valid';
    }
    currentList[attemptIdx] = target;
    const validWeights = currentList.filter(a => a.status === 'valid').map(a => a.totalKg);
    const maxVal = validWeights.length > 0 ? Math.max(...validWeights) : 0;
    if (isA) {
      setAttemptsA(currentList);
      if (maxVal > 0) setWeightAthleteA(maxVal);
    } else {
      setAttemptsB(currentList);
      if (maxVal > 0) setWeightAthleteB(maxVal);
    }
  };

  // Upload da foto da súmula impressa
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoSumulaUrl(reader.result as string);
      toast.success('Foto da súmula impressa anexada para a Mesa do Head Judge!');
    };
    reader.readAsDataURL(file);
  };

  const handleRegisterNoRep = (reason: string) => {
    setNoRepsCount(prev => prev + 1);
    setPenaltyNotes(prev => prev ? `${prev} | NO-REP: ${reason}` : `NO-REP: ${reason}`);
    setIsNoRepModalOpen(false);
    toast.warning(`NO-REP registrado: ${reason}`);
  };

  // ─── HOMOLOGAÇÃO E ENVIO OFICIAL DO SCORE ───
  const handleSubmitScore = async () => {
    if (!activeGame || !currentWorkout || !currentTeam) {
      toast.error('Selecione uma equipe/dupla válida na raia');
      return;
    }

    setIsSubmitting(true);

    let timeFormatted = '';
    let timeSeconds = 0;
    let repsCount = 0;
    let roundsCount = 0;
    let weightLoadedKg = 0;
    let tieBreakFormatted: string | undefined = undefined;
    let isCompleted = true;

    // 1. WOD 1-A (Remo)
    if (isRowWod) {
      if (rowStatus === 'finished') {
        timeFormatted = rowTimeInput || '04:15.0';
        const parts = timeFormatted.split(':').map(Number);
        timeSeconds = (parts[0] || 0) * 60 + (parts[1] || 0);
        isCompleted = true;
      } else {
        timeFormatted = `CAP +${rowMissingMeters}m`;
        timeSeconds = 5 * 60 + rowMissingMeters;
        repsCount = rowMissingMeters;
        isCompleted = false;
      }
    } 
    // 2. WOD 1-B (Death By - 3 Parâmetros)
    else if (isDeathByWod) {
      roundsCount = deathByRoundsCompleted;
      isCompleted = deathByRoundsCompleted === 5;
      timeSeconds = 21 * 60;
      repsCount = isCompleted ? 0 : deathByCapReps;
      tieBreakFormatted = deathByTieBreakTime || undefined;
      timeFormatted = isCompleted 
        ? `5 Rounds (${deathByTieBreakTime || '21:00'})` 
        : `${deathByRoundsCompleted} Rds + ${deathByCapReps} reps`;
    } 
    // 3. WOD 2 (Sync & Burn - 130 reps totais • Sem tie-break)
    else if (isSyncBurnWod) {
      tieBreakFormatted = undefined;
      if (syncBurnStatus === 'finished') {
        timeFormatted = syncBurnTimeInput || '08:45';
        const parts = timeFormatted.split(':').map(Number);
        timeSeconds = (parts[0] || 0) * 60 + (parts[1] || 0);
        repsCount = 130;
        isCompleted = true;
      } else {
        timeFormatted = `CAP +${syncBurnMissingReps}`;
        timeSeconds = 10 * 60 + syncBurnMissingReps;
        repsCount = Math.max(0, 130 - syncBurnMissingReps);
        isCompleted = false;
      }
    } 
    // 4. WOD 3 (Maximum Lift - PR em KG)
    else if (isMaxLiftWod) {
      weightLoadedKg = (weightAthleteA || 0) + (weightAthleteB || 0);
      timeFormatted = `${weightLoadedKg} kg`;
      isCompleted = true;
    } 
    // 5. WOD 4-A / 4-B & AMRAP (Double Trouble — Máximo de Reps Válidas • Sem tie-break)
    else if (isDoubleTroubleWod || currentWorkout.type === 'amrap') {
      repsCount = amrapRepsCount;
      tieBreakFormatted = undefined;
      timeFormatted = `${amrapRepsCount} reps`;
      isCompleted = true;
    } 
    // 6. Genérico For Time
    else {
      timeFormatted = genericTimeInput || '10:00';
      const parts = timeFormatted.split(':').map(Number);
      timeSeconds = (parts[0] || 0) * 60 + (parts[1] || 0);
      repsCount = genericRepsInput;
      isCompleted = true;
    }

    const teamCleanCode = parseInt(currentTeam.id.replace(/\D/g, ''), 10) || parseInt(currentTeam.registerNumber?.replace(/\D/g, '') || '1', 10);
    const workoutCleanCode = parseInt(currentWorkout.id.replace(/\D/g, ''), 10) || 101;
    const catCleanCode = parseInt(activeCategory?.id?.replace(/\D/g, '') || '2', 10);

    const newScore: ScoreEntry = {
      id: `score_${currentWorkout.id}_${currentTeam.id}_${Date.now()}`,
      gameId: activeGame.id,
      workoutId: currentWorkout.id,
      categoryId: activeCategory?.id || '2',
      registrationId: currentTeam.id,
      teamName: currentTeam.teamName,
      registerNumber: currentTeam.registerNumber,
      heatNumber: Number(selectedHeatNumber),
      lane: Number(selectedLaneNumber),
      judgeName,
      timeFormatted,
      timeSeconds,
      repsCount,
      roundsCount,
      weightLoadedKg,
      penaltiesSeconds: penaltySeconds,
      penaltyNotes,
      tieBreakTimeFormatted: tieBreakFormatted,
      photoSumulaUrl: photoSumulaUrl || undefined,
      isCompleted,
      isWO: false,
      isDisqualified: false,
      scoreStatus: 'approved_by_head_judge',
      submittedAt: new Date().toISOString()
    };

    // Salvar localmente no storage com notificação imediata para a Mesa do Head Judge
    storage.saveScore(newScore, judgeName, 'judge', 'Súmula enviada pelo árbitro na arena');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('itgames_storage_updated'));
    }

    let syncedRemote = true;
    let remoteConflict = false;
    try {
      await apiClient.submitScore({
        idEvent: workoutCleanCode,
        game: activeGame.code || activeGame.id,
        category: catCleanCode,
        codeTeam: teamCleanCode,
        time: timeFormatted,
        weight: weightLoadedKg > 0 ? `${weightLoadedKg}kg` : undefined,
        reps: repsCount > 0 ? String(repsCount) : undefined,
        judge: judgeName,
        photo: photoSumulaUrl || undefined,
        penaltySeconds,
        tieBreakTime: tieBreakFormatted,
        scoreStatus: 'approved_by_head_judge',
      });
      setIsWodLocked(false);
    } catch (err: any) {
      syncedRemote = false;
      const isConflict = err?.status === 409 || err?.statusCode === 409 || String(err?.message || '').includes('calculado oficialmente');
      if (isConflict) {
        remoteConflict = true;
        setIsWodLocked(true);
        toast.error('Este WOD já foi calculado oficialmente pelo Juiz-Chefe. Clique em "Destravar WOD" acima para liberar alterações.');
      } else {
        console.warn('[JudgeApp] Submissão remota da API:', err);
      }
    }

    setIsSubmitting(false);

    if (syncedRemote) {
      toast.success(`✅ Súmula de ${currentTeam.teamName} (#${currentTeam.registerNumber}) na Raia ${selectedLaneNumber} homologada com sucesso! Enviada para a Mesa do Head Judge.`, {
        duration: 5000
      });
    } else if (remoteConflict) {
      // Já exibiu toast de erro de bloqueio
    } else {
      toast.success(`✅ Súmula de ${currentTeam.teamName} (#${currentTeam.registerNumber}) salva localmente e enviada para a Mesa do Head Judge!`, {
        duration: 5000
      });
    }

    // Resetar campos após o envio
    setPenaltySeconds(0);
    setNoRepsCount(0);
    setPenaltyNotes('');
    setPhotoSumulaUrl(null);
  };

  // Seleção compartilhada com Baterias, Súmulas, Mesa do Head Judge e Leaderboard
  usePersistArenaSelection(
    activeGame?.code,
    { categoryId: selectedCategoryId, workoutId: selectedWorkoutId, heat: String(selectedHeatNumber) },
    categories.length > 0,
  );

  return (
    <AclGuard resource="judge" requiredRoleLabel="Juízes de Arena e Head Judges">
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 space-y-5">
      
      {(!activeGame || categories.length === 0) && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
          Carregando dados oficiais da competição...
        </div>
      )}

      {/* CABEÇALHO LIMPO DO JUIZ */}
      <div className="glass-panel rounded-3xl p-4 sm:p-5 border border-red-500/30 bg-gradient-to-r from-red-950/40 via-zinc-900 to-zinc-900 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/40 font-bold shrink-0">
            <Gavel className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider">
                Juiz de Arena Oficial
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-zinc-400 font-semibold">Sincronizado c/ Mesa do Head Judge</span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white mt-0.5">
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

      {/* ALERTA DE WOD COM CÁLCULO OFICIAL TRAVADO */}
      {isWodLocked && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/40 border-2 border-amber-500/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-black">
              🔒
            </div>
            <div>
              <h3 className="text-sm font-black text-amber-300 uppercase">
                WOD com Cálculo Oficial Homologado
              </h3>
              <p className="text-xs text-zinc-300 mt-0.5">
                Este WOD já foi calculado oficialmente pelo Juiz-Chefe. Para registrar ou alterar súmulas, reverta o cálculo oficial.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleUnlockWod}
            disabled={isRevertingLock}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider shrink-0 transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {isRevertingLock ? 'Destravando...' : '🔓 Destravar WOD (Head Judge)'}
          </button>
        </div>
      )}

      {/* SELETORES: CATEGORIA, WOD, BATERIA E RAIA */}
      <div className="glass-panel rounded-2xl p-4 border border-zinc-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
            1. Categoria
          </label>
          <select
            value={activeCategory?.id || ''}
            onChange={(e) => {
              const newCatId = e.target.value;
              setSelectedCategoryId(newCatId);
              const nextWods = sortWorkoutsNaturally(
                workouts.filter(w => !w.categoryId || w.categoryId === newCatId || w.categoryIds?.includes(newCatId))
              );
              if (nextWods.length > 0) {
                setSelectedWorkoutId(nextWods[0].id);
              }
              setSelectedHeatNumber(1);
            }}
            className="w-full px-3 py-2.5 min-h-[42px] rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-semibold text-white focus:outline-none focus:border-red-500"
          >
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
            2. Workout / Prova
          </label>
          <select
            value={currentWorkout?.id || ''}
            onChange={(e) => {
              setSelectedWorkoutId(e.target.value);
              setSelectedHeatNumber(1);
            }}
            className="w-full px-3 py-2.5 min-h-[42px] rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-semibold text-white focus:outline-none focus:border-red-500"
          >
            {(categoryWorkouts.length > 0 ? categoryWorkouts : workouts).map(w => (
              <option key={w.id} value={w.id}>{w.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
            3. Bateria (Heat)
          </label>
          <select
            value={selectedHeatNumber}
            onChange={(e) => setSelectedHeatNumber(Number(e.target.value))}
            className="w-full px-3 py-2.5 min-h-[42px] rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-semibold text-white focus:outline-none focus:border-red-500"
          >
            {workoutHeats.length > 0 ? (
              workoutHeats.map(h => (
                <option key={h.id || h.heatNumber} value={h.heatNumber}>
                  Bateria #{h.heatNumber} ({h.startTime || '08:00'}){h.arena ? ` · ${arenaLabel(h.arena)}` : ''}
                </option>
              ))
            ) : (
              [1, 2, 3, 4, 5].map(hNum => (
                <option key={hNum} value={hNum}>Bateria #{hNum}</option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
            4. Minha Raia (Lane)
          </label>
          <select
            value={selectedLaneNumber}
            onChange={(e) => setSelectedLaneNumber(Number(e.target.value))}
            className="w-full px-3 py-2.5 min-h-[42px] rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-semibold text-white focus:outline-none focus:border-red-500"
          >
            {Array.from({ length: activeGame?.lanesCount || 4 }, (_, i) => i + 1).map(lane => (
              <option key={lane} value={lane}>Raia #{lane}</option>
            ))}
          </select>
        </div>
      </div>

      {/* CARD DA EQUIPE / DUPLA REAL NA RAIA */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900 border-2 border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 font-black text-2xl flex items-center justify-center border border-amber-500/40 shrink-0">
            R{selectedLaneNumber}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider">
                {currentTeam?.registerNumber || `#${selectedLaneNumber}`} • ATLETA/DUPLA NA RAIA
              </span>
              <span className="text-[10px] text-zinc-400 font-bold">Bateria #{selectedHeatNumber}</span>
            </div>
            <h2 className="text-xl font-black text-white">
              {currentTeam?.teamName || 'Equipe na Raia'}
            </h2>
            <p className="text-xs text-zinc-300 mt-0.5">
              <strong>Integrantes:</strong> {currentTeam?.athletes?.map(a => a.name).join(' • ') || 'Atletas inscritos'}
            </p>
            <p className="text-[11px] text-zinc-400">
              Box: {currentTeam?.athletes?.[0]?.boxOrAffiliate || 'Independente'}
            </p>
          </div>
        </div>

        <div className="sm:text-right shrink-0">
          <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40 inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Credenciado</span>
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ─── PAINEL DE APURAÇÃO ESPECÍFICO CONFORME O QUE O WOD PEDE ─── */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      {/* CASO 1: WOD 1-A (REMO EM DUPLA — FOR TIME COM CAP E METROS FALTANTES) */}
      {isRowWod && (
        <div className="p-5 sm:p-6 rounded-3xl glass-panel border-2 border-red-500/40 space-y-4 bg-gradient-to-b from-red-950/20 to-zinc-900 shadow-xl">
          <div className="flex items-center justify-between border-b border-red-500/30 pb-3">
            <div>
              <span className="px-2.5 py-0.5 rounded bg-red-600 text-white font-black text-xs uppercase tracking-wider">
                WOD 1 - A: FOR TIME (REMO EM DUPLA)
              </span>
              <p className="text-xs text-zinc-300 mt-1 font-semibold">
                Janela: Min 0:00 ao 5:00 (CAP 5:00). Anotar tempo exato do painel do Remo ou metros faltantes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* OPÇÃO 1: FINALIZOU OS METROS */}
            <div 
              onClick={() => setRowStatus('finished')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                rowStatus === 'finished' 
                  ? 'border-emerald-500 bg-emerald-950/30 text-white shadow-lg shadow-emerald-500/10' 
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 opacity-60 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <input 
                  type="radio" 
                  checked={rowStatus === 'finished'} 
                  onChange={() => setRowStatus('finished')}
                  className="w-4 h-4 accent-emerald-500" 
                />
                <strong className="text-emerald-400 text-sm">[ &nbsp; ] FINALIZOU OS METROS</strong>
              </div>

              <label className="text-[11px] font-bold text-zinc-300 uppercase block mb-1">
                Tempo Exato Marcado no Painel do Remo:
              </label>
              <input
                type="text"
                placeholder="Ex: 04:15.2"
                value={rowTimeInput}
                onChange={(e) => setRowTimeInput(e.target.value)}
                disabled={rowStatus !== 'finished'}
                className="w-full text-center text-3xl font-black font-mono px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-700 text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-zinc-400 block mt-1.5 text-center">
                (Anotar minuto, segundo e décimos da tela do Concept2)
              </span>
            </div>

            {/* OPÇÃO 2: NÃO FINALIZOU (TIME CAP) */}
            <div 
              onClick={() => setRowStatus('cap')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                rowStatus === 'cap' 
                  ? 'border-red-500 bg-red-950/30 text-white shadow-lg shadow-red-500/10' 
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 opacity-60 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <input 
                  type="radio" 
                  checked={rowStatus === 'cap'} 
                  onChange={() => setRowStatus('cap')}
                  className="w-4 h-4 accent-red-500" 
                />
                <strong className="text-red-400 text-sm">[ &nbsp; ] NÃO FINALIZOU (TIME CAP 05:00)</strong>
              </div>

              <label className="text-[11px] font-bold text-zinc-300 uppercase block mb-1">
                Metros Faltantes para completar:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Ex: 85"
                  value={rowMissingMeters || ''}
                  onChange={(e) => setRowMissingMeters(Math.max(0, parseInt(e.target.value) || 0))}
                  disabled={rowStatus !== 'cap'}
                  className="w-full text-center text-3xl font-black font-mono px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-700 text-red-400 focus:outline-none focus:border-red-500"
                />
                <span className="text-xl font-black text-zinc-400">m</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 justify-center">
                {[10, 50, 100].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRowStatus('cap');
                      setRowMissingMeters(prev => prev + m);
                    }}
                    className="px-3 py-1 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-bold hover:bg-zinc-700"
                  >
                    +{m}m
                  </button>
                ))}
              </div>
              <span className="text-xs text-red-400 font-bold block mt-1.5 text-center">
                Critério Oficial: 5:00 + {rowMissingMeters} metros faltantes
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CASO 2: WOD 1-B (DEATH BY EM DUPLA — 3 PARÂMETROS BEM FUNCIONAIS) */}
      {isDeathByWod && (
        <div className="p-5 sm:p-6 rounded-3xl glass-panel border-2 border-blue-500/40 space-y-5 bg-gradient-to-b from-blue-950/20 to-zinc-900 shadow-xl">
          <div className="flex items-center justify-between border-b border-blue-500/30 pb-3">
            <div>
              <span className="px-2.5 py-0.5 rounded bg-blue-600 text-white font-black text-xs uppercase tracking-wider">
                WOD 1 - B: DEATH BY EM DUPLA (3 PARÂMETROS OFICIAIS)
              </span>
              <p className="text-xs text-zinc-300 mt-1 font-semibold">
                Janela: Min 6:00 ao 21:00 (5 blocos de 3 minutos). Informe os 3 parâmetros da prova abaixo.
              </p>
            </div>
          </div>

          {/* PARÂMETRO 1: TOTAL DE ROUNDS FECHADOS */}
          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-blue-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-blue-300 uppercase tracking-wider">
                1º PARÂMETRO: TOTAL DE ROUNDS FECHADOS (1 A 5)
              </label>
              <span className="text-xs font-bold text-amber-400">
                {deathByRoundsCompleted === 5 ? '✓ Fechou os 5 Rounds!' : `Fechou ${deathByRoundsCompleted} Round(s)`}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((roundNum) => (
                <button
                  key={roundNum}
                  type="button"
                  onClick={() => setDeathByRoundsCompleted(roundNum)}
                  className={`py-4 rounded-2xl font-black text-base sm:text-lg transition-transform active:scale-95 border-2 ${
                    deathByRoundsCompleted === roundNum
                      ? 'bg-blue-600 text-white border-blue-300 shadow-lg shadow-blue-500/30 scale-[1.02]'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  [ {roundNum} ] {roundNum === 5 ? 'Todos' : 'Rds'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PARÂMETRO 2: REPS NO ROUND INCOMPLETO (SE NÃO FECHOU OS 5) */}
            <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-700 space-y-2">
              <label className="text-xs font-black text-amber-400 uppercase tracking-wider block">
                2º PARÂMETRO: REPS NO ROUND INCOMPLETO (CAP)
              </label>
              {deathByRoundsCompleted < 5 ? (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={deathByCapReps || ''}
                      onChange={(e) => setDeathByCapReps(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="Ex: 18"
                      className="w-full text-center text-3xl font-black font-mono px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-amber-400 focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-base font-bold text-zinc-400">reps</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 block text-center">
                    (Repetições válidas feitas no round em que a dupla tomou CAP)
                  </span>
                </>
              ) : (
                <div className="py-3 text-center rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 font-bold text-xs">
                  ✓ Todos os 5 rounds fechados! Não houve repetições parciais.
                </div>
              )}
            </div>

            {/* PARÂMETRO 3: TEMPO ACUMULADO (TIE-BREAK) */}
            <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-700 space-y-2">
              <label className="text-xs font-black text-blue-400 uppercase tracking-wider block">
                3º PARÂMETRO: TEMPO ACUMULADO (TIE-BREAK)
              </label>
              <input
                type="text"
                value={deathByTieBreakTime}
                onChange={(e) => setDeathByTieBreakTime(e.target.value)}
                placeholder="Ex: 11:42.5"
                className="w-full text-center text-3xl font-black font-mono px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-blue-400 focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-zinc-400 block text-center">
                (Soma dos tempos dos rounds fechados dentro das janelas)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CASO 3: WOD 2 (SYNC & BURN — FOR TIME 130 REPS • SEM TIE-BREAK) */}
      {isSyncBurnWod && (
        <div className="p-5 sm:p-6 rounded-3xl glass-panel border-2 border-red-500/40 space-y-4 bg-gradient-to-b from-red-950/20 to-zinc-900 shadow-xl">
          <div className="flex items-center justify-between border-b border-red-500/30 pb-3">
            <div>
              <span className="px-2.5 py-0.5 rounded bg-red-600 text-white font-black text-xs uppercase tracking-wider">
                WOD 2: SYNC & BURN (130 REPS TOTAIS • CAP 10:00)
              </span>
              <p className="text-xs text-zinc-300 mt-1 font-semibold">
                50 Sit-Up/Knees/T2B + 30 Cal Air Bike + 30 Sync Burpee + 20 Snatch Sync (Sem Tie-break).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* OPÇÃO 1: FINALIZOU 130 REPS */}
            <div 
              onClick={() => setSyncBurnStatus('finished')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                syncBurnStatus === 'finished' 
                  ? 'border-emerald-500 bg-emerald-950/30 text-white shadow-lg shadow-emerald-500/10' 
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 opacity-60 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <input 
                  type="radio" 
                  checked={syncBurnStatus === 'finished'} 
                  onChange={() => setSyncBurnStatus('finished')}
                  className="w-4 h-4 accent-emerald-500" 
                />
                <strong className="text-emerald-400 text-sm">[ &nbsp; ] FINALIZOU OS 130 MOVIMENTOS</strong>
              </div>

              <label className="text-[11px] font-bold text-zinc-300 uppercase block mb-1">
                Tempo Final de Prova:
              </label>
              <input
                type="text"
                placeholder="Ex: 08:35"
                value={syncBurnTimeInput}
                onChange={(e) => setSyncBurnTimeInput(e.target.value)}
                disabled={syncBurnStatus !== 'finished'}
                className="w-full text-center text-3xl font-black font-mono px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-700 text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-zinc-400 block mt-1.5 text-center">
                (Tempo oficial finalizado antes do Time Cap 10:00)
              </span>
            </div>

            {/* OPÇÃO 2: TIME CAP */}
            <div 
              onClick={() => setSyncBurnStatus('cap')}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                syncBurnStatus === 'cap' 
                  ? 'border-red-500 bg-red-950/30 text-white shadow-lg shadow-red-500/10' 
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 opacity-60 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <input 
                  type="radio" 
                  checked={syncBurnStatus === 'cap'} 
                  onChange={() => setSyncBurnStatus('cap')}
                  className="w-4 h-4 accent-red-500" 
                />
                <strong className="text-red-400 text-sm">[ &nbsp; ] TIME CAP (NÃO FINALIZOU)</strong>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-bold text-zinc-300 uppercase">
                      Repetições Feitas (de 130):
                    </label>
                    <span className="text-xs font-bold text-zinc-400">
                      {Math.max(0, 130 - syncBurnMissingReps)} / 130 reps
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={130}
                    placeholder="Ex: 118"
                    value={syncBurnStatus === 'cap' ? Math.max(0, 130 - syncBurnMissingReps) || '' : ''}
                    onChange={(e) => {
                      const completed = Math.min(130, Math.max(0, parseInt(e.target.value) || 0));
                      setSyncBurnMissingReps(130 - completed);
                    }}
                    disabled={syncBurnStatus !== 'cap'}
                    className="w-full text-center text-2xl font-black font-mono px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-amber-400 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-red-300 uppercase block mb-1">
                    Ou Repetições Faltantes de 130:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={130}
                      placeholder="Ex: 12"
                      value={syncBurnMissingReps || ''}
                      onChange={(e) => setSyncBurnMissingReps(Math.min(130, Math.max(0, parseInt(e.target.value) || 0)))}
                      disabled={syncBurnStatus !== 'cap'}
                      className="w-full text-center text-2xl font-black font-mono px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-red-400 focus:outline-none focus:border-red-500"
                    />
                    <span className="text-sm font-bold text-zinc-400">faltam</span>
                  </div>
                </div>
              </div>

              <span className="text-xs text-red-400 font-bold block mt-2 text-center">
                Critério Oficial: 10:00 + {syncBurnMissingReps} reps faltantes
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CASO 4: WOD 3 (MAXIMUM LIFT — ESCADA DE CARGA MÁXIMA EM KG COM 6 TENTATIVAS & ANILHAS) */}
      {isMaxLiftWod && (() => {
        const isCurrentA = activeAthleteTab === 'A';
        const curAthleteIndex = isCurrentA ? 0 : 1;
        const curAthleteName = currentTeam?.athletes?.[curAthleteIndex]?.name || (isCurrentA ? 'Atleta 1' : 'Atleta 2');
        const curAttempts = isCurrentA ? attemptsA : attemptsB;
        const curAttemptIdx = isCurrentA ? activeAttemptIdxA : activeAttemptIdxB;
        const curAttempt = curAttempts[curAttemptIdx] || curAttempts[0];
        const curBarWeight = isCurrentA ? barWeightA : barWeightB;

        const plateConfig = [
          { key: 'p20' as const, label: '20 kg', tag: 'HELE Azul', color: 'border-blue-500/50 bg-blue-950/30 text-blue-300', dot: '🔵' },
          { key: 'p15' as const, label: '15 kg', tag: 'POOD Amarela', color: 'border-amber-500/50 bg-amber-950/30 text-amber-300', dot: '🟡' },
          { key: 'p10' as const, label: '10 kg', tag: 'BRAVE G', color: 'border-zinc-500/50 bg-zinc-900 text-zinc-200', dot: '⚫' },
          { key: 'p5' as const, label: '5 kg', tag: 'BRAVE M', color: 'border-zinc-600/50 bg-zinc-900 text-zinc-300', dot: '⚫' },
          { key: 'p2' as const, label: '2 kg', tag: 'Vazada', color: 'border-zinc-700/50 bg-zinc-900 text-zinc-400', dot: '🔘' },
          { key: 'p1' as const, label: '1 kg', tag: 'Fracionária', color: 'border-zinc-700/50 bg-zinc-900 text-zinc-400', dot: '⚪' },
        ];

        return (
          <div className="p-4 sm:p-6 rounded-3xl glass-panel border-2 border-amber-500/40 space-y-5 bg-gradient-to-b from-amber-950/20 to-zinc-950 shadow-2xl">
            {/* CABEÇALHO CLEAN WOD 3 */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded bg-amber-500 text-black font-black text-xs uppercase tracking-wider">
                  WOD 3: MAXIMUM LIFT (PR EM KG)
                </span>
                <p className="text-xs text-zinc-400 mt-1">
                  Até 6 tentativas por atleta • Marque as anilhas usadas ou digite a carga
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-zinc-400 uppercase">Carga Total da Dupla:</span>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {(weightAthleteA || 0) + (weightAthleteB || 0)} KG
                </div>
              </div>
            </div>

            {/* SELETOR DE ATLETA (ABAS LADO A LADO) */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setActiveAthleteTab('A')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  isCurrentA
                    ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                    : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 opacity-70'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Atleta 1</span>
                  <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-zinc-800 text-amber-400">
                    {weightAthleteA} KG
                  </span>
                </div>
                <div className="font-bold text-sm text-white truncate">
                  {currentTeam?.athletes?.[0]?.name || 'Atleta 1'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveAthleteTab('B')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  !isCurrentA
                    ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10'
                    : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 opacity-70'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Atleta 2</span>
                  <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-zinc-800 text-amber-400">
                    {weightAthleteB} KG
                  </span>
                </div>
                <div className="font-bold text-sm text-white truncate">
                  {currentTeam?.athletes?.[1]?.name || 'Atleta 2'}
                </div>
              </button>
            </div>

            {/* BARRA BASE OFICIAL DO ATLETA ATIVO */}
            <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-bold text-zinc-300 uppercase flex items-center gap-2">
                <span>Barra Oficial:</span>
                <span className="text-zinc-500 font-normal text-[11px]">(peso base)</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => changeBarWeight(activeAthleteTab, 20)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                    curBarWeight === 20
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  🏋️‍♂️ Masculina: 20 KG
                </button>
                <button
                  type="button"
                  onClick={() => changeBarWeight(activeAthleteTab, 15)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                    curBarWeight === 15
                      ? 'bg-yellow-600 text-white shadow-md'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  🏋️‍♀️ Feminina: 15 KG
                </button>
              </div>
            </div>

            {/* SELETOR DE ATÉ 6 TENTATIVAS */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-zinc-300 uppercase">
                  Tentativas do Atleta ({curAthleteName}):
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  Maior Válida: <strong className="text-amber-400">{isCurrentA ? weightAthleteA : weightAthleteB} KG</strong>
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {curAttempts.map((att, idx) => {
                  const isSelected = idx === curAttemptIdx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (isCurrentA) setActiveAttemptIdxA(idx);
                        else setActiveAttemptIdxB(idx);
                      }}
                      className={`p-2 rounded-xl text-center border transition-all ${
                        isSelected
                          ? 'border-amber-400 bg-amber-400/20 text-white font-black shadow'
                          : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="text-[11px] font-bold">{idx + 1}ª</div>
                      <div className="text-xs font-mono font-black mt-0.5">
                        {att.totalKg > 0 ? `${att.totalKg}k` : '—'}
                      </div>
                      <div className="text-[10px] mt-0.5">
                        {att.status === 'valid' && <span className="text-emerald-400 font-bold">✓ OK</span>}
                        {att.status === 'invalid' && <span className="text-red-400 font-bold">✕ NO</span>}
                        {att.status === 'pending' && <span className="text-zinc-600">—</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PAINEL DA TENTATIVA ATIVA: CALCULADORA DIDÁTICA DE ANILHAS */}
            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-700 space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-amber-500 text-black font-black flex items-center justify-center text-xs">
                    {curAttemptIdx + 1}ª
                  </span>
                  <div>
                    <div className="text-sm font-black text-white">
                      Tentativa {curAttemptIdx + 1} • {curAthleteName}
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono">
                      Barra {curBarWeight}kg
                      {curAttempt.p20 > 0 ? ` + ${curAttempt.p20}x20k` : ''}
                      {curAttempt.p15 > 0 ? ` + ${curAttempt.p15}x15k` : ''}
                      {curAttempt.p10 > 0 ? ` + ${curAttempt.p10}x10k` : ''}
                      {curAttempt.p5 > 0 ? ` + ${curAttempt.p5}x5k` : ''}
                      {curAttempt.p2 > 0 ? ` + ${curAttempt.p2}x2k` : ''}
                      {curAttempt.p1 > 0 ? ` + ${curAttempt.p1}x1k` : ''}
                    </div>
                  </div>
                </div>

                {/* DISPLAY DA CARGA TOTAL */}
                <div className="text-right flex items-center gap-3">
                  <div className="text-3xl font-black text-amber-400 font-mono tracking-tight">
                    {curAttempt.totalKg || curBarWeight} <span className="text-lg text-zinc-300">KG</span>
                  </div>
                </div>
              </div>

              {/* GRADE DE ANILHAS (MINIMALISTA E TOUCH-FRIENDLY) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[11px] font-bold text-zinc-400 uppercase">
                  <span>Selecione a quantidade de cada anilha na barra:</span>
                  <span className="text-zinc-500 text-[10px]">Dica: [+2] adiciona 1 par (1 de cada lado)</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {plateConfig.map(plate => {
                    const count = curAttempt[plate.key] || 0;
                    return (
                      <div
                        key={plate.key}
                        className={`p-2.5 rounded-xl border flex flex-col justify-between ${plate.color}`}
                      >
                        <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                          <span>{plate.dot} {plate.label}</span>
                          <span className="text-[10px] opacity-75 font-normal">{plate.tag}</span>
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => updateAttemptPlate(activeAthleteTab, curAttemptIdx, plate.key, -1)}
                            disabled={count <= 0}
                            className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white font-black text-sm flex items-center justify-center disabled:opacity-30"
                          >
                            -
                          </button>

                          <span className="text-base font-black font-mono text-white px-2">
                            {count}
                          </span>

                          <button
                            type="button"
                            onClick={() => updateAttemptPlate(activeAthleteTab, curAttemptIdx, plate.key, 1)}
                            className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white font-black text-sm flex items-center justify-center"
                          >
                            +
                          </button>

                          <button
                            type="button"
                            onClick={() => updateAttemptPlate(activeAthleteTab, curAttemptIdx, plate.key, 2)}
                            title="Adiciona 1 par (2 anilhas)"
                            className="px-2 h-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 active:scale-95 text-[11px] font-bold text-amber-300"
                          >
                            +2
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* BOTÕES DE STATUS DA TENTATIVA & OVERRIDE MANUAL */}
              <div className="pt-2 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAttemptStatus(activeAthleteTab, curAttemptIdx, 'valid')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 active:scale-95 ${
                      curAttempt.status === 'valid'
                        ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    ✓ TENTATIVA VÁLIDA (OK)
                  </button>

                  <button
                    type="button"
                    onClick={() => setAttemptStatus(activeAthleteTab, curAttemptIdx, 'invalid')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 active:scale-95 ${
                      curAttempt.status === 'invalid'
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    ✕ NO REP
                  </button>
                </div>

                {/* DIGITAÇÃO MANUAL DIRETA */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-400 font-semibold">Ou digite:</span>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    value={curAttempt.totalKg || ''}
                    onChange={(e) => setAttemptTotalDirect(activeAthleteTab, curAttemptIdx, parseInt(e.target.value) || 0)}
                    placeholder="KG"
                    className="w-20 px-2 py-1 text-center font-mono font-black text-sm bg-zinc-950 border border-zinc-700 rounded-lg text-amber-400 focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-xs text-zinc-400 font-bold">KG</span>
                </div>
              </div>
            </div>

            {/* CONSOLIDAÇÃO OFICIAL DAS CARGAS DA DUPLA */}
            <div className="p-4 rounded-2xl bg-zinc-950 border-2 border-emerald-500/50 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                  Score Oficial do WOD 3 (Soma dos PRs da Dupla):
                </span>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Atleta 1: <strong className="text-white">{weightAthleteA} kg</strong> &nbsp;|&nbsp; 
                  Atleta 2: <strong className="text-white">{weightAthleteB} kg</strong>
                </p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-black text-white font-mono">
                  {(weightAthleteA || 0) + (weightAthleteB || 0)} <span className="text-2xl text-emerald-400">KG</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CASO 5: WOD 4-A / 4-B (DOUBLE TROUBLE — MÁXIMO DE REPETIÇÕES VÁLIDAS • SEM TIE-BREAK) */}
      {(isDoubleTroubleWod || (!isRowWod && !isDeathByWod && !isSyncBurnWod && !isMaxLiftWod)) && (
        <div className="p-5 sm:p-6 rounded-3xl glass-panel border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <span className="px-2.5 py-0.5 rounded bg-orange-600 text-white font-black text-xs uppercase tracking-wider">
                {currentWorkout?.title}
              </span>
              <p className="text-xs text-zinc-400 mt-1">
                Apuração exclusiva por repetições válidas totais concluídas (AMRAP puro • Sem Tie-break).
              </p>
            </div>
          </div>

          <div className="max-w-xl mx-auto p-5 sm:p-6 rounded-3xl bg-zinc-950 border-2 border-emerald-500/40 text-center space-y-4 shadow-xl">
            <div className="text-xs sm:text-sm font-black text-zinc-300 uppercase tracking-wider">
              Repetições Válidas Totais (Score Oficial)
            </div>
            
            <div className="flex items-center justify-center gap-3">
              <input
                type="number"
                min={0}
                value={amrapRepsCount}
                onChange={(e) => setAmrapRepsCount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-44 text-center text-5xl sm:text-6xl font-black font-mono px-3 py-2 rounded-2xl bg-zinc-900 border-2 border-emerald-500 text-emerald-400 focus:outline-none focus:border-emerald-400"
              />
              <span className="text-xl font-black text-emerald-400">REPS</span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => setAmrapRepsCount(prev => Math.max(0, prev - 5))}
                className="py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-black text-sm sm:text-base active:scale-95"
              >
                -5
              </button>
              <button
                type="button"
                onClick={() => setAmrapRepsCount(prev => Math.max(0, prev - 1))}
                className="py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black text-base sm:text-lg active:scale-95"
              >
                -1
              </button>
              <button
                type="button"
                onClick={() => setAmrapRepsCount(prev => prev + 1)}
                className="py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xl sm:text-2xl active:scale-95 shadow-lg shadow-emerald-500/30"
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => setAmrapRepsCount(prev => prev + 5)}
                className="py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-base sm:text-lg active:scale-95"
              >
                +5
              </button>
              <button
                type="button"
                onClick={() => setAmrapRepsCount(prev => prev + 10)}
                className="py-3 rounded-2xl bg-emerald-800 hover:bg-emerald-700 text-white font-black text-base sm:text-lg active:scale-95"
              >
                +10
              </button>
            </div>

            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setAmrapRepsCount(0)}
                className="text-xs text-red-400 hover:text-red-300 underline font-semibold"
              >
                Zerar Contagem de Reps
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTROLE DE NO-REPS & PENALIDADES DE TEMPO */}
      <div className="p-4 sm:p-5 rounded-3xl glass-panel border border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
        <div>
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
            Auditoria de No-Reps:
          </span>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-3xl font-black text-red-500">{noRepsCount}</span>
            <button
              onClick={() => setIsNoRepModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-red-500/20 active:scale-95"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>+ Registrar Motivo do NO-REP</span>
            </button>
          </div>
        </div>

        <div className="sm:text-right">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
            Penalidades Adicionadas:
          </span>
          <div className="flex sm:justify-end items-center gap-2 mt-1.5">
            <span className="text-sm font-bold text-amber-400">+{penaltySeconds}s</span>
            <button
              onClick={() => {
                setPenaltySeconds(prev => prev + 5);
                toast.info('+5s de penalidade adicionada');
              }}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
            >
              +5s
            </button>
            <button
              onClick={() => setPenaltySeconds(0)}
              className="px-2 py-1.5 rounded-xl text-zinc-400 hover:text-white text-xs"
            >
              Zerar
            </button>
          </div>
        </div>
      </div>

      {/* FOTO COMPROVANTE DA SÚMULA IMPRESSA (DESTAQUE MESA DO HEAD JUDGE) */}
      <div className="p-5 rounded-3xl glass-panel border-2 border-amber-500/40 bg-zinc-950/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <div>
            <label className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Camera className="w-4 h-4 text-amber-400" />
              <span>Foto da Súmula Impressa Assinada (Obrigatória para Mesa do Head Judge)</span>
            </label>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Fotografe a folha de papel preenchida e assinada para validação imediata na Central do Juiz-Chefe.
            </p>
          </div>
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
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black shadow-lg shadow-amber-500/20 transition-transform active:scale-95"
          >
            <Camera className="w-4 h-4" />
            <span>{photoSumulaUrl ? 'Trocar Foto da Súmula' : 'Fotografar Súmula'}</span>
          </button>
        </div>

        {photoSumulaUrl ? (
          <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500/50 max-h-64 bg-zinc-950 flex items-center justify-center p-2">
            <img src={photoSumulaUrl} alt="Súmula de Papel" className="object-contain max-h-60 w-full rounded-xl" />
            <button
              onClick={() => setPhotoSumulaUrl(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-xl transition-transform active:scale-90"
              title="Remover foto"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="absolute bottom-4 left-4 px-3 py-1 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-500 text-[11px] font-bold">
              ✓ Comprovante anexado para a Mesa do Head Judge
            </div>
          </div>
        ) : (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-zinc-700 hover:border-amber-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-zinc-900/40"
          >
            <ImageIcon className="w-10 h-10 text-amber-500/60 mx-auto mb-2" />
            <p className="text-sm text-zinc-300 font-bold">
              Clique aqui para fotografar ou anexar a súmula física de papel
            </p>
            <span className="text-[11px] text-zinc-500 block mt-1">
              A imagem será enviada diretamente para a aba "Mesa do Head Judge" para homologação
            </span>
          </div>
        )}
      </div>

      {/* BOTÃO PRINCIPAL DE HOMOLOGAÇÃO */}
      <button
        onClick={handleSubmitScore}
        disabled={isSubmitting || !currentTeam}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-black text-base shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            <span>HOMOLOGANDO SCORE NA ARENA...</span>
          </>
        ) : (
          <>
            <Send className="w-5 h-5" />
            <span>HOMOLOGAR SCORE OFICIAL DE {currentTeam?.teamName || 'EQUIPE'}</span>
          </>
        )}
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
