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
  Crown
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { GameEvent, Category, WorkoutRule, TeamRegistration, Heat } from '@/types';
import { generateHeatsAndLanes } from '@/lib/heats-generator';
import { calculateOverallLeaderboard } from '@/lib/scoring';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { AclGuard } from '@/components/auth/AclGuard';

export default function HeatsPage() {
  const [activeGame, setActiveGame] = useState<GameEvent | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutRule[]>([]);
  const [teams, setTeams] = useState<TeamRegistration[]>([]);
  const [heats, setHeats] = useState<Heat[]>([]);

  // Filtros
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>('');

  // Configurações do Gerador Automático
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [totalLanes, setTotalLanes] = useState(8);
  const [startHour, setStartHour] = useState('09:00');
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [isFinalSeeding, setIsFinalSeeding] = useState(false);

  // Troca de Raias (Swap)
  const [selectedLaneToSwap, setSelectedLaneToSwap] = useState<{ heatId: string; lane: number; teamName: string } | null>(null);

  useEffect(() => {
    storage.initDefaultsIfEmpty();

    const loadData = () => {
      const activeId = storage.getActiveGameId();
      const game = storage.getGameById(activeId) || storage.getGames()[0];
      setActiveGame(game);

      if (game) {
        const cats = storage.getCategories(game.id);
        const wods = storage.getWorkouts(game.id);
        const tms = storage.getTeams(game.id);
        const hts = storage.getHeats(game.id);

        setCategories(cats);
        setWorkouts(wods);
        setTeams(tms);
        setHeats(hts);

        if (cats.length > 0 && !selectedCategoryId) {
          setSelectedCategoryId(cats[0].id);
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

  const currentCategory = categories.find(c => c.id === selectedCategoryId) || categories[0];
  const currentWorkout = workouts.find(w => w.id === selectedWorkoutId) || workouts[0];

  // Baterias filtradas
  const filteredHeats = heats.filter(
    h => h.gameId === activeGame?.id && 
         h.workoutId === currentWorkout?.id &&
         h.categoryId === currentCategory?.id
  );

  // Times da categoria
  const categoryTeams = teams.filter(t => t.categoryId === currentCategory?.id);

  const handleGenerateHeats = async () => {
    if (!activeGame || !currentWorkout || !currentCategory) return;

    let currentLeaderboard = undefined;
    if (isFinalSeeding) {
      const allScores = storage.getScores(activeGame.id);
      currentLeaderboard = calculateOverallLeaderboard(
        categoryTeams,
        workouts.filter(w => w.categoryId === currentCategory.id),
        allScores,
        activeGame.eventType === 'hyrox'
      );
    }

    const generated = generateHeatsAndLanes({
      gameId: activeGame.id,
      workoutId: currentWorkout.id,
      categoryId: currentCategory.id,
      totalLanes,
      startHour,
      intervalMinutes,
      teams: categoryTeams,
      isFinalSeeding,
      currentLeaderboard
    });

    // Salvar local e tentar sincronizar com a API
    storage.saveHeats(generated);
    setHeats(storage.getHeats(activeGame.id));

    try {
      await apiClient.generateHeats({
        gameCode: activeGame.id,
        categoryId: parseInt(currentCategory.id.replace(/\D/g, '')) || 1,
        workoutCode: parseInt(currentWorkout.id.replace(/\D/g, '')) || 1,
        totalLanes,
        startHour,
        intervalMinutes,
        isFinalSeeding,
      });
    } catch (e) {
      console.log('[Heats] Sincronização offline-first ativa.');
    }

    setIsModalOpen(false);
    toast.success(`${generated.length} baterias geradas com sucesso para ${categoryTeams.length} atletas!`);
  };

  const handleUpdateStatus = async (heatId: string, status: Heat['status']) => {
    storage.updateHeatStatus(heatId, status);
    setHeats(storage.getHeats(activeGame?.id));
    await apiClient.updateHeatStatus(heatId, status);
    toast.success(`Status da bateria atualizado para ${status}!`);
  };

  const handleLaneClickForSwap = (heatId: string, laneNumber: number, teamName: string) => {
    if (!selectedLaneToSwap) {
      setSelectedLaneToSwap({ heatId, lane: laneNumber, teamName });
      toast.info(`Raia ${laneNumber} (${teamName}) selecionada. Clique em outra raia da mesma bateria para trocar.`);
    } else {
      if (selectedLaneToSwap.heatId !== heatId) {
        toast.error('Só é possível trocar raias dentro da mesma bateria!');
        setSelectedLaneToSwap(null);
        return;
      }
      if (selectedLaneToSwap.lane === laneNumber) {
        setSelectedLaneToSwap(null);
        return;
      }

      // Executa a troca nas baterias locais
      const updatedHeats = heats.map(h => {
        if (h.id !== heatId) return h;
        const newAssignments = h.laneAssignments.map(la => {
          if (la.lane === selectedLaneToSwap.lane) {
            return { ...la, lane: laneNumber };
          }
          if (la.lane === laneNumber) {
            return { ...la, lane: selectedLaneToSwap.lane };
          }
          return la;
        });
        newAssignments.sort((a, b) => a.lane - b.lane);
        return { ...h, laneAssignments: newAssignments };
      });

      storage.saveHeats(updatedHeats);
      setHeats(updatedHeats);
      toast.success(`Raias trocadas: Raia ${selectedLaneToSwap.lane} ⇄ Raia ${laneNumber}!`);
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

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs border border-zinc-700 transition-colors"
          >
            <Printer className="w-4 h-4 text-blue-400" />
            <span>Imprimir Quadro</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-transform active:scale-95"
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

      {/* FILTROS DE CATEGORIA E WORKOUT */}
      <div className="glass-panel rounded-2xl p-4 border border-zinc-800 flex flex-wrap items-center gap-4 no-print">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
            Categoria
          </label>
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-medium text-white focus:outline-none focus:border-blue-500"
          >
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
            Workout / Prova
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

        <div className="pt-5 text-xs text-zinc-400 font-medium">
          Total de Atletas: <strong className="text-white">{categoryTeams.length}</strong> | Baterias: <strong className="text-blue-400">{filteredHeats.length}</strong>
        </div>
      </div>

      {/* LISTAGEM DAS BATERIAS E GRID DE RAIAS */}
      {filteredHeats.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-3xl border border-zinc-800 space-y-4">
          <Activity className="w-12 h-12 text-zinc-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">Nenhuma bateria gerada para este workout</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Clique no botão <strong>"Gerar Baterias Automáticas"</strong> para que o sistema distribua os {categoryTeams.length} atletas nas raias da arena.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
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

                  {/* CONTROLE DE STATUS DA BATERIA */}
                  <div className="flex items-center gap-2 no-print">
                    <span className="text-[11px] text-zinc-400 font-semibold">Status:</span>
                    <button
                      onClick={() => handleUpdateStatus(heat.id, 'scheduled')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${heat.status === 'scheduled' ? 'bg-zinc-700 text-white' : 'bg-zinc-800/60 text-zinc-400 hover:text-white'}`}
                    >
                      Agendada
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(heat.id, 'calling')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${heat.status === 'calling' ? 'bg-amber-500 text-black font-bold animate-pulse' : 'bg-zinc-800/60 text-zinc-400 hover:text-white'}`}
                    >
                      Chamando Atletas
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(heat.id, 'in_progress')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${heat.status === 'in_progress' ? 'bg-emerald-500 text-black font-bold' : 'bg-zinc-800/60 text-zinc-400 hover:text-white'}`}
                    >
                      Na Arena
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(heat.id, 'completed')}
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
                          onClick={() => handleLaneClickForSwap(heat.id, lane.lane, lane.teamName)}
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
                <label className="text-zinc-300 font-semibold block mb-1">
                  1. Quantidade de Raias Disponíveis na Arena:
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
                    3. Intervalo (Minutos):
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
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20"
              >
                Confirmar e Gerar Baterias
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </AclGuard>
  );
}

