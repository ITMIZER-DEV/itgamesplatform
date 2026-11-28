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
import { useServerFreeze } from '@/lib/use-server-freeze';

export default function BigScreenLeaderboardPage() {
  const { board } = useBoard(15000);
  const activeGame = board?.game ?? null;
  const categories = board?.categories ?? [];

  const [currentCategoryIndex, setCurrentCategoryIndex] = useState<number>(0);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(0);
  // TV/notebook mostra os WODs; tela estreita (celular) fica só com posição, dupla e total
  const [showWods, setShowWods] = useState<boolean>(true);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setShowWods(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  const pageCountRef = React.useRef(1);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [localFrozen, setIsFrozen] = useState<boolean>(false);
  const [localFrozenCats, setFrozenCategoriesMap] = useState<Record<string, FrozenCategorySummary>>({});
  const [spotlight, setSpotlight] = useState<ScreenSpotlight | null>(null);
  const [localCategories, setLocalCategories] = useState<BoardResponse['categories']>([]);

  // Detecção em tempo real de bloqueio/congelamento do Leaderboard e Spotlight (Chamada de Raias / Pódio)
  useEffect(() => {
    const checkFreeze = () => {
      const gCode = activeGame?.code || '';
      // só a chave do campeonato atual: as chaves globais antigas ficavam presas em "true" e congelavam qualquer evento
      const localFreeze = gCode ? localStorage.getItem(`itgames_freeze_leaderboard_${gCode}`) === 'true' : false;
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

  // O servidor manda: congelar na Mesa do Head Judge vale para todos os aparelhos (o local só cobre até a 1ª resposta)
  const serverFreeze = useServerFreeze(activeGame?.code);
  const isFrozen = serverFreeze.loaded
    ? serverFreeze.frozen || (activeGame?.status as string) === 'blocked'
    : localFrozen;
  const frozenCategoriesMap = serverFreeze.loaded ? serverFreeze.categories : localFrozenCats;


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
    if (!isAutoRotating || (effectiveCategories.length <= 1 && pageCountRef.current <= 1)) return;

    const interval = setInterval(() => {
      // percorre as páginas da categoria e só então passa para a próxima
      setCurrentPage((page) => {
        if (page + 1 < pageCountRef.current) return page + 1;
        setCurrentCategoryIndex((prev) => (prev + 1) % effectiveCategories.length);
        return 0;
      });
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

  // Telão: todas as duplas ativas, em páginas de até TV_PAGE_SIZE (cabe em 1080p sem rolar)
  const TV_PAGE_SIZE = 12;
  const visibleRanks = leaderboard.filter((r) => r.status !== 'cancelled');
  const pageCount = Math.max(1, Math.ceil(visibleRanks.length / TV_PAGE_SIZE));
  pageCountRef.current = pageCount;
  const safePage = Math.min(currentPage, pageCount - 1);
  const pageRanks = visibleRanks.slice(safePage * TV_PAGE_SIZE, (safePage + 1) * TV_PAGE_SIZE);
  const wodHeaders = showWods ? (visibleRanks[0]?.workoutScores ?? []).map((ws, idx) => parseWodTitle(ws.workoutTitle, idx)) : [];
  const tvColumns = `minmax(4rem, 5vw) minmax(0, 1fr) repeat(${wodHeaders.length}, minmax(6.5rem, 10vw)) minmax(6.5rem, 8vw)`;

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
    <div className="fixed inset-0 z-40 overflow-hidden bg-zinc-950 text-white px-[2vw] py-[2vh] flex flex-col select-none">
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
                <div className="text-xs font-mono font-bold text-zinc-200">
                  LARGADA {spotlight.startTime}
                  {spotlight.arena ? ` · ARENA ${spotlight.arena}` : ''}
                </div>
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
                    <div className="w-full py-2.5 rounded-xl bg-zinc-950 border border-zinc-500/40 font-mono font-black text-xl text-zinc-200">
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
                    <div className="w-full py-3 rounded-xl bg-zinc-950 border border-amber-400/60 font-mono font-black text-2xl text-amber-400">
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
                    <div className="w-full py-2.5 rounded-xl bg-zinc-950 border border-amber-700/50 font-mono font-black text-xl text-amber-500">
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
        <div className="fixed inset-0 z-40 bg-zinc-950 flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300">
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
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-[#c0392b] text-[#ffffff] font-black text-xs uppercase tracking-widest shadow-xl border border-[#c0392b] flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-[#ffffff] animate-ping" />
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

      {/* CABEÇALHO: categoria em destaque, status e hora (leitura à distância) */}
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 pb-[1.2vh] border-b-2 border-amber-500/40">
        <Link
          href="/leaderboard"
          className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors"
          title="Voltar ao Leaderboard padrão"
        >
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <BrandLogo variant="auto" size="lg" />

        <div className="min-w-[14rem] flex-1">
          <div className="text-[clamp(0.8rem,1.5vh,1.2rem)] font-bold uppercase tracking-[0.2em] text-zinc-400 truncate">
            {activeGame?.name || 'ITGames Arena'}
          </div>
          <h1 className="text-[clamp(1.8rem,5vh,4.2rem)] leading-none font-black tracking-tight text-white truncate">
            {currentCategory?.name || 'Geral'}
          </h1>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {isFrozen ? (
            <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#c0392b] text-[#ffffff] font-black text-[clamp(0.9rem,1.8vh,1.4rem)] uppercase">
              <Lock className="w-5 h-5" /> Bloqueado
            </span>
          ) : (
            <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#d32f2f] text-[#ffffff] font-black text-[clamp(0.9rem,1.8vh,1.4rem)] uppercase">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffffff] animate-pulse" /> Ao vivo
            </span>
          )}
          {pageCount > 1 && (
            <span className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 font-black font-mono text-[clamp(0.9rem,1.8vh,1.4rem)]">
              {safePage + 1}/{pageCount}
            </span>
          )}
          <div className="text-right">
            <div className="text-[clamp(1.4rem,3.6vh,3rem)] leading-none font-black font-mono text-white tabular-nums">
              {currentTime || '--:--:--'}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsAutoRotating(!isAutoRotating)}
              className={`p-2 rounded-xl transition-colors ${isAutoRotating ? 'text-amber-400' : 'text-zinc-500'} hover:bg-zinc-900`}
              title={isAutoRotating ? 'Pausar rotação de categorias' : 'Ativar rotação automática'}
            >
              {isAutoRotating ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
            <button
              onClick={toggleFullScreen}
              className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors"
              title="Tela Cheia (Full Screen)"
            >
              <Maximize2 className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* TABELA: todas as duplas da categoria (até TV_PAGE_SIZE por tela; acima disso, pagina sozinha) */}
      <main className="flex-1 min-h-0 flex flex-col pt-[1.2vh]">
        {visibleRanks.length === 0 ? (
          <div className="m-auto text-center space-y-3">
            <Trophy className="w-16 h-16 text-amber-400/70 mx-auto" />
            <h2 className="text-[clamp(1.4rem,3.5vh,2.6rem)] font-black text-white">Aguardando resultados</h2>
            <p className="text-[clamp(1rem,2vh,1.4rem)] text-zinc-400">A classificação aparece aqui assim que as súmulas forem homologadas.</p>
          </div>
        ) : (
          <>
            <div
              className="grid items-end gap-x-[1vw] px-[1vw] pb-[0.8vh] text-[clamp(0.8rem,1.6vh,1.25rem)] font-black uppercase tracking-wider text-zinc-400"
              style={{ gridTemplateColumns: tvColumns }}
            >
              <div className="text-center">Pos</div>
              <div>Dupla</div>
              {wodHeaders.map((w, i) => (
                <div key={i} className="text-center leading-tight">
                  <div className="text-zinc-200">{w.shortTitle}</div>
                </div>
              ))}
              <div className="text-right">Total</div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col gap-[0.5vh]">
              {pageRanks.map((r) => {
                const podium = r.rank <= 3;
                return (
                  <div
                    key={r.registrationId}
                    className={`grid items-center gap-x-[1vw] px-[1vw] rounded-xl border flex-1 min-h-0 max-h-[9vh] ${
                      r.rank === 1
                        ? 'bg-amber-500/15 border-amber-500'
                        : 'bg-zinc-900 border-zinc-800'
                    }`}
                    style={{ gridTemplateColumns: tvColumns }}
                  >
                    <div
                      className={`mx-auto flex items-center justify-center rounded-lg font-black tabular-nums h-[min(6vh,3.6rem)] aspect-square text-[clamp(1.2rem,3.2vh,2.6rem)] ${
                        r.rank === 1
                          ? 'bg-[#f47b20] text-[#2a1405]'
                          : r.rank === 2
                            ? 'bg-[#c9ccd1] text-[#111317]'
                            : r.rank === 3
                              ? 'bg-[#a8743a] text-[#ffffff]'
                              : 'text-white'
                      }`}
                    >
                      {r.rank}º
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-baseline gap-3 min-w-0">
                        <span className={`truncate font-black text-white leading-none text-[clamp(1.1rem,2.7vh,2.2rem)] ${podium ? '' : ''}`}>
                          {r.teamName}
                        </span>
                        <span className="shrink-0 font-bold text-amber-400 text-[clamp(0.8rem,1.7vh,1.3rem)]">{r.registerNumber}</span>
                      </div>
                      <div className="truncate text-zinc-400 font-medium leading-tight mt-[0.3vh] text-[clamp(0.75rem,1.35vh,1.05rem)]">
                        {r.athletes.join(' • ')}
                      </div>
                    </div>

                    {wodHeaders.map((_, i) => {
                      const ws = r.workoutScores[i];
                      const has = ws && ws.status !== 'none' && ws.scoreDisplay && ws.scoreDisplay !== '-';
                      // "4R + 9 reps (10:58)": resultado em cima; tempo, posição e pontos embaixo
                      const split = has ? /^(.*?)\s*\(([^)]*)\)\s*$/.exec(ws.scoreDisplay) : null;
                      const main = split ? split[1] : ws?.scoreDisplay;
                      const sub = has
                        ? [split?.[2], ws.rank > 0 ? `${ws.rank}º` : null, totalUnit === 'PTS' && ws.rank > 0 ? `${ws.points} pts` : null]
                            .filter(Boolean)
                            .join(' • ')
                        : '';
                      return (
                        <div key={i} className="text-center leading-tight min-w-0">
                          <div className={`truncate font-black tabular-nums text-[clamp(0.9rem,2vh,1.6rem)] ${has ? 'text-white' : 'text-zinc-600'}`}>
                            {has ? main : '—'}
                          </div>
                          {sub && (
                            <div className="truncate text-zinc-400 font-bold tabular-nums text-[clamp(0.7rem,1.35vh,1.05rem)]">{sub}</div>
                          )}
                        </div>
                      );
                    })}

                    <div className="text-right">
                      <span className="font-black font-mono tabular-nums text-amber-400 text-[clamp(1.4rem,3.8vh,3.2rem)] leading-none">
                        {r.totalDisplay ?? r.totalPoints}
                      </span>
                      {totalSuffix && (
                        <span className="ml-1 font-bold text-zinc-400 text-[clamp(0.75rem,1.5vh,1.1rem)]">{totalSuffix}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* RODAPÉ: categorias na rotação (a atual em destaque) */}
      <footer className="flex items-center gap-2 pt-[0.8vh] mt-[0.6vh] border-t border-zinc-800 overflow-hidden">
        {effectiveCategories.map((cat, idx) => (
          <button
            key={cat.id}
            onClick={() => {
              setCurrentCategoryIndex(idx);
              setCurrentPage(0);
            }}
            className={`px-3 py-1.5 rounded-lg font-black uppercase whitespace-nowrap text-[clamp(0.75rem,1.5vh,1.1rem)] transition-colors ${
              idx === currentCategoryIndex ? 'bg-[#f47b20] text-[#2a1405]' : 'text-zinc-500 hover:text-white'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </footer>
    </div>
  );
}
