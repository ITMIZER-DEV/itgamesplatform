'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Flame,
  Maximize2,
  Pause,
  Play,
  ArrowLeft,
  Clock,
  Sparkles,
  Medal,
  Lock,
  Megaphone,
  Crown,
  X,
} from 'lucide-react';
import { useBoard } from '@/lib/use-board';
import { toLeaderboardRanks, parseWodTitle, type BoardResponse } from '@/lib/board';
import { LeaderboardRank } from '@/types';
import confetti from 'canvas-confetti';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { storage } from '@/lib/storage';
import { computeCategoryStandings } from '@/lib/standings-engine';
import {
  FrozenCategorySummary,
  ScreenSpotlight,
  getLocalArenaSpotlight,
  getLocalFrozenCategories,
  saveLocalArenaSpotlight,
} from '@/lib/screens';

export default function BigScreenLeaderboardPage() {
  const { board } = useBoard(15000);
  const activeGame = board?.game ?? null;
  const categories = board?.categories ?? [];

  const [currentCategoryIndex, setCurrentCategoryIndex] = useState<number>(0);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [frozenCategoriesMap, setFrozenCategoriesMap] = useState<Record<string, FrozenCategorySummary>>({});
  const [spotlight, setSpotlight] = useState<ScreenSpotlight | null>(null);
  const [localCategories, setLocalCategories] = useState<BoardResponse['categories']>([]);

  // Detecção em tempo real de bloqueio/congelamento do Leaderboard e Spotlight (Chamada de Raias / Pódio)
  useEffect(() => {
    const checkFreeze = () => {
      const gCode = activeGame?.code || 'SUMMER2026';
      const localFreeze =
        localStorage.getItem('itgames_leaderboard_frozen') === 'true' ||
        localStorage.getItem('itgames_freeze_leaderboard') === 'true' ||
        localStorage.getItem('itgames_freeze_leaderboard_SUMMER2026') === 'true' ||
        (gCode ? localStorage.getItem(`itgames_freeze_leaderboard_${gCode}`) === 'true' : false);
      const apiFreeze =
        (activeGame?.status as string) === 'frozen' ||
        (activeGame?.status as string) === 'blocked';
      setIsFrozen(Boolean(localFreeze || apiFreeze));
      setFrozenCategoriesMap(getLocalFrozenCategories(gCode));
      setSpotlight(getLocalArenaSpotlight());
    };

    checkFreeze();
    window.addEventListener('storage', checkFreeze);
    window.addEventListener('itgames_freeze_changed', checkFreeze);
    window.addEventListener('itgames_spotlight_changed', checkFreeze);

    const interval = setInterval(checkFreeze, 1000);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('itgames_freeze_channel');
      bc.onmessage = (ev) => {
        if (ev.data && typeof ev.data.frozen === 'boolean') {
          setIsFrozen(ev.data.frozen);
        }
        if (ev.data?.frozenCategories) {
          setFrozenCategoriesMap(ev.data.frozenCategories);
        }
        if (ev.data?.spotlightUpdated) {
          setSpotlight(ev.data.spotlight ?? null);
        }
        if (ev.data?.standingsUpdated) {
          window.dispatchEvent(new Event('itgames_standings_updated'));
        }
      };
    } catch {
      // BroadcastChannel opcional
    }

    return () => {
      window.removeEventListener('storage', checkFreeze);
      window.removeEventListener('itgames_freeze_changed', checkFreeze);
      window.removeEventListener('itgames_spotlight_changed', checkFreeze);
      clearInterval(interval);
      if (bc) bc.close();
    };
  }, [activeGame]);

  // Auto-advance no Pódio quando configurado com suspense automático
  useEffect(() => {
    if (spotlight?.kind === 'podium' && spotlight.autoAdvance && spotlight.revealStep < 3) {
      const t = setTimeout(() => {
        const next: ScreenSpotlight = {
          ...spotlight,
          revealStep: Math.min(3, spotlight.revealStep + 1),
        };
        saveLocalArenaSpotlight(next);
        setSpotlight(next);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [spotlight]);

  // Fallback inteligente para categorias locais usando o motor oficial de desempate e pontuação
  useEffect(() => {
    const syncLocal = () => {
      storage.initDefaultsIfEmpty();
      const gCode = activeGame?.code || storage.getActiveGameId() || 'SUMMER2026';
      const cats = storage.getCategories(gCode);
      const teams = storage.getTeams(gCode);
      const wods = storage.getWorkouts(gCode);
      const scores = storage.getScores(gCode);

      if (cats.length > 0 && teams.length > 0) {
        const formatted: BoardResponse['categories'] = cats.map((c) => {
          const res = computeCategoryStandings(c, teams, wods, scores);
          return {
            id: Number(String(c.id).replace(/\D/g, '')) || 1,
            name: c.name,
            wodTitles: res.workouts.map((w) => w.title),
            rows: res.ranks.map((r) => ({
              rank: r.rank,
              teamCode: Number(String(r.registrationId).replace(/\D/g, '')) || r.rank,
              team: r.teamName,
              number: r.registerNumber,
              athletes: r.athletes,
              status: r.status === 'cancelled' ? 'cancelled' : 'active',
              totalPoints: r.totalPoints,
              totalDisplay: String(r.totalPoints),
              wods: r.workoutScores.map((ws) => ({
                title: ws.workoutTitle,
                display: ws.scoreDisplay,
                rank: ws.rank,
                points: ws.points,
                status: (ws.status as 'scored' | 'wo' | 'cancelled' | 'none') || 'none',
              })),
            })),
          };
        });
        setLocalCategories(formatted);
      }
    };

    syncLocal();
    window.addEventListener('itgames_storage_updated', syncLocal);
    window.addEventListener('itgames_standings_updated', syncLocal);
    return () => {
      window.removeEventListener('itgames_storage_updated', syncLocal);
      window.removeEventListener('itgames_standings_updated', syncLocal);
    };
  }, [activeGame]);

  const effectiveCategories = categories.length > 0 ? categories : localCategories;

  // Atualizar hora local em tempo real
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Efeito de rotação automática de categorias a cada 15 segundos
  useEffect(() => {
    if (!isAutoRotating || effectiveCategories.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentCategoryIndex((prev) => (prev + 1) % effectiveCategories.length);
    }, 15000);

    return () => clearInterval(interval);
  }, [isAutoRotating, effectiveCategories.length]);

  // Efeito de confete ao trocar de categoria (pausado quando bloqueado)
  useEffect(() => {
    if (isFrozen) return;
    try {
      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.2 },
        colors: ['#f59e0b', '#ef4444', '#3b82f6', '#10b981'],
      });
    } catch {
      // ignore
    }
  }, [currentCategoryIndex, isFrozen]);

  const currentCategory = effectiveCategories[currentCategoryIndex] || effectiveCategories[0];
  const currentCatFrozenMeta = currentCategory
    ? frozenCategoriesMap[String(currentCategory.id)] ||
      (currentCategory.frozen
        ? {
            gameCode: activeGame?.code || 'SUMMER2026',
            categoryId: currentCategory.id,
            categoryName: currentCategory.name,
            overlayText: currentCategory.overlayText || 'CATEGORIA EM REVISÃO',
            frozenAt: currentCategory.frozenAt || new Date().toISOString(),
          }
        : undefined)
    : undefined;
  const isCurrentCatFrozen = isFrozen || Boolean(currentCatFrozenMeta);

  const leaderboard: LeaderboardRank[] = currentCategory
    ? toLeaderboardRanks(currentCategory, activeGame?.totalUnit ?? 'PTS')
    : [];
  const totalUnit = activeGame?.totalUnit ?? 'PTS';
  const totalSuffix = totalUnit === 'TEMPO' ? '' : totalUnit;

  const podiumCategory =
    spotlight?.kind === 'podium'
      ? effectiveCategories.find((c) => c.id === spotlight.categoryId || c.name === spotlight.categoryName) || currentCategory
      : null;
  const podiumRanks = podiumCategory ? toLeaderboardRanks(podiumCategory, totalUnit).filter((r) => r.status !== 'cancelled') : [];

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 sm:p-10 flex flex-col justify-between select-none relative">
      {/* OVERLAY 1: CHAMADA OFICIAL DE ATLETAS PARA AS RAIAS (HEAT CALL) */}
      {spotlight?.kind === 'heat_call' && (
        <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col justify-between p-6 sm:p-10 select-none animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-amber-500/40 pb-5">
            <div className="flex items-center gap-4">
              <BrandLogo variant="white" size="lg" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-black font-black text-xs uppercase tracking-widest animate-pulse">
                    <Megaphone className="w-3.5 h-3.5" /> CHAMADA OFICIAL DE ARENA • CALL ROOM
                  </span>
                  <span className="text-zinc-400 text-xs font-bold uppercase">{spotlight.gameName}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  <span className="text-2xl sm:text-4xl font-black text-amber-400">{spotlight.categoryName}</span>
                  <span className="px-3 py-1 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-black text-sm">
                    {spotlight.workoutTitle}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="px-5 py-2.5 rounded-2xl bg-amber-500/15 border-2 border-amber-500 text-center">
                <div className="text-xl sm:text-3xl font-black text-amber-400">
                  BATERIA {spotlight.heatNumber}/{Math.max(spotlight.totalHeats, spotlight.heatNumber)}
                </div>
                <div className="text-xs font-mono font-bold text-zinc-200">LARGADA {spotlight.startTime}</div>
              </div>
              <button
                onClick={() => {
                  saveLocalArenaSpotlight(null);
                  setSpotlight(null);
                }}
                className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white"
                title="Fechar chamada e voltar ao placar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="my-3 py-2.5 px-4 rounded-xl bg-amber-500/15 border border-amber-500/40 text-center font-black text-sm sm:text-base text-white uppercase tracking-wide">
            {spotlight.message || 'ATLETAS DA BATERIA, DIRIJAM-SE ÀS SUAS RAIAS DE LARGADA'}
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 my-2 content-center">
            {spotlight.lanes.map((lane, idx) => (
              <div
                key={lane.laneNumber}
                style={{ animationDelay: `${idx * 420}ms`, animationFillMode: 'both' }}
                className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900 border-2 border-amber-500/50 shadow-lg animate-in fade-in zoom-in-90 slide-in-from-bottom-6 duration-700"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-20 h-16 rounded-xl bg-amber-500 text-black flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-black uppercase leading-none">RAIA</span>
                    <span className="text-2xl font-black font-mono leading-tight">
                      {String(lane.laneNumber).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xl sm:text-2xl font-black text-white truncate">{lane.teamName}</span>
                      {lane.number && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-black">
                          {lane.number}
                        </span>
                      )}
                    </div>
                    {lane.athletes.length > 0 && (
                      <div className="flex flex-col gap-1 mt-1.5">
                        {lane.athletes.map((ath, aIdx) => (
                          <div key={aIdx} className="flex items-center gap-2 text-xs sm:text-sm text-zinc-300 font-bold truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            <span className="truncate">{ath}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {lane.rank && lane.rank > 0 ? (
                  <div className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-right shrink-0">
                    <div className="text-xs font-black text-amber-400">{lane.rank}º GERAL</div>
                    {lane.totalDisplay && <div className="text-[11px] font-mono text-zinc-400">{lane.totalDisplay}</div>}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-zinc-800 pt-3 text-xs text-zinc-400">
            <span>ITMIZER ARENA CALL ROOM • CHAMADA OFICIAL DE RAIAS</span>
            <span className="font-mono font-bold text-white">{currentTime}</span>
          </div>
        </div>
      )}

      {/* OVERLAY 2: CERIMÔNIA OFICIAL DE PÓDIO — ANÚNCIO DOS VENCEDORES */}
      {spotlight?.kind === 'podium' && (
        <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col justify-between p-6 sm:p-10 select-none animate-in fade-in duration-300">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-amber-500/40 pb-5">
            <div className="flex items-center gap-4">
              <BrandLogo variant="white" size="lg" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-black font-black text-xs uppercase tracking-widest">
                    <Crown className="w-3.5 h-3.5" /> CERIMÔNIA OFICIAL DE PÓDIO • VENCEDORES
                  </span>
                  <span className="text-zinc-400 text-xs font-bold uppercase">{spotlight.gameName}</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-black text-white mt-1">{spotlight.categoryName}</h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((step) => (
                <button
                  key={step}
                  onClick={() => {
                    const updated: ScreenSpotlight = { ...spotlight, revealStep: step, autoAdvance: false };
                    saveLocalArenaSpotlight(updated);
                    setSpotlight(updated);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-black border ${
                    spotlight.revealStep === step
                      ? 'bg-amber-500 text-black border-amber-300'
                      : 'bg-zinc-900 text-zinc-300 border-zinc-700'
                  }`}
                >
                  {step === 1 ? '🥉 3º Lugar' : step === 2 ? '🥈 2º Lugar' : '🥇 1º Campeão'}
                </button>
              ))}
              <button
                onClick={() => {
                  saveLocalArenaSpotlight(null);
                  setSpotlight(null);
                }}
                className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white"
                title="Encerrar cerimônia de pódio"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 items-end my-6 max-w-6xl w-full mx-auto">
            {/* 2º LUGAR — PRATA */}
            {(() => {
              const second = podiumRanks[1];
              const revealed = spotlight.revealStep >= 2;
              return (
                <div className="flex flex-col items-center h-[85%]">
                  <div className="w-full flex-1 rounded-t-3xl bg-zinc-900 border-2 border-zinc-400/70 p-6 flex flex-col items-center justify-between text-center">
                    <span className="px-4 py-1 rounded-full bg-zinc-300 text-black font-black text-xs uppercase">
                      🥈 2º LUGAR • VICE-CAMPEÃO
                    </span>
                    {!second ? (
                      <span className="text-2xl font-black text-zinc-600">—</span>
                    ) : !revealed ? (
                      <div className="space-y-2">
                        <div className="text-5xl font-black text-zinc-600">2º</div>
                        <div className="text-xs font-black text-zinc-400">AGUARDANDO ANÚNCIO...</div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-2xl sm:text-3xl font-black text-white">{second.teamName}</div>
                        <div className="text-xs font-black text-zinc-300">BIB {second.registerNumber}</div>
                        <div className="text-xs text-zinc-400">{second.athletes.join(' • ')}</div>
                      </div>
                    )}
                    <div className="w-full py-2.5 rounded-xl bg-black/70 border border-zinc-500/40 font-mono font-black text-xl text-zinc-200">
                      {revealed && second ? `${second.totalDisplay ?? second.totalPoints} ${totalSuffix}` : '•••'}
                    </div>
                  </div>
                  <div className="w-full h-16 rounded-b-2xl bg-gradient-to-b from-zinc-300 to-zinc-500 text-black flex items-center justify-center font-black text-3xl">
                    2º
                  </div>
                </div>
              );
            })()}

            {/* 1º LUGAR — CAMPEÃO OURO */}
            {(() => {
              const first = podiumRanks[0];
              const revealed = spotlight.revealStep >= 3;
              return (
                <div className="flex flex-col items-center h-full">
                  <div className="w-full flex-1 rounded-t-3xl bg-gradient-to-b from-amber-500/25 to-zinc-900 border-2 border-amber-400 p-6 flex flex-col items-center justify-between text-center shadow-2xl shadow-amber-500/20">
                    <span className="px-4 py-1.5 rounded-full bg-amber-400 text-black font-black text-xs uppercase">
                      🥇 1º LUGAR • CAMPEÃO DA CATEGORIA
                    </span>
                    {!first ? (
                      <span className="text-2xl font-black text-zinc-600">—</span>
                    ) : !revealed ? (
                      <div className="space-y-2">
                        <div className="text-6xl font-black text-amber-500/40 animate-pulse">1º</div>
                        <div className="text-sm font-black text-amber-300">QUEM SERÁ O GRANDE CAMPEÃO?</div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-3xl sm:text-4xl font-black text-white">{first.teamName}</div>
                        <div className="text-sm font-black text-amber-400">BIB {first.registerNumber}</div>
                        <div className="text-sm text-zinc-300 font-bold">{first.athletes.join(' • ')}</div>
                      </div>
                    )}
                    <div className="w-full py-3 rounded-xl bg-black/80 border border-amber-400/60 font-mono font-black text-2xl text-amber-400">
                      {revealed && first ? `${first.totalDisplay ?? first.totalPoints} ${totalSuffix}` : '•••'}
                    </div>
                  </div>
                  <div className="w-full h-24 rounded-b-2xl bg-gradient-to-b from-amber-400 to-amber-600 text-black flex items-center justify-center font-black text-4xl">
                    1º
                  </div>
                </div>
              );
            })()}

            {/* 3º LUGAR — BRONZE */}
            {(() => {
              const third = podiumRanks[2];
              const revealed = spotlight.revealStep >= 1;
              return (
                <div className="flex flex-col items-center h-[78%]">
                  <div className="w-full flex-1 rounded-t-3xl bg-zinc-900 border-2 border-amber-700/70 p-6 flex flex-col items-center justify-between text-center">
                    <span className="px-4 py-1 rounded-full bg-amber-700 text-white font-black text-xs uppercase">
                      🥉 3º LUGAR • BRONZE
                    </span>
                    {!third ? (
                      <span className="text-2xl font-black text-zinc-600">—</span>
                    ) : !revealed ? (
                      <div className="text-4xl font-black text-zinc-600">3º</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-2xl sm:text-3xl font-black text-white">{third.teamName}</div>
                        <div className="text-xs font-black text-amber-500">BIB {third.registerNumber}</div>
                        <div className="text-xs text-zinc-400">{third.athletes.join(' • ')}</div>
                      </div>
                    )}
                    <div className="w-full py-2.5 rounded-xl bg-black/70 border border-amber-700/50 font-mono font-black text-xl text-amber-500">
                      {revealed && third ? `${third.totalDisplay ?? third.totalPoints} ${totalSuffix}` : '•••'}
                    </div>
                  </div>
                  <div className="w-full h-12 rounded-b-2xl bg-gradient-to-b from-amber-700 to-amber-900 text-white flex items-center justify-center font-black text-2xl">
                    3º
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="flex items-center justify-between border-t border-zinc-800 pt-3 text-xs text-zinc-400">
            <span>CERIMÔNIA OFICIAL DE PREMIAÇÃO • ITMIZER ARENA</span>
            <span className="font-mono font-bold text-white">{currentTime}</span>
          </div>
        </div>
      )}

      {/* OVERLAY DE BLOQUEIO DO LEADERBOARD (TOTAL OU CATEGORIA EM REVISÃO) */}
      {isCurrentCatFrozen && (
        <div className="fixed inset-0 z-40 bg-black/92 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300">
          <div className="absolute top-5 left-5 sm:top-8 sm:left-8 flex items-center gap-2">
            <Link
              href="/head-judge"
              className="px-4 py-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-black flex items-center gap-2 transition-all shadow-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Painel do Head Judge</span>
            </Link>
          </div>

          <div className="relative mb-6">
            <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-3xl bg-rose-500/15 border-2 border-rose-500/60 flex items-center justify-center text-rose-400 mx-auto shadow-2xl shadow-rose-500/40 animate-pulse">
              <Lock className="w-14 h-14 sm:w-20 sm:h-20" />
            </div>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-rose-600 text-white font-black text-xs uppercase tracking-widest shadow-xl border border-rose-400 flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              {!isFrozen && currentCategory ? `CATEGORIA: ${currentCategory.name}` : 'OFICIAL'}
            </div>
          </div>

          <div className="space-y-4 max-w-4xl px-2">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-black text-xs sm:text-sm uppercase tracking-widest">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping" />
              Gabinete de Arbitragem Geral &amp; Auditoria de Pista
            </div>

            <h1 className="text-3xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight uppercase drop-shadow-2xl">
              {!isFrozen && currentCatFrozenMeta ? currentCatFrozenMeta.overlayText : 'LEADERBOARD BLOQUEADO'}
            </h1>

            <p className="text-lg sm:text-3xl text-amber-400 font-black tracking-wide uppercase">
              {!isFrozen && currentCategory ? currentCategory.name : 'BLINDAGEM OFICIAL DE CLASSIFICAÇÃO'}
            </p>

            <p className="text-sm sm:text-lg text-zinc-300 max-w-2xl mx-auto leading-relaxed pt-1 font-medium">
              {!isFrozen && currentCategory ? (
                <>
                  As pontuações da categoria <strong className="text-amber-400">{currentCategory.name}</strong> estão{' '}
                  <strong className="text-rose-400">temporariamente em revisão</strong> pela Mesa do Head Judge. As demais categorias seguem ao vivo na rotação do telão!
                </>
              ) : (
                <>
                  A classificação geral e as pontuações estão <strong className="text-rose-400">temporariamente bloqueadas</strong> pela Mesa do Head Judge para conferência de súmulas, julgamento de penalidades e fechamento oficial do pódio.
                </>
              )}
            </p>

            {!isFrozen && effectiveCategories.length > 1 && (
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                {effectiveCategories.map((cat, idx) => (
                  <button
                    key={cat.id}
                    onClick={() => setCurrentCategoryIndex(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      idx === currentCategoryIndex
                        ? 'bg-amber-500 text-black'
                        : 'bg-zinc-900 text-zinc-300 border border-zinc-700 hover:text-white'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            <div className="pt-3 flex flex-wrap items-center justify-center gap-3 text-xs font-bold text-zinc-400">
              <span className="px-4 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center gap-2">
                <span className="text-zinc-500">Campeonato:</span>
                <span className="text-white font-black">{activeGame?.name || 'ITGames Arena'}</span>
              </span>
              <span className="px-4 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center gap-2">
                <span className="text-zinc-500">Hora Oficial:</span>
                <span className="text-amber-400 font-mono font-black">{currentTime || '--:--:--'}</span>
              </span>
              <span className="px-4 py-2 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 font-mono font-bold">
                Status: SIGILO DA MESA
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CABEÇALHO DO TELÃO DE ARENA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-amber-500/30 pb-5">
        <div className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/leaderboard"
            className="p-2.5 sm:p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="Voltar ao Leaderboard padrão"
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </Link>

          <BrandLogo variant="white" size="lg" />

          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {isFrozen ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600 text-white font-black text-xs uppercase tracking-widest">
                  <Lock className="w-3.5 h-3.5" />
                  LEADERBOARD BLOQUEADO
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white font-black text-xs uppercase tracking-widest animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  AO VIVO NA ARENA
                </span>
              )}
              <span className="text-zinc-400 text-xs uppercase font-bold tracking-wider">
                {activeGame?.name || 'ITGames Arena'} {activeGame?.location ? `• ${activeGame.location}` : ''}
              </span>
            </div>
            <h1 className="text-xl sm:text-4xl font-black tracking-tight text-white mt-1.5 flex flex-wrap items-center gap-2 sm:gap-3">
              <span>CATEGORIA:</span>
              <span className="text-amber-400 bg-amber-400/10 px-3 sm:px-4 py-0.5 sm:py-1 rounded-2xl border border-amber-400/30">
                {currentCategory?.name || 'Geral'}
              </span>
            </h1>
          </div>
        </div>

        {/* CONTROLES DO TELÃO E RELÓGIO */}
        <div className="flex items-center justify-between sm:justify-end gap-4">
          <div className="text-left sm:text-right">
            <div className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-widest">Hora Oficial</div>
            <div className="text-xl sm:text-3xl font-black font-mono text-white">{currentTime || '12:00:00'}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAutoRotating(!isAutoRotating)}
              className={`p-2.5 sm:p-3 rounded-2xl border transition-colors ${
                isAutoRotating
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800'
              }`}
              title={isAutoRotating ? 'Pausar rotação de categorias' : 'Ativar rotação automática'}
            >
              {isAutoRotating ? <Pause className="w-5 h-5 sm:w-6 sm:h-6" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>

            <button
              onClick={toggleFullScreen}
              className="p-2.5 sm:p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
              title="Tela Cheia (Full Screen)"
            >
              <Maximize2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* GRADE GIGANTE DE CLASSIFICAÇÃO */}
      <div className="my-6 sm:my-8 flex-1 flex flex-col justify-center">
        {leaderboard.length === 0 ? (
          <div className="rounded-3xl bg-zinc-900/60 border border-zinc-800 p-10 text-center space-y-3 max-w-2xl mx-auto">
            <Trophy className="w-12 h-12 text-amber-400/70 mx-auto" />
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Aguardando Pontuações Homologadas
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Assim que as primeiras súmulas forem lançadas e validadas pela arbitragem, o ranking desta categoria aparecerá automaticamente no telão.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.slice(0, 7).map((rankItem) => {
              const isTop1 = rankItem.rank === 1;
              const isTop2 = rankItem.rank === 2;
              const isTop3 = rankItem.rank === 3;

              return (
                <div
                  key={rankItem.registrationId}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl transition-all ${
                    isTop1
                      ? 'bg-gradient-to-r from-amber-500/30 via-zinc-900 to-zinc-900 border-2 border-amber-500 shadow-2xl shadow-amber-500/20 sm:scale-[1.01]'
                      : isTop2
                        ? 'bg-zinc-900/90 border border-zinc-500/50'
                        : isTop3
                          ? 'bg-zinc-900/90 border border-amber-700/50'
                          : 'bg-zinc-950/80 border border-zinc-800/80'
                  }`}
                >
                  {/* RANKING & ATLETA */}
                  <div className="flex items-center gap-4 sm:gap-5">
                    <div
                      className={`w-11 sm:w-14 h-11 sm:h-14 rounded-2xl flex items-center justify-center font-black text-xl sm:text-2xl shadow-lg shrink-0 ${
                        isTop1
                          ? 'bg-amber-500 text-black shadow-amber-500/50'
                          : isTop2
                            ? 'bg-zinc-300 text-black'
                            : isTop3
                              ? 'bg-amber-700 text-white'
                              : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {rankItem.rank}º
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg sm:text-3xl font-black text-white truncate">
                          {rankItem.teamName}
                        </span>
                        <span className="text-xs sm:text-base font-bold text-amber-400 bg-amber-400/20 px-2.5 py-0.5 rounded-lg border border-amber-400/30">
                          {rankItem.registerNumber}
                        </span>
                        {rankItem.status === 'cancelled' && (
                          <span className="text-xs sm:text-sm font-black text-rose-300 bg-rose-500/20 px-2.5 py-0.5 rounded-lg border border-rose-500/40 uppercase">
                            CANCELADA
                          </span>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-zinc-400 mt-0.5 font-medium truncate">
                        {rankItem.athletes.join(', ')}
                        {rankItem.boxOrAffiliate && (
                          <>
                            {' '}
                            • <strong className="text-zinc-300">{rankItem.boxOrAffiliate}</strong>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PONTUAÇÃO GIGANTE */}
                  <div className="text-right flex items-center justify-end gap-4 sm:gap-6">
                    <div className="hidden lg:flex items-center gap-3">
                      {rankItem.workoutScores.map((ws, idx) => {
                        const parsed = parseWodTitle(ws.workoutTitle, idx);
                        return (
                          <div key={idx} className="bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800 text-center min-w-[70px]">
                            <div className="text-[10px] text-zinc-400 font-bold uppercase">{parsed.shortTitle}</div>
                            <div className="text-xs font-black text-zinc-200">{ws.scoreDisplay}</div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-black/60 px-4 sm:px-6 py-2 rounded-2xl border border-amber-500/40">
                      <div className="text-[10px] uppercase font-bold text-zinc-400">Total Acumulado</div>
                      <div className="text-xl sm:text-4xl font-black text-amber-400 font-mono">
                        {rankItem.totalDisplay ?? rankItem.totalPoints}
                        {totalSuffix && <span className="text-xs sm:text-sm font-bold text-zinc-400"> {totalSuffix}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RODAPÉ INFORMATIVO COM ROTAÇÃO DE CATEGORIAS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-800 pt-4 text-xs text-zinc-400">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="font-bold text-white">Categorias da Competição:</span>
          <div className="flex flex-wrap items-center gap-2">
            {effectiveCategories.map((cat, idx) => (
              <button
                key={cat.id}
                onClick={() => setCurrentCategoryIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  idx === currentCategoryIndex
                    ? 'bg-amber-500 text-black'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 font-bold text-zinc-300">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>ITGames Broadcast Engine • Atualização Instantânea</span>
        </div>
      </div>
    </div>
  );
}
