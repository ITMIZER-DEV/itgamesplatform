'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Gavel, 
  Camera, 
  CheckCircle, 
  AlertTriangle, 
  ZoomIn, 
  X, 
  Clock, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  FileCheck, 
  Users, 
  Trophy, 
  History, 
  Filter, 
  RefreshCw, 
  ArrowRight, 
  AlertCircle,
  FileSpreadsheet,
  Check,
  Ban,
  Scale,
  Search,
  Printer,
  Activity,
  Layers,
  ChevronRight,
  Zap,
  Play,
  Award
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { useGames } from '@/lib/use-games';
import { apiClient, ApiError } from '@/lib/api-client';
import { sortWorkoutsNaturally, parseWodTitle } from '@/lib/board';
import { computeWorkoutRanking, computeCategoryStandings, DEFAULT_POINTS_TABLE } from '@/lib/standings-engine';
import { 
  GameEvent, 
  Category, 
  WorkoutRule, 
  TeamRegistration, 
  Heat, 
  ScoreEntry, 
  AuditLogEntry 
} from '@/types';
import { toast } from 'sonner';
import { AclGuard } from '@/components/auth/AclGuard';

export default function HeadJudgePage() {
  const { games, activeGame } = useGames();

  // Dados centrais
  const [categories, setCategories] = useState<Category[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutRule[]>([]);
  const [teams, setTeams] = useState<TeamRegistration[]>([]);
  const [heats, setHeats] = useState<Heat[]>([]);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Abas do Controle Total do Head Judge
  const [activeTab, setActiveTab] = useState<'scores_desk' | 'run_standings' | 'sumulas_mgmt' | 'heats_mgmt' | 'judges_staff' | 'appeals' | 'penalties' | 'audit_log'>('scores_desk');
  const [runningStandingsKey, setRunningStandingsKey] = useState<string | null>(null);
  const [standingsLastRunAt, setStandingsLastRunAt] = useState<string | null>(null);
  const [officialStatusData, setOfficialStatusData] = useState<any | null>(null);

  // Filtros da Mesa
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>('');
  const [deskHeatNumber, setDeskHeatNumber] = useState<string>('1');

  // ⚡ SISTEMA ANTIGO: Busca Rápida por Código do Team / Atleta
  const [quickSearchCode, setQuickSearchCode] = useState<string>('');
  const [quickSelectedTeam, setQuickSelectedTeam] = useState<TeamRegistration | null>(null);
  const [quickSelectedWorkoutId, setQuickSelectedWorkoutId] = useState<string>('');

  // Controle de Congelamento do Leaderboard
  const [isLeaderboardFrozen, setIsLeaderboardFrozen] = useState<boolean>(false);
  const [isUpdatingFreeze, setIsUpdatingFreeze] = useState<boolean>(false);

  // Modal de Zoom de Foto da Súmula
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);

  // Estados dos inputs de lançamento por equipe (regId)
  const [deskScoresState, setDeskScoresState] = useState<Record<string, {
    time: string;
    isCap: boolean;
    reps: string;
    weightA: string;
    weightB: string;
    rounds: number;
    tiebreak: string;
    photoUrl: string | null;
  }>>({});

  // Estados do Modal de Aplicação de Penalidade
  const [isPenaltyModalOpen, setIsPenaltyModalOpen] = useState(false);
  const [penaltyTeamId, setPenaltyTeamId] = useState<string>('');
  const [penaltyWorkoutId, setPenaltyWorkoutId] = useState<string>('');
  const [penaltyType, setPenaltyType] = useState<'seconds' | 'reps' | 'warning' | 'dq'>('seconds');
  const [penaltyValue, setPenaltyValue] = useState<string>('10');
  const [penaltyReason, setPenaltyReason] = useState<string>('');

  // Estados do Modal de Recurso / Retificação de Score
  const [isAppealModalOpen, setIsAppealModalOpen] = useState(false);
  const [appealScore, setAppealScore] = useState<ScoreEntry | null>(null);
  const [appealNewTime, setAppealNewTime] = useState<string>('');
  const [appealNewReps, setAppealNewReps] = useState<string>('');
  const [appealNewWeight, setAppealNewWeight] = useState<string>('');
  const [appealDecisionReason, setAppealDecisionReason] = useState<string>('');

  const loadData = async () => {
    if (!activeGame) return;
    const gameId = activeGame.id;
    const gCode = activeGame.code || activeGame.id;

    let cats = storage.getCategories(gameId);
    let wods = storage.getWorkouts(gameId);
    let tms = storage.getTeams(gameId);
    let hts = storage.getHeats(gameId);
    let scs = storage.getScores(gameId);
    const logs = storage.getAuditLogs(gameId);

    try {
      const [apiCats, apiWods, apiRegs, apiScores, apiOfficial] = await Promise.all([
        apiClient.listCategories(gCode).catch(() => null),
        apiClient.listWorkouts(gCode).catch(() => null),
        apiClient.listRegistrations(gCode).catch(() => null),
        apiClient.listScores(gCode).catch(() => null),
        apiClient.getOfficialStatus(gCode).catch(() => null),
      ]);
      if (apiOfficial) setOfficialStatusData(apiOfficial);

      if (apiCats && apiCats.length > 0) {
        cats = apiCats.map((c: any) => ({
          id: String(c.code),
          gameId: c.gamesId,
          name: c.name,
          gender: c.genderRule || 'open',
          genderRule: c.genderRule || 'open',
          genderComposition: c.genderRule || 'open',
          teamFormat: c.teamType || 'individual',
          maxAthletes: c.maxAthlete || 1,
          maxAthlete: c.maxAthlete || 1,
          maxAthletesPerTeam: c.maxAthlete || 1,
          price: c.amount || 0,
          priceBrl: c.amount || 0,
          description: c.description || '',
          standards: c.standards || '',
          spotsTotal: c.maxRegistrations || 100,
          spotsFilled: c.registrationsCount || 0,
        })) as any;
        storage.setCategoriesForGame(gameId, cats);
      }

      if (apiWods && apiWods.length > 0) {
        wods = apiWods.map((w: any) => ({
          id: String(w.code),
          gameId: w.game,
          gameName: activeGame.name,
          categoryId: String(w.category),
          categoryIds: [String(w.category)],
          categoryNames: [cats.find(c => c.id === String(w.category))?.name || `Categoria ${w.category}`],
          categoryName: cats.find(c => c.id === String(w.category))?.name || `Categoria ${w.category}`,
          title: w.title || `WOD ${w.code}`,
          type: w.type || 'for_time',
          timeCapSeconds: 21 * 60,
          description: w.description || '',
          sumulaTemplateId: w.sumulaTemplate || 'crossfit-wod1-combo-row-deathby',
          movementStandards: [],
          pointsScale: 'standard_100',
        })) as any;
        wods.forEach(w => storage.saveWorkout(w));
      }

      if (apiRegs && apiRegs.length > 0) {
        tms = apiRegs.map((r: any) => {
          const catId = String(r.categoryId ?? r.category);
          return {
            id: String(r.code),
            gameId: r.gameCode || r.game || gCode,
            categoryId: catId,
            categoryName: cats.find(c => c.id === catId)?.name || `Categoria ${catId}`,
            teamName: r.team?.trim() || r.teamName?.trim() || `Equipe #${r.code}`,
            registerNumber: r.number || `#${r.code}`,
            amountPaid: r.amount || 0,
            paymentStatus: r.status === 'confirmed' ? 'paid' : r.status,
            registeredAt: r.createdAt || new Date().toISOString(),
            checkedIn: r.check || false,
            athletes: (r.athletes || []).map((a: any) => ({
              id: String(a.code || a.id),
              name: a.name,
              boxOrAffiliate: a.boxOrGym || '',
              checkIn: a.check || false,
            })),
          };
        }) as any;
        storage.setTeamsForGame(gameId, tms);
      }

      if (apiScores && apiScores.length > 0) {
        const mappedScores: ScoreEntry[] = apiScores.map((s: any) => {
          const team = tms.find(t => t.id === String(s.codeTeam));
          const wod = wods.find(w => w.id === String(s.idEvent));
          return {
            id: `score_${gCode}_${s.idEvent}_${s.codeTeam}`,
            gameId: gCode,
            workoutId: String(s.idEvent),
            categoryId: String(s.category),
            registrationId: String(s.codeTeam),
            teamName: team?.teamName || `Equipe #${s.codeTeam}`,
            registerNumber: team?.registerNumber || `#${s.codeTeam}`,
            judgeName: s.judge || 'Árbitro Oficial',
            timeFormatted: s.time ? (typeof s.time === 'number' ? `${Math.floor(s.time/60)}:${String(s.time%60).padStart(2, '0')}` : String(s.time)) : undefined,
            timeSeconds: typeof s.time === 'number' ? s.time : undefined,
            repsCount: typeof s.reps === 'number' ? s.reps : (s.reps ? Number(s.reps) : undefined),
            weightLoadedKg: typeof s.weight === 'number' ? s.weight : (s.weight ? Number(String(s.weight).replace(/\D/g, '')) : undefined),
            isCompleted: true,
            isWO: false,
            isDisqualified: false,
            scoreStatus: (s.scoreStatus === 'approved_by_head_judge' || s.scoreStatus === 'confirmed') ? 'approved_by_head_judge' : (s.scoreStatus || 'approved_by_head_judge'),
            photoSumulaUrl: s.photo || undefined,
            submittedAt: s.createdAt || new Date().toISOString()
          };
        });
        if (mappedScores.length > 0) {
          scs = mappedScores;
        }
      }
    } catch (err) {
      console.warn('[HeadJudge] Fallback para storage local', err);
    }

    setCategories(cats);
    setWorkouts(wods);
    setTeams(tms);
    setHeats(hts);
    setScores(scs);
    setAuditLogs(logs);

    if (cats.length > 0 && !selectedCategoryId) {
      const defaultCat = cats.find(c => c.id === '2') || cats[0];
      setSelectedCategoryId(defaultCat.id);
      const firstCatWods = sortWorkoutsNaturally(
        wods.filter(w => !w.categoryId || w.categoryId === defaultCat.id || w.categoryIds?.includes(defaultCat.id))
      );
      if (firstCatWods.length > 0 && !selectedWorkoutId) {
        setSelectedWorkoutId(firstCatWods[0].id);
      }
    } else if (wods.length > 0 && !selectedWorkoutId) {
      const sorted = sortWorkoutsNaturally(wods);
      setSelectedWorkoutId(sorted[0].id);
    }

    // Carregar estado de congelamento real do banco e storage
    const frozenState = localStorage.getItem(`itgames_freeze_leaderboard_${gCode}`);
    const isFrozenInDb = (activeGame.status as any) === 'frozen';
    setIsLeaderboardFrozen(frozenState === 'true' || isFrozenInDb);
  };

  useEffect(() => {
    storage.initDefaultsIfEmpty();
    loadData();

    window.addEventListener('itgames_storage_updated', loadData);
    return () => window.removeEventListener('itgames_storage_updated', loadData);
  }, [activeGame]);

  // Categoria e WOD ativos
  const currentCategory = categories.find(c => c.id === selectedCategoryId) || categories[0];
  const categoryWorkouts = sortWorkoutsNaturally(
    workouts.filter(w => !w.categoryId || w.categoryId === currentCategory?.id || w.categoryIds?.includes(currentCategory?.id))
  );
  const currentWorkout = categoryWorkouts.find(w => w.id === selectedWorkoutId) || categoryWorkouts[0] || workouts[0];

  const handleSelectCategory = (catId: string) => {
    setSelectedCategoryId(catId);
    setDeskHeatNumber('1');
    const nextWods = sortWorkoutsNaturally(
      workouts.filter(w => !w.categoryId || w.categoryId === catId || w.categoryIds?.includes(catId))
    );
    setSelectedWorkoutId(nextWods[0]?.id || '');
  };
  
  // Equipes filtradas da categoria (garantindo que não perca por causa de status)
  const filteredTeams = teams.filter(t => t.categoryId === currentCategory?.id && t.paymentStatus !== 'cancelled');

  // Mapear Raias e Baterias
  interface LaneItem {
    team: TeamRegistration;
    heatNumber: number | string;
    laneNumber: number | string;
    heatTime: string;
  }

  const workoutHeats = heats.filter(h => h.workoutId === currentWorkout?.id);
  const allCategoryLanes: LaneItem[] = [];

  if (workoutHeats.length > 0) {
    workoutHeats.forEach(heat => {
      heat.laneAssignments.forEach(lane => {
        const team = filteredTeams.find(t => t.id === lane.registrationId);
        if (team) {
          allCategoryLanes.push({
            team,
            heatNumber: heat.heatNumber,
            laneNumber: lane.lane,
            heatTime: heat.startTime
          });
        }
      });
    });
  } else {
    const lanesPerHeat = activeGame?.lanesCount || 4;
    filteredTeams.forEach((team, idx) => {
      const heatNum = Math.floor(idx / lanesPerHeat) + 1;
      const laneNum = (idx % lanesPerHeat) + 1;
      allCategoryLanes.push({
        team,
        heatNumber: heatNum,
        laneNumber: laneNum,
        heatTime: `${String(8 + Math.floor((idx * 25) / 60)).padStart(2, '0')}:${String((idx * 25) % 60).padStart(2, '0')}`
      });
    });
  }

  const distinctHeats = Array.from(new Set(allCategoryLanes.map(item => Number(item.heatNumber)))).sort((a, b) => a - b);
  const activeDeskHeatLanes = allCategoryLanes.filter(item => String(item.heatNumber) === String(deskHeatNumber));
  const deskHeatHomologatedCount = activeDeskHeatLanes.filter(item => {
    return scores.some(s => s.workoutId === currentWorkout?.id && s.registrationId === item.team.id && s.scoreStatus === 'approved_by_head_judge');
  }).length;

  // ⚡ SISTEMA ANTIGO: Busca por Código do Team / Atleta
  const handleQuickSearch = (code: string) => {
    setQuickSearchCode(code);
    if (!code.trim()) {
      setQuickSelectedTeam(null);
      return;
    }

    const clean = code.trim().toLowerCase().replace('#', '');
    const found = teams.find(t => 
      t.id.toLowerCase() === clean || 
      t.registerNumber.toLowerCase().includes(clean) || 
      t.teamName.toLowerCase().includes(clean) ||
      (t.athletes || []).some(a => a.name.toLowerCase().includes(clean))
    );

    if (found) {
      setQuickSelectedTeam(found);
      setSelectedCategoryId(found.categoryId);
      // Pré-selecionar o primeiro WOD pendente (em ordem natural)
      const teamWods = sortWorkoutsNaturally(
        workouts.filter(w => !w.categoryId || w.categoryId === found.categoryId || w.categoryIds?.includes(found.categoryId))
      );
      const firstPending = teamWods.find(w => !scores.some(s => s.workoutId === w.id && s.registrationId === found.id));
      setQuickSelectedWorkoutId(firstPending ? firstPending.id : (teamWods[0]?.id || ''));
    } else {
      setQuickSelectedTeam(null);
    }
  };

  // Toggle do Congelamento de Leaderboard (Atualiza Banco, Telões e Storage)
  const handleToggleFreezeLeaderboard = async () => {
    if (!activeGame) return;
    const gCode = activeGame.code || activeGame.id;
    const newState = !isLeaderboardFrozen;
    setIsUpdatingFreeze(true);

    try {
      // 1. Atualizar no backend (Prisma Game status)
      await apiClient.updateGameStatus(gCode, newState ? 'frozen' : 'live').catch((err) => {
        console.warn('API updateGameStatus fallback:', err);
      });

      // 2. Persistir localmente e disparar eventos para os telões
      setIsLeaderboardFrozen(newState);
      localStorage.setItem(`itgames_freeze_leaderboard_${gCode}`, String(newState));
      localStorage.setItem('itgames_freeze_leaderboard_SUMMER2026', String(newState));
      localStorage.setItem('itgames_leaderboard_frozen', String(newState));
      localStorage.setItem('itgames_freeze_leaderboard', String(newState));
      window.dispatchEvent(new CustomEvent('itgames_freeze_changed', { detail: { frozen: newState } }));

      // Transmissão instantânea via BroadcastChannel para todos os telões e abas abertas
      try {
        const bc = new BroadcastChannel('itgames_freeze_channel');
        bc.postMessage({ frozen: newState, gameCode: gCode, timestamp: Date.now() });
        bc.close();
      } catch (e) {}

      // 3. Registrar na auditoria
      storage.saveScore(
        {} as any, 
        'Head Judge Oficial', 
        'head_judge', 
        `Leaderboard ${newState ? 'CONGELADO' : 'DESCONGELADO'} pelo Head Judge (Blindagem Oficial)`
      );

      if (newState) {
        toast.warning('LEADERBOARD CONGELADO! O Telão e o placar público entraram em modo blindado com cadeado.');
      } else {
        toast.success('LEADERBOARD AO VIVO! O placar da arena foi reaberto com todas as pontuações homologadas.');
      }
    } catch (e) {
      toast.error('Erro ao atualizar status de congelamento');
    } finally {
      setIsUpdatingFreeze(false);
    }
  };

  // ⚡ MOTOR DE CLASSIFICAÇÃO & PONTUAÇÃO OFICIAL (RODAR WOD, CATEGORIA OU CAMPEONATO)
  const categoryPointsTable =
    activeGame?.scoringRules?.pointsTable && activeGame.scoringRules.pointsTable.length > 0
      ? activeGame.scoringRules.pointsTable
      : DEFAULT_POINTS_TABLE;

  const currentStandingsResult = currentCategory
    ? computeCategoryStandings(currentCategory, teams, workouts, scores, categoryPointsTable)
    : null;

  const broadcastStandingsRefresh = () => {
    try {
      const bc = new BroadcastChannel('itgames_freeze_channel');
      bc.postMessage({ standingsUpdated: true, timestamp: Date.now() });
      bc.close();
    } catch {}
    window.dispatchEvent(new Event('itgames_standings_updated'));
  };

  const handleRunWodStandings = async (categoryId: string, workoutId: string) => {
    if (!activeGame) return;
    const cat = categories.find((c) => c.id === categoryId);
    const wod = workouts.find((w) => w.id === workoutId);
    if (!cat || !wod) return;

    const key = `${categoryId}:${workoutId}`;
    setRunningStandingsKey(key);
    try {
      const catTeams = teams.filter((t) => t.categoryId === cat.id && t.paymentStatus !== 'cancelled');
      const result = computeWorkoutRanking({ ...wod, categoryId: cat.id }, catTeams, scores, categoryPointsTable);

      if (result.updatedScores.length > 0) {
        storage.saveBatchScores(
          result.updatedScores,
          'Head Judge Oficial',
          `Classificação da prova "${wod.title}" (${cat.name}) rodada — ${result.updatedScores.length} equipes pontuadas`,
        );
      }

      const gCode = activeGame.code || activeGame.id;
      const numCat = Number(String(cat.id).replace(/\D/g, ''));
      const numEvent = Number(String(wod.id).replace(/\D/g, ''));
      let apiConfirmed = false;
      if (numCat > 0 && numEvent > 0) {
        try {
          await apiClient.confirmOfficialWod(gCode, numCat, numEvent);
          apiConfirmed = true;
          const refreshedOfficial = await apiClient.getOfficialStatus(gCode).catch(() => null);
          if (refreshedOfficial) setOfficialStatusData(refreshedOfficial);
        } catch (err) {
          // Pode já estar confirmado ou em modo local
          console.warn('[HeadJudge] Aviso ao confirmar WOD oficial na API:', err instanceof ApiError ? err.message : err);
        }
      }

      setScores(storage.getScores(activeGame.id));
      setAuditLogs(storage.getAuditLogs(activeGame.id));
      setStandingsLastRunAt(new Date().toLocaleTimeString('pt-BR'));
      broadcastStandingsRefresh();

      const leader = result.rows[0];
      toast.success(
        `⚡ Ranking de "${wod.title}" recalculado!${leader ? ` 1º Lugar: ${leader.team.teamName} (${leader.points} pts)` : ''}${apiConfirmed ? ' • Confirmado na API oficial.' : ''}`,
      );
    } finally {
      setRunningStandingsKey(null);
    }
  };

  const handleRunCategoryStandings = async (categoryId: string) => {
    if (!activeGame) return;
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;

    setRunningStandingsKey(`cat:${categoryId}`);
    try {
      const result = computeCategoryStandings(cat, teams, workouts, scores, categoryPointsTable);
      if (result.updatedScores.length > 0) {
        storage.saveBatchScores(
          result.updatedScores,
          'Head Judge Oficial',
          `Classificação GERAL da categoria "${cat.name}" rodada com desempate oficial (${result.workouts.length} provas)`,
        );
      }

      const gCode = activeGame.code || activeGame.id;
      const numCat = Number(String(cat.id).replace(/\D/g, ''));
      for (const wod of result.workouts) {
        const numEvent = Number(String(wod.id).replace(/\D/g, ''));
        if (numCat > 0 && numEvent > 0) {
          await apiClient.confirmOfficialWod(gCode, numCat, numEvent).catch(() => null);
        }
      }
      const refreshedOfficial = await apiClient.getOfficialStatus(gCode).catch(() => null);
      if (refreshedOfficial) setOfficialStatusData(refreshedOfficial);

      setScores(storage.getScores(activeGame.id));
      setAuditLogs(storage.getAuditLogs(activeGame.id));
      setStandingsLastRunAt(new Date().toLocaleTimeString('pt-BR'));
      broadcastStandingsRefresh();

      const top1 = result.ranks[0];
      toast.success(
        `🏆 Classificação da categoria "${cat.name}" rodada com sucesso!${top1 ? ` Líder Geral: ${top1.teamName} (${top1.totalPoints} pts)` : ''}`,
      );
    } finally {
      setRunningStandingsKey(null);
    }
  };

  const handleRunAllStandings = async () => {
    if (!activeGame || categories.length === 0) return;
    setRunningStandingsKey('all');
    try {
      const allUpdated: ScoreEntry[] = [];
      const gCode = activeGame.code || activeGame.id;
      for (const cat of categories) {
        const res = computeCategoryStandings(cat, teams, workouts, scores, categoryPointsTable);
        allUpdated.push(...res.updatedScores);
        const numCat = Number(String(cat.id).replace(/\D/g, ''));
        for (const wod of res.workouts) {
          const numEvent = Number(String(wod.id).replace(/\D/g, ''));
          if (numCat > 0 && numEvent > 0) {
            await apiClient.confirmOfficialWod(gCode, numCat, numEvent).catch(() => null);
          }
        }
      }

      if (allUpdated.length > 0) {
        storage.saveBatchScores(
          allUpdated,
          'Head Judge Oficial',
          `Classificação GERAL de todo o campeonato (${categories.length} categorias) rodada e publicada`,
        );
      }

      const refreshedOfficial = await apiClient.getOfficialStatus(gCode).catch(() => null);
      if (refreshedOfficial) setOfficialStatusData(refreshedOfficial);

      setScores(storage.getScores(activeGame.id));
      setAuditLogs(storage.getAuditLogs(activeGame.id));
      setStandingsLastRunAt(new Date().toLocaleTimeString('pt-BR'));
      broadcastStandingsRefresh();

      toast.success(`🚀 Todas as ${categories.length} categorias recalculadas com critérios de desempate oficiais e publicadas no Leaderboard!`);
    } finally {
      setRunningStandingsKey(null);
    }
  };

  // Upload de Foto da Súmula
  const handlePhotoUpload = (regId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('O arquivo selecionado deve ser uma imagem (JPG, PNG, WEBP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setDeskScoresState(prev => ({
        ...prev,
        [regId]: {
          ...(prev[regId] || {
            time: '04:30',
            isCap: false,
            reps: '0',
            weightA: '0',
            weightB: '0',
            rounds: 3,
            tiebreak: '',
            photoUrl: null
          }),
          photoUrl: base64
        }
      }));
      toast.success('Foto da súmula física anexada com sucesso!');
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateDeskField = (regId: string, field: string, value: any) => {
    setDeskScoresState(prev => ({
      ...prev,
      [regId]: {
        ...(prev[regId] || {
          time: '04:30',
          isCap: false,
          reps: '0',
          weightA: '0',
          weightB: '0',
          rounds: 3,
          tiebreak: '',
          photoUrl: null
        }),
        [field]: value
      }
    }));
  };

  // Homologar Score com Foto Obrigatória (Aceita WOD específico para suporte ao Lançamento por Código)
  const handleHomologateScore = async (team: TeamRegistration, laneNum: number, heatNum: number, targetWorkoutOverride?: WorkoutRule) => {
    const targetWod = targetWorkoutOverride || currentWorkout;
    const state = deskScoresState[team.id];
    
    if (!state?.photoUrl) {
      toast.error('REGRA OBRIGATÓRIA: Anexe a foto da súmula física assinada antes de homologar!', {
        duration: 5000,
        icon: '⚠️'
      });
      return;
    }

    if (!targetWod || !activeGame) return;

    const isWod1A = targetWod.title.includes('1-A') || targetWod.title.toLowerCase().includes('row') || targetWod.title.toLowerCase().includes('remo');
    const isWod1B = targetWod.title.includes('1-B') || targetWod.title.toLowerCase().includes('death by');
    const isWod3 = targetWod.title.includes('3') || targetWod.title.toLowerCase().includes('hang clean') || targetWod.title.toLowerCase().includes('lift') || targetWod.type === 'max_load' || targetWod.type === 'complex';

    let timeFormatted: string | undefined = undefined;
    let timeSeconds: number | undefined = undefined;
    let repsCount: number | undefined = undefined;
    let roundsCount: number | undefined = undefined;
    let weightLoadedKg: number | undefined = undefined;
    let isCompleted = true;

    if (isWod1A) {
      if (state.isCap) {
        isCompleted = false;
        const missingMeters = Number(state.reps) || 0;
        timeFormatted = `CAP +${missingMeters}m`;
        timeSeconds = 5 * 60 + missingMeters;
        repsCount = missingMeters;
      } else {
        timeFormatted = state.time || '04:30';
        const parts = (timeFormatted || '0:0').split(':').map(Number);
        timeSeconds = (parts[0] || 0) * 60 + (parts[1] || 0);
      }
    } else if (isWod1B) {
      roundsCount = state.rounds ?? 3;
      timeFormatted = `${roundsCount} rounds`;
      timeSeconds = 21 * 60;
      repsCount = Number(state.reps) || 0;
      isCompleted = roundsCount === 5;
    } else if (isWod3) {
      const wA = Number(state.weightA) || 0;
      const wB = Number(state.weightB) || 0;
      weightLoadedKg = wA + wB;
      timeFormatted = `${weightLoadedKg} kg`;
    } else {
      if (state.isCap) {
        isCompleted = false;
        const missingReps = Number(state.reps) || 0;
        timeFormatted = `CAP +${missingReps}`;
        timeSeconds = 10 * 60 + missingReps;
        repsCount = missingReps;
      } else {
        timeFormatted = state.time || '08:30';
        const parts = (timeFormatted || '0:0').split(':').map(Number);
        timeSeconds = (parts[0] || 0) * 60 + (parts[1] || 0);
      }
    }

    const targetTeamName = team.teamName || (team as any).name || 'Equipe';

    const newScore: ScoreEntry = {
      id: `score_${activeGame.id}_${targetWod.id}_${team.id}`,
      gameId: activeGame.id,
      workoutId: targetWod.id,
      categoryId: team.categoryId,
      registrationId: team.id,
      teamName: targetTeamName,
      registerNumber: team.registerNumber || team.id,
      heatNumber: heatNum,
      lane: laneNum,
      judgeName: 'Head Judge Oficial',
      timeFormatted,
      timeSeconds,
      repsCount,
      roundsCount,
      weightLoadedKg,
      tieBreakTimeFormatted: state.tiebreak || undefined,
      isCompleted,
      isWO: false,
      isDisqualified: false,
      photoSumulaUrl: state.photoUrl,
      scoreStatus: 'approved_by_head_judge',
      approvedBy: 'Head Judge Oficial',
      approvedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString()
    };

    storage.saveScore(newScore, 'Head Judge Oficial', 'head_judge', `Homologação de súmula (${targetWod.title}) com foto comprovatória`);
    setScores(storage.getScores(activeGame.id));
    setAuditLogs(storage.getAuditLogs(activeGame.id));

    try {
      await apiClient.submitScore({
        game: activeGame.code || activeGame.id,
        category: Number(team.categoryId) || 1,
        codeTeam: Number(team.id) || 1,
        idEvent: Number(targetWod.id) || 1,
        time: timeSeconds,
        reps: repsCount,
        weight: weightLoadedKg,
        tieBreakTime: state.tiebreak ? 100 : undefined,
        scoreStatus: 'approved_by_head_judge',
        photo: state.photoUrl
      });
    } catch (e) {
      console.warn('Persistência remota da API offline, salvo localmente.');
    }

    toast.success(`Súmula de ${targetTeamName} no ${targetWod.title} HOMOLOGADA com foto! Placar recalculado.`);
  };

  // Abrir Modal de Retificação / Recurso
  const handleOpenAppealModal = (score: ScoreEntry) => {
    setAppealScore(score);
    setAppealNewTime(score.timeFormatted || '');
    setAppealNewReps(String(score.repsCount || ''));
    setAppealNewWeight(String(score.weightLoadedKg || ''));
    setAppealDecisionReason('');
    setIsAppealModalOpen(true);
  };

  // Salvar Decisão de Recurso
  const handleSaveAppealDecision = (action: 'defer' | 'reject') => {
    if (!appealScore || !activeGame) return;

    if (!appealDecisionReason.trim()) {
      toast.error('Informe o parecer técnico oficial do Head Judge.');
      return;
    }

    if (action === 'defer') {
      const updatedScore: ScoreEntry = {
        ...appealScore,
        timeFormatted: appealNewTime || appealScore.timeFormatted,
        repsCount: appealNewReps ? Number(appealNewReps) : appealScore.repsCount,
        weightLoadedKg: appealNewWeight ? Number(appealNewWeight) : appealScore.weightLoadedKg,
        scoreStatus: 'approved_by_head_judge',
        approvedBy: 'Head Judge Oficial',
        approvedAt: new Date().toISOString()
      };

      storage.saveScore(
        updatedScore,
        'Head Judge Oficial',
        'head_judge',
        `RECURSO DEFERIDO: ${appealDecisionReason}`
      );

      toast.success(`Recurso da equipe ${appealScore.teamName} DEFERIDO! Score retificado.`);
    } else {
      storage.saveScore(
        appealScore,
        'Head Judge Oficial',
        'head_judge',
        `RECURSO INDEFERIDO: ${appealDecisionReason}`
      );

      toast.info(`Recurso da equipe ${appealScore.teamName} INDEFERIDO. Score original mantido.`);
    }

    setScores(storage.getScores(activeGame.id));
    setAuditLogs(storage.getAuditLogs(activeGame.id));
    setIsAppealModalOpen(false);
  };

  // Aplicar Penalidade Disciplinar
  const handleApplyPenalty = () => {
    if (!penaltyTeamId || !penaltyWorkoutId || !activeGame) {
      toast.error('Selecione a equipe e a prova para aplicar a penalidade.');
      return;
    }

    if (!penaltyReason.trim()) {
      toast.error('Descreva o motivo/infração da penalidade.');
      return;
    }

    const team = teams.find(t => t.id === penaltyTeamId);
    const existing = scores.find(s => s.workoutId === penaltyWorkoutId && s.registrationId === penaltyTeamId);

    const secondsPen = penaltyType === 'seconds' ? Number(penaltyValue) : 0;
    const isDQ = penaltyType === 'dq';

    const targetScore: ScoreEntry = existing || {
      id: `score_pen_${activeGame.id}_${penaltyWorkoutId}_${penaltyTeamId}`,
      gameId: activeGame.id,
      workoutId: penaltyWorkoutId,
      categoryId: team?.categoryId || '',
      registrationId: penaltyTeamId,
      teamName: team?.teamName || (team as any)?.name || 'Equipe',
      registerNumber: team?.registerNumber || `#${penaltyTeamId}`,
      judgeName: 'Head Judge Oficial',
      isCompleted: true,
      isWO: false,
      isDisqualified: isDQ,
      scoreStatus: 'approved_by_head_judge',
      submittedAt: new Date().toISOString()
    };

    const updatedScore: ScoreEntry = {
      ...targetScore,
      penaltiesSeconds: (targetScore.penaltiesSeconds || 0) + secondsPen,
      penaltyNotes: penaltyReason,
      isDisqualified: isDQ,
      scoreStatus: 'approved_by_head_judge'
    };

    storage.saveScore(
      updatedScore,
      'Head Judge Oficial',
      'head_judge',
      `PENALIDADE APLICADA (${penaltyType.toUpperCase()}): ${penaltyReason}`
    );

    setScores(storage.getScores(activeGame.id));
    setAuditLogs(storage.getAuditLogs(activeGame.id));
    setIsPenaltyModalOpen(false);
    toast.success(`Penalidade aplicada à equipe ${team?.teamName || 'Equipe'} com sucesso!`);
  };

  // Métricas rápidas
  const totalHomologated = scores.filter(s => s.scoreStatus === 'approved_by_head_judge').length;
  const contestedScores = scores.filter(s => s.scoreStatus === 'contested');
  const disqualifiedScores = scores.filter(s => s.isDisqualified || (s.penaltiesSeconds && s.penaltiesSeconds > 0));

  return (
    <AclGuard resource="headjudge" requiredRoleLabel="Head Judge ou Organizadores">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* CABEÇALHO DO COCKPIT */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider">
              <Gavel className="w-4 h-4 text-amber-400" />
              <span>Gabinete de Arbitragem Geral</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px] text-amber-300 font-bold">
                CONTROLE TOTAL DE CAMPO
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1 flex items-center gap-2">
              <span>Mesa do Head Judge</span>
              <span className="text-zinc-500 font-normal text-lg">| {activeGame?.name || 'Campeonato'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Controle centralizado: Lançamento de Súmulas com Foto, Gestão de Baterias &amp; Raias, Escala dos Juízes e Congelamento do Placar.
            </p>
          </div>

          {/* BOTÃO MASTER: CONGELAR / DESCONGELAR LEADERBOARD & RODAR CLASSIFICAÇÕES */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => setActiveTab('run_standings')}
              className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs transition-all shadow-lg shadow-amber-500/20 active:scale-95 min-h-[42px]"
            >
              <Zap className="w-4 h-4" />
              <span>⚡ RODAR CLASSIFICAÇÕES</span>
            </button>

            <button
              onClick={handleToggleFreezeLeaderboard}
              disabled={isUpdatingFreeze}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-lg active:scale-95 min-h-[42px] ${
                isLeaderboardFrozen
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30 ring-2 ring-rose-400 animate-pulse'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
              }`}
            >
              {isLeaderboardFrozen ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>LEADERBOARD BLOQUEADO (CLIQUE P/ LIBERAR)</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>LEADERBOARD AO VIVO (CLIQUE P/ BLOQUEAR)</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsPenaltyModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-rose-400 font-bold text-xs border border-zinc-700 transition-transform active:scale-95 min-h-[42px]"
            >
              <Ban className="w-4 h-4" />
              <span>+ Penalidade</span>
            </button>
          </div>
        </div>

        {/* CARDS DE INDICADORES RÁPIDOS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-2xl border border-zinc-800 space-y-1">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span>Súmulas Homologadas c/ Foto</span>
            </span>
            <div className="text-2xl font-black text-white">
              {totalHomologated}
              <span className="text-xs text-zinc-500 font-normal ml-2">scores no Leaderboard</span>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-zinc-800 space-y-1">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-amber-400" />
              <span>Recursos &amp; Contestações</span>
            </span>
            <div className="text-2xl font-black text-amber-400">
              {contestedScores.length}
              <span className="text-xs text-zinc-500 font-normal ml-2">em análise na Mesa</span>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-zinc-800 space-y-1">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Ban className="w-3.5 h-3.5 text-rose-400" />
              <span>Penalidades &amp; Infrações</span>
            </span>
            <div className="text-2xl font-black text-rose-400">
              {disqualifiedScores.length}
              <span className="text-xs text-zinc-500 font-normal ml-2">registradas</span>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-zinc-800 space-y-1">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-blue-400" />
              <span>Status do Placar Oficial</span>
            </span>
            <div className="text-sm font-black mt-1">
              {isLeaderboardFrozen ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs">
                  <Lock className="w-3 h-3" /> CONGELADO (Blindado)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs">
                  <Check className="w-3 h-3" /> AO VIVO (Público)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO ENTRE AS ÁREAS DO HEAD JUDGE (SÚMULAS, BATERIAS, JUIZ, RECURSOS) */}
        <div className="flex overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-2 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 w-full [&>*]:shrink-0 [&>*]:whitespace-nowrap">
          <button
            onClick={() => setActiveTab('scores_desk')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'scores_desk'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Camera className={`w-4 h-4 ${activeTab === 'scores_desk' ? 'text-black/80' : 'text-amber-400'}`} />
            <span>1. Lançamento de Súmulas Físicas (Foto Obrigatória)</span>
          </button>

          <button
            onClick={() => setActiveTab('run_standings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'run_standings'
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-black'
                : 'text-emerald-300 hover:text-white bg-emerald-500/10 border border-emerald-500/30'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>2. ⚡ Rodar Classificações &amp; Ranking</span>
          </button>

          <button
            onClick={() => setActiveTab('sumulas_mgmt')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'sumulas_mgmt'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Súmulas A4 &amp; Presets</span>
          </button>

          <button
            onClick={() => setActiveTab('heats_mgmt')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'heats_mgmt'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>3. Baterias &amp; Raias</span>
          </button>

          <button
            onClick={() => setActiveTab('judges_staff')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'judges_staff'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>4. Juízes &amp; Escala de Pista</span>
          </button>

          <button
            onClick={() => setActiveTab('appeals')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'appeals'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>5. Recursos ({contestedScores.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('penalties')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'penalties'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Ban className="w-4 h-4" />
            <span>6. Penalidades ({disqualifiedScores.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit_log')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'audit_log'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 font-black'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>7. Trilha de Auditoria</span>
          </button>
        </div>

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* ABA 1: LANÇAMENTO DE SÚMULAS FÍSICAS (FOTO OBRIGATÓRIA) */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {activeTab === 'scores_desk' && (
          <div className="space-y-6">

            {/* ⚡ CARD DO SISTEMA ANTIGO: BUSCA POR CÓDIGO DO TEAM / ATLETA */}
            <div className="glass-panel rounded-3xl p-6 border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-zinc-900 to-zinc-900 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider">
                  <Search className="w-4 h-4" />
                  <span>Lançamento Rápido por Código do Team / Atleta (Sistema Oficial)</span>
                </div>
                <span className="text-[11px] text-zinc-400 font-semibold">
                  Carrega a equipe na hora e permite escolher o WOD caso não esteja encerrado
                </span>
              </div>

              {/* INPUT DE DIGITAÇÃO DE CÓDIGO */}
              <div className="relative">
                <Search className="w-5 h-5 text-amber-400 absolute left-4 top-3.5" />
                <input
                  type="text"
                  inputMode="search"
                  value={quickSearchCode}
                  onChange={(e) => handleQuickSearch(e.target.value)}
                  placeholder="DIGITE O CÓDIGO DO TEAM, BIB OU NOME (Ex: 2512, 2732, Girls Power...)"
                  className="w-full pl-12 pr-4 py-3 rounded-2xl bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 text-white font-black text-base sm:text-sm uppercase placeholder:normal-case placeholder:font-normal placeholder:text-zinc-500 transition-all shadow-inner"
                />
              </div>

              {/* RESULTADO DO SISTEMA ANTIGO: EQUIPE CARREGADA */}
              {quickSelectedTeam && (
                <div className="p-5 rounded-2xl bg-zinc-950 border border-amber-500/40 space-y-4 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-white">{quickSelectedTeam.teamName}</span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs">
                          {quickSelectedTeam.registerNumber}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">
                        Categoria: <strong className="text-zinc-200">{quickSelectedTeam.categoryName}</strong> • Atletas: <strong className="text-zinc-300">{(quickSelectedTeam.athletes || []).map(a => a.name).join(' • ')}</strong>
                      </div>
                    </div>
                  </div>

                  {/* ESCOLHA DO WOD (LISTA OS WODS DA CATEGORIA DA EQUIPE) */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                      Selecione o WOD para Lançamento ou Revisão:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {sortWorkoutsNaturally(
                        workouts.filter(w => !w.categoryId || w.categoryId === quickSelectedTeam.categoryId || w.categoryIds?.includes(quickSelectedTeam.categoryId))
                      ).map(wod => {
                          const existing = scores.find(s => s.workoutId === wod.id && s.registrationId === quickSelectedTeam.id);
                          const isClosed = Boolean(existing && existing.scoreStatus === 'approved_by_head_judge');
                          const isSelected = quickSelectedWorkoutId === wod.id;

                          return (
                            <button
                              key={wod.id}
                              type="button"
                              onClick={() => setQuickSelectedWorkoutId(wod.id)}
                              className={`p-3 rounded-xl border text-left transition-all ${
                                isSelected
                                  ? 'border-amber-500 bg-amber-500/10 shadow-md shadow-amber-500/10'
                                  : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs font-black">
                                <span className={isSelected ? 'text-amber-400' : 'text-white'}>{wod.title}</span>
                                {isClosed ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                                    Encerrado
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                                    Pendente
                                  </span>
                                )}
                              </div>
                              {existing && (
                                <div className="text-[11px] font-mono text-emerald-400 mt-1 font-bold">
                                  Score: {existing.timeFormatted || `${existing.repsCount || existing.weightLoadedKg} pts`}
                                </div>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  {/* FORMULÁRIO DE LANÇAMENTO DO WOD SELECIONADO NA BUSCA */}
                  {quickSelectedWorkoutId && (() => {
                    const targetWod = workouts.find(w => w.id === quickSelectedWorkoutId);
                    if (!targetWod) return null;

                    const regId = quickSelectedTeam.id;
                    const existingScore = scores.find(s => s.workoutId === targetWod.id && s.registrationId === regId);
                    const isHomologated = Boolean(existingScore && existingScore.scoreStatus === 'approved_by_head_judge');
                    const currentState = deskScoresState[regId] || {
                      time: existingScore?.timeFormatted || '04:30',
                      isCap: existingScore ? !existingScore.isCompleted : false,
                      reps: String(existingScore?.repsCount || '0'),
                      weightA: '0',
                      weightB: '0',
                      rounds: existingScore?.roundsCount || 3,
                      tiebreak: existingScore?.tieBreakTimeFormatted || '',
                      photoUrl: existingScore?.photoSumulaUrl || null
                    };

                    const currentPhoto = currentState.photoUrl || existingScore?.photoSumulaUrl;
                    const isWod1A = targetWod.title.includes('1-A') || targetWod.title.toLowerCase().includes('row') || targetWod.title.toLowerCase().includes('remo');
                    const isWod1B = targetWod.title.includes('1-B') || targetWod.title.toLowerCase().includes('death by');
                    const isWod3 = targetWod.title.includes('3') || targetWod.title.toLowerCase().includes('hang clean') || targetWod.title.toLowerCase().includes('lift') || targetWod.type === 'max_load' || targetWod.type === 'complex';

                    return (
                      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                          <span className="text-xs font-black text-amber-400 uppercase tracking-wide">
                            Lançamento para: {targetWod.title}
                          </span>
                          <span className="text-[11px] font-bold text-zinc-400">
                            {isHomologated ? 'Status: Já Homologado (Edição liberada para o Head Judge)' : 'Status: Aguardando Lançamento'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* FOTO OBRIGATÓRIA */}
                          <div className="space-y-2">
                            <label className="text-[11px] font-bold text-zinc-300 uppercase flex items-center justify-between">
                              <span>Foto da Súmula Física Assinada:</span>
                              <span className="text-rose-400 text-[10px]">*Obrigatório</span>
                            </label>
                            {currentPhoto ? (
                              <div className="relative group rounded-xl overflow-hidden border border-emerald-500/40 bg-zinc-950 h-32 flex items-center justify-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={currentPhoto} alt="Súmula" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => setZoomPhotoUrl(currentPhoto)}
                                    className="px-3 py-1.5 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 text-xs font-bold flex items-center gap-1"
                                  >
                                    <ZoomIn className="w-4 h-4 text-amber-400" />
                                    <span>Ampliar</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <label className="border-2 border-dashed border-zinc-700 hover:border-amber-500 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-zinc-950/60 h-32">
                                <Camera className="w-6 h-6 text-amber-400" />
                                <span className="text-xs font-bold text-zinc-300">Fotografar / Anexar Súmula Física</span>
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoUpload(regId, e)} />
                              </label>
                            )}
                          </div>

                          {/* CAMPOS ESPECÍFICOS DO WOD */}
                          <div className="space-y-3 flex flex-col justify-between">
                            {isWod1A && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-amber-400">800m Row:</span>
                                  <label className="flex items-center gap-1 cursor-pointer text-xs">
                                    <input
                                      type="checkbox"
                                      checked={currentState.isCap}
                                      onChange={(e) => handleUpdateDeskField(regId, 'isCap', e.target.checked)}
                                      className="rounded border-zinc-700 text-amber-500"
                                    />
                                    <span className="text-zinc-300 font-bold">Deu TIME CAP (5:00)?</span>
                                  </label>
                                </div>
                                {currentState.isCap ? (
                                  <div>
                                    <label className="text-[11px] text-zinc-400 block mb-1">Metros faltantes:</label>
                                    <input
                                      type="number"
                                      placeholder="Ex: 188"
                                      value={currentState.reps}
                                      onChange={(e) => handleUpdateDeskField(regId, 'reps', e.target.value)}
                                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-xs"
                                    />
                                  </div>
                                ) : (
                                  <div>
                                    <label className="text-[11px] text-zinc-400 block mb-1">Tempo (mm:ss):</label>
                                    <input
                                      type="text"
                                      placeholder="04:32"
                                      value={currentState.time}
                                      onChange={(e) => handleUpdateDeskField(regId, 'time', e.target.value)}
                                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-xs"
                                    />
                                  </div>
                                )}
                              </div>
                            )}

                            {isWod1B && (
                              <div className="space-y-2">
                                <label className="text-[11px] text-zinc-400 block">Rounds Fechados dentro do tempo:</label>
                                <div className="grid grid-cols-5 gap-1.5">
                                  {[1, 2, 3, 4, 5].map(r => (
                                    <button
                                      key={r}
                                      type="button"
                                      onClick={() => handleUpdateDeskField(regId, 'rounds', r)}
                                      className={`py-1.5 rounded-lg text-xs font-black transition-all ${
                                        currentState.rounds === r
                                          ? 'bg-amber-500 text-black shadow-md'
                                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                      }`}
                                    >
                                      {r} R
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {isWod3 && (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[10px] text-zinc-400 block">Atleta A (kg):</label>
                                    <input
                                      type="number"
                                      placeholder="Ex: 75"
                                      value={currentState.weightA}
                                      onChange={(e) => handleUpdateDeskField(regId, 'weightA', e.target.value)}
                                      className="w-full px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-xs"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-zinc-400 block">Atleta B (kg):</label>
                                    <input
                                      type="number"
                                      placeholder="Ex: 60"
                                      value={currentState.weightB}
                                      onChange={(e) => handleUpdateDeskField(regId, 'weightB', e.target.value)}
                                      className="w-full px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-xs"
                                    />
                                  </div>
                                </div>
                                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
                                  <span className="font-bold text-zinc-300">Total da Dupla:</span>
                                  <span className="font-black text-amber-400 text-sm">
                                    {(Number(currentState.weightA) || 0) + (Number(currentState.weightB) || 0)} kg
                                  </span>
                                </div>
                              </div>
                            )}

                            {!isWod1A && !isWod1B && !isWod3 && (
                              <div>
                                <label className="text-[11px] text-zinc-400 block mb-1">Tempo / Resultado:</label>
                                <input
                                  type="text"
                                  placeholder="08:45"
                                  value={currentState.time}
                                  onChange={(e) => handleUpdateDeskField(regId, 'time', e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-xs"
                                />
                              </div>
                            )}

                            <button
                              onClick={() => handleHomologateScore(quickSelectedTeam, 1, 1, targetWod)}
                              disabled={!currentPhoto}
                              className={`w-full py-3.5 min-h-[48px] rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 ${
                                currentPhoto
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-lg shadow-emerald-500/20'
                                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                              }`}
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>{isHomologated ? 'ATUALIZAR HOMOLOGAÇÃO & PLACAR' : 'HOMOLOGAR SÚMULA & ATUALIZAR PLACAR'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* SEGUNDA VISÃO: LANÇAMENTO POR BATERIA EM PISTA */}
            <div className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                  <Filter className="w-4 h-4 text-amber-400" />
                  <span>Visão de Pista por Bateria (Heat):</span>
                </div>
                <div className="text-xs text-zinc-400">
                  Campeonato: <strong className="text-amber-400">{activeGame?.name}</strong>
                </div>
              </div>

              {/* PÍLULAS RÁPIDAS DE CATEGORIA E WOD */}
              {categories.length > 0 && (
                <div className="space-y-2.5 pb-2 border-b border-zinc-800/70">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {categories.map((c) => {
                      const active = c.id === currentCategory?.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCategory(c.id)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-colors min-h-[34px] ${
                            active
                              ? 'bg-amber-500 text-black border-amber-500 shadow-sm shadow-amber-500/20'
                              : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-amber-500/50'
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                  {categoryWorkouts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {categoryWorkouts.map((w, idx) => {
                        const active = w.id === currentWorkout?.id;
                        const { shortTitle, subtitle } = parseWodTitle(w.title, idx);
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setSelectedWorkoutId(w.id)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors min-h-[34px] flex items-center gap-1.5 ${
                              active
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                            }`}
                          >
                            <span className="font-black">{shortTitle}</span>
                            {subtitle && <span className="opacity-75 hidden sm:inline">• {subtitle}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                    1. Categoria
                  </label>
                  <select
                    value={currentCategory?.id || ''}
                    onChange={(e) => handleSelectCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-bold text-xs"
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
                    onChange={(e) => setSelectedWorkoutId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-bold text-xs"
                  >
                    {categoryWorkouts.map(w => (
                      <option key={w.id} value={w.id}>{w.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                    3. Bateria (Heat)
                  </label>
                  <select
                    value={deskHeatNumber}
                    onChange={(e) => setDeskHeatNumber(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-emerald-500/50 text-emerald-400 font-bold text-xs"
                  >
                    {distinctHeats.length > 0 ? (
                      distinctHeats.map(hNum => (
                        <option key={hNum} value={String(hNum)}>BATERIA (HEAT) #{hNum}</option>
                      ))
                    ) : (
                      <option value="1">BATERIA (HEAT) #1</option>
                    )}
                  </select>
                </div>
              </div>

              {/* PROGRESSO DA BATERIA */}
              <div className="pt-2">
                <div className="flex items-center justify-between text-xs font-bold mb-2">
                  <span className="text-zinc-300">
                    Bateria #{deskHeatNumber}: {deskHeatHomologatedCount} de {activeDeskHeatLanes.length} súmulas homologadas com foto
                  </span>
                  <span className="text-emerald-400">
                    {activeDeskHeatLanes.length > 0 ? Math.round((deskHeatHomologatedCount / activeDeskHeatLanes.length) * 100) : 0}% Concluído
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                    style={{
                      width: `${activeDeskHeatLanes.length > 0 ? (deskHeatHomologatedCount / activeDeskHeatLanes.length) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* LISTA DE RAIAS DA BATERIA */}
            <div className="space-y-4">
              {activeDeskHeatLanes.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-zinc-900/60 border border-zinc-800 text-zinc-400 text-xs">
                  Nenhuma equipe encontrada para a Bateria #{deskHeatNumber} nesta categoria.
                </div>
              ) : (
                activeDeskHeatLanes.map((item) => {
                  const team = item.team;
                  const regId = team.id;
                  const existingScore = scores.find(s => s.workoutId === currentWorkout?.id && s.registrationId === regId);
                  const isHomologated = Boolean(existingScore && existingScore.scoreStatus === 'approved_by_head_judge');
                  const currentState = deskScoresState[regId] || {
                    time: existingScore?.timeFormatted || '04:30',
                    isCap: existingScore ? !existingScore.isCompleted : false,
                    reps: String(existingScore?.repsCount || '0'),
                    weightA: '0',
                    weightB: '0',
                    rounds: existingScore?.roundsCount || 3,
                    tiebreak: existingScore?.tieBreakTimeFormatted || '',
                    photoUrl: existingScore?.photoSumulaUrl || null
                  };

                  const currentPhoto = currentState.photoUrl || existingScore?.photoSumulaUrl;
                  const isWod1A = currentWorkout?.title.includes('1-A') || currentWorkout?.title.toLowerCase().includes('row') || currentWorkout?.title.toLowerCase().includes('remo');
                  const isWod1B = currentWorkout?.title.includes('1-B') || currentWorkout?.title.toLowerCase().includes('death by');
                  const isWod3 = currentWorkout?.title.includes('3') || currentWorkout?.title.toLowerCase().includes('hang clean') || currentWorkout?.title.toLowerCase().includes('lift') || currentWorkout?.type === 'max_load' || currentWorkout?.type === 'complex';

                  const teamDisplayName = team.teamName || (team as any).name || 'Equipe';
                  const teamBox = team.athletes?.[0]?.boxOrAffiliate || (team as any).boxOrGym;

                  return (
                    <div
                      key={regId}
                      className={`rounded-2xl border transition-all p-5 ${
                        isHomologated 
                          ? 'bg-zinc-900/90 border-emerald-500/40 shadow-lg shadow-emerald-950/20' 
                          : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

                        {/* COLUNA 1: EQUIPE & RAIA */}
                        <div className="lg:col-span-3 space-y-2 border-b lg:border-b-0 lg:border-r border-zinc-800 pb-4 lg:pb-0 lg:pr-4">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-xs">
                              RAIA #{item.laneNumber}
                            </span>
                            <span className="text-[11px] font-bold text-zinc-400">
                              HEAT #{item.heatNumber}
                            </span>
                          </div>

                          <div>
                            <div className="text-base font-black text-white flex items-center gap-1.5">
                              <span>{teamDisplayName}</span>
                              <span className="text-xs text-amber-400 font-bold">
                                (#{team.registerNumber || team.id})
                              </span>
                            </div>
                            {team.athletes && team.athletes.length > 0 && (
                              <p className="text-xs text-zinc-400 mt-0.5">
                                {team.athletes.map(a => a.name).join(' • ')}
                              </p>
                            )}
                            {teamBox && (
                              <p className="text-[11px] text-zinc-500 font-semibold mt-0.5">
                                Box: {teamBox}
                              </p>
                            )}
                          </div>

                          <div className="pt-2 flex items-center gap-2">
                            {isHomologated ? (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                <span>HOMOLOGADO</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                <span>PENDENTE DE SÚMULA</span>
                              </div>
                            )}

                            {existingScore && (
                              <button
                                onClick={() => handleOpenAppealModal(existingScore)}
                                className="text-[11px] font-bold text-amber-400 hover:underline flex items-center gap-1 ml-auto"
                                title="Abrir revisão técnica ou contestação"
                              >
                                <Scale className="w-3.5 h-3.5" />
                                <span>Recurso</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* COLUNA 2: FOTO DA SÚMULA FÍSICA (OBRIGATÓRIO) */}
                        <div className="lg:col-span-4 space-y-2 border-b lg:border-b-0 lg:border-r border-zinc-800 pb-4 lg:pb-0 lg:pr-4">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1">
                              <Camera className="w-3.5 h-3.5 text-amber-400" />
                              <span>Foto da Súmula Física:</span>
                            </label>
                            <span className="text-[10px] font-black text-rose-400 uppercase">
                              *Obrigatório
                            </span>
                          </div>

                          {currentPhoto ? (
                            <div className="space-y-2">
                              <div className="relative group rounded-xl overflow-hidden border border-emerald-500/40 bg-zinc-950 h-28 flex items-center justify-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={currentPhoto}
                                  alt={`Súmula ${teamDisplayName}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => setZoomPhotoUrl(currentPhoto)}
                                    className="p-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 text-xs font-bold flex items-center gap-1"
                                  >
                                    <ZoomIn className="w-4 h-4 text-amber-400" />
                                    <span>Ampliar</span>
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center justify-between">
                                <button
                                  onClick={() => setZoomPhotoUrl(currentPhoto)}
                                  className="text-[11px] font-bold text-amber-400 hover:underline flex items-center gap-1"
                                >
                                  <ZoomIn className="w-3.5 h-3.5" />
                                  <span>Ver em Tela Cheia (Zoom)</span>
                                </button>

                                <label className="text-[11px] font-bold text-zinc-400 hover:text-white cursor-pointer">
                                  <span>Substituir</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => handlePhotoUpload(regId, e)}
                                  />
                                </label>
                              </div>
                            </div>
                          ) : (
                            <label className="border-2 border-dashed border-zinc-700 hover:border-amber-500/80 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-zinc-950/40 h-28">
                              <Camera className="w-6 h-6 text-amber-400" />
                              <span className="text-xs font-bold text-zinc-300 text-center">
                                Fotografar Súmula Assinada
                              </span>
                              <span className="text-[10px] text-zinc-500">
                                (Câmera do celular ou arquivo JPG/PNG)
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => handlePhotoUpload(regId, e)}
                              />
                            </label>
                          )}
                        </div>

                        {/* COLUNA 3: DIGITAÇÃO ESPECÍFICA & HOMOLOGAÇÃO */}
                        <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
                          {isWod1A && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-amber-400">WOD 1-A (800m Row):</span>
                                <label className="flex items-center gap-1 cursor-pointer text-xs">
                                  <input
                                    type="checkbox"
                                    checked={currentState.isCap}
                                    onChange={(e) => handleUpdateDeskField(regId, 'isCap', e.target.checked)}
                                    className="rounded border-zinc-700 text-amber-500"
                                  />
                                  <span className="text-zinc-300 font-bold">Deu TIME CAP (5:00)?</span>
                                </label>
                              </div>

                              {currentState.isCap ? (
                                <div>
                                  <label className="text-[11px] text-zinc-400 block mb-1">Quantos metros FALTARAM?</label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      placeholder="Ex: 188"
                                      value={currentState.reps}
                                      onChange={(e) => handleUpdateDeskField(regId, 'reps', e.target.value)}
                                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-xs"
                                    />
                                    <span className="text-xs text-zinc-400 font-bold">m</span>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <label className="text-[11px] text-zinc-400 block mb-1">Tempo (mm:ss):</label>
                                  <input
                                    type="text"
                                    placeholder="04:32"
                                    value={currentState.time}
                                    onChange={(e) => handleUpdateDeskField(regId, 'time', e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-xs"
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {isWod1B && (
                            <div className="space-y-2">
                              <span className="text-xs font-bold text-amber-400 block">WOD 1-B (Death By Thrusters + Pull-ups):</span>
                              <div>
                                <label className="text-[11px] text-zinc-400 block mb-1.5">Rounds Fechados dentro do tempo:</label>
                                <div className="grid grid-cols-5 gap-1.5">
                                  {[1, 2, 3, 4, 5].map(r => (
                                    <button
                                      key={r}
                                      type="button"
                                      onClick={() => handleUpdateDeskField(regId, 'rounds', r)}
                                      className={`py-1.5 rounded-lg text-xs font-black transition-all ${
                                        currentState.rounds === r
                                          ? 'bg-amber-500 text-black shadow-md'
                                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                      }`}
                                    >
                                      {r} R
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {isWod3 && (
                            <div className="space-y-2">
                              <span className="text-xs font-bold text-amber-400 block">WOD 3: Maximum Lift:</span>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] text-zinc-400 block mb-1">Atleta A (kg):</label>
                                  <input
                                    type="number"
                                    placeholder="Ex: 75"
                                    value={currentState.weightA}
                                    onChange={(e) => handleUpdateDeskField(regId, 'weightA', e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-zinc-400 block mb-1">Atleta B (kg):</label>
                                  <input
                                    type="number"
                                    placeholder="Ex: 60"
                                    value={currentState.weightB}
                                    onChange={(e) => handleUpdateDeskField(regId, 'weightB', e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-xs"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
                                <span className="text-xs font-bold text-zinc-300">Total da Dupla (A + B):</span>
                                <span className="text-base font-black text-amber-400">
                                  {(Number(currentState.weightA) || 0) + (Number(currentState.weightB) || 0)} kg
                                </span>
                              </div>
                            </div>
                          )}

                          {!isWod1A && !isWod1B && !isWod3 && (
                            <div>
                              <label className="text-[11px] text-zinc-400 block mb-1">Tempo de Conclusão (mm:ss):</label>
                              <input
                                type="text"
                                placeholder="08:45"
                                value={currentState.time}
                                onChange={(e) => handleUpdateDeskField(regId, 'time', e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-xs"
                              />
                            </div>
                          )}

                          <div className="pt-2">
                            {currentPhoto ? (
                              <button
                                onClick={() => handleHomologateScore(team, Number(item.laneNumber), Number(item.heatNumber))}
                                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95"
                              >
                                <CheckCircle className="w-4 h-4" />
                                <span>{isHomologated ? 'RE-HOMOLOGAR SÚMULA & ATUALIZAR' : 'HOMOLOGAR SÚMULA & ATUALIZAR PLACAR'}</span>
                              </button>
                            ) : (
                              <div className="w-full p-2.5 rounded-xl bg-zinc-800/80 border border-amber-500/40 text-amber-300 text-xs font-bold text-center flex items-center justify-center gap-2 cursor-not-allowed">
                                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                <span>Anexe a foto da súmula física para liberar a homologação</span>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* ABA 2: RODAR CLASSIFICAÇÕES, PONTUAÇÃO & DESEMPATE OFICIAL */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {activeTab === 'run_standings' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* PAINEL DE COMANDO PRINCIPAL */}
            <div className="glass-panel rounded-3xl p-5 sm:p-6 border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/20 via-zinc-900 to-zinc-950 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                <div>
                  <div className="inline-flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider">
                    <Zap className="w-4 h-4" />
                    <span>Motor Oficial de Apuração &amp; Ranking</span>
                    {standingsLastRunAt && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-mono">
                        Última rodagem: {standingsLastRunAt}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                    Rodar Classificações por Prova, Categoria ou Geral
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Recalcula colocações, aplica a tabela oficial de pontos, resolve empates pelas melhores colocações sucessivas (e última prova) e publica no Leaderboard e Telão.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => currentCategory && handleRunCategoryStandings(currentCategory.id)}
                    disabled={!currentCategory || runningStandingsKey !== null}
                    className="px-5 py-3 min-h-[48px] rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    <span>
                      {runningStandingsKey === `cat:${currentCategory?.id}`
                        ? 'Calculando Categoria...'
                        : '⚡ Rodar Categoria Selecionada'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRunAllStandings}
                    disabled={categories.length === 0 || runningStandingsKey !== null}
                    className="px-5 py-3 min-h-[48px] rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <Award className="w-4 h-4" />
                    <span>
                      {runningStandingsKey === 'all'
                        ? 'Rodando Campeonato...'
                        : `🚀 Rodar Todas (${categories.length})`}
                    </span>
                  </button>
                </div>
              </div>

              {/* SELETOR DE CATEGORIA + LINKS DE PUBLICAÇÃO */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 max-w-md">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Categoria para Apuração &amp; Conferência:
                  </label>
                  <select
                    value={currentCategory?.id || ''}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white font-bold text-sm focus:outline-none focus:border-emerald-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({teams.filter((t) => t.categoryId === c.id && t.paymentStatus !== 'cancelled').length} equipes)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/leaderboard"
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs border border-zinc-700 flex items-center gap-1.5 min-h-[42px]"
                  >
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>Ver Leaderboard Público</span>
                  </Link>
                  <Link
                    href="/leaderboard/big-screen"
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-xs border border-amber-500/30 flex items-center gap-1.5 min-h-[42px]"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Abrir Telão LED</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* CARDS DE RODAGEM INDIVIDUAL POR WOD */}
            {currentCategory && (
              <div className="space-y-3">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>Apuração Individual por WOD — {currentCategory.name}</span>
                </h3>

                {categoryWorkouts.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400">
                    Nenhum WOD cadastrado para esta categoria ainda.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryWorkouts.map((wod) => {
                      const wodRows = currentStandingsResult?.wodResultsByWorkoutId[wod.id] || [];
                      const scoredCount = wodRows.filter((r) => r.score !== null).length;
                      const totalCount = wodRows.length;
                      const officialCat = officialStatusData?.categories?.find(
                        (c: any) => String(c.id) === String(currentCategory.id),
                      );
                      const officialEv = officialCat?.events?.find(
                        (e: any) => String(e.eventId) === String(wod.id),
                      );
                      const isConfirmedApi = officialEv?.state === 'confirmed';
                      const isRunningThis = runningStandingsKey === `${currentCategory.id}:${wod.id}`;

                      return (
                        <div key={wod.id} className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between gap-4">
                          <div className="space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-amber-400 font-bold">
                                  {wod.type}
                                </span>
                                <h4 className="font-black text-white text-base mt-1">{wod.title}</h4>
                              </div>
                              {isConfirmedApi ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase shrink-0">
                                  Oficial API
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase shrink-0">
                                  {scoredCount}/{totalCount} Súmulas
                                </span>
                              )}
                            </div>

                            {/* TOP 3 DA PROVA */}
                            <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                              {wodRows.slice(0, 3).map((r) => (
                                <div key={r.team.id} className="flex items-center justify-between text-xs bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800/80">
                                  <span className="truncate font-bold text-zinc-200">
                                    <strong className="text-amber-400 mr-1.5">{r.rank}º</strong>
                                    {r.team.teamName}
                                  </span>
                                  <span className="font-mono font-black text-emerald-400 shrink-0 ml-2">
                                    {r.displayValue} ({r.points} pts)
                                  </span>
                                </div>
                              ))}
                              {wodRows.length === 0 && (
                                <p className="text-xs text-zinc-500">Sem equipes inscritas nesta categoria.</p>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRunWodStandings(currentCategory.id, wod.id)}
                            disabled={runningStandingsKey !== null}
                            className="w-full py-3 min-h-[44px] rounded-xl bg-zinc-800 hover:bg-emerald-500 hover:text-black text-emerald-300 border border-emerald-500/40 font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                          >
                            <Zap className="w-4 h-4" />
                            <span>{isRunningThis ? 'Calculando...' : 'Rodar Pontuação deste WOD'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* CLASSIFICAÇÃO GERAL CALCULADA + AUDITORIA DE DESEMPATE */}
            {currentCategory && currentStandingsResult && (
              <div className="glass-panel rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl">
                <div className="p-5 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-zinc-900/60">
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-400" />
                      <span>Classificação Geral Calculada — {currentCategory.name}</span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Desempate automático Summer Games: maior pontuação total → melhores colocações individuais sucessivas → última prova.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/30 self-start sm:self-auto">
                    {currentStandingsResult.ranks.length} equipes classificadas
                  </span>
                </div>

                {/* CARDS RESPONSIVOS MOBILE PARA CONFERÊNCIA RÁPIDA */}
                <div className="p-4 space-y-3 md:hidden">
                  {currentStandingsResult.ranks.map((item) => (
                    <div key={item.registrationId} className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-9 h-9 rounded-xl font-black text-sm flex items-center justify-center shrink-0 ${
                              item.rank === 1
                                ? 'bg-amber-500 text-black'
                                : item.rank === 2
                                  ? 'bg-zinc-300 text-black'
                                  : item.rank === 3
                                    ? 'bg-amber-700 text-white'
                                    : 'bg-zinc-800 text-zinc-300'
                            }`}
                          >
                            {item.rank}º
                          </span>
                          <div className="min-w-0">
                            <div className="font-black text-white text-sm truncate">
                              {item.teamName} <span className="text-amber-400 font-mono text-xs">{item.registerNumber}</span>
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate">{item.athletes.join(', ')}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] text-zinc-500 uppercase font-bold">Total</div>
                          <div className="text-lg font-black font-mono text-amber-400">{item.totalPoints} pts</div>
                        </div>
                      </div>

                      {item.tiebreakNote && (
                        <div className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-[11px] text-blue-300 font-semibold">
                          ⚖️ {item.tiebreakNote}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800">
                        {item.workoutScores.map((ws) => (
                          <div key={ws.workoutId} className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs">
                            <div className="text-[10px] text-zinc-400 font-bold truncate">{ws.workoutTitle}</div>
                            <div className="font-mono font-black text-white mt-0.5">{ws.scoreDisplay}</div>
                            <div className="text-[10px] text-emerald-400 font-bold">
                              {ws.points > 0 ? `${ws.points} pts (${ws.rank}º)` : '-'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* TABELA DESKTOP COMPLETA */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-900/90 text-zinc-400 border-b border-zinc-800 uppercase text-[10px] font-bold">
                        <th className="py-3.5 px-4 text-center w-16">Rank</th>
                        <th className="py-3.5 px-4">Equipe / BIB</th>
                        {currentStandingsResult.workouts.map((w) => (
                          <th key={w.id} className="py-3.5 px-3 text-center">{w.title}</th>
                        ))}
                        <th className="py-3.5 px-4 text-right font-black text-amber-400">Total Oficial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {currentStandingsResult.ranks.map((item) => (
                        <tr key={item.registrationId} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-xl font-black text-xs ${
                                item.rank === 1
                                  ? 'bg-amber-500 text-black'
                                  : item.rank === 2
                                    ? 'bg-zinc-300 text-black'
                                    : item.rank === 3
                                      ? 'bg-amber-700 text-white'
                                      : 'bg-zinc-800 text-zinc-300'
                              }`}
                            >
                              {item.rank}º
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-white">
                              {item.teamName} <span className="text-amber-400 font-mono text-[11px]">({item.registerNumber})</span>
                            </div>
                            <div className="text-[10px] text-zinc-400">{item.athletes.join(', ')}</div>
                            {item.tiebreakNote && (
                              <div className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-[10px] text-blue-300 font-semibold">
                                ⚖️ {item.tiebreakNote}
                              </div>
                            )}
                          </td>
                          {item.workoutScores.map((ws) => (
                            <td key={ws.workoutId} className="py-3 px-3 text-center">
                              <div className="font-mono font-bold text-white">{ws.scoreDisplay}</div>
                              <div className="text-[10px] text-emerald-400 font-bold">
                                {ws.points > 0 ? `${ws.points} pts (${ws.rank}º)` : '-'}
                              </div>
                            </td>
                          ))}
                          <td className="py-3 px-4 text-right font-black text-sm font-mono text-amber-400">
                            {item.totalPoints} pts
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* ABA 2: SÚMULAS A4 & PRESETS (CONTROLE TOTAL) */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {activeTab === 'sumulas_mgmt' && (
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-3xl border border-zinc-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                    <span>Estúdio de Súmulas &amp; Impressão em Lote A4</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Gere súmulas padronizadas para pranchetas de arbitragem com nomes das equipes, raias e baterias.
                  </p>
                </div>
                <Link
                  href="/sumulas"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>ABRIR ESTÚDIO COMPLETO DE SÚMULAS</span>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                  <div className="text-xs font-bold text-amber-400">Súmula Combo A4 (WOD 1-A + 1-B)</div>
                  <p className="text-xs text-zinc-400">Formato oficial unificado para 800m Remo + 5 Rounds Death By em folha única A4.</p>
                  <Link href="/sumulas?templateId=crossfit-wod1-combo-row-deathby" className="text-xs text-amber-400 font-bold hover:underline flex items-center gap-1 pt-1">
                    <span>Imprimir em Lote</span> <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                  <div className="text-xs font-bold text-amber-400">Súmula WOD 3 (Maximum Lift - 10 Tentativas)</div>
                  <p className="text-xs text-zinc-400">Tabela de 10 tentativas com Atleta A, Atleta B e Carga Total da Dupla calculada.</p>
                  <Link href="/sumulas?templateId=crossfit-wod3-maximum-lift" className="text-xs text-amber-400 font-bold hover:underline flex items-center gap-1 pt-1">
                    <span>Imprimir em Lote</span> <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                  <div className="text-xs font-bold text-amber-400">Editor Visual de Presets</div>
                  <p className="text-xs text-zinc-400">Personalize campos, logotipos e padrões de movimento específicos da sua federação.</p>
                  <Link href="/sumulas?tab=template_studio" className="text-xs text-amber-400 font-bold hover:underline flex items-center gap-1 pt-1">
                    <span>Abrir Editor</span> <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* ABA 3: BATERIAS & RAIAS (CONTROLE TOTAL) */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {activeTab === 'heats_mgmt' && (
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-3xl border border-zinc-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-amber-400" />
                    <span>Gestão de Baterias (Heats), Raias &amp; Chamada de Pista</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Controle de largadas, alocação de equipes em raias e verificação de chamada para a área de aquecimento (Marshalling).
                  </p>
                </div>
                <Link
                  href="/heats"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-black text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                >
                  <Activity className="w-4 h-4" />
                  <span>GERENCIAR BATERIAS &amp; RAIAS</span>
                </Link>
              </div>

              {categories.length > 0 && (
                <div className="space-y-2.5 pb-2 border-b border-zinc-800/70">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {categories.map((c) => {
                      const active = c.id === currentCategory?.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCategory(c.id)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-colors min-h-[34px] ${
                            active
                              ? 'bg-amber-500 text-black border-amber-500'
                              : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-amber-500/50'
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                  {categoryWorkouts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {categoryWorkouts.map((w, idx) => {
                        const active = w.id === currentWorkout?.id;
                        const { shortTitle, subtitle } = parseWodTitle(w.title, idx);
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setSelectedWorkoutId(w.id)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors min-h-[34px] flex items-center gap-1.5 ${
                              active
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                            }`}
                          >
                            <span className="font-black">{shortTitle}</span>
                            {subtitle && <span className="opacity-75 hidden sm:inline">• {subtitle}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {distinctHeats.map(hNum => {
                  const heatLanes = allCategoryLanes.filter(l => Number(l.heatNumber) === hNum);
                  return (
                    <div key={hNum} className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-amber-400 text-sm">BATERIA #{hNum}</span>
                        <span className="text-[10px] text-zinc-400 font-bold">{heatLanes.length} Raias</span>
                      </div>
                      <div className="space-y-1 pt-1">
                        {heatLanes.map(lane => (
                          <div key={lane.team.id} className="text-[11px] text-zinc-300 flex items-center justify-between border-b border-zinc-900 pb-1">
                            <span>Raia {lane.laneNumber}: {lane.team.teamName}</span>
                            <span className="text-zinc-500">{lane.team.registerNumber}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* ABA 4: JUÍZES DE PISTA & ESCALA (CONTROLE TOTAL) */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {activeTab === 'judges_staff' && (
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-3xl border border-zinc-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-400" />
                    <span>Quadro, Escala &amp; App de Arbitragem dos Juízes de Pista</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Acompanhamento das pranchetas de arbitragem e acesso direto ao aplicativo de campo dos árbitros.
                  </p>
                </div>
                <Link
                  href="/judge"
                  className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-black text-xs border border-zinc-700 flex items-center gap-2"
                >
                  <Gavel className="w-4 h-4" />
                  <span>ABRIR APP DO JUIZ DE PISTA</span>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(lane => (
                  <div key={lane} className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-black text-xs">
                        RAIA #{lane}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Em Pista
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white">Juiz Oficial - Raia {lane}</div>
                    <div className="text-xs text-zinc-400">
                      Súmulas entregues: <strong className="text-amber-400">100% conformes</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* ABA 5: RECURSOS & RETIFICAÇÕES */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {activeTab === 'appeals' && (
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-3xl border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Scale className="w-5 h-5 text-amber-400" />
                    <span>Mesa de Julgamento de Recursos &amp; Contestações Oficiais</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Análise técnica de pedidos de revisão de pontuação protocolados por atletas ou capitães de equipe.
                  </p>
                </div>
              </div>

              {scores.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400">
                  Nenhum score registrado na base para revisão.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[10px] font-bold text-zinc-400 uppercase bg-zinc-900 border-b border-zinc-800">
                      <tr>
                        <th className="p-3">Equipe / BIB</th>
                        <th className="p-3">WOD</th>
                        <th className="p-3">Resultado Atual</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Foto Súmula</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {scores.map((s) => {
                        const wod = workouts.find(w => w.id === s.workoutId);
                        return (
                          <tr key={s.id} className="hover:bg-zinc-800/40">
                            <td className="p-3 font-bold text-white">
                              {s.teamName} <span className="text-zinc-500 font-normal">({s.registerNumber})</span>
                            </td>
                            <td className="p-3 text-amber-400 font-bold">{wod?.title || s.workoutId}</td>
                            <td className="p-3 font-mono font-bold text-emerald-400">{s.timeFormatted || `${s.repsCount || s.weightLoadedKg} pts`}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                s.scoreStatus === 'approved_by_head_judge'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : s.scoreStatus === 'contested'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse'
                                  : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                              }`}>
                                {s.scoreStatus === 'approved_by_head_judge' ? 'Homologado' : s.scoreStatus === 'contested' ? 'Contestado' : 'Pendente'}
                              </span>
                            </td>
                            <td className="p-3">
                              {s.photoSumulaUrl ? (
                                <button
                                  onClick={() => setZoomPhotoUrl(s.photoSumulaUrl || null)}
                                  className="text-amber-400 hover:underline flex items-center gap-1 font-bold"
                                >
                                  <ZoomIn className="w-3.5 h-3.5" />
                                  <span>Ver Foto</span>
                                </button>
                              ) : (
                                <span className="text-zinc-500">Sem foto</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleOpenAppealModal(s)}
                                className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-bold border border-zinc-700 text-[11px]"
                              >
                                Julgar Recurso / Retificar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* ABA 6: LIVRO DE PENALIDADES */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {activeTab === 'penalties' && (
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-3xl border border-zinc-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Ban className="w-5 h-5 text-rose-400" />
                    <span>Livro Oficial de Penalidades &amp; Sanções Disciplinares</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Histórico de acréscimos de tempo, descontos de repetições por no-rep retroativo e desclassificações.
                  </p>
                </div>

                <button
                  onClick={() => setIsPenaltyModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-black font-black text-xs flex items-center gap-1.5 shrink-0"
                >
                  <Ban className="w-4 h-4" />
                  <span>Nova Penalidade</span>
                </button>
              </div>

              {disqualifiedScores.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400">
                  Nenhuma penalidade registrada nesta competição. Jogo limpo!
                </div>
              ) : (
                <div className="space-y-3">
                  {disqualifiedScores.map(score => {
                    const wod = workouts.find(w => w.id === score.workoutId);
                    return (
                      <div key={score.id} className="p-4 rounded-xl bg-zinc-950 border border-rose-500/30 flex items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-white">{score.teamName}</span>
                            <span className="text-xs text-amber-400">({score.registerNumber})</span>
                            <span className="text-xs text-zinc-400">• WOD: {wod?.title || score.workoutId}</span>
                          </div>
                          <p className="text-xs text-rose-300 font-semibold mt-1">
                            Motivo / Parecer: {score.penaltyNotes || 'Infração disciplinar anotada em súmula'}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          {score.isDisqualified ? (
                            <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-black">
                              DESCLASSIFICADO (D.Q.)
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black">
                              +{score.penaltiesSeconds}s de Penalidade
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* ABA 7: TRILHA DE AUDITORIA GERAL */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {activeTab === 'audit_log' && (
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-3xl border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-amber-400" />
                    <span>Livro de Auditoria Imutável do Head Judge</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Registro com carimbo de tempo de todas as homologações, decisões de recursos e penalidades aplicadas.
                  </p>
                </div>
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400">
                  Nenhum registro de auditoria registrado até o momento.
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-amber-400">{log.action.toUpperCase()}</span>
                          <span className="text-zinc-300 font-semibold">• {log.reason || 'Homologação oficial'}</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          Operador: <strong>{log.changedBy}</strong> ({log.role})
                        </div>
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString('pt-BR')} • {new Date(log.timestamp).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* MODAL DE ZOOM DE FOTO DA SÚMULA (LIGHTBOX EM TELA CHEIA) */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {zoomPhotoUrl && (
          <div 
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setZoomPhotoUrl(null)}
          >
            <div 
              className="relative max-w-4xl max-h-[90vh] w-full bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span>Auditoria Visual de Súmula Física Assinada</span>
                </div>
                <button
                  onClick={() => setZoomPhotoUrl(null)}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 overflow-auto flex items-center justify-center bg-black/40 min-h-[400px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={zoomPhotoUrl}
                  alt="Súmula Ampliada"
                  className="max-h-[75vh] w-auto object-contain rounded-lg shadow-2xl"
                />
              </div>

              <div className="p-3 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
                <span>Verifique a assinatura dos atletas e do juiz antes de homologar.</span>
                <button
                  onClick={() => setZoomPhotoUrl(null)}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs"
                >
                  Fechar Visualização
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* MODAL DE RECURSO / RETIFICAÇÃO DE SCORE */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {isAppealModalOpen && appealScore && (
          <div 
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setIsAppealModalOpen(false)}
          >
            <div 
              className="max-w-lg w-full bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <Scale className="w-5 h-5" />
                  <span>Julgamento de Recurso &amp; Retificação</span>
                </div>
                <button onClick={() => setIsAppealModalOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs space-y-1">
                <div>Equipe: <strong className="text-white">{appealScore.teamName}</strong> ({appealScore.registerNumber})</div>
                <div>Score Atual: <strong className="text-emerald-400">{appealScore.timeFormatted || `${appealScore.repsCount || appealScore.weightLoadedKg} pts`}</strong></div>
                {appealScore.photoSumulaUrl && (
                  <button
                    onClick={() => setZoomPhotoUrl(appealScore.photoSumulaUrl || null)}
                    className="text-amber-400 hover:underline flex items-center gap-1 font-bold pt-1"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>Abrir Foto da Súmula Original</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                    Novo Tempo Retificado (mm:ss) [Opcional]:
                  </label>
                  <input
                    type="text"
                    value={appealNewTime}
                    onChange={(e) => setAppealNewTime(e.target.value)}
                    placeholder="Ex: 04:15"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-bold text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                      Novas Reps / Metros:
                    </label>
                    <input
                      type="number"
                      value={appealNewReps}
                      onChange={(e) => setAppealNewReps(e.target.value)}
                      placeholder="Ex: 15"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                      Nova Carga (kg):
                    </label>
                    <input
                      type="number"
                      value={appealNewWeight}
                      onChange={(e) => setAppealNewWeight(e.target.value)}
                      placeholder="Ex: 135"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-bold text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                    Parecer Técnico do Head Judge (Obrigatório):
                  </label>
                  <textarea
                    rows={3}
                    value={appealDecisionReason}
                    onChange={(e) => setAppealDecisionReason(e.target.value)}
                    placeholder="Ex: Verificado vídeo oficial de pista. Atleta concluiu a última repetição antes do buzzer."
                    className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  onClick={() => handleSaveAppealDecision('reject')}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-rose-400 font-bold text-xs border border-zinc-700"
                >
                  Indeferir (Manter Original)
                </button>
                <button
                  onClick={() => handleSaveAppealDecision('defer')}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-xs shadow-lg shadow-emerald-500/20"
                >
                  Deferir &amp; Retificar Score
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* MODAL DE APLICAÇÃO DE PENALIDADE */}
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {isPenaltyModalOpen && (
          <div 
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setIsPenaltyModalOpen(false)}
          >
            <div 
              className="max-w-md w-full bg-zinc-950 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                  <Ban className="w-5 h-5" />
                  <span>Aplicação de Penalidade Disciplinar</span>
                </div>
                <button onClick={() => setIsPenaltyModalOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-300 block mb-1">Equipe Infratora:</label>
                  <select
                    value={penaltyTeamId}
                    onChange={(e) => setPenaltyTeamId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-bold text-xs"
                  >
                    <option value="">Selecione a equipe...</option>
                    {filteredTeams.map(t => (
                      <option key={t.id} value={t.id}>{t.teamName} ({t.registerNumber})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-300 block mb-1">Workout / Prova:</label>
                  <select
                    value={penaltyWorkoutId}
                    onChange={(e) => setPenaltyWorkoutId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-bold text-xs"
                  >
                    <option value="">Selecione o WOD...</option>
                    {categoryWorkouts.map(w => (
                      <option key={w.id} value={w.id}>{w.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-300 block mb-1">Tipo de Penalidade:</label>
                  <select
                    value={penaltyType}
                    onChange={(e) => setPenaltyType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-bold text-xs"
                  >
                    <option value="seconds">Acréscimo de Tempo (+Segundos)</option>
                    <option value="reps">Desconto de Repetições (No-rep retroativo)</option>
                    <option value="warning">Advertência Formal / Cartão Amarelo</option>
                    <option value="dq">Desclassificação Oficial (D.Q.)</option>
                  </select>
                </div>

                {penaltyType === 'seconds' && (
                  <div>
                    <label className="text-[11px] font-bold text-zinc-300 block mb-1">Segundos a Acrescentar:</label>
                    <input
                      type="number"
                      value={penaltyValue}
                      onChange={(e) => setPenaltyValue(e.target.value)}
                      placeholder="Ex: 10"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-bold text-xs"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-bold text-zinc-300 block mb-1">Motivo / Parecer do Head Judge:</label>
                  <textarea
                    rows={3}
                    value={penaltyReason}
                    onChange={(e) => setPenaltyReason(e.target.value)}
                    placeholder="Ex: Queima de largada (falso início) constatada no buzzer da bateria."
                    className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  onClick={() => setIsPenaltyModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleApplyPenalty}
                  className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-black font-black text-xs shadow-lg shadow-rose-500/20"
                >
                  Confirmar Penalidade
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AclGuard>
  );
}
