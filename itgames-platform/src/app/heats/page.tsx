'use client';

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Sparkles, 
  Clock, 
  Users, 
  Tv, 
  Printer, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Sliders,
  Flame,
  ArrowRight,
  ShieldCheck,
  ArrowLeftRight,
  Crown,
  Megaphone
} from 'lucide-react';
import { Category, WorkoutRule, TeamRegistration, Heat } from '@/types';
import { apiClient, ApiError } from '@/lib/api-client';
import { saveLocalArenaSpotlight, HeatCallSpotlight } from '@/lib/screens';
import { useGames } from '@/lib/use-games';
import { mapCategory, mapHeat, mapRegistration, mapWorkout } from '@/lib/arena-data';
import { parseWodTitle, sortWorkoutsNaturally } from '@/lib/board';
import { buildPdfHeatList, downloadSchedulePdf } from '@/lib/heats-pdf';
import { toast } from 'sonner';
import { AclGuard } from '@/components/auth/AclGuard';

export default function HeatsPage() {
  const { activeGame, isLoading: gamesLoading, error: gamesError, role } = useGames();
  // gerar e trocar raias: organizador do campeonato ou super admin (o servidor também valida)
  const canEdit = role === 'SUPER_ADMIN' || role === 'ORGANIZER';

  const gameCode = activeGame?.code ?? '';
  const eventType = activeGame?.eventType;
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  // dados do campeonato ativo; guardam o código a que pertencem para nunca mostrar dados de outro campeonato
  const [data, setData] = useState<{
    game: string;
    categories: Category[];
    workouts: WorkoutRule[];
    teams: TeamRegistration[];
  } | null>(null);
  // erro amarrado ao campeonato em que ocorreu, para não aparecer após trocar de campeonato
  const [dataErrorState, setDataErrorState] = useState<{ game: string; message: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [heatsData, setHeatsData] = useState<{ key: string; heats: Heat[] } | null>(null);

  const fresh = data && data.game === gameCode ? data : null;
  const dataError = dataErrorState && dataErrorState.game === gameCode ? dataErrorState.message : null;
  const isLoadingData = gamesLoading || (!!gameCode && !fresh && !dataError);
  const categories = fresh?.categories ?? [];
  const allWorkouts = fresh?.workouts ?? [];
  const teams = fresh?.teams ?? [];

  // seleção do usuário; os valores efetivos são derivados abaixo (sempre válidos para os dados carregados)
  const [pickedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [pickedWorkoutId, setSelectedWorkoutId] = useState<string>('');
  const currentCategory = categories.find((c) => String(c.id) === String(pickedCategoryId)) || categories[0];
  const selectedCategoryId = currentCategory?.id ?? '';
  const directCatWorkouts = allWorkouts.filter((w) => String(w.categoryId) === String(selectedCategoryId));
  const workouts = sortWorkoutsNaturally(directCatWorkouts.length > 0 ? directCatWorkouts : allWorkouts);
  const currentWorkout = workouts.find((w) => String(w.id) === String(pickedWorkoutId)) || workouts[0];
  const selectedWorkoutId = currentWorkout?.id ?? '';

  // Gerador
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generateScope, setGenerateScope] = useState<'single_wod' | 'category_all_wods' | 'game_all'>('game_all');
  const [totalLanes, setTotalLanes] = useState(8);
  const [startHour, setStartHour] = useState('08:00');
  const [intervalMinutes, setIntervalMinutes] = useState(10);
  const [subWodRestMinutes, setSubWodRestMinutes] = useState(3);
  const [categoryTransitionMinutes, setCategoryTransitionMinutes] = useState(10);
  const [wodTransitionMinutes, setWodTransitionMinutes] = useState(5);
  const [minPerHeat, setMinPerHeat] = useState(3);
  const [isFinalSeeding, setIsFinalSeeding] = useState(false);

  // Troca de Raias (Swap)
  const [selectedLaneToSwap, setSelectedLaneToSwap] = useState<{
    heatId: string;
    lane: number;
    teamName: string;
    slotId?: string;
  } | null>(null);

  // Categorias, WODs e inscrições do campeonato ativo. O juiz não pode listar inscrições (403): as equipes dele
  // vêm das baterias.
  useEffect(() => {
    if (!gameCode) return;
    let cancelled = false;
    Promise.all([
      apiClient.listCategories(gameCode),
      apiClient.listWorkouts(gameCode),
      canEdit ? apiClient.listRegistrations(gameCode) : Promise.resolve([] as any[]),
    ])
      .then(([cats, wods, regs]) => {
        if (cancelled) return;
        if (!cats || !wods || !regs) {
          setDataErrorState({
            game: gameCode,
            message: 'Não foi possível carregar as categorias, os WODs e as inscrições deste campeonato.',
          });
          return;
        }
        setDataErrorState(null);
        const categoryList = cats.map((c) => mapCategory(c, gameCode, eventType));
        const nameById = new Map(categoryList.map((c) => [c.id, c.name]));
        setData({
          game: gameCode,
          categories: categoryList,
          workouts: wods.map((w) => mapWorkout(w, gameCode)),
          teams: regs
            .filter((r) => r.status !== 'cancelled')
            .map((r) => mapRegistration(r, gameCode, nameById.get(String(r.categoryId)))),
        });
      })
      .catch(() => {
        if (!cancelled) setDataErrorState({ game: gameCode, message: 'Não foi possível carregar os dados deste campeonato.' });
      });
    return () => {
      cancelled = true;
    };
  }, [gameCode, eventType, canEdit, reloadKey]);

  // Baterias do WOD selecionado
  const heatsKey = currentWorkout ? `${gameCode}:${currentWorkout.id}:${reloadKey}` : '';
  useEffect(() => {
    if (!gameCode || !selectedWorkoutId) return;
    let cancelled = false;
    const key = `${gameCode}:${selectedWorkoutId}:${reloadKey}`;
    apiClient
      .fetchHeats(gameCode, Number(selectedWorkoutId))
      .then((list) => {
        if (!cancelled) setHeatsData({ key, heats: list.map((h) => mapHeat(h, gameCode)) });
      })
      .catch((err) => {
        if (cancelled) return;
        setHeatsData({ key, heats: [] });
        toast.error(err instanceof ApiError ? err.message : 'Não foi possível carregar as baterias.');
      });
    return () => {
      cancelled = true;
    };
  }, [gameCode, selectedWorkoutId, reloadKey]);

  const heats = heatsData && heatsData.key === heatsKey ? heatsData.heats : [];
  const isLoadingHeats = !!currentWorkout && !(heatsData && heatsData.key === heatsKey);

  // Equipes inscritas nesta categoria
  const enrolledCategoryTeams = teams.filter((t) => String(t.categoryId) === String(selectedCategoryId));

  // Baterias filtradas do banco; se ainda não houver bateria persistida para esta categoria mas houver equipes inscritas,
  // monta baterias automáticas da categoria para visualização e chamada imediata no telão
  const dbFilteredHeats = heats.filter((h) => String(h.categoryId) === String(selectedCategoryId));
  const filteredHeats: Heat[] =
    dbFilteredHeats.length > 0
      ? dbFilteredHeats
      : enrolledCategoryTeams.length > 0 && currentWorkout
        ? (() => {
            const perHeat = activeGame?.lanesCount && activeGame.lanesCount > 0 ? activeGame.lanesCount : 4;
            const count = Math.ceil(enrolledCategoryTeams.length / perHeat);
            return Array.from({ length: count }, (_, idx) => {
              const slice = enrolledCategoryTeams.slice(idx * perHeat, (idx + 1) * perHeat);
              const totalMins = 9 * 60 + idx * 15;
              const startTime = `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`;
              return {
                id: `virtual_${selectedCategoryId}_${currentWorkout.id}_${idx + 1}`,
                gameId: gameCode,
                workoutId: currentWorkout.id,
                categoryId: selectedCategoryId,
                heatNumber: idx + 1,
                startTime,
                status: 'scheduled' as const,
                laneAssignments: slice.map((team, lIdx) => ({
                  slotId: undefined,
                  lane: lIdx + 1,
                  registrationId: team.id,
                  teamName: team.teamName,
                  registerNumber: team.registerNumber,
                  athletes: (team.athletes || []).map((a) => a.name),
                })),
              };
            });
          })()
        : [];

  // Equipes da categoria: organizador vê as inscritas; juiz conta as que já estão em baterias
  const categoryTeams: unknown[] = canEdit
    ? enrolledCategoryTeams
    : filteredHeats.flatMap((h) => h.laneAssignments);

  const handleExportSchedulePdf = async () => {
    if (!activeGame || allWorkouts.length === 0 || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const lists = await Promise.all(
        allWorkouts.map((w) =>
          apiClient
            .fetchHeats(activeGame.code, Number(w.id))
            .then((list) => list.map((h) => mapHeat(h, activeGame.code)))
            .catch(() => [] as Heat[]),
        ),
      );
      const allHeats = lists.flat();
      if (allHeats.length === 0) {
        toast.error('Nenhuma bateria gerada ainda para exportar.');
        return;
      }
      const pdfRows = buildPdfHeatList(allHeats, categories, allWorkouts);
      downloadSchedulePdf(activeGame.name, activeGame.code, pdfRows);
      toast.success(`PDF gerado com ${pdfRows.length} baterias por horário e raia!`);
    } catch {
      toast.error('Não foi possível gerar o PDF do cronograma.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const openGenerator = () => {
    if (!canEdit) {
      toast.error('Apenas o organizador do campeonato pode gerar baterias.');
      return;
    }
    if (activeGame?.lanesCount && activeGame.lanesCount > 0) {
      setTotalLanes(activeGame.lanesCount);
    }
    setIsModalOpen(true);
  };

  const addMinutesToHour = (baseTime: string, addMinutes: number): string => {
    const [hStr, mStr] = (baseTime || '09:00').split(':');
    const total = (Number(hStr) || 9) * 60 + (Number(mStr) || 0) + addMinutes;
    const norm = ((total % 1440) + 1440) % 1440;
    const hh = String(Math.floor(norm / 60)).padStart(2, '0');
    const mm = String(norm % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const handleGenerateHeats = async () => {
    if (isGenerating || !activeGame) return;
    if (generateScope === 'single_wod' && (!currentWorkout || !currentCategory)) return;
    if (generateScope === 'category_all_wods' && (!currentCategory || workouts.length === 0)) return;
    if (generateScope === 'game_all' && (categories.length === 0 || allWorkouts.length === 0)) return;

    setIsGenerating(true);
    try {
      if (generateScope === 'single_wod' && currentCategory && currentWorkout) {
        const res = await apiClient.generateHeats({
          gameCode: activeGame.code,
          categoryId: Number(currentCategory.id),
          workoutCode: Number(currentWorkout.id),
          totalLanes,
          startHour,
          intervalMinutes,
          isFinalSeeding,
        });
        if (!res?.success) {
          toast.error(res?.message || 'Não foi possível gerar as baterias.');
          return;
        }
        setIsModalOpen(false);
        reload();
        toast.success(`${res.totalHeats} baterias geradas com sucesso para ${categoryTeams.length} equipes!`);
      } else {
        const res = await apiClient.generateHeatSchedule({
          gameCode: activeGame.code,
          totalLanes,
          startHour,
          intervalMinutes,
          subWodRestMinutes,
          categoryTransitionMinutes,
          wodTransitionMinutes,
          minPerHeat,
          categoryId: generateScope === 'category_all_wods' && currentCategory ? Number(currentCategory.id) : undefined,
          isFinalSeeding,
        });
        if (!res?.success) {
          toast.error(res?.message || 'Não foi possível gerar o cronograma de baterias.');
          return;
        }
        setIsModalOpen(false);
        reload();
        toast.success(
          `${res.totalHeats} baterias geradas em ${res.totalWorkouts} WOD(s) (término estimado: ${res.endTimeEstimated})!`,
        );
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível gerar as baterias.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBroadcastHeatToTv = async (heat: Heat) => {
    if (!activeGame) return;
    const catNum = Number(String(currentCategory?.id ?? heat.categoryId).replace(/\D/g, '')) || 1;
    const wodNum = Number(String(currentWorkout?.id ?? heat.workoutId).replace(/\D/g, '')) || 1;
    const lanes = heat.laneAssignments.map((l) => ({
      laneNumber: Number(l.lane),
      teamCode: Number(String(l.registrationId).replace(/\D/g, '')) || Number(l.lane),
      teamName: l.teamName,
      number: l.registerNumber || `#${l.registrationId}`,
      athletes: l.athletes || [],
    }));
    const localSpot: HeatCallSpotlight = {
      kind: 'heat_call',
      gameCode: activeGame.code,
      gameName: activeGame.name,
      categoryId: catNum,
      categoryName: currentCategory?.name || 'Categoria',
      workoutCode: wodNum,
      workoutTitle: currentWorkout?.title || 'WOD',
      heatNumber: Number(heat.heatNumber) || 1,
      totalHeats: Math.max(1, filteredHeats.length),
      startTime: heat.startTime || '09:00',
      message: 'ATLETAS DA BATERIA, DIRIJAM-SE ÀS SUAS RAIAS DE LARGADA',
      lanes,
      triggeredAt: new Date().toISOString(),
    };
    saveLocalArenaSpotlight(localSpot);
    try {
      const res = await apiClient.triggerScreenSpotlight({
        kind: 'heat_call',
        gameCode: activeGame.code,
        categoryId: catNum,
        workoutCode: wodNum,
        heatNumber: Number(heat.heatNumber) || 1,
        message: localSpot.message,
        lanes,
      });
      if (res?.spotlight) saveLocalArenaSpotlight(res.spotlight);
    } catch {
      // sincronizado localmente para Telão Web
    }
    toast.success(`📢 Bateria #${heat.heatNumber} (${currentCategory?.name}) transmitida para os Telões!`);
  };

  const handleUpdateStatus = async (heatId: string, status: Heat['status'], heatObj?: Heat) => {
    try {
      if (status === 'calling' && heatObj) {
        await handleBroadcastHeatToTv(heatObj);
      }
      if (!String(heatId).startsWith('virtual_')) {
        await apiClient.updateHeatStatus(heatId, status);
        reload();
      }
      toast.success(`Status da bateria atualizado para ${status}!`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível atualizar o status da bateria.');
    }
  };

  const handleLaneClickForSwap = async (heatId: string, laneNumber: number, teamName: string, slotId?: string) => {
    if (!canEdit) {
      toast.error('Apenas o organizador do campeonato pode trocar raias.');
      return;
    }
    if (!selectedLaneToSwap) {
      setSelectedLaneToSwap({ heatId, lane: laneNumber, teamName, slotId });
      toast.info(`Raia ${laneNumber} (${teamName}) selecionada. Clique em outra raia da mesma bateria para trocar.`);
      return;
    }
    if (selectedLaneToSwap.heatId !== heatId) {
      toast.error('Só é possível trocar raias dentro da mesma bateria!');
      setSelectedLaneToSwap(null);
      return;
    }
    if (selectedLaneToSwap.lane === laneNumber) {
      setSelectedLaneToSwap(null);
      return;
    }
    if (!selectedLaneToSwap.slotId || !slotId) {
      toast.error('Não foi possível identificar as raias. Recarregue a página.');
      setSelectedLaneToSwap(null);
      return;
    }

    const from = selectedLaneToSwap.lane;
    try {
      await apiClient.swapLanes(selectedLaneToSwap.slotId, slotId);
      reload();
      toast.success(`Raias trocadas: Raia ${from} ⇄ Raia ${laneNumber}!`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível trocar as raias.');
    } finally {
      setSelectedLaneToSwap(null);
    }
  };

  return (
    <AclGuard resource="heats" requiredRoleLabel="Organizadores e Árbitros">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6 no-print">
        <div>
          <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
            <Activity className="w-4 h-4" />
            <span>Cronograma de Arena & Raias</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
            Gestão de Baterias (Heats & Lanes)
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Distribuição automática em raias, alocação de horários, chamadas de concentração e seeding dinâmico da final.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
          <button
            onClick={handleExportSchedulePdf}
            disabled={isExportingPdf || allWorkouts.length === 0}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-semibold text-xs border border-emerald-500/40 transition-colors disabled:opacity-50"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>{isExportingPdf ? 'Gerando PDF...' : 'Baixar Cronograma PDF'}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs border border-zinc-700 transition-colors"
          >
            <Printer className="w-4 h-4 text-blue-400" />
            <span>Imprimir Quadro</span>
          </button>

          <button
            onClick={openGenerator}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-transform active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>GERAR BATERIAS AUTOMÁTICAS</span>
          </button>
        </div>
      </div>

      {/* BARRA DE AVISO DE SWAP SELECIONADO */}
      {selectedLaneToSwap && (
        <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl flex items-center justify-between gap-3 text-amber-300 text-xs animate-pulse">
          <div className="flex items-center gap-2 font-bold">
            <ArrowLeftRight className="w-4 h-4" />
            <span>Modo Troca de Raia Ativo: Raia {selectedLaneToSwap.lane} ({selectedLaneToSwap.teamName}) selecionada.</span>
          </div>
          <button
            onClick={() => setSelectedLaneToSwap(null)}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-lg font-semibold"
          >
            Cancelar Troca
          </button>
        </div>
      )}

      {/* ESTADOS: sem campeonato, erro ou dados incompletos */}
      {!gamesLoading && !activeGame && (
        <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 no-print">
          {gamesError || 'Nenhum campeonato disponível.'}
        </div>
      )}
      {dataError && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/40 text-sm text-red-300 no-print flex items-center justify-between gap-3">
          <span>{dataError}</span>
          <button onClick={reload} className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold">
            Tentar de novo
          </button>
        </div>
      )}
      {activeGame && !dataError && fresh && categories.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-200 no-print">
          Este campeonato ainda não tem categorias cadastradas.
        </div>
      )}
      {activeGame && !dataError && fresh && categories.length > 0 && workouts.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-200 no-print">
          Esta categoria ainda não tem WODs cadastrados.
        </div>
      )}

      {/* FILTROS FLUIDOS POR CATEGORIA E WORKOUT */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-zinc-800 space-y-4 no-print">
        {/* Nível 1: Abas rápidas de Categoria */}
        {categories.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                1. Categoria
              </span>
              <span className="text-xs text-zinc-400 font-medium">
                Equipes: <strong className="text-white">{categoryTeams.length}</strong> | Baterias: <strong className="text-blue-400">{filteredHeats.length}</strong>
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
              {categories.map((cat) => {
                const isCatActive = cat.id === selectedCategoryId;
                const directCount = allWorkouts.filter((w) => String(w.categoryId) === String(cat.id)).length;
                const catWodCount = directCount > 0 ? directCount : allWorkouts.length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(cat.id);
                      setSelectedWorkoutId('');
                    }}
                    className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors min-h-[40px] flex items-center gap-2 ${
                      isCatActive
                        ? 'bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-500/20'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-blue-500/60'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                        isCatActive ? 'bg-black/25 text-white' : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {catWodCount} WODs
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Nível 2: Pílulas rápidas de WOD da Categoria Selecionada */}
        {workouts.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
              2. Prova / WOD ({currentCategory?.name})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {workouts.map((wod, idx) => {
                const isWodActive = wod.id === selectedWorkoutId;
                const { shortTitle, subtitle } = parseWodTitle(wod.title, idx);
                return (
                  <button
                    key={wod.id}
                    type="button"
                    onClick={() => setSelectedWorkoutId(wod.id)}
                    className={`p-2.5 rounded-xl text-left border transition-all min-h-[54px] flex flex-col justify-center ${
                      isWodActive
                        ? 'bg-amber-500 text-black border-amber-500 shadow-sm'
                        : 'bg-zinc-900 text-zinc-200 border-zinc-800 hover:border-amber-500/50'
                    }`}
                  >
                    <span className="text-xs font-black">{shortTitle}</span>
                    <span className={`text-[11px] font-semibold truncate ${isWodActive ? 'text-black/80' : 'text-zinc-400'}`}>
                      {subtitle || wod.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Fallback selects acessíveis */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-zinc-800/70">
          <div>
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
              Seleção direta — Categoria
            </label>
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setSelectedWorkoutId('');
              }}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-medium text-white focus:outline-none focus:border-blue-500"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
              Seleção direta — Workout / Prova
            </label>
            <select
              value={selectedWorkoutId}
              onChange={(e) => setSelectedWorkoutId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-medium text-white focus:outline-none focus:border-blue-500"
            >
              {workouts.map(wod => (
                <option key={wod.id} value={wod.id}>{wod.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* LISTAGEM DAS BATERIAS E GRID DE RAIAS */}
      {isLoadingData ? (
        <div className="text-center py-16 text-sm text-zinc-400">Carregando...</div>
      ) : !currentWorkout ? null : isLoadingHeats ? (
        <div className="text-center py-16 text-sm text-zinc-400">Carregando baterias...</div>
      ) : filteredHeats.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-3xl border border-zinc-800 space-y-4">
          <Activity className="w-12 h-12 text-zinc-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">Nenhuma bateria gerada para este workout</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Clique no botão <strong>"Gerar Baterias Automáticas"</strong> para que o sistema distribua os {categoryTeams.length} atletas nas raias da arena.
          </p>
          <button
            onClick={openGenerator}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
          >
            Configurar e Gerar Baterias
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredHeats.map((heat) => {
            const isLastHeat = heat.heatNumber === filteredHeats.length;
            return (
              <div 
                key={heat.id}
                className={`glass-panel rounded-2xl border overflow-hidden shadow-xl ${isLastHeat ? 'border-amber-500/40 bg-gradient-to-b from-amber-500/5 to-transparent' : 'border-zinc-800'}`}
              >
                {/* TOPO DA BATERIA */}
                <div className="p-4 sm:p-5 bg-zinc-900/90 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl font-black text-lg flex items-center justify-center border ${isLastHeat ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-lg shadow-amber-500/10' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>
                      #{heat.heatNumber}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        Bateria {heat.heatNumber} • {currentWorkout?.title}
                        {isLastHeat && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-300 font-black px-2 py-0.5 rounded-full border border-amber-500/30">
                            <Crown className="w-3 h-3 text-amber-400" />
                            BATERIA PRINCIPAL / FINAL
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          Horário: <strong className="text-white">{heat.startTime}</strong>
                        </span>
                        <span>•</span>
                        <span>{heat.laneAssignments.length} Raias Ocupadas</span>
                      </div>
                    </div>
                  </div>

                  {/* CONTROLE DE STATUS DA BATERIA + CHAMADA NO TELÃO */}
                  <div className="flex flex-wrap items-center gap-2 no-print">
                    <button
                      type="button"
                      onClick={() => handleBroadcastHeatToTv(heat)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-black shadow-md shadow-amber-500/20"
                      title="Transmitir chamada desta bateria com as raias e atletas nos telões Firestick e Telão Web"
                    >
                      <Megaphone className="w-3.5 h-3.5" />
                      <span>📢 Chamar no Telão</span>
                    </button>
                    <span className="text-[11px] text-zinc-400 font-semibold ml-1">Status:</span>
                    <button
                      onClick={() => handleUpdateStatus(heat.id, 'scheduled', heat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${heat.status === 'scheduled' ? 'bg-zinc-700 text-white' : 'bg-zinc-800/60 text-zinc-400 hover:text-white'}`}
                    >
                      Agendada
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(heat.id, 'calling', heat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${heat.status === 'calling' ? 'bg-amber-500 text-black font-bold animate-pulse' : 'bg-zinc-800/60 text-zinc-400 hover:text-white'}`}
                    >
                      Chamando Atletas
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(heat.id, 'in_progress', heat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${heat.status === 'in_progress' ? 'bg-emerald-500 text-black font-bold' : 'bg-zinc-800/60 text-zinc-400 hover:text-white'}`}
                    >
                      Na Arena
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(heat.id, 'completed', heat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${heat.status === 'completed' ? 'bg-purple-600 text-white' : 'bg-zinc-800/60 text-zinc-400 hover:text-white'}`}
                    >
                      Concluída
                    </button>
                  </div>
                </div>

                {/* GRID DE RAIAS */}
                <div className="p-4 sm:p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {heat.laneAssignments.map((lane) => {
                      const isCenterLane = isLastHeat && (lane.lane === 4 || lane.lane === 5 || lane.lane === 3 || lane.lane === 6);
                      const isSelected = selectedLaneToSwap?.heatId === heat.id && selectedLaneToSwap?.lane === lane.lane;

                      return (
                        <div 
                          key={lane.lane}
                          onClick={() => handleLaneClickForSwap(heat.id, lane.lane, lane.teamName, lane.slotId)}
                          className={`p-3.5 rounded-xl border flex items-start justify-between gap-2 cursor-pointer transition-all duration-200 ${
                            isSelected 
                              ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400' 
                              : isCenterLane
                              ? 'bg-zinc-950/80 border-amber-500/30 hover:border-amber-400/60'
                              : 'bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center border ${
                                isCenterLane 
                                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' 
                                  : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                              }`}>
                                R{lane.lane}
                              </span>
                              <span className="text-[11px] font-bold text-amber-400">
                                {lane.registerNumber}
                              </span>
                              {isCenterLane && (
                                <span className="text-[9px] font-bold bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">
                                  Raia Nobre
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-bold text-white truncate max-w-[170px]">
                              {lane.teamName}
                            </div>
                            <div className="text-[10px] text-zinc-400 truncate max-w-[170px]">
                              {lane.athletes.join(', ')}
                            </div>
                          </div>

                          <button 
                            title="Clique para trocar de raia" 
                            className="text-zinc-600 hover:text-amber-400 p-1 no-print transition-colors"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CONFIGURAÇÃO DO GERADOR AUTOMÁTICO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2 text-blue-400">
                <Sparkles className="w-5 h-5" />
                <h3 className="text-lg font-bold text-white">Gerador de Baterias e Raias</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-300 font-semibold block mb-1.5">
                  Escopo da Geração Automática:
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setGenerateScope('category_all_wods')}
                    className={`p-2.5 rounded-xl border text-left transition-colors flex items-center justify-between ${
                      generateScope === 'category_all_wods'
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                    }`}
                  >
                    <div>
                      <div className="font-bold">Toda a Categoria Atual ({currentCategory?.name})</div>
                      <div className="text-[11px] text-zinc-400">
                        Gera baterias em sequência para todos os {workouts.length} WODs desta categoria
                      </div>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                      Recomendado
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGenerateScope('game_all')}
                    className={`p-2.5 rounded-xl border text-left transition-colors flex items-center justify-between ${
                      generateScope === 'game_all'
                        ? 'bg-amber-500/20 border-amber-500 text-white'
                        : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                    }`}
                  >
                    <div>
                      <div className="font-bold">Campeonato Inteiro ({categories.length} categorias)</div>
                      <div className="text-[11px] text-zinc-400">
                        Distribui todas as categorias em {allWorkouts.length} provas com cronograma contínuo
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGenerateScope('single_wod')}
                    className={`p-2.5 rounded-xl border text-left transition-colors ${
                      generateScope === 'single_wod'
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:border-zinc-600'
                    }`}
                  >
                    <div className="font-bold">Apenas este WOD ({currentWorkout?.title || 'WOD atual'})</div>
                    <div className="text-[11px] text-zinc-400">
                      Regera somente a prova atualmente selecionada acima
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">
                    1. Máximo de Raias na Arena:
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="30"
                    value={totalLanes}
                    onChange={(e) => setTotalLanes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">
                    Mínimo por Bateria:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={minPerHeat}
                    onChange={(e) => setMinPerHeat(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">
                    2. Horário da 1ª Bateria:
                  </label>
                  <input
                    type="time"
                    value={startHour}
                    onChange={(e) => setStartHour(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">
                    3. Intervalo entre Baterias (Min):
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-300 font-semibold block mb-1">
                  4. Descanso entre Sub-Provas (1.1 → 1.2 → 1.3) em Minutos:
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={subWodRestMinutes}
                  onChange={(e) => setSubWodRestMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">
                    5. Transição entre Categorias (Min):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={categoryTransitionMinutes}
                    onChange={(e) => setCategoryTransitionMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-zinc-300 font-semibold block mb-1">
                    6. Transição entre WODs (Min):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={wodTransitionMinutes}
                    onChange={(e) => setWodTransitionMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-white font-bold"
                  />
                </div>
              </div>

              {/* OPÇÃO DE SEEDING DE FINAL */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="finalSeeding"
                  checked={isFinalSeeding}
                  onChange={(e) => setIsFinalSeeding(e.target.checked)}
                  className="mt-1 rounded accent-amber-500"
                />
                <label htmlFor="finalSeeding" className="cursor-pointer">
                  <span className="font-bold text-amber-400 block">Seeding Especial de Final (Bateria Principal)</span>
                  <span className="text-[11px] text-zinc-300">
                    Aloca os atletas melhores colocados no ranking geral na última bateria e nas raias centrais da arena.
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerateHeats}
                disabled={isGenerating}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isGenerating ? 'Gerando...' : 'Confirmar e Gerar Baterias'}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </AclGuard>
  );
}

